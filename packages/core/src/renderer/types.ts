import type { Spread } from '../engine/spread';

/** A decoded, ready-to-paint raster for one page (produced by a content source). */
export type PageContent = ImageBitmap | HTMLCanvasElement;

/** Resolved content for the two halves of a spread; null = blank side. */
export interface SpreadContent {
  left: PageContent | null;
  right: PageContent | null;
}

export type FlipDirection = 'forward' | 'backward';

export interface RenderOptions {
  /** Render a lone page filling the container (single-page mode), not a half panel. */
  fill?: boolean;
}

/** Layout metrics the engine needs for geometry and mode decisions. */
export interface LayoutMetrics {
  containerWidth: number;
  containerHeight: number;
  pageWidth: number;
  pageHeight: number;
}

/**
 * The contract every renderer implements (CSS baseline, Pixi/GPU). The engine
 * drives it and never reaches past it, so the renderers are interchangeable and
 * behaviorally identical (PRD §8). One is selected at init; a device fetches one.
 */
export interface Renderer {
  /** Attach to a container. Async to accommodate GPU context init (Pixi). */
  mount(container: HTMLElement): Promise<void>;

  /** Tear down: remove DOM/listeners, release any GPU context. */
  destroy(): void;

  /** Paint a spread from already-resolved page rasters (static, no flip). */
  renderSpread(spread: Spread, content: SpreadContent, options?: RenderOptions): void;

  /**
   * Set up a flip: the turning leaf's front is `from`'s leading page and its back
   * is `to`'s facing page, with the destination revealed underneath. Call once at
   * flip start, then drive `setFlipProgress`.
   */
  beginFlip(
    from: SpreadContent,
    to: SpreadContent,
    direction: FlipDirection,
    options?: RenderOptions,
  ): void;

  /**
   * Drive the turning page to progress `t` (0..1) in `direction`. Also the stable
   * seek API used by visual-regression tests (call `beginFlip` first to stage content).
   */
  setFlipProgress(t: number, direction: FlipDirection): void;

  /** Apply zoom/pan: uniform `scale` about the viewport, translated by (x, y). */
  setViewTransform(scale: number, x: number, y: number): void;

  /** Current layout metrics (container + page dimensions). */
  measure(): LayoutMetrics;
}
