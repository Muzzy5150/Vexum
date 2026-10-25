import test from "node:test";
import assert from "node:assert/strict";
import { ExtensionType, getTypeLen } from "@solana/spl-token";
import {
  acceptanceReadMethod,
  acceptanceToken2022AccountBytes,
} from "../tools/acceptance-policy.js";
test("acceptance transport admits public reads and rejects signing, funding, sends and batches", () => {
  for (const method of [
    "getGenesisHash",
    "getMinimumBalanceForRentExemption",
    "getTransaction",
  ])
    assert.equal(
      acceptanceReadMethod(
        JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
      ),
      method,
    );
  for (const method of [
    "sendTransaction",
    "sendRawTransaction",
    "requestAirdrop",
    "signTransaction",
    "execute",
    "simulateTransaction",
  ])
    assert.throws(
      () => acceptanceReadMethod(JSON.stringify({ method })),
      /forbids/,
    );
  for (const invalid of [
    undefined,
    {},
    "null",
    "[]",
    '[ {"method":"getAccountInfo"} ]',
    '{"method":1}',
    "invalid json",
  ])
    assert.throws(() => acceptanceReadMethod(invalid));
});
test("Token-2022 ATA rent sizing includes ImmutableOwner without a mint extension", () => {
  assert.equal(acceptanceToken2022AccountBytes(Buffer.alloc(0)), 170);
});
test("Token-2022 ATA rent sizing combines transfer-fee and immutable-owner extensions", () => {
  const size = getTypeLen(ExtensionType.TransferFeeConfig),
    tlv = Buffer.alloc(4 + size);
  tlv.writeUInt16LE(ExtensionType.TransferFeeConfig, 0);
  tlv.writeUInt16LE(size, 2);
  assert.equal(acceptanceToken2022AccountBytes(tlv), 182);
});
