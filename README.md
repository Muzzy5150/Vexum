# VEXUM CLI — Developer Preview

VEXUM's terminal toolkit for Solana wallets, token intelligence, mainnet launches, monitoring and reviewed live trading. Original interface and artwork are preserved. FUD TXN BOT remains **Coming Soon**.

This developer preview is for contributors building real Solana Mainnet tools. Wallet/token reads and production Jupiter quote/build responses have been observed; offline tests and local SVM transfer/Core simulations pass. **Funded mainnet transfers, swaps, NFT mints and token launches remain unverified. This is not a production-verified release.** Simulation is a security check, never a trading mode.

No website, marketplace or API server is required. The existing repository history is preserved. See [capabilities](docs/CAPABILITIES.md), [release checks](docs/RELEASE.md), [mainnet acceptance](docs/MAINNET_ACCEPTANCE.md) and [security guidance](SECURITY.md).

Contributors: start with [CONTRIBUTING.md](CONTRIBUTING.md), [architecture](docs/ARCHITECTURE.md) and [adding tools](docs/ADDING_TOOLS.md). Original terminal artwork and FUD TXN BOT's Coming Soon placement are protected by regression tests.

Requires Node 22.18+ and npm. Install/build from a clean checkout:

```sh
git clone https://github.com/Muzzy5150/Vexum.git
cd Vexum
npm ci --ignore-scripts
npm run build
./vexum --help
./vexum
```

Or install a locally built package:

```sh
npm pack
npm install --global ./vexum-cli-0.2.0-dev.1.tgz --ignore-scripts
vexum --help
```

`sh install-vexum-command.sh` creates a local POSIX command without changing your shell profile. Windows users can run `node bin/vexum.js` or use npm's installed `vexum.cmd`. Native Windows testing is outstanding. Linux validation uses a real Linux container/VM; it does not establish native Windows compatibility.

Configuration is data: installed/checkout binaries load a dotenv file only when `VEXUM_ENV_FILE` explicitly names it. Environment variables take precedence. Copy [.env.example](.env.example) to a private file outside Git and set `VEXUM_ENV_FILE` to its path. [config.example.env](config.example.env) remains a compatible template. Leave `VEXUM_HOME` empty for `~/.vexum`. The product requires `VEXUM_CLUSTER=mainnet-beta`. RPC reads verify full genesis hashes on each fallback; writes stay on one provider. Transaction preflight never signs or submits; set `VEXUM_NO_BROADCAST=1` to prohibit all real signing/submission.

## Wallets

```sh
vexum wallet create --out /secure/path/creator.vault.json
vexum wallet create --prefix Ab --out /secure/path/vanity.vault.json
vexum wallet import --out /secure/path/imported.vault.json
vexum wallet info PUBLIC_ADDRESS
vexum wallet history PUBLIC_ADDRESS --limit 20
vexum wallet show /secure/path/creator.vault.json
vexum wallet export /secure/path/creator.vault.json --out /secure/path/backup.vault.json
```

Secrets are entered at a masked terminal prompt. Import accepts standard 64-byte Solana JSON arrays or base58 secret keys and validates the public half. `--secret-file` can read an existing private regular file with mode 600; the CLI never creates a plaintext key file. Vaults and exports use authenticated AES-256-GCM encryption with a scrypt-derived key, a random salt/nonce, and address-bound authenticated data. A new passphrase must contain at least 12 characters. Existing output files are never overwritten. Keep backups and passphrases separately.

Private output requires `wallet reveal VAULT --show-secret` and typing `REVEAL` at a terminal. It is not available through piped output. Wallets stay encrypted on disk; JavaScript cannot guarantee complete erasure of strings or runtime key objects. Passphrases may be provided through `VEXUM_PASSPHRASE` for controlled noninteractive use, and `VEXUM_EXPORT_PASSPHRASE` for export. Neither accepts a command-line password argument.

Vanity searches are exact and case-sensitive, bounded by `--timeout` (milliseconds) and `--max-attempts`. Prefixes use base58 only, with a maximum of eight characters. Long prefixes may not complete within the default one-minute budget. Ctrl-C stops a search; a timeout never reports a generated matching wallet.

## Intelligence and local tools

```sh
vexum token scan MINT
vexum token scan MINT --creation --pages 3
vexum token creation MINT --pages 3
vexum token search TICKER
vexum metadata create --name "My NFT" --image IPFS_OR_HTTPS_URI --royalties 500 --out nft.json
vexum token plan --name "My Token" --symbol MYT --supply 1000000000 --decimals 6 --owner PUBLIC_ADDRESS --out token-plan.json
vexum domain solana.com
vexum audit ./local/source
vexum research https://api.github.com/repos/Muzzy5150/Vexum
```

Wallet inspection queries SOL, both token programs and signature history. Token intelligence validates the on-chain mint and returns supply, authorities, indexed/embedded metadata when available, DexScreener pools, prices/FDV/market cap as distinct fields, and largest-account concentration. Optional Helius and Solscan keys enable additional data subject to provider access. A largest account is never presumed to be a liquidity pool. Missing fields remain null. Pool creation times are not mint creation times; creation discovery requires an actual mint-initialization instruction. It has a bounded history budget and needs archive data for old/high-activity mints. Holder clustering, LP attribution, verifiable circulating supply and unsupported indexer counts remain unavailable.

`audit` is a bounded static pattern review returning file/line evidence, not an exhaustive vulnerability scanner. It skips symlinks, dependency/build directories and obvious secret files, and never executes inspected source. `domain` returns DNS records, not registrar availability. `research` retrieves sourced JSON from supported GitHub/DexScreener endpoints; a general research/code-editing agent provider is not configured. Unknown requests fail without fake task completion or payments.

## Pump.fun launch and NFTs

```sh
vexum launch upload --metadata token.json --image ./image.png
vexum launch run --metadata token.json --metadata-uri IPFS_METADATA_URI --wallet creator.vault.json --mint-wallet mint.vault.json
vexum nft mint --name "My NFT" --uri IPFS_METADATA_URI --wallet creator.vault.json --asset-wallet asset.vault.json
```

Token JSON fields: `name`, `symbol`, `description`, `image`, and optional `twitter`, `telegram`, `website`. Upload requires `PINATA_JWT`, uploads actual image bytes followed by metadata JSON, and returns the provider's actual IPFS CID. Uploads are explicit provider actions even when transaction execution is dry-run. Review provider plan/quota yourself. A supplied metadata URI is retrieved and checked against the reviewed name, image and token configuration before wallet unlock. Mutable HTTPS metadata can change later; immutable IPFS content is preferable.

Pump.fun uses official `@pump-fun/pump-sdk` `createV2Instruction` for a native-SOL-paired token, without creator buys, cashback, holder rewards, or bundles. The mint key is persisted encrypted before construction. A dry-run returns `proposedMint`, never a deployed mint or transaction signature. A successful live result requires confirmed transaction status, Token-2022 mint metadata and Pump curve/creator verification. NFT construction uses Metaplex Core standalone assets; collections and royalty plugins are not implemented.

`--live` requests an exact transaction review and a masked-wallet unlock, then requires typing `SUBMIT <digest>` in a terminal. The transaction service simulates, checks full network genesis, executable program accounts, fees, total debit and remaining SOL reserve, repeats validation after approval, and sends at most once. Defaults are dry-run. `--max-debit` and `--max-fee` are lamport caps. Automated tests prohibit broadcasts. Real provider/funded simulation and live deployment are not certified by fixture tests. No real deployment or spending was performed during development.

The existing Coin Launcher menu retains metadata, wallet slots, review and Deploy, with explicit Upload and Deploy Live actions added. Up to 24 wallet slots remain visible; actual wallet bundling is disabled. Only one creator wallet can be used for a launch. Clear Wallet Slots resets local menu selections.

## Sniper and trading

```sh
vexum sniper monitor EXACT_MINT --duration 30000
vexum sniper monitor --new --duration 30000
vexum token search TICKER
vexum trade quote INPUT_MINT OUTPUT_MINT ATOMIC_AMOUNT
vexum trade buy EXACT_MINT --amount 1000000 --preflight --wallet creator.vault.json
vexum trade positions PUBLIC_WALLET_ADDRESS
vexum trade history
vexum trade sell POSITION_ID --preflight --wallet creator.vault.json
vexum trade reconcile POSITION_ID
```

Trading requires an explicit `--preflight` security simulation or `--live` exact terminal approval, and an encrypted wallet. There is no default trading execution engine. Replace `--preflight` with `--live` only when you intend a real transaction and can review it. Every live transaction requires typing `SUBMIT <digest>`; monitoring cannot authorize a buy. Autonomous spending is disabled.

New-token monitoring consumes confirmed Pump program creation events over mainnet RPC WebSockets; duplicate signatures are suppressed. Ticker matches are observations only. Ambiguous tickers must be resolved to an exact mint. Ctrl-C stops polling and removes subscriptions. Market prices and pool liquidity are timestamped provider observations, never executable fill guarantees.

Jupiter Swap V2 `/order` without a taker provides real read-only quotes. `/build` supplies raw Metis instructions which VEXUM decodes, validates, assembles as a Solana v0 transaction, simulates and submits through its own RPC and shared gate. `/execute` is Jupiter's managed path for `/order` transactions and is not used for `/build`. VEXUM accepts current `route_v2` and `shared_accounts_route_v2` layouts independently of the retained legacy decoders. The V2 layouts match the program-owned mainnet IDL and pinned official source; a real production response with an ALT and intermediate ATAs was validated. Configure `JUPITER_API_KEY` for your provider tier. Public unauthenticated access worked during verification; HTTP 401/403 without a key produces a configuration error, never a replacement route.

Unknown layouts, token ledgers, exact-output routes, unsolicited tips, additional instruction bundles, alternate recipients and arbitrary approvals/transfers fail closed. Executable top-level programs and setup mint ownership are checked against RPC. Provider lookup-table mappings must match actual active on-chain tables. Intermediate ATAs must belong to the signing wallet; their rent counts toward the cap and unrelated balances cannot change. Encoded amounts/slippage/fees must match the quote. Exact review shows a conservative minimum output rounded down to atomic units; provider rounding may differ by one unit. The full wallet simulation protects existing amounts, owners, delegates and extensions. Wallets with more than 95 relevant token accounts or incompatible Token-2022 extensions fail closed. Execution currently supports SOL/token buys and tracked-position token/SOL sells, not arbitrary SPL/SPL pairs or untracked holdings.

Default caps: 0.01 SOL cumulative position cost, 0.05 SOL lifetime wallet spending, 100 bps slippage, 100,000 lamport network fee, 3,000,000 lamport ATA rent, 1,000,000 lamport remaining SOL reserve. Flags: `--max-position`, `--max-spend`, `--slippage`, `--max-fee`, `--max-rent`, `--min-balance`, `--max-debit`. Intermediate accounts may require a higher explicitly chosen rent cap. The Sniper Trading Settings menu exposes these controls. Total cost includes fees and rent; preflight may conservatively count a network fee twice. Limits apply to this local execution history and are not a wallet-wide policy across other software.

`trade positions ADDRESS` reads actual SOL/SPL/Token-2022 balances. `trade history` reads `VEXUM_HOME/mainnet-executions.json`, containing only real execution attempts/outcomes. Legacy `positions.json` is ignored and never imported into this history; existing private files are left for the owner to archive or remove. No estimates of portfolio value or P&L are generated.

Execution history is locked and written atomically. Buys and sells block while a sibling outcome is pending/uncertain. A signed claim is persisted before the single submission attempt. Declining approval does not create a position. Actual positions use confirmed transaction balance changes. Uncertain outcomes require finalized chain reconciliation; a missing/pruned signature remains uncertain. Never delete claims/history to retry a potentially submitted trade. `transaction status SIGNATURE` reads actual status; an unknown signature is not success.

## Other operations and FUD TXN BOT

`transfer RECIPIENT --wallet VAULT --lamports AMOUNT` builds and simulates a real SOL transfer; live mode uses the same confirmation gate.

HyperFrames integration runs an installed, explicitly configured executable against an existing project: set `VEXUM_HYPERFRAMES_BIN` to its absolute executable path, then run `hyperframes PROJECT --operation check|lint|render`. The adapter uses an argument array without a shell, filters known wallet/provider secret environment names, propagates failures, and never claims to create a video without running the workflow. Existing-composition rendering and creative generation were not verified in this session. A general video-creation provider is unavailable.

**FUD TXN BOT keeps its original artwork, colors and placement after Coin Sniper. It only displays Coming Soon / Under Development. It requests no keys and performs no wallet or transaction operations. Future fee-funded distribution is explicitly out of scope.**

## Verification and release limits

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run test:integration
npm run test:terminal
npm run test:install
```

Unit tests disable external HTTP and use explicit mocks. Integration tests use temporary encrypted vaults, subprocesses and a loopback RPC fixture. POSIX PTY tests exercise actual console/menu navigation. Installation tests package to a temporary directory, install without lifecycle scripts, and invoke the installed CLI from outside the repository. No tests spend funds.

The CLI source and independently installed package graphs audit cleanly after the owned pure JavaScript bigint replacement, Jayson 5 removal of stream-json and compatible build-tool updates. The bundle includes an inventory and third-party notices. Source-lock review is required because installed npm audits do not inspect bundled code. Do not use forced SDK downgrades.

The developer preview is intended for public collaboration. Provider credentials/tier access, funded mainnet simulations and explicitly authorized public-chain execution remain verification limits. Platform check results and remaining limits are recorded in the release report.

## Dependency and release verification

The portable build bundles vetted SDK code because npm overrides are not inherited by downstream consumers. `dist/bundle-manifest.json` and `dist/THIRD_PARTY_NOTICES.txt` accompany the bundle; dotenv is the only installed runtime dependency. Run `npm audit` against the source lockfile as well as the installed package. See [dependency analysis](docs/DEPENDENCIES.md), [protocol evidence](docs/PROTOCOLS.md), and [security guidance](SECURITY.md). The independent pure JavaScript integer backend is owned here and requires ongoing review.

Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:integration`, `npm run test:terminal`, and `npm run test:install` from this directory. Optional `npm run test:validator` performs real unsigned local SVM simulation after the documented validator setup. It cannot broadcast. Native Windows PTY tests are skipped explicitly; do not equate CI configuration with a completed native test.

The configured HyperFrames workflow has your operating-system user privileges and must be trusted; it is not sandboxed from local files. `npm run vexum` is a source-development shortcut and inherits environment variables directly; use `node bin/vexum.js` after building when testing explicit dotenv-file loading.

For transfers, provide a stable `--intent ID` when an operation must stay deduplicated across separately rebuilt messages. A default message digest includes its blockhash; an independently rebuilt transfer otherwise requires a new exact approval. Never rebuild an uncertain transfer as a substitute for reconciliation.

The public CLI accepts only Mainnet Beta. Internal local-validator/development transports exist solely for engineering tests. `npm run verify:mainnet` performs optional production reads, unsigned preflight and observation-only monitoring, with an RPC mutation denylist. It generates no wallet files and cannot broadcast.

## Mainnet acceptance status

[Acceptance matrix and approval requirements](docs/MAINNET_ACCEPTANCE.md) distinguish production reads from unexecuted controlled-wallet transactions. Funded acceptance is deferred until tool integration is complete; no wallet setup, funding or transaction approval is required to contribute or run ordinary PR checks.

Read-only engineering reproduction after npm ci (credentials, if used, must be present in the process environment):

```sh
npm run verify:mainnet > providers.log
npm exec -- tsx tools/acceptance-costs.ts providers.log
npm run test:validator
```

The cost tool has no wallet loading/signing/submission path. Its RPC transport permits reads only. The optional validator clones Core from mainnet read-only, executes unsigned local simulations with fresh in-memory keys, and removes its own ledger. Neither command funds or submits on mainnet. Exact instructions, designated balances, successful mainnet simulation and a fresh message hash must be presented before each later live approval.
