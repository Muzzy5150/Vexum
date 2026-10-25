import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import { config, redact, verifyGenesis } from "./config.js";

export class HttpError extends Error {
  constructor(
    public status: number,
    public retryAfterMs = 0,
  ) {
    super(`Provider HTTP ${status}${status === 429 ? " (rate limited)" : ""}`);
  }
}
export type Fetcher = typeof fetch;
export async function jsonRequest(
  url: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  retries = 1,
): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        redirect: "error",
        signal: init.signal ?? AbortSignal.timeout(12_000),
      });
    } catch {
      throw new Error("Provider connection failed or timed out");
    }
    if (!response.ok) {
      const after = response.headers.get("retry-after");
      const milliseconds = after
        ? Number.isFinite(Number(after))
          ? Number(after) * 1000
          : Date.parse(after) - Date.now()
        : 500;
      // Only read requests are retried. No mutation or transaction submission retries here.
      if (
        (!init.method || init.method === "GET") &&
        attempt < retries &&
        [429, 502, 503, 504].includes(response.status) &&
        milliseconds <= 2000
      ) {
        await delay(Math.max(0, milliseconds));
        continue;
      }
      throw new HttpError(response.status, Math.max(0, milliseconds));
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Provider returned no body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 12_000_000) {
          await reader.cancel();
          throw new Error("Provider response exceeds size limit");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const body = Buffer.concat(chunks).toString("utf8");
    try {
      return JSON.parse(body);
    } catch {
      throw new Error("Provider returned invalid JSON");
    }
  }
}
const envelope = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.string(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
});
export class Rpc {
  private verified = new Set<string>();
  constructor(
    public endpoints = config().endpoints,
    private fetcher: Fetcher = fetch,
  ) {}
  async call<T>(
    method: string,
    params: unknown[] | Record<string, unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    if (/^(send|requestAirdrop)/.test(method))
      throw new Error(
        "RPC mutations must use the authorized transaction service",
      );
    const errors: string[] = [];
    const id = `vexum-${crypto.randomUUID()}`;
    for (const endpoint of this.endpoints) {
      try {
        if (method !== "getGenesisHash" && !this.verified.has(endpoint)) {
          const genesis = envelope.parse(
            await jsonRequest(
              endpoint,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id,
                  method: "getGenesisHash",
                  params: [],
                }),
              },
              this.fetcher,
              0,
            ),
          );
          if (genesis.id !== id || genesis.error)
            throw new Error("Invalid RPC genesis response");
          verifyGenesis(z.string().min(1).parse(genesis.result));
          this.verified.add(endpoint);
        }
        const result = envelope.parse(
          await jsonRequest(
            endpoint,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
            },
            this.fetcher,
            0,
          ),
        );
        if (result.id !== id) throw new Error("RPC response ID mismatch");
        if (result.error)
          throw new Error(`RPC ${result.error.code}: ${result.error.message}`);
        if (!("result" in result)) throw new Error("Missing RPC result");
        return schema.parse(result.result);
      } catch (error) {
        errors.push(`${new URL(endpoint).hostname}: ${redact(error)}`);
      }
    }
    throw new Error(`All RPC endpoints failed: ${errors.join("; ")}`);
  }
}
export const uint = z.number().int().nonnegative().safe();
export const amount = z.string().regex(/^\d+$/);
export const context = z.object({ slot: uint });
