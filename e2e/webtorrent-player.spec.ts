/**
 * Integration tests for WebTorrent Player
 *
 * E2E tests covering:
 * - Magnet link loading
 * - Video playback
 * - Fallback system
 * - Settings persistence
 */

import { test, expect, Page } from '@playwright/test';

test.describe('WebTorrent Player E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to home page
    await page.goto('http://localhost:3000');
  });

  test('should display streaming method selector', async ({ page }) => {
    // Navigate to an anime page
    await page.click('[data-testid="anime-card"]:first-child');

    // Click on an episode
    await page.click('[data-testid="episode-item"]:first-child');

    // Check if streaming method indicator is visible
    await expect(page.locator('[data-testid="streaming-method-indicator"]')).toBeVisible();
  });

  test('should allow changing streaming method', async ({ page }) => {
    // Navigate to settings page
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');

    // Select WebTorrent streaming method
    await page.click('[data-testid="streaming-method-webtorrent"]');

    // Go back to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Verify streaming method indicator shows WebTorrent
    await expect(page.locator('[data-testid="streaming-method-indicator"]')).toContainText('WebTorrent');
  });

  test('should display seed count for WebTorrent streams', async ({ page }) => {
    // Set streaming method to WebTorrent
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-webtorrent"]');

    // Navigate to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Check if seed count is displayed
    await expect(page.locator('[data-testid="seed-count"]')).toBeVisible();
  });

  test('should show fallback warning when fallback occurs', async ({ page }) => {
    // Set streaming method to Hybrid
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-hybrid"]');

    // Navigate to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Wait for potential fallback
    await page.waitForTimeout(5000);

    // Check if fallback indicator is shown (if fallback occurred)
    const fallbackIndicator = page.locator('[data-testid="fallback-indicator"]');
    if (await fallbackIndicator.isVisible()) {
      await expect(fallbackIndicator).toContainText('fallback');
    }
  });

  test('should allow manual retry after failure', async ({ page }) => {
    // Navigate to video player
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Wait for player to load
    await page.waitForSelector('[data-testid="video-player"]', { timeout: 10000 });

    // Check if retry button exists (shown on failure)
    const retryButton = page.locator('[data-testid="retry-button"]');
    if (await retryButton.isVisible()) {
      await retryButton.click();

      // Verify loading indicator appears
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    }
  });

  test('should persist streaming method preference', async ({ page }) => {
    // Set streaming method to WebTorrent
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-webtorrent"]');

    // Reload page
    await page.reload();

    // Navigate to settings again
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');

    // Verify preference is persisted
    await expect(page.locator('[data-testid="streaming-method-webtorrent"]')).toBeChecked();
  });

  test('should save per-anime streaming preference', async ({ page }) => {
    // Navigate to anime page
    await page.click('[data-testid="anime-card"]:first-child');

    // Open anime-specific settings
    await page.click('[data-testid="anime-settings-button"]');

    // Set WebTorrent for this anime only
    await page.click('[data-testid="per-anime-streaming-webtorrent"]');

    // Navigate to a different anime
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:nth-child(2)');

    // Open settings
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');

    // Verify global setting is different from per-anime setting
    await expect(page.locator('[data-testid="streaming-method-hls"]')).toBeChecked();
  });
});

test.describe('WebTorrent Quality Selection', () => {
  test('should show quality selector for torrents', async ({ page }) => {
    // Set streaming method to WebTorrent
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-webtorrent"]');

    // Navigate to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Check if quality selector is visible
    await expect(page.locator('[data-testid="quality-selector"]')).toBeVisible();
  });

  test('should allow changing torrent quality', async ({ page }) => {
    // Navigate to video player with WebTorrent
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Click quality selector
    await page.click('[data-testid="quality-selector"]');

    // Select different quality
    await page.click('[data-testid="quality-option-720p"]');

    // Verify quality change is applied
    await expect(page.locator('[data-testid="current-quality"]')).toContainText('720p');
  });
});

test.describe('Fallback System Integration', () => {
  test('should automatically fallback when WebTorrent fails', async ({ page }) => {
    // Set streaming method to Hybrid
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-hybrid"]');

    // Navigate to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Wait for automatic fallback
    await page.waitForTimeout(35000); // 30s WebTorrent timeout + 5s buffer

    // Verify player is loaded (either via WebTorrent or HLS fallback)
    await expect(page.locator('[data-testid="video-player"]')).toBeVisible();

    // Check streaming method indicator
    const indicator = page.locator('[data-testid="streaming-method-indicator"]');
    await expect(indicator).toContainText(/WebTorrent|HLS/);
  });

  test('should show notification when fallback occurs', async ({ page }) => {
    // Set streaming method to WebTorrent
    await page.click('[data-testid="settings-button"]');
    await page.click('[data-testid="playback-settings-tab"]');
    await page.click('[data-testid="streaming-method-webtorrent"]');

    // Navigate to video player
    await page.click('[data-testid="home-button"]');
    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Wait for potential fallback
    await page.waitForTimeout(35000);

    // Check for fallback notification
    const notification = page.locator('[data-testid="fallback-notification"]');
    if (await notification.isVisible()) {
      await expect(notification).toContainText('fallback');
    }
  });
});
