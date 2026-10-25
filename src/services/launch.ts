import { Keypair, PublicKey, ComputeBudgetProgram } from "@solana/web3.js";
import { PUMP_SDK, PUMP_PROGRAM_ID, bondingCurvePda } from "../core/pump.js";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { z } from "zod";
import { config, requireConfig } from "../core/config.js";
import { jsonRequest, type Fetcher } from "../core/network.js";
import {
  makeTransaction,
  connection,
  executeTransaction,
  type ExecuteOptions,
} from "./transactions.js";
import { getTokenMetadata, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { TOKEN_PROGRAMS } from "../core/config.js";

import { publicAssetUri } from "../core/metadata.js";
const publicUri = publicAssetUri;
export const launchMetadata = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(32)
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 32,
        "Token name exceeds 32 UTF-8 bytes",
      ),
    symbol: z
      .string()
      .trim()
      .min(1)
      .max(10)
      .regex(/^[a-zA-Z0-9_]+$/),
    description: z.string().max(2000),
    image: publicUri,
    twitter: z.string().url().optional(),
    telegram: z.string().url().optional(),
    website: z.string().url().optional(),
  })
  .strict();
export type LaunchMetadata = z.infer<typeof launchMetadata>;
export async function pinFile(
  path: string,
  jwt = requireConfig(config().pinataJwt, "PINATA_JWT"),
  fetcher: Fetcher = fetch,
) {
  const details = await stat(path);
  if (!details.isFile() || details.size > 10_000_000)
    throw new Error("Image must be a regular file under 10 MB");
  const mime: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const type = mime[extname(path).toLowerCase()];
  if (!type) throw new Error("Image must be PNG, JPEG, WebP or GIF");
  const bytes = await readFile(path);
  const valid =
    type === "image/png"
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216
        : type === "image/webp"
          ? bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP"
          : bytes.toString("ascii", 0, 3) === "GIF";
  if (!valid) throw new Error("Image contents do not match file extension");
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), basename(path));
  form.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));
  const result = z
    .object({
      IpfsHash: z
        .string()
        .regex(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/),
    })
    .parse(
      await jsonRequest(
        "https://api.pinata.cloud/pinning/pinFileToIPFS",
        {
          method: "POST",
          headers: { authorization: `Bearer ${jwt}` },
          body: form,
        },
        fetcher,
        0,
      ),
    );
  return `ipfs://${result.IpfsHash}`;
}
export async function pinMetadata(
  metadata: LaunchMetadata,
  jwt = requireConfig(config().pinataJwt, "PINATA_JWT"),
  fetcher: Fetcher = fetch,
) {
  const validated = launchMetadata.parse(metadata);
  const result = z
    .object({
      IpfsHash: z
        .string()
        .regex(/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/),
    })
    .parse(
      await jsonRequest(
        "https://api.pinata.cloud/pinning/pinJSONToIPFS",
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${jwt}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            pinataContent: validated,
            pinataOptions: { cidVersion: 1 },
          }),
        },
        fetcher,
        0,
      ),
    );
  return `ipfs://${result.IpfsHash}`;
}
export async function launchInstructions(
  metadata: LaunchMetadata,
  uri: string,
  creator: PublicKey,
  mint: PublicKey,
) {
  const data = launchMetadata.parse(metadata);
  publicUri.parse(uri);
  if (Buffer.byteLength(uri, "utf8") > 200)
    throw new Error("Metadata URI exceeds 200 UTF-8 bytes");
  const instruction = await PUMP_SDK.createV2Instruction({
    mint,
    name: data.name,
    symbol: data.symbol,
    uri,
    creator,
    user: creator,
    mayhemMode: false,
    cashback: false,
    holderReward: false,
  });
  if (!instruction.programId.equals(PUMP_PROGRAM_ID))
    throw new Error("Unexpected Pump program");
  return [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
    instruction,
  ];
}
export async function launchToken(
  metadata: LaunchMetadata,
  uri: string,
  creator: Keypair,
  mint: Keypair,
  options: ExecuteOptions,
  conn = connection(),
) {
  if (config().cluster !== "mainnet-beta")
    throw new Error(
      "Pump.fun integration targets mainnet; use deterministic instruction tests without broadcast",
    );
  const instructions = await launchInstructions(
    metadata,
    uri,
    creator.publicKey,
    mint.publicKey,
  );
  const built = await makeTransaction(instructions, creator.publicKey, conn);
  const result = await executeTransaction(
    built.transaction,
    [creator, mint],
    {
      ...options,
      details: {
        operation: "Pump.fun create_v2",
        name: metadata.name,
        symbol: metadata.symbol,
        mint: mint.publicKey.toBase58(),
        metadataUri: uri,
        creator: creator.publicKey.toBase58(),
      },
      intent: `launch:${mint.publicKey.toBase58()}`,
    },
    conn,
  );
  if (result.status === "dry-run")
    return {
      ...result,
      proposedMint: mint.publicKey.toBase58(),
      metadataUri: uri,
    };
  const info = await conn.getParsedAccountInfo(mint.publicKey, "confirmed");
  if (
    !info.value ||
    info.value.owner.toBase58() !== TOKEN_PROGRAMS[1] ||
    !("parsed" in info.value.data) ||
    info.value.data.parsed.type !== "mint" ||
    info.value.data.parsed.info?.decimals !== 6 ||
    info.value.data.parsed.info?.isInitialized !== true
  )
    throw new Error(
      `Launch transaction confirmed (${result.signature}) but mint verification unavailable; reconcile before proceeding`,
    );
  try {
    const tokenMetadata = await getTokenMetadata(
      conn,
      mint.publicKey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID,
    );
    if (
      !tokenMetadata ||
      !tokenMetadata.mint.equals(mint.publicKey) ||
      tokenMetadata.name !== metadata.name ||
      tokenMetadata.symbol !== metadata.symbol ||
      tokenMetadata.uri !== uri
    )
      throw new Error("Mint metadata mismatch");
    const curveInfo = await conn.getAccountInfo(
      bondingCurvePda(mint.publicKey),
      "confirmed",
    );
    if (!curveInfo || !curveInfo.owner.equals(PUMP_PROGRAM_ID))
      throw new Error("Bonding curve missing or wrong program owner");
    const curve = PUMP_SDK.decodeBondingCurve(curveInfo);
    if (
      !curve.creator.equals(creator.publicKey) ||
      curve.isMayhemMode ||
      curve.isCashbackCoin ||
      curve.isHolderReward ||
      !curve.quoteMint.equals(PublicKey.default)
    )
      throw new Error("Bonding curve configuration mismatch");
  } catch {
    throw new Error(
      `Launch transaction confirmed (${result.signature}) but metadata/curve verification failed; reconcile before proceeding`,
    );
  }
  return { ...result, mint: mint.publicKey.toBase58(), metadataUri: uri };
}
