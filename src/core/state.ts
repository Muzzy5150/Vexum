import { open, rename, unlink, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { privateFile } from "../services/wallet.js";

export async function atomicJson(path: string, value: unknown) {
  const temp = `${path}.${randomUUID()}.tmp`;
  await privateFile(temp, JSON.stringify(value, null, 2) + "\n");
  try {
    await rename(temp, path);
    await syncStateDirectory(dirname(path));
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}
export async function claimLock(path: string) {
  try {
    await privateFile(path, String(process.pid));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    // Serialize stale-lock reclamation. Otherwise two reclaimers can unlink a
    // freshly acquired lock after both observed the same dead process.
    const recovery = path + ".recovery";
    try {
      await privateFile(recovery, String(process.pid));
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code === "EEXIST")
        throw new Error(
          "Position lock recovery is already active; inspect the recovery lock if its process stopped",
        );
      throw failure;
    }
    try {
      const pid = Number(await readFile(path, "utf8"));
      if (!Number.isSafeInteger(pid) || pid < 1)
        throw new Error("Invalid position lock; inspect it before recovery");
      try {
        process.kill(pid, 0);
        throw new Error("Another CLI process holds the position lock");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ESRCH") throw e;
      }
      await unlink(path);
      await privateFile(path, String(process.pid));
    } finally {
      await unlink(recovery);
    }
  }
}
export async function syncStateDirectory(path: string) {
  // POSIX directory sync makes renamed state durable; unsupported platforms remain atomic.
  if (process.platform === "win32") return;
  const file = await open(path, "r");
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
