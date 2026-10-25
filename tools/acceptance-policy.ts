import {
  ExtensionType,
  getAccountLen,
  getAccountTypeOfMintType,
  getExtensionTypes,
} from "@solana/spl-token";
const readMethods = new Set([
  "getGenesisHash",
  "getAccountInfo",
  "getMultipleAccounts",
  "getMinimumBalanceForRentExemption",
  "getLatestBlockhash",
  "getFeeForMessage",
  "getSignaturesForAddress",
  "getTransaction",
]);
export function acceptanceReadMethod(body: unknown): string {
  if (typeof body !== "string")
    throw new Error("Acceptance RPC requires a JSON request");
  const parsed: unknown = JSON.parse(body);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    !("method" in parsed) ||
    typeof parsed.method !== "string" ||
    !readMethods.has(parsed.method)
  )
    throw new Error("Acceptance transport forbids this RPC method");
  return parsed.method;
}
export function acceptanceToken2022AccountBytes(tlvData: Buffer) {
  const required = getExtensionTypes(tlvData)
    .map(getAccountTypeOfMintType)
    .filter((t) => t !== ExtensionType.Uninitialized);
  return getAccountLen([
    ...new Set([...required, ExtensionType.ImmutableOwner]),
  ]);
}
