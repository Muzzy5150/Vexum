import { z } from "zod";
import { config, TOKEN_PROGRAMS, redact } from "../core/config.js";
import { Rpc, jsonRequest, uint, amount, context } from "../core/network.js";
import { address } from "./wallet.js";

export const tokenAmount = z.object({
  amount,
  decimals: uint.max(255),
  uiAmountString: z.string().optional(),
});
const account = z.object({
  owner: z.string(),
  lamports: uint,
  data: z.object({
    program: z.string().optional(),
    parsed: z.object({
      type: z.string(),
      info: z.record(z.string(), z.unknown()),
    }),
  }),
});
const pair = z.object({
  chainId: z.string(),
  dexId: z.string(),
  pairAddress: z.string(),
  url: z.string().optional(),
  baseToken: z.object({
    address: z.string(),
    name: z.string(),
    symbol: z.string(),
  }),
  quoteToken: z.object({
    address: z.string(),
    name: z.string().optional(),
    symbol: z.string(),
  }),
  priceUsd: z.string().optional().nullable(),
  marketCap: z.number().finite().nonnegative().optional().nullable(),
  fdv: z.number().finite().nonnegative().optional().nullable(),
  liquidity: z
    .object({ usd: z.number().finite().nonnegative().optional() })
    .optional(),
  volume: z.record(z.string(), z.number().finite()).optional(),
  priceChange: z.record(z.string(), z.number().finite()).optional(),
  pairCreatedAt: uint.optional(),
  info: z.unknown().optional(),
});
export type Pair = z.infer<typeof pair>;
export function formatUnits(raw: string, decimals: number) {
  if (
    !/^\d+$/.test(raw) ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 255
  )
    throw new Error("Invalid token amount");
  if (!decimals) return raw;
  const value = raw.padStart(decimals + 1, "0");
  return `${value.slice(0, -decimals)}.${value.slice(-decimals)}`.replace(
    /\.?0+$/,
    "",
  );
}
export async function walletInfo(owner: string, rpc = new Rpc(), limit = 20) {
  address(owner);
  uint.min(1).max(100).parse(limit);
  const warnings: string[] = [];
  const balance = await rpc.call(
    "getBalance",
    [owner, { commitment: "confirmed" }],
    z.object({ context, value: uint }),
  );
  const tokens = await Promise.all(
    TOKEN_PROGRAMS.map(async (programId) => {
      try {
        const result = await rpc.call(
          "getTokenAccountsByOwner",
          [
            owner,
            { programId },
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
          z.object({
            context,
            value: z.array(z.object({ pubkey: z.string(), account })),
          }),
        );
        return result.value.map((entry) => {
          if (
            entry.account.owner !== programId ||
            entry.account.data.parsed.type !== "account"
          )
            throw new Error("Token account program mismatch");
          const info = z
            .object({ owner: z.literal(owner), mint: z.string(), tokenAmount })
            .parse(entry.account.data.parsed.info);
          address(info.mint);
          address(entry.pubkey);
          return {
            account: entry.pubkey,
            mint: info.mint,
            programId,
            amount: info.tokenAmount.amount,
            decimals: info.tokenAmount.decimals,
            quantity: formatUnits(
              info.tokenAmount.amount,
              info.tokenAmount.decimals,
            ),
          };
        });
      } catch (error) {
        warnings.push(`${programId}: ${redact(error)}`);
        return [];
      }
    }),
  );
  const history = await transactionHistory(owner, rpc, limit).catch((error) => {
    warnings.push(redact(error));
    return null;
  });
  return {
    address: owner,
    observedAt: new Date().toISOString(),
    slot: balance.context.slot,
    lamports: balance.value,
    sol: formatUnits(String(balance.value), 9),
    tokens: tokens.flat(),
    history,
    warnings,
  };
}
export async function transactionHistory(
  owner: string,
  rpc = new Rpc(),
  limit = 20,
  before?: string,
) {
  address(owner);
  uint.min(1).max(100).parse(limit);
  return rpc.call(
    "getSignaturesForAddress",
    [owner, { limit, commitment: "confirmed", ...(before ? { before } : {}) }],
    z.array(
      z.object({
        signature: z.string(),
        slot: uint,
        blockTime: z.number().nullable().optional(),
        err: z.unknown().nullable(),
        memo: z.string().nullable().optional(),
        confirmationStatus: z.string().optional(),
      }),
    ),
  );
}
export async function dexPairs(mint: string): Promise<Pair[]> {
  address(mint);
  if (config().cluster !== "mainnet-beta")
    throw new Error(
      "DexScreener market data is mainnet-only; no market data for the configured cluster",
    );
  const result = z
    .array(pair)
    .parse(
      await jsonRequest(
        `https://api.dexscreener.com/token-pairs/v1/solana/${mint}`,
      ),
    );
  return result
    .filter((p) => p.chainId === "solana" && p.baseToken.address === mint)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
}
export async function searchTokens(query: string): Promise<Pair[]> {
  if (config().cluster !== "mainnet-beta")
    throw new Error("DexScreener token search is mainnet-only");
  if (!query.trim() || query.length > 100)
    throw new Error("Search query must contain 1–100 characters");
  const payload = z
    .object({ pairs: z.array(pair).nullable() })
    .parse(
      await jsonRequest(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      ),
    );
  return (payload.pairs ?? []).filter((p) => p.chainId === "solana");
}
export async function resolveMint(target: string) {
  try {
    return address(target);
  } catch {
    /* Resolve an exact ticker, never choose by liquidity alone. */
  }
  const matches = (await searchTokens(target)).filter(
    (p) => p.baseToken.symbol.toLowerCase() === target.toLowerCase(),
  );
  const mints = [...new Set(matches.map((p) => p.baseToken.address))];
  if (mints.length !== 1)
    throw new Error(
      `Ticker resolves to ${mints.length} mints; choose an exact mint using token search. ${mints.join(", ")}`,
    );
  return address(mints[0]);
}
export async function tokenInfo(mint: string, rpc = new Rpc()) {
  address(mint);
  const warnings: string[] = [];
  const mintAccount = await rpc.call(
    "getAccountInfo",
    [mint, { encoding: "jsonParsed", commitment: "confirmed" }],
    z.object({ context, value: account.nullable() }),
  );
  if (
    !mintAccount.value ||
    !TOKEN_PROGRAMS.includes(mintAccount.value.owner) ||
    mintAccount.value.data.parsed.type !== "mint"
  )
    throw new Error("Address is not a supported SPL/Token-2022 mint");
  const data = z
    .object({
      supply: amount,
      decimals: uint.max(255),
      mintAuthority: z.string().nullable(),
      freezeAuthority: z.string().nullable(),
      isInitialized: z.literal(true),
      extensions: z.array(z.unknown()).optional(),
    })
    .parse(mintAccount.value.data.parsed.info);
  const pairs = await dexPairs(mint).catch((e) => {
    warnings.push(`DexScreener: ${redact(e)}`);
    return [];
  });
  const largest = await rpc
    .call(
      "getTokenLargestAccounts",
      [mint, { commitment: "confirmed" }],
      z.object({
        context,
        value: z.array(tokenAmount.extend({ address: z.string() })),
      }),
    )
    .catch((e) => {
      warnings.push(`Largest accounts: ${redact(e)}`);
      return null;
    });
  const accounts = largest?.value ?? [];
  const owners = accounts.length
    ? await rpc
        .call(
          "getMultipleAccounts",
          [
            accounts.map((a) => a.address),
            { encoding: "jsonParsed", commitment: "confirmed" },
          ],
          z.object({ context, value: z.array(account.nullable()) }),
        )
        .catch((e) => {
          warnings.push(`Holder owners: ${redact(e)}`);
          return null;
        })
    : null;
  const supply = BigInt(data.supply);
  const holders = accounts.map((a, i) => {
    const entry = owners?.value[i];
    const parsed =
      entry &&
      entry.owner === mintAccount.value!.owner &&
      entry.data.parsed.type === "account"
        ? z
            .object({ mint: z.literal(mint), owner: z.string() })
            .safeParse(entry.data.parsed.info)
        : null;
    return {
      account: a.address,
      owner: parsed?.success ? parsed.data.owner : null,
      amount: a.amount,
      quantity: formatUnits(a.amount, a.decimals),
      percent:
        supply > 0n
          ? Number((BigInt(a.amount) * 1_000_000n) / supply) / 10000
          : null,
      liquidityPool: null,
    };
  });
  const embedded = (data.extensions ?? [])
    .map((value) =>
      z
        .object({
          extension: z.literal("tokenMetadata"),
          state: z.object({
            mint: z.literal(mint),
            name: z.string(),
            symbol: z.string(),
            uri: z.string(),
          }),
        })
        .safeParse(value),
    )
    .find((value) => value.success);
  let metadata: unknown = embedded?.success
    ? { onChain: embedded.data.state }
    : null;
  if (config().cluster === "mainnet-beta" && config().heliusKey) {
    const helius = new Rpc([
      `https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(config().heliusKey!)}`,
    ]);
    metadata = await helius
      .call(
        "getAsset",
        { id: mint },
        z.object({
          id: z.literal(mint),
          content: z.unknown().optional(),
          authorities: z.unknown().optional(),
          token_info: z.unknown().optional(),
          creators: z.unknown().optional(),
        }),
      )
      .catch((e) => {
        warnings.push(`Helius: ${redact(e)}`);
        return null;
      });
  }
  let holderCount: number | null = null;
  if (config().solscanKey && config().cluster !== "mainnet-beta")
    warnings.push(
      "Solscan holder indexing is mainnet-only; skipped for configured cluster",
    );
  if (config().solscanKey && config().cluster === "mainnet-beta") {
    try {
      const payload = z
        .object({ success: z.literal(true), data: z.object({ total: uint }) })
        .parse(
          await jsonRequest(
            `https://pro-api.solscan.io/v2.0/token/holders?address=${mint}&page=1&page_size=10`,
            { headers: { token: config().solscanKey! } },
          ),
        );
      holderCount = payload.data.total;
    } catch (e) {
      warnings.push(`Solscan: ${redact(e)}`);
    }
  }
  const indexed = z
    .object({
      content: z.object({
        metadata: z.object({
          name: z.string().optional(),
          symbol: z.string().optional(),
        }),
      }),
    })
    .safeParse(metadata);
  const primary = pairs[0] ?? null;
  const concentration =
    supply > 0n && largest
      ? Number(
          (accounts.reduce((s, a) => s + BigInt(a.amount), 0n) * 1_000_000n) /
            supply,
        ) / 10000
      : null;
  return {
    mint,
    observedAt: new Date().toISOString(),
    slot: mintAccount.context.slot,
    tokenProgram: mintAccount.value.owner,
    metadata,
    name:
      primary?.baseToken.name ??
      (embedded?.success ? embedded.data.state.name : undefined) ??
      (indexed.success ? indexed.data.content.metadata.name : undefined) ??
      null,
    symbol:
      primary?.baseToken.symbol ??
      (embedded?.success ? embedded.data.state.symbol : undefined) ??
      (indexed.success ? indexed.data.content.metadata.symbol : undefined) ??
      null,
    totalSupply: formatUnits(data.supply, data.decimals),
    rawSupply: data.supply,
    decimals: data.decimals,
    circulatingSupply: null,
    mintAuthority: data.mintAuthority,
    freezeAuthority: data.freezeAuthority,
    extensions: data.extensions ?? [],
    priceUsd: primary?.priceUsd ?? null,
    marketCap: primary?.marketCap ?? null,
    fdv: primary?.fdv ?? null,
    liquidityUsd: primary?.liquidity?.usd ?? null,
    volume: primary?.volume ?? null,
    pools: pairs,
    holderCount,
    holders,
    topAccountConcentration: concentration,
    creation: null,
    risks: [
      ...(data.mintAuthority ? ["Mint authority remains enabled"] : []),
      ...(data.freezeAuthority ? ["Freeze authority remains enabled"] : []),
      ...(concentration !== null && concentration >= 50
        ? [
            "Largest token accounts hold at least 50% of supply; pool attribution unavailable",
          ]
        : []),
    ],
    warnings: [
      ...warnings,
      "Circulating supply and exact mint creation are not verified. Pool creation timestamps describe pools, not token creation.",
      "Largest accounts are a sample, not unique holders. LP attribution is unavailable.",
      "Market observations are timestamped at retrieval; upstream market freshness cannot be guaranteed.",
      ...(!holderCount
        ? [
            "Holder count unavailable without a supported Solscan indexer response",
          ]
        : []),
    ],
  };
}
