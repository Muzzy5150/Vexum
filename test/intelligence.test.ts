import test from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { Rpc, type Fetcher } from "../src/core/network.js";
import { TOKEN_PROGRAMS, NETWORK_GENESIS, config } from "../src/core/config.js";
import {
  walletInfo,
  tokenInfo,
  formatUnits,
  resolveMint,
} from "../src/services/intelligence.js";
const owner = Keypair.generate().publicKey.toBase58(),
  mint = Keypair.generate().publicKey.toBase58(),
  tokenAccount = Keypair.generate().publicKey.toBase58();
function fakeRpc(responses: Record<string, unknown>) {
  const fetcher: Fetcher = async (_u, init) => {
    const req = JSON.parse(String(init?.body));
    const result = req.method === "getGenesisHash" ? NETWORK_GENESIS[config().cluster] : responses[req.method];
    return Response.json({ jsonrpc: "2.0", id: req.id, result });
  };
  return new Rpc(["https://fixture.invalid"], fetcher);
}
const context = { slot: 100 };
const account = {
  owner: TOKEN_PROGRAMS[0],
  lamports: 2039280,
  data: {
    parsed: {
      type: "account",
      info: {
        owner,
        mint,
        tokenAmount: { amount: "123456789012345678", decimals: 9 },
      },
    },
  },
};
test("wallet inspection parses SOL, SPL, Token-2022, and real history summaries", async () => {
  const rpc = fakeRpc({
    getBalance: { context, value: 1234567890 },
    getTokenAccountsByOwner: {
      context,
      value: [{ pubkey: tokenAccount, account }],
    },
    getSignaturesForAddress: [
      {
        signature: "fixture-signature",
        slot: 99,
        blockTime: 1,
        err: null,
        confirmationStatus: "confirmed",
      },
    ],
  });
  const result = await walletInfo(owner, rpc);
  assert.equal(result.sol, "1.23456789");
  assert.equal(result.tokens.length, 1);
  assert.equal(result.tokens[0].quantity, "123456789.012345678");
  assert.equal(result.history?.length, 1);
  assert.equal(result.warnings.length, 1); // second program fixture deliberately has wrong owner
});
test("wallet RPC failure is an error, never zero balance", async () => {
  await assert.rejects(
    () => walletInfo(owner, fakeRpc({ getBalance: { value: "0" } })),
    /failed/,
  );
});
test("token intelligence does not label largest holder LP or substitute FDV for market cap", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json([
      {
        chainId: "solana",
        dexId: "fixture",
        pairAddress: tokenAccount,
        baseToken: { address: mint, name: "Fixture", symbol: "FIX" },
        quoteToken: { address: owner, symbol: "SOL" },
        fdv: 999999,
        priceUsd: "1.00",
        liquidity: { usd: 1000 },
      },
    ]),
  );
  const rpc = fakeRpc({
    getAccountInfo: {
      context,
      value: {
        ...account,
        data: {
          parsed: {
            type: "mint",
            info: {
              supply: "1000000000",
              decimals: 6,
              mintAuthority: owner,
              freezeAuthority: null,
              isInitialized: true,
            },
          },
        },
      },
    },
    getTokenLargestAccounts: {
      context,
      value: [{ address: tokenAccount, amount: "500000000", decimals: 6 }],
    },
    getMultipleAccounts: { context, value: [account] },
  });
  const result = await tokenInfo(mint, rpc);
  assert.equal(result.totalSupply, "1000");
  assert.equal(result.marketCap, null);
  assert.equal(result.fdv, 999999);
  assert.equal(result.holders[0].liquidityPool, null);
  assert.equal(result.holders[0].percent, 50);
  assert.equal(result.holders[0].owner, owner);
  assert.equal(result.creation, null);
  assert.equal(result.circulatingSupply, null);
  assert.ok(result.risks.some((v) => v.includes("Mint authority")));
});
test("non-token accounts rejected and ambiguous tickers require exact mint", async (t) => {
  await assert.rejects(
    () =>
      tokenInfo(
        owner,
        fakeRpc({
          getAccountInfo: {
            context,
            value: { ...account, owner: "11111111111111111111111111111111" },
          },
        }),
      ),
    /not a supported/,
  );
  const pairs = [mint, owner].map((address) => ({
    chainId: "solana",
    dexId: "test",
    pairAddress: tokenAccount,
    baseToken: { address, name: "Dup", symbol: "DUP" },
    quoteToken: { address: tokenAccount, symbol: "SOL" },
  }));
  t.mock.method(globalThis, "fetch", async () => Response.json({ pairs }));
  await assert.rejects(() => resolveMint("DUP"), /2 mints/);
  assert.equal(await resolveMint(mint), mint);
});
test("token amounts preserve precision and zero", () => {
  assert.equal(formatUnits("0", 9), "0");
  assert.equal(formatUnits("1000", 0), "1000");
  assert.equal(formatUnits("10000000000000000001", 9), "10000000000.000000001");
  assert.throws(() => formatUnits("bad", 9));
});

test("development-cluster scans never mix in mainnet markets or holder counts", async (t) => {
  const oldCluster = process.env.VEXUM_CLUSTER,
    oldKey = process.env.SOLSCAN_API_KEY;
  process.env.VEXUM_CLUSTER = "devnet";
  process.env.SOLSCAN_API_KEY = "fixture-not-forwarded";
  let externalCalls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    externalCalls++;
    return Response.json({ success: true, data: { total: 10000 } });
  });
  try {
    const result = await tokenInfo(
      mint,
      fakeRpc({
        getAccountInfo: {
          context,
          value: {
            ...account,
            data: {
              parsed: {
                type: "mint",
                info: {
                  supply: "1000",
                  decimals: 6,
                  mintAuthority: null,
                  freezeAuthority: null,
                  isInitialized: true,
                },
              },
            },
          },
        },
        getTokenLargestAccounts: { context, value: [] },
      }),
    );
    assert.deepEqual(result.pools, []);
    assert.equal(result.holderCount, null);
    assert.equal(externalCalls, 0);
    assert.ok(result.warnings.some((w) => w.includes("mainnet-only")));
    const { searchTokens } = await import("../src/services/intelligence.js");
    await assert.rejects(() => searchTokens("FIX"), /mainnet-only/);
    assert.equal(externalCalls, 0);
  } finally {
    if (oldCluster === undefined) delete process.env.VEXUM_CLUSTER;
    else process.env.VEXUM_CLUSTER = oldCluster;
    if (oldKey === undefined) delete process.env.SOLSCAN_API_KEY;
    else process.env.SOLSCAN_API_KEY = oldKey;
  }
});
