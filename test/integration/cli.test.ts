import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer, type Server } from "node:http";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { saveWallet } from "../../src/services/wallet.js";
const exec = promisify(execFile),
  bin = resolve("bin/vexum.js");
const env = {
  ...process.env,
  VEXUM_NO_BROADCAST: "1",
  NODE_ENV: "test",
  PINATA_JWT: "",
  JUPITER_API_KEY: "",
  HELIUS_RPC_URL: "",
  VEXUM_RPC_FALLBACKS: "",
  VEXUM_SOLANA_RPC_URL: "http://127.0.0.1:1",
  VEXUM_CLUSTER: "mainnet-beta",
};
async function run(args: string[], extra: NodeJS.ProcessEnv = {}) {
  return exec(process.execPath, [bin, ...args], {
    cwd: tmpdir(),
    env: { ...env, ...extra },
    timeout: 15000,
  });
}
async function listening(server: Server) {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const a = server.address();
  if (!a || typeof a === "string") throw new Error("No server port");
  return `http://127.0.0.1:${a.port}`;
}
test("noninteractive help, unknown commands, missing options and FUD exception", async () => {
  assert.ok(
    (await run(["wallet", "--help"])).stdout.includes("Encrypted Ed25519"),
  );
  assert.ok((await run(["FUD", "TXN", "BOT"])).stdout.includes("Coming Soon"));
  await assert.rejects(() => run(["Coin", "Launcher"]), /Interactive menus/);
  await assert.rejects(
    () => run(["wallet", "create", "--unknown"]),
    /unknown option/,
  );
  await assert.rejects(() => run(["launch", "run"]), /required option/);
  await assert.rejects(() => run(["make something up"]), /Unsupported request/);
});
test("wallet CLI persists only encrypted keypair and imports/shows it across processes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-cli-")),
    file = join(dir, "wallet.vault.json");
  const out = await run(["wallet", "create", "--out", file], {
    VEXUM_PASSPHRASE: "integration-password-123",
  });
  const result = JSON.parse(out.stdout);
  assert.equal(result.encrypted, true);
  assert.equal(result.walletFile, file);
  assert.ok(!out.stdout.includes("secretKey"));
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.cipher, "aes-256-gcm");
  assert.ok(!("secretKey" in stored));
  assert.equal(
    JSON.parse(
      (
        await run(["wallet", "show", file], {
          VEXUM_PASSPHRASE: "integration-password-123",
        })
      ).stdout,
    ).address,
    result.address,
  );
  await assert.rejects(
    () => run(["wallet", "show", file], { VEXUM_PASSPHRASE: "wrong-password" }),
    /Cannot unlock/,
  );
});
test("metadata command writes a valid artifact with proper process exit status", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-cli-meta-")),
    file = join(dir, "nft.json");
  const out = await run([
    "metadata",
    "create",
    "--name",
    "Fixture NFT",
    "--image",
    "ipfs://fixture",
    "--royalties",
    "500",
    "--out",
    file,
  ]);
  assert.equal(JSON.parse(out.stdout).status, "created");
  assert.equal(JSON.parse(await readFile(file, "utf8")).name, "Fixture NFT");
  await assert.rejects(() =>
    run([
      "metadata",
      "create",
      "--name",
      "Fixture",
      "--image",
      "ipfs://fixture",
      "--royalties",
      "10001",
      "--out",
      join(dir, "invalid.json"),
    ]),
  );
});
test("real HTTP RPC wallet inspection and transfer simulation never call sendTransaction", async () => {
  const wallet = Keypair.generate();
  let sends = 0,
    simulations = 0;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      const call = JSON.parse(body);
      let result: unknown;
      if (call.method === "getGenesisHash")
        result = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
      else if (call.method === "getMultipleAccounts")
        result = {
          context: { slot: 1 },
          value: call.params[0].map(() => ({
            executable: true,
            owner: "BPFLoaderUpgradeab1e11111111111111111111111",
            lamports: 1,
            rentEpoch: 0,
            data: ["", "base64"],
          })),
        };
      else if (call.method === "getBalance")
        result = { context: { slot: 1 }, value: 100000000 };
      else if (call.method === "getTokenAccountsByOwner")
        result = { context: { slot: 1 }, value: [] };
      else if (call.method === "getSignaturesForAddress") result = [];
      else if (call.method === "getLatestBlockhash")
        result = {
          context: { slot: 1 },
          value: {
            blockhash: Keypair.generate().publicKey.toBase58(),
            lastValidBlockHeight: 1000,
          },
        };
      else if (call.method === "getFeeForMessage")
        result = { context: { slot: 1 }, value: 5000 };
      else if (call.method === "simulateTransaction") {
        simulations++;
        const tx = VersionedTransaction.deserialize(
          Buffer.from(call.params[0], "base64"),
        );
        assert.ok(tx.signatures.every((s) => s.every((b) => b === 0)));
        result = {
          context: { slot: 1 },
          value: {
            err: null,
            logs: [],
            unitsConsumed: 100,
            accounts: [
              {
                lamports: 99990000,
                owner: "11111111111111111111111111111111",
                executable: false,
                rentEpoch: 0,
                data: ["", "base64"],
              },
            ],
          },
        };
      } else {
        sends++;
        res.writeHead(500);
        res.end();
        return;
      }
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ jsonrpc: "2.0", id: call.id, result }));
    });
  });
  const url = await listening(server);
  try {
    const info = JSON.parse(
      (
        await run(["wallet", "info", wallet.publicKey.toBase58()], {
          VEXUM_SOLANA_RPC_URL: url,
        })
      ).stdout,
    );
    assert.equal(info.sol, "0.1");
    assert.deepEqual(info.tokens, []);
    const dir = await mkdtemp(join(tmpdir(), "vexum-cli-tx-")),
      file = join(dir, "wallet.json");
    await saveWallet(file, wallet, "integration-password-123");
    const result = JSON.parse(
      (
        await run(
          [
            "transfer",
            Keypair.generate().publicKey.toBase58(),
            "--wallet",
            file,
            "--lamports",
            "10000",
          ],
          {
            VEXUM_SOLANA_RPC_URL: url,
            VEXUM_PASSPHRASE: "integration-password-123",
          },
        )
      ).stdout,
    );
    assert.equal(result.status, "dry-run");
    assert.equal(sends, 0);
    assert.equal(simulations, 1);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
  }
});

test("dotenv configuration is parsed as data and cannot execute shell substitution", async () => {
  const { writeFile, access } = await import("node:fs/promises");
  const dir = await mkdtemp(join(tmpdir(), "vexum-env-")),
    file = join(dir, "config.env"),
    marker = join(dir, "must-not-exist");
  await writeFile(file, `UNUSED_VALUE=$(touch "${marker}")\n`);
  assert.ok(
    (await run(["wallet", "--help"], { VEXUM_ENV_FILE: file })).stdout.includes(
      "Encrypted Ed25519",
    ),
  );
  await assert.rejects(() => access(marker));
});

test("mainnet CLI rejects removed modes and non-mainnet operation without trading fallback", async () => {
  const mint = Keypair.generate().publicKey.toBase58();
  const help = (await run(["trade", "buy", "--help"])).stdout;
  assert.ok(help.includes("--preflight"));
  assert.ok(!help.includes("--simulate"));
  assert.ok(!help.toLowerCase().includes("paper"));
  await assert.rejects(
    () => run(["trade", "buy", mint, "--simulate", "--wallet", "unused"]),
    /unknown option/,
  );
  await assert.rejects(
    () => run(["trade", "buy", mint, "--wallet", "unused"]),
    /Choose --preflight/,
  );
  await assert.rejects(
    () => run(["wallet", "info", mint], { VEXUM_CLUSTER: "devnet" }),
    /Mainnet Beta/,
  );
  await assert.rejects(() => run(["airdrop", mint, "--request"]));
});
