import { test, expect } from '@playwright/test';
import { bookRect } from './helpers';

// Pinch and touch have no native Playwright API; since the input layer is built
// on Pointer Events, we dispatch synthetic PointerEvents in the page to drive
// the real listeners. RTL uses genuine keyboard input.

test('RTL: ArrowLeft flips forward', async ({ page }) => {
  await page.goto('/fixture.html?direction=rtl');
  await page.locator('#book').click();
  await page.keyboard.press('ArrowLeft'); // forward key in RTL
  await expect(page.locator('#page')).toHaveText('page 3 / 20');
  await page.keyboard.press('ArrowRight'); // back
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
});

test('a touch drag across the book flips the page', async ({ page }) => {
  await page.goto('/fixture.html');
  const book = await bookRect(page);
  const y = book.y + 12;
  // Dispatch each touch pointer event in its own step so the flip's async
  // staging flushes between them (as it does under real, timed mouse input).
  const fire = (type: string, x: number): Promise<void> =>
    page.evaluate(
      ({ type, x, y }) => {
        document.getElementById('book')!.dispatchEvent(
          new PointerEvent(type, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }),
        );
      },
      { type, x, y },
    );
  await fire('pointerdown', book.x + book.width - 12); // top-right corner
  await fire('pointermove', book.x + book.width / 2);
  await fire('pointermove', book.x + 12);
  await fire('pointerup', book.x + 12);
  await expect(page.locator('#page')).toHaveText('page 3 / 20');
});

test('pinch spreads two fingers to zoom in', async ({ page }) => {
  await page.goto('/fixture.html');
  await expect(page.locator('#zoom')).toHaveText('1.0×');
  await page.evaluate(() => {
    const book = document.getElementById('book')!;
    const r = book.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const fire = (type: string, id: number, x: number): void => {
      book.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: cy, bubbles: true }));
    };
    fire('pointerdown', 1, cx - 20); // start distance 40
    fire('pointerdown', 2, cx + 20);
    fire('pointermove', 2, cx + 120); // distance 140 → scale 3.5
    fire('pointerup', 2, cx + 120);
    fire('pointerup', 1, cx - 20);
  });
  await expect(page.locator('#zoom')).toHaveText('3.5×');
});
