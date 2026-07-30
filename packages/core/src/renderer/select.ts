import type { Renderer } from './types';

export type RendererKind = 'css' | 'webgl2';

/**
 * How the consumer chooses a renderer:
 * - `'auto'` (default): prefer the GPU path (WebGL2), else CSS.
 * - a single kind: force it (`'webgl2'` throws if the device has no WebGL2).
 * - an ordered array: try each in turn, first viable wins.
 * - a `Renderer` instance: use it as-is (custom implementation, §6.1/§11).
 */
export type RendererOption = 'auto' | RendererKind | RendererKind[] | Renderer;

export interface Capabilities {
  /** WebGL2 available — the GPU renderer's only backend. */
  gpu: boolean;
}

type RendererLoader = () => Promise<Renderer>;

/**
 * Lazy loaders, one per kind. Each is a dynamic `import()` so the bundler
 * code-splits it into its own chunk and a device fetches only the one selected.
 */
const LOADERS: Partial<Record<RendererKind, RendererLoader>> = {
  css: async () => new (await import('./cssRenderer')).CssRenderer(),
  webgl2: async () => new (await import('./webglRenderer')).WebglRenderer(),
};

// The WebGL2 renderer is auto-selected on GPU-capable devices; CSS is the baseline
// for non-GPU devices and the fallback for unrecoverable GPU failures (§8.4).
const WEBGL2_AUTO = true;

function isRenderer(option: RendererOption): option is Renderer {
  return (
    typeof option === 'object' &&
    option !== null &&
    !Array.isArray(option) &&
    typeof (option as Renderer).mount === 'function'
  );
}

function autoOrder(caps: Capabilities): RendererKind[] {
  return caps.gpu && WEBGL2_AUTO ? ['webgl2', 'css'] : ['css'];
}

/** Detect WebGL2 support — the GPU renderer's only backend (no WebGL1, no WebGPU). */
export function detectCapabilities(): Capabilities {
  return { gpu: hasWebGl2() };
}

function hasWebGl2(): boolean {
  try {
    return Boolean(document.createElement('canvas').getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * Resolve the `renderer` option to a mounted renderer instance, lazy-loading its
 * chunk. Throws an agent-actionable error if nothing viable can be loaded.
 */
export async function selectRenderer(
  option: RendererOption = 'auto',
  caps: Capabilities = detectCapabilities(),
): Promise<Renderer> {
  if (isRenderer(option)) return option;

  const order = Array.isArray(option) ? option : option === 'auto' ? autoOrder(caps) : [option];

  for (const kind of order) {
    if (kind === 'webgl2' && !caps.gpu) continue; // skip the GPU path without WebGL2
    const loader = LOADERS[kind];
    if (loader) return loader();
  }

  if (order.length === 1 && order[0] === 'webgl2' && !caps.gpu) {
    throw new Error(
      "renderer: 'webgl2' was forced but this device has no WebGL2. Use 'css' or 'auto'.",
    );
  }
  throw new Error(
    `renderer: none of [${order.join(', ')}] could be loaded — use 'css' or 'auto'.`,
  );
}
