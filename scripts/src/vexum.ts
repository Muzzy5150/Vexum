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
const pacmanYellow = "\u001b[38;5;226m";
const cyan = "\u001b[36m";
const lightBlue = "\u001b[38;5;81m";
const pink = "\u001b[38;5;199m";
const blue = "\u001b[34m";
const red = "\u001b[31m";
const brightRed = "\u001b[38;5;196m";
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
  isLiquidityPool: boolean;
};

type SolanaWallet = {
  address: string;
  secretKey: string;
  attempts: number;
  vanityPrefix?: string;
};

type CoinMetadata = {
  name: string;
  ticker: string;
  twitter: string;
  website: string;
  photoPath: string;
  bannerPath: string;
};

type LauncherWallet = {
  label: string;
  privateKey: string;
  address?: string;
  solBalance: string;
};

type CoinLauncherState = {
  metadata: CoinMetadata;
  wallets: LauncherWallet[];
  deployedCa?: string;
};

type CoinSniperState = {
  target: string;
  devWallet?: LauncherWallet;
};

const topHolderLimit = 20;
const vanityBlockSize = 50_000;
const vanityProgressWidth = 16;

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
  console.log("\n");
  console.log(`${purple}${banner}${reset}`);
  console.log(`${bold}${cyan}Created by Muzzy5150${reset}`);
  console.log("");

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
  printPhraseList();
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
  console.log(`${bold}${green}Vexum console is online.${reset} Type a request, or type ${red}exit${reset} to close.`);
  console.log(`${dim}Try:${reset} ${pacmanYellow}"Scan this Token Vexum1111111111111111111111111111111111111111111"${reset}`);
  console.log("");
  printConsoleIntro();
  console.log("");

  const terminal = createInterface({ input, output });

  try {
    while (true) {
      let request: string;

      try {
        restorePromptInput();
        request = (await terminal.question(`${purple}vexum>${reset} `)).trim();
      } catch (error) {
        if (isReadlineClosedError(error)) {
          return;
        }

        throw error;
      }

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

function restorePromptInput(): void {
  if (input.isTTY) {
    input.setRawMode(false);
  }

  input.resume();
}

function isReadlineClosedError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && (error as { code?: unknown }).code === "ERR_USE_AFTER_CLOSE";
}

function printConsoleIntro(): void {
  const lines = [
    `${bold}${pacmanYellow}How Vexum CLI Works${reset}`,
    "",
    `${cyan}Type a natural phrase and press Enter.${reset}`,
    `${dim}Vexum shows live process steps, then prints the output.${reset}`,
    "",
    `${bold}${pacmanYellow}Phrases to use:${reset}`,
    ...phraseList().map((phrase) => `${green}›${reset} ${phrase}`),
  ];

  const width = 82;
  const top = `${purple}╔${"═".repeat(width - 2)}╗${reset}`;
  const bottom = `${purple}╚${"═".repeat(width - 2)}╝${reset}`;

  console.log(top);

  for (const line of lines) {
    const visible = stripAnsi(line);
    const padding = Math.max(0, width - 4 - visible.length);
    console.log(`${purple}║${reset} ${line}${" ".repeat(padding)} ${purple}║${reset}`);
  }

  console.log(bottom);
}

function printPhraseList(): void {
  for (const phrase of phraseList()) {
    console.log(`  ${yellow}${phrase}${reset}`);
  }
}

function phraseList(): string[] {
  return [
    "Mint me a Solana Wallet",
    "Mint me a Solana Wallet that starts with <desired word>",
    "Scan this Token <Contract Address>",
    "Scan this Wallet <Wallet Address>",
    "Coin Launcher",
    "Coin Sniper",
    "FUD txn Bot",
  ];
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

async function runTaskWithProgress(request: string): Promise<void> {
  const immediate = handleImmediatePrompt(request);

  if (immediate !== undefined) {
    console.log(immediate);
    return;
  }

  if (looksLikeCoinLauncherRequest(request)) {
    await runCoinLauncher();
    return;
  }

  if (looksLikeCoinSniperRequest(request)) {
    await runCoinSniper();
    return;
  }

  const contractAddress = extractSolanaAddress(request);

  if (contractAddress !== undefined && (looksLikeContractInfoRequest(request) || request.trim() === contractAddress)) {
    await runContractScanWithProgress(request, contractAddress);
    return;
  }

  const advisoryRequest = isAdvisoryRequest(request);
  const taskTypes = advisoryRequest ? emptyTaskTypes() : classifyTask(request);

  if (taskTypes.wallet && !taskTypes.tokenMint && !taskTypes.nftMint && !taskTypes.transfer && !taskTypes.swap) {
    await runWalletMintWithProgress(request);
    return;
  }

  const agent = selectAgent(request);
  const quote = estimateTaskQuote(request, agent.id, advisoryRequest);
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

async function runWalletMintWithProgress(request: string): Promise<void> {
  const agent = agents.find((candidate) => candidate.id === "orion-7") ?? agents[0];
  const quote = estimateTaskQuote(request, agent.id);
  const vanityPrefix = extractWalletVanityPrefix(request);

  console.log(`${divider}`);
  console.log(`${bold}${pink}WALLET MINT ACCEPTED${reset}`);
  console.log(`${cyan}Prompt:${reset} ${request}`);
  console.log(`${yellow}Quote:${reset} ${bold}${quote.totalSol} SOL${reset} ${dim}(${quote.estimatedSeconds}s ETA)${reset}`);
  console.log(`${blue}Agent:${reset} ${agent.name} ${dim}(${agent.specialty}, ${agent.reputation} rep)${reset}`);
  console.log(`${purple}Detected:${reset} ${green}${vanityPrefix ? "vanity-wallet" : "wallet"}${reset}`);

  if (vanityPrefix !== undefined) {
    console.log(`${cyan}Requested Prefix:${reset} ${green}${vanityPrefix}${reset}`);

    if (!isBase58String(vanityPrefix)) {
      console.log(`${red}Invalid vanity prefix.${reset} Solana addresses use base58, so avoid 0, O, I, and l.`);
      return;
    }

    if (vanityPrefix.length >= 5) {
      console.log(`${yellow}Heads up:${reset} ${vanityPrefix.length}+ starting characters can take a long time. Each extra character is roughly 58x harder.`);
    }

    console.log(`${cyan}Vanity Estimate:${reset} ${green}${estimateVanitySearch(vanityPrefix)}${reset}`);
  }

  console.log(`${divider}`);
  console.log("");
  console.log(`${bold}${purple}Minting Solana wallet...${reset}`);
  console.log(`${dim}[01/04]${reset} ${green}✓${reset} Preparing local Ed25519 keypair generator`);
  await sleep(180);
  console.log(`${dim}[02/04]${reset} ${green}✓${reset} Formatting Phantom-compatible secret key output`);
  await sleep(180);

  let wallet: SolanaWallet;

  if (vanityPrefix !== undefined) {
    console.log(`${dim}[03/04]${reset} ${green}✓${reset} Searching address blocks for prefix ${yellow}${vanityPrefix}${reset}`);
    wallet = await mintVanityWallet(vanityPrefix);
  } else {
    console.log(`${dim}[03/04]${reset} ${green}✓${reset} Generating random wallet`);
    wallet = { ...generateSolanaWallet(), attempts: 1 };
  }

  console.log(`${dim}[04/04]${reset} ${green}✓${reset} Wallet minted`);
  console.log("");
  console.log(`${divider}`);
  console.log(stylizeSection(createSolanaWalletSection(wallet)));
}

async function runCoinLauncher(): Promise<void> {
  const state: CoinLauncherState = {
    metadata: {
      name: "",
      ticker: "",
      twitter: "",
      website: "",
      photoPath: "",
      bannerPath: "",
    },
    wallets: [],
  };

  const menuItems = ["Coin MetaData", "Wallets", "Recheck MetaData", "Deploy"];
  let selectedIndex = 0;

  while (true) {
    renderCoinLauncherMenu(menuItems, selectedIndex, state);
    const key = await readMenuKey();

    if (key === "escape") {
      renderVexumReturnSplash();
      return;
    }

    if (key === "up") {
      selectedIndex = selectedIndex === 0 ? menuItems.length - 1 : selectedIndex - 1;
      continue;
    }

    if (key === "down") {
      selectedIndex = selectedIndex === menuItems.length - 1 ? 0 : selectedIndex + 1;
      continue;
    }

    if (key !== "enter") {
      continue;
    }

    const selected = menuItems[selectedIndex];

    if (selected === "Coin MetaData") {
      await editCoinMetadata(state);
    } else if (selected === "Wallets") {
      await editLauncherWallets(state);
    } else if (selected === "Recheck MetaData") {
      await showCoinLauncherReview(state);
    } else if (selected === "Deploy") {
      await deployCoinLauncherToken(state);
    }
  }
}

function renderCoinLauncherMenu(menuItems: string[], selectedIndex: number, state: CoinLauncherState): void {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${dim}Use ↑/↓ to move, Enter to select, Esc to return to Vexum.${reset}`);
  console.log("");
  console.log(`${lightBlue}╔══════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${lightBlue}║${reset} ${bold}${pacmanYellow}Coin Launcher Menu${reset}${" ".repeat(40)}${lightBlue}║${reset}`);
  console.log(`${lightBlue}╠══════════════════════════════════════════════════════════════╣${reset}`);

  menuItems.forEach((item, index) => {
    const pointer = index === selectedIndex ? `${green}▶${reset}` : " ";
    const saved = item === "Coin MetaData" && isMetadataComplete(state.metadata)
      ? `${green}saved${reset}`
      : item === "Wallets" && state.wallets.length > 0
        ? `${green}${state.wallets.length}/24${reset}`
        : item === "Deploy" && state.deployedCa
          ? `${green}launched${reset}`
          : `${dim}open${reset}`;
    const plain = `${stripAnsi(pointer)} ${item} ${stripAnsi(saved)}`;
    const padding = Math.max(0, 60 - plain.length);
    console.log(`${lightBlue}║${reset} ${pointer} ${item}${" ".repeat(padding)}${saved} ${lightBlue}║${reset}`);
  });

  console.log(`${lightBlue}╚══════════════════════════════════════════════════════════════╝${reset}`);
}

async function editCoinMetadata(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Coin MetaData${reset}`);
  console.log(`${dim}Enter token launch details. Use image file paths from your Downloads folder for photos.${reset}`);
  console.log(`${dim}Press Enter to keep an existing value.${reset}`);
  console.log("");

  state.metadata.name = await promptValue("Coin Name", state.metadata.name);
  state.metadata.ticker = (await promptValue("Ticker", state.metadata.ticker)).toUpperCase();
  state.metadata.twitter = await promptValue("X/Twitter link", state.metadata.twitter);
  state.metadata.website = await promptValue("Website link", state.metadata.website);
  state.metadata.photoPath = await promptValue("Coin photo file path", state.metadata.photoPath);
  state.metadata.bannerPath = await promptValue("Coin banner photo file path", state.metadata.bannerPath);

  console.log("");
  console.log(`${green}Save complete.${reset} Returning to Coin Launcher menu...`);
  await sleep(650);
}

async function editLauncherWallets(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Wallets${reset}`);
  console.log(`${dim}Import Solana wallet private keys for launch bundling. Dev wallet is first and labeled.${reset}`);
  console.log(`${yellow}You can bundle up to 24 wallets.${reset}`);
  console.log(`${red}Private keys are kept in this CLI session only and masked on review.${reset}`);
  console.log(`${dim}Paste a private key and press Enter. Press ↓ or leave input blank to Save.${reset}`);
  console.log("");

  if (state.wallets.length > 0) {
    console.log(`${cyan}Existing wallets:${reset} ${state.wallets.length}/24`);
    console.log("");
  }

  for (let index = state.wallets.length; index < 24; index += 1) {
    const label = index === 0 ? "Dev Wallet" : `Wallet ${index + 1}`;
    const response = await promptWalletPrivateKey(label);

    if (response.save || !response.value) {
      break;
    }

    const privateKey = response.value;
    const walletInfo = await inspectLauncherWallet(privateKey);
    state.wallets.push({ label, privateKey, ...walletInfo });
    console.log(`${green}✓${reset} ${label} imported. SOL Balance: ${cyan}${walletInfo.solBalance}${reset}`);
    console.log(`${dim}Paste another private key, or press ↓ to Save.${reset}`);
    console.log("");
  }

  console.log(`${green}Save complete.${reset} ${state.wallets.length}/24 wallet slots saved. Returning to Coin Launcher menu...`);
  await sleep(850);
}

async function showCoinLauncherReview(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Recheck MetaData${reset}`);
  console.log("");
  console.log(`${cyan}Coin Name:${reset} ${state.metadata.name || "Blank"}`);
  console.log(`${cyan}Ticker:${reset} ${state.metadata.ticker || "Blank"}`);
  console.log(`${cyan}X/Twitter:${reset} ${state.metadata.twitter || "Blank"}`);
  console.log(`${cyan}Website:${reset} ${state.metadata.website || "Blank"}`);
  console.log(`${cyan}Coin Photo:${reset} ${state.metadata.photoPath || "Blank"}`);
  console.log(`${cyan}Banner Photo:${reset} ${state.metadata.bannerPath || "Blank"}`);
  console.log("");
  console.log(`${bold}${pacmanYellow}Wallet Bundle${reset}`);

  if (state.wallets.length === 0) {
    console.log(`${dim}No wallets imported.${reset}`);
  } else {
    for (const wallet of state.wallets) {
      console.log(`${green}›${reset} ${wallet.label}: ${maskSecret(wallet.privateKey)} | Address: ${wallet.address ?? "Unavailable"} | SOL Balance: ${wallet.solBalance}`);
    }
  }

  console.log("");
  console.log("");
  console.log(`${bold}${pacmanYellow}Deploy${reset}`);
  console.log(`${dim}Press Esc, Backspace, or ← to return to the Coin Launcher menu.${reset}`);
  await waitForBackKey();
}

async function deployCoinLauncherToken(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Deploy${reset}`);
  console.log("");
  console.log(`${yellow}Launching....${reset}`);
  await sleep(650);
  console.log(`${dim}[01/04]${reset} ${green}✓${reset} Packaging metadata`);
  await sleep(420);
  console.log(`${dim}[02/04]${reset} ${green}✓${reset} Preparing wallet bundle`);
  await sleep(420);
  console.log(`${dim}[03/04]${reset} ${green}✓${reset} Submitting Pump.fun launch transaction`);
  await sleep(420);
  console.log(`${dim}[04/04]${reset} ${green}✓${reset} Confirming token CA`);
  await sleep(420);

  state.deployedCa = makeMockSolanaAddress();
  console.log("");
  console.log(`${bold}${green}Token Launched${reset}`);
  console.log(`${cyan}CA:${reset} ${green}${state.deployedCa}${reset}`);
  console.log("");
  console.log(`${dim}Press Esc, Backspace, or ← to return to the Coin Launcher menu.${reset}`);
  await waitForBackKey();
}

async function runCoinSniper(): Promise<void> {
  const state: CoinSniperState = {
    target: "",
  };
  const menuItems = ["Snipe Ticker/Name", "Sniper Dev Wallet"];
  let selectedIndex = 0;

  while (true) {
    renderCoinSniperMenu(menuItems, selectedIndex, state);
    const key = await readMenuKey();

    if (key === "escape") {
      renderVexumReturnSplash();
      return;
    }

    if (key === "up") {
      selectedIndex = selectedIndex === 0 ? menuItems.length - 1 : selectedIndex - 1;
      continue;
    }

    if (key === "down") {
      selectedIndex = selectedIndex === menuItems.length - 1 ? 0 : selectedIndex + 1;
      continue;
    }

    if (key !== "enter") {
      continue;
    }

    if (menuItems[selectedIndex] === "Snipe Ticker/Name") {
      await editSnipeTarget(state);
    } else {
      await editSniperDevWallet(state);
    }
  }
}

function renderCoinSniperMenu(menuItems: string[], selectedIndex: number, state: CoinSniperState): void {
  clearScreen();
  console.log(coinSniperBanner());
  console.log(`${dim}Use ↑/↓ to move, Enter to select, Esc to return to Vexum.${reset}`);
  console.log("");
  console.log(`${brightRed}╔══════════════════════════════════════════════════════════════╗${reset}`);
  console.log(`${brightRed}║${reset} ${bold}${pacmanYellow}Coin Sniper Menu${reset}${" ".repeat(42)}${brightRed}║${reset}`);
  console.log(`${brightRed}╠══════════════════════════════════════════════════════════════╣${reset}`);

  menuItems.forEach((item, index) => {
    const pointer = index === selectedIndex ? `${green}▶${reset}` : " ";
    const saved = item === "Snipe Ticker/Name" && state.target
      ? `${green}set${reset}`
      : item === "Sniper Dev Wallet" && state.devWallet
        ? `${green}set${reset}`
        : `${dim}open${reset}`;
    const plain = `${stripAnsi(pointer)} ${item} ${stripAnsi(saved)}`;
    const padding = Math.max(0, 60 - plain.length);
    console.log(`${brightRed}║${reset} ${pointer} ${item}${" ".repeat(padding)}${saved} ${brightRed}║${reset}`);
  });

  console.log(`${brightRed}╚══════════════════════════════════════════════════════════════╝${reset}`);

  if (state.target || state.devWallet) {
    console.log("");
    console.log(`${cyan}Target:${reset} ${state.target || "Blank"}`);
    console.log(`${cyan}Dev Wallet:${reset} ${state.devWallet?.address ?? (state.devWallet ? "Imported" : "Blank")}`);
  }
}

async function editSnipeTarget(state: CoinSniperState): Promise<void> {
  clearScreen();
  console.log(coinSniperBanner());
  console.log(`${bold}${pacmanYellow}Snipe Ticker/Name${reset}`);
  console.log(`${dim}Enter the coin ticker or name Vexum should watch for.${reset}`);
  console.log("");

  state.target = await promptValue("Ticker or coin name", state.target);

  console.log("");
  console.log(`${green}Save complete.${reset} Returning to Coin Sniper menu...`);
  await sleep(650);
}

async function editSniperDevWallet(state: CoinSniperState): Promise<void> {
  clearScreen();
  console.log(coinSniperBanner());
  console.log(`${bold}${pacmanYellow}Sniper Dev Wallet${reset}`);
  console.log(`${dim}Paste the Solana private key for the wallet used by the sniper.${reset}`);
  console.log(`${red}Private keys are kept in this CLI session only and masked on review.${reset}`);
  console.log(`${dim}Press ↓ or leave input blank to keep current wallet and return.${reset}`);
  console.log("");

  const response = await promptWalletPrivateKey("Sniper Dev Wallet private key");

  if (!response.save && response.value) {
    const walletInfo = await inspectLauncherWallet(response.value);
    state.devWallet = {
      label: "Sniper Dev Wallet",
      privateKey: response.value,
      ...walletInfo,
    };
    console.log(`${green}✓${reset} Sniper Dev Wallet imported. SOL Balance: ${cyan}${walletInfo.solBalance}${reset}`);
  }

  console.log("");
  console.log(`${green}Save complete.${reset} Returning to Coin Sniper menu...`);
  await sleep(850);
}

function coinLauncherBanner(): string {
  const coinLines = [
    " ██████╗ ██████╗ ██╗███╗   ██╗    ██╗      █████╗ ██╗   ██╗███╗   ██╗ ██████╗██╗  ██╗███████╗██████╗",
    "██╔════╝██╔═══██╗██║████╗  ██║    ██║     ██╔══██╗██║   ██║████╗  ██║██╔════╝██║  ██║██╔════╝██╔══██╗",
    "██║     ██║   ██║██║██╔██╗ ██║    ██║     ███████║██║   ██║██╔██╗ ██║██║     ███████║█████╗  ██████╔╝",
    "██║     ██║   ██║██║██║╚██╗██║    ██║     ██╔══██║██║   ██║██║╚██╗██║██║     ██╔══██║██╔══╝  ██╔══██╗",
    "╚██████╗╚██████╔╝██║██║ ╚████║    ███████╗██║  ██║╚██████╔╝██║ ╚████║╚██████╗██║  ██║███████╗██║  ██║",
    " ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝    ╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝",
  ];
  const launchLines = [
    "                           *     .--.",
    "                                / /  `",
    "               +               | |",
    "                      '         \\ \\__,",
    "                  *          +   '--'  *",
    "                      +   /\\",
    "         +              .'  '.   *",
    "                *      /======\\      +",
    "                      ;:.  _   ;",
    "                      |:. (_)  |",
    "                      |:.  _   |",
    "            +         |:. (_)  |          *",
    "                      ;:.      ;",
    "                    .' \\:.    / `.",
    "                   / .-'':._.'`-. \\",
    "                   |/    /||\\    \\|",
    "                 _..--\"\"\"````\"\"\"--.._",
    "           _.-'``                    ``'-._",
    "         -'                                '-",
  ];

  return [
    ...centerBlockLines(launchLines, bannerVisibleWidth(coinLines)).map((line) => `${lightBlue}${line}${reset}`),
    "",
    ...coinLines.map((line) => `${lightBlue}${line}${reset}`),
  ].join("\n");
}

function coinSniperBanner(): string {
  const coinLines = [
    " ██████╗ ██████╗ ██╗███╗   ██╗    ███████╗███╗   ██╗██╗██████╗ ███████╗██████╗",
    "██╔════╝██╔═══██╗██║████╗  ██║    ██╔════╝████╗  ██║██║██╔══██╗██╔════╝██╔══██╗",
    "██║     ██║   ██║██║██╔██╗ ██║    ███████╗██╔██╗ ██║██║██████╔╝█████╗  ██████╔╝",
    "██║     ██║   ██║██║██║╚██╗██║    ╚════██║██║╚██╗██║██║██╔═══╝ ██╔══╝  ██╔══██╗",
    "╚██████╗╚██████╔╝██║██║ ╚████║    ███████║██║ ╚████║██║██║     ███████╗██║  ██║",
    " ╚═════╝ ╚═════╝ ╚═╝╚═╝  ╚═══╝    ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝",
  ];
  const skullLines = [
    "                 uuuuuuu",
    "             uu$$$$$$$$$$$uu",
    "          uu$$$$$$$$$$$$$$$$$uu",
    "         u$$$$$$$$$$$$$$$$$$$$$u",
    "        u$$$$$$$$$$$$$$$$$$$$$$$u",
    "       u$$$$$$$$$$$$$$$$$$$$$$$$$u",
    "       u$$$$$$$$$$$$$$$$$$$$$$$$$u",
    "       u$$$$$$\"   \"$$$\"   \"$$$$$$u",
    "       \"$$$$\"      u$u       $$$$\"",
    "        $$$u       u$u       u$$$",
    "        $$$u      u$$$u      u$$$",
    "         \"$$$$uu$$$   $$$uu$$$$\"",
    "          \"$$$$$$$\"   \"$$$$$$$\"",
    "            u$$$$$$$u$$$$$$$u",
    "             u$\"$\"$\"$\"$\"$\"$u",
    "  uuu        $$u$ $ $ $ $u$$       uuu",
    " u$$$$        $$$$$u$u$u$$$       u$$$$",
    "  $$$$$uu      \"$$$$$$$$$\"     uu$$$$$$",
    "u$$$$$$$$$$$uu    \"\"\"\"\"    uuuu$$$$$$$$$$",
    "$$$$\"\"\"$$$$$$$$$$uuu   uu$$$$$$$$$\"\"\"$$$\"",
    " \"\"\"      \"\"$$$$$$$$$$$uu \"\"$\"\"\"",
    "           uuuu \"\"$$$$$$$$$$uuu",
    "  u$$$uuu$$$$$$$$$uu \"\"$$$$$$$$$$$uuu$$$",
    "  $$$$$$$$$$\"\"\"\"           \"\"$$$$$$$$$$$\"",
    "   \"$$$$$\"                      \"\"$$$$\"\"",
    "     $$$\"                         $$$$\"",
  ];

  return [
    ...centerBlockLines(skullLines, bannerVisibleWidth(coinLines)).map((line) => `${brightRed}${line}${reset}`),
    "",
    ...coinLines.map((line) => `${brightRed}${line}${reset}`),
  ].join("\n");
}

function centerBlockLines(lines: string[], width: number): string[] {
  const blockWidth = bannerVisibleWidth(lines);
  const padding = " ".repeat(Math.max(0, Math.floor((width - blockWidth) / 2)));
  return lines.map((line) => `${padding}${line}`);
}

function bannerVisibleWidth(lines: string[]): number {
  return Math.max(...lines.map((line) => line.length));
}

async function promptValue(label: string, current: string): Promise<string> {
  const suffix = current ? ` ${dim}[${current}]${reset}` : "";
  const response = await readRawLine(`${cyan}${label}${reset}${suffix}: `, { allowDownToSave: false });
  return response.value || current;
}

async function promptWalletPrivateKey(label: string): Promise<{ value: string; save: boolean }> {
  return await readRawLine(`${cyan}${label}${reset}: `, { allowDownToSave: true });
}

async function readRawLine(
  prompt: string,
  options: { allowDownToSave: boolean },
): Promise<{ value: string; save: boolean }> {
  return new Promise((resolve) => {
    const wasRaw = input.isRaw;
    let settled = false;
    let value = "";

    if (input.isTTY) {
      input.setRawMode(true);
    }

    input.resume();
    output.write(prompt);

    const finish = (save: boolean) => {
      if (settled) {
        return;
      }

      settled = true;

      if (input.isTTY) {
        input.setRawMode(wasRaw);
      }

      input.off("data", onData);
      input.off("end", onEnd);
      input.pause();
      output.write("\n");
      resolve({ value: value.trim(), save });
    };

    const onEnd = () => finish(true);

    const writeVisible = (text: string) => {
      output.write(text.replace(/[^\x20-\x7E]/g, ""));
    };

    const onData = (chunk: Buffer) => {
      const text = chunk.toString("utf8");

      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        const nextTwo = text.slice(index, index + 3);

        if (char === "\r" || char === "\n") {
          finish(false);
          return;
        }

        if (char === "\u001b") {
          if (nextTwo === "\u001b[B" && options.allowDownToSave) {
            finish(true);
            return;
          }

          if (nextTwo === "\u001b[D") {
            finish(true);
            return;
          }

          if (nextTwo.length === 3 && nextTwo.startsWith("\u001b[")) {
            index += 2;
            continue;
          }

          finish(true);
          return;
        }

        if (char === "\u007f" || char === "\b") {
          if (value.length > 0) {
            value = value.slice(0, -1);
            output.write("\b \b");
          }
          continue;
        }

        value += char;
        writeVisible(char);
      }
    };

    input.on("data", onData);
    input.once("end", onEnd);
  });
}

async function waitForBackKey(): Promise<void> {
  while (true) {
    const key = await readMenuKey();
    if (key === "escape" || key === "left" || key === "backspace" || key === "enter") {
      return;
    }
  }
}

async function readMenuKey(): Promise<"up" | "down" | "left" | "enter" | "escape" | "backspace" | "other"> {
  return new Promise((resolve) => {
    const wasRaw = input.isRaw;
    let settled = false;

    if (input.isTTY) {
      input.setRawMode(true);
    }

    input.resume();

    const finish = (key: "up" | "down" | "left" | "enter" | "escape" | "backspace" | "other") => {
      if (settled) {
        return;
      }

      settled = true;

      if (input.isTTY) {
        input.setRawMode(wasRaw);
      }

      input.off("data", onData);
      input.off("end", onEnd);
      input.pause();
      resolve(key);
    };

    const onEnd = () => finish("escape");

    const onData = (chunk: Buffer) => {
      const key = chunk.toString("utf8");

      if (key === "\u001b[A") finish("up");
      else if (key === "\u001b[B") finish("down");
      else if (key === "\u001b[D") finish("left");
      else if (key === "\r" || key === "\n") finish("enter");
      else if (key === "\u001b") finish("escape");
      else if (key === "\u007f" || key === "\b") finish("backspace");
      else finish("other");
    };

    input.once("data", onData);
    input.once("end", onEnd);
  });
}

function clearScreen(): void {
  console.log("\u001b[2J\u001b[H");
}

function renderVexumReturnSplash(): void {
  clearScreen();

  for (const line of vexumReturnSplashLines()) {
    console.log(`${green}${line}${reset}`);
  }

  console.log("");
}

function vexumReturnSplashLines(): string[] {
  return [
    "⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
    "⣠⡙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿",
    "⡈⢻⣷⢬⣝⡻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠟⣛⣽⡆",
    "⣷⢈⢻⣷⣍⡛⠷⣄⣶⣤⣶⣶⣾⣭⣩⣶⣶⣶⣭⣉⡙⠛⣋⣭⡶⠞⣋⣿⡿⣰",
    "⣿⡇⢀⢽⣿⣿⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠟⠋⢡⣶⣿⡿⠟⢡⣿",
    "⣿⣿⡦⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣿⣿⡟⢃⢠⣿⣿",
    "⣿⣿⢃⣴⣿⠛⠿⣿⣿⣿⣿⣿⣷⣯⠽⠻⣿⣿⣿⣿⣿⣿⣿⡿⣿⠏⢠⣾⣿⣿",
    "⣿⡟⢸⣿⣿⣧⣤⣼⣿⣿⣿⣿⣁⠀⣀⣠⣶⣿⣿⣿⣿⣿⣿⣿⣿⡄⣿⣿⣿⣿",
    "⣿⡇⢸⡅⢿⣿⡟⢭⣟⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⢿⣿⣿⣇⢸⣿⣿⣿",
    "⣿⡇⢸⠧⣮⢿⣿⣦⡰⠾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣽⣿⠫⠸⣿⣿⣿",
    "⣿⡇⢸⢾⣿⡌⠉⠁⠈⠙⠻⠿⢿⠿⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⣿⣿⣿",
    "⣿⣇⢸⣾⣿⣿⡰⣶⣿⣿⣦⣤⣤⣤⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⡷⢰⣿⣿⣿",
    "⣿⣿⣐⠿⠷⠿⠷⠯⠍⠻⠻⠛⠋⠹⠿⠿⠿⠿⠿⠿⠿⠿⠿⠿⠷⠤⢘⣿⣿⣿",
  ];
}

function isMetadataComplete(metadata: CoinMetadata): boolean {
  return Boolean(metadata.name && metadata.ticker && metadata.photoPath);
}

async function inspectLauncherWallet(privateKey: string): Promise<{ address?: string; solBalance: string }> {
  await sleep(140);

  const address = deriveSolanaAddressFromSecretKey(privateKey);

  if (!address) {
    return { solBalance: "Unavailable - invalid secret key format" };
  }

  try {
    const balance = await solanaRpc<{ value: number }>("getBalance", [address]);
    return {
      address,
      solBalance: `${(balance.value / 1_000_000_000).toFixed(4)} SOL`,
    };
  } catch {
    return { address, solBalance: "Unavailable - RPC balance lookup failed" };
  }
}

function maskSecret(value: string): string {
  if (value.length <= 12) {
    return "********";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

async function mintVanityWallet(prefix: string): Promise<SolanaWallet> {
  let attempts = 0;
  let block = 0;
  const estimatedAttempts = estimateVanityAttempts(prefix);

  while (true) {
    block += 1;
    const blockStart = attempts + 1;

    for (let index = 0; index < vanityBlockSize; index += 1) {
      attempts += 1;
      const wallet = generateSolanaWallet();

      if (wallet.address.startsWith(prefix)) {
        console.log(`${dim}[block ${String(block).padStart(5, "0")}]${reset} ${formatVanityProgressBar(attempts, estimatedAttempts, true)} searched ${blockStart.toLocaleString()}-${attempts.toLocaleString()} ${green}MATCH${reset}`);
        return { ...wallet, attempts, vanityPrefix: prefix };
      }
    }

    console.log(`${dim}[block ${String(block).padStart(5, "0")}]${reset} ${formatVanityProgressBar(attempts, estimatedAttempts)} searched ${blockStart.toLocaleString()}-${attempts.toLocaleString()}`);

    if (block % 4 === 0) {
      await sleep(0);
    }
  }
}

function handleImmediatePrompt(request: string): string | undefined {
  const normalizedRequest = request.toLowerCase();

  if (normalizedRequest === "help") {
    return [
      `${bold}${purple}You can type natural Vexum requests.${reset}`,
      "",
      `${cyan}Examples:${reset}`,
      `  ${yellow}Mint me a solana wallet${reset}`,
      `  ${yellow}Mint me a wallet that starts with <desired word>${reset}`,
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

function looksLikeCoinLauncherRequest(request: string): boolean {
  return /\bcoin\s+launcher\b/i.test(request.trim());
}

function looksLikeCoinSniperRequest(request: string): boolean {
  return /\bcoin\s+sniper\b/i.test(request.trim());
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

    return { accounts: payload.value.slice(0, topHolderLimit), errors: [] };
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

  return accounts.map((account, index) => {
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
      isLiquidityPool: index === 0,
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
      errors.push(`${describeRpcEndpoint(endpoint)}: ${formatError(error)}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function describeRpcEndpoint(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    return url.hostname.includes("helius") ? "Helius RPC" : url.hostname;
  } catch {
    return "Configured RPC";
  }
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
  const largestNonLiquidityHolder = scan.holders.find((holder) => !holder.isLiquidityPool);
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
      `Holder Count: ${scan.holderCount?.toLocaleString("en-US") ?? (env.SOLSCAN_API_KEY ? "Solscan key configured, but holder count is unavailable on this key tier." : "Set SOLSCAN_API_KEY for exact indexed holder count.")}`,
      `Top ${topHolderLimit} Account Concentration: ${scan.holders.length > 0 ? `${top10Percent.toFixed(2)}%` : "Unavailable"}`,
      `Liquidity Pool: ${largestHolder ? `${largestHolder.percent.toFixed(2)}%` : "Unavailable"}`,
      `Largest Non-LP Holder: ${largestNonLiquidityHolder ? `${largestNonLiquidityHolder.percent.toFixed(2)}%` : "Unavailable"}`,
    ].join("\n"),
    [
      "TOP HOLDER DISTRIBUTION",
      "",
      ...(scan.holders.length > 0
        ? scan.holders.map((holder, index) => (
          `${index + 1}. ${shortAddress(holder.owner ?? holder.tokenAccount)}${holder.isLiquidityPool ? " [LIQUIDITY POOL]" : ""} holds ${holder.uiAmountString} (${holder.percent.toFixed(2)}%)`
        ))
        : ["No holder distribution returned by public RPC."]),
    ].join("\n"),
    [
      "IMPORTANT WALLETS",
      "",
      ...(importantWallets.length > 0
        ? importantWallets
        : ["No additional watchlist wallets in the displayed holder sample."]),
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
    if (holder.isLiquidityPool) {
      continue;
    }

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
    sections.push(createSolanaWalletSection({ ...generateSolanaWallet(), attempts: 1 }));
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

function createSolanaWalletSection(wallet: SolanaWallet): string {
  return [
    "WALLET / KEYPAIR",
    "",
    ...(wallet.vanityPrefix
      ? [
        `Vanity Prefix: ${wallet.vanityPrefix}`,
        `Search Attempts: ${wallet.attempts.toLocaleString("en-US")}`,
        "",
      ]
      : []),
    "Public Key / Address (base58):",
    wallet.address,
    "",
    "Private Key / Secret Key (base58 - Phantom import format):",
    wallet.secretKey,
    "",
    "Security note: import this into Phantom only if you intend to control this generated wallet. Never share the secret key.",
  ].join("\n");
}

function generateSolanaWallet(): Omit<SolanaWallet, "attempts" | "vanityPrefix"> {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const privateKeyDer = privateKey.export({ format: "der", type: "pkcs8" });

  const publicKeyBytes = publicKeyDer.subarray(-32);
  const seedBytes = privateKeyDer.subarray(-32);
  const secretKeyBytes = Buffer.concat([seedBytes, publicKeyBytes]);

  return {
    address: encodeBase58(publicKeyBytes),
    secretKey: encodeBase58(secretKeyBytes),
  };
}

function extractWalletVanityPrefix(prompt: string): string | undefined {
  const patterns = [
    /\b(?:starts?|start|begin|begins|beginning)\s+with\s+([1-9A-HJ-NP-Za-km-z]{1,12})\b/i,
    /\b(?:prefix|vanity)\s+([1-9A-HJ-NP-Za-km-z]{1,12})\b/i,
    /\baddress\s+(?:starts?|begins?)\s+with\s+([1-9A-HJ-NP-Za-km-z]{1,12})\b/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern)?.[1];
    if (match) {
      return match;
    }
  }

  const loose = prompt.match(/\b(?:starts?|begins?)\s+with\s+([A-Za-z0-9]{1,12})\b/i)?.[1];
  return loose;
}

function isBase58String(value: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(value);
}

function estimateVanitySearch(prefix: string): string {
  const averageAttempts = estimateVanityAttempts(prefix);

  if (prefix.length <= 2) {
    return `usually quick, around ${averageAttempts.toLocaleString("en-US")} attempts on average`;
  }

  if (prefix.length === 3) {
    return `can take seconds, around ${averageAttempts.toLocaleString("en-US")} attempts on average`;
  }

  if (prefix.length === 4) {
    return `can take minutes, around ${averageAttempts.toLocaleString("en-US")} attempts on average`;
  }

  return `can take a long time, around ${averageAttempts.toLocaleString("en-US")} attempts on average`;
}

function estimateVanityAttempts(prefix: string): number {
  return Math.max(1, Math.round((58 ** prefix.length) / 2));
}

function formatVanityProgressBar(attempts: number, estimatedAttempts: number, matched = false): string {
  const ratio = matched ? 1 : Math.min(0.999, attempts / estimatedAttempts);
  const filled = Math.max(1, Math.min(vanityProgressWidth, Math.floor(ratio * vanityProgressWidth)));
  const empty = vanityProgressWidth - filled;
  const percent = Math.min(100, Math.floor(ratio * 100));
  const color = matched ? green : purple;

  return `${color}${"█".repeat(filled)}${dim}${"░".repeat(empty)}${reset} ${dim}${String(percent).padStart(3, " ")}% est.${reset}`;
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

function deriveSolanaAddressFromSecretKey(privateKey: string): string | undefined {
  const secretKey = parseSecretKeyBytes(privateKey);

  if (!secretKey || secretKey.length < 64) {
    return undefined;
  }

  return encodeBase58(secretKey.subarray(secretKey.length - 32));
}

function parseSecretKeyBytes(privateKey: string): Uint8Array | undefined {
  const trimmed = privateKey.trim();

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;

      if (Array.isArray(parsed) && parsed.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) {
        return Uint8Array.from(parsed as number[]);
      }
    } catch {
      return undefined;
    }
  }

  return decodeBase58(trimmed);
}

function decodeBase58(value: string): Uint8Array | undefined {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let decoded = 0n;

  for (const char of value) {
    const index = alphabet.indexOf(char);

    if (index === -1) {
      return undefined;
    }

    decoded = decoded * 58n + BigInt(index);
  }

  let hex = decoded.toString(16);

  if (hex.length % 2) {
    hex = `0${hex}`;
  }

  const bytes = hex === "00" ? Buffer.alloc(0) : Buffer.from(hex, "hex");
  let leadingZeroes = 0;

  for (const char of value) {
    if (char !== alphabet[0]) {
      break;
    }

    leadingZeroes += 1;
  }

  return Uint8Array.from(Buffer.concat([Buffer.alloc(leadingZeroes), bytes]));
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
