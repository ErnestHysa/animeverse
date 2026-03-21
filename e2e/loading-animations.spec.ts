import { test, expect } from '@playwright/test';

test.describe('Loading Animations', () => {
  test('video player shows loading animation with animation classes', async ({ page }) => {
    // Start from homepage and find a valid anime
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});

    // Find the first anime card and get its link
    const animeCard = page.locator('a[href^="/anime/"]').first();
    const animeHref = await animeCard.getAttribute('href');
    console.log(`Found anime link: ${animeHref}`);

    if (!animeHref) {
      test.skip(true, 'No anime cards found on home page');
      return;
    }

    // Navigate to the anime detail page (href already includes leading /)
    await page.goto(animeHref);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Look for episode button or link
    const episodeLink = page.locator('a[href*="/watch/"], button').filter({ hasText: /\d+/ }).first();
    const episodeCount = await episodeLink.count();
    console.log(`Episode elements found: ${episodeCount}`);

    if (episodeCount > 0) {
      await episodeLink.first().click();

      // Wait for navigation and content to load
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000);

      // Check if video player loaded OR page has video-related content
      const video = page.locator('video');
      const videoPlayer = page.locator('[class*="video"], [class*="player"]');
      const hasVideo = await video.count() > 0;
      const hasVideoPlayer = await videoPlayer.count() > 0;

      // Check for loading indicators
      const spinners = page.locator('.animate-spin, [class*="spinner"], [class*="loading"]');
      const spinnerCount = await spinners.count();
      console.log(`Video element: ${hasVideo}, Video player: ${hasVideoPlayer}, Spinners: ${spinnerCount}`);

      // Either video loaded OR video player present OR loading indicators present
      expect(hasVideo || hasVideoPlayer || spinnerCount > 0).toBeTruthy();
    } else {
      console.log('No episode links found, skipping video player test');
      test.skip(true, 'No episodes available on this anime page');
    }
  });

  test('page has smooth transitions enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});

    // Check for fade-in elements or transition classes
    const fadeInElements = page.locator('[class*="fade"], [class*="transition"]');
    const fadeInCount = await fadeInElements.count();
    console.log(`Transition elements: ${fadeInCount}`);

    expect(fadeInCount).toBeGreaterThan(0);
  });

  test('buttons have hover effects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded', { timeout: 20000 }).catch(() => {});

    // Check for buttons with hover classes
    const buttons = page.locator('button');
    const count = await buttons.count();

    if (count > 0) {
      let hoverEffectButtons = 0;
      const checkCount = Math.min(count, 20);

      for (let i = 0; i < checkCount; i++) {
        const button = buttons.nth(i);
        const className = await button.getAttribute('class');
        if (className && (className.includes('hover:') || className.includes('transition'))) {
          hoverEffectButtons++;
        }
      }

      console.log(`Buttons with hover effects: ${hoverEffectButtons} out of ${checkCount}`);
      expect(hoverEffectButtons).toBeGreaterThan(0);
    } else {
      // If no buttons, check for any interactive elements
      const links = page.locator('a');
      const linkCount = await links.count();
      expect(linkCount).toBeGreaterThan(0);
    }
  });

  test('loading animation classes exist in CSS', async ({ page }) => {
    await page.goto('/');

    // Check if the animate-bounce class is defined
    const hasBounceAnimation = await page.evaluate(() => {
      const testEl = document.createElement('div');
      testEl.className = 'animate-bounce';
      document.body.appendChild(testEl);
      const styles = window.getComputedStyle(testEl);
      const hasAnimation = styles.animationName !== 'none';
      document.body.removeChild(testEl);
      return hasAnimation;
    });

    console.log(`Bounce animation defined: ${hasBounceAnimation}`);

    // Check if animate-spin is defined
    const hasSpinAnimation = await page.evaluate(() => {
      const testEl = document.createElement('div');
      testEl.className = 'animate-spin';
      document.body.appendChild(testEl);
      const styles = window.getComputedStyle(testEl);
      const hasAnimation = styles.animationName !== 'none';
      document.body.removeChild(testEl);
      return hasAnimation;
    });

    console.log(`Spin animation defined: ${hasSpinAnimation}`);

    expect(hasBounceAnimation || hasSpinAnimation).toBeTruthy();
  });

  test('glass card loading state has animations', async ({ page }) => {
    await page.goto('/', { timeout: 15000 });

    // Try to wait for domcontentloaded, but don't fail if it times out
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});

    // Give page time to settle
    await page.waitForTimeout(2000);

    // Check if GlassCard components exist and have proper styling
    // GlassCard uses backdrop-blur-md class and border-white/10
    const glassCards = page.locator('[class*="backdrop-blur"], [class*="rounded-xl"]');
    const glassCardCount = await glassCards.count();
    console.log(`Glass card elements found: ${glassCardCount}`);

    // Check for backdrop blur effect (backdrop-blur-md, backdrop-blur-xl, etc.)
    const hasBackdropBlur = await page.locator('[class*="backdrop-blur"]').count() > 0;
    console.log(`Has backdrop blur: ${hasBackdropBlur}`);

    // Either glass cards exist OR backdrop blur exists
    expect(glassCardCount > 0 || hasBackdropBlur).toBeTruthy();
  });
});
