import { z } from "zod";
import { jsonRequest, type Fetcher } from "./network.js";
import { validateEndpoint } from "./config.js";

export const publicAssetUri = z
  .string()
  .trim()
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        ["https:", "ipfs:"].includes(url.protocol) &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Expected a public HTTPS or IPFS URI without credentials");
export function metadataUrl(uri: string) {
  const value = publicAssetUri.parse(uri),
    url = new URL(value);
  if (url.protocol === "https:") return value;
  const gateway = validateEndpoint(
    process.env.VEXUM_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/",
  );
  const base = gateway.endsWith("/") ? gateway : gateway + "/";
  if (
    url.pathname.split("/").some((piece) => {
      try {
        return [".", ".."].includes(decodeURIComponent(piece));
      } catch {
        return true;
      }
    })
  )
    throw new Error("Invalid IPFS metadata path");
  return base + url.hostname + url.pathname + url.search;
}
export async function verifyPublicMetadata(
  uri: string,
  expected: Record<string, string | undefined>,
  fetcher: Fetcher = fetch,
) {
  const received = z
    .object({ name: z.string().min(1), image: publicAssetUri })
    .passthrough()
    .parse(await jsonRequest(metadataUrl(uri), {}, fetcher));
  for (const [key, value] of Object.entries(expected))
    if (value !== undefined && received[key] !== value)
      throw new Error(
        `Public metadata ${key} does not match the reviewed configuration`,
      );
  return { uri: publicAssetUri.parse(uri), metadata: received };
}
