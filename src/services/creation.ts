import { PublicKey, type ParsedInstruction } from "@solana/web3.js";
import { TOKEN_PROGRAMS } from "../core/config.js";
import { connection } from "./transactions.js";
import { address } from "./wallet.js";
import { creationEvents } from "./trading.js";

export async function tokenCreation(
  mint: string,
  maxPages = 3,
  conn = connection(),
) {
  address(mint);
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 10)
    throw new Error("Creation history pages must be 1–10");
  let before: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const history = await conn.getSignaturesForAddress(
      new PublicKey(mint),
      { limit: 1000, ...(before ? { before } : {}) },
      "confirmed",
    );
    if (!history.length)
      return {
        mint,
        creation: null,
        reason:
          "RPC returned no older signatures; archive history may be unavailable",
      };
    before = history.at(-1)!.signature;
    if (history.length === 1000) continue;
    // Only report creation from an actual initializing instruction/event, never from the oldest timestamp alone.
    for (const item of history.slice(-10).reverse()) {
      if (item.err) continue;
      const tx = await conn.getParsedTransaction(item.signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta || tx.meta.err) continue;
      const instructions = [
        ...tx.transaction.message.instructions,
        ...(tx.meta.innerInstructions ?? []).flatMap((i) => i.instructions),
      ];
      const initialize = instructions.find(
        (ix) =>
          "parsed" in ix &&
          TOKEN_PROGRAMS.includes(ix.programId.toBase58()) &&
          ["initializeMint", "initializeMint2"].includes(ix.parsed.type) &&
          ix.parsed.info.mint === mint,
      ) as ParsedInstruction | undefined;
      if (!initialize) continue;
      const pump = creationEvents(tx.meta.logMessages ?? []).find(
        (e) => e.mint === mint,
      );
      return {
        mint,
        creation: {
          signature: item.signature,
          slot: tx.slot,
          blockTime: tx.blockTime ?? null,
          feePayer: tx.transaction.message.accountKeys[0].pubkey.toBase58(),
          source: "Verified SPL mint initialization instruction",
          initialAuthority: initialize.parsed.info.mintAuthority ?? null,
          ...(pump
            ? {
                pumpCreator: pump.creator,
                name: pump.name,
                symbol: pump.symbol,
              }
            : {}),
        },
      };
    }
    return {
      mint,
      creation: null,
      reason:
        "No mint initialization found in available oldest history; creation is unverified",
    };
  }
  return {
    mint,
    creation: null,
    reason: `History exceeds ${maxPages * 1000} signatures; increase --pages or use an archive indexer`,
  };
}
