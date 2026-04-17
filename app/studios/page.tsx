/**
 * Studios Browse Page
 * Browse anime by animation studio
 */

export const dynamic = "force-dynamic";

import { Header } from "@/components/layout/header";

import { Footer } from "@/components/layout/footer";

import { anilist } from "@/lib/anilist";

import { Building2, Tv } from "lucide-react";

import { GlassCard } from "@/components/ui/glass-card";

import { ImageWithFallback } from "@/components/ui/image-with-fallback";

import Link from "next/link";

export const metadata = {
  title: "Browse Studios",
  description: "Browse anime by your favorite animation studios.",
};

async function getStudios() {
  const result = await anilist.getStudios(1, 50);
  return result.data?.Page.studios ?? [];
}

export default async function StudiosPage() {
  const studios = await getStudios();

  // Filter only animation studios with at least one anime
  const animationStudios = studios.filter(
    (studio) => studio.isAnimationStudio && studio.media.nodes.length > 0
  );

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold">Animation Studios</h1>
              <p className="text-muted-foreground">
                Browse anime by your favorite animation studios
              </p>
            </div>
          </div>

          {/* Info Card */}
          <GlassCard className="p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              Explore anime from the world&apos;s most popular animation studios.
              From industry giants like Bones and Madhouse to niche studios known for unique styles.
            </p>
          </GlassCard>

          {/* Studios Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {animationStudios.map((studio) => {
              const animeCount = studio.media.nodes.length;
              const topAnime = studio.media.nodes.slice(0, 3);
              const avgScore = topAnime.reduce((sum, anime) => sum + (anime.averageScore || 0), 0) / topAnime.length;

              return (
                <Link key={studio.id} href={`/studios/${studio.id}`} className="group">
                  <GlassCard className="h-full transition-all hover:ring-2 hover:ring-primary/50">
                    {/* Top Anime Preview */}
                    <div className="grid grid-cols-3 gap-1 p-3">
                      {topAnime.map((anime) => (
                        <div key={anime.id} className="relative aspect-video rounded overflow-hidden bg-muted">
                          <ImageWithFallback
                            src={anime.coverImage.large || anime.coverImage.medium || ""}
                            alt={anime.title.userPreferred || anime.title.romaji || ""}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform"
                            sizes="100px"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Studio Info */}
                    <div className="p-4 pt-2">
                      <h3 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                        {studio.name}
                      </h3>

                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Tv className="w-4 h-4" />
                          <span>{animeCount} anime</span>
                        </div>
                        {avgScore > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-400">★</span>
                            <span>{Math.round(avgScore / 10)}/10</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </Link>
              );
            })}
          </div>

          {/* Empty State */}
          {animationStudios.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No Studios Found</h3>
              <p className="text-muted-foreground max-w-sm">
                Unable to load studios at this time. Please try again later.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

export const revalidate = 3600; // Revalidate every hour
