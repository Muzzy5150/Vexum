# Developer Preview — 0.2.0-dev.1

VEXUM is a CLI-only **Developer Preview**, suitable for contributors integrating and testing tools. It is **not a production-verified mainnet release**. Funded acceptance is deferred until tool integration is complete and is not a requirement for GitHub preview publication. No mainnet wallet was funded, transaction signed/broadcast, token launched or NFT minted during preview verification. There is no paper trading product mode.

Runtime services, command behavior, artwork and FUD TXN BOT are retained from `8a44781`; only the CLI version label changes to match the package. The preview adds contributor documentation, command smoke coverage, stricter package checks, secret scanning and public release reports. The preview snapshot is based on the existing main history for a normal PR merge; no history rewrite or stale cleanup branch is used. The original local website is separate and unchanged. npm publication and service deployment are out of scope; `private:true` remains.

## Executed verification — 2026-10-25 UTC

| Check | Result | Scope/limit |
| --- | --- | --- |
| Clean npm installation | Passed | `npm ci --ignore-scripts`, locked source dependencies |
| TypeScript / lint / production build | Passed | Portable bundle, 70 bundled package inventory entries and notices |
| Unit tests | 97 passed, 0 failed | Original relevant suite retained; external HTTP disabled |
| Integration tests | 6 passed, 0 failed | Subprocesses, temporary encrypted fixture vaults, loopback RPC; no public-chain sends |
| Terminal navigation | 3 scenarios passed | Original Launcher/Sniper/FUD artwork, return/navigation/exit; POSIX PTY |
| Command smoke checks | 29 routes passed | Real command registration/help, startup/network, gate flags and FUD; run outside checkout |
| Clean packed installation | Passed | Installs without lifecycle scripts, invokes installed CLI independently, repeats 29-route smoke; package excludes private operator records and website runtime |
| Local-validator simulation | Passed | Agave 4.1.2; real unsigned local SVM transfer and mainnet-cloned Core create; post-simulation asset decoded; no submission |
| Production read-only checks | Passed within stated limits | Full mainnet genesis/programs, Pump global/create_v2, wallet/token data, Jupiter quote/build and active ALT; latest WS session subscribed/stopped without an event |
| Source and installed dependency audits | Zero advisories | npm does not inspect SDK code embedded in bundles; source-lock audit remains required |
| Checked-out-tree secret scan | Passed | Gitleaks 8.30.1 default rules with two exact public fixture-value allowances; not a historical Git scan |
| Static security review | No confirmed vulnerability | Independent baseline, architecture and focused transaction review; see SECURITY_REVIEW.md; not certification of dependencies or funded behavior |

Machine-readable public observations are in [PREVIEW_VERIFICATION.json](PREVIEW_VERIFICATION.json). Historical operator-specific receipts and raw development logs are excluded from the current public tree. Only public program data and aggregate check outcomes are retained. Screenshots prove appearance only.

Fresh production Jupiter V2 `/order` and `/build` responses were validated, including one actual active on-chain lookup table. The observed build network fee was 8,379 lamports; this is timestamped, not a current fee guarantee. Unfunded unsigned mainnet transfer/Pump/Core/Jupiter simulations returned `AccountNotFound`; **they did not successfully execute protocol instructions**. Local SVM tests and deterministic SDK/IDL fixtures are separate evidence and do not establish funded mainnet acceptance.

CI automatically runs clean install/typecheck/lint/build, unit/integration/smoke/packed install, npm audit and secret scan on PRs. The OS/Node matrix uses Ubuntu/macOS/Windows and Node 22/24/26. Consult the PR's actual checks for runner results; configuration alone is not evidence. Local preview verification used macOS ARM64/Node 26. Prior Linux ARM64/Node 22.18 checks passed before this docs/test/CI delta. Native local Windows and Linux x64 were not tested in this phase; Windows PTY scenarios explicitly skip, and private Windows ACLs remain the operator's responsibility. Source tests may emit an upstream tsx/Node deprecation warning.

## Remaining production acceptance

Funded transfer, buy, actual acquired-token exit, standalone Core NFT and Pump launch need designated bounded-fund wallets, final inputs, fresh funded simulations, separate exact authorizations, actual signatures, confirmed/finalized state and reconciled costs. No budget is approved; earlier allocation proposals are not certified costs. Authenticated Jupiter access, Pinata uploads/plan quota, optional indexer tiers and production RPC reliability need the appropriate operator credentials. See [MAINNET_ACCEPTANCE.md](MAINNET_ACCEPTANCE.md).

Unsupported routes/extensions, arbitrary SPL/SPL execution, untracked-token exits, bundles, autonomous spending, Core collections/plugins and general agent/video generation remain unavailable and must fail closed. HyperFrames requires a trusted configured installed workflow; no real render is certified. Local budgets/claims do not enforce wallet-wide on-chain policy; simultaneous spending and mutable metadata/RPC trust remain documented limits.

**Preview publication readiness and production mainnet readiness are different decisions. This version is for development collaboration; production mainnet readiness is No.**
