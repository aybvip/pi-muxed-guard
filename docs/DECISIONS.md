# Design decisions — pi-muxed-guard

## D1 — Show the decomposition before a send, not after

**Reasoning:** a wrong recipient on a shared account is **irreversible** — the
ledger has no per-coin origin and no recall operation. A tool that reports a
problem after the payment has already failed at the only moment it matters.

**Decision:** every mode prints the base `G...` account, the 64-bit ID, and the
verdict explicitly, so a caller can compare the ID against the one the venue gave
them **before** signing anything. The tool itself never signs or submits.

## D2 — Verify by round-trip, not by checksum alone

**Reasoning:** a checksum catches typos but not a *valid* address for the wrong
ID. Rebuilding `M...` from the decoded `(G, id)` and comparing to the input
catches any inconsistency between the two halves of the decode.

**Decision:** every decode reports `roundTripExact`. A decode whose `(G, id)` does
not rebuild the original string is not reported valid, even if the checksum
passed.

## D3 — RFC 4648 base32 with no padding

**Reasoning:** Pi uses the same strkey encoding as Stellar; the version byte and
the fixed 32-byte key and 8-byte ID make the length deterministic.

**Decision:** the codec is implemented directly (`B32` alphabet, `VERSION_G`,
`VERSION_M`, `G_LEN = 56`, `M_LEN = 69`) rather than pulled from a dependency.
This keeps the repository zero-dependency and makes each step checkable in
isolation.

## D4 — CRC16-XModem, checked against the standard value

**Reasoning:** a checksum implementation that is merely self-consistent can still
be wrong.

**Decision:** the test asserts the published check value — `"123456789"` must
produce `0x31C3` — so the checksum is verified against the specification, not
only against this repository's own encoder.

## D5 — Pure codec in a separate module

**Decision:** `codec.mjs` holds pure functions (`base32Encode`,
`base32Decode`, `crc16Xmodem`, `decodeStrkey`, `encodeStrkey`, `decodeG`,
`decodeM`, `buildMFromG`, `gFromM`) and `muxed-guard.mjs` is only the CLI. This
is what lets 20 checks run offline without spawning a process.

## D6 — Reject the wrong family in each direction

**Reasoning:** a tool that silently decodes a `G...` as if it were an `M...`
produces a confident wrong answer.

**Decision:** `decodeG` rejects an `M...` and `decodeM` rejects a `G...`, and both
are asserted in the tests. A wrong input exits `1` (error), a well-formed but
failing check exits `2` (invalid), so the two cases are not conflated.

## D7 — No network, ever

**Decision:** the tool touches no endpoint. It reads only its arguments. The
sample addresses are embedded as fixtures, so validation is fully offline and
safe to run anywhere.
