import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  Rpc,
  jsonRequest,
  HttpError,
  type Fetcher,
} from "../src/core/network.js";
import { config, redact } from "../src/core/config.js";

test("RPC validates response IDs, schemas and falls back on failed reads", async () => {
  let count = 0;
  const fetcher: Fetcher = async (_url, init) => {
    count++;
    const body = JSON.parse(String(init?.body));
    return Response.json(
      count === 1
        ? { jsonrpc: "2.0", id: "wrong", result: { value: 9 } }
        : {
            jsonrpc: "2.0",
            id: body.id,
            result:
              body.method === "getGenesisHash"
                ? "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
                : { value: 42 },
          },
    );
  };
  const rpc = new Rpc(["https://one.invalid", "https://two.invalid"], fetcher);
  assert.deepEqual(
    await rpc.call("getBalance", [], z.object({ value: z.number() })),
    { value: 42 },
  );
  assert.equal(count, 3);
  await assert.rejects(
    () => rpc.call("sendTransaction", [], z.unknown()),
    /authorized/,
  );
});
test("RPC malformed payloads, JSON errors, and exhausted endpoints propagate failure", async () => {
  const fetcher: Fetcher = async () => new Response("not-json");
  await assert.rejects(
    () =>
      new Rpc(["https://rpc.invalid"], fetcher).call(
        "getBalance",
        [],
        z.number(),
      ),
    /invalid JSON/,
  );
  const malformed: Fetcher = async (_u, i) =>
    Response.json({
      jsonrpc: "2.0",
      id: JSON.parse(String(i?.body)).id,
      result: { value: "fabricated" },
    });
  await assert.rejects(
    () =>
      new Rpc(["https://rpc.invalid"], malformed).call(
        "getBalance",
        [],
        z.object({ value: z.number() }),
      ),
    /failed/,
  );
});
test("rate limit: read retries bounded, mutation never retried", async () => {
  let count = 0;
  const fetcher: Fetcher = async () => {
    count++;
    return count === 1
      ? new Response("", { status: 429, headers: { "retry-after": "0" } })
      : Response.json({ ok: true });
  };
  assert.deepEqual(await jsonRequest("https://provider.invalid", {}, fetcher), {
    ok: true,
  });
  assert.equal(count, 2);
  count = 0;
  await assert.rejects(
    () => jsonRequest("https://provider.invalid", { method: "POST" }, fetcher),
    HttpError,
  );
  assert.equal(count, 1);
  await assert.rejects(
    () =>
      jsonRequest(
        "https://provider.invalid",
        {},
        async () =>
          new Response("", { status: 429, headers: { "retry-after": "60" } }),
      ),
    /429/,
  );
});
test("explicit network config never silently switches networks and rejects unsafe endpoints", () => {
  assert.deepEqual(
    config({
      VEXUM_CLUSTER: "devnet",
      VEXUM_SOLANA_RPC_URL: "https://rpc.example/dev",
    }).endpoints,
    ["https://rpc.example/dev"],
  );
  assert.deepEqual(config({ VEXUM_CLUSTER: "devnet" }).endpoints, [
    "https://api.devnet.solana.com/",
  ]);
  assert.throws(() => config({ VEXUM_CLUSTER: "fake" }));
  assert.throws(() =>
    config({ VEXUM_SOLANA_RPC_URL: "http://remote.example" }),
  );
});
test("redaction strips credentials, URLs, secrets and terminal controls", () => {
  const secret = "sensitive-api-key";
  process.env.VEXUM_TEST_SECRET = secret;
  const result = redact(
    new Error(`Failure ${secret} https://rpc.example/?api-key=abc \x1b[31m`),
  );
  assert.ok(!result.includes(secret));
  assert.ok(!result.includes("api-key"));
  assert.ok(!result.includes("\x1b"));
  delete process.env.VEXUM_TEST_SECRET;
});

test("redaction distinguishes public transaction signatures from Ed25519 secret keys", async () => {
  const { Keypair } = await import("@solana/web3.js");
  const { randomBytes } = await import("node:crypto");
  const bs58 = (await import("bs58")).default;
  const wallet = Keypair.generate(),
    secret = bs58.encode(wallet.secretKey),
    signature = bs58.encode(randomBytes(64));
  assert.ok(!redact(`Do not expose ${secret}`).includes(secret));
  assert.ok(redact(`Reconcile signature ${signature}`).includes(signature));
  assert.ok(
    !redact(JSON.stringify([...wallet.secretKey])).includes(
      JSON.stringify([...wallet.secretKey]),
    ),
  );
});

test("read fallback refuses another chain instead of returning its balances", async () => {
  const seen: string[] = [];
  const rpc = new Rpc(
    ["https://wrong.invalid", "https://right.invalid"],
    async (u, init) => {
      const call = JSON.parse(String(init?.body)),
        host = new URL(String(u)).hostname;
      seen.push(`${host}:${call.method}`);
      return Response.json({
        jsonrpc: "2.0",
        id: call.id,
        result:
          call.method === "getGenesisHash"
            ? host === "wrong.invalid"
              ? "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG"
              : "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
            : { value: 42 },
      });
    },
  );
  assert.deepEqual(
    await rpc.call("getBalance", [], z.object({ value: z.number() })),
    { value: 42 },
  );
  assert.ok(!seen.includes("wrong.invalid:getBalance"));
});
