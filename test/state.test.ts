import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { atomicJson, claimLock } from "../src/core/state.js";
import { withPositions } from "../src/services/trading.js";
import { privateFile } from "../src/services/wallet.js";

test("state writes are atomic replacements and active locks prevent concurrent mutation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-state-")),
    path = join(dir, "state.json");
  await atomicJson(path, { version: 1 });
  await atomicJson(path, { version: 2 });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), { version: 2 });
  await claimLock(path + ".lock");
  await assert.rejects(() => claimLock(path + ".lock"), /Another CLI process/);
  await unlink(path + ".lock");
  await privateFile(path + ".lock", "2147483647");
  await claimLock(path + ".lock");
  assert.equal(await readFile(path + ".lock", "utf8"), String(process.pid));
  await unlink(path + ".lock");
});
test("failed position action preserves prior state and releases its lock", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-position-")),
    path = join(dir, "positions.json");
  await atomicJson(path, []);
  await assert.rejects(
    () =>
      withPositions(async () => {
        throw new Error("declined before submission");
      }, path),
    /declined/,
  );
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), []);
  assert.equal(
    await withPositions(async (positions) => positions.length, path),
    0,
  );
});

test("concurrent stale-lock reclaimers cannot both acquire the position lock", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-lock-race-")),
    path = join(dir, "positions.lock");
  await privateFile(path, "2147483647");
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () => claimLock(path)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(await readFile(path, "utf8"), String(process.pid));
  await unlink(path);
});
