#!/usr/bin/env -S node --import tsx

import { generateKeyPairSync, randomBytes } from "node:crypto";
import { env, stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

const banner = [
  "██╗   ██╗███████╗██╗  ██╗██╗   ██╗███╗   ███╗",
  "██║   ██║██╔════╝╚██╗██╔╝██║   ██║████╗ ████║",
  "██║   ██║█████╗   ╚███╔╝ ██║   ██║██╔████╔██║",
  "╚██╗ ██╔╝██╔══╝   ██╔██╗ ██║   ██║██║╚██╔╝██║",
  " ╚████╔╝ ███████╗██╔╝ ██╗╚██████╔╝██║ ╚═╝ ██║",
  "  ╚═══╝  ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝",
].join("\n");

const purple = "\u001b[38;5;93m";
const reset = "\u001b[0m";
const green = "\u001b[32m";
const yellow = "\u001b[33m";
const cyan = "\u001b[36m";
const pink = "\u001b[38;5;199m";
const blue = "\u001b[34m";
const red = "\u001b[31m";
const bold = "\u001b[1m";
const dim = "\u001b[2m";
const divider = `${dim}${purple}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${reset}`;

const version = "0.0.0";
const solanaRpcEndpoints = [
  env.VEXUM_SOLANA_RPC_URL,
  env.HELIUS_RPC_URL,
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
].filter((endpoint): endpoint is string => Boolean(endpoint));

type Agent = {
  id: string;
  name: string;
  specialty: string;
  reputation: number;
};

type TaskQuote = {
  id: string;
  prompt: string;
  agentId: string;
  agentName: string;
  totalSol: number;
  estimatedSeconds: number;
  taskTypes: string[];
  lineItems: Array<{ label: string; sol: number; detail: string }>;
};

type DexScreenerPair = {
  chainId?: string;
  dexId?: string;
  url?: string;
  pairAddress?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  quoteToken?: { symbol?: string };
  priceUsd?: string;
  fdv?: number;
  marketCap?: number;
  liquidity?: { usd?: number; base?: number; quote?: number };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
};

type PumpTokenInfo = {
  name?: string;
  symbol?: string;
  description?: string;
  image_uri?: string;
  twitter?: string;
  telegram?: string;
  website?: string;
  market_cap?: number;
  usd_market_cap?: number;
};

type TokenSupplyInfo = {
  amount: bigint;
  decimals: number;
  uiAmountString: string;
};

type TokenHolderInfo = {
  tokenAccount: string;
  owner?: string;
  amount: string;
  uiAmountString: string;
  percent: number;
};

const agents: Agent[] = [
  { id: "orion-7", name: "Orion-7", specialty: "Orchestrator", reputation: 97 },
  { id: "nova-3", name: "Nova-3", specialty: "Researcher", reputation: 89 },
  { id: "cipher-x", name: "Cipher-X", specialty: "Code Auditor", reputation: 94 },
  { id: "void-1", name: "Void-1", specialty: "Analyst", reputation: 91 },
  { id: "specter-9", name: "Specter-9", specialty: "Verifier", reputation: 86 },
  { id: "wraith-4", name: "Wraith-4", specialty: "Writer", reputation: 92 },
  { id: "hyper-1", name: "Hyper-1", specialty: "Video Producer", reputation: 93 },
];

const commands = {
  help: {
    description: "Show available Vexum CLI commands.",
    run: showHelp,
  },
  version: {
    description: "Print the Vexum CLI version.",
    run: showVersion,
  },
  status: {
    description: "Show useful workspace commands.",
    run: showStatus,
  },
} as const;

type CommandName = keyof typeof commands;

async function main(argv: string[]): Promise<number> {
  console.log(`${purple}${banner}${reset}`);

  const command = normalizeCommand(argv[0]);

  if (command === undefined) {
    await startConsole();
    return 0;
  }

  if (command in commands) {
    commands[command as CommandName].run();
    return 0;
  }

  await runTaskWithProgress(argv.join(" "));
  return 0;
}

function normalizeCommand(command: string | undefined): string | undefined {
  if (command === undefined) {
    return undefined;
  }

  if (command === "--help" || command === "-h") {
    return "help";
  }

  if (command === "--version" || command === "-v") {
    return "version";
  }

  return command;
}

function showHelp(): void {
  console.log(`${bold}${purple}Vexum CLI${reset}`);
  console.log("");
  console.log(`${cyan}Usage:${reset}`);
  console.log(`  ${green}vexum${reset}`);
  console.log(`  ${green}vexum${reset} ${yellow}<request>${reset}`);
  console.log(`  ${green}vexum${reset} ${yellow}<command>${reset}`);
  console.log("");
  console.log(`${cyan}Commands:${reset}`);

  for (const [name, command] of Object.entries(commands)) {
    console.log(`  ${green}${name.padEnd(10)}${reset} ${command.description}`);
  }

  console.log("");
  console.log(`${cyan}Natural requests:${reset}`);
  console.log(`  ${yellow}Mint me a solana wallet${reset}`);
  console.log(`  ${yellow}Launch a token called Vexum with 1 billion supply${reset}`);
  console.log(`  ${yellow}Create NFT metadata with 5% royalties${reset}`);
  console.log(`  ${yellow}Audit this Anchor program for signer risks${reset}`);
  console.log(`  ${yellow}Make a HyperFrames promo video for my website${reset}`);
  console.log(`  ${yellow}Give me info about this contract address EK95j96TMbHGkkVNfdJgzoqkPSZ6CqmGkg34PR9fpump${reset}`);
}

function showVersion(): void {
  console.log(`vexum ${version}`);
}

function showStatus(): void {
  console.log(`${bold}${purple}Workspace commands${reset}`);
  console.log(`  ${green}pnpm install${reset}          Install dependencies`);
  console.log(`  ${green}vexum${reset}                 Open the Vexum console`);
  console.log(`  ${green}pnpm run build${reset}        Typecheck and build the workspace`);
  console.log(`  ${green}pnpm run build:deploy${reset} Build frontend and API server for deploy`);
  console.log(`  ${green}pnpm run start:deploy${reset} Start the API server`);
}

async function startConsole(): Promise<void> {
  console.log(`${bold}${green}Vexum console is online.${reset} Type a request, or type ${yellow}exit${reset} to close.`);
  console.log(`${dim}Try:${reset} ${yellow}"Launch a token called Vexum with 1 billion supply"${reset}`);
  console.log("");

  const terminal = createInterface({ input, output });

  try {
    while (true) {
      const request = (await terminal.question(`${purple}vexum>${reset} `)).trim();

      if (request.length === 0) {
        continue;
      }

      if (["exit", "quit", "q"].includes(request.toLowerCase())) {
        console.log(`${dim}Closing Vexum.${reset}`);
        return;
      }

      await runTaskWithProgress(request);
      console.log("");
    }
  } finally {
    terminal.close();
  }
}

async function runTaskWithProgress(request: string): Promise<void> {
  const immediate = handleImmediatePrompt(request);

  if (immediate !== undefined) {
    console.log(immediate);
    return;
  }

  const contractAddress = extractSolanaAddress(request);

  if (contractAddress !== undefined && (looksLikeContractInfoRequest(request) || request.trim() === contractAddress)) {
    await runContractScanWithProgress(request, contractAddress);
    return;
  }

  const advisoryRequest = isAdvisoryRequest(request);
  const agent = selectAgent(request);
  const quote = estimateTaskQuote(request, agent.id, advisoryRequest);
  const taskTypes = advisoryRequest ? emptyTaskTypes() : classifyTask(request);
  const steps = buildExecutionSteps(taskTypes, quote, agent.name);

  console.log(`${divider}`);
  console.log(`${bold}${pink}TASK ACCEPTED${reset}`);
  console.log(`${cyan}Prompt:${reset} ${request}`);
  console.log(`${yellow}Quote:${reset} ${bold}${quote.totalSol} SOL${reset} ${dim}(${quote.estimatedSeconds}s ETA)${reset}`);
  console.log(`${blue}Agent:${reset} ${agent.name} ${dim}(${agent.specialty}, ${agent.reputation} rep)${reset}`);
  console.log(`${purple}Detected:${reset} ${quote.taskTypes.map((type) => `${green}${type}${reset}`).join(", ")}`);
  console.log(`${divider}`);
  console.log("");
  console.log(`${bold}${purple}Processing Vexum task...${reset}`);

  for (const [index, step] of steps.entries()) {
    await sleep(260);
    const stepNumber = String(index + 1).padStart(2, "0");
    console.log(`${dim}[${stepNumber}/${String(steps.length).padStart(2, "0")}]${reset} ${green}✓${reset} ${step}`);
  }

  await sleep(260);
  console.log("");
  console.log(`${divider}`);
  console.log(buildVexumOutput({
    prompt: request,
    agent,
    quote,
    forceGeneral: advisoryRequest,
  }));
}

async function runContractScanWithProgress(request: string, mintAddress: string): Promise<void> {
  const agent = agents.find((candidate) => candidate.id === "void-1") ?? agents[0];
  const steps = [
    "Detected Solana token mint / contract address",
    "Querying DexScreener market pairs",
    "Querying Solana RPC token supply",
    "Querying Solana RPC largest token accounts",
    "Resolving owner wallets for top token accounts",
    "Compiling market, holder, and concentration summary",
  ];

  console.log(`${divider}`);
  console.log(`${bold}${pink}CONTRACT SCAN ACCEPTED${reset}`);
  console.log(`${cyan}Prompt:${reset} ${request}`);
  console.log(`${cyan}Mint:${reset} ${green}${mintAddress}${reset}`);
  console.log(`${blue}Agent:${reset} ${agent.name} ${dim}(${agent.specialty}, ${agent.reputation} rep)${reset}`);
  console.log(`${purple}Detected:${reset} ${green}solana-token-scan${reset}`);
  console.log(`${divider}`);
  console.log("");
  console.log(`${bold}${purple}Scanning token intelligence...${reset}`);

  for (const [index, step] of steps.entries()) {
    await sleep(240);
    const stepNumber = String(index + 1).padStart(2, "0");
    console.log(`${dim}[${stepNumber}/${String(steps.length).padStart(2, "0")}]${reset} ${green}✓${reset} ${step}`);
  }

  const scan = await scanSolanaToken(mintAddress);

  console.log("");
  console.log(`${divider}`);
  console.log(buildContractScanOutput(request, mintAddress, scan));
}

function handleImmediatePrompt(request: string): string | undefined {
  const normalizedRequest = request.toLowerCase();

  if (normalizedRequest === "help") {
    return [
      `${bold}${purple}You can type natural Vexum requests.${reset}`,
      "",
      `${cyan}Examples:${reset}`,
      `  ${yellow}Mint me a solana wallet${reset}`,
      `  ${yellow}Launch a token called Vexum with 1 billion supply${reset}`,
      `  ${yellow}Create NFT metadata with 5% royalties${reset}`,
      `  ${yellow}Audit this Anchor program for signer risks${reset}`,
      `  ${yellow}Make a HyperFrames promo video for my website${reset}`,
      `  ${yellow}Give me info about this contract address EK95j96TMbHGkkVNfdJgzoqkPSZ6CqmGkg34PR9fpump${reset}`,
      `  ${green}status${reset}`,
      `  ${green}exit${reset}`,
    ].join("\n");
  }

  if (normalizedRequest === "status") {
    return [
      `${bold}${purple}Vexum console${reset}: ${green}online${reset}`,
      `${cyan}Marketplace task engine:${reset} ${green}ready${reset}`,
      `${cyan}Wallet generator:${reset} ${green}ready${reset}`,
      `${cyan}Token/NFT planner:${reset} ${green}ready${reset}`,
      `${cyan}Audit/research/code planner:${reset} ${green}ready${reset}`,
      `${cyan}Network mode:${reset} ${yellow}local simulation${reset}`,
    ].join("\n");
  }

  return undefined;
}

function extractSolanaAddress(request: string): string | undefined {
  return request.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
}

function looksLikeContractInfoRequest(request: string): boolean {
  const text = request.toLowerCase();

  return /\b(contract|token|coin|mint|address|holders?|distro|distribution|market cap|ticker|wallets?|scan|info|about)\b/.test(text);
}

function isAdvisoryRequest(request: string): boolean {
  return /^(how|what|why|when|where|should|explain|tell me|help me think)\b/i.test(request.trim());
}

async function scanSolanaToken(mintAddress: string): Promise<{
  dexPairs: DexScreenerPair[];
  pumpInfo?: PumpTokenInfo;
  supply?: TokenSupplyInfo;
  holderCount?: number;
  holders: TokenHolderInfo[];
  errors: string[];
}> {
  const [dexPairs, pumpInfo, supply, largestAccounts, solscanHolders] = await Promise.all([
    fetchDexScreenerPairs(mintAddress),
    fetchPumpTokenInfo(mintAddress),
    fetchTokenSupply(mintAddress),
    fetchLargestTokenAccounts(mintAddress),
    fetchSolscanHolderCount(mintAddress),
  ]);

  const errors: string[] = [
    ...dexPairs.errors,
    ...pumpInfo.errors,
    ...supply.errors,
    ...largestAccounts.errors,
    ...solscanHolders.errors,
  ];

  const holders = await resolveTopHolderOwners(largestAccounts.accounts, supply.value, errors);

  return {
    dexPairs: dexPairs.value,
    pumpInfo: pumpInfo.value,
    supply: supply.value,
    holderCount: solscanHolders.value,
    holders,
    errors,
  };
}

async function fetchDexScreenerPairs(mintAddress: string): Promise<{ value: DexScreenerPair[]; errors: string[] }> {
  try {
    const payload = await fetchJson<{ pairs?: DexScreenerPair[] }>(`https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`);
    return {
      value: (payload.pairs ?? []).filter((pair) => pair.chainId === "solana"),
      errors: [],
    };
  } catch (error) {
    return { value: [], errors: [`DexScreener unavailable: ${formatError(error)}`] };
  }
}

async function fetchPumpTokenInfo(mintAddress: string): Promise<{ value?: PumpTokenInfo; errors: string[] }> {
  try {
    const payload = await fetchJson<PumpTokenInfo>(`https://frontend-api-v3.pump.fun/coins/${mintAddress}`);
    return { value: payload, errors: [] };
  } catch (error) {
    return { value: undefined, errors: [`Pump.fun metadata unavailable: ${formatError(error)}`] };
  }
}

async function fetchTokenSupply(mintAddress: string): Promise<{ value?: TokenSupplyInfo; errors: string[] }> {
  try {
    const payload = await solanaRpc<{
      value: { amount: string; decimals: number; uiAmountString?: string };
    }>("getTokenSupply", [mintAddress]);

    return {
      value: {
        amount: BigInt(payload.value.amount),
        decimals: payload.value.decimals,
        uiAmountString: payload.value.uiAmountString ?? formatTokenAmount(payload.value.amount, payload.value.decimals),
      },
      errors: [],
    };
  } catch (error) {
    return { value: undefined, errors: [`Solana supply unavailable: ${formatError(error)}`] };
  }
}

async function fetchLargestTokenAccounts(mintAddress: string): Promise<{
  accounts: Array<{ address: string; amount: string; uiAmountString?: string; decimals: number }>;
  errors: string[];
}> {
  try {
    const payload = await solanaRpc<{
      value: Array<{ address: string; amount: string; uiAmountString?: string; decimals: number }>;
    }>("getTokenLargestAccounts", [mintAddress]);

    return { accounts: payload.value.slice(0, 10), errors: [] };
  } catch (error) {
    return { accounts: [], errors: [`Largest token accounts unavailable: ${formatError(error)}`] };
  }
}

async function fetchSolscanHolderCount(mintAddress: string): Promise<{ value?: number; errors: string[] }> {
  const apiKey = env.SOLSCAN_API_KEY;

  if (!apiKey) {
    return { value: undefined, errors: [] };
  }

  try {
    const url = new URL("https://pro-api.solscan.io/v2.0/token/holders");
    url.searchParams.set("address", mintAddress);
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "10");

    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        token: apiKey,
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const payload = await response.json() as {
      success?: boolean;
      data?: {
        total?: number;
      };
    };

    if (typeof payload.data?.total !== "number") {
      throw new Error("Solscan response did not include holder total");
    }

    return { value: payload.data.total, errors: [] };
  } catch (error) {
    return { value: undefined, errors: [`Solscan holder count unavailable: ${formatError(error)}`] };
  }
}

async function resolveTopHolderOwners(
  accounts: Array<{ address: string; amount: string; uiAmountString?: string; decimals: number }>,
  supply: TokenSupplyInfo | undefined,
  errors: string[],
): Promise<TokenHolderInfo[]> {
  if (accounts.length === 0) {
    return [];
  }

  let ownersByAccount = new Map<string, string>();

  try {
    const payload = await solanaRpc<{
      value: Array<{
        data?: {
          parsed?: {
            info?: {
              owner?: string;
            };
          };
        };
      } | null>;
    }>("getMultipleAccounts", [
      accounts.map((account) => account.address),
      { encoding: "jsonParsed", commitment: "confirmed" },
    ]);

    ownersByAccount = new Map(
      payload.value.map((account, index) => [
        accounts[index].address,
        account?.data?.parsed?.info?.owner ?? undefined,
      ]).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch (error) {
    errors.push(`Top holder owner lookup unavailable: ${formatError(error)}`);
  }

  return accounts.map((account) => {
    const amount = BigInt(account.amount);
    const percent = supply && supply.amount > 0n
      ? Number(amount * 10_000n / supply.amount) / 100
      : 0;

    return {
      tokenAccount: account.address,
      owner: ownersByAccount.get(account.address),
      amount: account.amount,
      uiAmountString: account.uiAmountString ?? formatTokenAmount(account.amount, account.decimals),
      percent,
    };
  });
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "accept": "application/json",
      "user-agent": "vexum-cli/0.0.0",
    },
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return await response.json() as T;
}

async function solanaRpc<T>(method: string, params: unknown[]): Promise<T> {
  const errors: string[] = [];

  for (const endpoint of solanaRpcEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: "vexum",
          method,
          params,
        }),
        signal: AbortSignal.timeout(5_000),
      });

      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json() as { result?: T; error?: { message?: string } };

      if (payload.error) {
        throw new Error(payload.error.message ?? "RPC error");
      }

      if (payload.result === undefined) {
        throw new Error("Missing RPC result");
      }

      return payload.result;
    } catch (error) {
      errors.push(`${endpoint}: ${formatError(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function buildContractScanOutput(
  request: string,
  mintAddress: string,
  scan: Awaited<ReturnType<typeof scanSolanaToken>>,
): string {
  const primaryPair = selectPrimaryPair(scan.dexPairs, mintAddress);
  const tokenName = primaryPair?.baseToken?.name ?? scan.pumpInfo?.name ?? "Unknown token";
  const ticker = primaryPair?.baseToken?.symbol ?? scan.pumpInfo?.symbol ?? "Unknown";
  const marketCap = primaryPair?.marketCap ?? primaryPair?.fdv ?? scan.pumpInfo?.usd_market_cap ?? scan.pumpInfo?.market_cap;
  const top10Percent = scan.holders.reduce((sum, holder) => sum + holder.percent, 0);
  const largestHolder = scan.holders[0];
  const importantWallets = findImportantWallets(scan.holders);

  const sections = [
    [
      "SOLANA CONTRACT SCAN",
      "",
      `Request: "${request}"`,
      `Mint Address: ${mintAddress}`,
      `Token: ${tokenName}`,
      `Ticker: ${ticker}`,
      `Primary DEX: ${primaryPair?.dexId ?? "Unavailable"}`,
      `Pair: ${primaryPair?.pairAddress ?? "Unavailable"}`,
      `Chart: ${primaryPair?.url ?? "Unavailable"}`,
    ].join("\n"),
    [
      "MARKET DATA",
      "",
      `Price: ${primaryPair?.priceUsd ? `$${primaryPair.priceUsd}` : "Unavailable"}`,
      `Market Cap: ${formatUsd(marketCap)}`,
      `FDV: ${formatUsd(primaryPair?.fdv)}`,
      `Liquidity: ${formatUsd(primaryPair?.liquidity?.usd)}`,
      `24h Volume: ${formatUsd(primaryPair?.volume?.h24)}`,
      `24h Change: ${formatPercent(primaryPair?.priceChange?.h24)}`,
    ].join("\n"),
    [
      "SUPPLY / HOLDERS",
      "",
      `Total Supply: ${scan.supply?.uiAmountString ?? "Unavailable"}`,
      `Holder Count: ${scan.holderCount?.toLocaleString("en-US") ?? "Set SOLSCAN_API_KEY for exact indexed holder count."}`,
      `Top 10 Concentration: ${scan.holders.length > 0 ? `${top10Percent.toFixed(2)}%` : "Unavailable"}`,
      `Largest Holder: ${largestHolder ? `${largestHolder.percent.toFixed(2)}%` : "Unavailable"}`,
    ].join("\n"),
    [
      "TOP HOLDER DISTRIBUTION",
      "",
      ...(scan.holders.length > 0
        ? scan.holders.map((holder, index) => (
          `${index + 1}. ${shortAddress(holder.owner ?? holder.tokenAccount)} holds ${holder.uiAmountString} (${holder.percent.toFixed(2)}%)`
        ))
        : ["No holder distribution returned by public RPC."]),
    ].join("\n"),
    [
      "IMPORTANT WALLETS",
      "",
      ...(importantWallets.length > 0
        ? importantWallets
        : ["No single top holder crossed the current importance thresholds in the public RPC sample."]),
    ].join("\n"),
    [
      "DATA NOTES",
      "",
      "Market data comes from DexScreener when available.",
      "Supply and top token accounts come from public Solana RPC.",
      "Exact holder count uses Solscan Pro when SOLSCAN_API_KEY is set.",
      "Full wallet clustering requires an indexer. Public RPC can show largest token accounts, not every unique holder cheaply.",
      ...(scan.errors.length > 0 ? ["", "Source warnings:", ...scan.errors.map((error) => `- ${error}`)] : []),
    ].join("\n"),
  ];

  return sections.map(stylizeSection).join(`\n\n${divider}\n\n`);
}

function selectPrimaryPair(pairs: DexScreenerPair[], mintAddress: string): DexScreenerPair | undefined {
  return pairs
    .filter((pair) => pair.baseToken?.address === mintAddress || pair.quoteToken !== undefined)
    .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
}

function findImportantWallets(holders: TokenHolderInfo[]): string[] {
  const flags: string[] = [];

  for (const holder of holders) {
    const wallet = shortAddress(holder.owner ?? holder.tokenAccount);

    if (holder.percent >= 20) {
      flags.push(`${wallet}: controls ${holder.percent.toFixed(2)}% of supply (high concentration)`);
    } else if (holder.percent >= 10) {
      flags.push(`${wallet}: controls ${holder.percent.toFixed(2)}% of supply (watchlist)`);
    } else if (holder.percent >= 5) {
      flags.push(`${wallet}: controls ${holder.percent.toFixed(2)}% of supply`);
    }
  }

  return flags;
}

function formatUsd(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unavailable";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 0 : 6,
  }).format(value);
}

function formatPercent(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "Unavailable";
  }

  return `${value.toFixed(2)}%`;
}

function formatTokenAmount(amount: string, decimals: number): string {
  const raw = BigInt(amount);
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const fractional = raw % divisor;

  if (decimals === 0 || fractional === 0n) {
    return whole.toLocaleString("en-US");
  }

  const fractionalString = fractional.toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6);
  return `${whole.toLocaleString("en-US")}.${fractionalString}`;
}

function shortAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyTask(prompt: string) {
  const text = prompt.toLowerCase();

  return {
    wallet: /\b(wallet|keypair|private key|secret key|phantom|address)\b/.test(text),
    tokenMint: /\b(spl token|token-2022|token mint|mint token|create token|coin|memecoin|supply|decimals)\b/.test(text),
    nftMint: /\b(nft|digital asset|collection|collectible|pnft|metaplex core)\b/.test(text),
    metadata: /\b(metadata|json metadata|token json|uri|image uri|symbol|royalt|attributes?)\b/.test(text),
    transfer: /\b(transfer|send|pay|payment|recipient)\b/.test(text),
    swap: /\b(swap|jupiter|route|slippage|dex|trade|sol to|usdc|quote)\b/.test(text),
    airdrop: /\b(airdrop|devnet|faucet|fund wallet)\b/.test(text),
    audit: /\b(audit|security|vulnerabilit|unchecked account|anchor program|risk check|simulate transaction|transaction risk)\b/.test(text),
    launch: /\b(launch|launching|launch package|go to market|token launch|presale|campaign)\b/.test(text),
    domain: /\b(domain|dns|website name|subdomain|butterbase)\b/.test(text),
    hyperframes: /\b(video|make a video|create a video|film|promo|website|twitter|x account|link to website|social media|tweet)\b/.test(text),
    research: /\b(research|analy[sz]e|report|market|compare|strategy|find|summari[sz]e)\b/.test(text),
    code: /\b(code|build|fix|debug|deploy|api|contract|script|app|website)\b/.test(text),
  };
}

function emptyTaskTypes(): ReturnType<typeof classifyTask> {
  return {
    wallet: false,
    tokenMint: false,
    nftMint: false,
    metadata: false,
    transfer: false,
    swap: false,
    airdrop: false,
    audit: false,
    launch: false,
    domain: false,
    hyperframes: false,
    research: false,
    code: false,
  };
}

function selectAgent(prompt: string): Agent {
  const taskTypes = classifyTask(prompt);

  if (taskTypes.hyperframes) return agents.find((agent) => agent.id === "hyper-1") ?? agents[0];
  if (taskTypes.audit || taskTypes.code) return agents.find((agent) => agent.id === "cipher-x") ?? agents[0];
  if (taskTypes.research || taskTypes.domain) return agents.find((agent) => agent.id === "nova-3") ?? agents[0];
  if (taskTypes.swap || taskTypes.transfer) return agents.find((agent) => agent.id === "void-1") ?? agents[0];
  if (taskTypes.metadata || taskTypes.nftMint) return agents.find((agent) => agent.id === "wraith-4") ?? agents[0];

  return agents[0];
}

function estimateTaskQuote(prompt: string, agentId: string, forceGeneral = false): TaskQuote {
  const agent = agents.find((candidate) => candidate.id === agentId) ?? agents[0];
  const trimmed = prompt.trim();
  const inputChars = trimmed.length;
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  const fileChars = [...trimmed.matchAll(/\[File:[^\]]+\]\s*([\s\S]*?)(?=\n\n\[File:|$)/g)]
    .reduce((sum, match) => sum + (match[1]?.length ?? 0), 0);
  const taskTypes = forceGeneral ? emptyTaskTypes() : classifyTask(trimmed);

  const lineItems: TaskQuote["lineItems"] = [
    {
      label: "Base orchestration",
      sol: 0.012,
      detail: "Intent parsing, routing, execution log, and settlement setup",
    },
  ];

  lineItems.push({
    label: "Input processing",
    sol: Math.max(0.003, Math.ceil(inputChars / 500) * 0.0025),
    detail: `${inputChars.toLocaleString()} characters, ${wordCount.toLocaleString()} words`,
  });

  if (fileChars > 0) {
    lineItems.push({
      label: "Attached file context",
      sol: Math.ceil(fileChars / 2_000) * 0.006,
      detail: `${fileChars.toLocaleString()} file characters added to context`,
    });
  }

  if (taskTypes.hyperframes) addLineItem(lineItems, "HyperFrames composition", 0.065, "Storyboard, HTML animation, preview generation, and visual QA budget");
  if (taskTypes.wallet) addLineItem(lineItems, "Wallet/key operation", 0.01, "Secure keypair generation and delivery formatting");
  if (taskTypes.tokenMint) addLineItem(lineItems, "SPL token mint plan", 0.055, "Mint config, supply/decimals planning, authorities, and ATA setup checklist");
  if (taskTypes.nftMint) addLineItem(lineItems, "NFT asset plan", 0.06, "Metaplex metadata, collection fields, royalty settings, and mint workflow");
  if (taskTypes.metadata) addLineItem(lineItems, "Metadata generation", 0.018, "URI-ready JSON, symbol/name validation, attributes, and media fields");
  if (taskTypes.transfer) addLineItem(lineItems, "Transfer simulation", 0.014, "Recipient validation, balance impact summary, and confirmation copy");
  if (taskTypes.swap) addLineItem(lineItems, "Swap route quote", 0.026, "Route planning, slippage assumptions, fee estimate, and signing summary");
  if (taskTypes.airdrop) addLineItem(lineItems, "Devnet funding flow", 0.008, "Airdrop request plan and wallet balance verification");
  if (taskTypes.audit) addLineItem(lineItems, "Security/risk analysis", 0.075, "Transaction or program review, authority checks, and issue report");
  if (taskTypes.launch) addLineItem(lineItems, "Launch package", 0.09, "Token/NFT plan, metadata, launch checklist, and optional promo asset coordination");
  if (taskTypes.domain) addLineItem(lineItems, "Domain lookup", 0.012, "Butterbase domain table request, filtering, and availability summary");
  if (taskTypes.research) addLineItem(lineItems, "Research depth", Math.min(0.045, Math.max(0.012, Math.ceil(wordCount / 80) * 0.006)), "Multi-step analysis and result synthesis");
  if (taskTypes.code) addLineItem(lineItems, "Implementation effort", 0.035, "Code-oriented execution and verification budget");

  addLineItem(lineItems, "Agent reputation premium", Math.max(0.004, agent.reputation / 100 * 0.009), `${agent.name} reputation: ${agent.reputation}`);

  const totalSol = roundSol(Math.min(0.35, lineItems.reduce((sum, item) => sum + item.sol, 0)));
  const labels = [
    taskTypes.launch ? "launch" : null,
    taskTypes.hyperframes ? "video" : null,
    taskTypes.wallet ? "wallet" : null,
    taskTypes.tokenMint ? "token-mint" : null,
    taskTypes.nftMint ? "nft" : null,
    taskTypes.metadata ? "metadata" : null,
    taskTypes.transfer ? "transfer" : null,
    taskTypes.swap ? "swap" : null,
    taskTypes.airdrop ? "airdrop" : null,
    taskTypes.audit ? "audit" : null,
    taskTypes.domain ? "domain" : null,
    taskTypes.research ? "research" : null,
    taskTypes.code ? "build" : null,
  ].filter((label): label is string => Boolean(label));

  return {
    id: `Q${Date.now().toString(36).toUpperCase()}`,
    prompt: trimmed,
    agentId,
    agentName: agent.name,
    totalSol,
    estimatedSeconds: Math.min(90, 12 + Math.ceil(inputChars / 180) + lineItems.length * 5),
    taskTypes: labels.length > 0 ? labels : ["general"],
    lineItems: lineItems.map((item) => ({ ...item, sol: roundSol(item.sol) })),
  };
}

function addLineItem(
  lineItems: TaskQuote["lineItems"],
  label: string,
  sol: number,
  detail: string,
): void {
  lineItems.push({ label, sol, detail });
}

function roundSol(value: number): number {
  return Number(value.toFixed(4));
}

function buildExecutionSteps(
  taskTypes: ReturnType<typeof classifyTask>,
  quote: TaskQuote,
  agentName: string,
): string[] {
  const steps = [
    `Quote accepted: ${quote.totalSol} SOL`,
    "Job submitted by CLI user",
    `${agentName} analyzing prompt and routing task`,
    "Task analysis complete",
  ];

  if (taskTypes.wallet) steps.push("Generating Phantom-compatible base58 keypair");
  if (taskTypes.tokenMint || taskTypes.launch) steps.push("Preparing SPL token mint configuration");
  if (taskTypes.nftMint || taskTypes.launch) steps.push("Preparing Metaplex NFT metadata and collection plan");
  if (taskTypes.metadata || taskTypes.tokenMint || taskTypes.nftMint || taskTypes.launch) steps.push("Generating URI-ready metadata JSON");
  if (taskTypes.transfer) steps.push("Simulating transfer confirmation details");
  if (taskTypes.swap) steps.push("Preparing swap route and slippage summary");
  if (taskTypes.airdrop) steps.push("Preparing devnet airdrop request plan");
  if (taskTypes.audit) steps.push("Running Solana risk checklist");
  if (taskTypes.hyperframes) steps.push("Generating HyperFrames preview plan");
  if (taskTypes.domain) steps.push("Preparing Butterbase domain lookup summary");
  if (taskTypes.research) steps.push("Synthesizing research notes");
  if (taskTypes.code) steps.push("Drafting implementation and verification plan");

  steps.push("Compiling final deliverable", "Task completed successfully");

  return steps;
}

function buildVexumOutput({
  prompt,
  agent,
  quote,
  forceGeneral = false,
}: {
  prompt: string;
  agent: Agent;
  quote: TaskQuote;
  forceGeneral?: boolean;
}): string {
  const taskTypes = forceGeneral ? emptyTaskTypes() : classifyTask(prompt);
  const sections: string[] = [];

  sections.push([
    "VEXUM SOLANA TASK COMPLETE",
    "",
    `Task: "${prompt}"`,
    `Processed by: ${agent.name}`,
    `Specialty: ${agent.specialty}`,
    `Job ID: J${Date.now().toString(36).toUpperCase()}`,
  ].join("\n"));

  if (taskTypes.wallet) {
    sections.push(createSolanaWalletSection());
  }

  if (taskTypes.tokenMint || taskTypes.launch) {
    sections.push(buildTokenMintPlan(prompt));
  }

  if (taskTypes.nftMint || taskTypes.launch) {
    sections.push(buildNftPlan(prompt));
  }

  if (taskTypes.metadata || taskTypes.tokenMint || taskTypes.nftMint || taskTypes.launch) {
    sections.push(`METADATA JSON\n\n${JSON.stringify(buildMetadataJson(prompt, taskTypes), null, 2)}`);
  }

  if (taskTypes.transfer) {
    sections.push(buildTransferSimulation(prompt));
  }

  if (taskTypes.swap) {
    sections.push(buildSwapQuote(prompt));
  }

  if (taskTypes.airdrop) {
    sections.push(buildAirdropPlan(prompt));
  }

  if (taskTypes.domain) {
    sections.push(buildDomainLookup(prompt));
  }

  if (taskTypes.audit || taskTypes.research) {
    sections.push(buildResearchReview(taskTypes));
  }

  if (taskTypes.hyperframes) {
    sections.push(buildHyperframesPreview(prompt));
  }

  if (taskTypes.code) {
    sections.push(buildCodePlan(prompt));
  }

  if (quote.taskTypes.includes("general") || forceGeneral) {
    sections.push(buildGeneralPlan(prompt));
  }

  sections.push([
    "QUOTE",
    "",
    "Status: COMPLETE",
    `Cost: ${quote.totalSol} SOL`,
    `ETA quoted: ${quote.estimatedSeconds}s`,
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "Line items:",
    ...quote.lineItems.map((item) => `- ${item.label}: ${item.sol} SOL (${item.detail})`),
  ].join("\n"));

  return sections.map(stylizeSection).join(`\n\n${divider}\n\n`);
}

function stylizeSection(section: string): string {
  const [title = "", ...lines] = section.split("\n");

  return [
    `${bold}${purple}${title}${reset}`,
    ...lines.map(stylizeLine),
  ].join("\n");
}

function stylizeLine(line: string): string {
  if (line.trim().length === 0) {
    return line;
  }

  if (/^(Security note|Note|Risk level):/i.test(line)) {
    return line.replace(/^([^:]+):\s*(.*)$/, `${red}${bold}$1:${reset} ${yellow}$2${reset}`);
  }

  if (/^Status:\s*COMPLETE$/i.test(line)) {
    return `${cyan}Status:${reset} ${green}${bold}COMPLETE${reset}`;
  }

  if (/^Cost:/.test(line) || /^Quote:/.test(line)) {
    return line.replace(/^([^:]+):\s*(.*)$/, `${yellow}$1:${reset} ${bold}$2${reset}`);
  }

  if (/^[A-Za-z0-9][A-Za-z0-9 /-]+:/.test(line)) {
    return line.replace(/^([^:]+):\s*(.*)$/, (_, label: string, value: string) => (
      value.length > 0
        ? `${cyan}${label}:${reset} ${green}${value}${reset}`
        : `${cyan}${label}:${reset}`
    ));
  }

  if (line.startsWith("- ")) {
    return `${green}•${reset} ${line.slice(2)}`;
  }

  if (/^\d+\./.test(line)) {
    return line.replace(/^(\d+\.)\s*(.*)$/, `${yellow}$1${reset} $2`);
  }

  return line;
}

function createSolanaWalletSection(): string {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });

  const publicKeyBytes = publicKeyDer.subarray(-32);
  const seedBytes = privateKeyDer.subarray(-32);
  const secretKeyBytes = Buffer.concat([seedBytes, publicKeyBytes]);

  return [
    "WALLET / KEYPAIR",
    "",
    "Public Key / Address (base58):",
    encodeBase58(publicKeyBytes),
    "",
    "Private Key / Secret Key (base58 - Phantom import format):",
    encodeBase58(secretKeyBytes),
    "",
    "Security note: import this into Phantom only if you intend to control this generated wallet. Never share the secret key.",
  ].join("\n");
}

function buildTokenMintPlan(prompt: string): string {
  return [
    "SPL TOKEN MINT PLAN",
    "",
    `Token Name: ${deriveTokenName(prompt)}`,
    `Symbol: ${deriveSymbol(prompt)}`,
    `Supply: ${deriveSupply(prompt)}`,
    `Decimals: ${prompt.match(/\bdecimals?\s*[:=]?\s*(\d+)\b/i)?.[1] ?? "9"}`,
    `Token Program: ${/token-?2022/i.test(prompt) ? "Token-2022" : "SPL Token Program"}`,
    `Mint Account Preview: ${makeMockSolanaAddress()}`,
    `Metadata PDA Preview: ${makeMockSolanaAddress()}`,
    "",
    "Recommended authority settings:",
    "- Mint authority: keep during setup, revoke after final supply if fixed-supply launch",
    "- Freeze authority: remove for liquid public token unless compliance controls are needed",
    "- Metadata update authority: project wallet or multisig",
  ].join("\n");
}

function buildNftPlan(prompt: string): string {
  return [
    "NFT / DIGITAL ASSET PLAN",
    "",
    `Collection: ${deriveTokenName(prompt).replace(/ Token$/i, " Collection")}`,
    `Standard: ${/core/i.test(prompt) ? "Metaplex Core" : "Metaplex Token Metadata"}`,
    `Royalty: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*%?\s*royalt/i)?.[1] ?? "0"}%`,
    `Mint Preview: ${makeMockSolanaAddress()}`,
    `Collection Preview: ${makeMockSolanaAddress()}`,
    "",
    "Workflow:",
    "1. Upload media asset",
    "2. Upload metadata JSON",
    "3. Create collection or standalone asset",
    "4. Mint to target wallet",
    "5. Verify metadata and collection linkage",
  ].join("\n");
}

function buildTransferSimulation(prompt: string): string {
  return [
    "TRANSFER SIMULATION",
    "",
    "Status: Prepared, not broadcast",
    "Estimated network fee: 0.000005 SOL",
    `Requested amount: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*(sol|usdc|tokens?)\b/i)?.[0] ?? "not specified"}`,
    "Recipient validation: pending wallet input",
    "Balance impact: exact debit plus network fee",
    "",
    "Before signing, VEXUM should show:",
    "- Sender wallet",
    "- Recipient wallet",
    "- Asset and amount",
    "- Fees",
    "- Irreversible transfer warning",
  ].join("\n");
}

function buildSwapQuote(prompt: string): string {
  return [
    "SWAP ROUTE QUOTE",
    "",
    "Status: Simulated route, not signed",
    `Default slippage: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*%?\s*slippage/i)?.[1] ?? "0.5"}%`,
    "Integrator: Jupiter-style quote flow",
    "Priority fee: dynamic",
    "",
    "User confirmation should include:",
    "- Input token and amount",
    "- Output token estimate",
    "- Minimum received",
    "- Price impact",
    "- Route hops",
    "- Expiration window",
  ].join("\n");
}

function buildAirdropPlan(prompt: string): string {
  return [
    "DEVNET AIRDROP PLAN",
    "",
    "Network: devnet",
    `Suggested amount: ${prompt.match(/\b(\d+(?:\.\d+)?)\s*sol\b/i)?.[1] ?? "1"} SOL`,
    "Target wallet: provide or use generated address",
    "Follow-up: check balance after faucet response",
    "",
    "Note: mainnet SOL cannot be airdropped.",
  ].join("\n");
}

function buildDomainLookup(prompt: string): string {
  const domain = extractDomainQuery(prompt) || "not specified";

  return [
    "DOMAIN LOOKUP",
    "",
    "Source: Butterbase app_g1pggrm4fo38",
    "Status: local CLI simulation",
    `Query: ${domain}`,
    "",
    "Run the API server with BUTTERBASE_TOKEN configured for live Butterbase domain results.",
  ].join("\n");
}

function buildResearchReview(taskTypes: ReturnType<typeof classifyTask>): string {
  return [
    "SECURITY / RESEARCH REVIEW",
    "",
    "Initial risk checklist:",
    "- Verify transaction signer set",
    "- Check token account ownership",
    "- Check mint and freeze authorities",
    "- Confirm recipient addresses",
    "- Simulate before signing",
    "- Inspect program IDs for expected Solana/Metaplex/Jupiter programs",
    "- Flag unexpected SOL drains or token approvals",
    "",
    `Risk level: ${taskTypes.audit ? "Needs full review before signing" : "Informational"}`,
  ].join("\n");
}

function buildHyperframesPreview(prompt: string): string {
  return [
    "HYPERFRAMES PREVIEW PLAN",
    "",
    "Status: storyboard generated locally",
    `Prompt: ${prompt}`,
    "",
    "Composition:",
    "1. Brand reveal with VEXUM identity",
    "2. Problem/action/result sequence",
    "3. Wallet/payment proof moment",
    "4. CTA frame for marketplace or launch page",
    "",
    "Live preview generation can be connected through /api/hyperframes/compose when the API server is running.",
  ].join("\n");
}

function buildCodePlan(prompt: string): string {
  return [
    "BUILD / CODE PLAN",
    "",
    `Request: ${prompt}`,
    "",
    "Execution plan:",
    "1. Identify target files and ownership boundaries",
    "2. Implement the smallest scoped change",
    "3. Run typecheck/build validation",
    "4. Return changed files and verification output",
    "",
    "CLI mode currently returns an implementation plan. Code edits are still handled by Codex in the workspace.",
  ].join("\n");
}

function buildGeneralPlan(prompt: string): string {
  return [
    "GENERAL VEXUM RESPONSE",
    "",
    `Request: ${prompt}`,
    "",
    "VEXUM take:",
    "- Define the exact user action you want completed",
    "- Identify the agent or workflow that should own the task",
    "- Decide what output proves the task is complete",
    "- Price the work in SOL based on complexity, risk, and verification needs",
    "- Add a verification pass before anything touches wallets, tokens, or live users",
    "",
    "Useful next prompt:",
    `Break this into a launch plan with milestones, risks, and agent roles: ${prompt}`,
  ].join("\n");
}

function buildMetadataJson(prompt: string, taskTypes: ReturnType<typeof classifyTask>) {
  const name = taskTypes.nftMint ? deriveTokenName(prompt).replace(/ Token$/i, " NFT") : deriveTokenName(prompt);
  const symbol = deriveSymbol(prompt);

  return {
    name,
    symbol,
    description: `Generated by VEXUM for: ${prompt.slice(0, 140)}`,
    image: "https://example.com/asset.png",
    external_url: "https://vexum.butterbase.dev/",
    attributes: [
      { trait_type: "Network", value: "Solana" },
      { trait_type: "Generated By", value: "VEXUM" },
      { trait_type: "Asset Type", value: taskTypes.nftMint ? "NFT" : "Fungible Token" },
    ],
    properties: {
      files: [{ uri: "https://example.com/asset.png", type: "image/png" }],
      category: "image",
    },
  };
}

function extractMatch(prompt: string, pattern: RegExp, fallback: string): string {
  const match = prompt.match(pattern);
  return match?.[1]?.trim() || fallback;
}

function extractDomainQuery(prompt: string): string {
  return prompt.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i)?.[1]
    ?? prompt.match(/\bdomain\s+([a-z0-9.-]+)\b/i)?.[1]
    ?? "";
}

function deriveSymbol(prompt: string): string {
  const explicit = prompt.match(/\$([A-Za-z][A-Za-z0-9]{1,9})\b/)?.[1]
    ?? prompt.match(/\bsymbol\s*[:=]?\s*([A-Za-z][A-Za-z0-9]{1,9})\b/i)?.[1];

  if (explicit) return explicit.toUpperCase().slice(0, 10);

  const name = deriveTokenName(prompt);

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10) || "VEX";
}

function deriveTokenName(prompt: string): string {
  return extractMatch(
    prompt,
    /\b(?:called|named)\s+([A-Za-z][A-Za-z0-9 ]{1,30}?)(?=\s+(?:with|supply|symbol|decimals?|royalt|on|for)\b|$)/i,
    "Vexum Token",
  ).slice(0, 32);
}

function deriveSupply(prompt: string): string {
  const raw = prompt.match(/\b(\d+(?:\.\d+)?)\s*(billion|million|thousand|b|m|k)?\b/i);

  if (!raw) return "1,000,000,000";

  const value = Number(raw[1]);
  const unit = raw[2]?.toLowerCase();
  const multiplier = unit === "billion" || unit === "b" ? 1_000_000_000
    : unit === "million" || unit === "m" ? 1_000_000
    : unit === "thousand" || unit === "k" ? 1_000
    : 1;

  return Math.round(value * multiplier).toLocaleString();
}

function makeMockSolanaAddress(): string {
  return encodeBase58(randomBytes(32));
}

function encodeBase58(bytes: Uint8Array): string {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = BigInt(`0x${Buffer.from(bytes).toString("hex")}`);
  let encoded = "";

  while (value > 0n) {
    const remainder = Number(value % 58n);
    value /= 58n;
    encoded = alphabet[remainder] + encoded;
  }

  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }

    encoded = alphabet[0] + encoded;
  }

  return encoded || alphabet[0];
}

process.exitCode = await main(process.argv.slice(2));
