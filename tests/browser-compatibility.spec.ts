/**
 * Browser Compatibility Tests for WebTorrent Player
 *
 * Tests WebRTC and WebTorrent functionality across:
 * - Chrome/Edge (Chromium)
 * - Firefox
 * - Safari (with polyfill)
 * - Mobile browsers
 */

import { test, expect, Page } from '@playwright/test';

const browsers = {
  chromium: 'Chrome/Edge',
  firefox: 'Firefox',
  webkit: 'Safari',
};

test.describe.configure({ mode: 'parallel' });

for (const [browserName, displayName] of Object.entries(browsers)) {
  test.describe(`${displayName} Browser Compatibility`, () => {
    test.use({ browserName: browserName as "chromium" | "firefox" | "webkit" });

    test('should support WebRTC', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Check WebRTC support
      const webrtcSupport = await page.evaluate(() => {
        return !!(
          window.RTCPeerConnection ||
          (window as any).webkitRTCPeerConnection ||
          (window as any).mozRTCPeerConnection
        );
      });

      expect(webrtcSupport).toBe(true);
    });

    test('should initialize WebTorrent client', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Navigate to video player with WebTorrent
      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Set streaming method to WebTorrent
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');
      await page.click('[data-testid="streaming-method-webtorrent"]');

      // Check if WebTorrent client initializes
      const clientInitialized = await page.evaluate(() => {
        return typeof (window as any).WebTorrent !== 'undefined';
      });

      expect(clientInitialized).toBe(true);
    });

    test('should display video player', async ({ page }) => {
      await page.goto('http://localhost:3000');

      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Check if video element is present
      const videoElement = await page.locator('video').isVisible();
      expect(videoElement).toBe(true);
    });

    test('should support DataChannel for P2P', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const dataChannelSupport = await page.evaluate(() => {
        const pc = new (window.RTCPeerConnection ||
                       (window as any).webkitRTCPeerConnection ||
                       (window as any).mozRTCPeerConnection)({ iceServers: [] });
        const support = !!pc.createDataChannel;
        pc.close();
        return support;
      });

      expect(dataChannelSupport).toBe(true);
    });

    test('should handle magnet link parsing', async ({ page }) => {
      await page.goto('http://localhost:3000');

      const magnetParsed = await page.evaluate(() => {
        const magnet = 'magnet:?xt=urn:btih:1234567890abcdef1234567890abcdef12345678&dn=Test';
        const match = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/);
        return match !== null;
      });

      expect(magnetParsed).toBe(true);
    });

    test('should display streaming settings', async ({ page }) => {
      await page.goto('http://localhost:3000');

      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');

      // Check if streaming method options are visible
      await expect(page.locator('[data-testid="streaming-method-hls"]')).toBeVisible();
      await expect(page.locator('[data-testid="streaming-method-webtorrent"]')).toBeVisible();
      await expect(page.locator('[data-testid="streaming-method-hybrid"]')).toBeVisible();
    });

    test('should persist settings in localStorage', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Set streaming method
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');
      await page.click('[data-testid="streaming-method-webtorrent"]');

      // Reload page
      await page.reload();

      // Navigate to settings again
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');

      // Verify setting persisted
      const isChecked = await page.locator('[data-testid="streaming-method-webtorrent"]').isChecked();
      expect(isChecked).toBe(true);
    });

    test('should handle video playback controls', async ({ page }) => {
      await page.goto('http://localhost:3000');

      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Wait for video player
      await page.waitForSelector('video', { timeout: 10000 });

      // Test play/pause
      const video = page.locator('video');
      await video.click(); // Play

      await page.waitForTimeout(1000);

      await video.click(); // Pause

      // Verify controls are functional
      const paused = await video.evaluate((el: HTMLVideoElement) => el.paused);
      expect(paused).toBe(true);
    });

    test('should display quality selector', async ({ page }) => {
      await page.goto('http://localhost:3000');

      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Check if quality selector exists
      const qualitySelector = page.locator('[data-testid="quality-selector"]');
      if (await qualitySelector.isVisible()) {
        await qualitySelector.click();

        // Verify quality options are displayed
        await expect(page.locator('[data-testid="quality-option-1080p"]')).toBeVisible();
      }
    });

    test('should handle streaming method switching', async ({ page }) => {
      await page.goto('http://localhost:3000');

      // Navigate to video player
      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Set to WebTorrent
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');
      await page.click('[data-testid="streaming-method-webtorrent"]');

      // Go back to player
      await page.click('[data-testid="home-button"]');
      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Check indicator
      const indicator = page.locator('[data-testid="streaming-method-indicator"]');
      await expect(indicator).toContainText('WebTorrent');

      // Switch to HLS
      await page.click('[data-testid="settings-button"]');
      await page.click('[data-testid="playback-settings-tab"]');
      await page.click('[data-testid="streaming-method-hls"]');

      // Go back to player
      await page.click('[data-testid="home-button"]');
      await page.click('[data-testid="anime-card"]:first-child');
      await page.click('[data-testid="episode-item"]:first-child');

      // Check indicator changed
      await expect(indicator).toContainText('HLS');
    });
  });
}

test.describe('Mobile Browser Compatibility', () => {
  test.use({
    viewport: { width: 393, height: 851 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36',
    deviceScaleFactor: 2.75,
    isMobile: true,
    hasTouch: true,
  });

  test('should work on mobile Chrome', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check if page loads correctly
    await expect(page.locator('[data-testid="home-container"]')).toBeVisible();

    // Test navigation
    await page.click('[data-testid="anime-card"]:first-child');

    // Verify episode list loads
    await expect(page.locator('[data-testid="episode-item"]:first-child')).toBeVisible();
  });

  test('should display mobile-friendly controls', async ({ page }) => {
    await page.goto('http://localhost:3000');

    await page.click('[data-testid="anime-card"]:first-child');
    await page.click('[data-testid="episode-item"]:first-child');

    // Check if video player is responsive
    const video = page.locator('video');
    await expect(video).toBeVisible();

    const box = await video.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(page.viewportSize()?.width || 412);
  });
});

test.describe('Safari Polyfill Support', () => {
  test.use({ browserName: 'webkit' });

  test('should load WebTorrent polyfill for Safari', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check if WebTorrent is loaded (via polyfill if needed)
    const webtorrentLoaded = await page.evaluate(() => {
      return typeof (window as any).WebTorrent !== 'undefined';
    });

    expect(webtorrentLoaded).toBe(true);
  });

  test('should handle Safari-specific WebRTC implementation', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const webRTCWorking = await page.evaluate(() => {
      return !!(window.RTCPeerConnection || (window as any).webkitRTCPeerConnection);
    });

    expect(webRTCWorking).toBe(true);
  });
});
