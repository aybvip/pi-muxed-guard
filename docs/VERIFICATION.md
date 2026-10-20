# Verification — pi-muxed-guard

Everything this tool decides is decided offline, by arithmetic, so verification is
a single command with no network involved.

## Run the suite

```bash
git clone https://github.com/aybvip/pi-muxed-guard
cd pi-muxed-guard
node --test test.mjs
```

Expected result: **20 pass, 0 fail**, with **no network access**.

What the 20 checks cover:

- base32 round-trip over all 256 byte values, and rejection of invalid characters
- the standard CRC-16/XMODEM check value (`"123456789"` → `0x31C3`)
- the two measured Pi Mainnet `G...` addresses decoding to their known ed25519 keys
- `M...` length is exactly 69 with **no** `=` padding
- `(G, id) → M → (G, id)` round-trips exactly for `0`, `1`, `2^32`, `2^64 − 1`
- a single flipped base32 character is never reported `VALID`
- `decodeG` rejects `M...` and `decodeM` rejects `G...`
- the CLI exits `0` / `2` / `1` as documented

## Check the codec by hand

The CLI output is JSON on stdout, so it can be compared against an independent
implementation of the same rules:

```bash
node muxed-guard.mjs --address M...
node muxed-guard.mjs --build G... --id 12345
node muxed-guard.mjs --check-g G...
```

The decoded `baseAccountEd25519` and `muxedId` are printed as data, and
`roundTripExact` states whether rebuilding reproduces the input. There is nothing
to take on trust: the same decode performed with any correct strkey
implementation must agree, and if it does not, the printed values show where.

## What a passing run does and does not show

- A passing suite shows the **codec** is correct: the alphabet, the checksum, the
  lengths, the round-trip, and the family rejection.
- It does **not** show that an address is safe to use. A perfectly valid `M...`
  for someone else's ID passes every check. The tool proves the string is
  well-formed and shows you the ID; deciding whether the ID is yours is a
  separate, off-chain step.
- It does **not** show who owns the base account or the ID.

## Reproducibility note

No digest or signature is attached to these results, and none is claimed. A
digest would prove integrity, not truth, and a signature would require naming an
authority this project does not have. What is offered instead is a command whose
outcome anyone can recompute.
