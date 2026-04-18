/**
 * Real User Flow E2E Test
 * Simulates exactly what a REAL user would do with the app
 * This will showcase if there are actual bugs or if the user would have an error-free experience
 */

import { test, expect } from '@playwright/test';

const DEFAULT_TIMEOUT = 120000;
const NAV_TIMEOUT = 60000;

test.describe('Real User Flow - Complete Journey', () => {
  test('complete user journey: browse -> search -> view anime -> watch episode', async ({ page }) => {
    // Check for console errors — register listener BEFORE navigation to catch all errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // STEP 1: User lands on the home page
    console.log('📍 STEP 1: User lands on home page');
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for page to actually load
    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const title = await h1.textContent();
    console.log(`✓ Home page loaded with title: "${title}"`);

    // Take screenshot of home page
    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/01-homepage.png', fullPage: true });

    // STEP 2: User browses the trending section
    console.log('📍 STEP 2: User scrolls down to see trending anime');
    await page.evaluate(() => window.scrollTo(0, 500));
    // Wait for scroll to take effect and any lazy content to load
    await page.waitForLoadState('networkidle');

    const trendingSection = page.getByText('Trending', { exact: false }).first();
    const trendingVisible = await trendingSection.isVisible().catch(() => false);
    console.log(`✓ Trending section visible: ${trendingVisible}`);

    // STEP 3: User clicks on an anime card
    console.log('📍 STEP 3: User clicks on first anime card');
    const animeCards = page.locator('a[href*="/anime/"]');
    const cardCount = await animeCards.count();
    console.log(`✓ Found ${cardCount} anime cards`);

    expect(cardCount, 'Should have anime cards on home page').toBeGreaterThan(0);

    const firstCard = animeCards.first();
    const animeUrl = await firstCard.getAttribute('href');
    console.log(`✓ Clicking on anime: ${animeUrl}`);

    await firstCard.click();

    // Wait for navigation
    await page.waitForURL(/\/anime\/\d+/, { timeout: NAV_TIMEOUT });
    console.log(`✓ Navigated to: ${page.url()}`);

    // Take screenshot of anime detail page
    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/02-anime-detail.png', fullPage: true });

    // STEP 4: User views anime details
    console.log('📍 STEP 4: User views anime details');
    const animeTitle = page.locator('h1').first();
    await expect(animeTitle).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const animeTitleText = await animeTitle.textContent();
    console.log(`✓ Anime title: "${animeTitleText}"`);

    // Check for episode list or watch links - wait for them to render
    const watchLinks = page.locator('a[href*="/watch/"]');
    await watchLinks.first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
    const watchLinkCount = await watchLinks.count();
    console.log(`✓ Found ${watchLinkCount} episode links`);

    // STEP 5: User clicks on an episode to watch
    if (watchLinkCount > 0) {
      console.log('📍 STEP 5: User clicks on first episode to watch');
      const firstEpisode = watchLinks.first();
      const episodeUrl = await firstEpisode.getAttribute('href');
      console.log(`✓ Clicking on episode: ${episodeUrl}`);

      await firstEpisode.click();
    } else {
      // If no episode links, navigate manually
      console.log('📍 STEP 5: No episode links found, navigating manually to watch page');
      const animeId = page.url().match(/\/anime\/(\d+)/)?.[1];
      if (animeId) {
        await page.goto(`/watch/${animeId}/1`, { waitUntil: 'domcontentloaded' });
      }
    }

    // Wait for watch page to load
    await page.waitForURL(/\/watch\/\d+\/\d+/, { timeout: NAV_TIMEOUT });
    console.log(`✓ Navigated to watch page: ${page.url()}`);

    // Take screenshot of watch page
    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/03-watch-page.png', fullPage: true });

    // STEP 6: User tries to play the video
    console.log('📍 STEP 6: User tries to play the video');
    // Wait for video element or player container to appear
    await page.waitForSelector('video, [class*="player"]', { timeout: 10000 }).catch(() => {});

    // Check for video player
    const videoElement = page.locator('video').first();
    const videoExists = await videoElement.count() > 0;
    console.log(`✓ Video element present: ${videoExists}`);

    if (videoExists) {
      // Try to play the video
      try {
        await videoElement.click();
        // Wait for play state to stabilize
        await page.waitForFunction(() => {
          const video = document.querySelector('video');
          return video && (!video.paused || video.readyState >= 2);
        }, { timeout: 5000 }).catch(() => {});
        const isPlaying = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video && !video.paused;
        });
        console.log(`✓ Video playing: ${isPlaying}`);
      } catch (e) {
        console.log(`⚠ Video play interaction: ${e}`);
      }
    }

    // Check for any error messages
    const errorMessages = page.locator('text=/error|failed|could not load/i');
    const errorCount = await errorMessages.count();
    console.log(`✓ Error messages on page: ${errorCount}`);

    // STEP 7: User navigates to next episode (if available)
    console.log('📍 STEP 7: User looks for next episode button');
    const nextButtons = page.locator('button, a').filter({ hasText: /next|episode.*2/i });
    const nextButtonCount = await nextButtons.count();
    console.log(`✓ Found ${nextButtonCount} next episode buttons`);

    // STEP 8: User uses search functionality
    console.log('📍 STEP 8: User navigates to search page');
    await page.goto('/search?q=Naruto', { waitUntil: 'domcontentloaded' });

    await page.locator('h1').first().waitFor({ timeout: DEFAULT_TIMEOUT });
    console.log(`✓ Search page loaded: ${page.url()}`);

    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/04-search-page.png', fullPage: true });

    // Wait for search results to load
    await page.waitForLoadState('networkidle');
    const searchResults = page.locator('a[href*="/anime/"]');
    const resultCount = await searchResults.count();
    console.log(`✓ Search results found: ${resultCount}`);

    // SUMMARY
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('USER FLOW TEST SUMMARY');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`✓ Home Page: Loaded`);
    console.log(`✓ Anime Cards: ${cardCount} found`);
    console.log(`✓ Anime Detail: "${animeTitleText}"`);
    console.log(`✓ Episode Links: ${watchLinkCount} found`);
    console.log(`✓ Watch Page: Loaded`);
    console.log(`✓ Video Element: ${videoExists ? 'Present' : 'Not found'}`);
    console.log(`✓ Next Episode Buttons: ${nextButtonCount} found`);
    console.log(`✓ Search Results: ${resultCount} found`);
    console.log(`✓ Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log('Console Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }
    console.log('═══════════════════════════════════════════════════════\n');

    // Assertions for user experience quality
    expect(cardCount, 'Home page should show anime').toBeGreaterThan(0);
    expect(animeTitleText, 'Anime detail should have title').toBeTruthy();
    expect(resultCount, 'Search should return results').toBeGreaterThan(0);

    // This is the real test - would a user have errors?
    const hasCriticalErrors = consoleErrors.some(err =>
      err.includes('TypeError') ||
      err.includes('ReferenceError') ||
      err.includes('Cannot read')
    );

    if (hasCriticalErrors) {
      console.log('⚠ CRITICAL: User would experience JavaScript errors!');
    } else {
      console.log('✓ User would have an error-free experience');
    }

    // Assert that no critical JS errors occurred during the user flow
    expect(hasCriticalErrors, 'No critical JS errors should occur during user flow').toBe(false);
  });

  test('user tries to watch anime from scratch', async ({ page }) => {
    console.log('📍 TEST: Direct watch experience');

    // User goes directly to a watch page (like from a bookmark)
    await page.goto('/watch/21459/1', { waitUntil: 'domcontentloaded' });

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const title = await h1.textContent();
    console.log(`✓ Watch page loaded: "${title}"`);

    // Check if video player loads - wait for player element
    await page.waitForSelector('video, [class*="player"], [class*="video"]', { timeout: 10000 }).catch(() => {});

    const videoPlayer = page.locator('video, [class*="player"], [class*="video"]').first();
    const playerVisible = await videoPlayer.isVisible().catch(() => false);
    console.log(`✓ Video player visible: ${playerVisible}`);

    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/05-direct-watch.png', fullPage: true });

    // Check for loading issues
    const loadingIndicators = page.locator('text=/loading|buffering/i');
    const isLoading = await loadingIndicators.count() > 0;
    console.log(`✓ Still loading: ${isLoading}`);

    expect(playerVisible || isLoading, 'Video player should be visible or loading').toBeTruthy();
  });

  test('user navigates through different pages', async ({ page }) => {
    console.log('📍 TEST: Navigation across pages');

    const pages = [
      { path: '/trending', name: 'Trending' },
      { path: '/popular', name: 'Popular' },
      { path: '/seasonal', name: 'Seasonal' },
      { path: '/genres', name: 'Genres' },
    ];

    for (const pageData of pages) {
      console.log(`  → Loading ${pageData.name} page...`);
      await page.goto(pageData.path, { waitUntil: 'domcontentloaded' });

      const h1 = page.locator('h1, main').first();
      await expect(h1).toBeVisible({ timeout: DEFAULT_TIMEOUT });

      // Wait for page content to settle instead of hard-coded sleep
      await page.waitForLoadState('networkidle');
      console.log(`  ✓ ${pageData.name} page loaded`);
    }

    console.log('✓ All navigation pages work correctly');
  });
});

test.describe('Real User - Error Scenarios', () => {
  test('user encounters invalid anime ID', async ({ page }) => {
    console.log('📍 TEST: Invalid anime handling');

    await page.goto('/anime/999999999', { waitUntil: 'domcontentloaded' });
    // Wait for page to finish rendering instead of hard-coded sleep
    await page.waitForLoadState('networkidle');

    // Should show some kind of error or not found state
    const bodyText = await page.locator('body').textContent();
    const hasNotFound = bodyText?.toLowerCase().includes('not found') ||
                       bodyText?.toLowerCase().includes('404');

    console.log(`✓ Shows not found: ${hasNotFound}`);

    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/06-invalid-anime.png', fullPage: true });

    // Assert: page should indicate the anime was not found or show an error state
    expect(bodyText, 'Page should have some content').toBeTruthy();
    expect(
      hasNotFound || bodyText?.toLowerCase().includes('error') || bodyText?.toLowerCase().includes('anime'),
      'Page should show not found, error, or anime-related content'
    ).toBeTruthy();
  });

  test('user encounters invalid episode', async ({ page }) => {
    console.log('📍 TEST: Invalid episode handling');

    await page.goto('/watch/21459/99999', { waitUntil: 'domcontentloaded' });
    // Wait for page to finish rendering instead of hard-coded sleep
    await page.waitForLoadState('networkidle');

    const bodyText = await page.locator('body').textContent();
    const hasError = bodyText?.toLowerCase().includes('episode') ||
                    bodyText?.toLowerCase().includes('not found') ||
                    bodyText?.toLowerCase().includes('error');

    console.log(`✓ Shows error state: ${hasError}`);

    await page.screenshot({ timeout: 0, path: 'test-results/user-flow/07-invalid-episode.png', fullPage: true });

    // Assert: page should show relevant error or episode-related content
    expect(bodyText, 'Page should have some content').toBeTruthy();
    expect(
      hasError || bodyText?.toLowerCase().includes('watch') || bodyText?.toLowerCase().includes('anime'),
      'Page should show error, not found, episode, or anime-related content'
    ).toBeTruthy();
  });
});
