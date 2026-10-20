# Documentation index — pi-muxed-guard

A read-only, zero-dependency verifier for Pi muxed (`M...`) deposit addresses.

| Document | What it covers |
|---|---|
| [`BOUNDARIES.md`](BOUNDARIES.md) | every claim this tool does **not** make, and why |
| [`DECISIONS.md`](DECISIONS.md) | the codec choices and why the split is shown before a send |
| [`SOURCES.md`](SOURCES.md) | where the sample addresses come from and how to re-check |
| [`VERIFICATION.md`](VERIFICATION.md) | how to reproduce the 20 offline checks |
| [`../README.md`](../README.md) | the full description and quick start |
| [`../llms.txt`](../llms.txt) | a compact summary for machine readers |

## The one-line answer

> A muxed address is a `G...` account **plus** a 64-bit recipient ID. It says
> **who** on a shared account is paid. It is not an asset tag and not proof of
> origin, so the tool shows the decomposition **before** a send, not after.

## Claim status at a glance

| Statement | Status |
|---|---|
| `M...` is 69 characters, base32, no padding | **verifiable** (`node --test test.mjs`) |
| The checksum is CRC16-XModem | **verifiable** (standard check value `0x31C3`) |
| `(G, id) → M → (G, id)` round-trips exactly | **verifiable** over boundary IDs |
| The two sample Mainnet addresses decode to their stated keys | **measured** against real addresses |
| A valid checksum means the address is *yours* | **not claimed** |
| The ID identifies a person | **not claimed** |
