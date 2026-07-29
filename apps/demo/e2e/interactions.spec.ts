import { test, expect } from '@playwright/test';

// Demo defaults: clickToFlip 'edge', double-click zoom (center only, since edges
// flip instantly), Ctrl/⌘+wheel zoom.

test('a click near the right edge flips the page', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#page')).toHaveText('page 1 / 8');
  const box = (await page.locator('#book').boundingBox())!;
  await page.mouse.click(box.x + box.width - 20, box.y + box.height / 2); // right edge, mid-height
  await expect(page.locator('#page')).toHaveText('page 3 / 8');
});

test('a double-click in the center zooms without flipping', async ({ page }) => {
  await page.goto('/');
  const box = (await page.locator('#book').boundingBox())!;
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('#zoom')).toHaveText('2.0×'); // first level above 1
  await expect(page.locator('#page')).toHaveText('page 1 / 8'); // no flip
});

test('Ctrl+wheel zooms in', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#zoom')).toHaveText('1.0×');
  await page.evaluate(() => {
    const book = document.getElementById('book')!;
    const r = book.getBoundingClientRect();
    book.dispatchEvent(
      new WheelEvent('wheel', {
        deltaY: -300,
        ctrlKey: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(page.locator('#zoom')).not.toHaveText('1.0×');
});
