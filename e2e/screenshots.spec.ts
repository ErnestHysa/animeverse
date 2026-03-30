import { test } from '@playwright/test';

test('take full-page anime detail screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('http://localhost:3000/anime/21459', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/final-anime-full.png', fullPage: true });
});
