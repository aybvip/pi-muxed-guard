# Pi Muxed Address Guard

A **read-only, zero-dependency** verifier for Pi muxed (`M…`) deposit addresses.

> **Plainly:** a muxed address is `G…` **plus** a 64-bit recipient ID. It selects
> **who** on a shared account receives the payment — it is **not** an asset tag and
> **not** proof of origin. If the embedded ID does not belong to the intended
> recipient at that venue, the funds go to whoever else holds that ID on the same
> account. This tool makes the decomposition visible **before** a send, not after.

## Why it exists

Muxed addresses look like opaque strings. Exchanges hand them out as "your deposit
address". A mistyped or mismatched ID is **irreversible** — the ledger has no
per-coin origin and no "recall" operation, so a wrong recipient cannot be undone.

This tool answers three questions with measurement, not opinion:

1. Is this a valid `M…` address? (CRC16-XModem checksum)
2. Which `G…` base account and which 64-bit ID does it encode?
3. Does rebuilding from `(G, id)` reproduce the exact input string? (round-trip)

## Quick start

```bash
# Decode and validate an M address
node muxed-guard.mjs --address M...

# Rebuild an M address from a G account and a numeric ID
node muxed-guard.mjs --build G... --id 12345

# Check a G address's checksum only
node muxed-guard.mjs --check-g G...
```

No install. No API keys. No writes.

## Output

JSON on stdout. Exit code `0` = valid, `2` = invalid checksum/round-trip, `1` = error.

```json
{
  "input": "M...",
  "baseAccountEd25519": "cadb1fd9…a05b",
  "muxedId": "12345",
  "checksumValid": true,
  "rebuiltFromGAndId": "M...",
  "roundTripExact": true,
  "verdict": "VALID"
}
```

## What this tool does **not** claim

| Not claimed | Why |
|---|---|
| That the `M…` ID identifies a *person* | The ledger records an address and an ID, never a name. Attribution is external. |
| That a valid checksum means the address is *safe* | It only proves the string is well-formed. Whether that ID is *yours* at that venue is a separate, off-chain question. |
| That the base `G…` account belongs to a known venue | On-chain data never proves venue ownership. See `pi-fungibility`. |

## Codec

RFC 4648 base32 (no padding — `M…` is exactly **69** characters) + CRC16-XModem
checksum over the version byte, 32-byte ed25519 key, and 8-byte big-endian ID.

Verified against real Pi Mainnet addresses:

| Address | Role | ed25519 |
|---|---|---|
| `GDFNWH6…FWJ75` | observed exchange account | `cadb1fd9…a05b` |
| `GALYJFJ…XEQU` | observed exchange account | `1784953d…b6fb` |

Both checksums validate and both round-trip exactly.

## See also

- `pi-fungibility` — why a payment carries no observable per-unit origin
- `pi-contract-upgrade-trail` — deployment history for Soroban contracts
