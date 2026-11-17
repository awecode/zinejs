import { test, expect, type Page } from '@playwright/test';

/** Alpha of the book canvas at a container-local CSS point: the WebGL clear is transparent, so
 *  0 means nothing was drawn there (the letterbox) and 255 means a page covers it. */
async function alphaAt(page: Page, x: number, y: number): Promise<number | null> {
  return page.evaluate(
    ([x, y]) => {
      const canvas = document.querySelector<HTMLCanvasElement>('#book canvas');
      if (!canvas || !canvas.width) return null;
      const k = canvas.width / canvas.clientWidth;
      const off = document.createElement('canvas');
      off.width = 1;
      off.height = 1;
      const ctx = off.getContext('2d')!;
      ctx.drawImage(canvas, x! * k, y! * k, 1, 1, 0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data[3]!;
    },
    [x, y],
  );
}

// A single page in the fixture's fixed 900x560 box is letterboxed with wide bands either side.
// Zoomed in, the page must grow into those bands (as the CSS renderer does), not stay clipped to
// where it sat at rest, and must grow evenly about its centre rather than drifting to one side.
test('a zoomed letterboxed page fills the box instead of clipping to its resting rect', async ({ page }) => {
  await page.goto('/fixture.html?single');
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
  await page.waitForTimeout(300);
  const mid = 280;
  expect(await alphaAt(page, 40, mid)).toBe(0); // letterbox at rest
  expect(await alphaAt(page, 860, mid)).toBe(0);
  expect(await alphaAt(page, 450, mid)).toBe(255);

  // Twice ×1.5 = 2.25×, about the middle of the page: a ~430px page grows to ~970px, so both
  // bands are covered.
  await page.locator('#zoomin').click();
  await page.locator('#zoomin').click();
  await expect(page.locator('#zoom')).toHaveText('2.3×');
  await page.waitForTimeout(100);
  expect(await alphaAt(page, 40, mid)).toBe(255);
  expect(await alphaAt(page, 860, mid)).toBe(255);
});

// The pan is in container px, so resizing the box while zoomed (entering or leaving fullscreen)
// must re-fit it, keeping the same part of the page in the middle, not leave a stale offset that
// shows a band beside the page and jumps on the next drag.
test('a zoomed page stays centred and fills the box after the box resizes', async ({ page }) => {
  await page.goto('/fixture.html?single');
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
  for (let i = 0; i < 3; i++) await page.locator('#zoomin').click();
  await expect(page.locator('#zoom')).toHaveText('3.4×');

  await page.evaluate(() => {
    const book = document.getElementById('book')!;
    book.style.width = '1200px';
    book.style.height = '700px';
  });
  await page.waitForTimeout(300);
  expect(await alphaAt(page, 20, 350)).toBe(255);
  expect(await alphaAt(page, 1180, 350)).toBe(255);
});
