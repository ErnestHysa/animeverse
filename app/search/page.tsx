/**
 * Search Page
 * Search anime with advanced filters
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { AnimeFilters } from "@/components/search/anime-filters";
import { anilist } from "@/lib/anilist";
import { Search } from "lucide-react";
import { Suspense } from "react";

// ===================================
// Data Fetching
// ===================================

interface SearchPageProps {
  searchParams: {
    q?: string;
    sort?: string;
    genre?: string;
    year?: string;
    format?: string;
    status?: string;
  };
}

async function searchAnime(params: SearchPageProps["searchParams"]) {
  const query = params.q;
  const sort = params.sort || "POPULARITY_DESC";

  // Return empty if no query provided (undefined or empty string)
  if (!query || query.trim() === "") {
    return [];
  }

  const result = await anilist.search({
    search: query,
    sort,
    genre: params.genre,
    year: params.year ? parseInt(params.year) : undefined,
    format: params.format,
    status: params.status,
    perPage: 48,
  });

  return result.data?.Page.media ?? [];
}

// ===================================
// Page Component
// ===================================

export default async function SearchPage({ searchParams }: SearchPageProps) {
  // Await searchParams (Next.js 16 requires this)
  const params = await searchParams;
  const query = params.q || "";

  // Fetch anime with the awaited params
  const anime = await searchAnime(params);

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
                {query && anime.length > 0
                  ? `Found ${anime.length} results`
                  : query
                  ? "No results found - try adjusting your filters"
                  : "Enter a search term to find anime"}
              </p>
            </div>
          </div>

          {/* Filters */}
          {query && (
            <AnimeFilters
              currentFilters={{
                genre: params.genre,
                year: params.year,
                format: params.format,
                status: params.status,
                sort: params.sort,
              }}
              query={query}
            />
          )}

          {/* Anime Grid */}
          {query ? (
            <AnimeGrid anime={anime} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">Search for Anime</h3>
              <p className="text-muted-foreground max-w-sm">
                Use the search bar in the header to find your favorite anime.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
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
