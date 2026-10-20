# What this tool does **not** claim

A checksum proves a string is well-formed. It proves nothing about who controls
the ID inside it. Keeping that line visible is the point of this repository.

| Not claimed | Why |
|---|---|
| That the `M...` ID identifies a **person** | The ledger records an address and an ID, never a name. Attribution is external. |
| That a valid checksum means the address is **safe** | It only proves the string is well-formed. Whether that ID is *yours* at that venue is a separate, off-chain question. |
| That the base `G...` account belongs to a known **venue** | On-chain data never proves venue ownership. See `pi-fungibility`. |
| That a wrong ID can be recovered | The tool exists precisely because it cannot: the ledger has no per-coin origin and no recall operation. |
| That the codec is the only valid implementation | Only that its output matches the addresses tested and the published check value. |
| That the sample addresses are the venue's current deposit addresses | They are addresses **observed** at the time of measurement, used as codec fixtures. |
| That this is the first such tool | The prior-art position is **"no prior work found"**, not "we are first". |
| That Pi Network has adopted, reviewed or endorsed this | Adoption is **not-claimed**. |

## The shape of the claim

Two kinds of statement appear here:

- **Verifiable** — decided entirely by this repository's own code, so an offline
  test settles it: the codec round-trip, the checksum, the length, the rejection
  of invalid characters.
- **Measured** — an observation of real addresses, used as fixtures: the two
  Mainnet addresses and their decoded keys.

There is no third category of belief. Where a statement depends on a venue's
behaviour rather than on arithmetic, it is left explicitly unmade.
