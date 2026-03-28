/**
 * Fast Video Sources Scraper
 * Optimized for speed - uses direct patterns and minimal navigation
 */

import { chromium } from 'playwright';

export interface VideoSource {
  url: string;
  quality: "360p" | "480p" | "720p" | "1080p" | "auto";
  label: string;
  provider: string;
  type: "mp4" | "hls";
}

export interface EpisodeSources {
  animeId: number;
  episodeNumber: number;
  sources: VideoSource[];
  subtitles?: SubtitleSource[];
  provider: string;
  referer?: string;
  isFallback?: boolean;
}

export interface SubtitleSource {
  url: string;
  language: string;
  label: string;
  isDefault?: boolean;
}

// Known working anime episode URL patterns
// Note: These domains change frequently. Try multiple mirrors.
const GOGOANIME_DOMAINS = [
  'www14.gogoanimes.fi',
  'gogoanime3.net',
  'gogoanime.pe',
  'gogoanimehd.to',
  'anitaku.pe',        // Alternative domain
  'gogoanime.ar',
  'gogoanime.lu',       // New domain
  'www.gogoanimes.fi',  // Without subdomain
];

// Helper to try multiple domains with timeout
async function tryDomain(
  domain: string,
  animeSlug: string,
  episodeNumber: number,
  timeoutMs: number = 10000 // Reduced from 15000 for faster fallback
): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Set shorter timeout
    page.setDefaultTimeout(timeoutMs);

    // Try direct episode URL
    const episodeUrl = `https://${domain}/${animeSlug}-episode-${episodeNumber}`;

    await page.goto(episodeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait a bit for page to load
    await page.waitForTimeout(2000);

    // Look for iframe
    const iframe = page.locator('iframe').first();
    const count = await iframe.count();

    if (count > 0) {
      const iframeSrc = await iframe.getAttribute('src');
      await browser.close();
      return iframeSrc || null;
    }

    await browser.close();
    return null;
  } catch {
    await browser.close();
    return null;
  }
}

// Extract m3u8 URL from iframe page
async function extractFromIframe(iframeUrl: string, timeoutMs: number = 10000): Promise<string | null> {
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);

    const m3u8Urls: string[] = [];

    // Capture network requests
    page.on('response', (resp) => {
      const url = resp.url();
      if (url.includes('.m3u8') && !url.includes('ping.gif') && !url.includes('/segment')) {
        m3u8Urls.push(url);
      }
    });

    await page.goto(iframeUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs,
    });

    // Wait for video player to initialize
    await page.waitForTimeout(3000); // Reduced from 5000

    await browser.close();

    // Return master.m3u8 if available, otherwise first m3u8
    const master = m3u8Urls.find(u => u.includes('master.m3u8'));
    return master || m3u8Urls[0] || null;
  } catch {
    await browser.close();
    return null;
  }
}

// Generate multiple slug variations for better matching
function generateSlugVariations(title: string): string[] {
  const slugs: string[] = [];

  // Basic slug (english words with hyphens)
  const basicSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  if (basicSlug) slugs.push(basicSlug);

  // Remove special characters more aggressively
  const cleanSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  if (cleanSlug && cleanSlug !== basicSlug) slugs.push(cleanSlug);

  // Remove "the" prefix
  const noThe = title.replace(/^the\s+/i, '');
  if (noThe !== title) {
    const noTheSlug = noThe
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    if (noTheSlug) slugs.push(noTheSlug);
  }

  // Remove season/episode suffixes
  const seasonClean = title
    .replace(/season\s*\d+/gi, '')
    .replace(/\d+(nd|rd|th|st)\s*season/gi, '')
    .replace(/:\s*.*$/g, '')
    .trim();
  if (seasonClean && seasonClean !== title) {
    const seasonSlug = seasonClean
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    if (seasonSlug) slugs.push(seasonSlug);
  }

  // Dedupe while preserving order
  return Array.from(new Set(slugs));
}

// Fast scraper - tries direct patterns first
async function scrapeFast(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  console.log(`[FastScraper] Fetching: ${title} - Episode ${episodeNumber}`);

  // Generate multiple slug variations
  const slugs = generateSlugVariations(title);
  console.log(`[FastScraper] Generated ${slugs.length} slug variations:`, slugs);

  // Try each slug variation across all domains (interleaved for faster success)
  for (const slug of slugs) {
    for (const domain of GOGOANIME_DOMAINS) {
      console.log(`[FastScraper] Trying ${domain} with slug: ${slug}`);

      try {
        const iframeSrc = await tryDomain(domain, slug, episodeNumber, 8000);

        if (iframeSrc) {
          console.log(`[FastScraper] ✓ Found iframe on ${domain}`);

          const fullIframeUrl = iframeSrc.startsWith('http')
            ? iframeSrc
            : `https:${iframeSrc}`;

          console.log(`[FastScraper] Extracting video from iframe...`);

          const m3u8Url = await extractFromIframe(fullIframeUrl, 8000);

          if (m3u8Url) {
            console.log(`[FastScraper] ✓✓ Success! Found video source: ${m3u8Url.substring(0, 50)}...`);

            return {
              animeId,
              episodeNumber,
              sources: [{
                url: m3u8Url,
                quality: 'auto',
                label: 'Gogoanime Server',
                provider: 'Gogoanime',
                type: 'hls',
              }],
              subtitles: [], // Gogoanime has hard-subbed videos (no separate subtitle files)
              provider: 'Gogoanime',
              referer: `https://${domain}/`,
            };
          }
        }
      } catch (error) {
        console.log(`[FastScraper] ${domain}/${slug} failed: ${(error as Error).message}`);
      }
    }
  }

  console.log('[FastScraper] All slug and domain combinations failed');
  return null;
}

// Search-based scraper - finds the anime via search page first
async function scrapeWithSearch(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  console.log(`[SearchScraper] Searching for: ${title}`);

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });

    const page = await context.newPage();

    // Try multiple search terms
    const searchTerms = [title, title.replace(/:/g, ''), title.replace(/\s*\(.*?\)\s*/g, '')];

    for (const searchTerm of searchTerms) {
      console.log(`[SearchScraper] Searching for: ${searchTerm}`);

      const searchUrl = `https://www14.gogoanimes.fi/search.html?keyword=${encodeURIComponent(searchTerm)}`;
      await page.goto(searchUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 12000,
      });

      await page.waitForTimeout(1000);

      // Look for anime link (various selectors)
      const animeLink = page.locator('a[href*="/category/"]').first();
      const count = await animeLink.count();

      if (count > 0) {
        const href = await animeLink.getAttribute('href');
        const animeUrl = href?.startsWith('http') ? href : `https://www14.gogoanimes.fi${href}`;

        console.log(`[SearchScraper] Found anime page: ${animeUrl}`);

        // Navigate to anime page
        await page.goto(animeUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 12000,
        });

        await page.waitForTimeout(1000);

        // Try to find the specific episode
        const epLink = page.locator(`a[href*="-episode-${episodeNumber}"]`).first();
        const epCount = await epLink.count();

        let watchUrl = '';
        if (epCount > 0) {
          const epHref = await epLink.getAttribute('href');
          watchUrl = epHref?.startsWith('http') ? epHref : `https://www14.gogoanimes.fi${epHref}`;
        } else {
          // Try first available episode
          const firstEp = page.locator('a[href*="-episode-"]').first();
          const firstCount = await firstEp.count();
          if (firstCount > 0) {
            const firstHref = await firstEp.getAttribute('href');
            watchUrl = firstHref?.startsWith('http') ? firstHref : `https://www14.gogoanimes.fi${firstHref}`;
          }
        }

        if (watchUrl) {
          console.log(`[SearchScraper] Navigating to episode page: ${watchUrl}`);
          await page.goto(watchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 12000,
          });

          await page.waitForTimeout(2000);

          // Get iframe
          const iframe = page.locator('iframe').first();
          const iframeCount = await iframe.count();

          if (iframeCount > 0) {
            const iframeSrc = await iframe.getAttribute('src');

            if (iframeSrc) {
              const fullIframeUrl = iframeSrc.startsWith('http') ? iframeSrc : `https:${iframeSrc}`;

              const m3u8Urls: string[] = [];

              // Create new page for iframe
              const iframePage = await context.newPage();

              iframePage.on('response', (resp) => {
                const url = resp.url();
                if (url.includes('.m3u8') && !url.includes('ping.gif') && !url.includes('/segment')) {
                  m3u8Urls.push(url);
                }
              });

              await iframePage.goto(fullIframeUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 12000,
              });

              await iframePage.waitForTimeout(4000);

              await browser.close();

              const master = m3u8Urls.find(u => u.includes('master.m3u8'));
              const m3u8Url = master || m3u8Urls[0];

              if (m3u8Url) {
                console.log(`[SearchScraper] ✓ Success! Found: ${m3u8Url.substring(0, 60)}...`);

                return {
                  animeId,
                  episodeNumber,
                  sources: [{
                    url: m3u8Url,
                    quality: 'auto',
                    label: 'Gogoanime Server',
                    provider: 'Gogoanime',
                    type: 'hls',
                  }],
                  subtitles: [], // Gogoanime has hard-subbed videos
                  provider: 'Gogoanime',
                  referer: 'https://www14.gogoanimes.fi/',
                };
              }
            }
          }
        }
      }
    }

    await browser.close();
    return null;
  } catch (error) {
    console.log('[SearchScraper] Error:', error);
    await browser.close();
    return null;
  }
}

// Main export function
export async function getEpisodeSources(
  animeId: number,
  episodeNumber: number,
  options: {
    title?: string;
    malId?: number | null;
    language?: 'sub' | 'dub';
  } = {}
): Promise<EpisodeSources> {
  const { title = `Anime ${animeId}` } = options;

  console.log(`[VideoSources] Fetching: ${title} - Episode ${episodeNumber}`);

  // Add overall timeout to prevent waiting too long
  const SCRAPER_TIMEOUT = 28000; // 28 seconds max for all scraping attempts

  // Create a timeout promise that rejects after SCRAPER_TIMEOUT
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Scraping timeout')), SCRAPER_TIMEOUT);
  });

  // Try search-based scraper first (more reliable)
  try {
    console.log('[VideoSources] Attempting search-based scraper...');
    const result = await Promise.race([
      scrapeWithSearch(animeId, episodeNumber, title),
      timeoutPromise
    ]);
    if (result) {
      return result;
    }
  } catch (error) {
    console.log('[VideoSources] Search scraper failed:', error);
  }

  // Try fast scraper (direct URL patterns) as fallback
  try {
    console.log('[VideoSources] Attempting fast scraper with direct patterns...');
    const result = await Promise.race([
      scrapeFast(animeId, episodeNumber, title),
      timeoutPromise
    ]);
    if (result) {
      return result;
    }
  } catch (error) {
    console.log('[VideoSources] Fast scraper failed:', error);
  }

  // Return demo
  console.warn('[VideoSources] All scrapers failed, using demo video');
  return getDemoSources(animeId, episodeNumber);
}

function getDemoSources(animeId: number, episodeNumber: number): EpisodeSources {
  return {
    animeId,
    episodeNumber,
    sources: [{
      // Use a reliable HLS test stream from Bitmovin (known to work without CORS issues)
      url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
      quality: 'auto',
      label: 'Demo (Sintel Test)',
      provider: 'Demo',
      type: 'hls',
    }],
    subtitles: [],
    provider: 'Demo',
    isFallback: true,
  };
}

// Export getDemoSources for API route to use on timeout
export { getDemoSources };

export async function getAvailableLanguages() {
  return [
    { type: 'sub', available: true },
    { type: 'dub', available: false },
  ];
}

export async function searchAnime(query: string) {
  return [];
}
