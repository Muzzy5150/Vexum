import test from "node:test";
import assert from "node:assert/strict";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Connection,
  VersionedTransaction,
} from "@solana/web3.js";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import bs58 from "bs58";
import {
  makeTransaction,
  executeTransaction,
} from "../src/services/transactions.js";
const payer = Keypair.generate(),
  recipient = Keypair.generate();
function fixture(overrides: Record<string, unknown> = {}) {
  let sends = 0;
  const conn = {
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 123,
    }),
    getFeeForMessage: async () => ({ value: 5000 }),
    getBalance: async () => 1_000_000,
    simulateTransaction: async () => ({
      context: { slot: 99 },
      value: {
        err: null,
        unitsConsumed: 200,
        accounts: [{ lamports: 990000 }],
      },
    }),
    getMultipleAccountsInfo: async (keys: PublicKey[]) =>
      keys.map(() => ({
        executable: true,
        owner: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      })),
    getGenesisHash: async () => "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    isBlockhashValid: async () => ({ value: true }),
    sendRawTransaction: async (bytes: Uint8Array) => {
      sends++;
      return bs58.encode(VersionedTransaction.deserialize(bytes).signatures[0]);
    },
    getSignatureStatuses: async () => ({
      value: [{ confirmationStatus: "confirmed", err: null }],
    }),
    ...overrides,
  };
  return { conn: conn as unknown as Connection, sends: () => sends };
}
async function built(conn: Connection) {
  return (
    await makeTransaction(
      [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: recipient.publicKey,
          lamports: 10000,
        }),
      ],
      payer.publicKey,
      conn,
    )
  ).transaction;
}
test("dry-run builds real unsigned instructions and simulates; never submits", async () => {
  const f = fixture(),
    tx = await built(f.conn);
  const result = await executeTransaction(
    tx,
    [payer],
    { maxDebitLamports: 20000, maxFeeLamports: 10000 },
    f.conn,
  );
  assert.equal(result.status, "dry-run");
  assert.equal(result.review.debitLamports, 15000);
  assert.equal(result.review.simulation, "passed");
  assert.equal(f.sends(), 0);
  assert.ok(tx.signatures.every((s) => s.every((b) => b === 0)));
});
test("simulation failures, insufficient funds, fee and debit caps block submission", async () => {
  for (const [change, pattern] of [
    [
      {
        simulateTransaction: async () => ({
          context: { slot: 1 },
          value: { err: { InstructionError: [0, "bad"] } },
        }),
      },
      /simulation failed/,
    ],
    [{ getBalance: async () => 1 }, /Insufficient/],
    [{ getFeeForMessage: async () => ({ value: 100000 }) }, /fee/],
    [
      {
        simulateTransaction: async () => ({
          context: { slot: 1 },
          value: { err: null, accounts: [{ lamports: 1 }] },
        }),
      },
      /spending cap/,
    ],
  ] as const) {
    const f = fixture(change);
    const tx = await built(f.conn);
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          { maxDebitLamports: 20000, maxFeeLamports: 10000 },
          f.conn,
        ),
      pattern,
    );
    assert.equal(f.sends(), 0);
  }
});
// Helpers intentionally omitted: each fixture constructs the transaction independently.
test("explicit authorization and immutable message are required for live mode", async () => {
  const f = fixture();
  const tx = await built(f.conn);
  await assert.rejects(
    () =>
      executeTransaction(
        tx,
        [payer],
        { live: true, maxDebitLamports: 20000, maxFeeLamports: 10000 },
        f.conn,
      ),
    /authorization required|disabled/,
  );
  assert.equal(f.sends(), 0);
});
test("mock transport confirms once, journal blocks a duplicate intent across rebuilt messages", async () => {
  const oldNo = process.env.VEXUM_NO_BROADCAST,
    oldEnv = process.env.NODE_ENV;
  delete process.env.VEXUM_NO_BROADCAST;
  delete process.env.NODE_ENV;
  try {
    const journalDir = await mkdtemp(join(tmpdir(), "vexum-tx-")),
      f = fixture();
    const opts = {
      live: true,
      maxDebitLamports: 20000,
      maxFeeLamports: 10000,
      journalDir,
      intent: "one-buy",
      authorize: async (r: { digest: string }) => `SUBMIT ${r.digest}`,
    };
    assert.equal(
      (await executeTransaction(await built(f.conn), [payer], opts, f.conn))
        .status,
      "confirmed",
    );
    assert.equal(f.sends(), 1);
    const second = await built(f.conn);
    await assert.rejects(
      () => executeTransaction(second, [payer], opts, f.conn),
      /exist/i,
    );
    assert.equal(f.sends(), 1);
  } finally {
    if (oldNo === undefined) delete process.env.VEXUM_NO_BROADCAST;
    else process.env.VEXUM_NO_BROADCAST = oldNo;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

test("declined authorization never claims or poisons position state; inspection runs before approval", async () => {
  const oldNo = process.env.VEXUM_NO_BROADCAST,
    oldEnv = process.env.NODE_ENV;
  delete process.env.VEXUM_NO_BROADCAST;
  delete process.env.NODE_ENV;
  try {
    const f = fixture();
    let claimed = 0,
      inspected = 0;
    const tx = await built(f.conn);
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          {
            live: true,
            maxDebitLamports: 20000,
            maxFeeLamports: 10000,
            inspect: async () => {
              inspected++;
            },
            authorize: async () => "",
            onClaim: async () => {
              claimed++;
            },
          },
          f.conn,
        ),
      /declined/,
    );
    assert.equal(claimed, 0);
    assert.equal(inspected, 1);
    assert.equal(f.sends(), 0);
  } finally {
    if (oldNo === undefined) delete process.env.VEXUM_NO_BROADCAST;
    else process.env.VEXUM_NO_BROADCAST = oldNo;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});
test("an ambiguous submission is not retried and preserves its signature for reconciliation", async () => {
  const oldNo = process.env.VEXUM_NO_BROADCAST,
    oldEnv = process.env.NODE_ENV;
  delete process.env.VEXUM_NO_BROADCAST;
  delete process.env.NODE_ENV;
  try {
    let attempts = 0,
      claimed = "";
    const f = fixture({
      sendRawTransaction: async () => {
        attempts++;
        throw new Error("network dropped after send");
      },
    });
    const tx = await built(f.conn),
      journalDir = await mkdtemp(join(tmpdir(), "vexum-uncertain-"));
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          {
            live: true,
            maxDebitLamports: 20000,
            maxFeeLamports: 10000,
            journalDir,
            authorize: async (r) => `SUBMIT ${r.digest}`,
            onClaim: async (s) => {
              claimed = s;
            },
          },
          f.conn,
        ),
      /reconciliation/,
    );
    assert.equal(attempts, 1);
    assert.equal(bs58.decode(claimed).length, 64);
  } finally {
    if (oldNo === undefined) delete process.env.VEXUM_NO_BROADCAST;
    else process.env.VEXUM_NO_BROADCAST = oldNo;
    if (oldEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldEnv;
  }
});

async function mockLive<T>(action: () => Promise<T>): Promise<T> {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    VEXUM_NO_BROADCAST: process.env.VEXUM_NO_BROADCAST,
  };
  delete process.env.NODE_ENV;
  delete process.env.VEXUM_NO_BROADCAST;
  try {
    return await action();
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}
function approval(journalDir: string) {
  return {
    live: true,
    maxDebitLamports: 20000,
    maxFeeLamports: 10000,
    journalDir,
    authorize: async (r: { digest: string }) => `SUBMIT ${r.digest}`,
  };
}
async function journal() {
  return mkdtemp(join(tmpdir(), "vexum-gate-"));
}

test("wrong exact approval never signs or submits", () =>
  mockLive(async () => {
    const f = fixture(),
      tx = await built(f.conn);
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          { ...approval("unused"), authorize: async () => "SUBMIT wrong" },
          f.conn,
        ),
      /declined/,
    );
    assert.equal(f.sends(), 0);
    assert.ok(tx.signatures[0].every((b) => b === 0));
  }));
test("mismatched network genesis never signs or submits", () =>
  mockLive(async () => {
    const f = fixture({ getGenesisHash: async () => "wrong-network" }),
      tx = await built(f.conn);
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval("unused"), f.conn),
      /genesis/,
    );
    assert.equal(f.sends(), 0);
    assert.ok(tx.signatures[0].every((b) => b === 0));
  }));
test("expired transaction never signs or submits", () =>
  mockLive(async () => {
    const f = fixture({ isBlockhashValid: async () => ({ value: false }) }),
      tx = await built(f.conn);
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval("unused"), f.conn),
      /expired/,
    );
    assert.equal(f.sends(), 0);
    assert.ok(tx.signatures[0].every((b) => b === 0));
  }));
test("mutation by final inspection is rejected before signing", () =>
  mockLive(async () => {
    const f = fixture(),
      tx = await built(f.conn);
    let inspections = 0;
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          {
            ...approval("unused"),
            inspect: async (candidate) => {
              if (++inspections === 2)
                candidate.message.recentBlockhash =
                  recipient.publicKey.toBase58();
            },
          },
          f.conn,
        ),
      /changed/,
    );
    assert.equal(f.sends(), 0);
    assert.ok(tx.signatures[0].every((b) => b === 0));
  }));
test("authorization cannot expand captured fee policy", () =>
  mockLive(async () => {
    let fees = 0;
    const f = fixture({
        getFeeForMessage: async () => ({ value: ++fees === 1 ? 5000 : 10001 }),
      }),
      tx = await built(f.conn);
    const policy = approval("unused");
    policy.authorize = async (r) => {
      policy.maxFeeLamports = 1000000;
      return `SUBMIT ${r.digest}`;
    };
    await assert.rejects(
      () => executeTransaction(tx, [payer], policy, f.conn),
      /fee/,
    );
    assert.equal(f.sends(), 0);
  }));
test("malformed negative and non-finite RPC fees fail closed", async () => {
  for (const value of [-1, NaN, Infinity]) {
    const f = fixture({ getFeeForMessage: async () => ({ value }) });
    const tx = await built(f.conn);
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          { maxDebitLamports: 20000, maxFeeLamports: 10000 },
          f.conn,
        ),
      /fee/,
    );
    assert.equal(f.sends(), 0);
  }
});
test("unknown or extra signers and pre-signed messages are rejected", async () => {
  const f = fixture(),
    tx = await built(f.conn);
  await assert.rejects(
    () =>
      executeTransaction(
        tx,
        [],
        { maxDebitLamports: 20000, maxFeeLamports: 10000 },
        f.conn,
      ),
    /signing wallet/,
  );
  await assert.rejects(
    () =>
      executeTransaction(
        tx,
        [recipient],
        { maxDebitLamports: 20000, maxFeeLamports: 10000 },
        f.conn,
      ),
    /required transaction signers/,
  );
  tx.sign([payer]);
  await assert.rejects(
    () =>
      executeTransaction(
        tx,
        [payer],
        { maxDebitLamports: 20000, maxFeeLamports: 10000 },
        f.conn,
      ),
    /Pre-signed/,
  );
  assert.equal(f.sends(), 0);
});
test("failure after claim but before send records a proven not-submitted outcome", () =>
  mockLive(async () => {
    const { TransactionExecutionError } = await import(
      "../src/services/transactions.js"
    );
    const { readdir, readFile } = await import("node:fs/promises");
    const dir = await journal(),
      f = fixture(),
      tx = await built(f.conn);
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          {
            ...approval(dir),
            onClaim: async () => {
              throw new Error("local storage failed");
            },
          },
          f.conn,
        ),
      (error: unknown) =>
        error instanceof TransactionExecutionError &&
        error.outcome === "not-submitted",
    );
    assert.equal(f.sends(), 0);
    const files = await readdir(dir);
    assert.equal(
      JSON.parse(await readFile(join(dir, files[0]), "utf8")).status,
      "not-submitted",
    );
  }));
test("expiration during durable claim work cannot broadcast", () =>
  mockLive(async () => {
    let checks = 0;
    const f = fixture({
        isBlockhashValid: async () => ({ value: ++checks === 1 }),
      }),
      tx = await built(f.conn);
    const dir = await journal();
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval(dir), f.conn),
      /not submitted/,
    );
    assert.equal(f.sends(), 0);
  }));
test("signed bytes cannot be changed by a claim callback", () =>
  mockLive(async () => {
    const f = fixture(),
      tx = await built(f.conn),
      dir = await journal();
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          {
            ...approval(dir),
            onClaim: async () => {
              tx.signatures[0][0] ^= 1;
            },
          },
          f.conn,
        ),
      /not submitted/,
    );
    assert.equal(f.sends(), 0);
  }));
test("confirmation timeout preserves uncertainty and makes only one send", () =>
  mockLive(async () => {
    const f = fixture({
        getSignatureStatuses: async () => ({ value: [null] }),
      }),
      tx = await built(f.conn),
      dir = await journal();
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          { ...approval(dir), timeoutMs: 10 },
          f.conn,
        ),
      /reconciliation/,
    );
    assert.equal(f.sends(), 1);
  }));
test("a hung submission is bounded without a duplicate retry", () =>
  mockLive(async () => {
    let sends = 0;
    const f = fixture({
        sendRawTransaction: async () => {
          sends++;
          return new Promise<string>(() => {});
        },
      }),
      tx = await built(f.conn),
      dir = await journal();
    const start = Date.now();
    await assert.rejects(
      () =>
        executeTransaction(
          tx,
          [payer],
          { ...approval(dir), timeoutMs: 10 },
          f.conn,
        ),
      /reconciliation/,
    );
    assert.equal(sends, 1);
    assert.ok(Date.now() - start < 1000);
  }));
test("a mismatched RPC signature cannot become a successful confirmation", () =>
  mockLive(async () => {
    const f = fixture({ sendRawTransaction: async () => "wrong-signature" }),
      tx = await built(f.conn),
      dir = await journal();
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval(dir), f.conn),
      /reconciliation/,
    );
  }));
test("confirmed on-chain failure is recorded and never reported successful", () =>
  mockLive(async () => {
    const { TransactionExecutionError } = await import(
      "../src/services/transactions.js"
    );
    const f = fixture({
        getSignatureStatuses: async () => ({
          value: [
            {
              err: { InstructionError: [0, "Failed"] },
              confirmationStatus: "confirmed",
            },
          ],
        }),
      }),
      tx = await built(f.conn),
      dir = await journal();
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval(dir), f.conn),
      (error: unknown) =>
        error instanceof TransactionExecutionError &&
        error.outcome === "failed",
    );
    assert.equal(f.sends(), 1);
  }));

test("localnet configuration cannot disguise a public funded network", async () => {
  const { assertNetwork } = await import("../src/services/transactions.js");
  const old = process.env.VEXUM_CLUSTER;
  process.env.VEXUM_CLUSTER = "localnet";
  try {
    await assert.rejects(() => assertNetwork(fixture().conn), /genesis hash/);
  } finally {
    if (old === undefined) delete process.env.VEXUM_CLUSTER;
    else process.env.VEXUM_CLUSTER = old;
  }
});

test("preflight verifies genesis and executable program ownership before approving simulation", async () => {
  for (const changes of [
    { getGenesisHash: async () => "wrong-chain" },
    { getMultipleAccountsInfo: async () => [null] },
    {
      getMultipleAccountsInfo: async () => [
        { executable: false, owner: SystemProgram.programId },
      ],
    },
    {
      getMultipleAccountsInfo: async () => [
        { executable: true, owner: payer.publicKey },
      ],
    },
  ]) {
    const f = fixture(changes),
      tx = await built(f.conn);
    await assert.rejects(() =>
      executeTransaction(
        tx,
        [payer],
        { maxDebitLamports: 20000, maxFeeLamports: 10000 },
        f.conn,
      ),
    );
    assert.equal(f.sends(), 0);
  }
});

test("minimum SOL reserve blocks spending even when the debit cap would permit it", async () => {
  const f = fixture(),
    tx = await built(f.conn);
  await assert.rejects(
    () =>
      executeTransaction(
        tx,
        [payer],
        {
          maxDebitLamports: 20000,
          maxFeeLamports: 10000,
          minBalanceLamports: 990000,
        },
        f.conn,
      ),
    /reserve/,
  );
  const r = await executeTransaction(
    tx,
    [payer],
    {
      maxDebitLamports: 20000,
      maxFeeLamports: 10000,
      minBalanceLamports: 980000,
    },
    f.conn,
  );
  assert.equal(r.review.reserveLamports, 980000);
  assert.equal(f.sends(), 0);
});

test("signing failure cannot claim or submit a transaction", async () =>
  mockLive(async () => {
    const f = fixture(),
      tx = await built(f.conn),
      dir = await mkdtemp(join(tmpdir(), "vexum-sign-failure-"));
    tx.sign = () => {
      throw new Error("Signer unavailable");
    };
    await assert.rejects(
      () => executeTransaction(tx, [payer], approval(dir), f.conn),
      /Signer unavailable/,
    );
    const { readdir } = await import("node:fs/promises");
    assert.deepEqual(await readdir(dir), []);
    assert.equal(f.sends(), 0);
  }));
