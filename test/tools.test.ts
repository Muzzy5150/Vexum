import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Keypair } from "@solana/web3.js";
import {
  writeMetadata,
  writeTokenPlan,
  auditSource,
  domainLookup,
  research,
  hyperframesRun,
} from "../src/services/tools.js";
import { naturalArguments } from "../src/cli.js";
test("NFT metadata creates validated usable files, rejects placeholders/invalid royalty values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-meta-"));
  const path = join(dir, "metadata.json");
  const result = await writeMetadata(
    {
      name: "Fixture",
      symbol: "FIX",
      description: "Test",
      image: "ipfs://fixture",
      seller_fee_basis_points: 500,
    },
    path,
  );
  assert.equal(result.status, "created");
  assert.equal(
    JSON.parse(await readFile(path, "utf8")).seller_fee_basis_points,
    500,
  );
  await assert.rejects(() =>
    writeMetadata(
      {
        name: "Fixture",
        symbol: "FIX",
        description: "Test",
        image: "file:///bad",
      },
      join(dir, "bad"),
    ),
  );
});
test("token plan writes exact u64 supply, no fabricated mint address", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-plan-"));
  const data = {
    name: "Fixture",
    symbol: "FIX",
    supply: "1000000000",
    decimals: 6,
    owner: Keypair.generate().publicKey.toBase58(),
  };
  const result = await writeTokenPlan(data, join(dir, "plan.json"));
  assert.equal(result.plan.rawSupply, "1000000000000000");
  assert.equal(result.plan.status, "configuration-only");
  assert.ok(!("mint" in result.plan));
  await assert.rejects(
    () =>
      writeTokenPlan(
        { ...data, supply: "999999999999999999999" },
        join(dir, "too-big"),
      ),
    /u64/,
  );
});
test("audit inspects actual source and returns file/line evidence without source secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-audit-"));
  await writeFile(
    join(dir, "fixture.js"),
    "const safe = 1;\nexec(userInput);\nconsole.log(privateKey);",
  );
  const result = await auditSource(dir);
  assert.equal(result.filesInspected, 1);
  assert.equal(result.findings[0].line, 2);
  assert.equal(result.findings[1].rule, "secret-output");
  assert.ok(!JSON.stringify(result).includes("exec(userInput)"));
});
test("domain/research/hyperframes reject invalid or missing inputs/providers", async () => {
  await assert.rejects(() => domainLookup("not a domain"), /Invalid/);
  await assert.rejects(() => research("make up a report"), /exact HTTPS/);
  await assert.rejects(
    () => research("https://127.0.0.1/private"),
    /not supported/,
  );
  const saved = process.env.VEXUM_HYPERFRAMES_BIN;
  delete process.env.VEXUM_HYPERFRAMES_BIN;
  try {
    await assert.rejects(
      () => hyperframesRun(".", "render"),
      /VEXUM_HYPERFRAMES_BIN/,
    );
  } finally {
    if (saved) process.env.VEXUM_HYPERFRAMES_BIN = saved;
  }
});
test("natural routing distinguishes wallet inspection, token scan, vanity and input errors", () => {
  const owner = Keypair.generate().publicKey.toBase58();
  assert.deepEqual(naturalArguments(`Scan this Wallet ${owner}`), [
    "wallet",
    "info",
    owner,
  ]);
  assert.deepEqual(naturalArguments(`Scan this Token ${owner}`), [
    "token",
    "scan",
    owner,
  ]);
  assert.deepEqual(
    naturalArguments("Mint me a Solana Wallet that starts with hello"),
    ["wallet", "create", "--prefix", "hello"],
  );
  assert.throws(() => naturalArguments("Scan this Wallet"), /requires/);
});

test("console parser preserves quoted values and literal shell syntax", async () => {
  const { consoleArguments } = await import("../src/cli.js");
  assert.deepEqual(
    consoleArguments(
      'metadata create --name "Coin Launcher" --description "$(echo value)"',
    ),
    [
      "metadata",
      "create",
      "--name",
      "Coin Launcher",
      "--description",
      "$(echo value)",
    ],
  );
  assert.deepEqual(
    consoleArguments('audit "C:\\Users\\Example\\source folder"'),
    ["audit", "C:\\Users\\Example\\source folder"],
  );
  assert.throws(
    () => consoleArguments('metadata create --name "unfinished'),
    /Unclosed quote/,
  );
});

test("configured workflow adapter runs an actual process and propagates failures without wallet secrets", async () => {
  const dir = await mkdtemp(join(tmpdir(), "vexum-workflow-")),
    previous = process.env.VEXUM_HYPERFRAMES_BIN,
    secret = process.env.VEXUM_PASSPHRASE;
  await writeFile(
    join(dir, "check"),
    "const fs=require('node:fs'); if(process.env.VEXUM_PASSPHRASE)process.exit(23);fs.writeFileSync('workflow-ran','yes');",
  );
  await writeFile(join(dir, "lint"), "process.exit(7)");
  process.env.VEXUM_HYPERFRAMES_BIN = process.execPath;
  process.env.VEXUM_PASSPHRASE = "fixture-do-not-forward";
  try {
    assert.equal((await hyperframesRun(dir, "check")).status, "completed");
    assert.equal(await readFile(join(dir, "workflow-ran"), "utf8"), "yes");
    await assert.rejects(() => hyperframesRun(dir, "lint"), /code 7/);
  } finally {
    if (previous === undefined) delete process.env.VEXUM_HYPERFRAMES_BIN;
    else process.env.VEXUM_HYPERFRAMES_BIN = previous;
    if (secret === undefined) delete process.env.VEXUM_PASSPHRASE;
    else process.env.VEXUM_PASSPHRASE = secret;
  }
});
