import test from "node:test";
import { createRequire } from "node:module";
import { routeCoder } from "../src/protocols/jupiter.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
const BN = createRequire(import.meta.url)("bn.js") as typeof import("bn.js");
import assert from "node:assert/strict";
import { Keypair, Connection, SystemProgram, PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID, pumpIdl } from "../src/core/pump.js";
import {
  defaultLimits,
  validateSwap,
  swapTransaction,
  creationEvents,
  monitorCreations,
  swapBuild,
  type SwapBuild,
} from "../src/services/trading.js";
import { SOL_MINT } from "../src/core/config.js";
const mint = Keypair.generate().publicKey.toBase58(),
  owner = Keypair.generate().publicKey.toBase58();
function buildFixture(
  payer = owner,
  input = SOL_MINT,
  output = mint,
): SwapBuild {
  const program = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4";
  const keys = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    payer,
    getAssociatedTokenAddressSync(
      new PublicKey(input),
      new PublicKey(payer),
    ).toBase58(),
    getAssociatedTokenAddressSync(
      new PublicKey(output),
      new PublicKey(payer),
    ).toBase58(),
    program,
    output,
    program,
    Keypair.generate().publicKey.toBase58(),
    program,
  ];
  const swap = {
    programId: program,
    accounts: keys.map((pubkey, i) => ({
      pubkey,
      isSigner: i === 1,
      isWritable: i === 2 || i === 3,
    })),
    data: routeCoder
      .encode("route", {
        routePlan: [
          {
            swap: { TokenSwap: {} },
            percent: 100,
            inputIndex: 0,
            outputIndex: 1,
          },
        ],
        inAmount: new BN("1000000"),
        quotedOutAmount: new BN("1000"),
        slippageBps: 100,
        platformFeeBps: 0,
      })
      .toString("base64"),
  };
  return {
    inputMint: input,
    outputMint: output,
    inAmount: "1000000",
    outAmount: "1000",
    otherAmountThreshold: "990",
    swapMode: "ExactIn",
    slippageBps: 100,
    priceImpactPct: "0.001",
    computeBudgetInstructions: [],
    setupInstructions: [],
    swapInstruction: swap,
  };
}

test("swap response enforces exact mints, amounts, slippage and price impact", () => {
  const b = buildFixture();
  validateSwap(b, SOL_MINT, mint, "1000000", defaultLimits);
  for (const change of [
    { outputMint: owner },
    { inAmount: "999" },
    { slippageBps: 1000 },
    { otherAmountThreshold: "1" },
    { priceImpactPct: "99" },
  ])
    assert.throws(() =>
      validateSwap(
        { ...b, ...change },
        SOL_MINT,
        mint,
        "1000000",
        defaultLimits,
      ),
    );
});
test("Jupiter buy/sell instruction construction and program/signer validation", async () => {
  const conn = {
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    }),
  } as unknown as Connection;
  const payer = Keypair.generate().publicKey,
    b = buildFixture(payer.toBase58());
  const buy = await swapTransaction(b, payer, conn);
  assert.ok(buy.message.staticAccountKeys[0].equals(payer));
  const sell = await swapTransaction(
    buildFixture(payer.toBase58(), mint, SOL_MINT),
    payer,
    conn,
  );
  assert.equal(sell.message.compiledInstructions.length, 2);
  assert.equal(sell.message.compiledInstructions[0].data[0], 2);
  assert.equal(
    Buffer.from(sell.message.compiledInstructions[0].data).readUInt32LE(1),
    1400000,
  );
  await assert.rejects(
    () =>
      swapTransaction(
        {
          ...b,
          swapInstruction: {
            ...b.swapInstruction,
            programId: SystemProgram.programId.toBase58(),
          },
        },
        payer,
        conn,
      ),
    /Unexpected/,
  );
  await assert.rejects(
    () =>
      swapTransaction(
        {
          ...b,
          setupInstructions: [
            {
              ...b.swapInstruction,
              accounts: [{ pubkey: owner, isSigner: true, isWritable: true }],
            },
          ],
        },
        payer,
        conn,
      ),
    /signer|setup program/,
  );
});
test("missing Jupiter credentials do not create pretend routes", async () => {
  const saved = process.env.JUPITER_API_KEY;
  process.env.JUPITER_API_KEY = "";
  try {
    await assert.rejects(
      () =>
        swapBuild(
          SOL_MINT,
          mint,
          "1000000",
          owner,
          defaultLimits,
          async () => new Response("", { status: 401 }),
        ),
      /JUPITER_API_KEY/,
    );
  } finally {
    if (saved === undefined) delete process.env.JUPITER_API_KEY;
    else process.env.JUPITER_API_KEY = saved;
  }
});
function eventFixture() {
  const fields = pumpIdl.types.find((t) => t.name === "CreateEvent")!.type
    .fields as Array<{ name: string; type: string }>;
  const strings: Record<string, string> = {
    name: "Fixture",
    symbol: "FIX",
    uri: "ipfs://fixture",
  };
  const parts: Buffer[] = [
    Buffer.from(
      pumpIdl.events.find((e) => e.name === "CreateEvent")!.discriminator,
    ),
  ];
  for (const f of fields) {
    if (f.type === "string") {
      const bytes = Buffer.from(strings[f.name]);
      const len = Buffer.alloc(4);
      len.writeUInt32LE(bytes.length);
      parts.push(len, bytes);
    } else if (f.type === "pubkey") {
      parts.push(
        Buffer.from(
          f.name === "mint"
            ? new Keypair().publicKey.toBytes()
            : f.name === "token_program"
              ? new Keypair().publicKey.toBytes()
              : new Keypair().publicKey.toBytes(),
        ),
      );
    } else if (f.type === "bool" || f.type === "u8")
      parts.push(Buffer.alloc(1));
    else parts.push(Buffer.alloc(8));
  }
  return parts;
}
test("Pump create event decoder validates emitting program and rejects spoofed/truncated data", () => {
  const data = Buffer.concat(eventFixture()).toString("base64"),
    pump = PUMP_PROGRAM_ID.toBase58();
  const events = creationEvents([
    `Program ${pump} invoke [1]`,
    `Program data: ${data}`,
    `Program ${pump} success`,
  ]);
  assert.equal(events.length, 1);
  assert.equal(events[0].symbol, "FIX");
  assert.equal(events[0].name, "Fixture");
  assert.equal(
    creationEvents([`Program ${owner} invoke [1]`, `Program data: ${data}`])
      .length,
    0,
  );
  assert.equal(
    creationEvents([`Program ${pump} invoke [1]`, "Program data: broken"])
      .length,
    0,
  );
});
test("monitoring unsubscribes cleanly on stop and does not submit trades", async () => {
  const controller = new AbortController();
  let removed = 0;
  const conn = {
    getGenesisHash: async () => "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    onLogs: () => {
      setImmediate(() => controller.abort());
      return 42;
    },
    removeOnLogsListener: async (id: number) => {
      assert.equal(id, 42);
      removed++;
    },
  } as unknown as Connection;
  await monitorCreations(
    {
      signal: controller.signal,
      onEvent: async () => {
        throw new Error("Unexpected event");
      },
    },
    conn,
  );
  assert.equal(removed, 1);
});

test("malicious SPL approvals, authority changes and unrelated transfers are rejected before construction", async () => {
  const {
    createApproveInstruction,
    createTransferInstruction,
    createSetAuthorityInstruction,
    AuthorityType,
  } = await import("@solana/spl-token");
  const payer = Keypair.generate().publicKey,
    account = Keypair.generate().publicKey,
    attacker = Keypair.generate().publicKey;
  const { validateSetup } = await import("../src/services/trading.js");
  for (const ix of [
    createApproveInstruction(account, attacker, payer, 10n),
    createTransferInstruction(account, attacker, payer, 10n),
    createSetAuthorityInstruction(
      account,
      payer,
      AuthorityType.AccountOwner,
      attacker,
    ),
  ]) {
    const b = buildFixture();
    b.setupInstructions = [
      {
        programId: ix.programId.toBase58(),
        accounts: ix.keys.map((k) => ({
          pubkey: k.pubkey.toBase58(),
          isSigner: k.isSigner,
          isWritable: k.isWritable,
        })),
        data: ix.data.toString("base64"),
      },
    ];
    assert.throws(() => validateSetup(b, payer), /Unsupported token setup/);
  }
});
test("minimum output must be positive and decimal ratio price impact enforces percentage cap", () => {
  const b = buildFixture();
  assert.throws(
    () =>
      validateSwap(
        { ...b, outAmount: "1", otherAmountThreshold: "0" },
        SOL_MINT,
        mint,
        "1000000",
        defaultLimits,
      ),
    /minimum/,
  );
  assert.throws(
    () =>
      validateSwap(
        { ...b, priceImpactPct: "0.04" },
        SOL_MINT,
        mint,
        "1000000",
        defaultLimits,
      ),
    /impact/,
  );
});
test("position reconciliation keeps unknown outcomes blocked and restores failed sells", async () => {
  const { reconcilePosition } = await import("../src/services/trading.js");
  const position = {
    id: "fixture",
    mode: "live" as const,
    mint,
    owner,
    status: "uncertain" as const,
    quantity: "100",
    decimals: 6,
    costLamports: 1000000,
    observedAt: new Date().toISOString(),
    signature: "fixture",
    pendingSide: "sell" as const,
  };
  await assert.rejects(
    () =>
      reconcilePosition(position, {
        getTransaction: async () => null,
      } as unknown as Connection),
    /uncertain/,
  );
  const conn = {
    getTransaction: async () => ({
      transaction: {
        message: {
          staticAccountKeys: [
            new (await import("@solana/web3.js")).PublicKey(owner),
          ],
        },
      },
      meta: { err: { InstructionError: [0, "failed"] }, fee: 5000 },
    }),
  } as unknown as Connection;
  assert.equal((await reconcilePosition(position, conn)).status, "open");
  assert.equal(
    (await reconcilePosition({ ...position, pendingSide: "buy" }, conn)).status,
    "failed",
  );
});

test("simulated swap effects reject unrelated balance or delegate changes and missing outputs", async () => {
  const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
  const { inspectSwapEffects } = await import("../src/services/trading.js");
  const payer = new PublicKey(owner),
    otherMint = Keypair.generate().publicKey,
    otherAccount = Keypair.generate().publicKey;
  const tokenProgram = new PublicKey(
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  );
  const output = getAssociatedTokenAddressSync(new PublicKey(mint), payer);
  function bytes(token: PublicKey, amount: bigint) {
    const b = Buffer.alloc(165);
    Buffer.from(token.toBytes()).copy(b, 0);
    Buffer.from(payer.toBytes()).copy(b, 32);
    b.writeBigUInt64LE(amount, 64);
    b[108] = 1;
    return b;
  }
  const oldOther = bytes(otherMint, 100n),
    newOutput = bytes(new PublicKey(mint), 1000n);
  let mode = "valid";
  const conn = {
    getAccountInfo: async () => ({ owner: tokenProgram }),
    getTokenAccountsByOwner: async (
      _p: PublicKey,
      filter: { programId: PublicKey },
    ) => ({
      value: filter.programId.equals(tokenProgram)
        ? [{ pubkey: otherAccount }]
        : [],
    }),
    getMultipleAccountsInfo: async (keys: PublicKey[]) =>
      keys.map((k) =>
        k.equals(payer)
          ? { lamports: 100000000 }
          : k.equals(otherAccount)
            ? {
                lamports: 2000000,
                owner: tokenProgram,
                data: oldOther,
                executable: false,
                rentEpoch: 0,
              }
            : null,
      ),
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    }),
    getFeeForMessage: async () => ({ value: 5000 }),
    simulateTransaction: async () => {
      const modified = Buffer.from(oldOther);
      if (mode === "balance") modified.writeBigUInt64LE(90n, 64);
      if (mode === "delegate") {
        modified.writeUInt32LE(1, 72);
        Buffer.from(Keypair.generate().publicKey.toBytes()).copy(modified, 76);
      }
      return {
        context: { slot: 1 },
        value: {
          err: null,
          accounts: [
            { lamports: 96995000 },
            {
              lamports: 2000000,
              owner: tokenProgram.toBase58(),
              data: [modified.toString("base64"), "base64"],
            },
            mode === "missing"
              ? null
              : {
                  lamports: 2000000,
                  owner: tokenProgram.toBase58(),
                  data: [newOutput.toString("base64"), "base64"],
                },
          ],
        },
      };
    },
  } as unknown as Connection;
  const build = buildFixture();
  const tx = await swapTransaction(build, payer, conn);
  assert.ok(output);
  await inspectSwapEffects(build, tx, payer, conn);
  mode = "balance";
  await assert.rejects(
    () => inspectSwapEffects(build, tx, payer, conn),
    /unrelated token/,
  );
  mode = "delegate";
  await assert.rejects(
    () => inspectSwapEffects(build, tx, payer, conn),
    /authority/,
  );
  mode = "missing";
  await assert.rejects(
    () => inspectSwapEffects(build, tx, payer, conn),
    /input|output/,
  );
});

test("Jupiter encoded route amounts and minimum output are bound to the approved quote", async () => {
  const { validateRouteBytes } = await import("../src/protocols/jupiter.js");
  const b = buildFixture(),
    bytes = Buffer.from(b.swapInstruction.data, "base64");
  assert.equal(validateRouteBytes(bytes, b), "route");
  assert.throws(
    () => validateRouteBytes(bytes, { ...b, inAmount: "999999" }),
    /do not match/,
  );
  assert.throws(
    () => validateRouteBytes(bytes, { ...b, slippageBps: 50 }),
    /do not match/,
  );
  assert.throws(
    () => validateRouteBytes(bytes, { ...b, otherAmountThreshold: "995" }),
    /minimum/,
  );
  assert.throws(
    () => validateRouteBytes(Buffer.concat([bytes, Buffer.from([0])]), b),
    /trailing/,
  );
  assert.throws(() => validateRouteBytes(Buffer.alloc(8), b), /Unsupported/);
});

test("all live wallet trades remain blocked while any sibling outcome is unresolved", async () => {
  const { assertWalletSettled } = await import("../src/services/trading.js");
  const base = {
    id: "existing",
    mode: "live" as const,
    owner,
    mint,
    status: "open" as const,
    quantity: "100",
    decimals: 6,
    costLamports: 1000000,
    observedAt: new Date().toISOString(),
  };
  for (const status of ["pending", "uncertain"] as const) {
    const unresolved = { ...base, mode: "live" as const, owner, status };
    assert.throws(() => assertWalletSettled([unresolved], owner), /Reconcile/);
    assert.doesNotThrow(() => assertWalletSettled([unresolved], mint));
  }
  assert.doesNotThrow(() => assertWalletSettled([base], owner));
});

test("current Jupiter response permits null ALTs, pins v0, and rejects extra tips or malformed V2 routes", async () => {
  const { buildSchema, validateSetup } = await import(
    "../src/services/trading.js"
  );
  const b = buildFixture();
  const current = buildSchema.parse({
    ...b,
    addressesByLookupTableAddress: null,
    tipInstruction: null,
    transactionVersion: 0,
  });
  assert.equal(current.addressesByLookupTableAddress, null);
  assert.throws(() => buildSchema.parse({ ...b, transactionVersion: 1 }));
  assert.throws(
    () =>
      validateSetup(
        { ...b, tipInstruction: b.swapInstruction },
        new PublicKey(owner),
      ),
    /tip instructions/,
  );
  const { validateRouteBytes, routeDiscriminator } = await import(
    "../src/protocols/jupiter.js"
  );
  assert.throws(
    () =>
      validateRouteBytes(
        Buffer.concat([routeDiscriminator("route_v2"), Buffer.alloc(40)]),
        b,
      ),
    /Jupiter/,
  );
});

test("unavailable Jupiter routes and provider outages cannot produce executable builds", async () => {
  let requests = 0;
  await assert.rejects(
    () =>
      swapBuild(SOL_MINT, mint, "1000000", owner, defaultLimits, async () => {
        requests++;
        return new Response("No routes found", { status: 400 });
      }),
    /400/,
  );
  assert.equal(requests, 1);
  requests = 0;
  await assert.rejects(
    () =>
      swapBuild(SOL_MINT, mint, "1000000", owner, defaultLimits, async () => {
        requests++;
        return new Response("Unavailable", {
          status: 503,
          headers: { "retry-after": "0" },
        });
      }),
    /503/,
  );
  assert.equal(requests, 2);
});
