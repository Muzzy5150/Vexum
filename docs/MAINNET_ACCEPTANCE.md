# Deferred mainnet production acceptance

VEXUM is published as a **Developer Preview** for tool integration. Funded Solana Mainnet acceptance will happen afterward. It is not required for ordinary clone/build/test/PR checks and is not being performed during preview publication. No funded mainnet execution is claimed.

## Evidence levels

| Feature | Real mainnet result | Signature / actual spend | Engineering evidence | Remaining acceptance | Production ready |
| --- | --- | --- | --- | --- | --- |
| Wallet/token reads | Full mainnet genesis, real account/token observations | No transaction; read-only | Response/ownership/error fixtures | Reliable production RPC/indexer coverage | Reads only |
| Pump monitoring | Prior confirmed creation event observed; latest WS subscribed/stopped without matching event | No VEXUM transaction | Event filtering/dedup/stop fixtures | Longer provider reliability observation | Observation only |
| Jupiter quote/build | Actual V2 response, current supported route layout, active ALT resolution and fee estimate | None; no funded trade | Deterministic instructions/accounts/slippage/effects and recovery tests | Authenticated tier, funded successful simulation and confirmed buy/exit | No |
| SOL transfer | System executable and unsigned fee estimation | None | Successful actual unsigned local SVM; loopback integration; gate failures | Dedicated funded sender/recipient; exact approved transfer and state/cost reconciliation | No |
| Metaplex Core | Mainnet executable/unsigned fee read | None | Mainnet-cloned Core local SVM create and decoded simulated asset; official SDK fixtures | Final metadata, designated asset identity, funded mainnet simulation/mint/owner verification | No |
| Pump create_v2 | Executable/global initialized and create_v2 enabled | None | Official SDK/IDL account/argument validation; failure fixtures | Final uploaded metadata, exact funded simulation/approval/launch and mint/curve/creator verification | No |
| Pinata uploads | No authenticated upload performed | No chain spend; provider quota may apply | Actual-request construction and upload/auth failure fixtures | Configured PINATA_JWT, real upload and CID verification | Unverified |

Fresh preview production observations and local SVM summaries are in [PREVIEW_VERIFICATION.json](PREVIEW_VERIFICATION.json). Unfunded mainnet preflights returned `AccountNotFound` with zero instructions executed. They are safe rejections, not successful protocol simulations. Offline mocks of confirmation are engineering fixtures, never real-chain confirmation. Construction does not prove deployment, trading or mint success.

## Future sequence and prerequisites

Prepare **one operation at a time**: SOL transfer → Jupiter buy → exit only the actual acquired tokens → standalone Core NFT → Pump token launch without creator buy. Do not initialize these operations during ordinary contribution checks.

Before future preparation, the operator must designate dedicated controlled public wallets, select an exact token mint and metadata, configure encrypted local vaults/provider credentials and manually supply bounded funds. Do not request private keys in chat/issues/PRs. The existing encrypted vault infrastructure must be used; unrelated wallets/funds must remain untouched. No wallet setup or funding is currently required for the preview.

The previous 0.05 SOL allocation / 0.04 SOL combined spending figures were proposals, **not authorization or certified requirements**. Determine actual fresh per-message fees, account/rent requirements, protocol/platform fees, priority price, fixed input/slippage, transient liquidity and remaining reserve from chosen wallets/routes/metadata and successful funded simulation. Do not add rent twice when the transfer amount already funds the recipient's rent exemption. Provider upload/subscription costs are separate. Do not silently increase limits or assume the old proposals suffice.

## Future exact transaction approval

Before each live operation, present all of the following together:

1. Operation, full mainnet genesis, signer/destination/mint/asset public addresses and every program/account address.
2. Ordered exact instruction bytes, account signer/writable roles, resolved on-chain ALT addresses, decoded semantics and raw unsigned message.
3. Current SOL/token balances, expected changes, fee/rent/priority/platform/slippage components, reserve and maximum possible total debit under explicit caps.
4. Successful fresh mainnet simulation, validated asset effects, current blockhash/last-valid block height and expiration status.
5. The shared gate's message digest: SHA-256 of the **base64-encoded serialized message**. Approval must bind this exact message and policy. Changed/expired transactions need new simulation and approval.
6. Irreversible effects: funds move and fees are spent; token/NFT creation and metadata publication leave public history that later burns/unpins do not erase.

Then require explicit authorization for that transaction only through the shared terminal gate. Approval of one operation never authorizes the next. Never sign, broadcast, fund wallets or retry an uncertain transaction without the necessary authorization. Do not enable unattended trading.

After an authorized single submission, retain the real signature, confirm/finalize as required, inspect actual chain state/ownership/asset changes and reconcile actual costs. An unknown, pruned or timed-out outcome remains uncertain and blocks follow-on spending; never rebuild or blindly resend. Keep private acceptance packets, vaults, secrets and sensitive logs outside the public repository. Only sanitized public evidence should later be added.

## Provider and platform limits

Production read-only public RPC and public Jupiter quote/build worked during verification. Stable authenticated Jupiter tier access, Pinata uploads and optional Helius/Solscan enrichment require operator credentials. API policy/rate limits and mutable RPC/program state can change. Dedicated production HTTP/WS RPC should be validated independently.

Local host/RPC trust, mutable HTTPS metadata, local-only spending history, confirmed-state rollback, point-in-time reserves and unsupported routes/extensions remain limitations described in SECURITY.md and CAPABILITIES.md. Windows private ACLs and native PTY behavior are not established by POSIX tests. FUD TXN BOT remains Coming Soon and is excluded from funded acceptance.
