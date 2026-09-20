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
    title: (ctx) => ctx.strings.prevPage,
    icon: ICONS.prev,
    isDisabled: (ctx) => !ctx.zine.canFlipPrev(),
    action: (ctx) => ctx.zine.flipPrev(),
  });

  defineControl({
    id: 'next',
    title: (ctx) => ctx.strings.nextPage,
    icon: ICONS.next,
    isDisabled: (ctx) => !ctx.zine.canFlipNext(),
    action: (ctx) => ctx.zine.flipNext(),
  });

  // The chevrons point the way the book travels, which reverses in RTL — same as the page
  // arrows flanking the book.
  const rtl = (ctx: ControlContext): boolean => ctx.zine.getDirection() === 'rtl';

  defineControl({
    id: 'first',
    title: (ctx) => ctx.strings.firstPage,
    icon: (ctx) => (rtl(ctx) ? ICONS.last : ICONS.first),
    isDisabled: (ctx) => !ctx.zine.canFlipPrev(),
    action: (ctx) => {
      ctx.zine.flipTo(0);
      ctx.close();
    },
  });

  defineControl({
    id: 'last',
    title: (ctx) => ctx.strings.lastPage,
    icon: (ctx) => (rtl(ctx) ? ICONS.first : ICONS.last),
    isDisabled: (ctx) => !ctx.zine.canFlipNext(),
    action: (ctx) => {
      ctx.zine.flipTo(ctx.zine.getPageCount() - 1);
      ctx.close();
    },
  });

  defineControl({
    id: 'zoomIn',
    title: (ctx) => ctx.strings.zoomIn,
    icon: ICONS.zoomIn,
    isDisabled: (ctx) => ctx.zine.getZoom() >= ctx.zine.getMaxZoom() - 1e-6,
    action: (ctx) => ctx.zine.setZoom(ctx.zine.getZoom() * ZOOM_STEP),
  });

  defineControl({
    id: 'zoomOut',
    title: (ctx) => ctx.strings.zoomOut,
    icon: ICONS.zoomOut,
    isDisabled: (ctx) => ctx.zine.getZoom() <= 1 + 1e-6,
    action: (ctx) => ctx.zine.setZoom(ctx.zine.getZoom() / ZOOM_STEP),
  });

  defineControl({
    id: 'fullscreen',
    title: (ctx) => ctx.strings.fullscreen,
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
    id: 'mute',
    title: (ctx) => (ctx.zine.isSoundMuted() ? ctx.strings.unmute : ctx.strings.mute),
    icon: (ctx) => (ctx.zine.isSoundMuted() ? ICONS.soundOff : ICONS.soundOn),
    // Only meaningful when flip sound is on; hidden otherwise so existing layouts are unchanged.
    isVisible: (ctx) => ctx.zine.isSoundEnabled(),
    isActive: (ctx) => ctx.zine.isSoundMuted(),
    action: (ctx) => ctx.zine.setSoundMuted(!ctx.zine.isSoundMuted()),
  });

  defineControl({
    id: 'share',
    title: (ctx) => ctx.strings.share,
    icon: ICONS.share,
    action: (ctx) => {
      ctx.close();
      // The dialog, its brand marks and the QR encoder are a chunk of their own: a book nobody
      // shares never downloads any of it.
      void import('./share')
        .then(({ ShareDialog }) => new ShareDialog(ctx.zine, ctx.zine.container, ctx.colorScheme))
        .catch(() => {
          // No dialog, so fall back to the plain behaviour rather than doing nothing.
          void navigator.clipboard?.writeText(ctx.zine.pageLink()).catch(() => {});
        });
    },
  });

  defineControl({
    id: 'download',
    title: (ctx) => ctx.strings.downloadPdf,
    icon: ICONS.download,
    // Hidden for image books and for PDFs opened from a caller-owned pdf.js document, which
    // have no file of their own to save.
    isVisible: (ctx) => ctx.zine.canDownload(),
    // Async: a cross-origin PDF is fetched into a blob first, which takes a beat. Returning the
    // promise lets the toolbar hold the menu open with a spinner until the save starts, then close.
    action: async (ctx) => {
      await ctx.zine.download();
      ctx.close();
    },
  });

  defineControl({
    id: 'spread',
    // Says what pressing it will do, not what the book is doing now, and in the reader's terms —
    // "spread mode" is the library's word for it, not theirs.
    title: (ctx) => (ctx.zine.isSinglePage() ? ctx.strings.showTwoPages : ctx.strings.showOnePage),
    icon: (ctx) => (ctx.zine.isSinglePage() ? ICONS.twoPages : ICONS.onePage),
    // Hidden while a narrow container is forcing one page: pressing it could not honour two.
    isVisible: (ctx) => !ctx.zine.isResponsiveSingle(),
    action: (ctx) => {
      ctx.zine.toggleSpreadMode();
      ctx.close();
    },
  });

  defineControl({
    id: 'print',
    title: (ctx) => ctx.strings.print,
    icon: ICONS.print,
    // Same reach as download: there has to be an original document to print.
    isVisible: (ctx) => ctx.zine.canPrint(),
    // Async like download: the print frame needs a same-origin blob for a cross-origin file, so
    // hold the menu open with a spinner until the frame is ready, then close.
    action: async (ctx) => {
      await ctx.zine.print();
      ctx.close();
    },
  });

  defineControl({
    id: 'menu',
    title: (ctx) => ctx.strings.more,
    icon: ICONS.menu,
    // Share and fullscreen sit on the bar itself by default, so the overflow holds what is left.
    // `mute` only appears here when sound is enabled (its isVisible), so it costs nothing otherwise.
    children: ['first', 'last', 'spread', 'thumbnails', 'outline', 'mute', 'print', 'download'],
  });
}
