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

/** Upload a decoded page raster (ImageBitmap or canvas) into `tex`. */
export function uploadTexture(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  source: TexImageSource,
): void {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  // No Y flip: the vertex shader maps aUnit.y=0 to the page top and samples the
  // source's top row there. UNPACK_FLIP_Y is honored for <canvas> sources but
  // IGNORED for ImageBitmap, so flipping would invert PDF (canvas) pages while
  // leaving image (ImageBitmap) pages upright. Off keeps both consistent.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
}
