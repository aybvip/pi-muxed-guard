# Sources — pi-muxed-guard

This repository has two kinds of source: a **specification** for the codec, and
**observed addresses** used as fixtures. They are kept apart.

## The codec (from a specification)

| Element | Source | How to check it here |
|---|---|---|
| Base32 alphabet | RFC 4648 (no padding) | `base32Encode` / `base32Decode` round-trip over all 256 byte values |
| Checksum | CRC-16/XMODEM | the standard check value `"123456789" → 0x31C3` is asserted |
| Version bytes | the strkey version byte for `G...` and `M...` | `VERSION_G` (`6 << 3`), `VERSION_M` (`0x60`) |
| `M...` length | 69 characters, no `=` padding | asserted in the tests |
| Encoded form | version byte + 32-byte ed25519 key + 8-byte big-endian ID, base32, + CRC | `decodeStrkey` / `encodeStrkey` |

The specification parts are settled by arithmetic, so the offline test suite
decides them. No endpoint is consulted.

## Observed addresses (fixtures)

Two real Pi Mainnet addresses are embedded as fixtures, because a codec that only
round-trips its own output proves little:

| Address | Role | ed25519 key (measured) |
|---|---|---|
| `GDFNWH6…FWJ75` | an account observed acting as an exchange deposit account | `cadb1fd9…a05b` |
| `GALYJFJ…XEQU` | an account observed acting as an exchange deposit account | `1784953d…b6fb` |

Both checksums validate and both round-trip exactly. Their **role** is recorded as
"observed", not asserted: on-chain data never proves venue ownership, so the role
column is a note about where the address was seen, not a claim about who controls
it.

## Re-checking everything

```bash
git clone https://github.com/aybvip/pi-muxed-guard
cd pi-muxed-guard
node --test test.mjs                                    # 20 offline checks
node muxed-guard.mjs --address M...                     # decode + validate
node muxed-guard.mjs --build G... --id 12345            # rebuild from (G, id)
node muxed-guard.mjs --check-g G...                     # checksum only
```

## No network source

No endpoint is contacted, by design, so there is no dated network measurement to
re-run. The only external facts used are the codec specification (RFC 4648 and
CRC-16/XMODEM) and the two observed addresses, both of which are checked by the
offline suite. Third-party discussions of muxed addresses are **not** used as a
source.
