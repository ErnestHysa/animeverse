/**
 * Popular Anime Page
 * All-time most popular anime with pagination
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { AnimeGrid } from "@/components/anime/anime-grid";

import { AnimeGridSkeleton } from "@/components/ui/skeleton";

import { anilist } from "@/lib/anilist";

import { Star } from "lucide-react";

import { Suspense } from "react";

// ===================================
// Data Fetching
// ===================================

async function getPopularAnime() {
  const result = await anilist.getPopular(1, 48);
  return result.data?.Page.media ?? [];
}

// ===================================
// Page Component
// ===================================

export default async function PopularPage() {
  let anime;
  try {
    anime = await getPopularAnime();
  } catch (error) {
    console.error('Failed to load popular anime:', error);
    return (
      <>
        <Header />
        <main className="min-h-screen">
          <div className="container mx-auto px-4 pt-24 pb-12">
            <div className="flex items-center gap-3 mb-8">
              <Star className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-display font-bold">All Time Popular</h1>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg text-muted-foreground">Failed to load popular anime. Please try again later.</p>
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
            <Star className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-display font-bold">All Time Popular</h1>
              <p className="text-muted-foreground">
                The most popular anime of all time, ranked by community votes
              </p>
            </div>
          </div>

          {/* Grid */}
          <Suspense fallback={<AnimeGridSkeleton count={48} />}>
            <AnimeGrid anime={anime} />
          </Suspense>
        </div>
      </main>
      <Footer />
    </>
  );
}

export const metadata = {
  title: "All Time Popular Anime",
  description: "Browse the most popular anime of all time, ranked by community votes.",
};
