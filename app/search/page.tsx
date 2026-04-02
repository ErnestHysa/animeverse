/**
 * Search Page
 * Search anime with advanced filters
 * Supports browsing with filters even without a search query
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { AnimeFilters } from "@/components/search/anime-filters";
import { RecentSearches } from "@/components/search/recent-searches";
import { anilist } from "@/lib/anilist";
import { Search } from "lucide-react";
import { Suspense } from "react";
import { AnimeGridSkeleton } from "@/components/ui/skeleton";

// ===================================
// Data Fetching
// ===================================

interface SearchParamsValues {
  q?: string;
  sort?: string;
  genre?: string;
  year?: string;
  format?: string;
  status?: string;
  season?: string;
  minScore?: string;
}

interface SearchPageProps {
  searchParams: Promise<SearchParamsValues>;
}

function hasActiveFilters(params: SearchParamsValues): boolean {
  return !!(params.genre || params.year || params.format || params.status || params.season || params.minScore || params.sort);
}

async function searchAnime(params: SearchParamsValues) {
  const query = params.q?.trim();
  const sort = params.sort || (query ? "SEARCH_MATCH" : "POPULARITY_DESC");

  // Return popular anime if no query AND no active filters
  if (!query && !hasActiveFilters(params)) {
    const result = await anilist.getPopular(1, 48);
    return result.data?.Page.media ?? [];
  }

  const result = await anilist.search({
    search: query || undefined,
    sort,
    genre: params.genre,
    year: params.year ? parseInt(params.year) : undefined,
    format: params.format,
    status: params.status,
    season: params.season as "WINTER" | "SPRING" | "SUMMER" | "FALL" | undefined,
    minScore: params.minScore ? parseInt(params.minScore) : undefined,
    perPage: 48,
  });

  return result.data?.Page.media ?? [];
}

// ===================================
// Page Component
// ===================================

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q || "";
  const filtersActive = hasActiveFilters(params);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Search className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">
                {query ? `Search: "${query}"` : "Search Anime"}
              </h1>
              <p className="text-muted-foreground">
                {query
                  ? `${filtersActive ? "Filtered " : ""}search results`
                  : filtersActive
                  ? "Filtered browse results"
                  : "Discover popular anime or search & filter by genre, season, year"}
              </p>
            </div>
          </div>

          {/* Recent searches - only when no active query */}
          <RecentSearches currentQuery={query} />

          {/* Filters - always shown */}
          <AnimeFilters
            currentFilters={{
              genre: params.genre,
              year: params.year,
              format: params.format,
              status: params.status,
              sort: params.sort,
              season: params.season,
              minScore: params.minScore,
            }}
            query={query}
          />

          {/* Anime Grid */}
          <Suspense fallback={<AnimeGridSkeleton count={24} />}>
            <SearchResults query={query} params={params} filtersActive={filtersActive} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

// Separate component for search results with Suspense
async function SearchResults({ query, params, filtersActive }: { query: string; params: SearchParamsValues; filtersActive: boolean }) {
  const anime = await searchAnime(params);

  return (
    <>
      <div className="mb-4 text-sm text-muted-foreground">
        {anime.length > 0
          ? `Showing ${anime.length} ${query ? "results" : filtersActive ? "filtered anime" : "popular anime"}`
          : "No results found — try adjusting your filters"}
      </div>
      {anime.length > 0 ? (
        <AnimeGrid anime={anime} />
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">No Results Found</h3>
          <p className="text-muted-foreground max-w-sm">
            Try a different search term or adjust your filters.
          </p>
        </div>
      )}
    </>
  );
}

// ===================================
// Metadata
// ===================================

export const metadata = {
  title: "Search",
  description: "Search for your favorite anime with advanced filters.",
};

export const dynamic = "force-dynamic";
