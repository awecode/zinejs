import { describe, it, expect } from 'vitest';
import { encodeQr, qrSvg } from './qr';

/** Read the module at (x, y) as a boolean. */
const at = (q: { size: number; modules: Uint8Array }, x: number, y: number): boolean =>
  q.modules[y * q.size + x] === 1;

describe('qr encoder', () => {
  it('sizes the grid to fit the payload', () => {
    // Versions step 4 modules at a time from 21 (version 1).
    const small = encodeQr('hi');
    expect(small.size).toBe(21);
    const big = encodeQr('x'.repeat(120));
    expect(big.size).toBeGreaterThan(small.size);
    expect((big.size - 17) % 4).toBe(0);
  });

  it('draws a finder pattern in three corners, and none in the fourth', () => {
    // A scanner locates the code by these; the missing fourth is what fixes its orientation.
    const q = encodeQr('https://example.com/doc#page=3');
    const finder = (ox: number, oy: number): boolean =>
      at(q, ox + 0, oy + 0) && // outer ring
      at(q, ox + 6, oy + 6) &&
      !at(q, ox + 1, oy + 1) && // the light gap
      at(q, ox + 3, oy + 3); // the solid core
    expect(finder(0, 0)).toBe(true);
    expect(finder(q.size - 7, 0)).toBe(true);
    expect(finder(0, q.size - 7)).toBe(true);
    // The bottom-right corner carries data, not a finder.
    expect(finder(q.size - 7, q.size - 7)).toBe(false);
  });

  it('lays alternating timing patterns between the finders', () => {
    const q = encodeQr('hello');
    for (let i = 8; i < q.size - 8; i++) {
      expect(at(q, i, 6)).toBe(i % 2 === 0);
      expect(at(q, 6, i)).toBe(i % 2 === 0);
    }
  });

  it('sets the module that is dark in every QR code', () => {
    const q = encodeQr('hello');
    expect(at(q, 8, q.size - 8)).toBe(true);
  });

  it('encodes different text differently, and the same text identically', () => {
    const a = encodeQr('https://example.com/a');
    const b = encodeQr('https://example.com/b');
    expect(a.modules).not.toEqual(b.modules);
    expect(encodeQr('https://example.com/a').modules).toEqual(a.modules);
  });

  it('handles non-ASCII, which byte mode encodes as UTF-8', () => {
    expect(() => encodeQr('página 5 — café')).not.toThrow();
  });

  it('refuses a payload it cannot encode rather than emitting an unscannable code', () => {
    expect(() => encodeQr('x'.repeat(500))).toThrow(/too long/);
  });
});

describe('qrSvg', () => {
  it('renders a square svg at the requested size, with a quiet border', () => {
    const svg = qrSvg('https://example.com', 128);
    expect(svg).toContain('width="128" height="128"');
    const { size } = encodeQr('https://example.com');
    expect(svg).toContain(`viewBox="0 0 ${size + 4} ${size + 4}"`); // 2 modules each side
    expect(svg).toContain('<path d="M'); // the dark modules
  });
});
