import type { Page } from '@playwright/test';

/**
 * Where the book is actually drawn inside #book.
 *
 * The library publishes the book's shape as an `aspect-ratio` on the container, but the
 * container keeps whatever size the page CSS gives it. When those disagree the book is
 * letterboxed inside the container (the canvas still spans the full element; the margins
 * are empty pixels the renderer leaves clear).
 *
 * Corner grabs have to land on the book itself: a point measured in from the *container*
 * edge can sit in that margin, where the flipbook correctly ignores it. The fixture is a
 * live example, 900x560 around a 1.55 book, so ~16px of each side is margin.
 */
export async function bookRect(
  page: Page,
): Promise<{ x: number; y: number; width: number; height: number }> {
  // The ratio is only published once the first pages have loaded and the book is measured.
  await page.waitForFunction(() => {
    const ar = getComputedStyle(document.getElementById('book')!).aspectRatio;
    return ar !== '' && ar !== 'auto';
  });
  return page.evaluate(() => {
    const el = document.getElementById('book')!;
    const r = el.getBoundingClientRect();
    // "W / H" (or a bare number) once the pages have loaded; absent before then.
    const [w, h] = getComputedStyle(el).aspectRatio.split('/');
    const ratio = Number(w) / (h === undefined ? 1 : Number(h));
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
    const fitByHeight = r.width / r.height > ratio;
    const width = fitByHeight ? r.height * ratio : r.width;
    const height = fitByHeight ? r.height : r.width / ratio;
    return {
      x: r.x + (r.width - width) / 2,
      y: r.y + (r.height - height) / 2,
      width,
      height,
    };
  });
}
