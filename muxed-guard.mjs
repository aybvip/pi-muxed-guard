#!/usr/bin/env node
/**
 * Pi Muxed Address Guard — CLI over the pure codec in codec.mjs.
 *
 * GET-only. No writes. No network required for the codec itself.
 *
 * Usage:
 *   node muxed-guard.mjs --address M...        decode + validate
 *   node muxed-guard.mjs --build <G> --id <n>  rebuild M from G and id
 *   node muxed-guard.mjs --check-g <G>         check a G address's checksum
 */

import { parseArgs } from "node:util";
import { decodeG, decodeM, buildMFromG, inspectM, encodeStrkey, VERSION_G } from "./codec.mjs";

function usage() {
  console.log(
    [
      "Pi Muxed Address Guard",
      "",
      "  Decode an M address:",
      "    node muxed-guard.mjs --address M...",
      "",
      "  Rebuild an M address from a G address and a numeric muxed id:",
      "    node muxed-guard.mjs --build G... --id 123456",
      "",
      "  Verify a G address's checksum only:",
      "    node muxed-guard.mjs --check-g G...",
    ].join("\n")
  );
}

const { values } = parseArgs({
  options: {
    address: { type: "string" },
    build: { type: "string" },
    id: { type: "string" },
    "check-g": { type: "string" },
    help: { type: "boolean", default: false },
  },
});

if (values.help || (!values.address && !values.build && !values["check-g"])) {
  usage();
  process.exit(values.help ? 0 : 1);
}

try {
  if (values.address) {
    const r = inspectM(values.address.trim());
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.verdict === "VALID" ? 0 : 2);
  }

  if (values.build) {
    const g = values.build.trim();
    const id = values.id;
    if (!id) throw new Error("--build requires --id");
    const m = buildMFromG(g, id);
    const d = decodeM(m);
    console.log(JSON.stringify({ built: m, baseAccountEd25519: d.ed25519, muxedId: d.muxedId.toString(), checksumValid: d.checksumValid }, null, 2));
  }

  if (values["check-g"]) {
    const r = decodeG(values["check-g"].trim());
    console.log(JSON.stringify({ address: values["check-g"].trim(), ed25519: r.ed25519, checksumValid: r.checksumValid, verdict: r.checksumValid ? "VALID" : "INVALID" }, null, 2));
    process.exit(r.checksumValid ? 0 : 2);
  }
} catch (e) {
  console.error(JSON.stringify({ verdict: "ERROR", error: e.message }, null, 2));
  process.exit(1);
}
