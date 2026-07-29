import { test, expect } from '@playwright/test';

// A loose first-spread sanity budget. The book uses cached (data-URL) images and
// no network, so being ready should be fast. Rigorous CPU-throttled perf is a
// Phase 5 concern; this just catches gross regressions and logs the real number.
test('first spread becomes ready within budget', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => (window as unknown as { __zineFirstSpreadMs?: number }).__zineFirstSpreadMs !== undefined,
  );
  const ms = await page.evaluate(
    () => (window as unknown as { __zineFirstSpreadMs: number }).__zineFirstSpreadMs,
  );
  console.log(`first spread ready in ${ms.toFixed(0)} ms`);
  expect(ms).toBeLessThan(1000);
});
