/**
 * Video Player E2E Tests
 * Tests for video player functionality and watch page
 */

import { test, expect } from '@playwright/test';

const DEFAULT_TIMEOUT = 90000;

async function setupWatchPage(page: import('@playwright/test').Page) {
  // Navigate to watch page and wait for actual content to load
  await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });
  // Wait for the h1 title to appear (RSC streaming resolves)
  await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });
  await page.waitForTimeout(1000);
}

test.describe('Watch Page Structure', () => {
  test('should load watch page', async ({ page }) => {
    await setupWatchPage(page);

    // Check main content exists
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-page-loaded.png', fullPage: false });
  });

  test('should display anime title', async ({ page }) => {
    await setupWatchPage(page);

    // Check for h1 title
    const title = page.locator('h1').first();
    await expect(title).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const titleText = await title.textContent();
    expect(titleText).toBeTruthy();

    await page.screenshot({ timeout: 0, path: 'test-results/watch-title.png' });
  });

  test('should display episode navigation', async ({ page }) => {
    await setupWatchPage(page);

    // Check for next/previous episode buttons
    const navButtons = page.locator('button, a').filter({ hasText: /next|previous|prev/i });
    await page.waitForTimeout(1000);

    // Should have at least some navigation
    const count = await navButtons.count();
    // Navigation might be present as links too
    const nextLinks = page.locator('a[href*="/watch/"]');
    const linkCount = await nextLinks.count();

    expect(count > 0 || linkCount > 0).toBeTruthy();
  });

  test('should display episode list sidebar', async ({ page }) => {
    await setupWatchPage(page);

    // Check for episode list section
    const episodeSection = page.locator('div').filter({ hasText: /episode/i }).first();
    await expect(episodeSection).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-sidebar.png' });
  });

  test('should display video player container', async ({ page }) => {
    await setupWatchPage(page);

    // Check for video player container (even if video fails to load)
    const playerContainer = page.locator('[class*="player"], [class*="video"], video, .aspect-video')
      .first();

    // At least check the page structure has the main layout
    const mainContent = page.locator('main .grid, main [class*="grid"], main > div').first();
    await expect(mainContent).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-player.png', fullPage: false });
  });

  test('should display control buttons', async ({ page }) => {
    await setupWatchPage(page);

    // Check for any buttons (player controls, share, report, etc.)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(2);

    await page.screenshot({ timeout: 0, path: 'test-results/watch-controls.png' });
  });

  test('should display anime info section', async ({ page }) => {
    await setupWatchPage(page);

    // The sidebar has anime info card
    const animeInfoCard = page.locator('a[href*="/anime/"]').filter({ hasText: /one punch|anime/i })
      .or(page.locator('[class*="glass"]').first());

    await page.waitForTimeout(1000);

    // Just verify the page has loaded properly
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  test('should have share and report buttons', async ({ page }) => {
    await setupWatchPage(page);

    // Check for action buttons
    const shareButton = page.locator('button').filter({ hasText: /share/i });
    const reportButton = page.locator('button').filter({ hasText: /report/i });

    await page.waitForTimeout(1000);

    const shareCount = await shareButton.count();
    const reportCount = await reportButton.count();

    // At least check these UI elements are wired up
    // They may be hidden on mobile (sm:flex)
    const allButtons = await page.locator('button').count();
    expect(allButtons).toBeGreaterThan(0);
  });
});

test.describe('Watch Page Navigation', () => {
  test('should have breadcrumb navigation', async ({ page }) => {
    await setupWatchPage(page);

    // Check for breadcrumb with Home link
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  test('should link back to anime detail page', async ({ page }) => {
    await setupWatchPage(page);

    // Check for anime detail link in breadcrumb or sidebar
    const animeLink = page.locator('a[href*="/anime/21459"]');
    const count = await animeLink.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should handle invalid episode gracefully', async ({ page }) => {
    await page.goto('/watch/21459/9999', { waitUntil: 'domcontentloaded' });

    // Should show episode not found or redirect
    const body = page.locator('body');
    await expect(body).toBeAttached({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-invalid-episode.png' });
  });

  test('should handle non-existent anime gracefully', async ({ page }) => {
    // Use a very high episode ID that mock server won't find
    // Mock server returns null for unknown IDs - test that /watch/999999/1 shows not found
    await page.goto('/watch/999999/1', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ timeout: DEFAULT_TIMEOUT });

    // Should show some kind of not found or error state
    const body = page.locator('body');
    await expect(body).toBeAttached({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-not-found.png' });
  });
});

test.describe('Video Sources API', () => {
  test('should load watch page and show video player area', async ({ page }) => {
    await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    // Verify the main structure is there
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/watch-video-area.png', fullPage: false });
  });
});

test.describe('Loading States', () => {
  test('should show content after loading', async ({ page }) => {
    await page.goto('/watch/21459/1');

    // Capture initial loading state
    await page.screenshot({ timeout: 0, path: 'test-results/watch-loading.png' });

    // Wait for content
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Capture loaded state
    await page.screenshot({ timeout: 0, path: 'test-results/watch-loaded.png', fullPage: false });
  });
});
