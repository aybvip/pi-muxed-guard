import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  base32Encode,
  base32Decode,
  crc16Xmodem,
  decodeG,
  decodeM,
  buildMFromG,
  encodeStrkey,
  inspectM,
  VERSION_G,
  VERSION_M,
  G_LEN,
  M_LEN,
} from "./codec.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, "muxed-guard.mjs");

// Real Pi Mainnet accounts observed in the wild. The ed25519 values below were
// measured independently and are used here as fixed regression fixtures.
const BITGET_G = "GDFNWH6ZFJVHJDLBMNOUT35X4EEKQVJAO3ZDL4NL7VQJLC4PJOQFWJ75";
const BITGET_ED = "cadb1fd92a6a748d61635d49efb7e108a8552076f235f1abfd60958b8f4ba05b";
const OKX_G = "GALYJFJ5SVD45FBWN2GT4IW67SEZ3IBOFSBSPUFCWV427NBNLG3PXEQU";
const OKX_ED = "1784953d9547ce94366e8d3e22defc899da02e2c8327d0a2b579afb42d59b6fb";

test("base32 round-trip over all byte values", () => {
  const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
});

test("base32 decode rejects invalid characters", () => {
  assert.throws(() => base32Decode("AB!C"), /invalid base32 char/);
});

test("CRC16-XModem known vector: '123456789' -> 0x31C3", () => {
  // Standard CRC-16/XMODEM check value.
  assert.equal(crc16Xmodem(Buffer.from("123456789", "ascii")), 0x31c3);
});

test("CRC16-XModem of empty buffer is 0", () => {
  assert.equal(crc16Xmodem(Buffer.alloc(0)), 0);
});

test("G address decodes to the measured ed25519 (Bitget)", () => {
  const r = decodeG(BITGET_G);
  assert.equal(r.ed25519, BITGET_ED);
  assert.equal(r.checksumValid, true);
});

test("G address decodes to the measured ed25519 (OKX)", () => {
  const r = decodeG(OKX_G);
  assert.equal(r.ed25519, OKX_ED);
  assert.equal(r.checksumValid, true);
});

test("G address is exactly 56 chars", () => {
  assert.equal(BITGET_G.length, G_LEN);
  assert.equal(OKX_G.length, G_LEN);
});

test("M address is exactly 69 chars (no base32 padding)", () => {
  const m = buildMFromG(BITGET_G, 12345);
  assert.equal(m.length, M_LEN);
  assert.ok(!m.includes("="), "M address must not contain '=' padding");
});

test("building M from (G, id) round-trips exactly", () => {
  for (const id of [0n, 1n, 12345n, 4294967296n, 2n ** 64n - 1n]) {
    const m = buildMFromG(BITGET_G, id);
    const d = decodeM(m);
    assert.equal(d.muxedId, id, `id ${id} survived`);
    assert.equal(d.ed25519, BITGET_ED);
    assert.equal(d.checksumValid, true);
  }
});

test("inspectM reports VALID with exact round-trip", () => {
  const m = buildMFromG(OKX_G, 777n);
  const r = inspectM(m);
  assert.equal(r.verdict, "VALID");
  assert.equal(r.roundTripExact, true);
  assert.equal(r.checksumValid, true);
  assert.equal(r.baseAccount, OKX_G);
  assert.equal(r.muxedId, "777");
});

test("a tampered M address is rejected (checksum or round-trip fails)", () => {
  const m = buildMFromG(BITGET_G, 42n);
  // Flip one base32 char in the middle.
  const chars = m.split("");
  const pos = 30;
  chars[pos] = chars[pos] === "A" ? "B" : "A";
  const tampered = chars.join("");
  let rejected = false;
  try {
    const r = inspectM(tampered);
    rejected = r.verdict !== "VALID";
  } catch {
    rejected = true; // hard decode failure is also a rejection
  }
  assert.ok(rejected, "tampered address must not be reported VALID");
});

test("decodeG rejects an M address", () => {
  const m = buildMFromG(BITGET_G, 1n);
  assert.throws(() => decodeG(m), /expected G address/);
});

test("decodeM rejects a G address", () => {
  assert.throws(() => decodeM(BITGET_G), /expected M address/);
});

test("encodeStrkey(VERSION_G, ed25519) reproduces the original G", () => {
  const rebuilt = encodeStrkey(VERSION_G, Buffer.from(BITGET_ED, "hex"));
  assert.equal(rebuilt, BITGET_G);
});

test("VERSION constants match the strkey spec", () => {
  assert.equal(VERSION_G, 0x30);
  assert.equal(VERSION_M, 0x60);
});

test("CLI --check-g prints VALID for a known-good G", () => {
  const out = execFileSync(process.execPath, [CLI, "--check-g", BITGET_G], { encoding: "utf8" });
  const j = JSON.parse(out);
  assert.equal(j.verdict, "VALID");
  assert.equal(j.ed25519, BITGET_ED);
});

test("CLI --address decodes an M and exits 0", () => {
  const m = buildMFromG(OKX_G, 99n);
  const out = execFileSync(process.execPath, [CLI, "--address", m], { encoding: "utf8" });
  const j = JSON.parse(out);
  assert.equal(j.verdict, "VALID");
  assert.equal(j.muxedId, "99");
});

test("CLI --build emits a 69-char M with valid checksum", () => {
  const out = execFileSync(process.execPath, [CLI, "--build", BITGET_G, "--id", "2026"], { encoding: "utf8" });
  const j = JSON.parse(out);
  assert.equal(j.built.length, M_LEN);
  assert.equal(j.checksumValid, true);
  assert.equal(j.muxedId, "2026");
});

test("CLI exits 2 on a garbage address", () => {
  let code = 0;
  try {
    execFileSync(process.execPath, [CLI, "--address", "M" + "A".repeat(68)], { encoding: "utf8", stdio: "pipe" });
  } catch (e) {
    code = e.status;
  }
  assert.equal(code, 2);
});

test("CLI --help exits 0", () => {
  execFileSync(process.execPath, [CLI, "--help"], { encoding: "utf8", stdio: "pipe" });
});
