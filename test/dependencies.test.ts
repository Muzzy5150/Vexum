import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const converter = require("../vendor/bigint-buffer-safe/index.cjs") as {
  toBigIntBE: (b: Uint8Array) => bigint;
  toBigIntLE: (b: Uint8Array) => bigint;
  toBufferBE: (n: bigint, w: number) => Buffer;
  toBufferLE: (n: bigint, w: number) => Buffer;
};

test("pure JavaScript integer backend round-trips every SDK width and preserves input", () => {
  for (const width of [0, 1, 8, 16, 24, 32, 64, 255, 4096]) {
    const max = (1n << BigInt(width * 8)) - 1n;
    for (const value of [0n, max, max / 3n]) {
      const be = converter.toBufferBE(value, width),
        le = converter.toBufferLE(value, width),
        snapshot = Buffer.from(le);
      assert.equal(be.length, width);
      assert.equal(le.length, width);
      assert.equal(converter.toBigIntBE(be), value);
      assert.equal(converter.toBigIntLE(le), value);
      assert.deepEqual(le, snapshot);
    }
  }
});
test("integer backend rejects overflow, negative integers, invalid widths and oversized input", () => {
  for (const width of [-1, 0.5, NaN, Infinity, 2 ** 32])
    assert.throws(() => converter.toBufferLE(0n, width));
  assert.throws(() => converter.toBufferLE(-1n, 8));
  assert.throws(() => converter.toBufferBE(256n, 1));
  assert.throws(() => converter.toBufferLE(1n, 0));
  assert.throws(() => converter.toBigIntLE(new Uint8Array(1024 * 1024 + 1)));
  assert.throws(() => converter.toBufferLE(10 as unknown as bigint, 8));
});
test("Solana layouts resolve the owned non-native backend and encode u64/u128 correctly", () => {
  const layoutRequire = createRequire(
    require.resolve("@solana/buffer-layout-utils"),
  );
  assert.equal(
    layoutRequire("bigint-buffer/package.json").name,
    "@vexum/bigint-buffer-safe",
  );
  const layouts = layoutRequire("@solana/buffer-layout-utils") as {
    u64: () => {
      encode: (n: bigint, b: Buffer, offset: number) => number;
      decode: (b: Buffer) => bigint;
    };
    u128: () => {
      encode: (n: bigint, b: Buffer, offset: number) => number;
      decode: (b: Buffer) => bigint;
    };
  };
  for (const [layout, width] of [
    [layouts.u64(), 8],
    [layouts.u128(), 16],
  ] as const) {
    const value = (1n << BigInt(width * 8)) - 1n,
      b = Buffer.alloc(width);
    layout.encode(value, b, 0);
    assert.equal(layout.decode(b), value);
  }
});
test("Solana JSON-RPC uses Jayson 5 browser client with no streaming parser dependency", () => {
  const rpcRequire = createRequire(require.resolve("@solana/web3.js"));
  const info = rpcRequire("jayson/package.json") as {
    version: string;
    dependencies: Record<string, string>;
  };
  assert.equal(info.version, "5.0.0");
  assert.ok(!("stream-json" in info.dependencies));
  const Client = rpcRequire("jayson/lib/client/browser");
  let received = "";
  const client = new Client(
    (body: string, callback: (error: null, response: string) => void) => {
      received = body;
      const request = JSON.parse(body);
      callback(
        null,
        JSON.stringify({ jsonrpc: "2.0", id: request.id, result: 42 }),
      );
    },
  );
  client.request(
    "getBalance",
    [],
    (error: unknown, response: { result: number }) => {
      assert.equal(error, null);
      assert.equal(response.result, 42);
    },
  );
  assert.equal(JSON.parse(received).method, "getBalance");
});
