/**
 * App-wide constants
 */

// ===================================
// API Configuration
// ===================================

export const ANILIST_API_URL = process.env.ANILIST_GRAPHQL_URL || "https://graphql.anilist.co";

export const API_CONFIG = {
  anilist: {
    url: ANILIST_API_URL,
    defaultOptions: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    },
  },
} as const;

// ===================================
// Pagination
// ===================================

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 24,
  MAX_PAGE_SIZE: 50,
} as const;

// ===================================
// Image Sizes
// ===================================

export const IMAGE_SIZES = {
  cover: {
    extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/{id}.jpg",
    large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/{id}.jpg",
    medium: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/{id}.jpg",
  },
  banner: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/{id}.jpg",
} as const;

// ===================================
// Anime Formats (for display)
// ===================================

export const MEDIA_FORMAT_LABELS: Record<string, string> = {
  TV: "TV Series",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  SPECIAL: "Special",
  OVA: "OVA",
  ONA: "ONA",
  MUSIC: "Music",
  MANGA: "Manga",
  NOVEL: "Novel",
  ONE_SHOT: "One Shot",
} as const;

export const MEDIA_STATUS_LABELS: Record<string, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "Hiatus",
} as const;

export const MEDIA_SEASONS: Record<string, string> = {
  WINTER: "Winter",
  SPRING: "Spring",
  SUMMER: "Summer",
  FALL: "Fall",
} as const;

// ===================================
// Genres & Tags
// ===================================

export const POPULAR_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Mecha",
  "Mystery",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
] as const;

export const POPULAR_TAGS = [
  "Angst",
  "Cartoon",
  "Childhood Promise",
  "Comedy",
  "Cyberpunk",
  "Dark Fantasy",
  "Demons",
  "Disaster",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Game",
  "Gore",
  "Harem",
  "Historical",
  "Horror",
  "Isekai",
  "Magic",
  "Martial Arts",
  "Mecha",
  "Military",
  "Music",
  "Mystery",
  "Psychological",
  "Racing",
  "Romance",
  "Samurai",
  "School",
  "Sci-Fi",
  "Seinen",
  "Shoujo",
  "Shounen",
  "Slice of Life",
  "Space",
  "Sports",
  "Super Power",
  "Supernatural",
  "Vampire",
] as const;

// ===================================
// Sort Options
// ===================================

export const SORT_OPTIONS = [
  { value: "POPULARITY_DESC", label: "Most Popular" },
  { value: "SCORE_DESC", label: "Highest Rated" },
  { value: "TRENDING_DESC", label: "Trending" },
  { value: "START_DATE_DESC", label: "Newest" },
  { value: "START_DATE_ASC", label: "Oldest" },
  { value: "TITLE_ROMAJI", label: "Name A-Z" },
  { value: "TITLE_ROMAJI_DESC", label: "Name Z-A" },
] as const;

// ===================================
// Quality Options
// ===================================

export const VIDEO_QUALITIES = [
  { value: "360p", label: "360p", size: "Low" },
  { value: "480p", label: "480p", size: "SD" },
  { value: "720p", label: "720p", size: "HD" },
  { value: "1080p", label: "1080p", size: "Full HD" },
] as const;

// ===================================
// Storage Keys
// ===================================

export const STORAGE_KEYS = {
  WATCH_HISTORY: "animeverse_watch_history",
  WATCHLIST: "animeverse_watchlist",
  FAVORITES: "animeverse_favorites",
  PREFERENCES: "animeverse_preferences",
  LAST_WATCHED: "animeverse_last_watched_{mediaId}",
} as const;

// ===================================
// Default User Preferences
// ===================================

export const DEFAULT_PREFERENCES = {
  defaultQuality: "720p",
  autoplay: true,
  autoNext: true,
  streamingMethod: "direct",
  subtitles: true,
  autoSkipIntro: false,
  autoSkipOutro: false,
  hideAdultContent: false, // NSFW filter off by default
  showFillerEpisodes: true, // Show filler episodes by default
  subtitleStyle: {
    fontSize: 20,
    fontFamily: "Arial, sans-serif",
    fontColor: "#FFFFFF",
    backgroundColor: "#000000",
    backgroundOpacity: 50,
    position: "bottom" as const,
    edgeStyle: "drop-shadow" as const,
    textShadow: true,
    windowColor: "#000000",
    windowOpacity: 0,
  },
  subtitleLanguage: "en",
  preferDubs: false, // Prefer dubbed versions for P2P streaming
} as const;

// ===================================
// Streaming Config
// ===================================

export const WEBTORRENT_CONFIG = {
  tracker: "wss://tracker.webtorrent.dev",
  announce: [
    "wss://tracker.webtorrent.dev",
    "wss://tracker.btorrent.xyz",
    "wss://tracker.openwebtorrent.com",
  ],
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  },
} as const;

// ===================================
// Route Paths
// ===================================

export const ROUTES = {
  HOME: "/",
  SEARCH: "/search",
  TRENDING: "/trending",
  SEASONAL: "/seasonal",
  ANIME: "/anime",
  WATCH: "/watch",
  FAVORITES: "/favorites",
  WATCHLIST: "/watchlist",
  SETTINGS: "/settings",
} as const;

// ===================================
// Animation Durations
// ===================================

export const ANIMATION_DURATION = {
  INSTANT: 50,
  FAST: 100,
  NORMAL: 200,
  SLOW: 300,
  SLOWER: 500,
} as const;

// ===================================
// Breakpoints (for reference)
// ===================================

export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

// ===================================
// Keyboard Shortcuts
// ===================================

export const KEYBOARD_SHORTCUTS = {
  SEEK_BACKWARD_10: "ArrowLeft",
  SEEK_FORWARD_10: "ArrowRight",
  SEEK_BACKWARD_5: "j",
  SEEK_FORWARD_5: "l",
  VOLUME_UP: "ArrowUp",
  VOLUME_DOWN: "ArrowDown",
  MUTE: "m",
  FULLSCREEN: "f",
  PLAY_PAUSE: "Space",
  PREVIOUS_EPISODE: "p",
  NEXT_EPISODE: "n",
} as const;

// ===================================
// Error Messages
// ===================================

export const ERROR_MESSAGES = {
  NETWORK_ERROR: "Network error. Please check your connection.",
  API_ERROR: "Failed to fetch data. Please try again later.",
  NOT_FOUND: "The requested anime was not found.",
  STREAMING_ERROR: "Failed to load video. Please try another source.",
  MAGNET_INVALID: "Invalid magnet link provided.",
  TORRENT_NOT_FOUND: "No peers found for this torrent.",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
} as const;
