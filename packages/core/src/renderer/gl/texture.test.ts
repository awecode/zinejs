// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { uploadTexture } from './texture';

/** A stand-in for a decoded raster the shape uploadTexture reads (width/height + drawable). */
function fakeRaster(width: number, height: number): TexImageSource {
  return { width, height } as unknown as TexImageSource;
}

/** A minimal WebGL2 stub that records the dimensions handed to texImage2D. */
function fakeGl(maxTextureSize: number) {
  const uploaded: { width: number; height: number }[] = [];
  const gl = {
    TEXTURE_2D: 0,
    RGBA: 0,
    UNSIGNED_BYTE: 0,
    MAX_TEXTURE_SIZE: 0x0d33,
    UNPACK_FLIP_Y_WEBGL: 0,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0,
    getParameter: () => maxTextureSize,
    bindTexture: () => {},
    pixelStorei: () => {},
    texImage2D: (
      _t: number,
      _l: number,
      _if: number,
      _f: number,
      _ty: number,
      source: { width: number; height: number },
    ) => {
      uploaded.push({ width: source.width, height: source.height });
    },
  } as unknown as WebGL2RenderingContext;
  return { gl, uploaded };
}

const tex = {} as WebGLTexture;

describe('uploadTexture', () => {
  it('uploads a raster within the GPU limit unchanged', () => {
    const { gl, uploaded } = fakeGl(4096);
    const dims = uploadTexture(gl, tex, fakeRaster(2000, 3000));
    expect(uploaded).toEqual([{ width: 2000, height: 3000 }]);
    expect(dims).toEqual({ width: 2000, height: 3000 });
  });

  it('downscales a raster past the limit to fit, preserving aspect', () => {
    const { gl, uploaded } = fakeGl(4096);
    // 5000x7600 exceeds 4096 on both axes; longest is 7600, so factor = 4096/7600.
    const dims = uploadTexture(gl, tex, fakeRaster(5000, 7600));
    expect(uploaded).toHaveLength(1);
    expect(Math.max(uploaded[0]!.width, uploaded[0]!.height)).toBeLessThanOrEqual(4096);
    expect(uploaded[0]!.height).toBe(4096); // the longest axis lands exactly on the cap
    expect(uploaded[0]!.width).toBe(Math.floor(5000 * (4096 / 7600)));
    // The returned dims are what was really uploaded, for honest byte accounting.
    expect(dims).toEqual(uploaded[0]);
  });

  it('clamps only the offending axis-set, leaving a raster tall-but-thin within bounds alone', () => {
    const { gl, uploaded } = fakeGl(4096);
    const dims = uploadTexture(gl, tex, fakeRaster(4096, 4096));
    expect(dims).toEqual({ width: 4096, height: 4096 }); // exactly at the cap is fine
    expect(uploaded).toEqual([{ width: 4096, height: 4096 }]);
  });
});
