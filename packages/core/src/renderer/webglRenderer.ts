import { flipProgressToPose } from '../geometry/flipProgressToPose';
import type { Spread } from '../engine/spread';
import type {
  FlipDirection,
  LayoutMetrics,
  Renderer,
  RenderOptions,
  SpreadContent,
} from './types';
import { createGlContext } from './gl/context';
import { createProgram } from './gl/program';
import { createTexture, uploadTexture } from './gl/texture';

// Flat program: maps a unit quad to a page rect (device px, top-left origin) with
// zoom/pan. aUnit.y=0 is the page top and samples the source's top row (no flip).
const FLAT_VERT = `#version 300 es
in vec2 aUnit;
uniform vec2 uViewport;
uniform vec4 uRect;
uniform vec3 uView;
out vec2 vUv;
void main() {
  vec2 px = uRect.xy + aUnit * uRect.zw;
  px = px * uView.x + uView.yz;
  vec2 clip = px / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUnit;
}`;

const FLAT_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() { outColor = texture(uTex, vUv); }`;

// Curl program: the turning leaf. u runs from the spine (0) to the free edge (1).
// The page wraps around a vertical cylinder (radius shrinks with uCurl) and rotates
// about the spine by uAngle; orthographic (no perspective yet).
const CURL_VERT = `#version 300 es
in vec2 aUnit;
uniform vec2 uViewport;
uniform vec4 uLeaf;   // spineX, y, width, height (device px)
uniform vec3 uView;   // scale, tx, ty
uniform float uAngle; // spine rotation 0..PI
uniform float uCurl;  // 0..1 bend amount
uniform float uDir;   // +1 leaf sweeps from +x side, -1 from -x side
out vec2 vUv;
out float vU;
void main() {
  float u = aUnit.x;
  float W = uLeaf.z;
  float bend = uCurl * 1.4;
  float xw, zw;
  if (bend > 0.001) {
    float R = W / bend;      // arc length stays ~W
    float phi = u * bend;
    xw = R * sin(phi);
    zw = R * (1.0 - cos(phi));
  } else {
    xw = u * W;
    zw = 0.0;
  }
  float X = xw * cos(uAngle) - zw * sin(uAngle); // rotate about spine (y axis)
  float px = uLeaf.x + uDir * X;
  float py = uLeaf.y + aUnit.y * uLeaf.w;
  vec2 p = vec2(px, py) * uView.x + uView.yz;
  vec2 clip = p / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUnit;
  vU = u;
}`;

// Per-fragment facing: whichever side of the curling sheet faces the viewer shows
// its own page, so mid-curl you see a sliver of the next page (continuous handoff).
const CURL_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vU;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform float uShadow;
uniform highp float uDir; // must match the vertex stage's default highp
out vec4 outColor;
void main() {
  // A backward flip (uDir < 0) mirrors the mesh horizontally, which flips both the
  // projected winding (gl_FrontFacing) and the page's u->x mapping; undo both here.
  float fx = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
  bool showFront = uDir > 0.0 ? gl_FrontFacing : !gl_FrontFacing;
  vec4 c = showFront ? texture(uFront, vec2(fx, vUv.y)) : texture(uBack, vec2(1.0 - fx, vUv.y));
  float crease = 1.0 - smoothstep(0.0, 0.12, vU);   // dark at the spine
  float freeEdge = smoothstep(0.82, 1.0, vU);        // dark at the free edge
  float shade = 1.0 - uShadow * (0.4 * crease + 0.22 * freeEdge);
  float sheen = uShadow * 0.12 * smoothstep(0.3, 0.55, vU) * (1.0 - smoothstep(0.55, 0.82, vU));
  c.rgb = clamp(c.rgb * shade + sheen, 0.0, 1.0);
  outColor = c;
}`;

const GRID_COLS = 24;
// If a lost context is not restored within this window, give up and let the engine
// fall back to the CSS renderer (§8.4).
const RESTORE_TIMEOUT_MS = 4000;
// GPU texture LRU ceiling (§9). Page textures are cached by content and evicted
// least-recently-used beyond this, so flips/zooms don't re-upload every frame.
const MAX_TEXTURE_CACHE_BYTES = 256 * 1024 * 1024;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface FlipState {
  underLeft: TexImageSource | null;
  underRight: TexImageSource | null;
  underFull: TexImageSource | null; // fill mode
  front: TexImageSource | null;
  back: TexImageSource | null;
  dir: number; // +1 / -1 for the curl sweep
  spineAtStart: number; // 0 = spine at left edge, 0.5 = center, 1 = right edge
  fill: boolean;
}

/**
 * GPU renderer (WebGL2, hand-written, no third-party library). The turning leaf is
 * a grid mesh bent around a cylinder (driven by the shared flipProgressToPose), the
 * static pages are flat textured quads underneath. Restores its GL state in place on
 * context loss; if that fails it signals `onFatal` so the engine can fall back to CSS.
 */
export class WebglRenderer implements Renderer {
  #container: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #gl: WebGL2RenderingContext | null = null;

  #flat: WebGLProgram | null = null;
  #curl: WebGLProgram | null = null;
  #quadVao: WebGLVertexArrayObject | null = null;
  #gridVao: WebGLVertexArrayObject | null = null;
  #gridCount = 0;
  #texCache = new Map<TexImageSource, { tex: WebGLTexture; bytes: number }>();
  #cacheBytes = 0;
  #blankTex: WebGLTexture | null = null; // 1x1 transparent, for blank leaf faces

  #flatU: Record<string, WebGLUniformLocation | null> = {};
  #curlU: Record<string, WebGLUniformLocation | null> = {};

  #view = { scale: 1, tx: 0, ty: 0 };
  #dpr = 1;
  #content: SpreadContent | null = null;
  #fill = false;
  #flip: FlipState | null = null;
  #flipT = 0;
  #flipDir: FlipDirection = 'forward';

  #contextLost = false;
  #fatalFired = false;
  #restoreTimer: ReturnType<typeof setTimeout> | null = null;
  #fatalHandler: (() => void) | null = null;

  mount(container: HTMLElement): Promise<void> {
    this.#container = container;
    const doc = container.ownerDocument;
    const canvas = doc.createElement('canvas');
    // Fill the container as a plain block, so it doesn't depend on the container
    // being positioned (an absolute canvas would escape a static container).
    canvas.style.cssText = 'display:block;width:100%;height:100%;';
    container.append(canvas);
    this.#canvas = canvas;

    canvas.addEventListener('webglcontextlost', this.#onContextLost as EventListener);
    canvas.addEventListener('webglcontextrestored', this.#onContextRestored as EventListener);
    doc.addEventListener('visibilitychange', this.#onVisibilityChange);

    this.#gl = createGlContext(canvas); // throws if unavailable -> engine falls back (§8.4)
    this.#buildGlResources();

    return Promise.resolve();
  }

  destroy(): void {
    this.#clearRestoreTimer();
    const canvas = this.#canvas;
    if (canvas !== null) {
      canvas.removeEventListener('webglcontextlost', this.#onContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', this.#onContextRestored as EventListener);
      canvas.ownerDocument.removeEventListener('visibilitychange', this.#onVisibilityChange);
    }
    const gl = this.#gl;
    if (gl !== null) {
      for (const cached of this.#texCache.values()) gl.deleteTexture(cached.tex);
      if (this.#blankTex !== null) gl.deleteTexture(this.#blankTex);
      if (this.#quadVao !== null) gl.deleteVertexArray(this.#quadVao);
      if (this.#gridVao !== null) gl.deleteVertexArray(this.#gridVao);
      if (this.#flat !== null) gl.deleteProgram(this.#flat);
      if (this.#curl !== null) gl.deleteProgram(this.#curl);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    canvas?.remove();
    this.#texCache.clear();
    this.#cacheBytes = 0;
    this.#blankTex = null;
    this.#container = null;
    this.#canvas = null;
    this.#gl = null;
    this.#content = null;
    this.#flip = null;
  }

  onFatal(handler: () => void): void {
    this.#fatalHandler = handler;
  }

  renderSpread(_spread: Spread, content: SpreadContent, options?: RenderOptions): void {
    this.#content = content;
    this.#fill = options?.fill ?? false;
    this.#flip = null;
    this.#render();
  }

  beginFlip(
    from: SpreadContent,
    to: SpreadContent,
    direction: FlipDirection,
    options?: RenderOptions,
  ): void {
    const fill = options?.fill ?? false;
    this.#flipDir = direction;
    this.#flipT = 0;
    if (fill) {
      this.#flip = {
        underLeft: null,
        underRight: null,
        underFull: to.right ?? to.left,
        front: from.right ?? from.left,
        back: to.right ?? to.left,
        dir: direction === 'forward' ? 1 : -1,
        spineAtStart: direction === 'forward' ? 0 : 1,
        fill: true,
      };
    } else if (direction === 'forward') {
      // Right page lifts and swings left about the spine; left stays, right reveals `to`.
      this.#flip = {
        underLeft: from.left,
        underRight: to.right,
        underFull: null,
        front: from.right,
        back: to.left,
        dir: 1,
        spineAtStart: 0.5,
        fill: false,
      };
    } else {
      // Left page swings right about the spine; right stays, left reveals `to`.
      this.#flip = {
        underLeft: to.left,
        underRight: from.right,
        underFull: null,
        front: from.left,
        back: to.right,
        dir: -1,
        spineAtStart: 0.5,
        fill: false,
      };
    }
    this.#render();
  }

  setFlipProgress(t: number, direction: FlipDirection): void {
    this.#flipT = t;
    this.#flipDir = direction;
    this.#render();
  }

  setViewTransform(scale: number, x: number, y: number): void {
    this.#view = { scale, tx: x, ty: y };
    this.#render();
  }

  measure(): LayoutMetrics {
    const el = this.#container;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h };
  }

  // --- context loss / restore ---------------------------------------------------

  #onContextLost = (event: Event): void => {
    event.preventDefault(); // required, or the browser won't fire 'restored'
    this.#contextLost = true;
    if (this.#restoreTimer === null) {
      this.#restoreTimer = setTimeout(() => this.#fatal(), RESTORE_TIMEOUT_MS);
    }
  };

  #onContextRestored = (): void => {
    this.#clearRestoreTimer();
    this.#contextLost = false;
    this.#buildGlResources(); // old GL objects are gone; rebuild on the same context
    this.#render(); // CPU-side content/flip/view were retained, so re-upload + repaint
  };

  #onVisibilityChange = (): void => {
    if (this.#canvas?.ownerDocument.visibilityState === 'visible') this.#render();
  };

  #fatal(): void {
    if (this.#fatalFired) return;
    this.#fatalFired = true;
    this.#fatalHandler?.();
  }

  #clearRestoreTimer(): void {
    if (this.#restoreTimer !== null) {
      clearTimeout(this.#restoreTimer);
      this.#restoreTimer = null;
    }
  }

  #buildGlResources(): void {
    const gl = this.#gl;
    if (gl === null) return;

    this.#flat = createProgram(gl, FLAT_VERT, FLAT_FRAG);
    this.#curl = createProgram(gl, CURL_VERT, CURL_FRAG);
    for (const name of ['uViewport', 'uRect', 'uView', 'uTex']) {
      this.#flatU[name] = gl.getUniformLocation(this.#flat, name);
    }
    for (const name of ['uViewport', 'uLeaf', 'uView', 'uAngle', 'uCurl', 'uDir', 'uFront', 'uBack', 'uShadow']) {
      this.#curlU[name] = gl.getUniformLocation(this.#curl, name);
    }

    this.#quadVao = this.#makeVao(gl, this.#flat, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));

    // Grid strip across the width (columns subdivided, 2 rows) for a smooth bend.
    const grid: number[] = [];
    for (let c = 0; c <= GRID_COLS; c++) {
      const u = c / GRID_COLS;
      grid.push(u, 0, u, 1);
    }
    this.#gridCount = (GRID_COLS + 1) * 2;
    this.#gridVao = this.#makeVao(gl, this.#curl, new Float32Array(grid));

    // A (re)created context has no live textures; drop the cache and remake the blank.
    this.#texCache.clear();
    this.#cacheBytes = 0;
    this.#blankTex = this.#makeBlankTexture(gl);
    gl.useProgram(this.#flat);
    gl.uniform1i(this.#flatU.uTex ?? null, 0);
    gl.useProgram(this.#curl);
    gl.uniform1i(this.#curlU.uFront ?? null, 0);
    gl.uniform1i(this.#curlU.uBack ?? null, 1);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha
  }

  // --- drawing ------------------------------------------------------------------

  #render(): void {
    const gl = this.#gl;
    const canvas = this.#canvas;
    if (gl === null || canvas === null || this.#contextLost || gl.isContextLost()) return;
    this.#resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.#flip !== null) this.#drawFlip();
    else if (this.#content !== null) this.#drawStatic();
  }

  #drawStatic(): void {
    const canvas = this.#canvas!;
    const w = canvas.width;
    const h = canvas.height;
    this.#useFlat();
    const content = this.#content!;
    if (this.#fill) {
      this.#drawQuad({ x: 0, y: 0, w, h }, content.right ?? content.left);
    } else {
      this.#drawQuad({ x: 0, y: 0, w: w / 2, h }, content.left);
      this.#drawQuad({ x: w / 2, y: 0, w: w / 2, h }, content.right);
    }
  }

  #drawFlip(): void {
    const gl = this.#gl!;
    const canvas = this.#canvas!;
    const w = canvas.width;
    const h = canvas.height;
    const flip = this.#flip!;
    const pose = flipProgressToPose(this.#flipT);

    // Static pages underneath.
    this.#useFlat();
    if (flip.fill) {
      this.#drawQuad({ x: 0, y: 0, w, h }, flip.underFull);
    } else {
      this.#drawQuad({ x: 0, y: 0, w: w / 2, h }, flip.underLeft);
      this.#drawQuad({ x: w / 2, y: 0, w: w / 2, h }, flip.underRight);
    }

    // Turning leaf: both faces uploaded, per-fragment facing picks front vs back.
    if (flip.front === null && flip.back === null) return;
    this.#bindFace(gl.TEXTURE0, flip.front);
    this.#bindFace(gl.TEXTURE1, flip.back);
    gl.activeTexture(gl.TEXTURE0);

    const leafW = flip.fill ? w : w / 2;
    const spineX = flip.spineAtStart * w;
    gl.useProgram(this.#curl);
    gl.bindVertexArray(this.#gridVao);
    gl.uniform2f(this.#curlU.uViewport ?? null, w, h);
    gl.uniform3f(this.#curlU.uView ?? null, this.#view.scale, this.#view.tx * this.#dpr, this.#view.ty * this.#dpr);
    gl.uniform4f(this.#curlU.uLeaf ?? null, spineX, 0, leafW, h);
    gl.uniform1f(this.#curlU.uAngle ?? null, pose.angle);
    gl.uniform1f(this.#curlU.uCurl ?? null, pose.curl);
    gl.uniform1f(this.#curlU.uDir ?? null, flip.dir);
    gl.uniform1f(this.#curlU.uShadow ?? null, pose.shadowAlpha);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.#gridCount);
  }

  #useFlat(): void {
    const gl = this.#gl!;
    const canvas = this.#canvas!;
    gl.useProgram(this.#flat);
    gl.bindVertexArray(this.#quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.#flatU.uViewport ?? null, canvas.width, canvas.height);
    gl.uniform3f(this.#flatU.uView ?? null, this.#view.scale, this.#view.tx * this.#dpr, this.#view.ty * this.#dpr);
  }

  #drawQuad(rect: Rect, source: TexImageSource | null): void {
    const gl = this.#gl!;
    if (source === null) return;
    this.#bindFace(gl.TEXTURE0, source);
    gl.uniform4f(this.#flatU.uRect ?? null, rect.x, rect.y, rect.w, rect.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Bind the texture for `source` (a blank 1x1 when null) to a texture unit. */
  #bindFace(unit: number, source: TexImageSource | null): void {
    const gl = this.#gl!;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, source !== null ? this.#textureFor(source) : this.#blankTex);
  }

  /** Page texture cached by content: uploaded once, reused across frames, LRU-capped. */
  #textureFor(source: TexImageSource): WebGLTexture {
    const gl = this.#gl!;
    const existing = this.#texCache.get(source);
    if (existing !== undefined) {
      this.#texCache.delete(source); // move to most-recently-used
      this.#texCache.set(source, existing);
      return existing.tex;
    }
    const tex = createTexture(gl); // binds + uploads on the active unit set by the caller
    uploadTexture(gl, tex, source);
    const bytes = source.width * source.height * 4;
    this.#texCache.set(source, { tex, bytes });
    this.#cacheBytes += bytes;
    this.#evictTextures();
    return tex;
  }

  /** Drop least-recently-used page textures past the byte ceiling (keep a small floor). */
  #evictTextures(): void {
    const gl = this.#gl!;
    for (const [src, cached] of this.#texCache) {
      if (this.#cacheBytes <= MAX_TEXTURE_CACHE_BYTES || this.#texCache.size <= 4) break;
      this.#texCache.delete(src);
      this.#cacheBytes -= cached.bytes;
      gl.deleteTexture(cached.tex);
    }
  }

  #makeBlankTexture(gl: WebGL2RenderingContext): WebGLTexture {
    const tex = createTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    return tex;
  }

  #makeVao(gl: WebGL2RenderingContext, program: WebGLProgram, data: Float32Array): WebGLVertexArrayObject {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (vao === null || buffer === null) throw new Error('WebglRenderer: could not create buffers.');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const aUnit = gl.getAttribLocation(program, 'aUnit');
    gl.enableVertexAttribArray(aUnit);
    gl.vertexAttribPointer(aUnit, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  #resize(): void {
    const gl = this.#gl;
    const canvas = this.#canvas;
    const el = this.#container;
    if (gl === null || canvas === null || el === null) return;
    this.#dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1;
    const w = Math.max(1, Math.round(el.clientWidth * this.#dpr));
    const h = Math.max(1, Math.round(el.clientHeight * this.#dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }
}
