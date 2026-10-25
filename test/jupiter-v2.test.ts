import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Keypair, PublicKey, type Connection } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  validateRouteBytes,
  routeDiscriminator,
  v2RouteCoder,
  validateV2Accounts,
} from "../src/protocols/jupiter.js";
import idl from "../src/protocols/jupiter-v2-idl.json" with { type: "json" };
import proof from "./fixtures/jupiter-v2-provenance.json" with { type: "json" };
import {
  buildSchema,
  swapTransaction,
  swapQuote,
  defaultLimits,
  type SwapBuild,
} from "../src/services/trading.js";
import { SOL_MINT } from "../src/core/config.js";
const payer = Keypair.generate().publicKey,
  mint = Keypair.generate().publicKey;
// Independent Borsh bytes: u64/u64/u16/u16/u16 precede vec, unlike the legacy route.
function routeBytes(shared = false) {
  const args = Buffer.alloc(32);
  args.writeBigUInt64LE(1000000n, 0);
  args.writeBigUInt64LE(1000n, 8);
  args.writeUInt16LE(100, 16);
  args.writeUInt32LE(1, 22);
  args[26] = 3; // Swap::TokenSwap, official enum index, no fields.
  args.writeUInt16LE(10000, 27);
  args[29] = 0;
  args[30] = 1;
  return Buffer.concat([
    routeDiscriminator(shared ? "shared_accounts_route_v2" : "route_v2"),
    ...(shared ? [Buffer.from([0])] : []),
    args.subarray(0, 31),
  ]);
}
function fixture(shared = false): SwapBuild {
  const source = getAssociatedTokenAddressSync(
      new PublicKey(SOL_MINT),
      payer,
    ).toBase58(),
    dest = getAssociatedTokenAddressSync(mint, payer).toBase58(),
    program = idl.address,
    event = "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf",
    token = TOKEN_PROGRAM_ID.toBase58();
  const keys = shared
    ? [
        program,
        payer.toBase58(),
        source,
        program,
        program,
        dest,
        SOL_MINT,
        mint.toBase58(),
        token,
        token,
        event,
        program,
      ]
    : [
        payer.toBase58(),
        source,
        dest,
        SOL_MINT,
        mint.toBase58(),
        token,
        token,
        program,
        event,
        program,
      ];
  return {
    inputMint: SOL_MINT,
    outputMint: mint.toBase58(),
    inAmount: "1000000",
    outAmount: "1000",
    otherAmountThreshold: "990",
    swapMode: "ExactIn",
    slippageBps: 100,
    priceImpactPct: "0.001",
    computeBudgetInstructions: [],
    setupInstructions: [],
    transactionVersion: 0,
    addressesByLookupTableAddress: null,
    swapInstruction: {
      programId: program,
      accounts: keys.map((pubkey, i) => ({
        pubkey,
        isSigner: i === (shared ? 1 : 0),
        isWritable: shared ? [2, 3, 4, 5].includes(i) : [1, 2].includes(i),
      })),
      data: routeBytes(shared).toString("base64"),
    },
  };
}
const conn = {
  getLatestBlockhash: async () => ({
    blockhash: Keypair.generate().publicKey.toBase58(),
    lastValidBlockHeight: 1,
  }),
} as unknown as Connection;
test("canonical V2 instructions match official pinned source and deployed mainnet IDL provenance", () => {
  assert.equal(
    createHash("sha256").update(JSON.stringify(idl)).digest("hex"),
    proof.subsetSha256,
  );
  assert.equal(proof.chainIdlOwner, idl.address);
  assert.equal(proof.officialInstructionsMatch, true);
  for (const ix of idl.instructions)
    assert.deepEqual(
      ix,
      proof.supportedInstructions.find((v) => v.name === ix.name),
    );
});
test("both current V2 route layouts independently decode, reencode and build a v0 transaction", async () => {
  for (const shared of [false, true]) {
    const b = fixture(shared),
      data = Buffer.from(b.swapInstruction.data, "base64");
    const name = validateRouteBytes(data, b);
    assert.equal(name, shared ? "shared_accounts_route_v2" : "route_v2");
    const decoded = v2RouteCoder.decode(data)!;
    assert.ok(v2RouteCoder.encode(decoded.name, decoded.data).equals(data));
    const tx = await swapTransaction(b, payer, conn);
    assert.equal(tx.version, 0);
    assert.ok(tx.signatures.every((s) => s.every((b) => b === 0)));
  }
});
test("V2 amount, platform fee, positive-slippage fee, route weight and trailing bytes fail closed", () => {
  for (const [offset, value] of [
    [8, 1],
    [24, 101],
    [26, 1],
    [28, 1],
    [36, 255],
  ] as const) {
    const b = fixture(),
      data = routeBytes();
    data[offset] = value;
    assert.throws(() => validateRouteBytes(data, b));
  }
  const b = fixture();
  assert.throws(
    () =>
      validateRouteBytes(Buffer.concat([routeBytes(), Buffer.from([0])]), b),
    /trailing/,
  );
  assert.throws(() =>
    buildSchema.parse({ ...b, inAmount: "18446744073709551616" }),
  );
  assert.throws(() => buildSchema.parse({ ...b, inAmount: "01" }));
});
test("V2 validates signer, mint, token program, event authority and recipient privileges", () => {
  for (const index of [0, 3, 4, 5, 6, 7, 8, 9]) {
    const b = fixture();
    b.swapInstruction.accounts[index].pubkey =
      Keypair.generate().publicKey.toBase58();
    assert.throws(() =>
      validateV2Accounts(
        "route_v2",
        b.swapInstruction.accounts,
        payer.toBase58(),
        b.inputMint,
        b.outputMint,
      ),
    );
  }
  for (const index of [3, 4, 5, 6, 8, 9]) {
    const b = fixture();
    b.swapInstruction.accounts[index].isWritable = true;
    assert.throws(() =>
      validateV2Accounts(
        "route_v2",
        b.swapInstruction.accounts,
        payer.toBase58(),
        b.inputMint,
        b.outputMint,
      ),
    );
  }
  const b = fixture();
  b.swapInstruction.accounts[0].isSigner = false;
  assert.throws(() =>
    validateV2Accounts(
      "route_v2",
      b.swapInstruction.accounts,
      payer.toBase58(),
      b.inputMint,
      b.outputMint,
    ),
  );
});
test("read-only Jupiter /order omits taker and transaction, validates real quote contract and credentials", async () => {
  const old = process.env.JUPITER_API_KEY;
  process.env.JUPITER_API_KEY = "fixture-key";
  try {
    const b = fixture();
    let requests = 0;
    const fetcher: typeof fetch = async (u, init) => {
      requests++;
      const url = new URL(String(u));
      assert.equal(url.pathname, "/swap/v2/order");
      assert.equal(url.searchParams.has("taker"), false);
      assert.equal(
        (init?.headers as Record<string, string>)["x-api-key"],
        "fixture-key",
      );
      return Response.json({
        ...b,
        priceImpact: 0.1,
        transaction: "should-never-be-returned-or-used",
      });
    };
    const q = await swapQuote(
      b.inputMint,
      b.outputMint,
      b.inAmount,
      defaultLimits,
      fetcher,
    );
    assert.ok(!("transaction" in q));
    assert.equal(q.source, "Jupiter Swap V2 /order");
    assert.equal(requests, 1);
    await assert.rejects(
      () =>
        swapQuote(
          b.inputMint,
          b.outputMint,
          b.inAmount,
          defaultLimits,
          async () => Response.json({ ...b, priceImpact: 99 }),
        ),
      /risk limits/,
    );
    await assert.rejects(
      () =>
        swapQuote(
          b.inputMint,
          b.outputMint,
          b.inAmount,
          defaultLimits,
          async () => new Response("", { status: 401 }),
        ),
      /401/,
    );
    process.env.JUPITER_API_KEY = "";
    const publicQuote = await swapQuote(
      b.inputMint,
      b.outputMint,
      b.inAmount,
      defaultLimits,
      async (_u, init) => {
        assert.deepEqual(init?.headers, {});
        return Response.json({ ...b, priceImpact: 0.1 });
      },
    );
    assert.equal(publicQuote.inAmount, b.inAmount);
    await assert.rejects(
      () =>
        swapQuote(
          b.inputMint,
          b.outputMint,
          b.inAmount,
          defaultLimits,
          async () => new Response("", { status: 401 }),
        ),
      /JUPITER_API_KEY/,
    );
  } finally {
    if (old === undefined) delete process.env.JUPITER_API_KEY;
    else process.env.JUPITER_API_KEY = old;
  }
});

test("provider ceil rounding cannot overstate the conservative minimum approved on wire", () => {
  const b = fixture();
  const data = routeBytes();
  data.writeBigUInt64LE(1001n, 16);
  validateRouteBytes(data, {
    ...b,
    outAmount: "1001",
    otherAmountThreshold: "991",
  });
  assert.throws(
    () =>
      validateRouteBytes(data, {
        ...b,
        outAmount: "1001",
        otherAmountThreshold: "992",
      }),
    /minimum output/,
  );
});

test("recorded production V2 /build response constructs with intermediate ATAs and verified ALT data", async () => {
  const { readFile } = await import("node:fs/promises");
  const { AddressLookupTableAccount } = await import("@solana/web3.js");
  const recorded = JSON.parse(
    await readFile(
      new URL("fixtures/jupiter-mainnet-build.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(recorded.fundedSimulationVerified, false);
  const b = buildSchema.parse(recorded.build),
    owner = new PublicKey(b.swapInstruction.accounts[0].pubkey);
  const setup = b.setupInstructions.filter(
    (i) => i.programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
  );
  let corruptMint = false,
    corruptTable = false;
  const mock = {
    ...conn,
    getMultipleAccountsInfo: async (keys: PublicKey[]) =>
      keys.map((k) => {
        const ix = setup.find((i) => i.accounts[3].pubkey === k.toBase58())!;
        const data = Buffer.alloc(82);
        data[45] = 1;
        return {
          owner: corruptMint ? owner : new PublicKey(ix.accounts[5].pubkey),
          data,
          executable: false,
          lamports: 1000000,
          rentEpoch: 0,
        };
      }),
    getAddressLookupTable: async (key: PublicKey) => ({
      value: new AddressLookupTableAccount({
        key,
        state: {
          deactivationSlot: 18446744073709551615n,
          lastExtendedSlot: 1,
          lastExtendedSlotStartIndex: 0,
          addresses: (
            b.addressesByLookupTableAddress?.[key.toBase58()] ?? []
          ).map((s, i) => (corruptTable && i === 0 ? owner : new PublicKey(s))),
        },
      }),
    }),
  } as unknown as Connection;
  const tx = await swapTransaction(b, owner, mock);
  assert.equal(tx.version, 0);
  assert.ok(tx.serialize().length <= 1232);
  corruptMint = true;
  await assert.rejects(() => swapTransaction(b, owner, mock), /mint owner/);
  corruptMint = false;
  corruptTable = true;
  await assert.rejects(() => swapTransaction(b, owner, mock), /on-chain table/);
});
