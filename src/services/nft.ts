import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createV1,
  mplCore,
  deserializeAssetV1,
  MPL_CORE_PROGRAM_ID,
} from "@metaplex-foundation/mpl-core";
import {
  createNoopSigner,
  lamports,
  publicKey,
  signerIdentity,
} from "@metaplex-foundation/umi";
import { toWeb3JsInstruction } from "@metaplex-foundation/umi-web3js-adapters";
import { type PublicKey, type AccountInfo } from "@solana/web3.js";
import { z } from "zod";
import { publicAssetUri } from "../core/metadata.js";

export async function nftInstructions(
  name: string,
  uri: string,
  payer: PublicKey,
  asset: PublicKey,
  owner = payer,
) {
  z.string().min(1).max(32).parse(name);
  if (
    !publicAssetUri.safeParse(uri).success ||
    Buffer.byteLength(uri, "utf8") > 200
  )
    throw new Error("NFT URI must be HTTPS or IPFS and at most 200 characters");
  const umi = createUmi("https://api.mainnet-beta.solana.com").use(mplCore());
  const signer = createNoopSigner(publicKey(payer.toBase58()));
  umi.use(signerIdentity(signer));
  return createV1(umi, {
    asset: createNoopSigner(publicKey(asset.toBase58())),
    payer: signer,
    authority: signer,
    owner: publicKey(owner.toBase58()),
    name,
    uri,
  })
    .getInstructions()
    .map(toWeb3JsInstruction);
}

export function verifyNftAccount(
  account: AccountInfo<Buffer> | null,
  asset: PublicKey,
  owner: PublicKey,
  name: string,
  uri: string,
) {
  if (!account || account.owner.toBase58() !== MPL_CORE_PROGRAM_ID)
    throw new Error("Core asset program owner verification failed");
  const data = deserializeAssetV1({
    publicKey: publicKey(asset.toBase58()),
    owner: publicKey(account.owner.toBase58()),
    lamports: lamports(account.lamports),
    executable: account.executable,
    data: account.data,
  });
  if (data.owner !== owner.toBase58() || data.name !== name || data.uri !== uri)
    throw new Error(
      "Core asset owner, name or URI does not match the authorized mint",
    );
  return true;
}
