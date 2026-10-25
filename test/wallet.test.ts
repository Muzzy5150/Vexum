import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import {
  address,
  parseKey,
  generateWallet,
  saveWallet,
  loadWallet,
  exportWallet,
} from "../src/services/wallet.js";

test("Ed25519 generation, canonical address, base58 and JSON secret imports", async () => {
  const { keypair, attempts } = await generateWallet();
  assert.equal(attempts, 1);
  assert.equal(
    address(keypair.publicKey.toBase58()),
    keypair.publicKey.toBase58(),
  );
  assert.equal(
    parseKey(bs58.encode(keypair.secretKey)).publicKey.toBase58(),
    keypair.publicKey.toBase58(),
  );
  assert.equal(
    parseKey(JSON.stringify([...keypair.secretKey])).publicKey.toBase58(),
    keypair.publicKey.toBase58(),
  );
  assert.throws(() => address("1".repeat(31)), /Invalid Solana/);
  assert.throws(() => address("0".repeat(44)), /Invalid Solana/);
});
test("secret/public mismatch, seed-only, invalid bytes are rejected", () => {
  const key = Keypair.generate().secretKey;
  key[63] ^= 1;
  assert.throws(() => parseKey(bs58.encode(key)), /mismatch/);
  assert.throws(
    () => parseKey(bs58.encode(new Uint8Array(32))),
    /Invalid Ed25519/,
  );
  assert.throws(
    () => parseKey(JSON.stringify(Array(64).fill(256))),
    /encoding/,
  );
});
test("vanity search returns a matching real keypair and enforces bounded cancellation", async () => {
  const { keypair } = await generateWallet("A", {
    timeoutMs: 10000,
    maxAttempts: 5000,
  });
  assert.ok(keypair.publicKey.toBase58().startsWith("A"));
  for (const prefix of ["O", "hello", "AAAAAAAAA"])
    await assert.rejects(() => generateWallet(prefix), /prefix/);
  await assert.rejects(
    () => generateWallet("Abcdefgh", { maxAttempts: 1 }),
    /attempt limit/,
  );
  await assert.rejects(
    () => generateWallet("A", { signal: AbortSignal.abort() }),
    /abort/i,
  );
});
test("vault encryption, restricted permissions, wrong passphrase and tamper detection", async () => {
  const root = await mkdtemp(join(tmpdir(), "vexum-wallet-"));
  const path = join(root, "wallet.vault.json");
  const wallet = Keypair.generate(),
    password = "testing-passphrase-123";
  await saveWallet(path, wallet, password);
  const stored = await readFile(path, "utf8");
  assert.ok(!stored.includes(bs58.encode(wallet.secretKey)));
  assert.ok(!stored.includes(JSON.stringify([...wallet.secretKey])));
  if (process.platform !== "win32")
    assert.equal((await stat(path)).mode & 0o777, 0o600);
  assert.equal(
    (await loadWallet(path, password)).publicKey.toBase58(),
    wallet.publicKey.toBase58(),
  );
  await assert.rejects(() => saveWallet(path, wallet, password), /exist/i);
  await assert.rejects(
    () => loadWallet(path, "incorrect-password"),
    /Cannot unlock/,
  );
  const data = JSON.parse(stored);
  data.address = Keypair.generate().publicKey.toBase58();
  await writeFile(path, JSON.stringify(data));
  await assert.rejects(() => loadWallet(path, password), /Cannot unlock/);
});
test("wallet export is opt-in encrypted rewrapping and weak passwords fail", async () => {
  const root = await mkdtemp(join(tmpdir(), "vexum-export-"));
  const wallet = Keypair.generate();
  await assert.rejects(
    () => saveWallet(join(root, "weak"), wallet, "weak"),
    /12/,
  );
  await saveWallet(join(root, "source"), wallet, "first-password-123");
  await exportWallet(
    join(root, "source"),
    join(root, "target"),
    "first-password-123",
    "export-password-456",
  );
  assert.equal(
    (
      await loadWallet(join(root, "target"), "export-password-456")
    ).publicKey.toBase58(),
    wallet.publicKey.toBase58(),
  );
  assert.notEqual(
    await readFile(join(root, "source"), "utf8"),
    await readFile(join(root, "target"), "utf8"),
  );
});
