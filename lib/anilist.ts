/**
 * AniList GraphQL API Client
 * Documentation: https://docs.anilist.co
 */

import type {
  Media,
  MediaListResponse,
  MediaResponse,
  TrendingResponse,
  SearchResponse,
  AiringResponse,
  StudioListResponse,
  APIResult,
} from "@/types/anilist";
import { ANILIST_API_URL, API_CONFIG } from "./constants";

// ===================================
// Media Fragments (Reusable GraphQL)
// ===================================

const MEDIA_MINIMAL_FRAGMENT = `id idMal title { romaji english native userPreferred } coverImage { extraLarge large medium color } format status episodes averageScore genres seasonYear`;

const MEDIA_FULL_FRAGMENT = `id idMal title { romaji english native userPreferred } format type status description synonyms isLicensed source countryOfOrigin isAdult genres tags { id name rank } studios { nodes { id name isAnimationStudio } } startDate { year month day } endDate { year month day } season seasonYear seasonInt averageScore meanScore popularity favourites trending episodes duration coverImage { extraLarge large medium color } bannerImage trailer { id site thumbnail } relations { edges { node { ${MEDIA_MINIMAL_FRAGMENT} } relationType } } characters(sort: FAVOURITES_DESC, perPage: 10) { edges { node { id name { full native } image { large medium } } role } } externalLinks { site url type icon } nextAiringEpisode { id airingAt timeUntilAiring episode } streamingEpisodes { site title thumbnail url }`;

// ===================================
// GraphQL Queries
// ===================================

const QUERIES = {
  trending: `query Trending($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, sort: TRENDING_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`,

  popular: `query Popular($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`,

  seasonal: `query Seasonal($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, season: $season, seasonYear: $year, sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`,

  airing: `query Airing($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } airingSchedules(airingAt_greater: ${Math.floor(Date.now() / 1000)}, sort: TIME) { id airingAt timeUntilAiring episode media { ${MEDIA_MINIMAL_FRAGMENT} } } } }`,

  search: `query Search($search: String, $page: Int, $perPage: Int, $sort: [MediaSort], $format: [MediaFormat], $genre: String, $status: MediaStatus, $year: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME search: $search sort: $sort format_in: $format genre: $genre status: $status seasonYear: $year) { ${MEDIA_FULL_FRAGMENT} } } }`,

  byId: `query ById($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FULL_FRAGMENT} } }`,

  recommendations: `query Recommendations($id: Int) { Media(id: $id) { recommendations(perPage: 10, sort: RATING_DESC) { nodes { mediaRecommendation { ${MEDIA_MINIMAL_FRAGMENT} } } } } }`,

  byIds: `query GetByIds($ids: [Int]) { Page(page: 1, perPage: 50) { pageInfo { total } media(id_in: $ids, type: ANIME) { ${MEDIA_MINIMAL_FRAGMENT} } } }`,

  studios: `query Studios($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { studios(sort: FAVOURITES_DESC) { nodes { id name isAnimationStudio media(first: 10, sort: POPULARITY_DESC) { nodes { id title { romaji english native userPreferred } coverImage { large medium } averageScore format } } } } } }`,

  byStudio: `query ByStudio($studioId: Int, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, studios: [$studioId], sort: POPULARITY_DESC) { ${MEDIA_MINIMAL_FRAGMENT} } } }`,

  byGenre: `query ByGenre($genre: String!, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, genre_in: [$genre], sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`,
};

// ===================================
// API Client Class
// ===================================

class AniListClient {
  private readonly url: string;
  private readonly options: RequestInit;

  constructor() {
    this.url = ANILIST_API_URL;
    this.options = API_CONFIG.anilist.defaultOptions;
  }

  private async query<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<APIResult<T>> {
    try {
      const response = await fetch(this.url, {
        ...this.options,
        body: JSON.stringify({ query, variables }),
        next: { revalidate: 300 },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          error: {
            message: data.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
          },
        };
      }

      if (data.errors) {
        return {
          data: null,
          error: {
            message: data.errors[0]?.message || "Unknown API error",
            code: data.errors[0]?.extensions?.code,
          },
        };
      }

      return { data: data.data as T, error: null };
    } catch (error) {
      return {
        data: null,
        error: {
          message: error instanceof Error ? error.message : "Network error",
        },
      };
    }
  }

  async getTrending(page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    return this.query<TrendingResponse>(QUERIES.trending, { page, perPage });
  }

  async getPopular(page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    return this.query<TrendingResponse>(QUERIES.popular, { page, perPage });
  }

  async getSeasonal(
    season: "WINTER" | "SPRING" | "SUMMER" | "FALL",
    year: number = new Date().getFullYear(),
    page: number = 1,
    perPage: number = 24
  ): Promise<APIResult<TrendingResponse>> {
    return this.query<TrendingResponse>(QUERIES.seasonal, { season, year, page, perPage });
  }

  async getAiring(page: number = 1, perPage: number = 24): Promise<APIResult<AiringResponse>> {
    return this.query<AiringResponse>(QUERIES.airing, { page, perPage });
  }

  async search(params: {
    search?: string;
    page?: number;
    perPage?: number;
    sort?: string;
    format?: string;
    genre?: string;
    status?: string;
    year?: number;
  }): Promise<APIResult<SearchResponse>> {
    const {
      search: searchQuery,
      page = 1,
      perPage = 24,
      sort = "POPULARITY_DESC",
      format,
      genre,
      status,
      year,
    } = params;

    const variables: Record<string, unknown> = { page, perPage, sort };

    if (searchQuery) variables.search = searchQuery;
    if (format) variables.format = format;
    if (genre) variables.genre = genre;
    if (status) variables.status = status;
    if (year) variables.year = year;

    return this.query<SearchResponse>(QUERIES.search, variables);
  }

  async getById(id: number): Promise<APIResult<MediaResponse>> {
    return this.query<MediaResponse>(QUERIES.byId, { id });
  }

  async getRecommendations(id: number): Promise<APIResult<MediaResponse>> {
    return this.query<MediaResponse>(QUERIES.recommendations, { id });
  }

  async getByIds(ids: number[]): Promise<APIResult<MediaListResponse>> {
    return this.query<MediaListResponse>(QUERIES.byIds, { ids });
  }

  async getStudios(page: number = 1, perPage: number = 50): Promise<APIResult<StudioListResponse>> {
    return this.query<StudioListResponse>(QUERIES.studios, { page, perPage });
  }

  async getByStudio(studioId: number, page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    return this.query<TrendingResponse>(QUERIES.byStudio, { studioId, page, perPage });
  }

  async getByGenre(genre: string, page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    return this.query<TrendingResponse>(QUERIES.byGenre, { genre, page, perPage });
  }

  /**
   * Get upcoming anime (not yet aired)
   */
  async getUpcoming(page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    const query = `query Upcoming($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, status: NOT_YET_RELEASED, sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`;
    return this.query<TrendingResponse>(query, { page, perPage });
  }

  /**
   * Get popular studios (sorted by favorites)
   */
  async getPopularStudios(page: number = 1, perPage: number = 50): Promise<APIResult<StudioListResponse>> {
    return this.query<StudioListResponse>(QUERIES.studios, { page, perPage });
  }

  /**
   * Get anime by multiple genres
   */
  async getByGenres(genres: string[], page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    const query = `query ByGenres($genres: [String!], $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, genre_in: $genres, sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`;
    return this.query<TrendingResponse>(query, { genres, page, perPage });
  }

  /**
   * Get anime by tag
   */
  async getByTag(tag: string, page: number = 1, perPage: number = 24): Promise<APIResult<TrendingResponse>> {
    const query = `query ByTag($tag: String!, $page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { pageInfo { total perPage currentPage lastPage hasNextPage } media(type: ANIME, tag_in: [$tag], sort: POPULARITY_DESC) { ${MEDIA_FULL_FRAGMENT} } } }`;
    return this.query<TrendingResponse>(query, { tag, page, perPage });
  }
}

export const anilist = new AniListClient();

// Export convenience functions for backward compatibility
export const searchByGenre = anilist.getByGenre.bind(anilist);
export const searchByStudio = anilist.getByStudio.bind(anilist);
export const getUpcoming = anilist.getUpcoming.bind(anilist);
export const getPopularStudios = anilist.getPopularStudios.bind(anilist);

// ===================================
// Helper Functions
// ===================================

export function getCurrentSeason(): "WINTER" | "SPRING" | "SUMMER" | "FALL" {
  const month = new Date().getMonth();
  if (month >= 0 && month <= 2) return "WINTER";
  if (month >= 3 && month <= 5) return "SPRING";
  if (month >= 6 && month <= 8) return "SUMMER";
  return "FALL";
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function getAnimeTitle(media: Media): string {
  return (
    media.title.userPreferred ||
    media.title.english ||
    media.title.romaji ||
    media.title.native ||
    "Unknown"
  );
}

export function getAnimeCover(media: Media): string {
  return (
    media.coverImage.extraLarge ||
    media.coverImage.large ||
    media.coverImage.medium ||
    "/placeholder.jpg"
  );
}

export function isCurrentlyAiring(media: Media): boolean {
  return media.status === "RELEASING";
}

export function getStarRating(score: number | null): number {
  if (score === null) return 0;
  return Math.round((score / 100) * 5);
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "N/A";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export function formatEpisodeCount(episodes: number | null, status: string): string {
  if (episodes) return `${episodes} eps`;
  if (status === "RELEASING") return "Ongoing";
  return "TBA";
}

export function getNextAiringTime(media: Media): string | null {
  if (!media.nextAiringEpisode) return null;

  const airingAt = new Date(media.nextAiringEpisode.airingAt * 1000);
  const now = new Date();
  const diff = airingAt.getTime() - now.getTime();

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `Ep ${media.nextAiringEpisode.episode} in ${days}d`;
  }

  if (hours > 0) {
    return `Ep ${media.nextAiringEpisode.episode} in ${hours}h ${minutes}m`;
  }

  return `Ep ${media.nextAiringEpisode.episode} in ${minutes}m`;
}
