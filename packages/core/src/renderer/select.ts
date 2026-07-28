import type { Renderer } from './types';

export type RendererKind = 'css' | 'pixi';

/**
 * How the consumer chooses a renderer:
 * - `'auto'` (default): prefer the GPU path, else CSS.
 * - a single kind: force it (`'pixi'` throws if the device has no GPU).
 * - an ordered array: try each in turn, first viable wins.
 * - a `Renderer` instance: use it as-is (custom implementation, §6.1/§11).
 */
export type RendererOption = 'auto' | RendererKind | RendererKind[] | Renderer;

export interface Capabilities {
  gpu: boolean;
}

type RendererLoader = () => Promise<Renderer>;

/**
 * Lazy loaders, one per kind. Each is a dynamic `import()` so the bundler
 * code-splits it into its own chunk and a device fetches only the one selected.
 * The `pixi` loader is added in Phase 2; until then only CSS can be selected.
 */
const LOADERS: Partial<Record<RendererKind, RendererLoader>> = {
  css: async () => new (await import('./cssRenderer')).CssRenderer(),
};

function isRenderer(option: RendererOption): option is Renderer {
  return (
    typeof option === 'object' &&
    option !== null &&
    !Array.isArray(option) &&
    typeof (option as Renderer).mount === 'function'
  );
}

function autoOrder(caps: Capabilities): RendererKind[] {
  return caps.gpu ? ['pixi', 'css'] : ['css'];
}

/** Detect a usable GPU path (WebGL or WebGPU); Pixi later picks the backend itself. */
export function detectCapabilities(): Capabilities {
  return { gpu: hasWebGl() || hasWebGpu() };
}

function hasWebGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
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
    if (kind === 'pixi' && !caps.gpu) continue; // skip the GPU path on non-GPU devices
    const loader = LOADERS[kind];
    if (loader) return loader();
  }

  if (order.length === 1 && order[0] === 'pixi' && !caps.gpu) {
    throw new Error(
      "renderer: 'pixi' was forced but this device has no GPU. Use 'css' or 'auto'.",
    );
  }
  throw new Error(
    `renderer: none of [${order.join(', ')}] is available. The 'pixi' renderer ships in a later release — use 'css' or 'auto'.`,
  );
}
