import { ICONS } from './icons';
import { defineControl } from './registry';
import type { ControlContext } from './types';

/** Zoom step per click: two clicks double the scale. */
const ZOOM_STEP = Math.SQRT2;

const isFullscreen = (ctx: ControlContext): boolean => {
  const doc = ctx.zine.container.ownerDocument;
  return doc?.fullscreenElement === ctx.zine.container;
};

/**
 * Register the stock controls. Called once as the toolbar chunk loads, so the icon set and these
 * definitions stay out of the base bundle.
 *
 * `pageInput` and `search` are not here: both need the toolbar instance itself (one builds an
 * input, the other opens an anchored panel), so the toolbar registers them.
 */
export function registerBuiltins(): void {
  defineControl({
    id: 'prev',
    title: 'Previous page',
    icon: ICONS.prev,
    isDisabled: (ctx) => !ctx.zine.canFlipPrev(),
    action: (ctx) => ctx.zine.flipPrev(),
  });

  defineControl({
    id: 'next',
    title: 'Next page',
    icon: ICONS.next,
    isDisabled: (ctx) => !ctx.zine.canFlipNext(),
    action: (ctx) => ctx.zine.flipNext(),
  });

  defineControl({
    id: 'zoomIn',
    title: 'Zoom in',
    icon: ICONS.zoomIn,
    isDisabled: (ctx) => ctx.zine.getZoom() >= ctx.zine.getMaxZoom() - 1e-6,
    action: (ctx) => ctx.zine.setZoom(ctx.zine.getZoom() * ZOOM_STEP),
  });

  defineControl({
    id: 'zoomOut',
    title: 'Zoom out',
    icon: ICONS.zoomOut,
    isDisabled: (ctx) => ctx.zine.getZoom() <= 1 + 1e-6,
    action: (ctx) => ctx.zine.setZoom(ctx.zine.getZoom() / ZOOM_STEP),
  });

  defineControl({
    id: 'fullscreen',
    title: 'Fullscreen',
    icon: ICONS.fullscreen,
    isVisible: (ctx) => typeof ctx.zine.container.requestFullscreen === 'function',
    isActive: isFullscreen,
    action: (ctx) => {
      const doc = ctx.zine.container.ownerDocument;
      if (isFullscreen(ctx)) void doc?.exitFullscreen?.();
      else void ctx.zine.container.requestFullscreen?.();
      ctx.close();
    },
  });

  defineControl({
    id: 'share',
    title: 'Share',
    icon: ICONS.share,
    action: (ctx) => {
      // Deep-link to the page on screen so a shared link opens where the reader was.
      const url = new URL(location.href);
      url.hash = `page=${ctx.zine.getPage() + 1}`;
      const link = url.toString();
      const nav = navigator as Navigator & { share?: (d: { url: string }) => Promise<void> };
      if (typeof nav.share === 'function') void nav.share({ url: link }).catch(() => {});
      else void navigator.clipboard?.writeText(link).catch(() => {});
      ctx.close();
    },
  });

  defineControl({
    id: 'download',
    title: 'Download PDF',
    icon: ICONS.download,
    // Hidden for image books and for PDFs opened from a caller-owned pdf.js document, which
    // have no file of their own to save.
    isVisible: (ctx) => ctx.zine.canDownload(),
    action: (ctx) => {
      void ctx.zine.download();
      ctx.close();
    },
  });

  defineControl({
    id: 'menu',
    title: 'More',
    icon: ICONS.menu,
    children: ['download', 'share', 'fullscreen'],
  });
}
