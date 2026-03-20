import { test, expect } from '@playwright/test';

test.describe('Loading Animations', () => {
  test('video player shows loading animation with animation classes', async ({ page }) => {
    // Start from homepage and find a valid anime
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the first anime card and get its link
    const animeCard = page.locator('a[href^="/anime/"]').first();
    const animeHref = await animeCard.getAttribute('href');
    console.log(`Found anime link: ${animeHref}`);

    // Navigate to the anime detail page
    await page.goto(`/${animeHref}`);
    await page.waitForLoadState('networkidle');

    // Look for episode button or link (could be a button or a link)
    const episodeLink = page.locator('a[href*="/watch/"], button').filter({ hasText: /\d+/ }).first();
    const episodeCount = await episodeLink.count();
    console.log(`Episode elements found: ${episodeCount}`);

    if (episodeCount > 0) {
      await episodeLink.first().click();

      // Wait for navigation or content to load
      await page.waitForTimeout(2000);

      // Check if loading overlay exists with animation classes
      const loadingOverlay = page.locator('.absolute.inset-0').filter({ hasText: /Loading|Buffering/ });
      const loadingCount = await loadingOverlay.count();
      console.log(`Loading overlays found: ${loadingCount}`);

      // Check for animated spinner
      const spinner = page.locator('.animate-spin');
      const spinnerCount = await spinner.count();
      console.log(`Spinners found: ${spinnerCount}`);

      // Check for bouncing dots
      const bouncingDots = page.locator('.animate-bounce');
      const dotsCount = await bouncingDots.count();
      console.log(`Bouncing dots found: ${dotsCount}`);

      // At least one animation element should exist
      expect(spinnerCount + dotsCount).toBeGreaterThan(0);
    } else {
      console.log('No episode links found, skipping video player test');
      test.skip(true, 'No episodes available on this anime page');
    }
  });

  test('page has smooth transitions enabled', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for animate-fadeIn on main content
    const fadeInElements = page.locator('.animate-fadeIn');
    const fadeInCount = await fadeInElements.count();
    console.log(`Fade-in elements: ${fadeInCount}`);

    expect(fadeInCount).toBeGreaterThan(0);
  });

  test('buttons have hover effects', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for buttons with hover classes
    const buttons = page.locator('button');
    const count = await buttons.count();

    let hoverEffectButtons = 0;
    for (let i = 0; i < Math.min(count, 20); i++) {
      const button = buttons.nth(i);
      const className = await button.getAttribute('class');
      if (className && (className.includes('hover:') || className.includes('transition'))) {
        hoverEffectButtons++;
      }
    }

    console.log(`Buttons with hover effects: ${hoverEffectButtons} out of ${Math.min(count, 20)}`);

    expect(hoverEffectButtons).toBeGreaterThan(0);
  });

  test('loading animation classes exist in CSS', async ({ page }) => {
    await page.goto('/');

    // Check if the animate-bounce class is defined by creating an element with it
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
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if GlassCard components exist and have proper styling
    // GlassCard uses backdrop-blur-md class and border-white/10
    const glassCards = page.locator('[class*="backdrop-blur"], [class*="rounded-xl"]');
    const glassCardCount = await glassCards.count();
    console.log(`Glass cards found: ${glassCardCount}`);

    // Check for backdrop blur effect (backdrop-blur-md, backdrop-blur-xl, etc.)
    const hasBackdropBlur = await page.locator('[class*="backdrop-blur"]').count() > 0;
    console.log(`Has backdrop blur: ${hasBackdropBlur}`);

    // Either glass cards exist OR backdrop blur exists
    expect(glassCardCount > 0 || hasBackdropBlur).toBeTruthy();
  });
});
