/**
 * Robust Video Sources Implementation
 * Multi-strategy video source fetching with comprehensive fallback
 * Production-ready with proper error handling and logging
 */

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

// ============================================
// Configuration
// ============================================

const CONFIG = {
  requestTimeout: 8000,  // 8 seconds per API
  totalTimeout: 14000,   // 14 seconds total
  maxRetries: 2,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// ============================================
// In-Memory Cache (avoid repeated failed requests)
// ============================================

const sourceCache = new Map<string, { data: EpisodeSources | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(animeId: number, episodeNumber: number): EpisodeSources | null {
  const key = `${animeId}-${episodeNumber}`;
  const cached = sourceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    // Move to end for LRU access order (Map preserves insertion order)
    sourceCache.delete(key);
    sourceCache.set(key, cached);
    return cached.data;
  }
  return null;
}

function setCached(animeId: number, episodeNumber: number, data: EpisodeSources | null): void {
  const key = `${animeId}-${episodeNumber}`;
  // Delete first to move to end (update insertion order)
  sourceCache.delete(key);
  sourceCache.set(key, { data, timestamp: Date.now() });
  // Evict least-recently-used entries if cache exceeds max size
  if (sourceCache.size > 200) {
    const keys = Array.from(sourceCache.keys());
    for (let i = 0; i < 50 && i < keys.length; i++) {
      sourceCache.delete(keys[i]);
    }
  }
}

// ============================================
// Logger (Production-ready)
// ============================================

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

function log(level: LogLevel, message: string, data?: unknown): void {
  // In production, only log errors and warnings
  // In development, log everything
  if (process.env.NODE_ENV === 'production') {
    if (level === 'error' || level === 'warn') {
      console[level](`[VideoSources] ${message}`, data ?? '');
    }
  } else {
    console[level](`[VideoSources] ${message}`, data ?? '');
  }
}

// ============================================
// Demo/Test Streams (Always available)
// ============================================

const DEMO_STREAMS: VideoSource[] = [
  {
    // High-quality test stream (Sintel animation)
    url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    quality: 'auto',
    label: 'Demo (Sintel Animation)',
    provider: 'Demo',
    type: 'hls',
  },
  {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    quality: 'auto',
    label: 'Demo (Big Buck Bunny)',
    provider: 'Demo',
    type: 'hls',
  },
  {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    quality: 'auto',
    label: 'Demo (Apple Test)',
    provider: 'Demo',
    type: 'hls',
  },
];

// ============================================
// Utility Functions
// ============================================

/**
 * Fetch with timeout and proper error handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = CONFIG.requestTimeout
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': CONFIG.userAgent,
        ...options.headers,
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    } else {
      throw error;
    }
  }
}

/**
 * Map quality string to our format
 */
function mapQuality(quality: string): VideoSource['quality'] {
  const q = quality.toLowerCase();
  if (q.includes('1080')) return '1080p';
  if (q.includes('720')) return '720p';
  if (q.includes('480')) return '480p';
  if (q.includes('360')) return '360p';
  return 'auto';
}

/**
 * Sanitize title for URL generation
 */
function sanitizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim()
    .substring(0, 80);
}

// ============================================
// API Source Implementations
// ============================================

/**
 * Strategy 1: Anify API
 * Modern anime API with good uptime
 */
async function fetchFromAnify(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    log('info', `Trying Anify API for: ${title}`);

    // Anify API endpoints
    const searchUrl = `https://api.anify.tv/search-anime/${encodeURIComponent(title)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, {}, 8000);

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();

    if (!searchData || searchData.length === 0) {
      return null;
    }

    const firstResult = searchData[0];
    const anilistId = firstResult.id;

    // Get episode sources
    const sourcesUrl = `https://api.anify.tv/sources?anilistId=${anilistId}&episodeNumber=${episodeNumber}&subType=sub`;
    const sourcesResponse = await fetchWithTimeout(sourcesUrl, {}, 10000);

    if (!sourcesResponse.ok) {
      return null;
    }

    const sourcesData = await sourcesResponse.json();

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      return null;
    }

    // Map sources to our format
    const sources: VideoSource[] = sourcesData.sources
      .filter((s: any) => s.url && !s.url.includes('delay'))
      .map((s: any) => ({
        url: s.url,
        quality: mapQuality(s.quality || 'default'),
        label: `${s.provider || 'Server'} - ${s.quality || 'default'}`,
        provider: s.provider || 'Anify',
        type: s.url.includes('.m3u8') ? 'hls' : 'mp4',
      }));

    return {
      animeId,
      episodeNumber,
      sources,
      subtitles: sourcesData.subtitles?.map((sub: any) => ({
        url: sub.url,
        language: sub.lang || 'english',
        label: sub.label || 'English',
      })) || [],
      provider: 'Anify',
      referer: sourcesData.headers?.Referer,
    };
  } catch (error) {
    log('error', 'Anify API error', error);
    return null;
  }
}

/**
 * Strategy 2: Consumet API
 * Popular anime scraping API
 */
async function fetchFromConsumet(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    log('info', `Trying Consumet API for: ${title}`);

    const searchQuery = sanitizeTitle(title);
    const searchUrl = `https://api.consumet.org/anime/gogoanime/${encodeURIComponent(searchQuery)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, {}, 8000);

    if (!searchResponse.ok) {
      return null;
    }

    const searchData = await searchResponse.json();

    if (!searchData || !searchData.results || searchData.results.length === 0) {
      return null;
    }

    const firstResult = searchData.results[0];
    const animeIdFromApi = firstResult.id;

    // Get episode sources
    const episodeId = `${animeIdFromApi}-episode-${episodeNumber}`;
    const sourcesUrl = `https://api.consumet.org/anime/gogoanime/watch/${episodeId}`;
    const sourcesResponse = await fetchWithTimeout(sourcesUrl, {}, 10000);

    if (!sourcesResponse.ok) {
      return null;
    }

    const sourcesData = await sourcesResponse.json();

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      return null;
    }

    // Map sources
    const sources: VideoSource[] = sourcesData.sources
      .filter((s: any) => s.file && !s.file.includes('delay'))
      .map((s: any) => ({
        url: s.file,
        quality: mapQuality(s.quality || 'default'),
        label: `${s.server || 'Server'} - ${s.quality || 'default'}`,
        provider: 'Consumet (Gogoanime)',
        type: s.file.includes('.m3u8') ? 'hls' : 'mp4',
      }));

    // Prefer non-encrypted sources
    const normal = sources.filter(s => !s.label.toLowerCase().includes('encrypted'));

    return {
      animeId,
      episodeNumber,
      sources: normal.length > 0 ? normal : sources,
      subtitles: sourcesData.subtitles?.map((sub: any) => ({
        url: sub.url,
        language: sub.lang || 'english',
        label: sub.label || 'English',
      })) || [],
      provider: 'Consumet (Gogoanime)',
      referer: 'https://gogoanimehd.to/',
    };
  } catch (error) {
    log('error', 'Consumet API error', error);
    return null;
  }
}

/**
 * Strategy 3: Direct URL patterns for known sources
 * Uses common URL patterns for gogoanime mirrors
 */
async function fetchFromDirectPatterns(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    log('info', `Trying direct URL patterns for: ${title}`);

    const slug = sanitizeTitle(title);

    // List of potential gogoanime mirrors
    const domains = [
      'gogoanimehd.to',
      'anitaku.pe',
      'gogoanime.pe',
      'gogoanime.ar',
      'gogoanime.lu',
    ];

    // Try all domains in parallel for faster resolution
    const results = await Promise.allSettled(
      domains.map(async (domain) => {
        const iframeUrl = `https://${domain}/streaming.php?id=${slug}-${episodeNumber}`;
        const response = await fetchWithTimeout(iframeUrl, {}, 5000);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from ${domain}`);
        }

        const text = await response.text();
        const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/g;
        const matches = text.match(m3u8Regex);

        if (matches && matches.length > 0) {
          const validMatches = matches.filter(url =>
            !url.includes('segment') &&
            !url.includes('ping.gif') &&
            !url.includes('.ts')
          );

          if (validMatches.length > 0) {
            const m3u8Url = validMatches.find(u => u.includes('master.m3u8')) || validMatches[0];
            return {
              animeId,
              episodeNumber,
              sources: [{
                url: m3u8Url,
                quality: 'auto' as const,
                label: `Direct Stream (${domain})`,
                provider: 'Direct',
                type: 'hls' as const,
              }],
              subtitles: [],
              provider: `Direct (${domain})`,
              referer: `https://${domain}/`,
            };
          }
        }

        throw new Error(`No m3u8 found on ${domain}`);
      })
    );

    // Return the first successful result
    for (const result of results) {
      if (result.status === 'fulfilled') {
        return result.value;
      }
    }

    return null;
  } catch (error) {
    log('error', 'Direct patterns error', error);
    return null;
  }
}

/**
 * Strategy 4: Iframe embed providers
 * Many anime sites use embeddable iframe players
 */
async function fetchFromIframeProviders(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    log('info', `Trying iframe providers for: ${title}`);

    const slug = sanitizeTitle(title);

    // List of iframe providers that commonly work
    const providers = [
      {
        name: 'Vizcloud',
        pattern: (slug: string, ep: number) =>
          `https://vidcloud.co/embed?anime=${slug}&episode=${ep}`,
      },
      {
        name: 'Gogo-player',
        pattern: (slug: string, ep: number) =>
          `https://gogo-player.net/vidstreaming.php?anime=${slug}&episode=${ep}`,
      },
    ];

    for (const provider of providers) {
      const embedUrl = provider.pattern(slug, episodeNumber);

      // Check if embed is accessible (HEAD request)
      const response = await fetchWithTimeout(embedUrl, { method: 'HEAD' }, 5000);

      if (response.ok) {
        // Return iframe embed as a source
        return {
          animeId,
          episodeNumber,
          sources: [{
            url: embedUrl,
            quality: 'auto',
            label: `${provider.name} Embed`,
            provider: provider.name,
            type: 'mp4', // Will be handled as iframe
          }],
          subtitles: [],
          provider: provider.name,
          referer: undefined,
        };
      }
    }

    return null;
  } catch (error) {
    log('error', 'Iframe providers error', error);
    return null;
  }
}

/**
 * Strategy 5: Anilist to external mapping
 * Uses Anilist ID to find external sources
 */
async function fetchFromAnilistMapping(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    log('info', `Trying Anilist mapping for: ${title}`);

    // Get Anilist data first
    const anilistUrl = 'https://graphql.anilist.co';
    const query = `
      query {
        Media(id: ${animeId}, type: ANIME) {
          id
          idMal
          title { romaji english native }
          synonyms
        }
      }
    `;

    const response = await fetchWithTimeout(
      anilistUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      },
      8000
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const media = data?.data?.Media;

    if (!media) {
      return null;
    }

    const malId = media.idMal;
    const titles = [
      media.title?.romaji,
      media.title?.english,
      media.title?.native,
      ...(media.synonyms || []),
    ].filter(Boolean);

    // Try each title with other strategies
    for (const tryTitle of titles) {
      const result = await fetchFromConsumet(animeId, episodeNumber, tryTitle);
      if (result && !result.isFallback) {
        return result;
      }
    }

    return null;
  } catch (error) {
    log('error', 'Anilist mapping error', error);
    return null;
  }
}

// ============================================
// Main Export Functions
// ============================================

/**
 * Get episode sources with multiple fallback strategies
 * Tries each strategy in order until one succeeds
 */
export async function getEpisodeSources(
  animeId: number,
  episodeNumber: number,
  options: {
    title?: string;
    malId?: number | null;
    language?: 'sub' | 'dub';
  } = {}
): Promise<EpisodeSources> {
  const { title = `Anime ${animeId}`, language = 'sub' } = options;

  log('info', `Fetching sources: ${title} - Episode ${episodeNumber} (${language})`);

  // Check cache first
  const cached = getCached(animeId, episodeNumber);
  if (cached) {
    log('info', `Returning cached result for ${title} - Episode ${episodeNumber}`);
    return cached;
  }

  // List of strategies to try in order
  const strategies = [
    { name: 'Anify', fn: fetchFromAnify },
    { name: 'Consumet', fn: fetchFromConsumet },
    { name: 'Iframe Providers', fn: fetchFromIframeProviders },
    { name: 'Direct Patterns', fn: fetchFromDirectPatterns },
    { name: 'Anilist Mapping', fn: fetchFromAnilistMapping },
  ];

  // Try each strategy with timeout
  for (const strategy of strategies) {
    try {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const result = await Promise.race([
        strategy.fn(animeId, episodeNumber, title),
        new Promise<null>((resolve) => {
          timeoutId = setTimeout(() => {
            log('warn', `${strategy.name} strategy timeout`);
            resolve(null);
          }, CONFIG.requestTimeout);
        }),
      ]);
      if (timeoutId) clearTimeout(timeoutId);

      if (result && result.sources.length > 0) {
        log('info', `Success using ${strategy.name}`);
        setCached(animeId, episodeNumber, result);
        return result;
      }
    } catch (error) {
      log('error', `${strategy.name} failed`, error);
    }
  }

  // All strategies failed - return demo
  log('warn', 'All strategies failed, returning demo video');
  const demoResult = getDemoSources(animeId, episodeNumber, title);
  setCached(animeId, episodeNumber, demoResult);
  return demoResult;
}

/**
 * Get demo sources (fallback)
 */
export function getDemoSources(
  animeId: number,
  episodeNumber: number,
  title?: string
): EpisodeSources {
  return {
    animeId,
    episodeNumber,
    sources: DEMO_STREAMS.map(s => ({ ...s })),
    subtitles: [],
    provider: 'Demo',
    isFallback: true,
  };
}

/**
 * Get available languages for an anime
 */
export async function getAvailableLanguages(): Promise<
  Array<{ type: 'sub' | 'dub'; available: boolean }>
> {
  return [
    { type: 'sub', available: true },
    { type: 'dub', available: false }, // Most sources only have sub
  ];
}

/**
 * Search for anime by title
 */
export async function searchAnime(query: string): Promise<Array<{
  id: number;
  title: string;
  image?: string;
  year?: number;
}>> {
  try {
    const anilistUrl = 'https://graphql.anilist.co';
    const searchQuery = `
      query ($search: String) {
        Page(page: 1, perPage: 10) {
          media(search: $search, type: ANIME, sort: POPULARITY_DESC) {
            id
            title { romaji english }
            coverImage { large }
            seasonYear
          }
        }
      }
    `;

    const response = await fetchWithTimeout(
      anilistUrl,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, variables: { search: query } }),
      },
      10000
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const media = data?.data?.Page?.media || [];

    return media.map((m: any) => ({
      id: m.id,
      title: m.title?.romaji || m.title?.english || '',
      image: m.coverImage?.large,
      year: m.seasonYear,
    }));
  } catch (error) {
    log('error', 'Search error', error);
    return [];
  }
}

export async function reportBrokenVideo(data: {
  animeId: number;
  episodeNumber: number;
  source: string;
  issue: string;
}): Promise<void> {
  if (typeof window !== "undefined") {
    const MAX_REPORTS = 100;
    const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

    let reports: Array<{
      animeId: number;
      episodeNumber: number;
      reason: string;
      timestamp: number;
      source: string;
    }>;
    try {
      reports = JSON.parse(localStorage.getItem("video-reports") || "[]");
    } catch {
      localStorage.removeItem("video-reports");
      reports = [];
    }

    const now = Date.now();

    // Remove expired entries (older than 30 days)
    const validReports = reports.filter(r => now - r.timestamp < EXPIRY_MS);

    // Deduplicate by source + issue combination
    const isDuplicate = validReports.some(
      r => r.source === data.source && r.reason === data.issue && r.animeId === data.animeId && r.episodeNumber === data.episodeNumber
    );

    if (!isDuplicate) {
      validReports.push({
        animeId: data.animeId,
        episodeNumber: data.episodeNumber,
        reason: data.issue,
        timestamp: now,
        source: data.source,
      });
    }

    // FIFO eviction if over max limit
    const finalReports = validReports.length > MAX_REPORTS
      ? validReports.slice(validReports.length - MAX_REPORTS)
      : validReports;

    localStorage.setItem("video-reports", JSON.stringify(finalReports));
  }
}
