import test from "node:test";
import assert from "node:assert/strict";
import { Keypair, Connection } from "@solana/web3.js";
import { TOKEN_PROGRAMS } from "../src/core/config.js";
import { tokenCreation } from "../src/services/creation.js";
const mint = Keypair.generate().publicKey.toBase58(),
  payer = Keypair.generate().publicKey;
test("creation details require actual mint initialization evidence, not oldest timestamp", async () => {
  const conn = {
    getSignaturesForAddress: async () => [{ signature: "fixture", err: null }],
    getParsedTransaction: async () => ({
      slot: 123,
      blockTime: 123456,
      transaction: {
        message: {
          accountKeys: [{ pubkey: payer }],
          instructions: [
            {
              programId: { toBase58: () => TOKEN_PROGRAMS[0] },
              parsed: {
                type: "initializeMint2",
                info: { mint, mintAuthority: payer.toBase58() },
              },
            },
          ],
        },
      },
      meta: { err: null, innerInstructions: [], logMessages: [] },
    }),
  } as unknown as Connection;
  const result = await tokenCreation(mint, 1, conn);
  assert.equal(result.creation?.slot, 123);
  assert.equal(result.creation?.signature, "fixture");
  assert.equal(result.creation?.feePayer, payer.toBase58());
  const unknown = await tokenCreation(mint, 1, {
    ...conn,
    getParsedTransaction: async () => null,
  } as unknown as Connection);
  assert.equal(unknown.creation, null);
});
test("creation discovery reports bounded/incomplete history honestly", async () => {
  const conn = {
    getSignaturesForAddress: async () =>
      Array.from({ length: 1000 }, (_, i) => ({
        signature: String(i),
        err: null,
      })),
  } as unknown as Connection;
  const result = await tokenCreation(mint, 1, conn);
  assert.equal(result.creation, null);
  assert.ok(result.reason?.includes("exceeds"));
  await assert.rejects(() => tokenCreation(mint, 11, conn), /1–10/);
});
