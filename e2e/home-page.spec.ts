/**
 * Home Page E2E Tests
 * Tests for home page rendering, search, and navigation
 */

import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load home page', async ({ page }) => {
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should display trending anime', async ({ page }) => {
    await expect(page.locator('h2:has-text("Trending")').or(page.locator('h1:has-text("Trending")')).first()).toBeVisible();

    // Wait for anime cards to load
    await page.waitForSelector('a[href*="/anime/"]', { timeout: 15000 });

    const animeCards = page.locator('a[href*="/anime/"]');
    const count = await animeCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display search input', async ({ page }) => {
    const searchInput = page.locator('header input[placeholder*="search" i], header input[aria-label*="search" i]');
    await expect(searchInput.first()).toBeVisible();
  });

  test('should navigate to anime detail page', async ({ page }) => {
    await page.waitForSelector('a[href*="/anime/"]', { timeout: 15000 });

    const firstAnimeLink = page.locator('a[href*="/anime/"]').first();
    await firstAnimeLink.click();

    // Should navigate to anime detail page
    await page.waitForURL(/\/anime\/\d+/);
    expect(page.url()).toMatch(/\/anime\/\d+/);
  });

  test('should have working navigation', async ({ page }) => {
    // Check header navigation
    const homeLink = page.locator('a[href="/"]').first();
    await expect(homeLink).toBeVisible();
  });
});

test.describe('Search Functionality', () => {
  test('should search for anime', async ({ page }) => {
    await page.goto('/');

    const searchInput = page.locator('input[placeholder*="search" i], input[aria-label*="search" i]');
    await searchInput.first().fill('Naruto');
    await page.waitForTimeout(500); // Wait for debounce

    // Should show search results
    await page.waitForTimeout(2000);

    // Check for search results or navigation to search page
    const url = page.url();
    const hasResults = await page.locator('a[href*="/anime/"]').count() > 0;
    const hasSearchText = await page.locator('text=Naruto').count() > 0;

    expect(hasResults || hasSearchText || url.includes('search')).toBeTruthy();
  });
});

test.describe('Anime Detail Page', () => {
  test('should display anime information', async ({ page }) => {
    await page.goto('/anime/21459');

    // Wait for content to load
    await page.waitForSelector('h1', { timeout: 15000 });

    // Check for title
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Check for description
    const description = page.locator('p').filter({ hasText: /\w+/ }).first();
    await expect(description).toBeVisible();

    // Check for watch button
    const watchButton = page.locator('a[href*="/watch/"]');
    await expect(watchButton.first()).toBeVisible();
  });

  test('should display episode list', async ({ page }) => {
    await page.goto('/anime/21459');

    await page.waitForSelector('h1', { timeout: 15000 });

    // Check for episodes section
    const episodesSection = page.locator('h2:has-text("Episodes"), h3:has-text("Episodes")');
    await expect(episodesSection).toBeVisible();
  });

  test('should navigate to watch page', async ({ page }) => {
    await page.goto('/anime/21459');

    await page.waitForSelector('a[href*="/watch/"]', { timeout: 15000 });

    const watchLink = page.locator('a[href*="/watch/"]').first();
    await watchLink.click();

    // Should navigate to watch page
    await page.waitForURL(/\/watch\/\d+\/\d+/);
    expect(page.url()).toMatch(/\/watch\/\d+\/\d+/);
  });
});

test.describe('Responsive Design', () => {
  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    await page.waitForSelector('a[href*="/anime/"]', { timeout: 15000 });

    // Check if content is visible
    const animeCards = page.locator('a[href*="/anime/"]');
    const count = await animeCards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/mobile-home.png' });
  });

  test('should work on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');

    await page.waitForSelector('a[href*="/anime/"]', { timeout: 15000 });

    const animeCards = page.locator('a[href*="/anime/"]');
    const count = await animeCards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/tablet-home.png' });
  });

  test('should work on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');

    await page.waitForSelector('a[href*="/anime/"]', { timeout: 15000 });

    const animeCards = page.locator('a[href*="/anime/"]');
    const count = await animeCards.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/desktop-home.png' });
  });
});

test.describe('Watch Page Responsive', () => {
  test('should display properly on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/watch/21459/1');

    // Wait for video player to load
    await expect(page.locator('video')).toBeAttached({ timeout: 30000 });

    // Check for player controls (use main to avoid header settings button)
    await expect(page.locator('main button[aria-label="Settings"]')).toBeVisible();

    await page.screenshot({ path: 'test-results/mobile-watch.png' });
  });

  test('should display properly on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/watch/21459/1');

    await expect(page.locator('video')).toBeAttached({ timeout: 30000 });

    await page.screenshot({ path: 'test-results/tablet-watch.png' });
  });
});

test.describe('Accessibility', () => {
  test('should have aria labels on controls', async ({ page }) => {
    await page.goto('/watch/21459/1');
    await expect(page.locator('video')).toBeAttached({ timeout: 30000 });

    // Check for aria-labels on important buttons
    const buttons = page.locator('button[aria-label]');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/watch/21459/1');
    await expect(page.locator('video')).toBeAttached({ timeout: 30000 });

    // Tab through controls
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    // Press space to toggle play
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);

    // Press escape to close any open menus
    await page.keyboard.press('Escape');
  });
});
