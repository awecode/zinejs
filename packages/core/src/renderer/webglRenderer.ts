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
  float D = uLeafW * 3.0;
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
  float spec = pow(max(cos(acos(diff) - 0.52), 0.0), 220.0) * 0.22;

  c.rgb = clamp(c.rgb * lit + spec, 0.0, 1.0);
  outColor = c;
}`;

const GRID_COLS = 28;
const GRID_ROWS = 36;
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
    this.#render();
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
    if (fill) {
      this.#flip = {
        underLeft: null,
        underRight: null,
        underFull: to.right ?? to.left,
        front: from.right ?? from.left,
        back: to.right ?? to.left,
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
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h };
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
    for (const name of ['uViewport', 'uView', 'uOriginX', 'uDir', 'uLeafW', 'uFront', 'uBack']) {
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
      this.#drawQuad({ x: 0, y: 0, w: w / 2, h }, content.left, 1);
      this.#drawQuad({ x: w / 2, y: 0, w: w / 2, h }, content.right, -1);
    }
  }

  #drawFlip(): void {
    const gl = this.#gl!;
    const canvas = this.#canvas!;
    const w = canvas.width;
    const h = canvas.height;
    const flip = this.#flip!;

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
    CURLS[this.#curlType].deform(this.#mesh, leafW, h, this.#flipT, this.#anchor);
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
    gl.uniform3f(this.#curlU.uView ?? null, this.#view.scale, this.#view.tx * this.#dpr, this.#view.ty * this.#dpr);
    gl.uniform1f(this.#curlU.uOriginX ?? null, originX);
    gl.uniform1f(this.#curlU.uDir ?? null, flip.dir);
    gl.uniform1f(this.#curlU.uLeafW ?? null, leafW);
    gl.drawElements(gl.TRIANGLES, this.#idxCount, gl.UNSIGNED_SHORT, 0);
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
