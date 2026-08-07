import { test, expect } from '@playwright/test';
import { bookRect } from './helpers';

// The demo shows "page N / M" in #page; we assert navigation through that label.

test('Next button flips to the next spread', async ({ page }) => {
  await page.goto('/fixture.html');
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
  await page.locator('#next').click();
  await expect(page.locator('#page')).toHaveText('page 3 / 20');
});

test('ArrowRight flips forward once the book is focused', async ({ page }) => {
  await page.goto('/fixture.html');
  await page.locator('#book').click(); // focus the flipbook
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#page')).toHaveText('page 3 / 20');
});

test('Home and End jump to the first and last pages', async ({ page }) => {
  await page.goto('/fixture.html?start=4');
  await page.locator('#book').click();
  await page.keyboard.press('End');
  await expect(page.locator('#page')).toHaveText('page 19 / 20'); // last spread = pages 19,20
  await page.keyboard.press('Home');
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
});

test('a corner drag across the book completes the flip', async ({ page }) => {
  await page.goto('/fixture.html');
  const book = await bookRect(page);
  await page.mouse.move(book.x + book.width - 12, book.y + 12); // top-right corner
  await page.mouse.down();
  await page.mouse.move(book.x + 12, book.y + 12, { steps: 12 }); // drag left across
  await page.mouse.up();
  await expect(page.locator('#page')).toHaveText('page 3 / 20');
});

test('a short corner drag cancels and stays put', async ({ page }) => {
  await page.goto('/fixture.html');
  const book = await bookRect(page);
  await page.mouse.move(book.x + book.width - 12, book.y + 12);
  await page.mouse.down();
  await page.mouse.move(book.x + book.width - 70, book.y + 12, { steps: 5 }); // small drag
  await page.mouse.up();
  await expect(page.locator('#page')).toHaveText('page 1 / 20');
});
