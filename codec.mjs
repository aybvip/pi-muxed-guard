/**
 * Pi muxed-address codec — pure functions, no I/O, no CLI side effects.
 *
 * Strkey = RFC 4648 base32 (NO padding) + CRC16-XModem checksum.
 *   G address: version 0x30 (6<<3) + 32-byte ed25519            -> 56 chars
 *   M address: version 0x60      + 32-byte ed25519 + 8-byte id  -> 69 chars
 *
 * The muxed ID is a 64-bit big-endian recipient selector. It says WHO on a
 * shared account receives a payment. It is not an asset tag and not an origin.
 */

export const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const VERSION_G = 6 << 3; // 0x30
export const VERSION_M = 0x60; // 96
export const G_LEN = 56;
export const M_LEN = 69;

export function base32Encode(bytes) {
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
  return out; // Stellar strkey is raw base32, no "=" padding
}

export function base32Decode(s) {
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

export function crc16Xmodem(buf) {
  let crc = 0;
  for (const byte of buf) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function decodeStrkey(str) {
  const buf = base32Decode(str);
  if (buf.length < 3) throw new Error("strkey too short");
  const version = buf[0];
  const payload = buf.subarray(1, buf.length - 2);
  const checksum = buf.readUInt16LE(buf.length - 2);
  const expected = crc16Xmodem(buf.subarray(0, buf.length - 2));
  return { version, payload, checksum, valid: checksum === expected };
}

export function encodeStrkey(version, payload) {
  const body = Buffer.concat([Buffer.from([version]), payload]);
  const crc = crc16Xmodem(body);
  const full = Buffer.concat([body, Buffer.from([crc & 0xff, crc >> 8])]);
  return base32Encode(full);
}

export function decodeG(addr) {
  const d = decodeStrkey(addr);
  if (d.version !== VERSION_G) {
    throw new Error(`expected G address, got version 0x${d.version.toString(16)}`);
  }
  if (d.payload.length !== 32) throw new Error("G payload must be 32 bytes");
  return { ed25519: d.payload.toString("hex"), checksumValid: d.valid };
}

export function decodeM(addr) {
  const d = decodeStrkey(addr);
  if (d.version !== VERSION_M) {
    throw new Error(`expected M address, got version 0x${d.version.toString(16)}`);
  }
  if (d.payload.length !== 40) {
    throw new Error(`M payload must be 40 bytes, got ${d.payload.length}`);
  }
  return {
    ed25519: d.payload.subarray(0, 32).toString("hex"),
    muxedId: d.payload.subarray(32, 40).readBigUInt64BE(),
    checksumValid: d.valid,
  };
}

export function buildMFromG(gAddr, muxedId) {
  const g = decodeG(gAddr);
  const idBuf = Buffer.alloc(8);
  idBuf.writeBigUInt64BE(BigInt(muxedId));
  return encodeStrkey(VERSION_M, Buffer.concat([Buffer.from(g.ed25519, "hex"), idBuf]));
}

export function gFromM(mAddr) {
  const d = decodeM(mAddr);
  return encodeStrkey(VERSION_G, Buffer.from(d.ed25519, "hex"));
}

/** Full check: decompose M into (G, id) and prove the rebuild is byte-identical. */
export function inspectM(addr) {
  const d = decodeM(addr);
  const gAddr = encodeStrkey(VERSION_G, Buffer.from(d.ed25519, "hex"));
  const rebuilt = buildMFromG(gAddr, d.muxedId);
  return {
    input: addr,
    baseAccount: gAddr,
    baseAccountEd25519: d.ed25519,
    muxedId: d.muxedId.toString(),
    checksumValid: d.checksumValid,
    rebuiltFromGAndId: rebuilt,
    roundTripExact: rebuilt === addr,
    verdict: d.checksumValid && rebuilt === addr ? "VALID" : "INVALID",
  };
}
