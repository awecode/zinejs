import { describe, it, expect } from 'vitest';
import { installMapUpsertPolyfill, wrapPdfWorkerSrc } from './mapUpsertPolyfill';

type MapUpsert = {
  getOrInsert: (key: unknown, defaultValue: unknown) => unknown;
  getOrInsertComputed: (key: unknown, callbackfn: (key: unknown) => unknown) => unknown;
};

describe('map upsert polyfill', () => {
  it('memoizes like Map.prototype.getOrInsertComputed', () => {
    const proto = Map.prototype as typeof Map.prototype & Partial<MapUpsert>;
    const origComputed = proto.getOrInsertComputed;
    const origInsert = proto.getOrInsert;
    try {
      // Force the shim so this test still means something on engines that already ship upsert.
      delete proto.getOrInsertComputed;
      delete proto.getOrInsert;
      installMapUpsertPolyfill();

      const map = new Map<string, number>() as Map<string, number> & MapUpsert;
      let calls = 0;
      expect(map.getOrInsertComputed('a', () => ++calls)).toBe(1);
      expect(map.getOrInsertComputed('a', () => ++calls)).toBe(1);
      expect(calls).toBe(1);
      expect(map.getOrInsert('b', 7)).toBe(7);
      expect(map.getOrInsert('b', 9)).toBe(7);
    } finally {
      Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
        configurable: true,
        writable: true,
        value: origComputed,
      });
      Object.defineProperty(Map.prototype, 'getOrInsert', {
        configurable: true,
        writable: true,
        value: origInsert,
      });
    }
  });

  it('wrapPdfWorkerSrc is stable for a given src', () => {
    const a = wrapPdfWorkerSrc('/pdf.worker.mjs');
    const b = wrapPdfWorkerSrc('/pdf.worker.mjs');
    expect(a).toBe(b);
  });
});
