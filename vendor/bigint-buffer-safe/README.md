# VEXUM pure JavaScript bigint conversion backend

Independent VEXUM-owned implementation of the four conversion functions used by
@solana/buffer-layout-utils. This is not a published upstream bigint-buffer 1.1.6
release. Its compatible version lets the CLI replace ^1.1.5 dependencies locally.
It removes native loading and the vulnerable C++ conversion path entirely.

All SDK unsigned widths (u64/u128/u192/u256) are supported. Empty input returns 0n;
zero at width zero returns an empty Buffer. Negative values, overflow, invalid
widths and inputs larger than 1 MiB fail explicitly. Inputs are never mutated.
Unlike the upstream fallback, overflowing writes cannot silently truncate.

The CLI bundle includes this implementation. The package's vendored npm override
is for source builds/tests; installed CLI users do not rely on inherited overrides.
