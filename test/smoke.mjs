// No network, wallet creation/unlock, signing or submission. Also runs against an installed package.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";

const binary = resolve(process.argv[2] ?? "bin/vexum.js");
const env = {
  ...process.env,
  VEXUM_CLUSTER: "mainnet-beta",
  VEXUM_NO_BROADCAST: "1",
  VEXUM_ENV_FILE: "",
  NODE_ENV: "test",
};
function run(args) {
  return execFileSync(process.execPath, [binary, ...args], {
    cwd: tmpdir(), env, encoding: "utf8", timeout: 15000,
  });
}
const routes = [
  "wallet create", "wallet import", "wallet show", "wallet reveal", "wallet export",
  "wallet info", "wallet history", "token scan", "token creation", "token search", "token plan",
  "metadata create", "launch upload", "launch run", "nft mint",
  "trade buy", "trade sell", "trade reconcile", "trade positions", "trade history", "trade quote",
  "sniper monitor", "domain", "audit", "research", "hyperframes", "transfer", "transaction status", "fud",
];
for (const route of routes) {
  const help = run([...route.split(" "), "--help"]);
  assert.ok(help.includes("Usage:"), `${route} is registered`);
  assert.ok(!/paper[ -]trad|virtual balance|fictional/i.test(help), route);
}
assert.ok(run(["status"]).includes("mainnet-beta"));
const { version } = JSON.parse(readFileSync(resolve(dirname(binary), "../package.json"), "utf8"));
assert.equal(run(["version"]).trim(), `vexum ${version}`);
assert.ok(run(["fud"]).includes("FUD TXN BOT — Coming Soon"));
assert.ok(run(["trade", "buy", "--help"]).includes("--preflight"));
assert.ok(run(["transfer", "--help"]).includes("--intent"));
console.log(`PASS: ${routes.length} command routes, startup/mainnet status, security flags and FUD placeholder outside the checkout`);
