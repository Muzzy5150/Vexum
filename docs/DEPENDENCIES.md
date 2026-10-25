# CLI dependency review — 2026-10-24

Baseline: commit `2447f85`, CLI `scripts/package-lock.json`, npm audit reported **13 affected-package entries (5 high, 8 moderate)**. These entries arise from **four underlying advisories**, not thirteen distinct vulnerabilities. Every reported chain belongs to the CLI. Website dependencies were inspected separately and are excluded from the isolated candidate; the website and its manifests are unchanged.

| Root dependency | Identifier | Severity | Reachability and compatible remedy |
| --- | --- | --- | --- |
| bigint-buffer <=1.1.5 | [GHSA-3gc7-fjrx-p6mg](https://github.com/advisories/GHSA-3gc7-fjrx-p6mg), CVE-2025-3194 | High | Native conversion can load during normal installs. Solana layout callers use fixed widths, but ignored install scripts are insufficient remediation. No upstream patch is available. Replace its four conversion functions with the independently owned `@vexum/bigint-buffer-safe` implementation; bounded widths, initialized buffers, explicit overflow/type checks, no native binding. It does not claim to be an upstream release. |
| stream-json | [GHSA-528h-pc64-c93x](https://github.com/advisories/GHSA-528h-pc64-c93x), CVE-2026-71429 | Moderate | Deep-path filter CPU exhaustion. Old Jayson streaming TCP/TLS paths import this parser; the CLI uses Jayson's browser HTTP client. Upgrade to Jayson 5.0.0, which removes stream-json. TCP/TLS framing changes are outside this CLI's path. |
| stream-json | [GHSA-hqr4-qq8f-hg3x](https://github.com/advisories/GHSA-hqr4-qq8f-hg3x), CVE-2026-104182 | Moderate | JSONC chunk rescanning CPU exhaustion. Same unused streaming path and removal as above. |
| stream-json | [GHSA-mjw6-4jj6-33hc](https://github.com/advisories/GHSA-mjw6-4jj6-33hc) | Moderate | Prototype pollution in parser assembly. Same unused streaming path and removal as above. |

All thirteen baseline affected entries:

| Affected package | Severity | Chain / disposition |
| --- | --- | --- |
| bigint-buffer | High | Replaced by owned JavaScript backend |
| @solana/buffer-layout-utils | High | Uses replacement backend |
| @solana/spl-token | High | Layout dependency repaired |
| @pump-fun/agent-payments-sdk | High | SPL dependency repaired; payment features are not exposed |
| @pump-fun/pump-sdk | High | SPL dependency repaired; official SDK retained |
| stream-json | Moderate | Removed |
| jayson | Moderate | Updated to 5.0.0; streaming dependency removed |
| @solana/web3.js | Moderate | Browser client compatibility tested |
| @metaplex-foundation/umi-web3js-adapters | Moderate | web3 dependency repaired |
| @metaplex-foundation/umi-eddsa-web3js | Moderate | web3 dependency repaired |
| @metaplex-foundation/umi-rpc-web3js | Moderate | web3 dependency repaired |
| @metaplex-foundation/umi-transaction-factory-web3js | Moderate | web3 dependency repaired |
| @metaplex-foundation/umi-bundle-defaults | Moderate | Transitive web3 chains repaired |

The incompatible web3 3.x/Kit rewrite was deliberately avoided. Current Pump/SPL/UMI SDK compatibility is preserved. esbuild 0.28.2 is used only to build the CLI; it also avoids the intervening low-severity Windows dev-server advisory GHSA-g7r4-m6w7-qqqr. No development server is shipped.

`npm audit --json` after remediation reports **0 vulnerabilities**, including dev dependencies. `npm ci --ignore-scripts` must reproduce that result in the standalone candidate. Package consumers do not inherit npm overrides: the distribution therefore bundles the vetted SDK code and ships its inventory and third-party notices, with only dotenv as a runtime npm dependency. The clean-install test checks the installed inventory for the owned backend/Jayson 5, excludes old bigint-buffer/stream-json and separately audits the installed dependency graph. npm cannot audit inside bundles; review the source lockfile and inventory on every upgrade.

The monorepo pnpm policy is a separate, frontend-specific install path and is not the CLI's supported install method. It still pins its own older esbuild and does not apply this npm replacement policy. Do not use root pnpm installation as evidence of CLI dependency remediation. The isolated candidate has only the CLI npm lockfile and no frontend dependency policy.

Clean extraction also exposed a stale tsx symlink into the monorepo's pnpm tree. The standalone lockfile was regenerated from an empty installation; its only local link is the owned vendor adapter, with all registry packages protected by SHA-512 integrity. The root adapter dependency and `$bigint-buffer` override make that link reproducible on npm 10/Linux and npm 12/macOS. The esbuild override applies to tsx's nested build dependency too. ESLint was moved to maintained 10.13.0 after checking Node/TypeScript peer compatibility; lint passes. See [ESLint support policy](https://eslint.org/version-support/). This changes CLI tooling only.
