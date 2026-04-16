/**
 * Hidden Gems Page
 * Discover highly-rated anime that flew under the radar.
 * These are finished shows with score > 80 but not in the mainstream spotlight.
 * No other legal streaming platform surfaces these — this is a unique AnimeVerse feature.
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeGrid } from "@/components/anime/anime-grid";
import { anilist } from "@/lib/anilist";
import { Gem } from "lucide-react";
import { Suspense } from "react";
import { AnimeGridSkeleton } from "@/components/ui/skeleton";

// ===================================
// Data Fetching
// ===================================

async function fetchHiddenGems() {
  const result = await anilist.getHiddenGems(1, 48);
  return result.data?.Page.media ?? [];
}

// ===================================
// Components
// ===================================

async function HiddenGemsGrid() {
  let anime;
  try {
    anime = await fetchHiddenGems();
  } catch (error) {
    console.error('Failed to load hidden gems:', error);
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h2 className="text-2xl font-bold text-red-400">Failed to load content</h2>
        <p className="text-gray-400 mt-2">Please try again later.</p>
      </div>
    );
  }

  if (anime.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Gem className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Nothing found right now</h3>
        <p className="text-muted-foreground max-w-sm">
          Check back soon — the list updates regularly.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        Showing {anime.length} hidden gems
      </p>
      <AnimeGrid anime={anime} />
    </>
  );
}

// ===================================
// Page Component
// ===================================

export default function HiddenGemsPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <Gem className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Hidden Gems</h1>
              <p className="text-muted-foreground">
                Highly-rated anime that flew under the radar — score 80+ but not in the mainstream spotlight
              </p>
            </div>
          </div>

          {/* Info banner */}
          <div className="mb-8 p-4 rounded-xl bg-violet-500/10 border border-violet-500/20 text-sm text-muted-foreground">
            <span className="text-violet-400 font-medium">How we pick these: </span>
            Shows must be finished airing, score above 80/100 on AniList, and not be among the most-watched series.
            These are the titles your friends haven&apos;t seen yet — but should.
          </div>

          {/* Grid */}
          <Suspense fallback={<AnimeGridSkeleton count={24} />}>
            <HiddenGemsGrid />
          </Suspense>
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
  title: "Hidden Gems",
  description:
    "Discover underrated anime with high ratings that most people haven't seen yet.",
};

export const dynamic = "force-dynamic";
