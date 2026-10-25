# Developer Preview security review

Review completed 2026-10-25 UTC. Codex Security Standard scan `ba08709f-32ff-45ca-bb50-c2b9083117ca` was sealed against runtime baseline `8a447813e9343d1569548afb9522909dc68adaf9`. An independent baseline auditor, architecture reviewer and focused transaction investigator reviewed first-party CLI source, followed by parent validation. **No confirmed vulnerability was reported.** This is a static source result, not a security certification.

Reviewed boundaries include encrypted Ed25519 imports/vaults/exports and secret output, exact message/signer approval, repeated simulations and fee/debit/reserve checks, expiry, durable claims and single-send recovery, Jupiter route/ALT/account/effect/slippage/rent validation, network/provider schemas, local utility execution, FUD isolation, owned bigint backend, build/install/CI and engineering tests. Service implementations, command routing, transaction behavior and artwork are unchanged in the preview; the CLI version label is updated to match package metadata and checked by smoke tests.

The publication delta adds docs, a blank example config, a developer-preview version, smoke/packed-install checks and checksum-pinned secret-scanning CI. Parent review checked read-only workflow permissions, pinned action commits/download checksum, no production secrets, no deployment, no signing/submission calls, exact public false-positive allowances and exclusion of private operator receipts. Automated checks exercise this delta separately.

Current source and independently installed package npm audits report zero advisories. Gitleaks 8.30.1 reports no secrets in the checked-out tree after allowing exactly two public fixture values: a Jupiter OpenAPI SHA-256 digest and a Solana AMM public address. All 12 initial scanner matches were inspected public hashes/account identifiers, not credentials; obsolete raw receipts were excluded from current publication content. Other values retain default detection. This is not a scan or rewrite of existing Git history.

## Limits retained

- RPC/host/on-chain program honesty and dependency internals remain trust assumptions; generated/bundled dependency code was not exhaustively audited. Source-lock audits and the bundle inventory must be reviewed on updates.
- No funded mainnet execution, authenticated provider tier, Pinata upload or live render was certified.
- History budgets and claims are local safeguards. Generic operations do not share a wallet-wide spending reservation or trading lifetime budget; reserve is point-in-time. Supply a stable transfer intent across rebuilt messages.
- Successful trade bookkeeping may use confirmed metadata; uncertain recovery requires finalized evidence. Chain rollback/external activity can stale local history. Missing/pruned data remains uncertain.
- Generic operations enforce total SOL debit/fees/reserve. Jupiter separately enforces token effects/slippage/rent; those controls must be supplied for new transaction types.
- JavaScript cannot guarantee secret erasure, and POSIX modes do not enforce Windows private ACLs. Mutable HTTPS metadata can change; HTTPS syntax does not prove public-network address classification.
- Configured HyperFrames workflows run with the user's OS authority and are not sandboxed. Explicit metadata uploads are external mutations independent of transaction preflight.
- Data-only logs/screenshots/fixtures received targeted secret/provenance checks rather than implementation audits. Ordinary local tests and mocks do not prove funded execution.

FUD TXN BOT remains Coming Soon without wallet/transaction access. No mainnet signing, funding, submission or spending was performed for this review. Further tool contributions require review and the shared security gate.
