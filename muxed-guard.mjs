#!/usr/bin/env node
/**
 * Pi Muxed Address Guard — read-only, zero-dependency.
 *
 * Decodes a muxed (M...) deposit address into its G... base account and
 * 64-bit muxed ID, validates the CRC16-XModem checksum on both, and rebuilds
 * the address from (G, id) to prove round-trip fidelity.
 *
 * Why: sending Pi to an M-address whose embedded ID does not belong to the
 * intended recipient at that venue sends the funds to whoever else holds that
 * ID on the same G account. This tool makes the decomposition visible before
 * a send, not after.
 *
 * GET-only. No writes. No network required for the codec.
 *
 * Usage:
 *   node muxed-guard.mjs --address M...        decode + validate
 *   node muxed-guard.mjs --build <G> --id <n>  rebuild M from G and id
 */

import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Strkey codec (RFC 4648 base32 + CRC16-XModem checksum)
// ---------------------------------------------------------------------------

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  // Stellar strkey is raw base32 with NO "=" padding (M... is exactly 69 chars).
  return out;
}

function base32Decode(s) {
  s = s.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of s) {
    const idx = B32.indexOf(c);
    if (idx === -1) throw new Error(`invalid base32 char: ${c}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function crc16Xmodem(buf) {
  let crc = 0;
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

const VERSION_G = 6 << 3; // 0x30 -> "G"
const VERSION_M = 0x60; // 96   -> "M"

function decodeStrkey(str) {
  const buf = base32Decode(str);
  if (buf.length < 3) throw new Error("strkey too short");
  const version = buf[0];
  const payload = buf.subarray(1, buf.length - 2);
  const checksum = buf.readUInt16LE(buf.length - 2);
  const expected = crc16Xmodem(buf.subarray(0, buf.length - 2));
  const valid = checksum === expected;
  return { version, payload, checksum, valid, raw: buf };
}

function encodeStrkey(version, payload) {
  const body = Buffer.concat([Buffer.from([version]), payload]);
  const crc = crc16Xmodem(body);
  const full = Buffer.concat([body, Buffer.from([crc & 0xff, crc >> 8])]);
  return base32Encode(full);
}

// ---------------------------------------------------------------------------
// Muxed-specific operations
// ---------------------------------------------------------------------------

function decodeG(addr) {
  const d = decodeStrkey(addr);
  if (d.version !== VERSION_G) throw new Error(`expected G address, got version 0x${d.version.toString(16)}`);
  if (d.payload.length !== 32) throw new Error("G payload must be 32 bytes");
  return { ed25519: d.payload.toString("hex"), checksumValid: d.valid };
}

function decodeM(addr) {
  const d = decodeStrkey(addr);
  if (d.version !== VERSION_M) throw new Error(`expected M address, got version 0x${d.version.toString(16)}`);
  if (d.payload.length !== 40) throw new Error(`M payload must be 40 bytes, got ${d.payload.length}`);
  const ed25519 = d.payload.subarray(0, 32);
  const muxedIdBuf = d.payload.subarray(32, 40);
  const muxedId = muxedIdBuf.readBigUInt64BE();
  return { ed25519: ed25519.toString("hex"), muxedId, checksumValid: d.valid };
}

function buildMFromG(gAddr, muxedId) {
  const g = decodeG(gAddr);
  const ed = Buffer.from(g.ed25519, "hex");
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64BE(BigInt(muxedId));
  const payload = Buffer.concat([ed, idBuf]);
  return encodeStrkey(VERSION_M, payload);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

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
    const addr = values.address.trim();
    const d = decodeM(addr);
    const rebuilt = buildMFromG(encodeStrkey(VERSION_G, Buffer.from(d.ed25519, "hex")), d.muxedId);
    const roundTrip = rebuilt === addr;
    console.log(JSON.stringify({
      input: addr,
      baseAccountEd25519: d.ed25519,
      muxedId: d.muxedId.toString(),
      checksumValid: d.checksumValid,
      rebuiltFromGAndId: rebuilt,
      roundTripExact: roundTrip,
      verdict: d.checksumValid && roundTrip ? "VALID" : "INVALID",
    }, null, 2));
    process.exit(d.checksumValid && roundTrip ? 0 : 2);
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
    const g = values["check-g"].trim();
    const r = decodeG(g);
    console.log(JSON.stringify({ address: g, ed25519: r.ed25519, checksumValid: r.checksumValid, verdict: r.checksumValid ? "VALID" : "INVALID" }, null, 2));
    process.exit(r.checksumValid ? 0 : 2);
  }
} catch (e) {
  console.error(JSON.stringify({ verdict: "ERROR", error: e.message }, null, 2));
  process.exit(1);
}
