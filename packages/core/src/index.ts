export { Zine } from './zine';
export type { ZineOptions, ZoomOptions, SearchHit } from './zine';

// Just the registry mechanism — the toolbar, its icons and the built-in definitions all live in
// the lazily-loaded chunk, so registering a custom control costs nothing up front.
export { defineControl, getControl, DEFAULT_ITEMS } from './controls/registry';
export type {
  ControlContext,
  ControlDef,
  ControlItem,
  ControlsOptions,
  ControlsPosition,
} from './controls/types';

export { ImageSource } from './source/imageSource';
export type { ImageSourceOptions, ImageFit } from './source/imageSource';
export type { Source, DownloadInfo, OutlineItem, PageRequest } from './source/types';

export type { RendererOption, RendererKind } from './renderer/select';
export type { Renderer, SpreadContent, PageContent, FlipDirection, LayoutMetrics, RenderOptions } from './renderer/types';

export type { ZineEventMap } from './engine/emitter';
export type { Direction, Spread } from './engine/spread';
export { CURL_TYPES } from './geometry/curls/types';
export type { CurlType, CurlAnchor } from './geometry/curls/types';
