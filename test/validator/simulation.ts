// Optional actual SVM verification. No request in this program can submit a transaction.
import assert from "node:assert/strict";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { nftInstructions, verifyNftAccount } from "../../src/services/nft.js";
import {
  makeTransaction,
  executeTransaction,
} from "../../src/services/transactions.js";
import { createHash } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return address.port;
}
const directory = await mkdtemp(join(tmpdir(), "vexum-svm-"));
// Never persist these private keys or reuse deterministic keys that could hold public funds.
const payer = Keypair.generate(),
  asset = Keypair.generate();
const port = await freePort(),
  gossip = await freePort(),
  faucet = await freePort();
const allowed = new Set([
  "getGenesisHash",
  "getLatestBlockhash",
  "getFeeForMessage",
  "getBalance",
  "simulateTransaction",
  "getAccountInfo",
  "getMultipleAccounts",
  "getVersion",
  "getSlot",
]);
const calls: string[] = [];
const conn = new Connection(`http://127.0.0.1:${port}`, {
  commitment: "confirmed",
  fetch: async (url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(allowed.has(body.method), `Forbidden RPC: ${body.method}`);
    calls.push(body.method);
    assert.equal(new URL(String(url)).hostname, "127.0.0.1");
    return fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  },
});
const account = join(directory, "payer-account.json"),
  configuration = join(directory, "validator.yml");
await writeFile(
  account,
  JSON.stringify({
    pubkey: payer.publicKey.toBase58(),
    account: {
      lamports: 10000000000,
      data: ["", "base64"],
      owner: SystemProgram.programId.toBase58(),
      executable: false,
      rentEpoch: 0,
    },
  }),
);
await writeFile(
  configuration,
  'json_rpc_url: https://api.mainnet-beta.solana.com\nwebsocket_url: ""\nkeypair_path: unused-test-keypair-never-created\ncommitment: confirmed\n',
);
let startupError: Error | undefined;
const child = spawn(
  process.env.VEXUM_VALIDATOR_BIN || "solana-test-validator",
  [
    "--config",
    configuration,
    "--ledger",
    join(directory, "ledger"),
    "--bind-address",
    "127.0.0.1",
    "--rpc-port",
    String(port),
    "--gossip-port",
    String(gossip),
    "--faucet-port",
    String(faucet),
    "--dynamic-port-range",
    "55000-55100",
    "--mint",
    Keypair.generate().publicKey.toBase58(),
    "--account",
    payer.publicKey.toBase58(),
    account,
    "--clone-upgradeable-program",
    "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
    "--url",
    "https://api.mainnet-beta.solana.com",
    "--quiet",
  ],
  {
    cwd: directory,
    env: { PATH: process.env.PATH },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const output: Buffer[] = [];
child.stdout.on("data", (chunk) => output.push(chunk));
child.stderr.on("data", (chunk) => output.push(chunk));
child.once("error", (error) => {
  startupError = error;
});
const closed = new Promise<void>((resolve) =>
  child.once("close", () => resolve()),
);
try {
  let ready = false;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    if (startupError)
      throw new Error(
        "Install solana-test-validator or configure VEXUM_VALIDATOR_BIN",
      );
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error(
        "Isolated validator stopped: " +
          Buffer.concat(output).toString().slice(-3000),
      );
    try {
      await conn.getVersion();
      // RPC opens before the first bank has populated slot-hashes sysvars.
      if ((await conn.getSlot("confirmed")) < 5)
        throw new Error("Validator warming up");
      ready = true;
      break;
    } catch {
      await delay(300);
    }
  }
  assert.ok(ready, "Isolated validator did not become ready in 60 seconds");
  process.env.VEXUM_CLUSTER = "localnet";
  const genesis = await conn.getGenesisHash();
  assert.ok(
    ![
      "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
      "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
      "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
    ].includes(genesis),
  );
  const balance = await conn.getBalance(payer.publicKey);
  assert.equal(balance, 10000000000);
  const options = { maxDebitLamports: 100000000, maxFeeLamports: 100000 };
  const transfer = (
    await makeTransaction(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: asset.publicKey,
          lamports: 2000000,
        }),
      ],
      payer.publicKey,
      conn,
    )
  ).transaction;
  const transferResult = await executeTransaction(
    transfer,
    [payer],
    options,
    conn,
  );
  assert.equal(transferResult.status, "dry-run");
  assert.ok(transfer.signatures[0].every((v) => v === 0));
  const name = "VEXUM local simulation",
    uri = "https://example.com/fixture.json";
  const nft = (
    await makeTransaction(
      await nftInstructions(name, uri, payer.publicKey, asset.publicKey),
      payer.publicKey,
      conn,
    )
  ).transaction;
  const nftResult = await executeTransaction(
    nft,
    [payer, asset],
    options,
    conn,
  );
  assert.equal(nftResult.status, "dry-run");
  const simulated = await conn.simulateTransaction(nft, {
    sigVerify: false,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [asset.publicKey.toBase58()] },
  });
  assert.equal(simulated.value.err, null);
  const simulatedAccount = simulated.value.accounts?.[0];
  assert.ok(simulatedAccount);
  assert.equal(
    verifyNftAccount(
      {
        ...simulatedAccount,
        owner: new PublicKey(simulatedAccount.owner),
        data: Buffer.from(simulatedAccount.data[0], "base64"),
      },
      asset.publicKey,
      payer.publicKey,
      name,
      uri,
    ),
    true,
  );
  assert.ok(nft.signatures.every((s) => s.every((v) => v === 0)));
  assert.equal(await conn.getBalance(payer.publicKey), balance);
  assert.equal(await conn.getAccountInfo(asset.publicKey), null);
  const program = await conn.getAccountInfo(
    new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  );
  assert.ok(program?.executable);
  let programDataSha256: string | null = null;
  if (
    program.owner.toBase58() ===
      "BPFLoaderUpgradeab1e11111111111111111111111" &&
    program.data.readUInt32LE(0) === 2
  ) {
    const data = await conn.getAccountInfo(
      new PublicKey(program.data.subarray(4, 36)),
    );
    assert.ok(data);
    programDataSha256 = createHash("sha256")
      .update(data.data.subarray(45))
      .digest("hex");
  }
  console.log(
    JSON.stringify(
      {
        validator: await conn.getVersion(),
        genesis,
        transfer: transferResult.review,
        nft: nftResult.review,
        coreProgramDataSha256: programDataSha256,
        programSource: "read-only mainnet executable clone",
        assertions:
          "real SVM simulation; decoded simulated Core account; no signature/broadcast; balances unchanged; asset absent; fresh in-memory keys; temporary ledger cleaned",
        rpcMethods: [...new Set(calls)],
      },
      null,
      2,
    ),
  );
} finally {
  if (child.exitCode === null && child.signalCode === null)
    child.kill("SIGTERM");
  let stopped = false;
  await Promise.race([
    closed.then(() => {
      stopped = true;
    }),
    delay(10000, undefined, { ref: false }),
  ]);
  if (!stopped) {
    child.kill("SIGKILL");
    await closed;
  }
  await rm(directory, { recursive: true, force: true });
  // Touching neither user configuration nor any user wallet file is intentional.
}
