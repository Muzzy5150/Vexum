// Optional production read-only evidence. This transport cannot broadcast or request funds.
import assert from "node:assert/strict";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { config, redact, SOL_MINT } from "../src/core/config.js";
import { Rpc } from "../src/core/network.js";
import {
  assertNetwork,
  makeTransaction,
  verifyTransactionPrograms,
} from "../src/services/transactions.js";
import { launchInstructions } from "../src/services/launch.js";
import { nftInstructions } from "../src/services/nft.js";
import {
  monitorCreations,
  swapQuote,
  swapBuild,
  swapTransaction,
  defaultLimits,
} from "../src/services/trading.js";
import { tokenInfo, walletInfo } from "../src/services/intelligence.js";
import { PUMP_PROGRAM_ID, PUMP_SDK } from "../src/core/pump.js";
import { printResult } from "../src/cli.js";
process.env.VEXUM_NO_BROADCAST = "1";
assert.equal(config().cluster, "mainnet-beta");
const allowed = new Set([
  "getGenesisHash",
  "getVersion",
  "getSlot",
  "getMultipleAccounts",
  "getAccountInfo",
  "getLatestBlockhash",
  "getFeeForMessage",
  "simulateTransaction",
]);
const calls: string[] = [];
const conn = new Connection(config().endpoints[0], {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
  fetch: async (u, init) => {
    const body = JSON.parse(String(init?.body));
    assert.ok(allowed.has(body.method), `Disallowed RPC: ${body.method}`);
    calls.push(body.method);
    return fetch(u, { ...init, signal: AbortSignal.timeout(15000) });
  },
});
const evidence: Record<string, unknown> = {
  observedAt: new Date().toISOString(),
  purpose:
    "Production read-only checks; no funded wallet, signing or submission",
  genesis: await assertNetwork(conn),
};
async function check(name: string, run: () => Promise<unknown>) {
  try {
    evidence[name] = { status: "observed", result: await run() };
  } catch (e) {
    evidence[name] = { status: "unavailable", reason: redact(e) };
  }
}
const usdc = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
await check("programAccounts", async () => {
  const ids = [
    SystemProgram.programId,
    new PublicKey("ComputeBudget111111111111111111111111111111"),
    new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"),
    new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
    PUMP_PROGRAM_ID,
    new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
    new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
  ];
  const accounts = await conn.getMultipleAccountsInfo(ids);
  return accounts.map((a, i) => ({
    program: ids[i].toBase58(),
    executable: a?.executable ?? null,
    loader: a?.owner.toBase58() ?? null,
  }));
});
await check("pumpGlobal", async () => {
  const key = PublicKey.findProgramAddressSync(
      [Buffer.from("global")],
      PUMP_PROGRAM_ID,
    )[0],
    a = await conn.getAccountInfo(key);
  assert.ok(a, "Pump global account missing");
  assert.ok(a.owner.equals(PUMP_PROGRAM_ID));
  const global = PUMP_SDK.decodeGlobal(a);
  return {
    address: key.toBase58(),
    owner: a.owner.toBase58(),
    initialized: global.initialized,
    createV2Enabled: global.createV2Enabled,
  };
});
// These keys are fresh, unfunded, held only in memory, and never signed or exported.
const payer = Keypair.generate(),
  mint = Keypair.generate();
await check("unsignedMainnetPreflight", async () => {
  const descriptions = [
    {
      name: "transfer",
      ix: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: mint.publicKey,
          lamports: 1,
        }),
      ],
    },
    {
      name: "pumpCreateV2",
      ix: await launchInstructions(
        {
          name: "VEXUM preflight",
          symbol: "VEXTEST",
          description: "Unsigned security check",
          image:
            "ipfs://bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku",
        },
        "https://example.com/verification.json",
        payer.publicKey,
        mint.publicKey,
      ),
    },
    {
      name: "coreCreateV1",
      ix: await nftInstructions(
        "VEXUM preflight",
        "https://example.com/verification.json",
        payer.publicKey,
        mint.publicKey,
      ),
    },
  ];
  const results = [];
  for (const d of descriptions) {
    const { transaction } = await makeTransaction(d.ix, payer.publicKey, conn);
    await verifyTransactionPrograms(transaction, conn);
    const fee = (await conn.getFeeForMessage(transaction.message)).value;
    const simulated = await conn.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
    });
    assert.ok(transaction.signatures.every((s) => s.every((b) => b === 0)));
    results.push({
      operation: d.name,
      networkFeeLamports: fee,
      simulationError: simulated.value.err,
      unitsConsumed: simulated.value.unitsConsumed ?? null,
      interpretation: simulated.value.err
        ? "Unfunded preflight rejected; does not verify funded protocol execution"
        : "Unsigned simulation only; never broadcast",
    });
  }
  return results;
});
const controller = new AbortController(),
  timer = setTimeout(() => controller.abort(), 8000);
await check("pumpWebSocket", async () => {
  const events: unknown[] = [];
  const errors: string[] = [];
  await monitorCreations(
    {
      signal: controller.signal,
      onEvent: async (e) => {
        events.push(e);
        controller.abort();
      },
      onError: (e) => errors.push(e),
    },
    conn,
  );
  return {
    events,
    errors,
    stopped: true,
    interpretation: events.length
      ? "Real confirmed Pump creation event observed; VEXUM did not create it"
      : "Session stopped without matching creation events",
  };
});
clearTimeout(timer);
await check("mainnetWallet", () =>
  walletInfo(PUMP_PROGRAM_ID.toBase58(), new Rpc(), 2),
);
await check("mainnetUsdcToken", () => tokenInfo(usdc));
await check("jupiterQuote", () =>
  swapQuote(SOL_MINT, usdc, "1000000", defaultLimits),
);
await check("jupiterBuild", async () => {
  const build = await swapBuild(
    SOL_MINT,
    usdc,
    "1000000",
    payer.publicKey.toBase58(),
    defaultLimits,
  );
  const transaction = await swapTransaction(build, payer.publicKey, conn);
  await verifyTransactionPrograms(transaction, conn);
  const fee = (await conn.getFeeForMessage(transaction.message)).value;
  const simulation = await conn.simulateTransaction(transaction, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
  });
  assert.ok(transaction.signatures.every((s) => s.every((b) => b === 0)));
  return {
    build,
    networkFeeLamports: fee,
    simulationError: simulation.value.err,
    unitsConsumed: simulation.value.unitsConsumed ?? null,
    interpretation: simulation.value.err
      ? "Actual provider build validated; unfunded simulation does not verify a funded swap"
      : "Actual unsigned mainnet simulation only; no signing/submission",
  };
});
evidence.credentials = {
  jupiter: Boolean(config().jupiterKey),
  pinata: Boolean(config().pinataJwt),
  helius: Boolean(config().heliusKey),
  solscan: Boolean(config().solscanKey),
  dedicatedRpc: Boolean(process.env.VEXUM_SOLANA_RPC_URL),
};
evidence.rpcMethods = [...new Set(calls)];
evidence.broadcasts = 0;
printResult(evidence);
