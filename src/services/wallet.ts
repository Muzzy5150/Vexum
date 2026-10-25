import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as derive,
} from "node:crypto";
import { promisify } from "node:util";
import { readFile, mkdir, open, lstat } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import { setImmediate as yieldLoop } from "node:timers/promises";
const scrypt = promisify(derive);
export function address(value: string): string {
  try {
    const key = new PublicKey(value);
    if (key.toBase58() !== value) throw new Error();
    return value;
  } catch {
    throw new Error(
      "Invalid Solana address: expected canonical base58 encoding of 32 bytes",
    );
  }
}
export function parseKey(value: string): Keypair {
  let bytes: Uint8Array;
  try {
    bytes = value.trim().startsWith("[")
      ? Uint8Array.from(
          z
            .array(z.number().int().min(0).max(255))
            .length(64)
            .parse(JSON.parse(value)),
        )
      : bs58.decode(value.trim());
  } catch {
    throw new Error("Invalid secret key encoding");
  }
  try {
    if (bytes.length !== 64) throw new Error();
    return Keypair.fromSecretKey(Uint8Array.from(bytes)); // SDK validates derived public key against supplied public half.
  } catch {
    throw new Error("Invalid Ed25519 secret key or public key mismatch");
  } finally {
    bytes.fill(0);
  }
}
export async function generateWallet(
  prefix = "",
  options: {
    maxAttempts?: number;
    timeoutMs?: number;
    signal?: AbortSignal;
    progress?: (n: number) => void;
  } = {},
) {
  if (prefix && (!/^[1-9A-HJ-NP-Za-km-z]+$/.test(prefix) || prefix.length > 8))
    throw new Error(
      "Vanity prefix must contain 1–8 base58 characters (no 0, O, I or l)",
    );
  const start = Date.now();
  for (
    let attempts = 1;
    attempts <= (options.maxAttempts ?? 2_000_000);
    attempts++
  ) {
    options.signal?.throwIfAborted();
    if (Date.now() - start > (options.timeoutMs ?? 60_000))
      throw new Error("Vanity search timed out; no wallet saved");
    const keypair = Keypair.generate();
    if (keypair.publicKey.toBase58().startsWith(prefix))
      return { keypair, attempts };
    keypair.secretKey.fill(0);
    if (attempts % 250 === 0) {
      options.progress?.(attempts);
      await yieldLoop();
    }
  }
  throw new Error("Vanity attempt limit reached; no wallet saved");
}
export async function privateFile(path: string, data: string | Uint8Array) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await open(path, "wx", 0o600);
  try {
    await file.writeFile(data);
    await file.sync();
  } finally {
    await file.close();
  }
  if (process.platform !== "win32") {
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
const vaultSchema = z
  .object({
    version: z.literal(1),
    kdf: z.literal("scrypt"),
    cipher: z.literal("aes-256-gcm"),
    address: z.string(),
    salt: z.string(),
    iv: z.string(),
    tag: z.string(),
    ciphertext: z.string(),
  })
  .strict();
export async function saveWallet(
  path: string,
  keypair: Keypair,
  password: string,
) {
  if (password.length < 12)
    throw new Error("Wallet passphrase must be at least 12 characters");
  const salt = randomBytes(32),
    iv = randomBytes(12);
  const key = (await scrypt(password, salt, 32)) as Buffer;
  const publicKey = keypair.publicKey.toBase58();
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`VEXUM:1:${publicKey}`));
    const secret = keypair.secretKey;
    let ciphertext: Buffer;
    try {
      ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    } finally {
      secret.fill(0);
    }
    await privateFile(
      path,
      JSON.stringify({
        version: 1,
        kdf: "scrypt",
        cipher: "aes-256-gcm",
        address: publicKey,
        salt: salt.toString("base64"),
        iv: iv.toString("base64"),
        tag: cipher.getAuthTag().toString("base64"),
        ciphertext: ciphertext.toString("base64"),
      }) + "\n",
    );
  } finally {
    key.fill(0);
  }
  return { address: publicKey, walletFile: path, encrypted: true };
}
export async function loadWallet(
  path: string,
  password: string,
): Promise<Keypair> {
  const stat = await lstat(path);
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 4096)
    throw new Error("Wallet must be a regular encrypted file (max 4 KiB)");
  if (process.platform !== "win32" && stat.mode & 0o077)
    throw new Error("Wallet file permissions must be 600");
  const data = vaultSchema.parse(JSON.parse(await readFile(path, "utf8")));
  address(data.address);
  const decode = (s: string, n: number) => {
    const b = Buffer.from(s, "base64");
    if (b.length !== n || b.toString("base64") !== s)
      throw new Error("Invalid encrypted wallet");
    return b;
  };
  const salt = decode(data.salt, 32),
    iv = decode(data.iv, 12),
    tag = decode(data.tag, 16),
    encrypted = decode(data.ciphertext, 64);
  const key = (await scrypt(password, salt, 32)) as Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(Buffer.from(`VEXUM:1:${data.address}`));
    decipher.setAuthTag(tag);
    const secret = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    try {
      const wallet = Keypair.fromSecretKey(Uint8Array.from(secret));
      if (wallet.publicKey.toBase58() !== data.address) throw new Error();
      return wallet;
    } finally {
      secret.fill(0);
    }
  } catch {
    throw new Error("Cannot unlock wallet: wrong passphrase or corrupted file");
  } finally {
    key.fill(0);
  }
}
// Explicit exports remain encrypted: compatible with VEXUM imports, never plaintext on disk.
export async function exportWallet(
  source: string,
  target: string,
  password: string,
  exportPassword: string,
) {
  const wallet = await loadWallet(source, password);
  return saveWallet(target, wallet, exportPassword);
}
