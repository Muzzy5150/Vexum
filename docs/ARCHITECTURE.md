# CLI architecture

VEXUM runs locally as one operator process. There is no website, API server, marketplace runtime or telemetry service. The existing service boundaries and central Commander registry are retained; adding a tool does not require rewriting them.

```text
bin/vexum.js → dist/vexum.js (built from src/vexum.ts)
                    ├─ branded menus / terminal navigation
                    └─ src/cli.ts: command registry + fixed natural-language routing
                                      ↓
                               src/services/*
                                      ↓
                      shared core, protocol validation, transaction gate
```

| Location | Responsibility |
| --- | --- |
| `src/vexum.ts` | Startup, original terminal artwork, interactive Launcher/Sniper/FUD menus; adapters reuse services/actions |
| `src/cli.ts` | `runStructured` central Commander registry, shared flag/input parsing, action adapters, `printResult` redaction, `cliError`, fixed natural-language mapping |
| `src/core/config.ts` | Environment precedence, Mainnet genesis/program constants, endpoint validation and secret scrubbing |
| `src/core/network.ts` | Bounded JSON requests, rate-limit handling, read-only RPC validation and same-chain fallback |
| `src/core/terminal.ts` | Keyboard input, masked secrets and exact terminal transaction approval |
| `src/core/metadata.ts`, `state.ts`, `pump.ts` | Metadata validation, atomic durable local state/locks, official Pump SDK bridge |
| `src/services/wallet.ts` | Ed25519, vanity search, authenticated encrypted vault/import/export and canonical address validation |
| `src/services/intelligence.ts`, `creation.ts` | Real RPC/provider wallet and token observations, bounded creation discovery |
| `src/services/tools.ts` | Metadata/config files, DNS, evidence-backed static source inspection, supported research and optional trusted HyperFrames adapter |
| `src/services/launch.ts`, `nft.ts` | Pump create_v2 and standalone Metaplex Core builders and post-confirmation state validation |
| `src/services/trading.ts`, `src/protocols/*` | Jupiter quote/build decoding, on-chain ALT validation, asset-effect/rent checks, Pump monitoring, real execution history/reconciliation |
| `src/services/transactions.ts` | Shared unsigned preflight and sole product signing/submission gate |
| `test`, `tools`, `vendor` | Engineering tests, read-only verification tools, maintained pure-JS bigint backend |

## Registration and shared contracts

`runStructured` is the existing central registry. Its `structuredNames` set is used by direct and console routing; `structuredHelp` summarizes the same groups. Command adapters validate arguments and call service functions. `naturalArguments` maps only supported phrases to the same structured commands. Unknown or unavailable requests throw a clear error. There is no general agent that invents execution.

Use Zod schemas for service inputs and provider responses, `uint` for lamport/count values, and `address` for canonical Solana public keys. Existing `text`, `integer`, `txFlags`, `tradeFlags` and `transactionOptions` in the command adapter centralize CLI parsing and policies. `printResult` redacts ordinary structured output; `cliError` redacts errors and returns a nonzero exit code. Do not log decrypted keys or attach credentials to error objects. Import core/service helpers into tools; services should not import the UI or other unrelated tools.

## Authority and persistence

Public startup and blockchain commands require Mainnet Beta. Full genesis and executable program accounts are checked. Read-only fallback and transaction submission are separate transports: writes remain on one provider. RPC honesty, on-chain programs and the local host remain trust assumptions.

The binary loads dotenv only from an explicit `VEXUM_ENV_FILE`, preserving inherited environment precedence. The source `npm run vexum` shortcut bypasses that loader. `VEXUM_HOME` defaults to `~/.vexum`; a relative override resolves from the current directory. Default encrypted vaults are in `wallets/`; explicit vault paths may be elsewhere. Keys use scrypt/AES-256-GCM with address-bound authentication and restrictive POSIX file modes. Native Windows requires operator-controlled private ACLs; POSIX mode checks do not enforce Windows ACLs.

Transactions converge on `executeTransaction`: unsigned input and exact signer set → network/program and cost validation → simulation → security review → terminal `SUBMIT <digest>` → repeated immutable-message/cost/expiry checks → signing → durable exclusive claim → one submission → confirmation. `VEXUM_NO_BROADCAST=1` and tests prohibit the live branch. Preflight never signs. The approval digest is SHA-256 of the base64-encoded serialized message. Changed or expired messages require new simulation and approval.

Claims live at `transactions/SHA256(intent-or-message-digest).json`. Stable `--intent` is required for transfer deduplication across rebuilt messages. Trading history is `mainnet-executions.json`, serialized with local lock/recovery files. Unknown submission outcomes remain uncertain and block sibling trading until finalized reconciliation. Never delete history or rebuild to retry an uncertain transaction. These are local safeguards, not wallet-wide on-chain reservations. Do not overlap spending against one wallet. Generic flows cap total debit, fees and reserve; Jupiter additionally validates route slippage, all relevant token effects and token-account rent.

Pinata uploads are explicit external mutations independent of transaction preflight. HyperFrames invokes a trusted absolute executable with `shell:false`; it retains the user's filesystem authority and is not sandboxed. FUD TXN BOT has no service or transaction authority and remains Coming Soon.

## Distribution

`build.mjs` bundles locked source dependencies and emits a dependency inventory/notices. Installed runtime dependencies contain only dotenv. Source dependencies are intentionally build/dev dependencies; they still ship in the bundle and require source-lock security auditing. `private:true` prevents accidental npm publication. GitHub Developer Preview publication does not certify funded mainnet execution.
