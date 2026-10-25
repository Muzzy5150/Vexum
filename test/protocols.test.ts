import test from "node:test";
import assert from "node:assert/strict";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import { PUMP_PROGRAM_ID } from "../src/core/pump.js";
import {
  launchInstructions,
  launchToken,
  pinFile,
  pinMetadata,
} from "../src/services/launch.js";
import { nftInstructions } from "../src/services/nft.js";
const creator = Keypair.generate(),
  mint = Keypair.generate();
const metadata = {
  name: "Vexum Fixture",
  symbol: "VEX",
  description: "Deterministic test metadata",
  image: "ipfs://bafytestimage",
};
test("official Pump SDK creates a real create_v2 instruction for the exact creator/mint", async () => {
  const instructions = await launchInstructions(
    metadata,
    "ipfs://bafytestmetadata",
    creator.publicKey,
    mint.publicKey,
  );
  assert.equal(instructions.length, 2);
  const create = instructions[1];
  assert.ok(create.programId.equals(PUMP_PROGRAM_ID));
  assert.ok(
    create.keys.some((k) => k.pubkey.equals(mint.publicKey) && k.isSigner),
  );
  assert.ok(
    create.keys.some((k) => k.pubkey.equals(creator.publicKey) && k.isSigner),
  );
  assert.ok(create.data.includes(Buffer.from(metadata.name)));
  assert.ok(create.data.includes(Buffer.from("ipfs://bafytestmetadata")));
  await assert.rejects(() =>
    launchInstructions(
      { ...metadata, name: "" },
      "https://example.com/metadata.json",
      creator.publicKey,
      mint.publicKey,
    ),
  );
});
test("launch simulation failure never returns a mint or successful launch", async () => {
  const conn = {
    getGenesisHash: async () => "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    getMultipleAccountsInfo: async (keys: PublicKey[]) =>
      keys.map(() => ({
        executable: true,
        owner: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      })),
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    }),
    getFeeForMessage: async () => ({ value: 10000 }),
    getBalance: async () => 1000000000,
    simulateTransaction: async () => ({
      context: { slot: 1 },
      value: { err: { InstructionError: [1, "insufficient funds"] } },
    }),
    sendRawTransaction: () => {
      throw new Error("MUST NOT SEND");
    },
  } as unknown as Connection;
  await assert.rejects(
    () =>
      launchToken(
        metadata,
        "ipfs://bafytestmetadata",
        creator,
        mint,
        { maxDebitLamports: 50000000, maxFeeLamports: 100000 },
        conn,
      ),
    /simulation failed/,
  );
});
test("launch dry-run returns proposed mint only, no signature or success claim", async () => {
  const conn = {
    getGenesisHash: async () => "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
    getMultipleAccountsInfo: async (keys: PublicKey[]) =>
      keys.map(() => ({
        executable: true,
        owner: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
      })),
    getLatestBlockhash: async () => ({
      blockhash: Keypair.generate().publicKey.toBase58(),
      lastValidBlockHeight: 1,
    }),
    getFeeForMessage: async () => ({ value: 10000 }),
    getBalance: async () => 1000000000,
    simulateTransaction: async () => ({
      context: { slot: 1 },
      value: { err: null, accounts: [{ lamports: 990000000 }] },
    }),
  } as unknown as Connection;
  const result = await launchToken(
    metadata,
    "ipfs://bafytestmetadata",
    creator,
    mint,
    { maxDebitLamports: 50000000, maxFeeLamports: 100000 },
    conn,
  );
  assert.equal(result.status, "dry-run");
  assert.ok("proposedMint" in result);
  assert.ok(!("signature" in result));
  assert.ok(!("mint" in result));
});
test("metadata upload validates provider response and missing credentials", async () => {
  const saved = process.env.PINATA_JWT;
  process.env.PINATA_JWT = "";
  try {
    await assert.rejects(() => pinFile("/not/read"), /PINATA_JWT/);
  } finally {
    if (saved === undefined) delete process.env.PINATA_JWT;
    else process.env.PINATA_JWT = saved;
  }
  let calls = 0;
  const uri = await pinMetadata(metadata, "fixture-jwt", async (url, init) => {
    calls++;
    assert.equal(new URL(String(url)).hostname, "api.pinata.cloud");
    assert.ok(String(init?.body).includes(metadata.name));
    assert.ok(!String(init?.body).includes("secretKey"));
    return Response.json({ IpfsHash: "Qm" + "a".repeat(44) });
  });
  assert.equal(calls, 1);
  assert.equal(uri, "ipfs://Qm" + "a".repeat(44));
  await assert.rejects(() =>
    pinMetadata(metadata, "fixture-jwt", async () =>
      Response.json({ unexpected: true }),
    ),
  );
});
test("Metaplex Core NFT construction produces actual instructions and correct signer accounts", async () => {
  const instructions = await nftInstructions(
    "Fixture NFT",
    "ipfs://bafytestmetadata",
    creator.publicKey,
    mint.publicKey,
  );
  assert.equal(instructions.length, 1);
  assert.ok(
    instructions[0].keys.some(
      (k) => k.pubkey.equals(mint.publicKey) && k.isSigner,
    ),
  );
  assert.ok(instructions[0].data.includes(Buffer.from("Fixture NFT")));
  await assert.rejects(
    () =>
      nftInstructions("NFT", "file:///bad", creator.publicKey, mint.publicKey),
    /URI/,
  );
});

test("image upload sends actual multipart image bytes and never retries failed uploads", async () => {
  const { mkdtemp, writeFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "vexum-image-")),
    path = join(dir, "fixture.png");
  await writeFile(
    path,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4S8AAAAASUVORK5CYII=",
      "base64",
    ),
  );
  let calls = 0;
  const uri = await pinFile(path, "fixture-jwt", async (_u, init) => {
    calls++;
    const file = (init?.body as FormData).get("file") as File;
    assert.equal(file.type, "image/png");
    assert.ok(file.size > 8);
    return Response.json({ IpfsHash: "Qm" + "a".repeat(44) });
  });
  assert.ok(uri.startsWith("ipfs://"));
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(
    () =>
      pinFile(path, "fixture-jwt", async () => {
        calls++;
        return new Response("", { status: 429 });
      }),
    /429/,
  );
  assert.equal(calls, 1);
});

test("public token metadata is fetched and must match reviewed name/image/configuration", async () => {
  const { verifyPublicMetadata } = await import("../src/core/metadata.js");
  let seen = "";
  const fetcher: typeof fetch = async (url) => {
    seen = String(url);
    return Response.json(metadata);
  };
  await verifyPublicMetadata("ipfs://bafytestmetadata", metadata, fetcher);
  assert.ok(seen.startsWith("https://ipfs.io/ipfs/"));
  await assert.rejects(
    () =>
      verifyPublicMetadata(
        "https://metadata.example/token.json",
        { ...metadata, name: "Other" },
        fetcher,
      ),
    /does not match/,
  );
  await assert.rejects(
    () =>
      verifyPublicMetadata(
        "https://metadata.example/token.json",
        metadata,
        async () => new Response("", { status: 404 }),
      ),
    /404/,
  );
  await assert.rejects(() =>
    verifyPublicMetadata(
      "https://u:p@metadata.example/token.json",
      metadata,
      fetcher,
    ),
  );
});
test("Pump launch validation rejects overlong UTF-8 fields before transaction construction", async () => {
  await assert.rejects(
    () =>
      launchInstructions(
        { ...metadata, name: "界".repeat(11) },
        "ipfs://fixture",
        creator.publicKey,
        mint.publicKey,
      ),
    /UTF-8/,
  );
  await assert.rejects(
    () =>
      launchInstructions(
        metadata,
        "https://metadata.example/" + "a".repeat(201),
        creator.publicKey,
        mint.publicKey,
      ),
    /200/,
  );
});
test("confirmed Core asset verification checks program, actual owner, name and URI", async () => {
  const { MPL_CORE_PROGRAM_ID } = await import("@metaplex-foundation/mpl-core");
  const { verifyNftAccount } = await import("../src/services/nft.js");
  const { PublicKey } = await import("@solana/web3.js");
  // Independent Borsh fixture: AssetV1 key, owner, Address authority, strings, None sequence.
  const str = (v: string) => {
    const b = Buffer.from(v);
    const n = Buffer.alloc(4);
    n.writeUInt32LE(b.length);
    return Buffer.concat([n, b]);
  };
  const data = Buffer.concat([
    Buffer.from([1]),
    creator.publicKey.toBuffer(),
    Buffer.from([1]),
    creator.publicKey.toBuffer(),
    str("Fixture NFT"),
    str("ipfs://fixture"),
    Buffer.from([0]),
  ]);
  const info = {
    owner: new PublicKey(MPL_CORE_PROGRAM_ID),
    lamports: 100000,
    data,
    executable: false,
    rentEpoch: 0,
  };
  assert.equal(
    verifyNftAccount(
      info,
      mint.publicKey,
      creator.publicKey,
      "Fixture NFT",
      "ipfs://fixture",
    ),
    true,
  );
  assert.throws(
    () =>
      verifyNftAccount(
        info,
        mint.publicKey,
        mint.publicKey,
        "Fixture NFT",
        "ipfs://fixture",
      ),
    /does not match/,
  );
  assert.throws(
    () =>
      verifyNftAccount(
        info,
        mint.publicKey,
        creator.publicKey,
        "Other",
        "ipfs://fixture",
      ),
    /does not match/,
  );
});

test("Pump create_v2 matches the independently retrieved official account and argument contract", async () => {
  const { readFile } = await import("node:fs/promises");
  const { PublicKey } = await import("@solana/web3.js");
  const { getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID } = await import(
    "@solana/spl-token"
  );
  const fixture = JSON.parse(
    await readFile(
      new URL("fixtures/pump-create-v2.json", import.meta.url),
      "utf8",
    ),
  );
  const ix = (
    await launchInstructions(
      metadata,
      "ipfs://fixture",
      creator.publicKey,
      mint.publicKey,
    )
  )[1];
  assert.equal(ix.programId.toBase58(), fixture.program);
  assert.deepEqual(
    [...ix.data.subarray(0, 8)],
    fixture.instruction.discriminator,
  );
  assert.equal(ix.keys.length, 16);
  fixture.instruction.accounts.forEach(
    (
      account: { signer?: boolean; writable?: boolean; address?: string },
      index: number,
    ) => {
      assert.equal(ix.keys[index].isSigner, account.signer ?? false);
      assert.equal(ix.keys[index].isWritable, account.writable ?? false);
      if (account.address)
        assert.equal(ix.keys[index].pubkey.toBase58(), account.address);
    },
  );
  const pda = (seed: string, ...extra: Buffer[]) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from(seed), ...extra],
      ix.programId,
    )[0];
  assert.ok(ix.keys[0].pubkey.equals(mint.publicKey));
  assert.ok(ix.keys[1].pubkey.equals(pda("mint-authority")));
  assert.ok(
    ix.keys[2].pubkey.equals(pda("bonding-curve", mint.publicKey.toBuffer())),
  );
  assert.ok(
    ix.keys[3].pubkey.equals(
      getAssociatedTokenAddressSync(
        mint.publicKey,
        ix.keys[2].pubkey,
        true,
        TOKEN_2022_PROGRAM_ID,
      ),
    ),
  );
  assert.ok(ix.keys[4].pubkey.equals(pda("global")));
  assert.ok(ix.keys[5].pubkey.equals(creator.publicKey));
  assert.ok(ix.keys[7].pubkey.equals(TOKEN_2022_PROGRAM_ID));
  const str = (v: string) => {
    const b = Buffer.from(v),
      n = Buffer.alloc(4);
    n.writeUInt32LE(b.length);
    return Buffer.concat([n, b]);
  };
  // OptionBool/OptionU64 are single-field tuple structs in the official IDL.
  const disabled = Buffer.from([0]),
    zeroFee = Buffer.alloc(8);
  assert.deepEqual(
    ix.data,
    Buffer.concat([
      Buffer.from(fixture.instruction.discriminator),
      str(metadata.name),
      str(metadata.symbol),
      str("ipfs://fixture"),
      creator.publicKey.toBuffer(),
      Buffer.from([0]),
      disabled,
      zeroFee,
      disabled,
    ]),
  );
});
test("supported Jupiter account order and argument layouts retain official CPI IDL provenance", async () => {
  const { readFile } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const fixture = JSON.parse(
      await readFile(
        new URL("fixtures/protocol-provenance.json", import.meta.url),
        "utf8",
      ),
    ),
    local = JSON.parse(
      await readFile(
        new URL("../src/protocols/jupiter-idl.json", import.meta.url),
        "utf8",
      ),
    );
  assert.equal(
    createHash("sha256").update(JSON.stringify(local)).digest("hex"),
    fixture.jupiter.localSha256,
  );
  for (const remote of fixture.jupiter.supportedInstructions) {
    const stored = local.instructions.find(
      (i: { name: string }) => i.name === remote.name,
    );
    assert.deepEqual(stored.accounts, remote.accounts);
    assert.deepEqual(
      stored.args.map((a: { name: string }) => a.name),
      remote.args.map((a: { name: string }) => a.name),
    );
  }
});

test("confirmed Pump transaction cannot report launch success without mint and metadata verification", async () => {
  const { mkdtemp } = await import("node:fs/promises"),
    { tmpdir } = await import("node:os"),
    { join } = await import("node:path");
  const bs58 = (await import("bs58")).default;
  const { VersionedTransaction } = await import("@solana/web3.js");
  const old = {
    NODE_ENV: process.env.NODE_ENV,
    VEXUM_NO_BROADCAST: process.env.VEXUM_NO_BROADCAST,
  };
  delete process.env.NODE_ENV;
  delete process.env.VEXUM_NO_BROADCAST;
  try {
    for (const initialized of [false, true]) {
      const mock = {
        getLatestBlockhash: async () => ({
          blockhash: Keypair.generate().publicKey.toBase58(),
          lastValidBlockHeight: 100,
        }),
        getGenesisHash: async () =>
          "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d",
        getMultipleAccountsInfo: async (keys: PublicKey[]) =>
          keys.map(() => ({
            executable: true,
            owner: new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111"),
          })),
        getFeeForMessage: async () => ({ value: 10000 }),
        getBalance: async () => 1000000000,
        simulateTransaction: async () => ({
          context: { slot: 1 },
          value: { err: null, accounts: [{ lamports: 990000000 }] },
        }),
        isBlockhashValid: async () => ({ value: true }),
        sendRawTransaction: async (bytes: Uint8Array) =>
          bs58.encode(VersionedTransaction.deserialize(bytes).signatures[0]),
        getSignatureStatuses: async () => ({
          value: [{ confirmationStatus: "confirmed", err: null }],
        }),
        getParsedAccountInfo: async () => ({
          value: initialized
            ? {
                owner: new PublicKey(
                  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
                ),
                data: {
                  parsed: {
                    type: "mint",
                    info: { decimals: 6, isInitialized: true },
                  },
                },
              }
            : null,
        }),
        getAccountInfo: async () => null,
      } as unknown as Connection;
      const journalDir = await mkdtemp(
        join(tmpdir(), "vexum-pump-verification-"),
      );
      await assert.rejects(
        () =>
          launchToken(
            metadata,
            "ipfs://fixture",
            creator,
            mint,
            {
              live: true,
              maxDebitLamports: 50000000,
              maxFeeLamports: 100000,
              journalDir,
              authorize: async (r) => `SUBMIT ${r.digest}`,
            },
            mock,
          ),
        /confirmed.*verification/i,
      );
    }
  } finally {
    for (const [k, v] of Object.entries(old)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});
