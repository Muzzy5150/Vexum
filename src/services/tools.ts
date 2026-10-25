import { resolve, join, extname, relative } from "node:path";
import { readdir, readFile, lstat } from "node:fs/promises";
import { Resolver } from "node:dns/promises";
import { spawn } from "node:child_process";
import { z } from "zod";
import { publicAssetUri } from "../core/metadata.js";
import { privateFile, address } from "./wallet.js";
import { jsonRequest } from "../core/network.js";
import { requireConfig } from "../core/config.js";

export const metadataSchema = z
  .object({
    name: z.string().trim().min(1).max(32),
    symbol: z.string().max(10),
    description: z.string().max(2000),
    image: publicAssetUri,
    seller_fee_basis_points: z.number().int().min(0).max(10000).default(0),
    external_url: z.string().url().optional(),
    attributes: z
      .array(
        z.object({
          trait_type: z.string(),
          value: z.union([z.string(), z.number()]),
        }),
      )
      .default([]),
  })
  .strict();
export async function writeMetadata(data: unknown, path: string) {
  const metadata = metadataSchema.parse(data);
  await privateFile(resolve(path), JSON.stringify(metadata, null, 2) + "\n");
  return { status: "created", file: resolve(path), metadata };
}
export async function writeTokenPlan(
  data: {
    name: string;
    symbol: string;
    supply: string;
    decimals: number;
    owner: string;
  },
  path: string,
) {
  z.object({
    name: z.string().min(1).max(32),
    symbol: z.string().min(1).max(10),
    supply: z.string().regex(/^[1-9]\d*$/),
    decimals: z.number().int().min(0).max(9),
    owner: z.string(),
  })
    .strict()
    .parse(data);
  address(data.owner);
  const rawSupply = BigInt(data.supply) * 10n ** BigInt(data.decimals);
  if (rawSupply > 18446744073709551615n)
    throw new Error("Supply exceeds SPL u64");
  const plan = {
    version: 1,
    kind: "spl-token-plan",
    ...data,
    rawSupply: rawSupply.toString(),
    mintAuthority: data.owner,
    freezeAuthority: null,
    status: "configuration-only",
    next: "Use launch for Pump.fun creation; this artifact does not deploy a generic SPL token",
  };
  await privateFile(resolve(path), JSON.stringify(plan, null, 2) + "\n");
  return { file: resolve(path), plan };
}
export async function domainLookup(domain: string) {
  if (
    !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(
      domain,
    )
  )
    throw new Error("Invalid domain name");
  const resolver = new Resolver({ timeout: 3000, tries: 1 });
  const results = await Promise.allSettled([
    resolver.resolve4(domain),
    resolver.resolve6(domain),
    resolver.resolveNs(domain),
  ]);
  return {
    domain,
    observedAt: new Date().toISOString(),
    records: Object.fromEntries(
      results.map((r, i) => [
        ["A", "AAAA", "NS"][i],
        r.status === "fulfilled"
          ? { value: r.value }
          : {
              error:
                (r.reason as NodeJS.ErrnoException).code ?? "DNS lookup failed",
            },
      ]),
    ),
    registrationAvailability: null,
    note: "DNS records do not establish registration availability",
  };
}
export async function auditSource(root: string) {
  const base = resolve(root);
  const files: string[] = [];
  const skipped: string[] = [];
  let total = 0;
  async function walk(path: string): Promise<void> {
    const stat = await lstat(path);
    if (stat.isSymbolicLink()) {
      skipped.push(relative(base, path));
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of await readdir(path, { withFileTypes: true })) {
        if (
          ["node_modules", ".git", "dist", "build", ".env", "wallets"].includes(
            entry.name,
          ) ||
          entry.name.startsWith(".env") ||
          /secret|keypair|privatekey/i.test(entry.name)
        )
          continue;
        await walk(join(path, entry.name));
      }
      return;
    }
    if (
      ![
        ".ts",
        ".tsx",
        ".js",
        ".mjs",
        ".cjs",
        ".rs",
        ".sol",
        ".py",
        ".sh",
      ].includes(extname(path))
    )
      return;
    if (
      files.length >= 500 ||
      stat.size > 1_000_000 ||
      total + stat.size > 10_000_000
    ) {
      skipped.push(relative(base, path));
      return;
    }
    files.push(path);
    total += stat.size;
  }
  await walk(base);
  const rules = [
    {
      id: "shell-execution",
      pattern: /\b(exec|execSync|os\.system)\s*\(/,
      message:
        "Shell command execution requires input and authorization review",
    },
    {
      id: "disabled-tls",
      pattern:
        /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
      message: "TLS certificate validation disabled",
    },
    {
      id: "secret-output",
      pattern:
        /console\.(?:log|error).*\b(privateKey|secretKey|password|mnemonic)\b/,
      message: "Possible secret output; inspect the referenced line",
    },
    {
      id: "skip-preflight",
      pattern: /skipPreflight\s*:\s*true/,
      message: "Transaction preflight bypassed",
    },
    {
      id: "dynamic-eval",
      pattern: /\beval\s*\(/,
      message: "Dynamic code evaluation requires review",
    },
    {
      id: "unsafe-deserialize",
      pattern: /pickle\.loads?\s*\(|yaml\.load\s*\(/,
      message: "Potential unsafe deserialization",
    },
  ];
  const findings: Array<{
    file: string;
    line: number;
    rule: string;
    message: string;
  }> = [];
  for (const path of files) {
    const content = await readFile(path, "utf8");
    content.split(/\r?\n/).forEach((line, index) => {
      for (const rule of rules)
        if (rule.pattern.test(line))
          findings.push({
            file: relative(base, path) || path,
            line: index + 1,
            rule: rule.id,
            message: rule.message,
          });
    });
  }
  return {
    root: base,
    filesInspected: files.length,
    bytesInspected: total,
    findings,
    skipped,
    method:
      "Static pattern review with file/line evidence; candidates require human validation. No claim of exhaustive audit or absence of vulnerabilities.",
  };
}
export async function research(query: string) {
  const url = query.match(/^https:\/\/\S+$/)?.[0];
  if (!url)
    throw new Error(
      "Research needs an exact HTTPS JSON source: research <url>, or token scan/search for market research",
    );
  const parsed = new URL(url);
  // Restrict the built-in research tool to documented public providers; no arbitrary internal HTTP access.
  if (!["api.dexscreener.com", "api.github.com"].includes(parsed.hostname))
    throw new Error(
      "Research source not supported. Supported hosts: api.dexscreener.com, api.github.com",
    );
  return {
    source: url,
    observedAt: new Date().toISOString(),
    data: await jsonRequest(url),
  };
}
export async function hyperframesRun(project: string, operation: string) {
  if (!["lint", "check", "render"].includes(operation))
    throw new Error("HyperFrames operation must be lint, check or render");
  const executable = requireConfig(
    process.env.VEXUM_HYPERFRAMES_BIN,
    "VEXUM_HYPERFRAMES_BIN (absolute path to installed HyperFrames executable)",
  );
  if (!executable.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(executable))
    throw new Error("HyperFrames executable must use an absolute path");
  const cwd = resolve(project);
  const st = await lstat(cwd);
  if (!st.isDirectory())
    throw new Error("HyperFrames project must be a directory");
  return new Promise<{ status: string; operation: string; project: string }>(
    (resolve, reject) => {
      const child = spawn(executable, [operation], {
        cwd,
        shell: false,
        stdio: "inherit",
        env: Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) =>
              !/(?:PRIVATE|SECRET|PASSPHRASE|PASSWORD|MNEMONIC|WALLET|PINATA|JUPITER|HELIUS|SOLSCAN)/i.test(
                key,
              ),
          ),
        ),
      });
      const timeout = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error("HyperFrames workflow timed out"));
      }, 300_000);
      child.once("error", () => {
        clearTimeout(timeout);
        reject(new Error("Unable to start configured HyperFrames executable"));
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        if (code === 0)
          resolve({ status: "completed", operation, project: cwd });
        else reject(new Error(`HyperFrames exited with code ${code}`));
      });
    },
  );
}
