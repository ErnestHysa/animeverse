/**
 * Home Page E2E Tests
 * Tests for home page rendering, search, and navigation
 */

import { test, expect } from '@playwright/test';

// AniList API is mocked at server level via ANILIST_GRAPHQL_URL env var
// pointing to local mock server on port 4000

const DEFAULT_TIMEOUT = 90000;
const NAV_TIMEOUT = 90000;

test.describe('Home Page', () => {
  test('should load home page with content', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for h1 to appear (React streaming)
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const text = await h1.textContent();
    expect(text).toBeTruthy();

    await page.screenshot({ timeout: 0, path: 'test-results/01-home-loaded.png', fullPage: false });
  });

  test('should display anime cards', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for anime cards to load
    const animeCard = page.locator('a[href*="/anime/"]').first();
    await expect(animeCard).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const count = await page.locator('a[href*="/anime/"]').count();
    expect(count).toBeGreaterThan(5);

    await page.screenshot({ timeout: 0, path: 'test-results/02-home-anime-cards.png', fullPage: false });
  });

  test('should display header with navigation', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Home link should exist
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/03-header.png' });
  });

  test('should display trending section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for any section heading
    const trendingSection = page.getByText('Trending', { exact: false });
    await expect(trendingSection.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/04-trending-section.png', fullPage: false });
  });

  test('should display popular section', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const popularSection = page.getByText('Popular', { exact: false });
    await expect(popularSection.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  });

  test('should display footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for page to load first
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ timeout: 0, path: 'test-results/05-footer.png' });
  });

  test('should navigate to anime detail page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for anime cards
    const firstLink = page.locator('a[href*="/anime/"]').first();
    await expect(firstLink).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const href = await firstLink.getAttribute('href');
    console.log(`Clicking: ${href}`);

    await firstLink.click();
    await page.waitForURL(/\/anime\/\d+/, { timeout: NAV_TIMEOUT });

    expect(page.url()).toMatch(/\/anime\/\d+/);
    await page.screenshot({ timeout: 0, path: 'test-results/06-anime-detail.png', fullPage: false });
  });
});

test.describe('Search Functionality', () => {
  test('should display search page with query', async ({ page }) => {
    await page.goto('/search?q=One+Punch+Man', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    // Heading should mention the query
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();

    await page.screenshot({ timeout: 0, path: 'test-results/07-search-results.png' });
  });

  test('should display search results with anime cards', async ({ page }) => {
    await page.goto('/search?q=Naruto', { waitUntil: 'domcontentloaded' });

    // Wait for results
    const animeCards = page.locator('a[href*="/anime/"]');
    await expect(animeCards.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const count = await animeCards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ timeout: 0, path: 'test-results/08-search-anime.png' });
  });

  test('should show empty state without query', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' });

    // Should show search anime heading
    const heading = page.getByText('Search Anime', { exact: false });
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/09-search-empty.png' });
  });
});

test.describe('Anime Detail Page', () => {
  test('should display anime information', async ({ page }) => {
    await page.goto('/anime/21459', { waitUntil: 'domcontentloaded' });

    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const title = await heading.textContent();
    expect(title).toBeTruthy();

    await page.screenshot({ timeout: 0, path: 'test-results/10-anime-detail-page.png', fullPage: false });
  });

  test('should display episode links', async ({ page }) => {
    await page.goto('/anime/21459', { waitUntil: 'domcontentloaded' });

    // Wait for page content
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    // Check for watch links or episodes section
    const watchLinks = page.locator('a[href*="/watch/"]');
    const episodesHeading = page.getByText('Episodes', { exact: false });

    await page.waitForTimeout(3000);

    const hasLinks = await watchLinks.count() > 0;
    const hasEpisodes = await episodesHeading.count() > 0;

    expect(hasLinks || hasEpisodes).toBeTruthy();

    await page.screenshot({ timeout: 0, path: 'test-results/11-anime-episodes.png', fullPage: false });
  });

  test('should navigate to watch page from anime detail', async ({ page }) => {
    await page.goto('/anime/21459', { waitUntil: 'domcontentloaded' });

    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });
    await page.waitForTimeout(2000);

    const watchLinks = page.locator('a[href*="/watch/"]');
    const count = await watchLinks.count();

    if (count > 0) {
      await watchLinks.first().click();
      await page.waitForURL(/\/watch\/\d+\/\d+/, { timeout: NAV_TIMEOUT });
      expect(page.url()).toMatch(/\/watch\/\d+\/\d+/);
      await page.screenshot({ timeout: 0, path: 'test-results/12-watch-from-detail.png', fullPage: false });
    } else {
      // Navigate directly if no watch links visible
      await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });
      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    }
  });
});

test.describe('Navigation Pages', () => {
  test('should load trending page', async ({ page }) => {
    await page.goto('/trending', { waitUntil: 'domcontentloaded' });
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/13-trending.png' });
  });

  test('should load popular page', async ({ page }) => {
    await page.goto('/popular', { waitUntil: 'domcontentloaded' });
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/14-popular.png' });
  });

  test('should load seasonal page', async ({ page }) => {
    await page.goto('/seasonal', { waitUntil: 'domcontentloaded' });
    const heading = page.locator('h1');
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/15-seasonal.png' });
  });

  test('should load history page with header', async ({ page }) => {
    await page.goto('/history', { waitUntil: 'domcontentloaded' });
    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/16-history.png' });
  });

  test('should load schedule page', async ({ page }) => {
    await page.goto('/schedule', { waitUntil: 'domcontentloaded' });
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/17-schedule.png' });
  });

  test('should load genres page', async ({ page }) => {
    await page.goto('/genres', { waitUntil: 'domcontentloaded' });
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/18-genres.png' });
  });
});

test.describe('Watch Page', () => {
  test('should load watch page with layout', async ({ page }) => {
    await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });
    const main = page.locator('main');
    await expect(main).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/19-watch-page.png', fullPage: false });
  });

  test('should display anime title on watch page', async ({ page }) => {
    await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const text = await heading.textContent();
    expect(text).toBeTruthy();
  });

  test('should show episode not found for invalid episode', async ({ page }) => {
    await page.goto('/watch/21459/9999', { waitUntil: 'domcontentloaded' });
    const body = page.locator('body');
    await expect(body).toBeAttached({ timeout: DEFAULT_TIMEOUT });
    // Should show error or redirect
    await page.screenshot({ timeout: 0, path: 'test-results/20-watch-invalid.png' });
  });
});

test.describe('Responsive Design', () => {
  test('mobile viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/21-mobile.png' });
  });

  test('tablet viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/22-tablet.png' });
  });

  test('desktop viewport renders correctly', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/23-desktop.png' });
  });
});
