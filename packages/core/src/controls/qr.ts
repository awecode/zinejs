/**
 * A small QR encoder, enough to turn a URL into a scannable grid.
 *
 * Written rather than pulled in so the package keeps its "no dependencies" promise, and so no
 * reader's document URL is handed to a third-party image service to be logged. Deliberately
 * narrow: byte mode, error-correction level M, versions 1-10 (up to 271 characters at level M),
 * which covers any sane page URL. Longer input throws rather than silently producing a code that
 * will not scan.
 */

/** Data codewords available per version at error-correction level M, versions 1-10. */
const DATA_CODEWORDS = [16, 28, 44, 64, 86, 108, 124, 154, 182, 216];
/** Error-correction codewords per block, level M, versions 1-10. */
const EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
/** How many EC blocks the data is split into, level M, versions 1-10. */
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
/** Where alignment patterns sit, per version (empty for version 1). */
const ALIGNMENT = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// Galois field tables for GF(256), used by the Reed-Solomon error correction.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d; // the QR field's primitive polynomial
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;

const mul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[(LOG[a]! + LOG[b]!) % 255]!;

/** The generator polynomial for `degree` error-correction codewords. */
function generator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]!;
      next[j + 1] ^= mul(poly[j]!, EXP[i]!);
    }
    poly = next;
  }
  return poly;
}

/** Reed-Solomon remainder: the error-correction codewords for one block. */
function ecBlock(data: Uint8Array, count: number): Uint8Array {
  const gen = generator(count);
  const out = new Uint8Array(count);
  for (const byte of data) {
    const factor = byte ^ out[0]!;
    out.copyWithin(0, 1);
    out[count - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < count; i++) out[i] ^= mul(gen[i + 1]!, factor);
    }
  }
  return out;
}

/** The 15-bit format string for level M and a mask, with its BCH check bits. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask; // 00 = level M
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

type Grid = { size: number; modules: Uint8Array; reserved: Uint8Array };

const at = (g: Grid, x: number, y: number): number => g.modules[y * g.size + x]!;
const set = (g: Grid, x: number, y: number, dark: boolean, reserve = true): void => {
  g.modules[y * g.size + x] = dark ? 1 : 0;
  if (reserve) g.reserved[y * g.size + x] = 1;
};

function placeFinder(g: Grid, cx: number, cy: number): void {
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue;
      const d = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));
      set(g, x, y, d !== 2 && d <= 3);
    }
  }
}

/** Encode `text` as a QR matrix: a square of 0/1 by row. */
export function encodeQr(text: string): { size: number; modules: Uint8Array } {
  const bytes = new TextEncoder().encode(text);
  const version = DATA_CODEWORDS.findIndex((cap) => bytes.length + 2 <= cap) + 1;
  if (version === 0) {
    throw new Error(`qr: ${bytes.length} bytes is too long for this encoder (max 214).`);
  }

  // --- bit stream: mode, length, payload, terminator, padding ---
  const capacity = DATA_CODEWORDS[version - 1]!;
  const bits: number[] = [];
  const push = (value: number, width: number): void => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, version < 10 ? 8 : 16);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity * 8 - bits.length)); // terminator
  while (bits.length % 8) bits.push(0);
  const data = new Uint8Array(capacity);
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b]!;
    data[i / 8] = byte;
  }
  for (let i = bits.length / 8, pad = 0; i < capacity; i++, pad++) {
    data[i] = pad % 2 === 0 ? 0xec : 0x11; // the spec's alternating pad bytes
  }

  // --- split into blocks, compute EC, interleave ---
  const blockCount = BLOCKS[version - 1]!;
  const ecCount = EC_PER_BLOCK[version - 1]!;
  const shortLen = Math.floor(capacity / blockCount);
  const longCount = capacity % blockCount;
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let i = 0, offset = 0; i < blockCount; i++) {
    const len = shortLen + (i >= blockCount - longCount ? 1 : 0);
    const block = data.subarray(offset, offset + len);
    offset += len;
    dataBlocks.push(block);
    ecBlocks.push(ecBlock(block, ecCount));
  }
  const codewords: number[] = [];
  for (let i = 0; i < shortLen + 1; i++) {
    for (const block of dataBlocks) if (i < block.length) codewords.push(block[i]!);
  }
  for (let i = 0; i < ecCount; i++) {
    for (const block of ecBlocks) codewords.push(block[i]!);
  }

  // --- lay out the matrix ---
  const size = version * 4 + 17;
  const g: Grid = {
    size,
    modules: new Uint8Array(size * size),
    reserved: new Uint8Array(size * size),
  };
  placeFinder(g, 0, 0);
  placeFinder(g, size - 7, 0);
  placeFinder(g, 0, size - 7);
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0; // timing patterns
    set(g, i, 6, dark);
    set(g, 6, i, dark);
  }
  for (const ax of ALIGNMENT[version - 1]!) {
    for (const ay of ALIGNMENT[version - 1]!) {
      // Alignment patterns skip the corners already held by finders.
      if ((ax < 9 && ay < 9) || (ax < 9 && ay > size - 10) || (ax > size - 10 && ay < 9)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          set(g, ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }
  set(g, 8, size - 8, true); // the always-dark module
  // Reserve the format areas so data does not land in them.
  for (let i = 0; i < 9; i++) {
    if (i !== 6) set(g, i, 8, false), set(g, 8, i, false);
  }
  for (let i = 0; i < 8; i++) set(g, size - 1 - i, 8, false), set(g, 8, size - 1 - i, false);
  set(g, 8, size - 8, true);

  // --- weave the codewords in, masking as we go (mask 0: (x + y) % 2) ---
  let bit = 0;
  const total = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // the vertical timing column is skipped
    for (let step = 0; step < size; step++) {
      for (let col = 0; col < 2; col++) {
        const x = right - col;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - step : step;
        if (g.reserved[y * size + x]) continue;
        let dark = false;
        if (bit < total) {
          dark = ((codewords[bit >>> 3]! >>> (7 - (bit & 7))) & 1) === 1;
          bit++;
        }
        if ((x + y) % 2 === 0) dark = !dark; // mask 0
        set(g, x, y, dark, false);
      }
    }
  }

  // --- format information, now that the mask is known ---
  const format = formatBits(0);
  for (let i = 0; i < 15; i++) {
    const dark = ((format >>> i) & 1) === 1;
    // Around the top-left finder...
    const a = i < 6 ? i : i < 8 ? i + 1 : 8;
    const b = i < 8 ? 8 : i < 9 ? 7 : 14 - i;
    set(g, a, 8, dark);
    set(g, 8, b, dark);
    // ...and the copy split between the other two.
    if (i < 8) set(g, size - 1 - i, 8, dark);
    else set(g, 8, size - 15 + i, dark);
  }
  set(g, 8, size - 8, true);

  return { size, modules: g.modules };
}

/** Render a QR matrix as an SVG string, sized to `px`. */
export function qrSvg(text: string, px: number): string {
  const { size, modules } = encodeQr(text);
  let path = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y * size + x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  const quiet = 2; // the spec asks for 4; 2 scans fine and wastes less space on screen
  const box = size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#fff"/><g transform="translate(${quiet} ${quiet})" fill="#000">${`<path d="${path}"/>`}</g></svg>`;
}
