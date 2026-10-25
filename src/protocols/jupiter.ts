import * as anchorNamespace from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";
import idl from "./jupiter-idl.json" with { type: "json" };
import v2Idl from "./jupiter-v2-idl.json" with { type: "json" };
import type { Idl } from "@coral-xyz/anchor";
const anchor =
  "BorshInstructionCoder" in anchorNamespace
    ? anchorNamespace
    : (Reflect.get(anchorNamespace, "default") as typeof anchorNamespace);
const { BorshInstructionCoder } = anchor;
export const routeCoder = new BorshInstructionCoder(idl as unknown as Idl);
export const v2RouteCoder = new BorshInstructionCoder(v2Idl as unknown as Idl);
export function validateRouteBytes(
  data: Buffer,
  quote: {
    inAmount: string;
    outAmount: string;
    otherAmountThreshold: string;
    slippageBps: number;
  },
) {
  if (data.length > 1232)
    throw new Error("Jupiter instruction exceeds transaction size limit");
  const current = v2Idl.instructions.some((ix) =>
    Buffer.from(ix.discriminator).equals(data.subarray(0, 8)),
  );
  const coder = current ? v2RouteCoder : routeCoder;
  let decoded: ReturnType<typeof routeCoder.decode>;
  try {
    decoded = coder.decode(data);
  } catch {
    throw new Error("Malformed Jupiter instruction; no signing permitted");
  }
  if (
    !decoded ||
    !(
      current
        ? ["route_v2", "shared_accounts_route_v2"]
        : ["route", "sharedAccountsRoute"]
    ).includes(decoded.name)
  )
    throw new Error(
      "Unsupported Jupiter instruction variant; no signing permitted",
    );
  if (!coder.encode(decoded.name, decoded.data).equals(data))
    throw new Error("Jupiter instruction has trailing or noncanonical data");
  const raw = decoded.data as Record<string, unknown>;
  const fields = {
    inAmount: raw[current ? "in_amount" : "inAmount"] as { toString(): string },
    quotedOutAmount: raw[current ? "quoted_out_amount" : "quotedOutAmount"] as {
      toString(): string;
    },
    slippageBps: raw[current ? "slippage_bps" : "slippageBps"] as number,
    platformFeeBps: raw[
      current ? "platform_fee_bps" : "platformFeeBps"
    ] as number,
  };
  if (
    fields.inAmount.toString() !== quote.inAmount ||
    fields.quotedOutAmount.toString() !== quote.outAmount ||
    fields.slippageBps !== quote.slippageBps ||
    fields.platformFeeBps !== 0 ||
    (current && raw.positive_slippage_bps !== 0)
  )
    throw new Error(
      "Encoded Jupiter amounts, slippage or platform fee do not match quote",
    );
  const plan = raw[current ? "route_plan" : "routePlan"] as Array<
    Record<string, unknown>
  >;
  if (!plan.length || plan.length > 64)
    throw new Error("Invalid Jupiter route plan length");
  for (const step of plan) {
    const weight = Number(step[current ? "bps" : "percent"]);
    if (
      !Number.isInteger(weight) ||
      weight <= 0 ||
      weight > (current ? 10000 : 100)
    )
      throw new Error("Invalid Jupiter route weight");
  }
  const encodedMinimum =
    (BigInt(fields.quotedOutAmount.toString()) *
      BigInt(10000 - fields.slippageBps)) /
    10000n;
  if (
    encodedMinimum <= 0n ||
    BigInt(quote.otherAmountThreshold) < encodedMinimum ||
    BigInt(quote.otherAmountThreshold) > encodedMinimum + 1n
  )
    throw new Error(
      "Encoded Jupiter minimum output is below the approved quote",
    );
  return decoded.name;
}
export function routeAccountIndices(name: string) {
  if (name === "route_v2")
    return {
      authority: 0,
      source: 1,
      destination: 2,
      inputMint: 3,
      outputMint: 4,
      inputProgram: 5,
      outputProgram: 6,
      eventAuthority: 8,
      program: 9,
      optionalDestination: 7,
    };
  if (name === "shared_accounts_route_v2")
    return {
      authority: 1,
      source: 2,
      destination: 5,
      inputMint: 6,
      outputMint: 7,
      inputProgram: 8,
      outputProgram: 9,
      eventAuthority: 10,
      program: 11,
    };
  return name === "route"
    ? { authority: 1, source: 2, destination: 3, outputMint: 5 }
    : { authority: 2, source: 3, destination: 6, inputMint: 7, outputMint: 8 };
}
export const routeDiscriminator = (name: string) =>
  createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
export const JUPITER_PROGRAM = new PublicKey(idl.address);

export function validateV2Accounts(
  name: string,
  keys: Array<{ pubkey: string; isSigner: boolean; isWritable: boolean }>,
  payer: string,
  inputMint: string,
  outputMint: string,
) {
  if (!name.endsWith("_v2")) return;
  const r = routeAccountIndices(name);
  if (
    !("inputProgram" in r) ||
    r.inputProgram === undefined ||
    r.outputProgram === undefined ||
    r.eventAuthority === undefined ||
    r.program === undefined
  )
    throw new Error("Unsupported Jupiter account layout");
  const tokenPrograms = [
    "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  ];
  if (
    keys[r.authority]?.pubkey !== payer ||
    !keys[r.authority]?.isSigner ||
    !keys[r.source]?.isWritable ||
    !keys[r.destination]?.isWritable ||
    keys[r.inputMint!]?.pubkey !== inputMint ||
    keys[r.outputMint]?.pubkey !== outputMint ||
    !tokenPrograms.includes(keys[r.inputProgram]?.pubkey) ||
    !tokenPrograms.includes(keys[r.outputProgram]?.pubkey) ||
    keys[r.eventAuthority]?.pubkey !==
      "D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf" ||
    keys[r.program]?.pubkey !== JUPITER_PROGRAM.toBase58()
  )
    throw new Error("Invalid Jupiter V2 instruction account roles");
  if (
    "optionalDestination" in r &&
    r.optionalDestination !== undefined &&
    ![JUPITER_PROGRAM.toBase58(), keys[r.destination].pubkey].includes(
      keys[r.optionalDestination]?.pubkey,
    )
  )
    throw new Error("Unapproved Jupiter destination account");
  for (const index of [
    r.inputMint!,
    r.outputMint,
    r.inputProgram,
    r.outputProgram,
    r.eventAuthority,
    r.program,
  ])
    if (keys[index].isSigner || keys[index].isWritable)
      throw new Error("Invalid Jupiter V2 readonly account privileges");
}

// Quote APIs may round a minimum upward by one atomic unit. The approved bound
// uses floor, which is conservative for either integer-rounding convention.
export const minimumOutputAmount = (quote: {
  outAmount: string;
  slippageBps: number;
}) =>
  (
    (BigInt(quote.outAmount) * BigInt(10000 - quote.slippageBps)) /
    10000n
  ).toString();
