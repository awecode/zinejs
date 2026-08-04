import {
  CURLS,
  createPageMesh,
  DEFAULT_CURL,
  type CurlAnchor,
  type CurlType,
  type PageMesh,
} from '../geometry/curls';
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

// Flat program: a page rect (device px, top-left origin) with zoom/pan and a soft
// permanent gutter shadow toward the spine so the turning leaf's shadow lands into it.
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
uniform float uGutterSide; // +1 = spine at right edge, -1 = at left edge, 0 = none
out vec4 outColor;
void main() {
  vec4 c = texture(uTex, vUv);
  if (uGutterSide != 0.0) {
    float d = uGutterSide > 0.0 ? (1.0 - vUv.x) : vUv.x;
    c.rgb *= mix(0.72, 1.0, smoothstep(0.0, 0.10, d));
  }
  outColor = c;
}`;

// Curl program: a thin pass-through for the CPU-deformed page mesh (positions and
// normals come from the selected curl model). It places the leaf, applies a top-safe depth
// perspective, and lights from the true surface normal.
const CURL_VERT = `#version 300 es
in vec3 aPos;    // leaf-local device px: x = bent offset from spine, y 0..H, z depth
in vec3 aNormal;
in vec2 aUv;
uniform vec2 uViewport;
uniform vec3 uView;   // scale, tx, ty
uniform float uOriginX; // spine x in device px
uniform float uDir;     // +1 leaf to the right of spine, -1 to the left
uniform float uLeafW;   // leaf width in device px (perspective scale)
out vec2 vUv;
out float vFacing;
out float vU;
void main() {
  float bookX = uOriginX + uDir * aPos.x;
  float bookY = aPos.y;
  float Z = aPos.z;
  // Eye distance, in leaf widths. Keeps the perspective resolution-independent. 5.3 puts the
  // roll's deepest point ~14% larger than flat; stronger than that (a nearer eye) balloons the
  // turning sheet and reads more like a fisheye than a page lifting.
  float D = uLeafW * 5.3;
  float persp = D / max(D - Z, 1.0);
  float cx = uViewport.x * 0.5;
  float cy = uViewport.y * 0.5;
  float px = cx + (bookX - cx) * persp;
  float py = cy + (bookY - cy) * min(persp, 1.0); // Y only shrinks (top-safe)
  vec2 p = vec2(px, py) * uView.x + uView.yz;
  vec2 clip = p / uViewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  vUv = aUv;
  vFacing = aNormal.z;
  vU = aUv.x;
}`;

const CURL_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vFacing;
in float vU;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform highp float uDir;
uniform float uGloss; // 0 disables the specular highlight (e.g. the flat 'simple' curl)
uniform float uAlpha; // leaf opacity; a lone page dissolves into the page landing beneath it
out vec4 outColor;
void main() {
  // The turn mesh carries its own facing in the normal; the front points at the viewer
  // (normal.z > 0) until the leaf passes vertical, for both flip directions. u->x still
  // flips with uDir so a left-hand leaf reads spine-inward.
  bool showFront = vFacing > 0.0;
  float fx = uDir > 0.0 ? vUv.x : 1.0 - vUv.x;
  vec4 c = showFront ? texture(uFront, vec2(fx, vUv.y)) : texture(uBack, vec2(1.0 - fx, vUv.y));

  // Fold shading: the sheet darkens sharply where it curves away from the viewer, so the
  // rolled edge reads as a deep crease with a soft highlight riding the ridge.
  float diff = clamp(abs(vFacing), 0.0, 1.0);
  float lit = mix(0.42, 1.0, diff);
  lit *= mix(0.7, 1.0, smoothstep(0.0, 0.12, vU)); // spine crease matches the gutter shadow

  // Glossy specular: brightest where the surface tilts ~30 deg from facing the viewer,
  // so a thin glossy highlight rides across the sheet as it rolls.
  float spec = pow(max(cos(acos(diff) - 0.52), 0.0), 220.0) * 0.22 * uGloss;

  c.rgb = clamp(c.rgb * lit + spec, 0.0, 1.0);
  // Premultiplied alpha (blendFunc ONE, ONE_MINUS_SRC_ALPHA): scale colour as well as alpha,
  // or fading would brighten the sheet additively instead of dissolving it.
  outColor = vec4(c.rgb * uAlpha, c.a * uAlpha);
}`;

const GRID_COLS = 28;
const GRID_ROWS = 36;
/** Progress at which a lone page starts dissolving. A full-width leaf has no facing half to
 *  flop onto, so instead of landing on empty space it fades into the page arriving beneath it
 *  over the rest of the turn. Roll is already flat by mid-turn; curling models stay bent
 *  longer, so they dissolve later. The fade itself eases so the leaf settles rather than
 *  vanishing while still swinging. */
const FILL_FADE_START_ROLL = 0.7;
const FILL_FADE_START_CURL = 0.8;
const RESTORE_TIMEOUT_MS = 4000;
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
  dir: number; // +1 forward (leaf right of spine), -1 backward (left)
  fill: boolean;
}

/** How far to shift a spread to centre a lone page, in units of a quarter container width:
 *  -1 = only a right page (cover), +1 = only a left page (back), 0 = a full spread. */
function shiftUnit(content: SpreadContent): number {
  const lone = (content.left === null) !== (content.right === null);
  return lone ? (content.right !== null ? -1 : 1) : 0;
}

/**
 * GPU renderer (WebGL2, hand-written). The turning leaf is a dense grid deformed on
 * the CPU by the selected curl model (see geometry/curls) and
 * uploaded each frame, lit from real normals; the static pages are flat quads with a
 * gutter shadow. Restores
 * GL state on context loss; signals onFatal (→ CSS fallback) when unrecoverable.
 */
export class WebglRenderer implements Renderer {
  #container: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #gl: WebGL2RenderingContext | null = null;

  #flat: WebGLProgram | null = null;
  #curl: WebGLProgram | null = null;
  #quadVao: WebGLVertexArrayObject | null = null;
  #curlVao: WebGLVertexArrayObject | null = null;
  #posBuf: WebGLBuffer | null = null;
  #normBuf: WebGLBuffer | null = null;
  #idxCount = 0;
  #mesh: PageMesh = createPageMesh(GRID_COLS, GRID_ROWS);

  #texCache = new Map<TexImageSource, { tex: WebGLTexture; bytes: number }>();
  #cacheBytes = 0;
  #blankTex: WebGLTexture | null = null;

  #flatU: Record<string, WebGLUniformLocation | null> = {};
  #curlU: Record<string, WebGLUniformLocation | null> = {};

  #view = { scale: 1, tx: 0, ty: 0 };
  #dpr = 1;
  #content: SpreadContent | null = null;
  #fill = false;
  #flip: FlipState | null = null;
  #flipT = 0;
  #curlType: CurlType = DEFAULT_CURL;
  #anchor: CurlAnchor = { y: 0.5 };
  // A lone page (cover / book front-back) sits on one half; these center it by shifting
  // the view a quarter-width, interpolated across a flip so the open/close doesn't jump.
  #shiftX = 0;
  #fromShiftUnit = 0;
  #toShiftUnit = 0;
  // Book aspect fit: the 2-page spread is letterboxed to the pages' aspect, centered
  // in the container, so pages fill their halves without stretching. 0 = aspect unknown.
  #pageAspect = 0;
  #bookW = 0;
  #bookH = 0;

  #contextLost = false;
  #fatalFired = false;
  #restoreTimer: ReturnType<typeof setTimeout> | null = null;
  #fatalHandler: (() => void) | null = null;

  mount(container: HTMLElement): Promise<void> {
    this.#container = container;
    const doc = container.ownerDocument;
    const canvas = doc.createElement('canvas');
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
      if (this.#curlVao !== null) gl.deleteVertexArray(this.#curlVao);
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
    this.#trackAspect(content);
    this.#render();
  }

  /** Remember the page aspect (width/height) so the book can be letterboxed to it. */
  #trackAspect(content: SpreadContent): void {
    const p = content.left ?? content.right;
    if (p && p.height) this.#pageAspect = p.width / p.height;
  }

  beginFlip(
    from: SpreadContent,
    to: SpreadContent,
    direction: FlipDirection,
    options?: RenderOptions,
  ): void {
    const fill = options?.fill ?? false;
    this.#flipT = 0;
    if (options?.curl) this.#curlType = options.curl;
    if (options?.anchor) this.#anchor = options.anchor;
    this.#fromShiftUnit = fill ? 0 : shiftUnit(from);
    this.#toShiftUnit = fill ? 0 : shiftUnit(to);
    this.#trackAspect(to);
    if (fill) {
      this.#flip = {
        underLeft: null,
        underRight: null,
        underFull: to.right ?? to.left,
        front: from.right ?? from.left,
        // A lone page has no facing "next" leaf on its back; show the same page mirrored
        // (the shader flips the back UV) so it reads as the sheet's own reverse side.
        back: from.right ?? from.left,
        dir: direction === 'forward' ? 1 : -1,
        fill: true,
      };
    } else if (direction === 'forward') {
      this.#flip = {
        underLeft: from.left,
        underRight: to.right,
        underFull: null,
        front: from.right,
        back: to.left,
        dir: 1,
        fill: false,
      };
    } else {
      this.#flip = {
        underLeft: to.left,
        underRight: from.right,
        underFull: null,
        front: from.left,
        back: to.right,
        dir: -1,
        fill: false,
      };
    }
    this.#render();
  }

  setFlipProgress(t: number, _direction: FlipDirection): void {
    this.#flipT = t;
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
    const known = this.#pageAspect > 0;
    const book = known ? this.#bookBox() : undefined;
    const content = known ? this.#contentBox() : undefined;
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h, book, content };
  }

  /** The fitted book rect in container CSS px (letterbox aware) — a stable 2-page area. */
  #bookBox(): { x: number; y: number; width: number; height: number } {
    const el = this.#container;
    const cw = el?.clientWidth ?? 0;
    const ch = el?.clientHeight ?? 0;
    if (this.#pageAspect <= 0 || cw <= 0 || ch <= 0) return { x: 0, y: 0, width: cw, height: ch };
    const ba = (this.#fill ? 1 : 2) * this.#pageAspect;
    let bw = cw;
    let bh = ch;
    if (ba > cw / ch) bh = cw / ba;
    else bw = ch * ba;
    return { x: (cw - bw) / 2, y: (ch - bh) / 2, width: bw, height: bh };
  }

  /** Where the current spread is actually painted: the book, or its centered half for a lone
   *  page (mirrors the draw-time #shiftX centering). This is what the engine hit-tests against. */
  #contentBox(): { x: number; y: number; width: number; height: number } {
    const b = this.#bookBox();
    const lone = !this.#fill && this.#content !== null && shiftUnit(this.#content) !== 0;
    return lone ? { x: b.x + b.width / 4, y: b.y, width: b.width / 2, height: b.height } : b;
  }

  // --- context loss / restore ---------------------------------------------------

  #onContextLost = (event: Event): void => {
    event.preventDefault();
    this.#contextLost = true;
    if (this.#restoreTimer === null) {
      this.#restoreTimer = setTimeout(() => this.#fatal(), RESTORE_TIMEOUT_MS);
    }
  };

  #onContextRestored = (): void => {
    this.#clearRestoreTimer();
    this.#contextLost = false;
    this.#buildGlResources();
    this.#render();
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
    for (const name of ['uViewport', 'uRect', 'uView', 'uTex', 'uGutterSide']) {
      this.#flatU[name] = gl.getUniformLocation(this.#flat, name);
    }
    for (const name of ['uViewport', 'uView', 'uOriginX', 'uDir', 'uLeafW', 'uFront', 'uBack', 'uGloss', 'uAlpha']) {
      this.#curlU[name] = gl.getUniformLocation(this.#curl, name);
    }

    this.#quadVao = this.#makeQuadVao(gl, this.#flat);
    this.#buildCurlMesh(gl, this.#curl);

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

  #makeQuadVao(gl: WebGL2RenderingContext, program: WebGLProgram): WebGLVertexArrayObject {
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    if (vao === null || buffer === null) throw new Error('WebglRenderer: could not create buffers.');
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    const aUnit = gl.getAttribLocation(program, 'aUnit');
    gl.enableVertexAttribArray(aUnit);
    gl.vertexAttribPointer(aUnit, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    return vao;
  }

  #buildCurlMesh(gl: WebGL2RenderingContext, program: WebGLProgram): void {
    const nx = GRID_COLS + 1;
    const indices: number[] = [];
    for (let j = 0; j < GRID_ROWS; j++) {
      for (let i = 0; i < GRID_COLS; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    this.#idxCount = indices.length;

    const vao = gl.createVertexArray();
    this.#posBuf = gl.createBuffer();
    this.#normBuf = gl.createBuffer();
    const uvBuf = gl.createBuffer();
    const idxBuf = gl.createBuffer();
    if (vao === null || this.#posBuf === null || this.#normBuf === null || uvBuf === null || idxBuf === null) {
      throw new Error('WebglRenderer: could not create mesh buffers.');
    }
    gl.bindVertexArray(vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.#posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.#mesh.positions, gl.DYNAMIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.#normBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.#mesh.normals, gl.DYNAMIC_DRAW);
    const aNormal = gl.getAttribLocation(program, 'aNormal');
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.#mesh.uvs, gl.STATIC_DRAW);
    const aUv = gl.getAttribLocation(program, 'aUv');
    gl.enableVertexAttribArray(aUv);
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

    gl.bindVertexArray(null);
    this.#curlVao = vao;
  }

  // --- drawing ------------------------------------------------------------------

  #render(): void {
    const gl = this.#gl;
    const canvas = this.#canvas;
    if (gl === null || canvas === null || this.#contextLost || gl.isContextLost()) return;
    this.#resize();
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.#fitBook();
    if (this.#flip !== null) this.#drawFlip();
    else if (this.#content !== null) this.#drawStatic();
  }

  /** Letterbox the 2-page book to the page aspect, centered; restricts the GL viewport
   *  so pages fill their halves without stretching (the surround stays cleared). */
  #fitBook(): void {
    const gl = this.#gl!;
    const canvas = this.#canvas!;
    const cw = canvas.width;
    const ch = canvas.height;
    if (this.#pageAspect > 0) {
      const bookAspect = (this.#fill ? 1 : 2) * this.#pageAspect;
      if (bookAspect > cw / ch) {
        this.#bookW = cw;
        this.#bookH = Math.round(cw / bookAspect);
      } else {
        this.#bookH = ch;
        this.#bookW = Math.round(ch * bookAspect);
      }
    } else {
      this.#bookW = cw;
      this.#bookH = ch;
    }
    const bx = Math.round((cw - this.#bookW) / 2);
    const by = Math.round((ch - this.#bookH) / 2); // centered, so GL's bottom offset == by
    gl.viewport(bx, by, this.#bookW, this.#bookH);
  }

  #drawStatic(): void {
    const w = this.#bookW;
    const h = this.#bookH;
    const content = this.#content!;
    this.#shiftX = this.#fill ? 0 : shiftUnit(content) * (w / 4);
    this.#useFlat();
    if (this.#fill) {
      this.#drawQuad({ x: 0, y: 0, w, h }, content.right ?? content.left);
    } else {
      // A lone page (one side null) gets no gutter shadow — it's a standalone, centered page.
      this.#drawQuad({ x: 0, y: 0, w: w / 2, h }, content.left, content.right ? 1 : 0);
      this.#drawQuad({ x: w / 2, y: 0, w: w / 2, h }, content.right, content.left ? -1 : 0);
    }
  }

  #drawFlip(): void {
    const gl = this.#gl!;
    const w = this.#bookW;
    const h = this.#bookH;
    const flip = this.#flip!;

    // Interpolate the lone-page centering across the flip so an opening cover (or a
    // closing back page) slides between centered and spread instead of jumping.
    this.#shiftX = flip.fill
      ? 0
      : (this.#fromShiftUnit + (this.#toShiftUnit - this.#fromShiftUnit) * this.#flipT) * (w / 4);

    // Static pages underneath (with gutter shadow).
    this.#useFlat();
    if (flip.fill) {
      this.#drawQuad({ x: 0, y: 0, w, h }, flip.underFull);
    } else {
      this.#drawQuad({ x: 0, y: 0, w: w / 2, h }, flip.underLeft, 1);
      this.#drawQuad({ x: w / 2, y: 0, w: w / 2, h }, flip.underRight, -1);
    }

    if (flip.front === null && flip.back === null) return;

    // Deform the leaf mesh with the selected curl model on the CPU, upload it, then draw.
    const leafW = flip.fill ? w : w / 2;
    const originX = flip.fill ? (flip.dir > 0 ? 0 : w) : w / 2;
    CURLS[this.#curlType].deform(this.#mesh, leafW, h, this.#flipT, {
      y: this.#anchor.y,
      fill: flip.fill,
    });
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.#mesh.positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#normBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.#mesh.normals);

    this.#bindFace(gl.TEXTURE0, flip.front);
    this.#bindFace(gl.TEXTURE1, flip.back);
    gl.activeTexture(gl.TEXTURE0);

    gl.useProgram(this.#curl);
    gl.bindVertexArray(this.#curlVao);
    gl.uniform2f(this.#curlU.uViewport ?? null, w, h);
    gl.uniform3f(
      this.#curlU.uView ?? null,
      this.#view.scale,
      this.#view.tx * this.#dpr + this.#shiftX,
      this.#view.ty * this.#dpr,
    );
    gl.uniform1f(this.#curlU.uOriginX ?? null, originX);
    gl.uniform1f(this.#curlU.uDir ?? null, flip.dir);
    gl.uniform1f(this.#curlU.uLeafW ?? null, leafW);
    gl.uniform1f(this.#curlU.uGloss ?? null, this.#curlType === 'simple' ? 0 : 1); // flat curl = no shine
    gl.uniform1f(this.#curlU.uAlpha ?? null, flip.fill ? this.#fillFade() : 1);
    gl.drawElements(gl.TRIANGLES, this.#idxCount, gl.UNSIGNED_SHORT, 0);
  }

  /** Leaf opacity for a lone page: solid until the curl-appropriate fade start, then
   *  dissolving to 0 as it lands, so the turn resolves into the destination page rather
   *  than onto blank space. The fade eases so opacity hangs longer then finishes cleanly. */
  #fillFade(): number {
    const start =
      this.#curlType === 'roll' || this.#curlType === 'simple'
        ? FILL_FADE_START_ROLL
        : FILL_FADE_START_CURL;
    const over = (this.#flipT - start) / (1 - start);
    if (over <= 0) return 1;
    if (over >= 1) return 0;
    // Ease-out the remaining opacity: stay readable through most of the window, then settle.
    return Math.pow(1 - over, 1.5);
  }

  #useFlat(): void {
    const gl = this.#gl!;
    gl.useProgram(this.#flat);
    gl.bindVertexArray(this.#quadVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(this.#flatU.uViewport ?? null, this.#bookW, this.#bookH);
    gl.uniform3f(
      this.#flatU.uView ?? null,
      this.#view.scale,
      this.#view.tx * this.#dpr + this.#shiftX,
      this.#view.ty * this.#dpr,
    );
  }

  #drawQuad(rect: Rect, source: TexImageSource | null, gutterSide = 0): void {
    const gl = this.#gl!;
    if (source === null) return;
    this.#bindFace(gl.TEXTURE0, source);
    gl.uniform4f(this.#flatU.uRect ?? null, rect.x, rect.y, rect.w, rect.h);
    gl.uniform1f(this.#flatU.uGutterSide ?? null, gutterSide);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  #bindFace(unit: number, source: TexImageSource | null): void {
    const gl = this.#gl!;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, source !== null ? this.#textureFor(source) : this.#blankTex);
  }

  #textureFor(source: TexImageSource): WebGLTexture {
    const gl = this.#gl!;
    const existing = this.#texCache.get(source);
    if (existing !== undefined) {
      this.#texCache.delete(source);
      this.#texCache.set(source, existing);
      return existing.tex;
    }
    const tex = createTexture(gl);
    uploadTexture(gl, tex, source);
    const dims = source as unknown as { width: number; height: number };
    const bytes = dims.width * dims.height * 4;
    this.#texCache.set(source, { tex, bytes });
    this.#cacheBytes += bytes;
    this.#evictTextures();
    return tex;
  }

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
