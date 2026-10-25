import { minimumOutputAmount } from "./protocols/jupiter.js";
import { Command, CommanderError, Option } from "commander";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { readFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomUUID } from "node:crypto";
import bs58 from "bs58";
import { atomicJson } from "./core/state.js";
import { config, SOL_MINT, redact, scrubSecrets } from "./core/config.js";
import { Rpc, uint } from "./core/network.js";
import { passphrase, terminalInput, authorize } from "./core/terminal.js";
import {
  address,
  generateWallet,
  saveWallet,
  loadWallet,
  parseKey,
  exportWallet,
} from "./services/wallet.js";
import {
  walletInfo,
  tokenInfo,
  searchTokens,
  resolveMint,
  transactionHistory,
} from "./services/intelligence.js";
import {
  launchMetadata,
  pinFile,
  pinMetadata,
  launchToken,
} from "./services/launch.js";
import { verifyPublicMetadata } from "./core/metadata.js";
import { tokenCreation } from "./services/creation.js";
import { nftInstructions, verifyNftAccount } from "./services/nft.js";
import {
  connection,
  makeTransaction,
  executeTransaction,
  type ExecuteOptions,
  TransactionExecutionError,
} from "./services/transactions.js";
import {
  assertWalletSettled,
  defaultLimits,
  tradeLimits,
  positionsFile,
  executionHistoryPath,
  withPositions,
  swapBuild,
  swapQuote,
  executeSwap,
  monitorCreations,
  pollMarket,
  reconcilePosition,
  type Position,
} from "./services/trading.js";
import {
  writeMetadata,
  writeTokenPlan,
  domainLookup,
  auditSource,
  research,
  hyperframesRun,
} from "./services/tools.js";

type Options = Record<string, string | boolean | undefined>;
export function printResult(value: unknown) {
  console.log(
    JSON.stringify(
      value,
      (key, v: unknown) =>
        /^(privateKey|secretKey|password|passphrase|mnemonic|authorization|apiKey)$/i.test(
          key,
        )
          ? "[redacted]"
          : typeof v === "string"
            ? scrubSecrets(v).replace(/[\x00-\x1f\x7f-\x9f]/g, "")
            : typeof v === "bigint"
              ? v.toString()
              : v,
      2,
    ),
  );
}
function text(o: Options, key: string, fallback?: string) {
  const value = o[key] ?? fallback;
  if (typeof value !== "string" || !value.trim())
    throw new Error(
      `Missing --${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`,
    );
  return value;
}
function number(o: Options, key: string, fallback: number) {
  const value = Number(o[key] ?? fallback);
  if (!Number.isFinite(value)) throw new Error(`Invalid --${key}`);
  return value;
}
function integer(o: Options, key: string, fallback: number) {
  return uint.parse(number(o, key, fallback));
}
function limits(o: Options) {
  return tradeLimits.parse({
    ...defaultLimits,
    maxPositionLamports: integer(
      o,
      "maxPosition",
      defaultLimits.maxPositionLamports,
    ),
    maxSpendLamports: integer(o, "maxSpend", defaultLimits.maxSpendLamports),
    maxRentLamports: integer(o, "maxRent", defaultLimits.maxRentLamports),
    maxFeeLamports: integer(o, "maxFee", defaultLimits.maxFeeLamports),
    slippageBps: integer(o, "slippage", defaultLimits.slippageBps),
  });
}
function transactionOptions(o: Options): ExecuteOptions {
  return {
    live: o.live === true,
    maxDebitLamports: integer(o, "maxDebit", 50_000_000),
    maxFeeLamports: integer(o, "maxFee", 100_000),
    maxRentLamports: integer(o, "maxRent", 3000000),
    minBalanceLamports: integer(o, "minBalance", 1000000),
    authorize: async (review) => {
      printResult({ network: config().cluster, ...review });
      return authorize(review);
    },
  };
}
export async function createWalletAction(o: Options = {}) {
  const password = await passphrase(); // Validate persistence configuration before generating a key.
  if (password.length < 12)
    throw new Error("Wallet passphrase must be at least 12 characters");
  const result = await generateWallet(
    typeof o.prefix === "string" ? o.prefix : "",
    {
      maxAttempts: integer(o, "maxAttempts", 2_000_000),
      timeoutMs: integer(o, "timeout", 60_000),
      progress: process.stderr.isTTY
        ? (n) => process.stderr.write(`\rSearched ${n} keypairs`)
        : undefined,
    },
  );
  const file = resolve(
    typeof o.out === "string"
      ? o.out
      : join(
          config().home,
          "wallets",
          `${result.keypair.publicKey.toBase58()}.vault.json`,
        ),
  );
  const saved = await saveWallet(file, result.keypair, password);
  return { ...saved, attempts: result.attempts };
}
export async function importWalletAction(o: Options) {
  let value: string;
  if (typeof o.secretFile === "string") {
    const st = await lstat(o.secretFile);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 4096)
      throw new Error("Import source must be a regular key file under 4 KiB");
    if (process.platform !== "win32" && st.mode & 0o077)
      throw new Error("Import source permissions must be 600");
    value = await readFile(o.secretFile, "utf8");
  } else value = await terminalInput("Secret key (hidden): ", true);
  const keypair = parseKey(value);
  value = "";
  const password = await passphrase();
  return saveWallet(resolve(text(o, "out")), keypair, password);
}
async function signingWallet(o: Options) {
  return loadWallet(resolve(text(o, "wallet")), await passphrase());
}
async function mintWallet(path: string, password: string) {
  try {
    await lstat(path);
    return loadWallet(path, password);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const generated = Keypair.generate();
  await saveWallet(path, generated, password);
  return generated;
}
export async function launchAction(o: Options) {
  const metadata = launchMetadata.parse(
    JSON.parse(await readFile(text(o, "metadata"), "utf8")),
  );
  const uri = text(o, "metadataUri");
  await verifyPublicMetadata(uri, metadata);
  const password = await passphrase();
  const wallet = await loadWallet(text(o, "wallet"), password);
  const mint = await mintWallet(resolve(text(o, "mintWallet")), password);
  return launchToken(metadata, uri, wallet, mint, transactionOptions(o));
}
async function nftAction(o: Options) {
  await verifyPublicMetadata(text(o, "uri"), { name: text(o, "name") });
  const wallet = await signingWallet(o),
    password = await passphrase();
  const asset = await mintWallet(resolve(text(o, "assetWallet")), password);
  const conn = connection();
  const instructions = await nftInstructions(
    text(o, "name"),
    text(o, "uri"),
    wallet.publicKey,
    asset.publicKey,
    new PublicKey(
      typeof o.owner === "string"
        ? address(o.owner)
        : wallet.publicKey.toBase58(),
    ),
  );
  const { transaction } = await makeTransaction(
    instructions,
    wallet.publicKey,
    conn,
  );
  const result = await executeTransaction(
    transaction,
    [wallet, asset],
    {
      ...transactionOptions(o),
      details: {
        operation: "Metaplex Core NFT creation",
        name: text(o, "name"),
        uri: text(o, "uri"),
        asset: asset.publicKey.toBase58(),
      },
      intent: `nft:${asset.publicKey.toBase58()}`,
    },
    conn,
  );
  if (result.status === "confirmed") {
    const account = await conn.getAccountInfo(asset.publicKey, "confirmed");
    try {
      verifyNftAccount(
        account,
        asset.publicKey,
        new PublicKey(
          typeof o.owner === "string"
            ? address(o.owner)
            : wallet.publicKey.toBase58(),
        ),
        text(o, "name"),
        text(o, "uri"),
      );
    } catch {
      throw new Error(
        `Confirmed ${result.signature}, but Core asset data verification failed; reconcile before proceeding`,
      );
    }
  }
  return {
    ...result,
    ...(result.status === "confirmed"
      ? { asset: asset.publicKey.toBase58() }
      : { proposedAsset: asset.publicKey.toBase58() }),
  };
}
async function savePositionsDuringAction(positions: Position[]) {
  await atomicJson(executionHistoryPath(), positions);
}
export async function buyAction(target: string, o: Options = {}) {
  requireTradeMode(o);
  const mint = await resolveMint(target),
    caps = limits(o),
    amount = integer(o, "amount", 1_000_000);
  if (amount <= 0 || amount > caps.maxPositionLamports)
    throw new Error("Buy amount exceeds position cap or is zero");
  if (mint === SOL_MINT)
    throw new Error("Choose a token mint different from SOL for a buy");
  const info = await tokenInfo(mint);
  const wallet = await signingWallet(o),
    owner = wallet.publicKey.toBase58();
  return withPositions(async (positions) => {
    const relevant = positions.filter(
      (p) => p.mode === "live" && p.owner === owner,
    );
    assertWalletSettled(positions, owner);
    if (
      relevant.reduce(
        (s, p) => s + p.costLamports + (p.feeSpentLamports ?? 0),
        0,
      ) +
        amount +
        caps.maxFeeLamports +
        caps.maxRentLamports >
        caps.maxSpendLamports ||
      relevant
        .filter((p) => p.mint === mint && p.status === "open")
        .reduce((s, p) => s + p.costLamports, 0) +
        amount +
        caps.maxFeeLamports +
        caps.maxRentLamports >
        caps.maxPositionLamports
    )
      throw new Error("Live spending or position cap exceeded");
    const build = await swapBuild(SOL_MINT, mint, String(amount), owner, caps);
    const pending: Position = {
      id: typeof o.intent === "string" ? o.intent : randomUUID(),
      mode: "live",
      owner,
      mint,
      status: "pending",
      quantity: "0",
      decimals: info.decimals,
      costLamports: amount,
      observedAt: new Date().toISOString(),
    };
    let claimed = false;
    try {
      const result = await executeSwap(build, wallet, {
        ...transactionOptions(o),
        maxDebitLamports: Math.min(
          integer(
            o,
            "maxDebit",
            amount + caps.maxFeeLamports + caps.maxRentLamports,
          ),
          amount + caps.maxFeeLamports + caps.maxRentLamports,
        ),
        maxFeeLamports: caps.maxFeeLamports,
        intent: `buy:${pending.id}`,
        onClaim: async (signature) => {
          claimed = true;
          pending.signature = signature;
          pending.pendingSide = "buy";
          positions.push(pending);
          await savePositionsDuringAction(positions);
        },
      });
      if (result.status === "confirmed") {
        const tx = await connection().getTransaction(result.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta || tx.meta.err)
          throw new Error("Confirmed swap outcome unavailable");
        const before = (tx.meta.preTokenBalances ?? [])
          .filter((t) => t.owner === owner && t.mint === mint)
          .reduce((s, t) => s + BigInt(t.uiTokenAmount.amount), 0n);
        const after = (tx.meta.postTokenBalances ?? [])
          .filter((t) => t.owner === owner && t.mint === mint)
          .reduce((s, t) => s + BigInt(t.uiTokenAmount.amount), 0n);
        if (after - before < BigInt(minimumOutputAmount(build)))
          throw new Error("Actual received tokens below quoted minimum");
        pending.status = "open";
        pending.pendingSide = undefined;
        pending.quantity = (after - before).toString();
        pending.signature = result.signature;
        pending.costLamports = Math.max(
          0,
          tx.meta.preBalances[0] - tx.meta.postBalances[0],
        );
      }
      return { ...result, position: o.live ? pending : null, quote: build };
    } catch (error) {
      if (claimed) {
        if (
          error instanceof TransactionExecutionError &&
          error.outcome === "not-submitted"
        )
          positions.splice(positions.indexOf(pending), 1);
        else pending.status = "uncertain";
        await savePositionsDuringAction(positions);
      }
      throw error;
    }
  });
}
export async function sellAction(id: string, o: Options = {}) {
  requireTradeMode(o);
  const caps = limits(o);
  return withPositions(async (positions) => {
    const index = positions.findIndex((p) => p.id === id);
    if (index < 0) throw new Error("Position not found");
    const p = positions[index];
    if (p.status !== "open") throw new Error("Position is not open");
    const wallet = await signingWallet(o);
    assertWalletSettled(positions, wallet.publicKey.toBase58());
    if (wallet.publicKey.toBase58() !== p.owner)
      throw new Error("Position wallet mismatch");
    const spent = positions
      .filter((item) => item.mode === "live" && item.owner === p.owner)
      .reduce(
        (sum, item) => sum + item.costLamports + (item.feeSpentLamports ?? 0),
        0,
      );
    if (spent + caps.maxFeeLamports > caps.maxSpendLamports)
      throw new Error("Sell fee would exceed wallet spending cap");
    const build = await swapBuild(
      p.mint,
      SOL_MINT,
      p.quantity,
      wallet.publicKey.toBase58(),
      caps,
    );
    let claimed = false;
    try {
      const result = await executeSwap(build, wallet, {
        ...transactionOptions(o),
        maxDebitLamports: Math.min(
          integer(o, "maxDebit", caps.maxFeeLamports),
          caps.maxFeeLamports,
        ),
        maxFeeLamports: caps.maxFeeLamports,
        intent:
          typeof o.intent === "string"
            ? `sell:${id}:${o.intent}`
            : `sell:${id}`,
        onClaim: async (signature) => {
          claimed = true;
          p.status = "pending";
          p.signature = signature;
          p.pendingSide = "sell";
          await savePositionsDuringAction(positions);
        },
      });
      if (result.status === "confirmed") {
        const tx = await connection().getTransaction(result.signature, {
          commitment: "confirmed",
          maxSupportedTransactionVersion: 0,
        });
        if (!tx?.meta || tx.meta.err)
          throw new Error("Confirmed sell outcome unavailable");
        const before = (tx.meta.preTokenBalances ?? [])
          .filter((t) => t.owner === p.owner && t.mint === p.mint)
          .reduce((s, t) => s + BigInt(t.uiTokenAmount.amount), 0n);
        const after = (tx.meta.postTokenBalances ?? [])
          .filter((t) => t.owner === p.owner && t.mint === p.mint)
          .reduce((s, t) => s + BigInt(t.uiTokenAmount.amount), 0n);
        if (before - after !== BigInt(p.quantity))
          throw new Error("Actual sold tokens do not match position");
        p.status = "closed";
        p.pendingSide = undefined;
        p.signature = result.signature;
        p.feeSpentLamports = (p.feeSpentLamports ?? 0) + tx.meta.fee;
        p.proceedsLamports = tx.meta.postBalances[0] - tx.meta.preBalances[0];
      }
      return { ...result, position: p };
    } catch (error) {
      if (claimed) {
        if (
          error instanceof TransactionExecutionError &&
          error.outcome === "not-submitted"
        ) {
          p.status = "open";
          p.pendingSide = undefined;
        } else p.status = "uncertain";
        await savePositionsDuringAction(positions);
      }
      throw error;
    }
  });
}
export async function monitorAction(
  target: string | undefined,
  o: Options = {},
) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const timer =
    typeof o.duration === "string"
      ? setTimeout(stop, integer(o, "duration", 60000))
      : undefined;
  try {
    if (o.new) {
      await monitorCreations({
        target,
        signal: controller.signal,
        onEvent: async (event) => {
          let market: unknown;
          try {
            market = await tokenInfo(event.mint);
          } catch (e) {
            market = { unavailable: redact(e) };
          }
          printResult({
            event,
            market,
            mode: "observation-only",
            note: "Choose an exact mint for a reviewed mainnet trade; monitoring never auto-buys",
          });
        },
        onError: (error) => process.stderr.write(error + "\n"),
      });
    } else {
      if (!target) throw new Error("Monitoring requires mint/ticker or --new");
      const mint = await resolveMint(target);
      await pollMarket(
        mint,
        controller.signal,
        async (pairs) => {
          printResult({ mint, observedAt: new Date().toISOString(), pairs });
        },
        integer(o, "interval", 5000),
      );
    }
  } finally {
    if (timer) clearTimeout(timer);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
  return { status: "stopped" };
}
export function requireTradeMode(o: Options) {
  if (o.live && o.preflight)
    throw new Error("Choose --live or --preflight, not both");
  if (!o.live && !o.preflight)
    throw new Error(
      "Choose --preflight for security simulation or --live for exact transaction approval; no execution fallback exists",
    );
}
function txFlags(command: Command) {
  return command
    .option(
      "--live",
      "Request live signing after explicit terminal confirmation",
    )
    .option("--max-debit <lamports>", "Maximum total SOL debit", "50000000")
    .option("--max-fee <lamports>", "Maximum network fee", "100000")
    .option(
      "--min-balance <lamports>",
      "Minimum SOL reserve after spending and fees",
      "1000000",
    );
}
function tradeFlags(command: Command) {
  return txFlags(command)
    .option(
      "--preflight",
      "Security preflight: simulate a real mainnet transaction without signing",
    )
    .requiredOption("--wallet <vault>", "Encrypted signing wallet")
    .option("--slippage <bps>", "Slippage basis points (1–500)", "100")
    .option(
      "--max-position <lamports>",
      "Maximum cumulative position cost",
      "10000000",
    )
    .option(
      "--max-spend <lamports>",
      "Maximum lifetime wallet spending",
      "50000000",
    )
    .option(
      "--max-rent <lamports>",
      "Maximum rent for new token accounts",
      "3000000",
    )
    .option("--intent <id>", "Durable operation identifier");
}
const structuredNames = new Set([
  "wallet",
  "token",
  "metadata",
  "launch",
  "nft",
  "trade",
  "sniper",
  "domain",
  "audit",
  "research",
  "hyperframes",
  "transfer",
  "transaction",
  "fud",
]);
export async function runStructured(argv: string[]): Promise<boolean> {
  if (!structuredNames.has(argv[0])) return false;
  const program = new Command()
    .name("vexum")
    .exitOverride()
    .showHelpAfterError()
    .configureOutput({
      outputError: (message, write) => write(redact(message) + "\n"),
    });
  program.hook("preAction", (_root, action) => {
    const path: string[] = [];
    for (let c: Command | null = action; c; c = c.parent) path.push(c.name());
    if (
      (path.some((n) =>
        [
          "trade",
          "sniper",
          "launch",
          "nft",
          "transfer",
          "transaction",
          "token",
        ].includes(n),
      ) ||
        (path.includes("wallet") &&
          ["info", "history"].includes(action.name()))) &&
      config().cluster !== "mainnet-beta"
    )
      throw new Error("VEXUM blockchain commands require Solana Mainnet Beta");
  });
  const wallet = program
    .command("wallet")
    .description("Encrypted Ed25519 wallets and RPC inspection");
  wallet
    .command("create")
    .option("--prefix <prefix>")
    .option("--out <vault>")
    .option("--max-attempts <count>")
    .option("--timeout <ms>")
    .action(async (o) => printResult(await createWalletAction(o)));
  wallet
    .command("import")
    .requiredOption("--out <vault>")
    .option("--secret-file <file>")
    .action(async (o) => printResult(await importWalletAction(o)));
  wallet.command("show <vault>").action(async (path) => {
    const key = await loadWallet(path, await passphrase());
    printResult({ address: key.publicKey.toBase58() });
  });
  wallet
    .command("reveal <vault>")
    .requiredOption(
      "--show-secret",
      "Explicitly request sensitive terminal output",
    )
    .action(async (path) => {
      if (
        (await terminalInput("Type REVEAL to display the private key: ")) !==
        "REVEAL"
      )
        throw new Error("Secret display declined");
      const key = await loadWallet(path, await passphrase());
      console.log(bs58.encode(key.secretKey));
    });
  wallet
    .command("export <vault>")
    .requiredOption("--out <vault>")
    .action(async (path, o) =>
      printResult(
        await exportWallet(
          path,
          o.out,
          await passphrase(),
          await passphrase("Export passphrase", "VEXUM_EXPORT_PASSPHRASE"),
        ),
      ),
    );
  wallet
    .command("info <address>")
    .option("--limit <n>")
    .action(async (a, o) =>
      printResult(await walletInfo(a, new Rpc(), integer(o, "limit", 20))),
    );
  wallet
    .command("history <address>")
    .option("--limit <n>")
    .option("--before <signature>")
    .action(async (a, o) =>
      printResult(
        await transactionHistory(
          a,
          new Rpc(),
          integer(o, "limit", 20),
          o.before,
        ),
      ),
    );
  const token = program.command("token");
  token
    .command("scan <mint>")
    .option("--creation", "Inspect bounded creation history")
    .option("--pages <n>", "Maximum history pages", "3")
    .action(async (mint, o) =>
      printResult({
        ...(await tokenInfo(mint)),
        ...(o.creation
          ? {
              creationEvidence: await tokenCreation(
                mint,
                integer(o, "pages", 3),
              ),
            }
          : {}),
      }),
    );
  token
    .command("creation <mint>")
    .option("--pages <n>", "Maximum history pages", "3")
    .action(async (mint, o) =>
      printResult(await tokenCreation(mint, integer(o, "pages", 3))),
    );
  token
    .command("search <query>")
    .action(async (query) => printResult(await searchTokens(query)));
  token
    .command("plan")
    .requiredOption("--name <name>")
    .requiredOption("--symbol <symbol>")
    .requiredOption("--supply <integer>")
    .requiredOption("--owner <address>")
    .option("--decimals <n>", "Token decimals", "9")
    .requiredOption("--out <file>")
    .action(async (o) =>
      printResult(
        await writeTokenPlan(
          {
            name: o.name,
            symbol: o.symbol,
            supply: o.supply,
            decimals: integer(o, "decimals", 9),
            owner: o.owner,
          },
          o.out,
        ),
      ),
    );
  program
    .command("metadata")
    .description("Create valid NFT metadata files")
    .command("create")
    .option("--input <json>")
    .option("--name <name>")
    .option("--symbol <symbol>")
    .option("--description <text>")
    .option("--image <uri>")
    .option("--royalties <bps>", "Royalty basis points", "0")
    .requiredOption("--out <file>")
    .action(async (o) => {
      const data = o.input
        ? JSON.parse(await readFile(o.input, "utf8"))
        : {
            name: text(o, "name"),
            symbol: typeof o.symbol === "string" ? o.symbol : "",
            description: typeof o.description === "string" ? o.description : "",
            image: text(o, "image"),
            seller_fee_basis_points: integer(o, "royalties", 0),
          };
      printResult(await writeMetadata(data, o.out));
    });
  const launch = program
    .command("launch")
    .description("Pump.fun token creation; dry-run by default");
  launch
    .command("upload")
    .requiredOption("--metadata <json>")
    .requiredOption("--image <file>")
    .action(async (o) => {
      const data = JSON.parse(await readFile(o.metadata, "utf8"));
      const metadata = launchMetadata.parse({
        ...data,
        image: "ipfs://pending",
      });
      metadata.image = await pinFile(o.image);
      printResult({ metadata, metadataUri: await pinMetadata(metadata) });
    });
  txFlags(
    launch
      .command("run")
      .requiredOption("--metadata <json>")
      .requiredOption("--metadata-uri <uri>")
      .requiredOption("--wallet <vault>")
      .requiredOption("--mint-wallet <vault>"),
  ).action(async (o) => printResult(await launchAction(o)));
  txFlags(
    program
      .command("nft")
      .command("mint")
      .requiredOption("--name <name>")
      .requiredOption("--uri <uri>")
      .requiredOption("--wallet <vault>")
      .requiredOption("--asset-wallet <vault>")
      .option("--owner <address>"),
  ).action(async (o) => printResult(await nftAction(o)));
  const trade = program
    .command("trade")
    .description(
      "Real mainnet trading; choose --preflight or --live with exact confirmation",
    );
  tradeFlags(
    trade
      .command("buy <mint>")
      .option(
        "--amount <lamports>",
        "SOL budget including conservative costs",
        "1000000",
      ),
  ).action(async (mint, o) => printResult(await buyAction(mint, o)));
  tradeFlags(trade.command("sell <position>")).action(async (id, o) =>
    printResult(await sellAction(id, o)),
  );
  trade.command("reconcile <position>").action(async (id) =>
    printResult(
      await withPositions(async (positions) => {
        const i = positions.findIndex((p) => p.id === id);
        if (i < 0) throw new Error("Position not found");
        positions[i] = await reconcilePosition(positions[i]);
        return positions[i];
      }),
    ),
  );
  trade
    .command("positions <owner>")
    .description(
      "Real on-chain SOL and SPL balances for an exact owner address",
    )
    .action(async (owner) => printResult(await walletInfo(address(owner))));
  trade
    .command("history")
    .description("Persisted mainnet execution history; no portfolio valuation")
    .action(async () => printResult(await positionsFile()));
  trade
    .command("quote <inputMint> <outputMint> <amount>")
    .option("--slippage <bps>")
    .action(async (i, o, a, opts) =>
      printResult(await swapQuote(i, o, a, limits(opts))),
    );
  program
    .command("sniper")
    .command("monitor [target]")
    .option("--new", "Subscribe to Pump.fun creation events; observation only")
    .option("--duration <ms>")
    .option("--interval <ms>", "Market polling interval", "5000")
    .action(async (t, o) => printResult(await monitorAction(t, o)));
  program
    .command("domain <domain>")
    .action(async (domain) => printResult(await domainLookup(domain)));
  program
    .command("audit <path>")
    .action(async (path) => printResult(await auditSource(path)));
  program
    .command("research <url>")
    .action(async (url) => printResult(await research(url)));
  program
    .command("hyperframes <project>")
    .addOption(
      new Option("--operation <operation>")
        .choices(["lint", "check", "render"])
        .default("check"),
    )
    .action(async (p, o) => printResult(await hyperframesRun(p, o.operation)));
  txFlags(
    program
      .command("transfer <recipient>")
      .requiredOption("--wallet <vault>")
      .requiredOption("--lamports <amount>")
      .option("--intent <id>", "Durable transfer operation identifier"),
  ).action(async (to, o) => {
    const wallet = await signingWallet(o),
      amount = integer(o, "lamports", 0);
    if (amount < 1) throw new Error("Transfer amount must be positive");
    const conn = connection();
    const built = await makeTransaction(
      [
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(address(to)),
          lamports: amount,
        }),
      ],
      wallet.publicKey,
      conn,
    );
    printResult(
      await executeTransaction(
        built.transaction,
        [wallet],
        {
          ...transactionOptions(o),
          intent: typeof o.intent === "string" ? o.intent : undefined,
          details: {
            operation: "SOL transfer",
            recipient: to,
            lamports: amount,
          },
        },
        conn,
      ),
    );
  });
  program
    .command("transaction")
    .command("status <signature>")
    .action(async (signature) => {
      if (bs58.decode(signature).length !== 64)
        throw new Error("Invalid transaction signature");
      printResult(
        (
          await connection().getSignatureStatuses([signature], {
            searchTransactionHistory: true,
          })
        ).value[0] ?? { status: "unknown" },
      );
    });
  program
    .command("fud")
    .description("FUD TXN BOT — Coming Soon")
    .action(() => console.log("FUD TXN BOT — Coming Soon"));
  await program.parseAsync(argv, { from: "user" });
  return true;
}
export function naturalArguments(request: string): string[] | null {
  const mint = request.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/)?.[0];
  if (
    /\b(scan|inspect|balance|history|info|about)\b/i.test(request) &&
    /\bwallet\b/i.test(request)
  ) {
    if (!mint)
      throw new Error("Wallet inspection requires an exact Solana address");
    return ["wallet", /\bhistory\b/i.test(request) ? "history" : "info", mint];
  }
  if (
    mint &&
    (/\b(scan|token|contract|info|about|holders)\b/i.test(request) ||
      request.trim() === mint)
  )
    return ["token", "scan", mint];
  if (/\b(mint|generate|create)\b.*\b(wallet|keypair)\b/i.test(request)) {
    const prefix =
      request.match(/\b(?:starts?|begins?)\s+with\s+(\S+)/i)?.[1] ??
      request.match(/\b(?:prefix|vanity)\s+(\S+)/i)?.[1];
    return ["wallet", "create", ...(prefix ? ["--prefix", prefix] : [])];
  }
  if (
    /^\s*(?:look\s*up|lookup|check)\s+(?:the\s+)?(?:domain\s+)?([a-z0-9.-]+\.[a-z]{2,})\s*$/i.test(
      request,
    )
  )
    return ["domain", request.match(/([a-z0-9.-]+\.[a-z]{2,})/i)![1]];
  if (/^audit\s+(?:this\s+)?\S+$/i.test(request))
    return ["audit", request.replace(/^audit\s+(?:this\s+)?/i, "")];
  return null;
}
export function consoleArguments(request: string): string[] {
  const tokens: string[] = [];
  let value = "",
    quote = "",
    started = false;
  for (let i = 0; i < request.length; i++) {
    const c = request[i];
    if (quote) {
      if (c === quote) {
        quote = "";
      } else if (c === "\\" && [quote, "\\"].includes(request[i + 1])) {
        value += request[++i];
      } else value += c;
      started = true;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      started = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (started) {
        tokens.push(value);
        value = "";
        started = false;
      }
    } else {
      value += c;
      started = true;
    }
  }
  if (quote) throw new Error("Unclosed quote in command input");
  if (started) tokens.push(value);
  return tokens;
}
export async function runNatural(request: string) {
  const tokens = consoleArguments(request);
  if (
    structuredNames.has(tokens[0]) &&
    !(tokens[0] === "audit" && tokens[1] === "this")
  ) {
    await runStructured(tokens);
    return;
  }
  const args = naturalArguments(request);
  if (args) {
    await runStructured(args);
    return;
  }
  if (/nft|metadata/i.test(request))
    throw new Error(
      "Use metadata create --name NAME --image URI --out FILE; or nft mint --help for an authorized transaction",
    );
  if (/token|launch|supply|coin/i.test(request))
    throw new Error(
      "Use token plan --help to write a configuration, Coin Launcher for Pump.fun, or launch run --help",
    );
  if (/video|hyperframes|promo/i.test(request))
    throw new Error(
      "Use hyperframes PROJECT --operation check|render with VEXUM_HYPERFRAMES_BIN configured",
    );
  if (/audit|research|code|build|fix|debug/i.test(request))
    throw new Error(
      "Provide a real source: audit PATH, research HTTPS_JSON_URL, or token scan MINT. Generic code editing provider is not configured",
    );
  if (/send|transfer|pay|swap|trade|airdrop/i.test(request))
    throw new Error(
      "Use transfer or trade --help to specify transaction inputs and authorization",
    );
  throw new Error(
    "Unsupported request. Use help for working commands; general agent execution provider is not configured",
  );
}
export function cliError(error: unknown) {
  if (error instanceof CommanderError && error.exitCode === 0) return 0;
  console.error(`VEXUM: ${redact(error)}`);
  return 1;
}
export const structuredHelp =
  "wallet · token · metadata · launch · nft · trade · sniper · domain · audit · research · hyperframes · transfer · transaction · fud (Coming Soon). Run vexum <command> --help.";
