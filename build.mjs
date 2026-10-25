import { build } from "esbuild";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { dirname, resolve, relative, join } from "node:path";
import { existsSync } from "node:fs";
const result = await build({
  entryPoints: ["src/vexum.ts"],
  outfile: "dist/vexum.js",
  bundle: true,
  platform: "node",
  alias: { punycode: "punycode/" },
  format: "esm",
  target: "node22.18",
  metafile: true,
  legalComments: "eof",
  external: ["bufferutil", "utf-8-validate"],
  banner: {
    js: "import { createRequire as __vexumRequire } from 'node:module'; const require = __vexumRequire(import.meta.url);",
  },
});
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  let directory = dirname(resolve(input));
  while (
    directory !== dirname(directory) &&
    !existsSync(join(directory, "package.json"))
  )
    directory = dirname(directory);
  if (directory === process.cwd()) continue;
  const file = join(directory, "package.json");
  if (!existsSync(file)) continue;
  const info = JSON.parse(await readFile(file, "utf8"));
  if (!info.name || packages.has(info.name + "@" + info.version)) continue;
  const licenses = [];
  for (const name of await readdir(directory))
    if (/^(license|copying|notice)(\.|$)/i.test(name)) {
      try {
        licenses.push(await readFile(join(directory, name), "utf8"));
      } catch {
        /* Directory or non-text auxiliary entry. */
      }
    }
  packages.set(info.name + "@" + info.version, {
    name: info.name,
    version: info.version,
    license: info.license ?? "SEE NOTICES",
    texts: licenses,
  });
}
const entries = [...packages.values()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
await writeFile(
  "dist/bundle-manifest.json",
  JSON.stringify(
    {
      format: "vexum-bundle-inventory-v1",
      packages: entries.map(({ name, version, license }) => ({
        name,
        version,
        license,
      })),
      inputs: Object.keys(result.metafile.inputs).map((p) =>
        relative(process.cwd(), resolve(p)),
      ),
      externalModules: [
        "node builtins",
        "bufferutil (optional, absent)",
        "utf-8-validate (optional, absent)",
      ],
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "dist/THIRD_PARTY_NOTICES.txt",
  entries
    .map(
      (e) =>
        `${e.name}@${e.version} (${e.license})\n${e.texts.join("\n") || "License identifier is recorded in the bundle inventory."}`,
    )
    .join("\n\n--------------------\n\n"),
);
console.log(
  `Built portable CLI bundle; inventoried ${entries.length} dependency packages.`,
);
