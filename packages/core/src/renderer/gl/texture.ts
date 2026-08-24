/** Create a page texture with clamp + linear filtering (no mipmaps — §8.3). */
export function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
  const tex = gl.createTexture();
  if (tex === null) throw new Error('WebglRenderer: could not create a texture.');
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return tex;
}

/**
 * Upload a decoded page raster (ImageBitmap or canvas) into `tex`, returning the dimensions actually
 * uploaded (which differ from the source when it was too big for the GPU).
 *
 * A raster larger than `gl.MAX_TEXTURE_SIZE` on either axis cannot be uploaded: `texImage2D` fails
 * and leaves the texture incomplete, which samples as solid black. A zoomed page on a high-DPR phone
 * (small MAX_TEXTURE_SIZE, e.g. 4096) hits this readily. Downscale over-large rasters to fit,
 * preserving aspect, so a slightly-softer page beats a black one.
 */
export function uploadTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  source: TexImageSource,
): { width: number; height: number } {
  const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
  const upload = fitToLimit(source, max);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // No Y flip: the vertex shader maps aUnit.y=0 to the page top and samples the
  // source's top row there. UNPACK_FLIP_Y is honored for <canvas> sources but
  // IGNORED for ImageBitmap, so flipping would invert PDF (canvas) pages while
  // leaving image (ImageBitmap) pages upright. Off keeps both consistent.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, upload);
  return { width: upload.width, height: upload.height };
}

/** Return `source` unchanged if it fits `max`, else a canvas holding it scaled down to fit. */
function fitToLimit(source: TexImageSource, max: number): TexImageSource & { width: number; height: number } {
  const dims = source as unknown as { width: number; height: number };
  const longest = Math.max(dims.width, dims.height);
  if (!Number.isFinite(max) || max <= 0 || longest <= max) {
    return dims as TexImageSource & { width: number; height: number };
  }
  const factor = max / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(dims.width * factor));
  canvas.height = Math.max(1, Math.floor(dims.height * factor));
  canvas.getContext('2d')?.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas;
}
