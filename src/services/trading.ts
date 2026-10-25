import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
  Connection,
  SystemInstruction,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { PUMP_SDK, PUMP_PROGRAM_ID, pumpIdl } from "../core/pump.js";
import { z } from "zod";
import {
  validateRouteBytes,
  routeAccountIndices,
  validateV2Accounts,
  minimumOutputAmount,
} from "../protocols/jupiter.js";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { config, SOL_MINT, TOKEN_PROGRAMS, redact } from "../core/config.js";
import { jsonRequest, HttpError, type Fetcher } from "../core/network.js";
import { address } from "./wallet.js";
import {
  connection,
  assertNetwork,
  executeTransaction,
  type ExecuteOptions,
} from "./transactions.js";
import { atomicJson, claimLock } from "../core/state.js";
import {
  getAssociatedTokenAddressSync,
  unpackAccount,
  unpackMint,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { dexPairs } from "./intelligence.js";

export const tradeLimits = z.object({
  maxPositionLamports: z.number().int().positive().safe().max(10_000_000_000),
  maxSpendLamports: z.number().int().positive().safe().max(100_000_000_000),
  slippageBps: z.number().int().min(1).max(500),
  maxRentLamports: z
    .number()
    .int()
    .nonnegative()
    .safe()
    .max(10000000)
    .default(3000000),
  maxFeeLamports: z.number().int().positive().safe().max(10_000_000),
  maxPriceImpactPct: z.number().min(0).max(10),
});
export const defaultLimits = {
  maxPositionLamports: 10_000_000,
  maxSpendLamports: 50_000_000,
  slippageBps: 100,
  maxRentLamports: 3_000_000,
  maxFeeLamports: 100_000,
  maxPriceImpactPct: 3,
};
export type Limits = z.infer<typeof tradeLimits>;
const atomicAmount = z
  .string()
  .regex(/^(0|[1-9]\d*)$/)
  .refine((v) => BigInt(v) <= 18446744073709551615n, "Amount exceeds u64");
const instruction = z.object({
  programId: z.string(),
  accounts: z.array(
    z.object({
      pubkey: z.string(),
      isSigner: z.boolean(),
      isWritable: z.boolean(),
    }),
  ),
  data: z.string(),
});
export const buildSchema = z
  .object({
    inputMint: z.string(),
    outputMint: z.string(),
    inAmount: atomicAmount,
    outAmount: atomicAmount.refine((v) => BigInt(v) > 0n),
    otherAmountThreshold: atomicAmount,
    slippageBps: z.number().int(),
    swapMode: z.literal("ExactIn"),
    priceImpactPct: z.string(),
    computeBudgetInstructions: z.array(instruction),
    setupInstructions: z.array(instruction),
    swapInstruction: instruction,
    cleanupInstruction: instruction.nullable().optional(),
    tipInstruction: instruction.nullable().optional(),
    transactionVersion: z.literal(0).optional(),
    otherInstructions: z.array(instruction).optional(),
    addressLookupTableAddresses: z.array(z.string()).optional(),
    addressesByLookupTableAddress: z
      .record(z.string(), z.array(z.string()))
      .nullable()
      .optional(),
    lastValidBlockHeight: z.number().optional(),
  })
  .passthrough();
export type SwapBuild = z.infer<typeof buildSchema>;
export async function swapBuild(
  inputMint: string,
  outputMint: string,
  amount: string,
  payer: string,
  limits: Limits,
  fetcher: Fetcher = fetch,
): Promise<SwapBuild> {
  tradeLimits.parse(limits);
  [inputMint, outputMint, payer].forEach(address);
  if (!/^[1-9]\d*$/.test(amount))
    throw new Error("Trade amount must be positive atomic units");
  if (inputMint === outputMint)
    throw new Error("Input and output mints must differ");
  if (
    inputMint === SOL_MINT &&
    BigInt(amount) > BigInt(limits.maxPositionLamports)
  )
    throw new Error("Buy exceeds maximum position size");
  const url = new URL("https://api.jup.ag/swap/v2/build");
  Object.entries({
    inputMint,
    outputMint,
    amount,
    taker: payer,
    slippageBps: String(limits.slippageBps),
    transactionVersion: "0",
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const build = buildSchema.parse(await jupiterRead(url, fetcher));
  validateSwap(build, inputMint, outputMint, amount, limits);
  return build;
}
async function jupiterRead(url: URL, fetcher: Fetcher) {
  const key = config().jupiterKey;
  try {
    return await jsonRequest(
      url.toString(),
      { headers: key ? { "x-api-key": key } : {} },
      fetcher,
    );
  } catch (error) {
    if (error instanceof HttpError && [401, 403].includes(error.status) && !key)
      throw new Error(
        "Missing configuration: JUPITER_API_KEY required by Jupiter provider",
      );
    throw error;
  }
}
// /order without a taker is the official read-only quote path. It is never submitted.
export async function swapQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  limits: Limits,
  fetcher: Fetcher = fetch,
) {
  tradeLimits.parse(limits);
  [inputMint, outputMint].forEach(address);
  atomicAmount.refine((v) => BigInt(v) > 0n).parse(amount);
  if (inputMint === outputMint)
    throw new Error("Input and output mints must differ");
  const url = new URL("https://api.jup.ag/swap/v2/order");
  Object.entries({
    inputMint,
    outputMint,
    amount,
    swapMode: "ExactIn",
    slippageBps: String(limits.slippageBps),
  }).forEach(([k, v]) => url.searchParams.set(k, v));
  const quote = z
    .object({
      inputMint: z.string(),
      outputMint: z.string(),
      inAmount: atomicAmount,
      outAmount: atomicAmount.refine((v) => BigInt(v) > 0n),
      otherAmountThreshold: atomicAmount,
      swapMode: z.literal("ExactIn"),
      slippageBps: z.number().int(),
      priceImpact: z.number().finite().optional(),
      priceImpactPct: z.string().optional(),
      router: z.string().optional(),
      feeBps: z.number().nonnegative().optional(),
      signatureFeeLamports: z.number().int().nonnegative().safe().optional(),
      prioritizationFeeLamports: z
        .number()
        .int()
        .nonnegative()
        .safe()
        .optional(),
      rentFeeLamports: z.number().int().nonnegative().safe().optional(),
    })
    .parse(await jupiterRead(url, fetcher));
  const impact =
    quote.priceImpact !== undefined
      ? Math.abs(quote.priceImpact)
      : Math.abs(Number(quote.priceImpactPct)) * 100;
  if (
    quote.inputMint !== inputMint ||
    quote.outputMint !== outputMint ||
    quote.inAmount !== amount ||
    quote.slippageBps < 1 ||
    quote.slippageBps > limits.slippageBps ||
    !Number.isFinite(impact) ||
    impact > limits.maxPriceImpactPct ||
    BigInt(quote.otherAmountThreshold) <
      (BigInt(quote.outAmount) * BigInt(10000 - quote.slippageBps)) / 10000n ||
    BigInt(quote.otherAmountThreshold) > BigInt(quote.outAmount)
  )
    throw new Error("Jupiter quote violates requested amounts or risk limits");
  return {
    ...quote,
    source: "Jupiter Swap V2 /order",
    observedAt: new Date().toISOString(),
    execution:
      "Quote only; live trades rebuild through /build and exact approval",
  };
}
export function validateSwap(
  build: SwapBuild,
  inputMint: string,
  outputMint: string,
  amount: string,
  limits: Limits,
) {
  if (
    build.inputMint !== inputMint ||
    build.outputMint !== outputMint ||
    build.inAmount !== amount ||
    build.slippageBps > limits.slippageBps ||
    build.slippageBps < 1
  )
    throw new Error("Swap response does not match requested trade");
  const impact = Math.abs(Number(build.priceImpactPct)) * 100;
  if (!Number.isFinite(impact) || impact > limits.maxPriceImpactPct)
    throw new Error("Price impact exceeds configured cap");
  const minimum = BigInt(minimumOutputAmount(build));
  if (
    BigInt(build.otherAmountThreshold) <= 0n ||
    BigInt(build.otherAmountThreshold) < minimum ||
    BigInt(build.otherAmountThreshold) > minimum + 1n
  )
    throw new Error("Swap minimum output violates slippage cap");
}
function decodeInstruction(value: z.infer<typeof instruction>) {
  const encoded = Buffer.from(value.data, "base64");
  if (encoded.toString("base64") !== value.data)
    throw new Error("Invalid instruction encoding");
  return new TransactionInstruction({
    programId: new PublicKey(address(value.programId)),
    keys: value.accounts.map((k) => ({
      pubkey: new PublicKey(address(k.pubkey)),
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    data: encoded,
  });
}
// Jupiter Router returns instructions, allowing inspection before any signature is produced.
export async function swapTransaction(
  build: SwapBuild,
  payer: PublicKey,
  conn = connection(),
) {
  const values = [
    ...build.computeBudgetInstructions,
    ...build.setupInstructions,
    ...(build.otherInstructions ?? []),
    build.swapInstruction,
    ...(build.cleanupInstruction ? [build.cleanupInstruction] : []),
  ];
  const instructions = values.map(decodeInstruction);
  // /build supplies a CU price but no CU limit. Use the documented maximum;
  // shared-gate fee review prices this conservative reservation before signing.
  if (
    !build.computeBudgetInstructions.some(
      (item) => decodeInstruction(item).data[0] === 2,
    )
  )
    instructions.unshift(
      ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }),
    );
  validateSetup(build, payer);
  const setupTokens = associatedSetup(build);
  if (setupTokens.length > 16) throw new Error("Too many swap setup accounts");
  if (setupTokens.length) {
    const infos = await conn.getMultipleAccountsInfo(
      setupTokens.map((a) => a.mint),
      "confirmed",
    );
    for (let i = 0; i < setupTokens.length; i++) {
      const a = infos[i],
        expected = setupTokens[i];
      if (
        !a ||
        !a.owner.equals(expected.program) ||
        !unpackMint(expected.mint, a, expected.program).isInitialized
      )
        throw new Error("Swap setup mint owner or state mismatch");
    }
  }

  const routeName = validateRouteBytes(
    decodeInstruction(build.swapInstruction).data,
    build,
  );
  const roles = routeAccountIndices(routeName),
    keys = build.swapInstruction.accounts;
  if (
    keys[roles.authority]?.pubkey !== payer.toBase58() ||
    keys[roles.outputMint]?.pubkey !== build.outputMint ||
    ("inputMint" in roles && keys[roles.inputMint!]?.pubkey !== build.inputMint)
  )
    throw new Error(
      "Jupiter instruction account roles do not match requested trade",
    );
  validateV2Accounts(
    routeName,
    keys,
    payer.toBase58(),
    build.inputMint,
    build.outputMint,
  );
  const allowed = new Set([
    "ComputeBudget111111111111111111111111111111",
    "11111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
  ]);
  if (
    build.swapInstruction.programId !==
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
  )
    throw new Error("Unexpected Jupiter swap program");
  for (const ix of instructions) {
    if (
      !allowed.has(ix.programId.toBase58()) ||
      ix.keys.some((k) => k.isSigner && !k.pubkey.equals(payer))
    )
      throw new Error("Unsupported program or unexpected signer in swap");
  }
  const addresses =
    build.addressLookupTableAddresses ??
    Object.keys(build.addressesByLookupTableAddress ?? {});
  if (addresses.length > 8 || new Set(addresses).size !== addresses.length)
    throw new Error("Invalid lookup table list");
  const tables: AddressLookupTableAccount[] = [];
  for (const table of addresses) {
    const fetched = (
      await conn.getAddressLookupTable(new PublicKey(address(table)))
    ).value;
    if (!fetched || fetched.state.deactivationSlot !== 18446744073709551615n)
      throw new Error("Lookup table missing or deactivated");
    const claimed = build.addressesByLookupTableAddress?.[table];
    if (
      claimed &&
      (claimed.length !== fetched.state.addresses.length ||
        claimed.some((a, i) => a !== fetched.state.addresses[i].toBase58()))
    )
      throw new Error("Lookup table response does not match on-chain table");
    tables.push(fetched);
  }
  const latest = await conn.getLatestBlockhash("confirmed");
  return new VersionedTransaction(
    new TransactionMessage({
      payerKey: payer,
      recentBlockhash: latest.blockhash,
      instructions,
    }).compileToV0Message(tables),
  );
}
export const positionSchema = z.object({
  id: z.string(),
  mode: z.literal("live"),
  mint: z.string(),
  owner: z.string(),
  status: z.enum(["open", "closed", "pending", "uncertain", "failed"]),
  quantity: z.string(),
  decimals: z.number().int().min(0).max(255),
  costLamports: z.number().int().nonnegative().safe(),
  feeSpentLamports: z.number().int().nonnegative().safe().optional(),
  observedAt: z.string(),
  signature: z.string().optional(),
  pendingSide: z.enum(["buy", "sell"]).optional(),
  proceedsLamports: z.number().optional(),
});
export type Position = z.infer<typeof positionSchema>;
export function assertWalletSettled(positions: Position[], owner: string) {
  if (
    positions.some(
      (p) =>
        p.mode === "live" &&
        p.owner === owner &&
        ["pending", "uncertain"].includes(p.status),
    )
  )
    throw new Error("Reconcile pending/uncertain position before trading");
}

export const executionHistoryPath = () =>
  join(config().home, "mainnet-executions.json");
export async function positionsFile(path = executionHistoryPath()) {
  try {
    return z
      .array(positionSchema)
      .parse(JSON.parse(await readFile(path, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
export async function withPositions<T>(
  action: (positions: Position[]) => Promise<T>,
  path = executionHistoryPath(),
) {
  // Exclusive lock prevents parallel CLI processes exceeding the same position/spend budget.
  await claimLock(path + ".lock");
  try {
    const positions = await positionsFile(path);
    const result = await action(positions);
    await atomicJson(path, positions);
    return result;
  } finally {
    const { unlink } = await import("node:fs/promises");
    await unlink(path + ".lock");
  }
}
export async function executeSwap(
  build: SwapBuild,
  wallet: Keypair,
  options: ExecuteOptions,
  conn = connection(),
) {
  if (config().cluster !== "mainnet-beta")
    throw new Error(
      "Jupiter routes require mainnet; no devnet liquidity is implied",
    );
  if (build.inputMint !== SOL_MINT && build.outputMint !== SOL_MINT)
    throw new Error("Guarded execution supports SOL/token buy or sell routes");
  const tx = await swapTransaction(build, wallet.publicKey, conn);
  return executeTransaction(
    tx,
    [wallet],
    {
      ...options,
      details: {
        operation: "Jupiter swap",
        inputMint: build.inputMint,
        outputMint: build.outputMint,
        inputAtomic: build.inAmount,
        minimumOutputAtomic: minimumOutputAmount(build),
        providerMinimumOutputAtomic: build.otherAmountThreshold,
        slippageBps: build.slippageBps,
      },
      inspect: async (tx, conn) => {
        await inspectSwapEffects(
          build,
          tx,
          wallet.publicKey,
          conn,
          options.maxRentLamports,
        );
        await options.inspect?.(tx, conn);
      },
    },
    conn,
  );
}
export function creationEvents(logs: string[]) {
  // Validate the emitting program stack: another program cannot spoof Pump's event bytes.
  const stack: string[] = [];
  const events: Array<{
    mint: string;
    name: string;
    symbol: string;
    creator: string;
    timestamp: string;
  }> = [];
  for (const line of logs) {
    const invoke = line.match(/^Program (\w+) invoke \[\d+\]$/);
    if (invoke) {
      stack.push(invoke[1]);
      continue;
    }
    if (/^Program \w+ (success|failed:)/.test(line)) {
      stack.pop();
      continue;
    }
    if (
      stack.at(-1) !== PUMP_PROGRAM_ID.toBase58() ||
      !line.startsWith("Program data: ")
    )
      continue;
    try {
      const bytes = Buffer.from(line.slice(14), "base64");
      const discriminator = Buffer.from(
        pumpIdl.events.find((e) => e.name === "CreateEvent")!.discriminator,
      );
      if (!bytes.subarray(0, 8).equals(discriminator)) continue;
      const event = PUMP_SDK.decodeCreateEventBc(bytes.subarray(8));
      events.push({
        mint: event.mint.toBase58(),
        name: event.name,
        symbol: event.symbol,
        creator: event.creator.toBase58(),
        timestamp: event.timestamp.toString(),
      });
    } catch {
      /* Other Pump event type. */
    }
  }
  return events;
}
export async function monitorCreations(
  options: {
    target?: string;
    signal: AbortSignal;
    onEvent: (
      event: ReturnType<typeof creationEvents>[number],
    ) => Promise<void>;
    onError?: (error: string) => void;
  },
  conn: Connection = connection(),
) {
  await assertNetwork(conn);
  const seen = new Set<string>();
  let pending = Promise.resolve();
  let queued = 0;
  const id = conn.onLogs(
    PUMP_PROGRAM_ID,
    (event) => {
      if (event.err || seen.has(event.signature)) return;
      seen.add(event.signature);
      if (seen.size > 10000) seen.delete(seen.values().next().value!);
      for (const created of creationEvents(event.logs)) {
        if (
          options.target &&
          created.mint !== options.target &&
          created.symbol.toLowerCase() !== options.target.toLowerCase()
        )
          continue;
        if (queued >= 100) {
          options.onError?.("Creation event backlog full; event dropped");
          continue;
        }
        queued++;
        pending = pending
          .then(() =>
            options.signal.aborted ? undefined : options.onEvent(created),
          )
          .catch((error) => options.onError?.(redact(error)))
          .finally(() => {
            queued--;
          });
      }
    },
    "confirmed",
  );
  try {
    if (!options.signal.aborted)
      await new Promise<void>((resolve) =>
        options.signal.addEventListener("abort", () => resolve(), {
          once: true,
        }),
      );
  } finally {
    await conn.removeOnLogsListener(id);
    await pending;
  }
}
export async function pollMarket(
  mint: string,
  signal: AbortSignal,
  onObservation: (pairs: Awaited<ReturnType<typeof dexPairs>>) => Promise<void>,
  intervalMs = 5000,
) {
  address(mint);
  if (intervalMs < 2000)
    throw new Error("Polling interval must be at least 2 seconds");
  while (!signal.aborted) {
    await onObservation(await dexPairs(mint));
    try {
      await delay(intervalMs, undefined, { signal });
    } catch {
      if (!signal.aborted) throw new Error("Polling interrupted");
    }
  }
}

export function validateSetup(build: SwapBuild, payer: PublicKey) {
  const wrapped = getAssociatedTokenAddressSync(new PublicKey(SOL_MINT), payer);
  if (build.tipInstruction)
    throw new Error(
      "Jupiter tip instructions are unsupported; no spending authorized",
    );
  if (build.otherInstructions?.length)
    throw new Error("Additional swap instructions are unsupported");
  for (const item of build.computeBudgetInstructions) {
    const ix = decodeInstruction(item);
    if (
      ix.programId.toBase58() !==
        "ComputeBudget111111111111111111111111111111" ||
      !(
        (ix.data[0] === 2 && ix.data.length === 5) ||
        (ix.data[0] === 3 && ix.data.length === 9)
      )
    )
      throw new Error("Unsupported compute budget instruction");
  }
  for (const item of build.setupInstructions) {
    const ix = decodeInstruction(item),
      program = ix.programId.toBase58();
    if (ix.programId.equals(SystemProgram.programId)) {
      if (SystemInstruction.decodeInstructionType(ix) !== "Transfer")
        throw new Error("Unsupported system instruction");
      const transfer = SystemInstruction.decodeTransfer(ix);
      if (
        !transfer.fromPubkey.equals(payer) ||
        !transfer.toPubkey.equals(wrapped) ||
        build.inputMint !== SOL_MINT ||
        transfer.lamports > BigInt(build.inAmount)
      )
        throw new Error("Unexpected swap funding transfer");
    } else if (ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) {
      const keys = ix.keys;
      if (
        ![0, 1].includes(ix.data[0] ?? 0) ||
        ix.data.length > 1 ||
        keys.length !== 6 ||
        !keys[0].pubkey.equals(payer) ||
        !keys[2].pubkey.equals(payer) ||
        !TOKEN_PROGRAMS.includes(keys[5].pubkey.toBase58()) ||
        !keys[4].pubkey.equals(SystemProgram.programId) ||
        !getAssociatedTokenAddressSync(
          keys[3].pubkey,
          payer,
          false,
          keys[5].pubkey,
        ).equals(keys[1].pubkey)
      )
        throw new Error("Unexpected associated token setup");
    } else if (TOKEN_PROGRAMS.includes(program)) {
      if (
        ix.data.length !== 1 ||
        ix.data[0] !== 17 ||
        ix.keys.length !== 1 ||
        !ix.keys[0].pubkey.equals(wrapped)
      )
        throw new Error(
          "Unsupported token setup instruction; approvals and transfers are forbidden",
        );
    } else throw new Error("Unsupported swap setup program");
  }
  if (build.cleanupInstruction) {
    const ix = decodeInstruction(build.cleanupInstruction);
    if (
      !ix.programId.equals(TOKEN_PROGRAM_ID) ||
      ix.data.length !== 1 ||
      ix.data[0] !== 9 ||
      ix.keys.length !== 3 ||
      !ix.keys[0].pubkey.equals(wrapped) ||
      !ix.keys[1].pubkey.equals(payer) ||
      !ix.keys[2].pubkey.equals(payer)
    )
      throw new Error("Unsupported swap cleanup instruction");
  }
}
function associatedSetup(build: SwapBuild) {
  return build.setupInstructions
    .filter((i) => i.programId === ASSOCIATED_TOKEN_PROGRAM_ID.toBase58())
    .map((i) => ({
      account: new PublicKey(i.accounts[1].pubkey),
      mint: new PublicKey(i.accounts[3].pubkey),
      program: new PublicKey(i.accounts[5].pubkey),
    }));
}
export async function inspectSwapEffects(
  build: SwapBuild,
  tx: VersionedTransaction,
  payer: PublicKey,
  conn = connection(),
  maxRentLamports = 3_000_000,
) {
  const mint =
    build.inputMint === SOL_MINT ? build.outputMint : build.inputMint;
  const mintInfo = await conn.getAccountInfo(new PublicKey(mint), "confirmed");
  if (!mintInfo || !TOKEN_PROGRAMS.includes(mintInfo.owner.toBase58()))
    throw new Error("Swap mint has unsupported token owner");
  const routeName = validateRouteBytes(
    decodeInstruction(build.swapInstruction).data,
    build,
  );
  const roles = routeAccountIndices(routeName);
  if (
    "inputProgram" in roles &&
    roles.inputProgram !== undefined &&
    roles.outputProgram !== undefined &&
    (build.swapInstruction.accounts[roles.inputProgram]?.pubkey !==
      (build.inputMint === SOL_MINT
        ? TOKEN_PROGRAM_ID
        : mintInfo.owner
      ).toBase58() ||
      build.swapInstruction.accounts[roles.outputProgram]?.pubkey !==
        (build.outputMint === SOL_MINT
          ? TOKEN_PROGRAM_ID
          : mintInfo.owner
        ).toBase58())
  )
    throw new Error("Jupiter mint/token program mismatch");
  const inputAta = getAssociatedTokenAddressSync(
    new PublicKey(build.inputMint),
    payer,
    false,
    build.inputMint === SOL_MINT ? TOKEN_PROGRAM_ID : mintInfo.owner,
  );
  const quotedDestination = getAssociatedTokenAddressSync(
    new PublicKey(build.outputMint),
    payer,
    false,
    build.outputMint === SOL_MINT ? TOKEN_PROGRAM_ID : mintInfo.owner,
  );
  if (
    build.swapInstruction.accounts[roles.source]?.pubkey !==
      inputAta.toBase58() ||
    build.swapInstruction.accounts[roles.destination]?.pubkey !==
      quotedDestination.toBase58()
  )
    throw new Error(
      "Jupiter source/destination must be the signing wallet associated accounts",
    );
  const outputAta = getAssociatedTokenAddressSync(
    new PublicKey(build.outputMint),
    payer,
    false,
    build.outputMint === SOL_MINT ? TOKEN_PROGRAM_ID : mintInfo.owner,
  );
  const setup = associatedSetup(build);
  const existing = (
    await Promise.all(
      TOKEN_PROGRAMS.map((programId) =>
        conn.getTokenAccountsByOwner(
          payer,
          { programId: new PublicKey(programId) },
          "confirmed",
        ),
      ),
    )
  ).flatMap((r) => r.value);
  const keys = [
    ...new Map([
      ...existing.map((a) => [a.pubkey.toBase58(), a.pubkey] as const),
      [outputAta.toBase58(), outputAta] as const,
      ...setup.map((a) => [a.account.toBase58(), a.account] as const),
    ]).values(),
  ];
  if (keys.length > 95)
    throw new Error(
      "Wallet has too many token accounts for complete guarded simulation (max 95)",
    );
  const accounts = await conn.getMultipleAccountsInfo(
    [payer, ...keys],
    "confirmed",
  );
  const simulation = await conn.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: {
      encoding: "base64",
      addresses: [payer, ...keys].map((k) => k.toBase58()),
    },
  });
  if (
    simulation.value.err ||
    !simulation.value.accounts ||
    simulation.value.accounts.length !== keys.length + 1
  )
    throw new Error("Cannot verify simulated swap asset effects");
  const oldSol = accounts[0]?.lamports,
    newSol = simulation.value.accounts[0]?.lamports;
  if (oldSol === undefined || newSol === undefined)
    throw new Error("Missing simulated SOL state");
  const changes = new Map<string, bigint>();
  let rentDelta = 0n;
  for (let i = 0; i < keys.length; i++) {
    const before = accounts[i + 1],
      after = simulation.value.accounts[i + 1];
    let beforeAmount = 0n,
      afterAmount = 0n,
      tokenMint: string;
    rentDelta += BigInt(after?.lamports ?? 0) - BigInt(before?.lamports ?? 0);
    if (before) {
      const parsed = unpackAccount(keys[i], before, before.owner);
      if (!parsed.owner.equals(payer))
        throw new Error("Unexpected token account owner");
      beforeAmount = parsed.amount;
      tokenMint = parsed.mint.toBase58();
      if (!after) {
        if (tokenMint !== SOL_MINT || beforeAmount !== 0n)
          throw new Error("Swap closes an existing nonempty token account");
      } else {
        const raw = Buffer.from(after.data[0], "base64"),
          original = Buffer.from(before.data);
        if (
          after.owner !== before.owner.toBase58() ||
          raw.length !== original.length
        )
          throw new Error("Token ownership or extension state changed");
        // Amount is the only permitted token data change. Delegate, close authority, mint and extensions remain identical.
        raw.fill(0, 64, 72);
        original.fill(0, 64, 72);
        if (!raw.equals(original))
          throw new Error(
            "Swap changes token authority, delegate or extension state",
          );
        afterAmount = unpackAccount(
          keys[i],
          { ...before, data: Buffer.from(after.data[0], "base64") },
          before.owner,
        ).amount;
      }
    } else {
      if (!after) continue;
      const expectedSetup = setup.find((a) => a.account.equals(keys[i]));
      if (
        (!keys[i].equals(outputAta) && !expectedSetup) ||
        !TOKEN_PROGRAMS.includes(after.owner) ||
        (expectedSetup && after.owner !== expectedSetup.program.toBase58())
      )
        throw new Error("Unexpected new token account");
      const created = unpackAccount(
        keys[i],
        {
          owner: new PublicKey(after.owner),
          data: Buffer.from(after.data[0], "base64"),
          lamports: after.lamports,
          executable: false,
          rentEpoch: 0,
        },
        new PublicKey(after.owner),
      );
      if (
        !created.owner.equals(payer) ||
        created.delegate ||
        created.closeAuthority ||
        created.mint.toBase58() !==
          (expectedSetup?.mint.toBase58() ?? build.outputMint)
      )
        throw new Error("Unexpected new token account authority");
      tokenMint = created.mint.toBase58();
      afterAmount = created.amount;
    }
    changes.set(
      tokenMint,
      (changes.get(tokenMint) ?? 0n) + afterAmount - beforeAmount,
    );
  }
  for (const [token, change] of changes)
    if (
      token !== build.inputMint &&
      token !== build.outputMint &&
      change !== 0n
    )
      throw new Error("Swap changes an unrelated token balance");
  if (rentDelta > BigInt(maxRentLamports))
    throw new Error("Swap account rent exceeds cap");
  if (build.inputMint === SOL_MINT) {
    if ((changes.get(SOL_MINT) ?? 0n) !== 0n)
      throw new Error("Swap consumes or retains existing wrapped SOL");
    const fee = (await conn.getFeeForMessage(tx.message, "confirmed")).value;
    if (fee === null) throw new Error("Swap fee unavailable");
    const input = BigInt(oldSol - newSol) - rentDelta;
    if (
      input < BigInt(build.inAmount) ||
      input > BigInt(build.inAmount) + BigInt(fee)
    )
      throw new Error("Simulated SOL input does not match quote");
  } else if ((changes.get(build.inputMint) ?? 0n) !== -BigInt(build.inAmount))
    throw new Error("Simulated token input does not match quote");
  if (build.outputMint === SOL_MINT) {
    if (
      BigInt(newSol - oldSol) + rentDelta <
      BigInt(minimumOutputAmount(build)) -
        BigInt(
          (await conn.getFeeForMessage(tx.message, "confirmed")).value ?? 0,
        )
    )
      throw new Error("Simulated SOL output is below minimum");
  } else if (
    (changes.get(build.outputMint) ?? 0n) < BigInt(minimumOutputAmount(build))
  )
    throw new Error("Simulated token output is below minimum");
}
export async function reconcilePosition(
  position: Position,
  conn = connection(),
): Promise<Position> {
  if (
    !["pending", "uncertain"].includes(position.status) ||
    !position.signature ||
    !position.pendingSide ||
    !position.owner
  )
    throw new Error("Position has no verifiable pending transaction");
  const tx = await conn.getTransaction(position.signature, {
    commitment: "finalized",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta)
    throw new Error(
      "Finalized transaction unavailable; outcome remains uncertain. No retry is permitted",
    );
  if (tx.transaction.message.staticAccountKeys[0].toBase58() !== position.owner)
    throw new Error("Transaction payer does not match position owner");
  if (tx.meta.err)
    return {
      ...position,
      status: position.pendingSide === "buy" ? "failed" : "open",
      feeSpentLamports:
        (position.feeSpentLamports ?? 0) +
        (position.pendingSide === "sell" ? tx.meta.fee : 0),
      pendingSide: undefined,
      costLamports:
        position.pendingSide === "buy" ? tx.meta.fee : position.costLamports,
    };
  const balance = (list: typeof tx.meta.preTokenBalances) =>
    (list ?? [])
      .filter((t) => t.owner === position.owner && t.mint === position.mint)
      .reduce((s, t) => s + BigInt(t.uiTokenAmount.amount), 0n);
  const change =
    balance(tx.meta.postTokenBalances) - balance(tx.meta.preTokenBalances);
  if (position.pendingSide === "buy") {
    if (change <= 0n)
      throw new Error("Confirmed transaction has no received position tokens");
    return {
      ...position,
      status: "open",
      pendingSide: undefined,
      quantity: change.toString(),
      costLamports: Math.max(
        0,
        tx.meta.preBalances[0] - tx.meta.postBalances[0],
      ),
    };
  }
  if (change !== -BigInt(position.quantity))
    throw new Error("Confirmed sell amount does not match position");
  const proceeds = tx.meta.postBalances[0] - tx.meta.preBalances[0];
  return {
    ...position,
    status: "closed",
    feeSpentLamports: (position.feeSpentLamports ?? 0) + tx.meta.fee,
    pendingSide: undefined,
    proceedsLamports: proceeds,
  };
}
