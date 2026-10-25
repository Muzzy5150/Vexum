import * as namespace from "@pump-fun/pump-sdk";
// Works with both official ESM exports and the SDK's CJS interop under tsx.
const sdk =
  "PUMP_SDK" in namespace
    ? namespace
    : (Reflect.get(namespace, "default") as typeof namespace);
export const { PUMP_SDK, PUMP_PROGRAM_ID, pumpIdl, bondingCurvePda } = sdk;
