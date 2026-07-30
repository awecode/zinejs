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

// Maps a unit quad to a page rect (device px, top-left origin) and applies zoom/pan.
// vUv flips Y to pair with UNPACK_FLIP_Y so the image's top row lands at the page top.
const VERTEX_SRC = `#version 300 es
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
  vUv = vec2(aUnit.x, 1.0 - aUnit.y);
}`;

const FRAGMENT_SRC = `#version 300 es
precision mediump float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  outColor = texture(uTex, vUv);
}`;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * GPU renderer (WebGL2, hand-written — no third-party library). Slice 1: paints a
 * static spread as textured quads with in-shader zoom/pan. The cylinder-wrap mesh
 * curl (Slice 2) and GPU hardening + CSS fallback (Slice 3) build on this. Selected
 * only via `renderer: 'webgl2'` for now; `'auto'` stays on CSS until it's complete.
 */
export class WebglRenderer implements Renderer {
  #container: HTMLElement | null = null;
  #canvas: HTMLCanvasElement | null = null;
  #gl: WebGL2RenderingContext | null = null;
  #program: WebGLProgram | null = null;
  #vao: WebGLVertexArrayObject | null = null;
  #texture: WebGLTexture | null = null;
  #uViewport: WebGLUniformLocation | null = null;
  #uRect: WebGLUniformLocation | null = null;
  #uView: WebGLUniformLocation | null = null;

  #view = { scale: 1, tx: 0, ty: 0 };
  #dpr = 1;
  #content: SpreadContent | null = null;
  #fill = false;
  #flip: { from: SpreadContent; to: SpreadContent } | null = null;

  mount(container: HTMLElement): Promise<void> {
    this.#container = container;
    const canvas = container.ownerDocument.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    container.append(canvas);
    this.#canvas = canvas;

    const gl = createGlContext(canvas);
    this.#gl = gl;
    const program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
    this.#program = program;
    this.#uViewport = gl.getUniformLocation(program, 'uViewport');
    this.#uRect = gl.getUniformLocation(program, 'uRect');
    this.#uView = gl.getUniformLocation(program, 'uView');

    // A single unit quad, drawn as a triangle strip.
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
    this.#vao = vao;

    this.#texture = createTexture(gl);

    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program, 'uTex'), 0);
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied alpha

    return Promise.resolve();
  }

  destroy(): void {
    const gl = this.#gl;
    if (gl !== null) {
      if (this.#texture !== null) gl.deleteTexture(this.#texture);
      if (this.#vao !== null) gl.deleteVertexArray(this.#vao);
      if (this.#program !== null) gl.deleteProgram(this.#program);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    this.#canvas?.remove();
    this.#container = null;
    this.#canvas = null;
    this.#gl = null;
    this.#program = null;
    this.#vao = null;
    this.#texture = null;
    this.#content = null;
    this.#flip = null;
  }

  renderSpread(_spread: Spread, content: SpreadContent, options?: RenderOptions): void {
    this.#content = content;
    this.#fill = options?.fill ?? false;
    this.#flip = null;
    this.#paint();
  }

  // Slice 1 placeholder: stage from/to and swap at the halfway point. The real
  // cylinder-wrap curl lands in Slice 2 (this keeps flips functional meanwhile).
  beginFlip(
    from: SpreadContent,
    to: SpreadContent,
    _direction: FlipDirection,
    options?: RenderOptions,
  ): void {
    this.#fill = options?.fill ?? false;
    this.#flip = { from, to };
    this.#content = from;
    this.#paint();
  }

  setFlipProgress(t: number, _direction: FlipDirection): void {
    if (this.#flip === null) return;
    this.#content = t < 0.5 ? this.#flip.from : this.#flip.to;
    this.#paint();
  }

  setViewTransform(scale: number, x: number, y: number): void {
    this.#view = { scale, tx: x, ty: y };
    this.#paint();
  }

  measure(): LayoutMetrics {
    const el = this.#container;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    return { containerWidth: w, containerHeight: h, pageWidth: w / 2, pageHeight: h };
  }

  #paint(): void {
    const gl = this.#gl;
    const canvas = this.#canvas;
    if (gl === null || canvas === null) return;

    this.#resize();
    gl.clear(gl.COLOR_BUFFER_BIT);

    const content = this.#content;
    if (content === null) return;

    const w = canvas.width;
    const h = canvas.height;
    gl.useProgram(this.#program);
    gl.bindVertexArray(this.#vao);
    gl.uniform2f(this.#uViewport, w, h);
    gl.uniform3f(this.#uView, this.#view.scale, this.#view.tx * this.#dpr, this.#view.ty * this.#dpr);

    if (this.#fill) {
      this.#drawPage({ x: 0, y: 0, w, h }, content.right ?? content.left);
    } else {
      this.#drawPage({ x: 0, y: 0, w: w / 2, h }, content.left);
      this.#drawPage({ x: w / 2, y: 0, w: w / 2, h }, content.right);
    }
  }

  #drawPage(rect: Rect, source: TexImageSource | null): void {
    const gl = this.#gl;
    if (gl === null || source === null || this.#texture === null) return;
    uploadTexture(gl, this.#texture, source);
    gl.uniform4f(this.#uRect, rect.x, rect.y, rect.w, rect.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
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
