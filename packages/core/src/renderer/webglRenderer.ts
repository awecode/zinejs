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
// zoom/pan. vUv = aUnit pairs with UNPACK_FLIP_Y so the image lands right-side up.
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
// its own page, so mid-curl you see a sliver of the next page (the front/back
// handoff is continuous, not a whole-leaf swap). The back page is mirrored so it
// reads correctly once the sheet lands on the far side.
const CURL_FRAG = `#version 300 es
precision mediump float;
in vec2 vUv;
in float vU;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform float uShadow;
out vec4 outColor;
void main() {
  vec4 c = gl_FrontFacing ? texture(uFront, vUv) : texture(uBack, vec2(1.0 - vUv.x, vUv.y));
  float crease = 1.0 - smoothstep(0.0, 0.12, vU);   // dark at the spine
  float freeEdge = smoothstep(0.82, 1.0, vU);        // dark at the free edge
  float shade = 1.0 - uShadow * (0.4 * crease + 0.22 * freeEdge);
  float sheen = uShadow * 0.12 * smoothstep(0.3, 0.55, vU) * (1.0 - smoothstep(0.55, 0.82, vU));
  c.rgb = clamp(c.rgb * shade + sheen, 0.0, 1.0);
  outColor = c;
}`;

const GRID_COLS = 24;

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
 * static pages are flat textured quads underneath. Selected via `renderer: 'webgl2'`
 * for now; `'auto'` stays on CSS until the renderer is complete and hardened.
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
  #texA: WebGLTexture | null = null; // flats + leaf front (unit 0)
  #texB: WebGLTexture | null = null; // leaf back (unit 1)

  #flatU: Record<string, WebGLUniformLocation | null> = {};
  #curlU: Record<string, WebGLUniformLocation | null> = {};

  #view = { scale: 1, tx: 0, ty: 0 };
  #dpr = 1;
  #content: SpreadContent | null = null;
  #fill = false;
  #flip: FlipState | null = null;
  #flipT = 0;
  #flipDir: FlipDirection = 'forward';

  mount(container: HTMLElement): Promise<void> {
    this.#container = container;
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.append(canvas);
    this.#canvas = canvas;

    const gl = createGlContext(canvas);
    this.#gl = gl;

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

    this.#texA = createTexture(gl);
    this.#texB = createTexture(gl);
    gl.useProgram(this.#flat);
    gl.uniform1i(this.#flatU.uTex ?? null, 0);
    gl.useProgram(this.#curl);
    gl.uniform1i(this.#curlU.uFront ?? null, 0);
    gl.uniform1i(this.#curlU.uBack ?? null, 1);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha

    return Promise.resolve();
  }

  destroy(): void {
    const gl = this.#gl;
    if (gl !== null) {
      if (this.#texA !== null) gl.deleteTexture(this.#texA);
      if (this.#texB !== null) gl.deleteTexture(this.#texB);
      if (this.#quadVao !== null) gl.deleteVertexArray(this.#quadVao);
      if (this.#gridVao !== null) gl.deleteVertexArray(this.#gridVao);
      if (this.#flat !== null) gl.deleteProgram(this.#flat);
      if (this.#curl !== null) gl.deleteProgram(this.#curl);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.#canvas?.remove();
    this.#container = null;
    this.#canvas = null;
    this.#gl = null;
    this.#content = null;
    this.#flip = null;
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
      // A full-width leaf turns about one edge, revealing `to` underneath.
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

  #render(): void {
    const gl = this.#gl;
    const canvas = this.#canvas;
    if (gl === null || canvas === null) return;
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
    this.#uploadFace(gl.TEXTURE0, this.#texA!, flip.front);
    this.#uploadFace(gl.TEXTURE1, this.#texB!, flip.back);
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
    if (source === null || this.#texA === null) return;
    uploadTexture(gl, this.#texA, source);
    gl.uniform4f(this.#flatU.uRect ?? null, rect.x, rect.y, rect.w, rect.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  #uploadFace(unit: number, tex: WebGLTexture, source: TexImageSource | null): void {
    const gl = this.#gl!;
    gl.activeTexture(unit);
    if (source !== null) {
      uploadTexture(gl, tex, source);
    } else {
      // Blank face (e.g. a cover edge): a 1x1 transparent texel, no garbage sampled.
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    }
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
