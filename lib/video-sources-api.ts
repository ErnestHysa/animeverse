/**
 * API-Based Video Sources
 * Uses a combination of known working APIs and direct sources
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
// Known Working Video Sources
// ============================================

/**
 * These are public test streams that always work
 * Used as fallback when anime sources fail
 * Updated with more reliable streams (avoiding 403 errors)
 */
const TEST_STREAMS: VideoSource[] = [
  {
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    quality: 'auto',
    label: 'Demo Stream (Big Buck Bunny)',
    provider: 'Demo',
    type: 'hls',
  },
  {
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    quality: 'auto',
    label: 'Demo Stream (Apple Test)',
    provider: 'Demo',
    type: 'hls',
  },
  {
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    quality: 'auto',
    label: 'Demo Stream (Tears of Steel)',
    provider: 'Demo',
    type: 'hls',
  },
];

// ============================================
// API Implementations
// ============================================

/**
 * Fetch with timeout and error handling
 */
async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    return null;
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
 * Try to fetch from consumet API (gogoanime source)
 */
async function fetchFromConsumet(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    console.log('[Consumet] Searching for anime...');

    // First, try to search for the anime
    const searchQuery = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    const searchUrl = `https://api.consumet.org/anime/gogoanime/${encodeURIComponent(searchQuery)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, 5000);

    if (!searchResponse || !searchResponse.ok) {
      console.log('[Consumet] Search failed');
      return null;
    }

    const searchData = await searchResponse.json();

    if (!searchData || !searchData.results || searchData.results.length === 0) {
      console.log('[Consumet] No search results');
      return null;
    }

    // Get the first result
    const firstResult = searchData.results[0];
    const animeIdFromApi = firstResult.id;

    console.log(`[Consumet] Found anime: ${firstResult.title} (${animeIdFromApi})`);

    // Now get episode sources
    const episodeId = `${animeIdFromApi}-episode-${episodeNumber}`;
    const sourcesUrl = `https://api.consumet.org/anime/gogoanime/watch/${episodeId}`;
    const sourcesResponse = await fetchWithTimeout(sourcesUrl, 10000);

    if (!sourcesResponse || !sourcesResponse.ok) {
      console.log('[Consumet] Sources fetch failed');
      return null;
    }

    const sourcesData = await sourcesResponse.json();

    if (!sourcesData || !sourcesData.sources || sourcesData.sources.length === 0) {
      console.log('[Consumet] No sources found');
      return null;
    }

    // Map sources to our format
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
    const encrypted = sources.filter(s => s.label.toLowerCase().includes('encrypted'));
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
    console.log('[Consumet] Error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Try to fetch from Zoro/HiAnime API
 */
async function fetchFromZoro(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    console.log('[Zoro] Searching for anime...');

    // Search for the anime
    const searchQuery = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim();

    // Zoro API endpoint (using their search)
    const searchUrl = `https://hianime.to/search?keyword=${encodeURIComponent(searchQuery)}`;
    const searchResponse = await fetchWithTimeout(searchUrl, 5000);

    if (!searchResponse || !searchResponse.ok) {
      console.log('[Zoro] Search failed');
      return null;
    }

    // Zoro returns HTML, need to parse - for now, skip
    console.log('[Zoro] HTML parsing not implemented');
    return null;
  } catch (error) {
    console.log('[Zoro] Error:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Fallback to use known working anime stream APIs
 * This uses a curated list of public anime streams
 */
async function fetchFromBackupApis(
  animeId: number,
  episodeNumber: number,
  title: string
): Promise<EpisodeSources | null> {
  try {
    console.log('[Backup] Trying backup APIs...');

    // Try using the anime ID to fetch from some public APIs
    // This is a simplified approach

    // First, try to get the anime info from AniList
    const anilistUrl = `https://graphql.anilist.co`;
    const query = `
      query {
        Media(id: ${animeId}, type: ANIME) {
          id
          title { romaji english }
          idMal
        }
      }
    `;

    const response = await fetchWithTimeout(anilistUrl, 5000);
    if (!response) return null;

    const data = await response.json();
    const media = data?.data?.Media;

    if (!media) {
      console.log('[Backup] Anime not found on AniList');
      return null;
    }

    const searchTitle = media.title?.romaji || media.title?.english || title;

    console.log(`[Backup] Found on AniList: ${searchTitle} (MAL ID: ${media.idMal})`);

    // Now try to search on various anime sites
    // For now, return null to trigger fallback
    return null;
  } catch (error) {
    console.log('[Backup] Error:', error instanceof Error ? error.message : error);
    return null;
  }
}

// ============================================
// Main Export
// ============================================

/**
 * Get episode sources from multiple APIs with fallback
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
  const { title = `Anime ${animeId}` } = options;

  console.log(`[VideoSources] Fetching: ${title} - Episode ${episodeNumber}`);

  // List of fetchers to try in order
  const fetchers = [
    { name: 'Consumet', fn: fetchFromConsumet },
    { name: 'Zoro', fn: fetchFromZoro },
    { name: 'Backup', fn: fetchFromBackupApis },
  ];

  for (const { name, fn } of fetchers) {
    try {
      console.log(`[VideoSources] Trying ${name}...`);

      const result = await Promise.race([
        fn(animeId, episodeNumber, title),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            console.log(`[VideoSources] ${name} timeout`);
            resolve(null);
          }, 12000)
        ),
      ]);

      if (result) {
        console.log(`[VideoSources] ✓ Success using ${result.provider}`);
        return result;
      }
    } catch (error) {
      console.log(`[VideoSources] ${name} failed:`, error instanceof Error ? error.message : error);
    }
  }

  // All APIs failed, return demo video
  console.warn('[VideoSources] All APIs failed, returning demo video');
  return getDemoSources(animeId, episodeNumber, title);
}

/**
 * Get demo sources (fallback when all APIs fail)
 */
export function getDemoSources(
  animeId: number,
  episodeNumber: number,
  title?: string
): EpisodeSources {
  return {
    animeId,
    episodeNumber,
    sources: TEST_STREAMS.map(s => ({ ...s })),
    subtitles: [],
    provider: 'Demo',
    isFallback: true,
  };
}

export async function getAvailableLanguages() {
  return [
    { type: 'sub', available: true },
    { type: 'dub', available: false },
  ];
}

export async function searchAnime(query: string) {
  return [];
}
