# Adding a tool

Start with a scoped branch from `main`. Keep logic in a service and registration in the existing central command adapter. No wallet or production credential is required for ordinary development.

## Read-only or local tool

1. Add `src/services/your-tool.ts`. Export a typed function, validate inputs/provider responses with Zod and accept injected transports when useful for tests. Reuse `config`, `Rpc`/`jsonRequest`, `address` and `uint`. Do not import the terminal UI into a service.
2. Register the command in `runStructured` in `src/cli.ts`. If adding a top-level group, add it to `structuredNames` and `structuredHelp` in that same adapter. Extend an existing group when it is the natural fit. Use `printResult`; throw on errors and let `cliError` handle redaction/exit status.
3. Add `test/your-tool.test.ts` and, for a user-visible route, update `test/smoke.mjs` or a subprocess test. Existing test globs discover files automatically. Unit tests cannot use external HTTP; inject deterministic fixtures and cover actual data parsing plus unavailable/error responses.
4. Document command inputs, provider configuration, output provenance and unsupported cases in README/CAPABILITIES. Add a natural-language mapping only if it can resolve unambiguously to the same command. Add menu integration only when needed; preserve artwork, existing ordering and keyboard behavior.

Example registration inside the existing registry, with a separately imported service:

```ts
program.command("inspect-example <address>")
  .description("Read a real account using the configured mainnet RPC")
  .action(async (value) => printResult(await inspectExample(address(value))));
```

Add `inspect-example` to the central names/help lists. Service code validates the actual RPC response and returns observed fields with timestamp/slot where appropriate. Missing data stays unavailable, not invented. For a larger family, use a `registerYourTool(program, context)` adapter that receives shared output/policy helpers; keep unrelated services unchanged. No plugin loader, dynamic code evaluation or general autonomous agent is required.

## New transaction type

Use the existing transfer, Pump, Core and Jupiter adapters as examples. A new transaction builder needs all of the following before it is exposed for execution:

- Mainnet network and executable program validation; canonical addresses, mint/account ownership, signer/writable roles and complete instruction intent validation. Treat provider instructions as untrusted. Resolve ALTs against actual active on-chain tables and reject unknown versions/layouts.
- `makeTransaction` for fresh construction and **`executeTransaction` for all product signing/submission**. Reuse `txFlags` and `transactionOptions` from the central adapter. Never add another `.sign`, `sendTransaction`, managed execute endpoint or retry path.
- Successful unsigned mainnet simulation and a semantic review of exact accounts/instructions, expected asset changes, fees/rent, caps and reserve. Add an `inspect` callback when generic SOL debit checks cannot protect the affected assets; Jupiter's callback demonstrates token and slippage/rent enforcement. Adding a program to the shared allowlist alone is not sufficient review.
- Exact terminal approval through `authorize`, immutable message binding, fresh blockhash validity, encrypted key loading and secret redaction. Simulation-only defaults must remain incapable of signing. `--live` is a request to review, not authorization itself.
- A durable stable intent for operations that must remain deduplicated across rebuilt messages. Use the shared claim/single-send path, retain uncertain outcomes, and implement finalized reconciliation/post-state verification. Report confirmed success only after the required actual chain state verifies.
- Meaningful tests for malformed instructions/accounts, missing credentials, insufficient balances, failed simulation/signing, rejected approval, fee/debit/slippage/rent caps as applicable, expired message, uncertain send/confirmation, duplicate claim and no-sign/no-send preflight. Test state transitions and output claims, not just menu rendering.

Ordinary tests use mocks, fixtures or an isolated local validator and never spend real funds. Keep new live capability explicitly **unverified** until separately approved funded mainnet acceptance exists. See [MAINNET_ACCEPTANCE.md](MAINNET_ACCEPTANCE.md) for later operator review requirements. Do not enable autonomous spending or credential collection through monitoring. FUD TXN BOT is intentionally excluded from implementation and must remain a Coming Soon placeholder.
