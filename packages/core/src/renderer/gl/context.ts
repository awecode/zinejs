/** Create a WebGL2 context, or throw so the caller can fall back to CSS (§8.4). */
export function createGlContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: true,
    depth: false,
    stencil: false,
    // We render on demand (not every frame), so the buffer must persist between
    // composites — otherwise the settled page flickers once the flip animation
    // stops and nothing is redrawing each frame.
    preserveDrawingBuffer: true,
  });
  if (gl === null) {
    throw new Error('WebglRenderer: could not create a WebGL2 context.');
  }
  return gl;
}
