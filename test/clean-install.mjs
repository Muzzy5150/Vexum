import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import assert from "node:assert/strict";
const exec = promisify(execFile),
  root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dir = await mkdtemp(join(tmpdir(), "vexum-clean-"));
try {
  const { stdout } = await exec(
    process.execPath,
    [process.env.npm_execpath, "pack", "--pack-destination", dir, "--json"],
    { cwd: root },
  );
  const pack = JSON.parse(stdout.slice(stdout.search(/\[\s*\{/)))[0];
  assert.ok(
    !pack.files.some((f) =>
      (/(?:^|\/)\.env(?:\.|$)/.test(f.path) && f.path !== ".env.example") ||
      /\.vault\.json|\.keypair\.json|artifacts\/|docs\/(?:acceptance|verification)\//.test(f.path),
    ),
  );
  const install = join(dir, "install");
  await (await import("node:fs/promises")).mkdir(install);
  await writeFile(join(install, "package.json"), '{"private":true}');
  await exec(
    process.execPath,
    [
      process.env.npm_execpath,
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      join(dir, pack.filename),
    ],
    { cwd: install, timeout: 120000 },
  );
  const binary = join(
    install,
    "node_modules",
    ...pack.name.split("/"),
    "bin/vexum.js",
  );
  const help = await exec(process.execPath, [binary, "wallet", "--help"], {
    cwd: tmpdir(),
    env: { ...process.env, VEXUM_NO_BROADCAST: "1" },
  });
  assert.ok(help.stdout.includes("Encrypted Ed25519"));
  await exec(process.execPath, [join(root, "test/smoke.mjs"), binary], {
    cwd: tmpdir(),
    env: { ...process.env, VEXUM_NO_BROADCAST: "1" },
    timeout: 120000,
  });
  const inventory = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(
      join(
        install,
        "node_modules",
        ...pack.name.split("/"),
        "dist/bundle-manifest.json",
      ),
      "utf8",
    ),
  );
  assert.ok(
    inventory.packages.some((p) => p.name === "@vexum/bigint-buffer-safe"),
  );
  assert.ok(
    inventory.packages.some(
      (p) => p.name === "jayson" && p.version === "5.0.0",
    ),
  );
  assert.ok(
    !inventory.packages.some((p) =>
      ["bigint-buffer", "stream-json"].includes(p.name),
    ),
  );
  const audit = await exec(
    process.execPath,
    [process.env.npm_execpath, "audit", "--json"],
    { cwd: install, timeout: 120000 },
  );
  assert.equal(JSON.parse(audit.stdout).metadata.vulnerabilities.total, 0);
  const installed = JSON.parse(
    await (
      await import("node:fs/promises")
    ).readFile(
      join(install, "node_modules", ...pack.name.split("/"), "package.json"),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(installed.dependencies), ["dotenv"]);
  const packageRoot = join(install, "node_modules", ...pack.name.split("/"));
  const fs = await import("node:fs/promises");
  assert.equal(
    await fs.readFile(join(packageRoot, ".env.example"), "utf8"),
    await fs.readFile(join(packageRoot, "config.example.env"), "utf8"),
  );
  assert.ok(
    (
      await fs.readFile(join(packageRoot, "config.example.env"), "utf8")
    ).includes("VEXUM_NO_BROADCAST=1"),
  );
  if (installed.files.includes("docs"))
    assert.ok(
      (
        await fs.readFile(join(packageRoot, "docs/PROTOCOLS.md"), "utf8")
      ).includes("funded"),
    );

  console.log(
    "PASS: packed CLI installs cleanly, excludes websites/secrets, runs outside the repository, and audits cleanly (bundle inventory checked independently)",
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
