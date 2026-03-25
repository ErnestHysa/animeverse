/**
 * AniList API Types
 * Based on https://docs.anilist.co
 */

// ===================================
// Basic Types
// ===================================

export type MediaType = "ANIME" | "MANGA";

export type MediaFormat =
  | "TV"
  | "TV_SHORT"
  | "MOVIE"
  | "SPECIAL"
  | "OVA"
  | "ONA"
  | "MUSIC"
  | "MANGA"
  | "NOVEL"
  | "ONE_SHOT";

export type MediaStatus =
  | "FINISHED"
  | "RELEASING"
  | "NOT_YET_RELEASED"
  | "CANCELLED"
  | "HIATUS";

export type MediaSeason = "WINTER" | "SPRING" | "SUMMER" | "FALL";

export type MediaSource =
  | "ORIGINAL"
  | "MANGA"
  | "LIGHT_NOVEL"
  | "VISUAL_NOVEL"
  | "VIDEO_GAME"
  | "OTHER"
  | "NOVEL"
  | "DOUJINSHI"
  | "ANIME"
  | "WEB_NOVEL"
  | "LIVE_ACTION"
  | "GAME"
  | "COMIC"
  | "MULTIMEDIA_PROJECT"
  | "PICTURE_BOOK";

export type MediaRelationType =
  | "ADAPTATION"
  | "PREQUEL"
  | "SEQUEL"
  | "PARENT"
  | "SIDE_STORY"
  | "CHARACTER"
  | "SUMMARY"
  | "ALTERNATIVE"
  | "SPIN_OFF"
  | "OTHER"
  | "COMPILATION"
  | "CONTAINS";

export type ExternalLinkType =
  | "INFO"
  | "STREAMING"
  | "SOCIAL"
  | "OFFICIAL_SITE";

// ===================================
// Media Types
// ===================================

export interface Title {
  romaji: string;
  english: string | null;
  native: string | null;
  userPreferred: string | null;
}

export interface CoverImage {
  extraLarge: string | null;
  large: string | null;
  medium: string | null;
  color: string | null;
}

export interface BannerImage {
  string: string | null;
}

export interface Studios {
  nodes: StudioNode[];
}

export interface StudioNode {
  id: number;
  name: string;
  isAnimationStudio: boolean;
}

export interface StartDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface EndDate {
  year: number | null;
  month: number | null;
  day: number | null;
}

export interface ExternalLink {
  site: string;
  url: string;
  type: ExternalLinkType;
  icon: string | null;
}

export interface StreamingEpisode {
  site: string;
  title: string | null;
  thumbnail: string | null;
  url: string;
}

export interface MediaEdge {
  node: Media;
  relationType: MediaRelationType;
  character: Character | null;
  staffing: { node: Staff } | null;
}

export interface Character {
  id: number;
  name: { first: string | null; last: string | null; full: string };
  image: { large: string; medium: string };
}

export interface Staff {
  id: number;
  name: { first: string | null; last: string | null; full: string };
}

// ===================================
// Main Media Type
// ===================================

export interface Media {
  id: number;
  idMal: number | null;
  title: Title;
  format: MediaFormat | null;
  type: MediaType;
  status: MediaStatus;
  description: string | null;
  synonyms: string[] | null;
  isLicensed: boolean | null;
  source: MediaSource | null;
  countryOfOrigin: string;
  isAdult: boolean;
  genres: string[] | null;
  tags: Tag[] | null;
  studios: Studios | null;
  startDate: StartDate;
  endDate: EndDate | null;
  season: MediaSeason | null;
  seasonYear: number | null;
  seasonInt: number | null;
  averageScore: number | null;
  meanScore: number | null;
  popularity: number;
  favourites: number;
  trending: number;
  episodes: number | null;
  duration: number | null;
  chapters: number | null;
  volumes: number | null;
  coverImage: CoverImage;
  bannerImage: string | null;
  trailer: Trailer | null;
  relations: { edges: MediaEdge[] } | null;
  characters: { edges: { node: Character; role: string; voiceActors: { id: number; name: { full: string } }[] }[] } | null;
  staff: { edges: { node: Staff; role: string }[] } | null;
  externalLinks: ExternalLink[] | null;
  streamingEpisodes: StreamingEpisode[] | null;
  nextAiringEpisode: AiringSchedule | null;
  airingSchedule: { edges: AiringEdge[] } | null;
}

export interface Trailer {
  id: string | null;
  site: "youtube" | "dailymotion" | null;
  thumbnail: string | null;
}

export interface Tag {
  id: number;
  name: string;
  description: string | null;
  category: string;
  rank: number;
  isGeneralSpoiler: boolean;
  isMediaSpoiler: boolean;
  isAdult: boolean;
}

export interface AiringSchedule {
  id: number;
  airingAt: number;
  timeUntilAiring: number;
  episode: number;
  media: Media;
}

export interface AiringEdge {
  node: AiringSchedule;
}

// ===================================
// Page Info Types
// ===================================

export interface PageInfo {
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  hasNextPage: boolean;
}

// ===================================
// Query Response Types
// ===================================

export interface MediaListResponse {
  Page: {
    pageInfo: PageInfo;
    media: Media[];
  };
}

export interface MediaResponse {
  Media: Media | null;
}

export interface TrendingResponse {
  Page: {
    pageInfo: PageInfo;
    media: Media[];
  };
}

export interface SearchResponse {
  Page: {
    pageInfo: PageInfo;
    media: Media[];
  };
}

export interface AiringResponse {
  Page: {
    pageInfo: PageInfo;
    airingSchedules: AiringSchedule[];
  };
}

export interface StudioMedia {
  id: number;
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
    userPreferred: string | null;
  };
  coverImage: {
    large: string | null;
    medium: string | null;
  };
  averageScore: number | null;
  format: MediaFormat | null;
}

export interface Studio {
  id: number;
  name: string;
  isAnimationStudio: boolean;
  media: {
    nodes: StudioMedia[];
  };
}

export interface StudioListResponse {
  Page: {
    studios: {
      nodes: Studio[];
    };
  };
}

// ===================================
// Local Types (Extended)
// ===================================

export interface AnimeWithProgress extends Media {
  progress?: number;
  inWatchlist?: boolean;
  isFavorite?: boolean;
  lastWatched?: Date;
}

export interface WatchHistoryItem {
  mediaId: number;
  episodeNumber: number;
  timestamp: number;
  completed: boolean;
}

export interface UserPreferences {
  defaultQuality: "360p" | "480p" | "720p" | "1080p" | "auto";
  autoplay: boolean;
  autoNext: boolean;
  streamingMethod: "webtorrent" | "direct" | "hybrid";
  subtitles: boolean;
}

export interface StreamingSource {
  type: "magnet" | "direct" | "torrent";
  url: string;
  quality?: string;
  fansub?: string;
  size?: string;
}

export interface EpisodeSource {
  episodeNumber: number;
  title?: string;
  sources: StreamingSource[];
}

// ===================================
// API Error Types
// ===================================

export interface APIError {
  message: string;
  status?: number;
  code?: string;
}

export type APIResult<T> = { data: T; error: null } | { data: null; error: APIError };
