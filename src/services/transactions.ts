import {
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import bs58 from "bs58";
import { config, verifyGenesis } from "../core/config.js";
import { privateFile } from "./wallet.js";
import { atomicJson } from "../core/state.js";

export function connection() {
  if (config().cluster !== "mainnet-beta")
    throw new Error("VEXUM operations require Solana Mainnet Beta");
  return new Connection(config().endpoints[0], {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 30_000,
    disableRetryOnRateLimit: true,
    fetch: async (url, init) =>
      fetch(url, { ...init, signal: AbortSignal.timeout(15_000) }),
  });
}
export async function makeTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  conn = connection(),
) {
  const latest = await conn.getLatestBlockhash("confirmed");
  return {
    transaction: new VersionedTransaction(
      new TransactionMessage({
        payerKey: payer,
        recentBlockhash: latest.blockhash,
        instructions,
      }).compileToV0Message(),
    ),
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
export type Review = {
  digest: string;
  payer: string;
  feeLamports: number;
  debitLamports: number;
  slot: number;
  unitsConsumed: number | null;
  simulation: "passed";
  reserveLamports: number;
  message: string;
  details?: Record<string, string | number>;
};
export async function reviewTransaction(
  tx: VersionedTransaction,
  payer: PublicKey,
  maxDebitLamports: number,
  maxFeeLamports: number,
  conn = connection(),
  reserveLamports = 0,
): Promise<Review> {
  if (
    !Number.isSafeInteger(maxDebitLamports) ||
    maxDebitLamports < 1 ||
    !Number.isSafeInteger(maxFeeLamports) ||
    maxFeeLamports < 1
  )
    throw new Error(
      "Transaction debit and fee caps must be positive safe integers",
    );
  if (!Number.isSafeInteger(reserveLamports) || reserveLamports < 0)
    throw new Error("Invalid minimum SOL reserve");
  if (!tx.message.staticAccountKeys[0].equals(payer))
    throw new Error("Unexpected transaction payer");
  const fee = (await conn.getFeeForMessage(tx.message, "confirmed")).value;
  if (
    fee === null ||
    !Number.isSafeInteger(fee) ||
    fee < 0 ||
    fee > maxFeeLamports
  )
    throw new Error("Network fee unavailable or exceeds configured cap");
  const balance = await conn.getBalance(payer, "confirmed");
  if (!Number.isSafeInteger(balance) || balance < 0)
    throw new Error("Invalid RPC payer balance");
  if (balance < fee)
    throw new Error("Insufficient SOL balance for transaction fee");
  const result = await conn.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    commitment: "confirmed",
    accounts: { encoding: "base64", addresses: [payer.toBase58()] },
  });
  if (result.value.err)
    throw new Error(
      `Transaction simulation failed: ${JSON.stringify(result.value.err)}`,
    );
  const after = result.value.accounts?.[0]?.lamports;
  if (typeof after !== "number" || !Number.isSafeInteger(after) || after < 0)
    throw new Error(
      "Simulation did not return payer balance; cannot enforce debit cap",
    );
  // Simulation account state excludes the transaction fee on some RPC versions. Include it conservatively.
  const debit = Math.max(0, balance - after) + fee;
  if (debit > maxDebitLamports || balance < debit)
    throw new Error(
      "Insufficient balance or simulated debit exceeds spending cap",
    );
  if (balance - debit < reserveLamports)
    throw new Error("Transaction would violate minimum SOL reserve");
  const message = Buffer.from(tx.message.serialize()).toString("base64");
  return {
    digest: createHash("sha256").update(message).digest("hex"),
    payer: payer.toBase58(),
    feeLamports: fee,
    debitLamports: debit,
    slot: result.context.slot,
    unitsConsumed: result.value.unitsConsumed ?? null,
    simulation: "passed",
    reserveLamports,
    message,
  };
}
export async function assertNetwork(conn = connection()) {
  const genesis = await conn.getGenesisHash();
  verifyGenesis(genesis);
  return genesis;
}
export type ExecuteOptions = {
  live?: boolean;
  maxDebitLamports: number;
  maxFeeLamports: number;
  maxRentLamports?: number;
  minBalanceLamports?: number;
  authorize?: (review: Review) => Promise<string>;
  journalDir?: string;
  timeoutMs?: number;
  intent?: string;
  details?: Record<string, string | number>;
  inspect?: (tx: VersionedTransaction, conn: Connection) => Promise<void>;
  onClaim?: (signature: string) => Promise<void>;
};
export class TransactionExecutionError extends Error {
  constructor(
    message: string,
    public outcome:
      | "not-submitted"
      | "uncertain"
      | "failed"
      | "already-claimed",
    public signature: string,
  ) {
    super(message);
  }
}
function messageDigest(tx: VersionedTransaction) {
  return createHash("sha256")
    .update(Buffer.from(tx.message.serialize()).toString("base64"))
    .digest("hex");
}
async function bounded<T>(operation: Promise<T>, deadline: number): Promise<T> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) throw new Error("Transaction timed out");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error("Transaction timed out")),
          remaining,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
export async function executeTransaction(
  tx: VersionedTransaction,
  signers: Keypair[],
  options: ExecuteOptions,
  conn = connection(),
) {
  if (options.live && config().cluster !== "mainnet-beta")
    throw new Error("Live signing requires Solana Mainnet Beta");
  // Capture policy and message before callbacks. Neither can expand authorization.
  const policy = { ...options },
    expected = messageDigest(tx);
  if (!signers.length)
    throw new Error("At least one signing wallet is required");
  const payer = signers[0].publicKey,
    required = tx.message.staticAccountKeys.slice(
      0,
      tx.message.header.numRequiredSignatures,
    );
  const keys = signers.map((s) => s.publicKey.toBase58());
  if (
    new Set(keys).size !== keys.length ||
    required.length !== keys.length ||
    required.some((key) => !keys.includes(key.toBase58()))
  )
    throw new Error(
      "Signing wallets do not match required transaction signers",
    );
  if (tx.signatures.some((signature) => signature.some((byte) => byte !== 0)))
    throw new Error(
      "Pre-signed transactions are not accepted by the authorization gate",
    );
  const unchanged = () => {
    if (messageDigest(tx) !== expected)
      throw new Error("Transaction changed after authorization");
  };
  const timeout = policy.timeoutMs ?? 30000;
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120000)
    throw new Error("Transaction timeout must be 1–120000 milliseconds");
  await assertNetwork(conn);
  await verifyTransactionPrograms(tx, conn);
  const review = await reviewTransaction(
    tx,
    payer,
    policy.maxDebitLamports,
    policy.maxFeeLamports,
    conn,
    policy.minBalanceLamports,
  );
  unchanged();
  await policy.inspect?.(tx, conn);
  unchanged();
  const first = Object.freeze({
    ...review,
    ...(policy.details
      ? { details: Object.freeze({ ...policy.details }) }
      : {}),
  });
  if (!policy.live) return { status: "dry-run" as const, review: first };
  if (process.env.NODE_ENV === "test" || process.env.VEXUM_NO_BROADCAST === "1")
    throw new Error("Live broadcast disabled in this environment");
  if (!policy.authorize)
    throw new Error("Explicit transaction authorization required");
  const response = await policy.authorize(first);
  unchanged();
  if (response !== `SUBMIT ${expected}`)
    throw new Error("Transaction authorization declined");
  await assertNetwork(conn);
  unchanged();
  await verifyTransactionPrograms(tx, conn);
  const final = await reviewTransaction(
    tx,
    payer,
    policy.maxDebitLamports,
    policy.maxFeeLamports,
    conn,
    policy.minBalanceLamports,
  );
  unchanged();
  if (
    final.debitLamports > first.debitLamports ||
    final.feeLamports > first.feeLamports
  )
    throw new Error("Transaction cost changed after authorization");
  await policy.inspect?.(tx, conn);
  unchanged();
  if (
    !(
      await conn.isBlockhashValid(tx.message.recentBlockhash, {
        commitment: "confirmed",
      })
    ).value
  )
    throw new Error("Transaction expired; rebuild and review again");
  unchanged();
  // Only this point may produce signatures.
  tx.sign(signers);
  unchanged();
  const signedBytes = tx.serialize();
  const signature = bs58.encode(tx.signatures[0]);
  const journal = join(
    policy.journalDir ?? join(config().home, "transactions"),
    `${createHash("sha256")
      .update(policy.intent ?? expected)
      .digest("hex")}.json`,
  );
  try {
    await privateFile(
      journal,
      JSON.stringify({
        signature,
        digest: expected,
        status: "claimed",
        blockhash: tx.message.recentBlockhash,
        createdAt: new Date().toISOString(),
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      const previous = (await readTransactionClaim(journal)) as {
        signature?: string;
      };
      throw new TransactionExecutionError(
        `Transaction intent already exists. Reconcile signature ${previous.signature ?? "unknown"} before a new attempt.`,
        "already-claimed",
        previous.signature ?? signature,
      );
    }
    throw error;
  }
  let attempted = false;
  try {
    await policy.onClaim?.(signature);
    unchanged();
    if (!Buffer.from(tx.serialize()).equals(Buffer.from(signedBytes)))
      throw new Error("Signed transaction changed before submission");
    // Authorization callbacks and durable I/O can outlast a blockhash.
    if (
      !(
        await conn.isBlockhashValid(tx.message.recentBlockhash, {
          commitment: "confirmed",
        })
      ).value
    )
      throw new Error("Transaction expired before submission");
    unchanged();
    const deadline = Date.now() + timeout;
    attempted = true;
    const returned = await bounded(
      conn.sendRawTransaction(signedBytes, {
        skipPreflight: false,
        maxRetries: 0,
        preflightCommitment: "confirmed",
      }),
      deadline,
    );
    if (returned !== signature)
      throw new Error("RPC returned a different transaction signature");
    while (Date.now() < deadline) {
      const state = (
        await bounded(
          conn.getSignatureStatuses([signature], {
            searchTransactionHistory: true,
          }),
          deadline,
        )
      ).value[0];
      if (state?.err) {
        await atomicJson(journal, {
          signature,
          status: "failed",
          digest: expected,
          error: state.err,
        });
        throw new TransactionExecutionError(
          `Transaction failed on chain. Reconcile signature ${signature}.`,
          "failed",
          signature,
        );
      }
      if (
        state?.confirmationStatus === "confirmed" ||
        state?.confirmationStatus === "finalized"
      ) {
        await atomicJson(journal, {
          signature,
          status: "confirmed",
          digest: expected,
        });
        return { status: "confirmed" as const, signature, review: final };
      }
      await delay(Math.max(0, Math.min(500, deadline - Date.now())));
    }
    throw new Error("Confirmation timed out");
  } catch (error) {
    if (
      error instanceof TransactionExecutionError &&
      error.outcome === "failed"
    )
      throw error;
    if (!attempted) {
      await atomicJson(journal, {
        signature,
        status: "not-submitted",
        digest: expected,
      }).catch(() => {});
      throw new TransactionExecutionError(
        `Transaction was not submitted. ${error instanceof Error ? error.message : "Local failure"}`,
        "not-submitted",
        signature,
      );
    }
    throw new TransactionExecutionError(
      `Transaction outcome requires reconciliation. Signature: ${signature}. Do not repeat this operation. Use transaction status ${signature}.`,
      "uncertain",
      signature,
    );
  }
}
export async function readTransactionClaim(path: string) {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

export async function verifyTransactionPrograms(
  tx: VersionedTransaction,
  conn = connection(),
) {
  const allowed = new Set([
    "11111111111111111111111111111111",
    "ComputeBudget111111111111111111111111111111",
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
    "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
    "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
    "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d",
  ]);
  const programs = [
    ...new Set(
      tx.message.compiledInstructions.map((ix) => {
        const key = tx.message.staticAccountKeys[ix.programIdIndex];
        if (!key || !allowed.has(key.toBase58()))
          throw new Error("Transaction invokes an unsupported program");
        return key.toBase58();
      }),
    ),
  ].map((v) => new PublicKey(v));
  const accounts = await conn.getMultipleAccountsInfo(programs, "confirmed");
  const loaders = new Set([
    "NativeLoader1111111111111111111111111111111",
    "BPFLoader2111111111111111111111111111111111",
    "BPFLoaderUpgradeab1e11111111111111111111111",
  ]);
  if (
    accounts.length !== programs.length ||
    accounts.some((a) => !a?.executable || !loaders.has(a.owner.toBase58()))
  )
    throw new Error(
      "Transaction program account is missing, non-executable or has an unsupported loader",
    );
}
