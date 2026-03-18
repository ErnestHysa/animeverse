/**
 * Video Sources Integration
 * Provides actual anime video sources from multiple providers
 */

export interface VideoSource {
  url: string;
  quality: "360p" | "480p" | "720p" | "1080p" | "auto";
  label: string;
  provider: string;
  type: "mp4" | "hls" | "webm";
}

export interface EpisodeSources {
  animeId: number;
  episodeNumber: number;
  sources: VideoSource[];
  subtitles?: SubtitleSource[];
  intro?: {
    start: number;
    end: number;
  };
  outro?: {
    start: number;
    end: number;
  };
}

export interface SubtitleSource {
  url: string;
  language: string;
  label: string;
}

// Demo video sources for testing
const DEMO_SOURCES: Record<string, VideoSource[]> = {
  "big-buck-bunny": [
    {
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      quality: "auto",
      label: "Auto",
      provider: "Google",
      type: "mp4"
    },
    {
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      quality: "720p",
      label: "720p",
      provider: "Google",
      type: "mp4"
    },
    {
      url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      quality: "480p",
      label: "480p",
      provider: "Google",
      type: "mp4"
    },
  ]
};

// Intro/outro timestamps for popular anime (demo data)
const INTRO_OUTRO_DATA: Record<string, { intro: { start: number; end: number }; outro: { start: number; end: number } }> = {
  "1": { // Demon Slayer example
    intro: { start: 89, end: 179 },
    outro: { start: 1320, end: 1410 }
  },
  "2": { // Jujutsu Kaisen example
    intro: { start: 75, end: 165 },
    outro: { start: 1280, end: 1370 }
  }
};

/**
 * Get video sources for an episode
 * Fetches from our internal API which proxies to multiple providers
 */
export async function getEpisodeSources(
  animeId: number,
  episodeNumber: number,
  animeTitle?: string
): Promise<EpisodeSources> {
  try {
    // Build URL with title for better search results
    const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");

    if (animeTitle) {
      url.searchParams.set("title", animeTitle);
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000), // 20 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch sources: ${response.statusText}`);
    }

    const data = await response.json();

    // Merge with intro/outro data if available
    return {
      ...data,
      intro: data.intro || INTRO_OUTRO_DATA[animeId.toString()]?.intro,
      outro: data.outro || INTRO_OUTRO_DATA[animeId.toString()]?.outro,
    };
  } catch (error) {
    console.error("Error fetching episode sources:", error);

    // Return demo sources as fallback
    return {
      animeId,
      episodeNumber,
      sources: DEMO_SOURCES["big-buck-bunny"] || DEMO_SOURCES["big-buck-bunny"],
      subtitles: [],
      intro: INTRO_OUTRO_DATA[animeId.toString()]?.intro,
      outro: INTRO_OUTRO_DATA[animeId.toString()]?.outro,
    };
  }
}

/**
 * Get intro/outro timestamps for an anime
 * In production, this would come from a community database or API
 */
export async function getIntroOutro(animeId: number): Promise<{
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
}> {
  // Check local storage for user-customized timestamps
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem(`intro-outro-${animeId}`);
    if (custom) {
      return JSON.parse(custom);
    }
  }

  return INTRO_OUTRO_DATA[animeId.toString()] || {};
}

/**
 * Save intro/outro timestamps for an anime
 */
export async function saveIntroOutro(
  animeId: number,
  intro?: { start: number; end: number },
  outro?: { start: number; end: number }
): Promise<void> {
  if (typeof window !== "undefined") {
    const data = { intro, outro };
    localStorage.setItem(`intro-outro-${animeId}`, JSON.stringify(data));
  }
}

/**
 * Search for anime on external sources
 * In production, integrate with multiple providers
 */
export async function searchExternalSources(query: string): Promise<any[]> {
  // Placeholder for external source search
  // Would integrate with:
  // - TMDB API
  // - Anilist API (already integrated)
  // - Kitsu API

  return [];
}

/**
 * Get all episodes for an anime with metadata
 */
export async function getAnimeEpisodes(animeId: number): Promise<{
  episodes: Array<{
    number: number;
    title?: string;
    airedAt?: string;
    thumbnail?: string;
    filler: boolean;
  }>;
}> {
  // In production, fetch from actual source
  // For now, generate placeholder data
  return {
    episodes: Array.from({ length: 12 }, (_, i) => ({
      number: i + 1,
      title: `Episode ${i + 1}`,
      filler: false,
    })),
  };
}

/**
 * Report a broken video
 */
export async function reportBrokenVideo(data: {
  animeId: number;
  episodeNumber: number;
  source: string;
  issue: string;
}): Promise<void> {
  // In production, send to backend API or monitoring service
  if (typeof window !== "undefined") {
    // Store reports locally for demo
    const reports = JSON.parse(localStorage.getItem("broken-reports") || "[]");
    reports.push({ ...data, timestamp: Date.now() });
    localStorage.setItem("broken-reports", JSON.stringify(reports));
  }
}
