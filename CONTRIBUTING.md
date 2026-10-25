# Contributing to VEXUM

VEXUM is a Solana Mainnet **Developer Preview**. Funded execution is not production verified. You need no wallet, funds or production API credentials to develop and run normal checks.

## Start locally

```sh
git clone https://github.com/Muzzy5150/Vexum.git
cd Vexum
git switch -c tool/your-tool
npm ci --ignore-scripts
npm run build
node bin/vexum.js --help
```

Node 22.18+ and npm are required. Use the lockfile. Keep configuration outside Git; [.env.example](.env.example) contains blank credential slots and disables signing/submission. The CLI loads a file only when `VEXUM_ENV_FILE` names it. Source development with `npm run vexum` inherits the process environment directly.

Read [architecture](docs/ARCHITECTURE.md), [adding tools](docs/ADDING_TOOLS.md) and [SECURITY.md](SECURITY.md) before changing transaction code. Prefer a service module and a thin command adapter. Preserve existing command names, menus, artwork and FUD TXN BOT's display-only Coming Soon behavior.

## Required checks

```sh
npm run typecheck
npm run lint
npm run build
npm test
npm run test:integration
npm run test:terminal
npm run test:smoke
npm run test:install
npm audit
```

Unit tests deny external HTTP. Integration tests use temporary encrypted wallets and loopback fixtures. They must never send to a public chain. Keep `NODE_ENV=test` and `VEXUM_NO_BROADCAST=1` in automated runs. Add `test/NAME.test.ts` for unit coverage; the existing wildcard discovers it. Put subprocess/loopback cases in `test/integration/NAME.test.ts`. POSIX PTY cases live in `test/terminal_interaction.py`; native Windows skips that suite explicitly.

Optional `npm run test:validator` requires `solana-test-validator` on PATH, or `VEXUM_VALIDATOR_BIN`. It creates an isolated temporary ledger, clones the public mainnet Core program by read-only RPC, and performs unsigned **local** simulations. It does not fund a mainnet wallet or broadcast. Optional `npm run verify:mainnet` checks production reads/builds with ephemeral unfunded identities and a mutation-denying transport. Provider limits can make individual checks unavailable; inspect the result, not only the process exit code.

For local secret scanning, install Gitleaks 8.30.1 and run `gitleaks dir . --redact --no-banner --config .gitleaks.toml`. Its two exact-value allowances are a public OpenAPI digest and a public pool account, never credentials. CI scans the checked-out tree; it is not a scan or rewrite of historical commits.

## Pull requests

Branch from current `main`, make one scoped change, and open a PR targeting `main`. Describe the behavior, test evidence and limits. Include an actual failure test for unsafe or unavailable inputs. Changes to transaction types must include instruction/account validation, rejected simulation and approval, fee/debit/slippage/expiry checks as applicable, duplicate/uncertain outcome coverage, and no-sign/no-send preflight evidence. Do not weaken the gate or add an alternate signer/submission path.

CI requires no production secrets and runs clean installation, static checks, tests, CLI smoke checks, dependency audits and secret scanning. Resolve failures through normal commits and review; do not bypass repository rules or force-push shared release history. Do not use `pull_request_target` to execute contributor code with secrets. A dependency update must review the source lockfile and generated bundle inventory; downstream npm audits cannot inspect bundled SDK code.

Do not commit vaults, keys, `.env` files, private acceptance records, sensitive logs, generated bundles, node_modules or website code. Do not run funded acceptance, upload metadata, publish to npm or deploy as part of an ordinary PR. Public-chain testing requires separately designated wallets and explicit approval for each fresh exact transaction. See [remaining acceptance](docs/MAINNET_ACCEPTANCE.md).

Unsupported features must return a clear error identifying the missing capability/configuration. Do not return pretend success, artificial progress, invented balances or a simulated trading mode. Report suspected vulnerabilities privately through the repository's Security tab when private reporting is available; otherwise contact the owner privately before disclosure. Never include real keys.
