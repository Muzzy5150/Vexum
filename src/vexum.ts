#!/usr/bin/env -S node --import tsx

import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";

import { Keypair } from "@solana/web3.js";
import { join } from "node:path";
import {
  runStructured,
  runNatural,
  cliError,
  structuredHelp,
  printResult,
  buyAction,
  sellAction,
  monitorAction,
} from "./cli.js";
import { config } from "./core/config.js";
import { verifyPublicMetadata } from "./core/metadata.js";
import {
  terminalInput,
  menuKey,
  passphrase,
  authorize,
  type MenuKey,
} from "./core/terminal.js";
import { saveWallet, loadWallet } from "./services/wallet.js";
import { walletInfo } from "./services/intelligence.js";
import { pinFile, pinMetadata, launchToken } from "./services/launch.js";
import { positionsFile } from "./services/trading.js";

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
const red = "\u001b[31m";
const brightRed = "\u001b[38;5;196m";
const bold = "\u001b[1m";
const dim = "\u001b[2m";

const version = "0.2.0-dev.1";
type CoinMetadata = {
  name: string;
  ticker: string;
  description: string;
  telegram: string;
  twitter: string;
  website: string;
  photoPath: string;
  bannerPath: string;
  imageUri: string;
  metadataUri: string;
};
type LauncherWallet = {
  label: string;
  walletFile: string;
  address?: string;
  solBalance: string;
};
type CoinLauncherState = {
  metadata: CoinMetadata;
  wallets: LauncherWallet[];
  deployedCa?: string;
  mintWalletFile?: string;
};
type CoinSniperState = {
  target: string;
  devWallet?: LauncherWallet;
  buyAmount?: string;
  slippage?: string;
  maxFee?: string;
  maxRent?: string;
  maxPosition?: string;
  maxSpend?: string;
  minBalance?: string;
};
const commands = {
  help: { description: "Show available Vexum CLI commands.", run: showHelp },
  version: { description: "Print the Vexum CLI version.", run: showVersion },
  status: {
    description: "Show configuration and safety defaults.",
    run: showStatus,
  },
} as const;
type CommandName = keyof typeof commands;

async function main(argv: string[]): Promise<number> {
  if (config().cluster !== "mainnet-beta")
    throw new Error(
      "VEXUM is a Solana Mainnet Beta CLI; set VEXUM_CLUSTER=mainnet-beta",
    );
  if (await runStructured(argv)) return 0;
  console.log(
    `\n${purple}${banner}${reset}\n${bold}${cyan}Created by Muzzy5150${reset}\n`,
  );
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
  console.log("\n" + structuredHelp);
}

function showVersion(): void {
  console.log(`vexum ${version}`);
}

function showStatus(): void {
  console.log(`${bold}${purple}VEXUM CLI${reset} — ${version}`);
  console.log(
    `Network: ${config().cluster}. Transactions: mainnet preflight / explicit approval. Autonomous spending: disabled.`,
  );
  console.log(
    `RPC endpoints: ${config().endpoints.length}. FUD TXN BOT: Coming Soon.`,
  );
  console.log(structuredHelp);
}

async function startConsole(): Promise<void> {
  console.log(
    `${bold}${green}Vexum console is online.${reset} Type a request, or type ${red}exit${reset} to close.`,
  );
  printConsoleIntro();
  if (!input.isTTY) {
    const terminal = createInterface({ input, output, terminal: false });
    try {
      for await (const line of terminal) {
        if (["exit", "quit", "q"].includes(line.trim().toLowerCase())) break;
        if (line.trim()) {
          try {
            await runTaskWithProgress(line.trim());
          } catch (e) {
            process.exitCode = cliError(e);
          }
        }
      }
    } finally {
      terminal.close();
    }
    return;
  }
  while (true) {
    let request: string;
    try {
      request = (await terminalInput(`${purple}vexum>${reset} `)).trim();
    } catch (e) {
      if (
        e instanceof Error &&
        ["Cancelled", "Input closed"].includes(e.message)
      )
        return;
      throw e;
    }
    if (["exit", "quit", "q"].includes(request.toLowerCase())) return;
    if (!request) continue;
    try {
      await runTaskWithProgress(request);
    } catch (e) {
      cliError(e);
    }
  }
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
    console.log(
      `${purple}║${reset} ${line}${" ".repeat(padding)} ${purple}║${reset}`,
    );
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
    "FUD TXN BOT",
  ];
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

async function runTaskWithProgress(request: string): Promise<void> {
  if (request.toLowerCase() === "help") {
    showHelp();
    return;
  }
  if (request.toLowerCase() === "status") {
    showStatus();
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
  if (looksLikeFudTxnBotRequest(request)) {
    await runFudTxnBot();
    return;
  }
  await runNatural(request);
}

async function runCoinLauncher(): Promise<void> {
  const state: CoinLauncherState = {
    metadata: {
      name: "",
      description: "",
      telegram: "",
      imageUri: "",
      metadataUri: "",
      ticker: "",
      twitter: "",
      website: "",
      photoPath: "",
      bannerPath: "",
    },
    wallets: [],
  };

  const menuItems = [
    "Coin MetaData",
    "Wallets",
    "Recheck MetaData",
    "Deploy",
    "Upload MetaData",
    "Deploy Live",
    "Clear Wallet Slots",
  ];
  let selectedIndex = 0;

  while (true) {
    renderCoinLauncherMenu(menuItems, selectedIndex, state);
    const key = await readMenuKey();

    if (key === "escape") {
      renderVexumReturnSplash();
      return;
    }

    if (key === "up") {
      selectedIndex =
        selectedIndex === 0 ? menuItems.length - 1 : selectedIndex - 1;
      continue;
    }

    if (key === "down") {
      selectedIndex =
        selectedIndex === menuItems.length - 1 ? 0 : selectedIndex + 1;
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
    } else if (selected === "Upload MetaData") {
      try {
        const image = await pinFile(state.metadata.photoPath);
        state.metadata.imageUri = image;
        state.metadata.metadataUri = await pinMetadata({
          name: state.metadata.name,
          symbol: state.metadata.ticker,
          description: state.metadata.description,
          image,
          ...(state.metadata.twitter
            ? { twitter: state.metadata.twitter }
            : {}),
          ...(state.metadata.telegram
            ? { telegram: state.metadata.telegram }
            : {}),
          ...(state.metadata.website
            ? { website: state.metadata.website }
            : {}),
        });
        console.log(state.metadata.metadataUri);
      } catch (e) {
        cliError(e);
      }
      await waitForBackKey();
    } else if (selected === "Deploy Live") {
      await deployCoinLauncherToken(state, true);
    } else if (selected === "Clear Wallet Slots") {
      state.wallets = [];
    }
  }
}

function renderCoinLauncherMenu(
  menuItems: string[],
  selectedIndex: number,
  state: CoinLauncherState,
): void {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(
    `${dim}Use ↑/↓ to move, Enter to select, Esc to return to Vexum.${reset}`,
  );
  console.log("");
  console.log(
    `${lightBlue}╔══════════════════════════════════════════════════════════════╗${reset}`,
  );
  console.log(
    `${lightBlue}║${reset} ${bold}${pacmanYellow}Coin Launcher Menu${reset}${" ".repeat(40)}${lightBlue}║${reset}`,
  );
  console.log(
    `${lightBlue}╠══════════════════════════════════════════════════════════════╣${reset}`,
  );

  menuItems.forEach((item, index) => {
    const pointer = index === selectedIndex ? `${green}▶${reset}` : " ";
    const saved =
      item === "Coin MetaData" && isMetadataComplete(state.metadata)
        ? `${green}saved${reset}`
        : item === "Wallets" && state.wallets.length > 0
          ? `${green}${state.wallets.length}/24${reset}`
          : item === "Deploy" && state.deployedCa
            ? `${green}launched${reset}`
            : `${dim}open${reset}`;
    const plain = `${stripAnsi(pointer)} ${item} ${stripAnsi(saved)}`;
    const padding = Math.max(0, 60 - plain.length);
    console.log(
      `${lightBlue}║${reset} ${pointer} ${item}${" ".repeat(padding)}${saved} ${lightBlue}║${reset}`,
    );
  });

  console.log(
    `${lightBlue}╚══════════════════════════════════════════════════════════════╝${reset}`,
  );
}

async function editCoinMetadata(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Coin MetaData${reset}`);
  console.log(
    `${dim}Enter token launch details. Use an image file path for photos. Uploads require PINATA_JWT.${reset}`,
  );
  console.log(`${dim}Press Enter to keep an existing value.${reset}`);
  console.log("");

  state.metadata.name = await promptValue("Coin Name", state.metadata.name);
  state.metadata.ticker = (
    await promptValue("Ticker", state.metadata.ticker)
  ).toUpperCase();
  state.metadata.description = await promptValue(
    "Description",
    state.metadata.description,
  );
  state.metadata.telegram = await promptValue(
    "Telegram link",
    state.metadata.telegram,
  );
  state.metadata.imageUri = await promptValue(
    "Existing image IPFS/HTTPS URI (optional)",
    state.metadata.imageUri,
  );
  state.metadata.metadataUri = await promptValue(
    "Existing metadata IPFS/HTTPS URI (optional)",
    state.metadata.metadataUri,
  );
  state.metadata.twitter = await promptValue(
    "X/Twitter link",
    state.metadata.twitter,
  );
  state.metadata.website = await promptValue(
    "Website link",
    state.metadata.website,
  );
  state.metadata.photoPath = await promptValue(
    "Coin photo file path",
    state.metadata.photoPath,
  );
  state.metadata.bannerPath = await promptValue(
    "Coin banner photo file path",
    state.metadata.bannerPath,
  );

  console.log("");
  console.log(
    `${green}Save complete.${reset} Returning to Coin Launcher menu...`,
  );
  await sleep(650);
}

async function editLauncherWallets(state: CoinLauncherState): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(`${bold}${pacmanYellow}Wallets${reset}`);
  console.log(
    `${yellow}24 wallet slots retained. Only the first creator wallet is enabled for launch. Bundling is unavailable.${reset}`,
  );
  console.log(
    "Import keys first with wallet import. Enter encrypted vault paths; blank saves.",
  );
  for (let i = state.wallets.length; i < 24; i++) {
    const path = await terminalInput(
      `${i === 0 ? "Dev Wallet" : `Wallet ${i + 1}`} vault path: `,
    );
    if (!path) break;
    try {
      const wallet = await loadWallet(path, await passphrase());
      const owner = wallet.publicKey.toBase58();
      const balance = await walletInfo(owner)
        .then((v) => `${v.sol} SOL`)
        .catch(() => "Unavailable — RPC lookup failed");
      state.wallets.push({
        label: i === 0 ? "Dev Wallet" : `Wallet ${i + 1}`,
        walletFile: path,
        address: owner,
        solBalance: balance,
      });
      console.log(`${green}Imported ${owner}${reset}`);
    } catch (e) {
      cliError(e);
    }
  }
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
  console.log(
    `${cyan}Coin Photo:${reset} ${state.metadata.photoPath || "Blank"}`,
  );
  console.log(
    `${cyan}Banner Photo:${reset} ${state.metadata.bannerPath || "Blank"}`,
  );
  console.log("");
  console.log(
    `${bold}${pacmanYellow}Wallet Slots (bundling unavailable)${reset}`,
  );

  if (state.wallets.length === 0) {
    console.log(`${dim}No wallets imported.${reset}`);
  } else {
    for (const wallet of state.wallets) {
      console.log(
        `${green}›${reset} ${wallet.label}: ${maskSecret(wallet.walletFile)} | Address: ${wallet.address ?? "Unavailable"} | SOL Balance: ${wallet.solBalance}`,
      );
    }
  }

  console.log("");
  console.log("");
  console.log(`${bold}${pacmanYellow}Deploy${reset}`);
  console.log(
    `${dim}Press Esc, Backspace, or ← to return to the Coin Launcher menu.${reset}`,
  );
  await waitForBackKey();
}

async function deployCoinLauncherToken(
  state: CoinLauncherState,
  live = false,
): Promise<void> {
  clearScreen();
  console.log(coinLauncherBanner());
  console.log(
    `${bold}${pacmanYellow}Deploy${reset} — ${live ? "LIVE confirmation required" : "DRY RUN"}`,
  );
  try {
    if (!isMetadataComplete(state.metadata) || !state.wallets[0])
      throw new Error("Complete metadata and select a creator wallet first");
    if (state.wallets.length > 1)
      throw new Error(
        "Wallet bundling is unavailable. Retain only the creator wallet for launch; no bundle will be simulated",
      );
    if (!state.metadata.metadataUri)
      throw new Error(
        "Upload metadata first or enter an existing metadata URI in Coin MetaData",
      );
    const metadata = {
      name: state.metadata.name,
      symbol: state.metadata.ticker,
      description: state.metadata.description,
      image: state.metadata.imageUri,
      ...(state.metadata.twitter ? { twitter: state.metadata.twitter } : {}),
      ...(state.metadata.telegram ? { telegram: state.metadata.telegram } : {}),
      ...(state.metadata.website ? { website: state.metadata.website } : {}),
    };
    await verifyPublicMetadata(state.metadata.metadataUri, metadata);
    const wallet = await loadWallet(
      state.wallets[0].walletFile,
      await passphrase(),
    );
    if (state.deployedCa)
      throw new Error(`This session already launched ${state.deployedCa}`);
    const password = await passphrase();
    const mint = state.mintWalletFile
      ? await loadWallet(state.mintWalletFile, password)
      : Keypair.generate();
    const mintFile =
      state.mintWalletFile ??
      join(config().home, "wallets", `${mint.publicKey.toBase58()}.vault.json`);
    if (!state.mintWalletFile) {
      await saveWallet(mintFile, mint, password);
      state.mintWalletFile = mintFile;
    }
    console.log(`Encrypted mint wallet: ${mintFile}`);
    const result = await launchToken(
      metadata,
      state.metadata.metadataUri,
      wallet,
      mint,
      {
        live,
        maxDebitLamports: 50_000_000,
        maxFeeLamports: 100_000,
        minBalanceLamports: 1_000_000,
        authorize: async (review) => {
          printResult(review);
          return authorize(review);
        },
      },
    );
    if (result.status === "confirmed" && "mint" in result) {
      state.deployedCa = result.mint;
      console.log(`${green}Token Launched${reset}`);
    }
    printResult(result);
  } catch (e) {
    cliError(e);
  }
  await waitForBackKey();
}

async function runCoinSniper(): Promise<void> {
  const state: CoinSniperState = {
    target: "",
  };
  const menuItems = [
    "Snipe Ticker/Name",
    "Sniper Mainnet Wallet",
    "Trading Settings",
    "Monitor",
    "Monitor New Tokens",
    "Positions / Sell",
    "Preflight Buy",
    "Live Buy",
  ];
  let selectedIndex = 0;

  while (true) {
    renderCoinSniperMenu(menuItems, selectedIndex, state);
    const key = await readMenuKey();

    if (key === "escape") {
      renderVexumReturnSplash();
      return;
    }

    if (key === "up") {
      selectedIndex =
        selectedIndex === 0 ? menuItems.length - 1 : selectedIndex - 1;
      continue;
    }

    if (key === "down") {
      selectedIndex =
        selectedIndex === menuItems.length - 1 ? 0 : selectedIndex + 1;
      continue;
    }

    if (key !== "enter") {
      continue;
    }

    if (menuItems[selectedIndex] === "Snipe Ticker/Name") {
      await editSnipeTarget(state);
    } else if (menuItems[selectedIndex] === "Sniper Mainnet Wallet") {
      await editSniperDevWallet(state);
    } else {
      try {
        const selected = menuItems[selectedIndex];
        if (selected === "Trading Settings") {
          state.buyAmount = await promptValue(
            "Buy amount (lamports)",
            state.buyAmount ?? "1000000",
          );
          state.slippage = await promptValue(
            "Slippage (bps, max 500)",
            state.slippage ?? "100",
          );
          for (const [key, label, fallback] of [
            ["maxFee", "Maximum network fee (lamports)", "100000"],
            ["maxRent", "Maximum account rent (lamports)", "3000000"],
            [
              "maxPosition",
              "Maximum cumulative position cost (lamports)",
              "10000000",
            ],
            ["maxSpend", "Maximum wallet spending (lamports)", "50000000"],
            [
              "minBalance",
              "Minimum remaining SOL reserve (lamports)",
              "1000000",
            ],
          ] as const)
            state[key] = await promptValue(label, state[key] ?? fallback);
        } else if (
          selected === "Monitor" ||
          selected === "Monitor New Tokens"
        ) {
          console.log(
            "Monitoring observations; Ctrl-C stops. No automatic live buys.",
          );
          printResult(
            await monitorAction(state.target || undefined, {
              new: selected === "Monitor New Tokens",
            }),
          );
        } else if (selected === "Positions / Sell") {
          printResult(await positionsFile());
          if (state.devWallet?.address)
            printResult(await walletInfo(state.devWallet.address));
          const id = await terminalInput(
            "Position ID to sell (blank returns): ",
          );
          if (id)
            printResult(
              await sellAction(id, {
                wallet: state.devWallet?.walletFile,
                live: true,
                slippage: state.slippage,
                maxFee: state.maxFee,
                maxRent: state.maxRent,
                maxPosition: state.maxPosition,
                maxSpend: state.maxSpend,
                minBalance: state.minBalance,
              }),
            );
        } else {
          if (!state.target) throw new Error("Choose a target mint first");
          printResult(
            await buyAction(state.target, {
              amount: state.buyAmount ?? "1000000",
              slippage: state.slippage ?? "100",
              maxFee: state.maxFee,
              maxRent: state.maxRent,
              maxPosition: state.maxPosition,
              maxSpend: state.maxSpend,
              minBalance: state.minBalance,
              wallet: state.devWallet?.walletFile,
              preflight: selected === "Preflight Buy",
              live: selected === "Live Buy",
            }),
          );
        }
      } catch (e) {
        cliError(e);
      }
      await waitForBackKey();
    }
  }
}

async function runFudTxnBot(): Promise<void> {
  clearScreen();
  console.log(fudTxnBotBanner());
  console.log(`${bold}${pacmanYellow}FUD TXN BOT${reset}`);
  console.log(`${yellow}Coming Soon — Under Development${reset}`);
  console.log(
    `${dim}Press Esc, Backspace, ←, or Enter to return to Vexum.${reset}`,
  );
  if (input.isTTY) await waitForBackKey();
}

function renderCoinSniperMenu(
  menuItems: string[],
  selectedIndex: number,
  state: CoinSniperState,
): void {
  clearScreen();
  console.log(coinSniperBanner());
  console.log(
    `${dim}Use ↑/↓ to move, Enter to select, Esc to return to Vexum.${reset}`,
  );
  console.log("");
  console.log(
    `${brightRed}╔══════════════════════════════════════════════════════════════╗${reset}`,
  );
  console.log(
    `${brightRed}║${reset} ${bold}${pacmanYellow}Coin Sniper Menu${reset}${" ".repeat(42)}${brightRed}║${reset}`,
  );
  console.log(
    `${brightRed}╠══════════════════════════════════════════════════════════════╣${reset}`,
  );

  menuItems.forEach((item, index) => {
    const pointer = index === selectedIndex ? `${green}▶${reset}` : " ";
    const saved =
      item === "Snipe Ticker/Name" && state.target
        ? `${green}set${reset}`
        : item === "Sniper Mainnet Wallet" && state.devWallet
          ? `${green}set${reset}`
          : `${dim}open${reset}`;
    const plain = `${stripAnsi(pointer)} ${item} ${stripAnsi(saved)}`;
    const padding = Math.max(0, 60 - plain.length);
    console.log(
      `${brightRed}║${reset} ${pointer} ${item}${" ".repeat(padding)}${saved} ${brightRed}║${reset}`,
    );
  });

  console.log(
    `${brightRed}╚══════════════════════════════════════════════════════════════╝${reset}`,
  );

  if (state.target || state.devWallet) {
    console.log("");
    console.log(`${cyan}Target:${reset} ${state.target || "Blank"}`);
    console.log(
      `${cyan}Dev Wallet:${reset} ${state.devWallet?.address ?? (state.devWallet ? "Imported" : "Blank")}`,
    );
  }
}

async function editSnipeTarget(state: CoinSniperState): Promise<void> {
  clearScreen();
  console.log(coinSniperBanner());
  console.log(`${bold}${pacmanYellow}Snipe Ticker/Name${reset}`);
  console.log(
    `${dim}Enter the coin ticker or name Vexum should watch for.${reset}`,
  );
  console.log("");

  state.target = await promptValue("Ticker or coin name", state.target);

  console.log("");
  console.log(
    `${green}Save complete.${reset} Returning to Coin Sniper menu...`,
  );
  await sleep(650);
}

async function editSniperDevWallet(state: CoinSniperState): Promise<void> {
  clearScreen();
  console.log(coinSniperBanner());
  const path = await terminalInput(
    "Encrypted sniper wallet path (blank returns): ",
  );
  if (!path) return;
  const key = await loadWallet(path, await passphrase());
  const info = await walletInfo(key.publicKey.toBase58());
  state.devWallet = {
    label: "Sniper Mainnet Wallet",
    walletFile: path,
    address: info.address,
    solBalance: `${info.sol} SOL`,
  };
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
    '                 _..--"""````"""--.._',
    "           _.-'``                    ``'-._",
    "         -'                                '-",
  ];

  return [
    ...centerBlockLines(launchLines, bannerVisibleWidth(coinLines)).map(
      (line) => `${lightBlue}${line}${reset}`,
    ),
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
    '       u$$$$$$"   "$$$"   "$$$$$$u',
    '       "$$$$"      u$u       $$$$"',
    "        $$$u       u$u       u$$$",
    "        $$$u      u$$$u      u$$$",
    '         "$$$$uu$$$   $$$uu$$$$"',
    '          "$$$$$$$"   "$$$$$$$"',
    "            u$$$$$$$u$$$$$$$u",
    '             u$"$"$"$"$"$"$u',
    "  uuu        $$u$ $ $ $ $u$$       uuu",
    " u$$$$        $$$$$u$u$u$$$       u$$$$",
    '  $$$$$uu      "$$$$$$$$$"     uu$$$$$$',
    'u$$$$$$$$$$$uu    """""    uuuu$$$$$$$$$$',
    '$$$$"""$$$$$$$$$$uuu   uu$$$$$$$$$"""$$$"',
    ' """      ""$$$$$$$$$$$uu ""$"""',
    '           uuuu ""$$$$$$$$$$uuu',
    '  u$$$uuu$$$$$$$$$uu ""$$$$$$$$$$$uuu$$$',
    '  $$$$$$$$$$""""           ""$$$$$$$$$$$"',
    '   "$$$$$"                      ""$$$$""',
    '     $$$"                         $$$$"',
  ];

  return [
    ...centerBlockLines(skullLines, bannerVisibleWidth(coinLines)).map(
      (line) => `${brightRed}${line}${reset}`,
    ),
    "",
    ...coinLines.map((line) => `${brightRed}${line}${reset}`),
  ].join("\n");
}

function fudTxnBotBanner(): string {
  const lines = [
    "███████╗██╗   ██╗██████╗     ████████╗██╗  ██╗███╗   ██╗    ██████╗  ██████╗ ████████╗",
    "██╔════╝██║   ██║██╔══██╗    ╚══██╔══╝╚██╗██╔╝████╗  ██║    ██╔══██╗██╔═══██╗╚══██╔══╝",
    "█████╗  ██║   ██║██║  ██║       ██║    ╚███╔╝ ██╔██╗ ██║    ██████╔╝██║   ██║   ██║",
    "██╔══╝  ██║   ██║██║  ██║       ██║    ██╔██╗ ██║╚██╗██║    ██╔══██╗██║   ██║   ██║",
    "██║     ╚██████╔╝██████╔╝       ██║   ██╔╝ ██╗██║ ╚████║    ██████╔╝╚██████╔╝   ██║",
    "╚═╝      ╚═════╝ ╚═════╝        ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═══╝    ╚═════╝  ╚═════╝    ╚═╝",
  ];
  const fudArtLines = [
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⣄⣄⠀⠀⠀⠀⣀⣠⣠⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⡿⣆⠀⠀⣀⣸⣿⡟⠈⣿⣿⠀⠀⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⣼⣶⣿⡿⠿⠿⠷⣶⡟⣳⠖⠋⠁⠀⠀⠈⠙⣟⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣴⠖⠒⠒⠚⣻⠟⠁⠀⠀⠀⠀⠀⠈⠳⡀⢀⣀⠤⠴⠒⠒⠚⠓⣲⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⣠⡴⠛⠉⠘⡆⠀⠐⡼⠁⠀⢀⡤⠚⠉⠁⠀⠈⣙⣻⣥⣀⢀⣠⣶⠿⠛⢛⣉⡩⠽⢷⡄⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⢰⡟⠉⠀⡤⠦⡄⢹⠀⢴⠁⠀⠐⠋⠀⠀⣀⣴⡾⠟⠛⠉⣉⣹⣿⣉⡤⠖⣹⣿⣿⣿⣦⣠⠇⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠈⣧⠀⢸⠀⠀⡇⢸⡀⡏⠀⠀⠀⠀⣠⣾⠟⠁⣀⣤⣶⣿⣷⣄⢀⣇⣀⣀⡿⠿⠟⠋⣩⠋⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢻⡀⠈⠳⠚⠁⠀⣷⠁⠀⠀⠀⠾⠯⠥⣖⣉⠁⣿⣿⡿⠾⣏⡽⠋⠀⠀⠀⣀⡠⢶⡁⠀⠀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠈⢧⠀⠀⣀⡀⠀⢸⠀⠀⠀⠀⠀⠀⠀⠑⠛⠛⠛⠃⢀⡽⠋⠀⠀⠈⠉⠉⠁⠀⠀⠈⢣⡀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⢸⡀⠸⡿⡃⠀⠸⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠞⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⣷⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠘⣇⡴⠋⠙⣧⠀⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣠⠤⢴⣚⣭⣾⡏⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⢀⡟⠁⠀⠀⣾⢦⢿⠀⠀⠀⠀⠀⢀⡤⠖⣛⣛⣉⣉⣉⣉⣭⣭⠥⠶⠖⢛⣋⣭⣶⠟⠁⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⠸⣴⢶⣄⣠⣟⣾⠘⠀⠀⠀⠀⠀⢸⣀⣋⣩⠥⠭⠤⠴⠶⠶⠞⠓⠛⠋⠉⣡⠞⢿⣦⡀⠀⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⠀⢰⢇⣿⠚⠛⠚⠃⢸⠀⠀⠀⠀⠳⢄⡉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠠⢺⠁⠀⠀⠳⣽⣄⠀⠀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⠀⢠⣿⠏⣯⠀⠀⣀⠀⠈⡆⠀⠰⢄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⠆⠀⠀⠀⠈⢯⣳⡀⠀⠀⠀",
    "⠀⠀⠀⠀⠀⢠⣿⠏⠀⢸⠀⠸⡿⠀⠀⡿⠀⠐⠀⠀⠀⠀⠀⣀⣀⢀⣀⣠⡤⠤⢤⠴⠒⠛⠋⠀⠀⠀⠀⠀⠀⢳⠹⣒⡶⢖",
    "⢀⡀⠀⠀⢠⡿⡞⠀⠀⠸⣧⠤⠤⡠⠤⣧⣠⠴⠒⠒⠲⢾⡉⣩⠋⢻⣿⡉⢑⣖⣡⣤⣤⣶⡆⠀⠀⠀⠀⠀⠀⢸⡀⢷⣿⠁",
    "⠸⣯⣓⠊⡿⢾⠀⠀⠀⠀⣷⣄⣀⣀⣀⢸⡀⣀⣀⣠⣤⣤⢿⣷⣶⡏⠈⣿⣿⡿⠿⠿⠟⢻⡇⠀⠀⠀⠀⠀⠀⠀⡇⡈⡏⢇",
    "⠀⠀⡞⠀⠇⢸⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣫⣿⣿⡿⠿⠿⠘⠟⠋⢓⣾⠋⠀⠀⠀⠀⣀⣼⠇⠀⠀⠀⠀⠀⠀⠈⢧⣷⠟⠟",
    "⠀⠀⠉⠉⠉⠉⠀⠀⠀⠀⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀",
  ];

  return [
    ...centerBlockLines(fudArtLines, bannerVisibleWidth(lines)).map(
      (line) => `${pacmanYellow}${line}${reset}`,
    ),
    "",
    ...lines.map((line) => `${pacmanYellow}${line}${reset}`),
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
  const suffix = current ? ` [${current}]` : "";
  return (await terminalInput(`${cyan}${label}${reset}${suffix}: `)) || current;
}

async function waitForBackKey(): Promise<void> {
  while (true) {
    const key = await readMenuKey();
    if (
      key === "escape" ||
      key === "left" ||
      key === "backspace" ||
      key === "enter"
    ) {
      return;
    }
  }
}

async function readMenuKey(): Promise<MenuKey> {
  return menuKey();
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
  return Boolean(
    metadata.name &&
      metadata.ticker &&
      (metadata.photoPath || metadata.imageUri),
  );
}

function maskSecret(_value: string): string {
  return "[encrypted wallet]";
}

function looksLikeCoinLauncherRequest(request: string): boolean {
  return /^(?:(?:please\s+)?(?:open|start|run)\s+)?coin\s+launcher$/i.test(
    request.trim(),
  );
}

function looksLikeCoinSniperRequest(request: string): boolean {
  return /^(?:(?:please\s+)?(?:open|start|run)\s+)?coin\s+sniper$/i.test(
    request.trim(),
  );
}

function looksLikeFudTxnBotRequest(request: string): boolean {
  return (
    /^(?:(?:open|start|run)\s+)?fud\s+(?:txn|transaction)\s+bot$/i.test(
      request.trim(),
    ) || /^fud\s+bot$/i.test(request.trim())
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

try {
  process.exitCode = Math.max(
    process.exitCode ? Number(process.exitCode) : 0,
    await main(process.argv.slice(2)),
  );
} catch (error) {
  process.exitCode = cliError(error);
}
