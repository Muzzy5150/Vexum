# Protocol evidence — 2026-10-24

No public-chain transaction was signed or submitted. Construction, actual unsigned simulation, and funded confirmed execution are separate evidence levels.

| Flow | Contract and current evidence | Remaining verification |
| --- | --- | --- |
| Jupiter Swap V2 | Official `/order` quotes; `/build` raw Metis instructions; own RPC submission path. Actual SOL/USDC production quote and current `route_v2` build validated, including real active ALT and intermediate setup mints; fee estimated. | Designated funded wallet, successful full asset-effect simulation, exact approval, confirmed buy/sell and reconciliation. Unfunded mainnet simulation returned `AccountNotFound`, not success. |
| Pump create_v2 | Official SDK 4.3.1 and independently retrieved current official IDL: 16 ordered accounts/PDAs, exact Borsh arguments, native SOL quote; mayhem, cashback and holder rewards off. Mainnet Pump executable/global inspected; create_v2 enabled. Real 10,000-lamport base network fee observed for unsigned two-signer construction. | Actual metadata upload with provider access, funded simulation for exact fields/rent, and explicitly authorized confirmed launch. Mint metadata and decoded curve/creator must verify before reporting success. |
| Metaplex Core createV1 | Official Core 1.10.0/Umi 1.6.0; standalone asset. Current generated instruction contract checked. Actual Agave 4.1.2 local SVM simulation passed and the simulated asset owner/name/URI decoded correctly. Mainnet executable inspected; unsigned mainnet fee 10,000 lamports. | Funded mainnet simulation and exact approved submission/asset verification. Collections/plugins unsupported. |
| SOL transfer | Shared gate, actual local SVM simulation passed; mainnet System Program and 5,000-lamport unsigned base fee checked. | Designated funded sender/recipient and explicitly approved confirmed mainnet transfer. |

Mainnet observations are retained in [public preview summary](PREVIEW_VERIFICATION.json). Fees are observations for those unsigned messages, not total deployment costs or current guarantees. No funded protocol flow passed mainnet simulation in this work. Public quotes/builds worked without a Jupiter key during the observation; provider authentication, tiers and future access policy can change.

## Jupiter V2 compatibility

The [official migration guide](https://github.com/jup-ag/docs/blob/main/swap/migration/metis-to-build.mdx) and [OpenAPI](https://github.com/jup-ag/docs/blob/main/openapi-spec/swap/v2/swap.yaml) distinguish routing-instruction versions from Solana message versions. `/build` defaults to V2 routing. Its transactions are sent through the integrator's RPC; `/execute` is the managed `/order` path and cannot submit `/build` transactions. VEXUM implements the documented `/build` + RPC path, pins message version 0, and rejects version 1/unknown instruction variants. Managed RFQ/gasless `/order` transaction execution is not implemented.

The two V2 layouts were retrieved from the Jupiter-owned mainnet Anchor IDL account `C88XWfp26heEmDkmfSzeXP7Fd7GQJ2j9dDTUsyiZbUTa`, whose owner is program `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`. Their account/argument definitions match [Jupiter's pinned official aggregator IDL](https://github.com/jup-ag/rfq-v2-sdk/blob/f3f30ff2af48f63c11f326a486b8b0eb9611714f/fill-decoder/idls/aggregator.json). The full transitive Swap type subset, hashes and instruction provenance are in `src/protocols/jupiter-v2-idl.json` and `test/fixtures/jupiter-v2-provenance.json`. The legacy CPI decoder remains separate; V2 bytes are never forced through it.

Independent byte fixtures verify the u64/u64/u16/u16/u16 argument order and u16 route weights. A recorded actual production response protects response compatibility, current AMM variants, intermediate ATA construction and ALT validation. This fixture is construction evidence, not a deterministic on-chain fill. Unrecognized future variants fail closed. A conservative integer-floor minimum is shown in exact review; a provider's upward rounding of one atomic unit is accepted, and overstated minima are rejected. Wallet asset simulation and confirmed effects enforce the reviewed minimum.

The provider's CU-price-only response receives a conservative 1,400,000-unit limit; the resulting fee must pass the cap. This is not optimized compute sizing. Setup mints are verified initialized/owned by their token program. All actual lookup-table addresses must match the provider map and remain active. No unsolicited tips/platform fees/positive-slippage capture are authorized.

## Other official references

- [Pump public SDK documentation](https://github.com/pump-fun/pump-public-docs#sdks), [current Pump IDL](https://github.com/pump-fun/pump-public-docs/blob/main/idl/pump.json). npm reported SDK 4.3.1; the public README's SDK label lags. The create_v2 wire/account contract was rechecked independently; extra quote-coin/reward workflows are not exposed.
- [Metaplex Core generated createV1 instruction](https://github.com/metaplex-foundation/mpl-core/blob/main/clients/js/src/generated/instructions/createV1.ts) and [asset creation documentation](https://www.metaplex.com/docs/smart-contracts/core/create-asset).

## Actual local SVM reproduction

```sh
npm run test:validator
```

Requires `solana-test-validator` (tested 4.1.2) and read-only mainnet access to clone Core's executable. The test starts and stops its own loopback validator, uses fresh random keys only in memory, initializes a public local genesis account, and removes its temporary configuration/ledger. It rejects public genesis hashes and permits only read/simulation RPC methods. No private test key is serialized. Assertions verify zero signatures, unchanged payer balance, no persisted asset, and decoded simulated Core contents.

The earlier devnet clone had SHA-256 `7e033fd24ce189d9e7dc2600152c6c88ce80d662deeeb7ecc64f0c8437867cf7`. The current acceptance runner clones mainnet read-only and passed with SHA-256 `51d41542456639a01820c747e72b9d3b4ca258930a5bbb7e78db0cda133dc209`, matching the independently fetched mainnet ProgramData bytes. The local bank/rent configuration still differs from mainnet; this is not a funded public-chain mint. [Current public summary](PREVIEW_VERIFICATION.json). The test is optional and does not run as part of ordinary unit/integration/CI suites.
