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

  // The chevrons point the way the book travels, which reverses in RTL — same as the page
  // arrows flanking the book.
  const rtl = (ctx: ControlContext): boolean => ctx.zine.getDirection() === 'rtl';

  defineControl({
    id: 'first',
    title: 'First page',
    icon: (ctx) => (rtl(ctx) ? ICONS.last : ICONS.first),
    isDisabled: (ctx) => !ctx.zine.canFlipPrev(),
    action: (ctx) => {
      ctx.zine.flipTo(0);
      ctx.close();
    },
  });

  defineControl({
    id: 'last',
    title: 'Last page',
    icon: (ctx) => (rtl(ctx) ? ICONS.first : ICONS.last),
    isDisabled: (ctx) => !ctx.zine.canFlipNext(),
    action: (ctx) => {
      ctx.zine.flipTo(ctx.zine.getPageCount() - 1);
      ctx.close();
    },
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
      ctx.close();
      // The dialog, its brand marks and the QR encoder are a chunk of their own: a book nobody
      // shares never downloads any of it.
      void import('./share')
        .then(({ ShareDialog }) => new ShareDialog(ctx.zine, ctx.zine.container))
        .catch(() => {
          // No dialog, so fall back to the plain behaviour rather than doing nothing.
          void navigator.clipboard?.writeText(ctx.zine.pageLink()).catch(() => {});
        });
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
    id: 'print',
    title: 'Print',
    icon: ICONS.print,
    // Same reach as download: there has to be an original document to print.
    isVisible: (ctx) => ctx.zine.canPrint(),
    action: (ctx) => {
      void ctx.zine.print();
      ctx.close();
    },
  });

  defineControl({
    id: 'menu',
    title: 'More',
    icon: ICONS.menu,
    // Share and fullscreen sit on the bar itself by default, so the overflow holds what is left.
    children: ['first', 'last', 'thumbnails', 'outline', 'print', 'download'],
  });
}
