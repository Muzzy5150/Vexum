import { Router } from "express";
import { existsSync, readFileSync } from "fs";
import path from "path";

const router = Router();
loadLocalEnv();

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
};

type TokenSupplyInfo = {
  amount: bigint;
  decimals: number;
  uiAmountString: string;
};

type TokenHolderInfo = {
  tokenAccount: string;
  owner?: string;
  uiAmountString: string;
  percent: number;
  isLiquidityPool: boolean;
};

const topHolderLimit = 20;

function isSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function rpcEndpoints() {
  return [
    process.env["VEXUM_SOLANA_RPC_URL"],
    process.env["HELIUS_RPC_URL"],
    "https://api.mainnet-beta.solana.com",
  ].filter((endpoint): endpoint is string => Boolean(endpoint));
}

function loadLocalEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), "..", "..", ".env.local"),
  ];

  for (const file of candidates) {
    if (!existsSync(file)) continue;

    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

router.get("/token/scan/:mint", async (req, res) => {
  const mint = String(req.params["mint"] ?? "").trim();

  if (!isSolanaAddress(mint)) {
    return res.status(400).json({ error: "Invalid Solana mint address" });
  }

  try {
    const scan = await scanToken(mint);
    return res.json(scan);
  } catch (error) {
    req.log.error({ err: error, mint }, "Failed to scan token");
    return res.status(500).json({ error: "Failed to scan token" });
  }
});

async function scanToken(mint: string) {
  const errors: string[] = [];
  const [pairs, supply, largestAccounts, solscanHolderCount] = await Promise.all([
    fetchDexPairs(mint, errors),
    fetchSupply(mint, errors),
    fetchLargestAccounts(mint, errors),
    fetchSolscanHolderCount(mint, errors),
  ]);

  const holders = await resolveHolderOwners(largestAccounts, supply, errors);
  const primaryPair = pairs
    .filter(pair => pair.chainId === "solana")
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const top10Percent = holders.reduce((sum, holder) => sum + holder.percent, 0);
  const nonLiquidityHolders = holders.filter(holder => !holder.isLiquidityPool);

  return {
    mint,
    token: {
      name: primaryPair?.baseToken?.name ?? "Unknown token",
      ticker: primaryPair?.baseToken?.symbol ?? "Unknown",
    },
    market: {
      dex: primaryPair?.dexId,
      pair: primaryPair?.pairAddress,
      chart: primaryPair?.url,
      priceUsd: primaryPair?.priceUsd,
      marketCap: primaryPair?.marketCap ?? primaryPair?.fdv,
      fdv: primaryPair?.fdv,
      liquidityUsd: primaryPair?.liquidity?.usd,
      volume24h: primaryPair?.volume?.h24,
      change24h: primaryPair?.priceChange?.h24,
    },
    holders: {
      totalSupply: supply?.uiAmountString,
      holderCount: solscanHolderCount,
      holderCountNote: solscanHolderCount === null
        ? process.env["SOLSCAN_API_KEY"]
          ? "Solscan key is configured, but the holder endpoint did not return a count. See source warnings."
          : "Exact holder count requires an indexed holder API. Solscan will be used when SOLSCAN_API_KEY has holder endpoint access."
        : undefined,
      top10Percent: holders.length > 0 ? Number(top10Percent.toFixed(2)) : null,
      largestHolderPercent: holders[0] ? Number(holders[0].percent.toFixed(2)) : null,
      liquidityPoolPercent: holders[0]?.isLiquidityPool ? Number(holders[0].percent.toFixed(2)) : null,
      largestNonLiquidityHolderPercent: nonLiquidityHolders[0]
        ? Number(nonLiquidityHolders[0].percent.toFixed(2))
        : null,
      top: holders.map((holder, index) => ({
        rank: index + 1,
        owner: holder.owner,
        tokenAccount: holder.tokenAccount,
        amount: holder.uiAmountString,
        percent: Number(holder.percent.toFixed(2)),
        label: holder.isLiquidityPool ? "Liquidity pool" : undefined,
      })),
      importantWallets: holders
        .filter(holder => !holder.isLiquidityPool && holder.percent >= 5)
        .map(holder => ({
          owner: holder.owner,
          tokenAccount: holder.tokenAccount,
          percent: Number(holder.percent.toFixed(2)),
          reason: holder.percent >= 20 ? "high concentration" : holder.percent >= 10 ? "watchlist" : "large holder",
        })),
    },
    sources: {
      market: "DexScreener",
      rpc: describeRpcEndpoint(rpcEndpoints()[0]),
      holders: solscanHolderCount === null ? "Solana RPC largest token accounts" : "Solscan holder count + Solana RPC largest token accounts",
      errors,
    },
  };
}

function describeRpcEndpoint(endpoint: string | undefined) {
  if (!endpoint) return "Unavailable";
  try {
    const url = new URL(endpoint);
    return url.hostname.includes("helius") ? "Helius RPC" : url.hostname;
  } catch {
    return "Configured RPC";
  }
}

async function fetchDexPairs(mint: string, errors: string[]) {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = await response.json() as { pairs?: DexScreenerPair[] };
    return payload.pairs ?? [];
  } catch (error) {
    errors.push(`DexScreener unavailable: ${formatError(error)}`);
    return [];
  }
}

async function fetchSupply(mint: string, errors: string[]) {
  try {
    const payload = await solanaRpc<{ value: { amount: string; decimals: number; uiAmountString?: string } }>(
      "getTokenSupply",
      [mint],
    );
    return {
      amount: BigInt(payload.value.amount),
      decimals: payload.value.decimals,
      uiAmountString: payload.value.uiAmountString ?? formatTokenAmount(payload.value.amount, payload.value.decimals),
    };
  } catch (error) {
    errors.push(`Supply unavailable: ${formatError(error)}`);
    return undefined;
  }
}

async function fetchLargestAccounts(mint: string, errors: string[]) {
  try {
    const payload = await solanaRpc<{
      value: Array<{ address: string; amount: string; uiAmountString?: string; decimals: number }>;
    }>("getTokenLargestAccounts", [mint]);
    return payload.value.slice(0, topHolderLimit);
  } catch (error) {
    errors.push(`Largest accounts unavailable: ${formatError(error)}`);
    return [];
  }
}

async function fetchSolscanHolderCount(mint: string, errors: string[]) {
  const apiKey = process.env["SOLSCAN_API_KEY"];

  if (!apiKey) {
    return null;
  }

  try {
    const url = new URL("https://pro-api.solscan.io/v2.0/token/holders");
    url.searchParams.set("address", mint);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "10");

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        token: apiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);

    const payload = await response.json() as {
      data?: {
        total?: number;
      };
      errors?: {
        message?: string;
      };
    };

    if (payload.errors?.message) {
      throw new Error(payload.errors.message);
    }

    if (typeof payload.data?.total !== "number") {
      throw new Error("Solscan response did not include holder total");
    }

    return payload.data.total;
  } catch (error) {
    errors.push(`Solscan holder count unavailable: ${formatError(error)}`);
    return null;
  }
}

async function resolveHolderOwners(
  accounts: Array<{ address: string; amount: string; uiAmountString?: string; decimals: number }>,
  supply: TokenSupplyInfo | undefined,
  errors: string[],
): Promise<TokenHolderInfo[]> {
  if (accounts.length === 0) return [];

  let owners = new Map<string, string>();

  try {
    const payload = await solanaRpc<{
      value: Array<{ data?: { parsed?: { info?: { owner?: string } } } } | null>;
    }>("getMultipleAccounts", [
      accounts.map(account => account.address),
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);

    owners = new Map(
      payload.value
        .map((account, index) => [accounts[index].address, account?.data?.parsed?.info?.owner])
        .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch (error) {
    errors.push(`Holder owner lookup unavailable: ${formatError(error)}`);
  }

  return accounts.map((account, index) => {
    const amount = BigInt(account.amount);
    const percent = supply && supply.amount > 0n
      ? Number(amount * 10_000n / supply.amount) / 100
      : 0;

    return {
      tokenAccount: account.address,
      owner: owners.get(account.address),
      uiAmountString: account.uiAmountString ?? formatTokenAmount(account.amount, account.decimals),
      percent,
      isLiquidityPool: index === 0,
    };
  });
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const errors: string[] = [];

  for (const endpoint of rpcEndpoints()) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "vexum-api", method, params }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const payload = await response.json() as { result?: T; error?: { message?: string } };
      if (payload.error) throw new Error(payload.error.message ?? "RPC error");
      if (!payload.result) throw new Error("Missing RPC result");
      return payload.result;
    } catch (error) {
      errors.push(`${describeRpcEndpoint(endpoint)}: ${formatError(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function formatTokenAmount(amount: string, decimals: number) {
  const raw = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fractional = raw % divisor;

  if (decimals === 0 || fractional === 0n) return whole.toLocaleString("en-US");

  const fractionalString = fractional.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6);
  return `${whole.toLocaleString("en-US")}.${fractionalString}`;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default router;
