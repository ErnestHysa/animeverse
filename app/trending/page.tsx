/**
 * Trending Page
 * Paginated list of trending anime
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeGrid } from "@/components/anime/anime-grid";

import { AnimeGridSkeleton } from "@/components/ui/skeleton";

import { anilist } from "@/lib/anilist";

import { TrendingUp } from "lucide-react";

import { Suspense } from "react";

// ===================================
// Data Fetching
// ===================================

async function getTrendingAnime() {
  const result = await anilist.getTrending(1, 48);
  return result.data?.Page.media ?? [];
}

// ===================================
// Page Component
// ===================================

export default async function TrendingPage() {
  let anime;
  try {
    anime = await getTrendingAnime();
  } catch (error) {
    console.error('Failed to load trending anime:', error);
    return (
      <>
        <Header />
        <main className="min-h-screen">
          <div className="container mx-auto px-4 pt-24 pb-12">
            <div className="flex items-center gap-3 mb-8">
              <TrendingUp className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-display font-bold">Trending Anime</h1>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-muted-foreground">Failed to load trending anime. Please try again later.</p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <TrendingUp className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">Trending Anime</h1>
              <p className="text-muted-foreground">
                Most popular anime right now
              </p>
            </div>
          </div>

          {/* Anime Grid */}
          <Suspense fallback={<AnimeGridSkeleton count={24} />}>
            <AnimeGrid anime={anime} priorityFirst />
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
  title: "Trending",
  description: "Browse the most popular anime right now.",
};
