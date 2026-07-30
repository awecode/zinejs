import { test, expect } from '@playwright/test';

// A loose first-spread sanity budget: the image book uses local images and no
// network beyond that, so the first spread should be ready quickly. Rigorous
// CPU-throttled perf is a Phase 5 concern; this just catches gross regressions.
test('first spread becomes ready within budget', async ({ page }) => {
  const start = Date.now();
  await page.goto('/fixture.html');
  // The page label is populated on the `ready` event → first spread is painted.
  await expect(page.locator('#page')).toHaveText(/page 1 \/ \d+/);
  const ms = Date.now() - start;
  console.log(`first spread ready in ${ms} ms`);
  expect(ms).toBeLessThan(3000);
});
