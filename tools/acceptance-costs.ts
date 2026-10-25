// Optional acceptance cost evidence only. No wallet access, signing, funding or submission.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMintLen,
  getAccountLen,
  ExtensionType,
  TYPE_SIZE,
  LENGTH_SIZE,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { pack } from "@solana/spl-token-metadata";
import { config, redact, SOL_MINT } from "../src/core/config.js";
import { assertNetwork } from "../src/services/transactions.js";
import {
  defaultLimits,
  swapBuild,
  buildSchema,
  validateSwap,
  swapTransaction,
} from "../src/services/trading.js";
import { launchInstructions } from "../src/services/launch.js";
import { PUMP_PROGRAM_ID, PUMP_SDK } from "../src/core/pump.js";
import {
  acceptanceReadMethod,
  acceptanceToken2022AccountBytes,
} from "./acceptance-policy.js";
import { printResult } from "../src/cli.js";
process.env.VEXUM_NO_BROADCAST = "1";
if (config().cluster !== "mainnet-beta") throw new Error("Mainnet required");
const methods = new Set<string>();
const conn = new Connection(config().endpoints[0], {
  commitment: "confirmed",
  disableRetryOnRateLimit: true,
  fetch: async (u, init) => {
    methods.add(acceptanceReadMethod(init?.body));
    return fetch(u, { ...init, signal: AbortSignal.timeout(15000) });
  },
});
const evidenceFile = process.argv[2];
if (!evidenceFile)
  throw new Error("Usage: tsx tools/acceptance-costs.ts PROVIDER_EVIDENCE_LOG");
const text = await readFile(evidenceFile, "utf8");
const observed = JSON.parse(text.slice(text.indexOf("{")));
const report: Record<string, unknown> = {
  observedAt: new Date().toISOString(),
  genesis: await assertNetwork(conn),
  purpose:
    "Read-only engineering cost components; no designated wallet or approval request",
  signatures: [],
  actualControlledTransactionCosts: null,
  signing: false,
  broadcasting: false,
};
async function check(name: string, run: () => Promise<unknown>) {
  try {
    report[name] = { status: "observed", result: await run() };
  } catch (e) {
    report[name] = { status: "unavailable", reason: redact(e) };
  }
}
const rent = new Map<number, number>();
const coreFeeModelHash =
  "51d41542456639a01820c747e72b9d3b4ca258930a5bbb7e78db0cda133dc209";
let coreFeeModelMatches = false;
async function rentFor(bytes: number) {
  if (!rent.has(bytes))
    rent.set(
      bytes,
      await conn.getMinimumBalanceForRentExemption(bytes, "confirmed"),
    );
  return rent.get(bytes)!;
}
await check("coreExecutable", async () => {
  const program = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d"),
    a = await conn.getAccountInfo(program, "confirmed");
  if (
    !a?.executable ||
    a.owner.toBase58() !== "BPFLoaderUpgradeab1e11111111111111111111111" ||
    a.data.readUInt32LE(0) !== 2
  )
    throw new Error("Unexpected Core executable account");
  const dataAddress = new PublicKey(a.data.subarray(4, 36)),
    data = await conn.getAccountInfo(dataAddress, "confirmed");
  if (!data || !data.owner.equals(a.owner) || data.data.readUInt32LE(0) !== 3)
    throw new Error("Unexpected Core ProgramData");
  const hash = createHash("sha256")
    .update(data.data.subarray(45))
    .digest("hex");
  coreFeeModelMatches = hash === coreFeeModelHash;
  return {
    program: program.toBase58(),
    programData: dataAddress.toBase58(),
    executableSha256: hash,
    equalsPreviouslyDevnetSvmTestedExecutable:
      hash ===
      "7e033fd24ce189d9e7dc2600152c6c88ce80d662deeeb7ecc64f0c8437867cf7",
    interpretation: "Executable-byte comparison, not funded mainnet execution",
  };
});
await check("rentAndFeeComponents", async () => {
  const reference = new PublicKey("11111111111111111111111111111111");
  // Launch constraints: 32 UTF-8 name bytes, 10 ticker bytes, 200 URI bytes.
  const metadata = pack({
    mint: reference,
    updateAuthority: reference,
    name: "N".repeat(32),
    symbol: "S".repeat(10),
    uri: "u".repeat(200),
    additionalMetadata: [],
  });
  const mintBytes =
    getMintLen([ExtensionType.MetadataPointer]) +
    TYPE_SIZE +
    LENGTH_SIZE +
    metadata.length;
  const token2022Bytes = getAccountLen([ExtensionType.ImmutableOwner]);
  const pumpMintRent = await rentFor(mintBytes),
    curveRent = await rentFor(166),
    curveTokenRent = await rentFor(token2022Bytes);
  // Core AssetV1: key+owner+Address update-authority+two string prefixes+seq None.
  // Product name <=32 UTF-16 units => at most 96 UTF-8 bytes; URI <=200 bytes.
  const coreMaxBytes = 75 + 96 + 200,
    coreRent = await rentFor(coreMaxBytes);
  return {
    unit: "lamports",
    systemAccountRent: await rentFor(0),
    splAccountRent: await rentFor(165),
    token2022Account: { bytes: token2022Bytes, rent: curveTokenRent },
    pump: {
      boundedFields: {
        nameUtf8Bytes: 32,
        symbolUtf8Bytes: 10,
        uriUtf8Bytes: 200,
      },
      mintBytes,
      mintRent: pumpMintRent,
      curveBytes: 166,
      curveRent,
      bondingCurveAtaRent: curveTokenRent,
      knownAccountRentSubtotal: pumpMintRent + curveRent + curveTokenRent,
      observedUnsignedBaseFee: 10000,
      knownSubtotalWithBaseFee:
        pumpMintRent + curveRent + curveTokenRent + 10000,
      extraProtocolOrMayhemCosts: "Unverified; not assumed zero",
      totalVerified: false,
    },
    core: {
      maximumNameUtf8Bytes: 96,
      maximumUriUtf8Bytes: 200,
      standaloneAssetBytes: coreMaxBytes,
      assetRent: coreRent,
      officialSourceCreateFee: 1500000,
      observedUnsignedBaseFee: 10000,
      sourceDerivedTotal: coreFeeModelMatches
        ? coreRent + 1500000 + 10000
        : null,
      feeModelProgramHash: coreFeeModelHash,
      feeModelMatchesObservedProgram: coreFeeModelMatches,
      feeModelReference:
        "Official mpl-core collect.rs retrieved 2026-10-25; recheck if executable changes",
      scope:
        "No collection/plugins; exact metadata and funded program behavior still need verification",
    },
    priorityPolicy: {
      pumpAndCoreBuilderMicroLamports: 0,
      note: "Current builders set no CU price; any added priority instruction needs a fresh fee estimate and approval",
    },
  };
});
await check("jupiterBuyAndConditionalExit", async () => {
  const raw = observed.jupiterBuild?.result?.build;
  const build = raw ? buildSchema.parse(raw) : null;
  if (!build)
    throw new Error("No current validated Jupiter build in supplied evidence");
  validateSwap(
    build,
    build.inputMint,
    build.outputMint,
    build.inAmount,
    defaultLimits,
  );
  const authority = build.swapInstruction.accounts.find(
    (a: { isSigner: boolean }) => a.isSigner,
  )?.pubkey;
  if (!authority) throw new Error("No reference taker");
  const payer = new PublicKey(authority); // Public reference from earlier unfunded construction, never a designated test wallet.
  const summarize = async (b: Awaited<ReturnType<typeof swapBuild>>) => {
    const t = await swapTransaction(b, payer, conn);
    const setups = b.setupInstructions.filter(
      (i) => i.programId === "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
    );
    const unique = [
      ...new Map(setups.map((i) => [i.accounts[1].pubkey, i])).values(),
    ];
    const current = unique.length
      ? await conn.getMultipleAccountsInfo(
          unique.map((i) => new PublicKey(i.accounts[1].pubkey)),
          "confirmed",
        )
      : [];
    let newAccountRent = 0;
    const accounts = [];
    for (let i = 0; i < unique.length; i++) {
      const item = unique[i],
        program = item.accounts[5].pubkey;
      let bytes = 165;
      if (program === TOKEN_2022_PROGRAM_ID.toBase58()) {
        const { unpackMint } = await import("@solana/spl-token");
        const mintKey = new PublicKey(item.accounts[3].pubkey),
          info = await conn.getAccountInfo(mintKey, "confirmed");
        if (!info) throw new Error("Setup mint missing");
        const mint = unpackMint(mintKey, info, TOKEN_2022_PROGRAM_ID);
        // Idempotent associated accounts additionally carry ImmutableOwner.
        bytes = acceptanceToken2022AccountBytes(mint.tlvData);
      }
      const required = await rentFor(bytes);
      if (!current[i]) newAccountRent += required;
      accounts.push({
        address: item.accounts[1].pubkey,
        mint: item.accounts[3].pubkey,
        program,
        exists: Boolean(current[i]),
        bytes,
        rentIfMissing: required,
      });
    }
    const fee = (await conn.getFeeForMessage(t.message, "confirmed")).value;
    if (fee === null || !Number.isSafeInteger(fee) || fee < 0)
      throw new Error("Fee unavailable or invalid");
    const price = b.computeBudgetInstructions
      .map((i) => Buffer.from(i.data, "base64"))
      .find((d) => d[0] === 3);
    const unitLimit = b.computeBudgetInstructions
      .map((i) => Buffer.from(i.data, "base64"))
      .find((d) => d[0] === 2);
    const reservedUnits = unitLimit ? unitLimit.readUInt32LE(1) : 1400000;
    const priority = price
      ? Number(
          (price.readBigUInt64LE(1) * BigInt(reservedUnits) + 999999n) /
            1000000n,
        )
      : 0;
    return {
      quotedAt: new Date().toISOString(),
      inputMint: b.inputMint,
      outputMint: b.outputMint,
      inputAtomic: b.inAmount,
      quotedOutputAtomic: b.outAmount,
      minimumOutputAtomic: b.otherAmountThreshold,
      slippageBps: b.slippageBps,
      totalNetworkFee: fee,
      configuredFeeCap: defaultLimits.maxFeeLamports,
      withinConfiguredFeeCap: fee <= defaultLimits.maxFeeLamports,
      priorityFeeReservation: priority,
      setupAccounts: accounts,
      temporaryAndPersistentAtaRent: newAccountRent,
      platformFeeBps: 0,
      routePlan: b.routePlan ?? null,
      interpretation:
        "Actual Metis build; ATA rent is a reference-address snapshot, not a designated-wallet estimate. Temporary WSOL rent may be refunded. AMM fees are embedded in the quote, not added twice.",
      fundedSimulationVerified: false,
    };
  };
  const freshBuild = await swapBuild(
    build.inputMint,
    build.outputMint,
    build.inAmount,
    authority,
    defaultLimits,
  );
  const buy = await summarize(freshBuild);
  // Conditional quote input is the buy minimum, not an owned token balance or a claimed fill.
  const exitBuild = await swapBuild(
    freshBuild.outputMint,
    SOL_MINT,
    freshBuild.otherAmountThreshold,
    authority,
    defaultLimits,
  );
  return {
    referenceTaker: authority,
    designatedTestWallet: false,
    buy,
    conditionalExit: await summarize(exitBuild),
    exitQuantityDerivedFromQuoteMinimum: true,
    actualFill: null,
  };
});
await check("observedPumpAccountSizes", async () => {
  const e = observed.pumpWebSocket?.result?.events?.[0];
  if (!e) throw new Error("No fresh observed Pump event");
  const ix = (
    await launchInstructions(
      {
        name: "Read only",
        symbol: "READ",
        description: "Account lookup only",
        image: "https://example.com/image.png",
      },
      "https://example.com/metadata.json",
      new PublicKey(e.creator),
      new PublicKey(e.mint),
    )
  )[1];
  const selected = [0, 2, 3, 12, 13],
    keys = selected.map((i) => ix.keys[i].pubkey),
    accounts = await conn.getMultipleAccountsInfo(keys, "confirmed");
  const curve = accounts[1];
  if (!curve?.owner.equals(PUMP_PROGRAM_ID))
    throw new Error("Observed bonding curve missing");
  const decoded = PUMP_SDK.decodeBondingCurve(curve),
    out = [];
  for (let i = 0; i < keys.length; i++) {
    const a = accounts[i];
    out.push({
      address: keys[i].toBase58(),
      role: ["mint", "bondingCurve", "curveAta", "mayhemState", "mayhemAta"][i],
      exists: Boolean(a),
      bytes: a?.data.length ?? null,
      lamports: a?.lamports ?? null,
      minimumRent: a ? await rentFor(a.data.length) : null,
    });
  }
  return {
    externalMint: e.mint,
    externalCreator: e.creator,
    isMayhemMode: decoded.isMayhemMode,
    accounts: out,
    interpretation:
      "Public external-token accounts; VEXUM did not create or control this token. Balance changes/trades may have changed state after creation.",
  };
});
await check("recentExternalCoreCreation", async () => {
  const program = new PublicKey("CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d");
  const history = await conn.getSignaturesForAddress(
    program,
    { limit: 3 },
    "confirmed",
  );
  for (const s of history) {
    if (s.err) continue;
    const tx = await conn.getParsedTransaction(s.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (!tx?.meta || tx.meta.err) continue;
    const ix = tx.transaction.message.instructions.find(
      (i) => i.programId.equals(program) && "data" in i,
    );
    if (!ix || !("data" in ix)) continue;
    const bs58 = (await import("bs58")).default,
      data = bs58.decode(ix.data);
    if (data[0] !== 0) continue;
    const asset = ix.accounts[0],
      account = await conn.getAccountInfo(asset, "confirmed");
    if (!account?.owner.equals(program)) continue;
    const minimum = await rentFor(account.data.length);
    return {
      externalSignature: s.signature,
      asset: asset.toBase58(),
      assetBytes: account.data.length,
      assetLamports: account.lamports,
      minimumRent: minimum,
      lamportsAboveRent: account.lamports - minimum,
      networkFee: tx.meta.fee,
      externalPayerNetDebit: tx.meta.preBalances[0] - tx.meta.postBalances[0],
      interpretation:
        "External read-only creation observation, not a VEXUM acceptance transaction or authorization",
    };
  }
  return {
    found: false,
    reason:
      "No create_v1 in bounded recent signature sample; no inference of protocol failure",
  };
});
report.rpcMethods = [...methods];
report.approvalEligible = false;
report.blockers = [
  "No designated controlled wallets or chosen swap mint",
  "Authenticated Jupiter and Pinata credentials deferred",
  "Final token/NFT metadata and permanent creation consent required",
  "Each exact message must pass funded mainnet simulation and fresh approval; no total cost is certified",
];
printResult(report);
