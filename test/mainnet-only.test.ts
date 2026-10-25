import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { requireTradeMode, buyAction, sellAction } from "../src/cli.js";
import { positionsFile, positionSchema } from "../src/services/trading.js";

test("trading requires explicit preflight or live authorization and has no default engine", async () => {
  assert.throws(() => requireTradeMode({}), /Choose/);
  assert.throws(
    () => requireTradeMode({ live: true, preflight: true }),
    /Choose/,
  );
  assert.doesNotThrow(() => requireTradeMode({ preflight: true }));
  assert.doesNotThrow(() => requireTradeMode({ live: true }));
  await assert.rejects(() => buyAction("unused"), /Choose/);
  await assert.rejects(() => sellAction("unused"), /Choose/);
});
test("legacy virtual state is ignored and cannot enter the real execution history", async () => {
  const old = process.env.VEXUM_HOME,
    home = await mkdtemp(join(tmpdir(), "vexum-mainnet-state-"));
  process.env.VEXUM_HOME = home;
  try {
    await writeFile(
      join(home, "positions.json"),
      JSON.stringify([{ mode: "paper", quantity: "999" }]),
    );
    assert.deepEqual(await positionsFile(), []);
    assert.equal(positionSchema.safeParse({ mode: "paper" }).success, false);
  } finally {
    if (old === undefined) delete process.env.VEXUM_HOME;
    else process.env.VEXUM_HOME = old;
  }
});
test("product source contains no removed trading engines, virtual balances or paper menu", async () => {
  for (const path of [
    "src/cli.ts",
    "src/vexum.ts",
    "src/services/trading.ts",
    "config.example.env",
  ]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(
      source,
      /paperBuy|paperSell|Paper Buy|mode: .paper.|observedPriceUsd|realizedPnl|virtualBalance|PAPER_MODE/,
    );
  }
});

test("original menu artwork and FUD display-only text are preserved from baseline", async () => {
  const ts = (await import("typescript")).default,
    { createHash } = await import("node:crypto");
  const proof = JSON.parse(
    await readFile(new URL("fixtures/branding.json", import.meta.url), "utf8"),
  );
  const tree = ts.createSourceFile(
    "vexum.ts",
    await readFile("src/vexum.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  for (const node of tree.statements) {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      proof.literalHashes[node.name.text]
    ) {
      const strings: string[] = [];
      const visit = (n: import("typescript").Node) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n))
          strings.push(n.text);
        ts.forEachChild(n, visit);
      };
      visit(node);
      assert.equal(
        createHash("sha256").update(JSON.stringify(strings)).digest("hex"),
        proof.literalHashes[node.name.text],
        node.name.text,
      );
      found.push(node.name.text);
    }
  }
  assert.equal(found.length, Object.keys(proof.literalHashes).length);
});
