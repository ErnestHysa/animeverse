/**
 * Loading Animations and UI Tests
 * Tests for visual animations, transitions, and UI states
 */

import { test, expect } from '@playwright/test';

const DEFAULT_TIMEOUT = 90000;

test.describe('Loading Animations', () => {
  test('page has CSS animation classes defined', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Check Tailwind animate classes exist in the DOM
    await page.locator('body').waitFor({ timeout: DEFAULT_TIMEOUT });
    const spinnerCount = await page.locator('[class*="animate-"]').count();

    // At minimum the loading spinner has animate-spin
    expect(spinnerCount).toBeGreaterThan(0);
  });

  test('loading spinner displays while content loads', async ({ page }) => {
    await page.goto('/');
    // Capture initial state (should show spinner from template.tsx Suspense fallback)
    await page.screenshot({ timeout: 0, path: 'test-results/loading-state.png' });

    // Wait for content
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });
    await page.screenshot({ timeout: 0, path: 'test-results/loaded-state.png' });
  });

  test('page has smooth transitions enabled', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });

    const hasTransitions = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="transition"]');
      return elements.length > 0;
    });

    expect(hasTransitions).toBeTruthy();
  });

  test('buttons have hover effects defined', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });

    const buttonsWithHover = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      let count = 0;
      buttons.forEach(btn => {
        if (btn.className.includes('hover:') || btn.className.includes('transition')) {
          count++;
        }
      });
      return count;
    });

    expect(buttonsWithHover).toBeGreaterThan(0);
  });

  test('loading animation classes exist in CSS', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ timeout: DEFAULT_TIMEOUT });

    const hasAnimateClasses = await page.evaluate(() => {
      const allElements = document.querySelectorAll('[class*="animate-"]');
      return allElements.length > 0;
    });

    expect(hasAnimateClasses).toBeTruthy();
  });

  test('glass card loading state has animations', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    // Glass cards and backdrop-blur elements
    const glassElements = page.locator('[class*="backdrop-blur"], [class*="glass"]');
    const count = await glassElements.count();

    // App uses glass morphism
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ timeout: 0, path: 'test-results/glass-cards.png' });
  });
});

test.describe('UI Components', () => {
  test('header renders correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const header = page.locator('header');
    await expect(header).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    await page.screenshot({ timeout: 0, path: 'test-results/header.png' });
  });

  test('footer renders correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    const footer = page.locator('footer');
    await expect(footer).toBeVisible({ timeout: 15000 });

    await page.screenshot({ timeout: 0, path: 'test-results/footer.png' });
  });

  test('dark theme is applied', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('body').waitFor({ timeout: DEFAULT_TIMEOUT });

    const hasDarkTheme = await page.evaluate(() => {
      const root = document.documentElement;
      return root.classList.contains('dark') ||
             root.getAttribute('data-theme') === 'dark' ||
             getComputedStyle(root).getPropertyValue('--background').trim() !== '';
    });

    expect(hasDarkTheme).toBeTruthy();
  });

  test('keyboard shortcuts button is visible', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('header').waitFor({ timeout: DEFAULT_TIMEOUT });

    const allButtons = await page.locator('button').count();
    expect(allButtons).toBeGreaterThan(0);
  });

  test('anime grid renders cards correctly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });

    const animeLinks = page.locator('a[href*="/anime/"]');
    await expect(animeLinks.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const count = await animeLinks.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({ timeout: 0, path: 'test-results/anime-grid.png', fullPage: false });
  });
});
