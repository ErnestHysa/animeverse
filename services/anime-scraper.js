/**
 * Anime Scraper Service
 * Automated daily scraper for new anime releases
 *
 * Features:
 * - Fetches airing anime from AniList
 * - Scrapes Nyaa for new episodes
 * - Stores results in database
 * - Runs daily via cron
 *
 * Phase 7: Content Acquisition & Seeding
 *
 * Usage:
 * node services/anime-scraper.js
 *
 * Cron (add to crontab):
 * 0 2 * * * cd /path/to/anime-stream && node services/anime-scraper.js
 */

const fs = require("fs").promises;
const path = require("path");

// Configuration
const CONFIG = {
  anilistGraphqlUrl: "https://graphql.anilist.co",
  magnetsDbPath: path.join(__dirname, "../data/magnets.json"),
  scrapeLogPath: path.join(__dirname, "../data/scrape-log.json"),
  daysToLookBack: 7, // Look back 7 days for new episodes
  maxEpisodesPerAnime: 3, // Only scrape latest 3 episodes
  delayBetweenRequests: 2000, // 2 seconds between requests
};

// ===================================
// AniList API
// ===================================

/**
 * Fetch currently airing anime from AniList
 */
async function fetchAiringAnime() {
  console.log("[AniList] Fetching currently airing anime...");

  const query = `
    query {
      Page(page: 1, perPage: 50) {
        media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC) {
          id
          idMal
          title {
            romaji
            english
            native
          }
          episodes
          nextAiringEpisode {
            episode
            airingAt
          }
          startDate {
            year
            month
            day
          }
          genres
          format
        }
      }
    }
  `;

  try {
    const response = await fetch(CONFIG.anilistGraphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`AniList API Error: ${JSON.stringify(data.errors)}`);
    }

    const animeList = data.data.Page.media;
    console.log(`[AniList] Found ${animeList.length} currently airing anime`);

    return animeList;
  } catch (error) {
    console.error("[AniList] Error fetching airing anime:", error);
    throw error;
  }
}

// ===================================
// Nyaa Scraper
// ===================================

/**
 * Scrape Nyaa.si for anime torrents
 */
async function scrapeNyaa(animeTitle, episode, maxResults = 5) {
  try {
    const searchQuery = `${animeTitle} episode ${episode}`.replace(/\s+/g, " ");
    const searchUrl = `https://nyaa.si/?q=${encodeURIComponent(searchQuery)}&s=seeders&o=desc`;

    console.log(`[Nyaa.si] Searching: ${searchQuery}`);

    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();

    // Parse HTML and extract torrent data
    const torrents = [];
    const rows = [];

    // Extract torrent rows
    let currentRow = "";
    let inRow = false;

    for (const line of html.split("\n")) {
      if (line.includes('<tr class="default"')) {
        inRow = true;
        currentRow = line;
      } else if (inRow) {
        currentRow += line;
        if (line.includes("</tr>")) {
          rows.push(currentRow);
          inRow = false;
          currentRow = "";
        }
      }
    }

    // Parse each row
    for (const row of rows.slice(0, maxResults)) {
      // Extract title
      const titleMatch = row.match(
        /<a[^>]*href="\/view\/\d+"[^>]*title="([^"]+)"/
      );
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Extract magnet link
      const magnetMatch = row.match(/href="(magnet:\?[^"]+)"/);
      if (!magnetMatch) continue;

      const magnet = decodeHtmlEntities(magnetMatch[1]);

      // Extract infoHash
      const infoHashMatch = magnet.match(/xt=urn:btih:([a-fA-F0-9]{40})/i);
      if (!infoHashMatch) continue;

      const infoHash = infoHashMatch[1].toLowerCase();

      // Extract seeders and leechers
      const seedersMatch = row.match(
        /<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/g
      );
      const seeders =
        seedersMatch && seedersMatch.length >= 2
          ? parseInt(
              seedersMatch[seedersMatch.length - 2].replace(
                /<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/,
                "$1"
              )
            )
          : 0;
      const leechers =
        seedersMatch && seedersMatch.length >= 1
          ? parseInt(
              seedersMatch[seedersMatch.length - 1].replace(
                /<td[^>]*class="[^"]*text-center[^"]*"[^>]*>(\d+)<\/td>/,
                "$1"
              )
            )
          : 0;

      // Extract quality
      const quality = extractQuality(title);

      torrents.push({
        magnet,
        infoHash,
        title,
        quality,
        seeders,
        leechers,
        provider: "nyaa",
      });
    }

    console.log(`[Nyaa.si] Found ${torrents.length} torrents for ${animeTitle} E${episode}`);
    return torrents;
  } catch (error) {
    console.error(`[Nyaa.si] Error scraping ${animeTitle} E${episode}:`, error);
    return [];
  }
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text) {
  const entities = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };

  return text.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Extract quality from title
 */
function extractQuality(title) {
  const qualityPatterns = [
    /\b(2160p|4K)\b/i,
    /\b(1080p|Full.?HD)\b/i,
    /\b(720p|HD)\b/i,
    /\b(480p|SD)\b/i,
    /\b(360p)\b/i,
  ];

  for (const pattern of qualityPatterns) {
    const match = title.match(pattern);
    if (match) {
      return match[1].toLowerCase().replace("full.hd", "1080p");
    }
  }

  return "unknown";
}

// ===================================
// Database Operations
// ===================================

/**
 * Read magnets database
 */
async function readMagnetsDatabase() {
  try {
    const content = await fs.readFile(CONFIG.magnetsDbPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // Initialize if doesn't exist
    return { magnets: [], lastUpdated: Date.now() };
  }
}

/**
 * Write magnets database
 */
async function writeMagnetsDatabase(data) {
  data.lastUpdated = Date.now();
  await fs.writeFile(
    CONFIG.magnetsDbPath,
    JSON.stringify(data, null, 2)
  );
}

/**
 * Add magnet to database if not exists
 */
async function addMagnetIfNotExists(anime, episode, torrent) {
  const db = await readMagnetsDatabase();

  // Check for duplicate infoHash
  const existing = db.magnets.find((m) => m.infoHash === torrent.infoHash);
  if (existing) {
    console.log(
      `[DB] Magnet already exists: ${anime.title.romaji} E${episode}`
    );
    return { added: false, reason: "duplicate" };
  }

  // Check for duplicate anime + episode + quality
  const duplicateEpisode = db.magnets.find(
    (m) =>
      m.animeId === anime.id &&
      m.episode === episode &&
      m.quality === torrent.quality
  );
  if (duplicateEpisode) {
    console.log(
      `[DB] Episode+quality already exists: ${anime.title.romaji} E${episode} ${torrent.quality}`
    );
    return { added: false, reason: "duplicate_episode" };
  }

  // Create magnet entry
  const now = Date.now();
  const newMagnet = {
    id: `${anime.id}-${episode}-${torrent.infoHash.substring(0, 8)}`,
    animeId: anime.id,
    animeTitle: anime.title.romaji || anime.title.english || `Anime ${anime.id}`,
    episode,
    magnet: torrent.magnet,
    infoHash: torrent.infoHash,
    quality: torrent.quality,
    seeders: torrent.seeders,
    leechers: torrent.leechers,
    provider: "scraper",
    status: torrent.seeders > 0 ? "active" : "pending",
    lastChecked: now,
    createdAt: now,
    updatedAt: now,
    submittedBy: "anime-scraper",
  };

  db.magnets.push(newMagnet);
  await writeMagnetsDatabase(db);

  console.log(
    `[DB] Added magnet: ${anime.title.romaji} E${episode} ${torrent.quality} (${torrent.seeders} seeders)`
  );

  return { added: true, magnet: newMagnet };
}

// ===================================
// Scrape Log
// ===================================

/**
 * Read scrape log
 */
async function readScrapeLog() {
  try {
    const content = await fs.readFile(CONFIG.scrapeLogPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    return { lastRun: 0, runs: [] };
  }
}

/**
 * Write scrape log
 */
async function writeScrapeLog(log) {
  await fs.writeFile(CONFIG.scrapeLogPath, JSON.stringify(log, null, 2));
}

// ===================================
// Main Scraper Function
// ===================================

/**
 * Delay helper
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main scraper execution
 */
async function runScraper() {
  const startTime = Date.now();
  console.log("=".repeat(60));
  console.log("Anime Scraper Started");
  console.log("=".repeat(60));

  try {
    // Fetch airing anime
    const animeList = await fetchAiringAnime();

    // Read scrape log
    const scrapeLog = await readScrapeLog();
    const lastRun = scrapeLog.lastRun || 0;
    const lastRunDate = new Date(lastRun);

    console.log(`\n[Info] Last run: ${lastRunDate.toISOString()}`);

    // Statistics
    const stats = {
      totalAnime: animeList.length,
      scraped: 0,
      added: 0,
      duplicates: 0,
      errors: 0,
    };

    // Scrape each anime
    for (const anime of animeList) {
      try {
        // Determine which episodes to scrape
        const episodesToScrape = [];

        // Get current episode from next airing
        if (anime.nextAiringEpisode) {
          const nextEpisode = anime.nextAiringEpisode.episode;
          // Scrape current episode and 2 previous
          for (let i = Math.max(1, nextEpisode - CONFIG.maxEpisodesPerAnime); i < nextEpisode; i++) {
            episodesToScrape.push(i);
          }
        }

        // Skip if no episodes to scrape
        if (episodesToScrape.length === 0) {
          console.log(`\n[Skip] ${anime.title.romaji}: No new episodes`);
          continue;
        }

        console.log(`\n[Scrape] ${anime.title.romaji}`);
        console.log(`[Info] Episodes: ${episodesToScrape.join(", ")}`);

        // Scrape each episode
        for (const episode of episodesToScrape) {
          try {
            // Search using both romaji and english titles
            const searchTitles = [anime.title.romaji];
            if (anime.title.english) {
              searchTitles.push(anime.title.english);
            }

            let torrents = [];
            for (const title of searchTitles) {
              const results = await scrapeNyaa(title, episode, 3);
              torrents = torrents.concat(results);
              await delay(CONFIG.delayBetweenRequests);
            }

            // Remove duplicates by infoHash
            const uniqueTorrents = [];
            const seenHashes = new Set();
            for (const torrent of torrents) {
              if (!seenHashes.has(torrent.infoHash)) {
                seenHashes.add(torrent.infoHash);
                uniqueTorrents.push(torrent);
              }
            }

            // Sort by seeders (descending)
            uniqueTorrents.sort((a, b) => b.seeders - a.seeders);

            // Add to database
            for (const torrent of uniqueTorrents.slice(0, 2)) {
              // Only add top 2 per episode
              const result = await addMagnetIfNotExists(anime, episode, torrent);
              if (result.added) {
                stats.added++;
              } else {
                stats.duplicates++;
              }
            }

            stats.scraped++;
          } catch (error) {
            console.error(
              `[Error] Failed to scrape ${anime.title.romaji} E${episode}:`,
              error.message
            );
            stats.errors++;
          }

          // Delay between episodes
          await delay(CONFIG.delayBetweenRequests);
        }

        // Delay between anime
        await delay(CONFIG.delayBetweenRequests);
      } catch (error) {
        console.error(`[Error] Failed to process ${anime.title.romaji}:`, error.message);
        stats.errors++;
      }
    }

    // Update scrape log
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const runLog = {
      timestamp: endTime,
      duration: parseFloat(duration),
      stats,
    };

    scrapeLog.lastRun = endTime;
    scrapeLog.runs = scrapeLog.runs || [];
    scrapeLog.runs.push(runLog);

    // Keep only last 30 runs
    if (scrapeLog.runs.length > 30) {
      scrapeLog.runs = scrapeLog.runs.slice(-30);
    }

    await writeScrapeLog(scrapeLog);

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("Scrape Summary");
    console.log("=".repeat(60));
    console.log(`Total Anime:       ${stats.totalAnime}`);
    console.log(`Scraped:           ${stats.scraped}`);
    console.log(`Magnets Added:     ${stats.added}`);
    console.log(`Duplicates:        ${stats.duplicates}`);
    console.log(`Errors:            ${stats.errors}`);
    console.log(`Duration:          ${duration}s`);
    console.log("=".repeat(60));
  } catch (error) {
    console.error("[Fatal] Scraper failed:", error);
    process.exit(1);
  }
}

// Run scraper
runScraper()
  .then(() => {
    console.log("\n[Success] Scraper completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n[Error] Scraper failed:", error);
    process.exit(1);
  });
