import { createPrivateKey, createPublicKey } from "node:crypto";
import bs58 from "bs58";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { z } from "zod";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const TOKEN_PROGRAMS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];
export const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
export type Cluster = "mainnet-beta" | "devnet" | "testnet" | "localnet";
export const NETWORK_GENESIS: Record<string, string> = {
  "mainnet-beta": "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
  devnet: "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",
  testnet: "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY",
};
export function verifyGenesis(genesis: string) {
  const cluster = config().cluster;
  if (
    cluster === "localnet"
      ? Object.values(NETWORK_GENESIS).includes(genesis)
      : genesis !== NETWORK_GENESIS[cluster]
  )
    throw new Error("RPC genesis hash does not match configured network");
}
export function config(env: NodeJS.ProcessEnv = process.env) {
  const cluster = z
    .enum(["mainnet-beta", "devnet", "testnet", "localnet"])
    .parse(env.VEXUM_CLUSTER ?? "mainnet-beta");
  const defaultRpc =
    cluster === "localnet"
      ? "http://127.0.0.1:8899"
      : `https://api.${cluster}.solana.com`;
  const urls = [
    env.VEXUM_SOLANA_RPC_URL,
    env.HELIUS_RPC_URL,
    ...(env.VEXUM_RPC_FALLBACKS?.split(",") ?? []),
    defaultRpc,
  ].filter((v): v is string => Boolean(v));
  return {
    cluster,
    // Explicit endpoints never silently fall back to a different network.
    endpoints: [
      ...new Set(
        env.VEXUM_SOLANA_RPC_URL || env.HELIUS_RPC_URL
          ? urls.slice(0, -1)
          : urls,
      ),
    ].map(validateEndpoint),
    home: resolve(env.VEXUM_HOME || join(homedir(), ".vexum")),
    pinataJwt: env.PINATA_JWT,
    solscanKey: env.SOLSCAN_API_KEY,
    heliusKey: env.HELIUS_API_KEY,
    jupiterKey: env.JUPITER_API_KEY,
  };
}
export function validateEndpoint(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error(
      "Provider URL must use HTTPS (HTTP allowed for loopback only), without URL credentials",
    );
  return url.toString();
}
function isSecretBytes(bytes: Uint8Array) {
  if (bytes.length !== 64) return false;
  try {
    const privateKey = createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b657004220420", "hex"),
        Buffer.from(bytes.subarray(0, 32)),
      ]),
      format: "der",
      type: "pkcs8",
    });
    const publicKey = createPublicKey(privateKey).export({
      format: "der",
      type: "spki",
    });
    return publicKey.subarray(-32).equals(Buffer.from(bytes.subarray(32)));
  } catch {
    return false;
  }
}
export function scrubSecrets(value: string): string {
  let message = value;
  for (const [key, secret] of Object.entries(process.env)) {
    if (
      secret &&
      secret.length > 5 &&
      /KEY|TOKEN|SECRET|PASSWORD|PASSPHRASE|RPC_URL/i.test(key)
    )
      message = message.split(secret).join("[redacted]");
  }
  return message
    .replace(/\b[1-9A-HJ-NP-Za-km-z]{80,90}\b/g, (candidate) => {
      let bytes: Uint8Array | undefined;
      try {
        bytes = bs58.decode(candidate);
        return isSecretBytes(bytes) ? "[redacted key]" : candidate;
      } catch {
        return candidate;
      } finally {
        bytes?.fill(0);
      }
    })
    .replace(/\[(?:\s*\d{1,3}\s*,){63}\s*\d{1,3}\s*\]/g, (candidate) => {
      try {
        const values = JSON.parse(candidate) as number[];
        return values.every((n) => n >= 0 && n <= 255) &&
          isSecretBytes(Uint8Array.from(values))
          ? "[redacted key bytes]"
          : candidate;
      } catch {
        return candidate;
      }
    });
}
export function redact(value: unknown): string {
  return scrubSecrets(value instanceof Error ? value.message : String(value))
    .replace(/https?:\/\/[^\s"<>]+/g, (s) => {
      try {
        return new URL(s).origin + "/[redacted]";
      } catch {
        return "[url]";
      }
    })
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
}
export function requireConfig(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing configuration: ${name}`);
  return value;
}
