import { test, expect, type Page } from '@playwright/test';

/**
 * Sample the central 60% of the book canvas (inside the letterbox margin) and report how much
 * of it is opaque and how many distinct colors it holds. A repainted book page is a photo:
 * mostly opaque, many colors. A lost/blank drawing buffer is either cleared to transparent
 * (opaque ~ 0) or a single flat color (distinct ~ 1). So this cleanly tells "content" from
 * "white screen".
 */
async function sampleBook(
  page: Page,
): Promise<{ opaque: number; total: number; distinct: number } | null> {
  return page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#book canvas');
    if (!canvas || !canvas.width || !canvas.height) return null;
    const S = 40;
    const off = document.createElement('canvas');
    off.width = S;
    off.height = S;
    const ctx = off.getContext('2d')!;
    ctx.clearRect(0, 0, S, S);
    // Central 60% of the book, avoiding the cleared letterbox border.
    const sx = canvas.width * 0.2;
    const sy = canvas.height * 0.2;
    ctx.drawImage(canvas, sx, sy, canvas.width * 0.6, canvas.height * 0.6, 0, 0, S, S);
    const data = ctx.getImageData(0, 0, S, S).data;
    let opaque = 0;
    const colors = new Set<string>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 8) opaque++;
      colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
    }
    return { opaque, total: S * S, distinct: colors.size };
  });
}

const hasContent = (s: { opaque: number; total: number; distinct: number } | null): boolean =>
  s !== null && s.opaque > s.total * 0.5 && s.distinct > 3;

test('WebGL context loss then restore repaints the book (no white screen)', async ({ page }) => {
  await page.goto('/fixture.html');
  await expect(page.locator('#page')).toHaveText(/page 1 \/ \d+/); // first spread painted

  // Only the WebGL2 renderer has a GL context to lose; the CSS fallback (no GPU) has no canvas.
  const usesWebgl = await page.evaluate(() => !!document.querySelector('#book canvas'));
  test.skip(!usesWebgl, 'WebGL2 renderer not selected (no GPU in this environment)');

  expect(hasContent(await sampleBook(page)), 'book paints content before loss').toBe(true);

  // Drop the GL context via the standard extension; the renderer must survive and rearm.
  const ready = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#book canvas')!;
    const gl = canvas.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_lose_context');
    const w = window as unknown as {
      __loseExt?: WEBGL_lose_context;
      __lost?: boolean;
      __restored?: boolean;
    };
    if (!ext) return false;
    w.__loseExt = ext;
    w.__lost = false;
    w.__restored = false;
    canvas.addEventListener('webglcontextlost', () => (w.__lost = true), { once: true });
    canvas.addEventListener('webglcontextrestored', () => (w.__restored = true), { once: true });
    ext.loseContext();
    return true;
  });
  expect(ready, 'WEBGL_lose_context is available').toBe(true);

  // Wait for the loss to propagate, then restore. The extension requires the lost event to
  // have fired before restoreContext() will take effect.
  await page.waitForFunction(() => (window as unknown as { __lost?: boolean }).__lost === true, null, {
    timeout: 5000,
  });
  await page.evaluate(() =>
    (window as unknown as { __loseExt: WEBGL_lose_context }).__loseExt.restoreContext(),
  );
  await page.waitForFunction(
    () => (window as unknown as { __restored?: boolean }).__restored === true,
    null,
    { timeout: 5000 },
  );

  // The renderer rebuilds its GL resources and repaints the spread it still holds: content
  // returns rather than a blank canvas.
  await expect
    .poll(async () => hasContent(await sampleBook(page)), {
      timeout: 5000,
      message: 'book repaints after context restore (no white screen)',
    })
    .toBe(true);
});
