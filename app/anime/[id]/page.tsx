/**
 * Anime Detail Page
 * Full anime information with episodes and recommendations
 */

import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimeCardCompact } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { EpisodeGridSkeleton } from "@/components/ui/skeleton";
import { anilist, getAnimeTitle, getAnimeCover, getNextAiringTime } from "@/lib/anilist";
import { Play, Star, Clock, Calendar, Tv, ExternalLink } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { AnimeActions } from "@/components/anime/anime-actions";
import { CommentsSection } from "@/components/comments/comments-section";
import type { Media } from "@/types/anilist";

// ===================================
// Link Button Wrappers
// ===================================

function WatchLinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="no-underline">
      <Button size="lg">
        {children}
      </Button>
    </Link>
  );
}

// ===================================
// Data Fetching
// ===================================

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getAnimeDetails(id: string) {
  const result = await anilist.getById(parseInt(id));
  return result.data?.Media;
}

// ===================================
// Components
// ===================================

async function HeroSection({ anime }: { anime: Media }) {
  const title = getAnimeTitle(anime);
  const cover = getAnimeCover(anime);
  const banner = anime.bannerImage;
  const nextAiring = getNextAiringTime(anime);

  return (
    <div className="relative">
      {/* Banner */}
      {banner && (
        <div className="relative h-[40vh] min-h-[300px]">
          <Image
            src={banner}
            alt={title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/50 to-transparent" />
        </div>
      )}

      <div className={banner ? "relative -mt-32" : ""}>
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover Image */}
            <div className="flex-shrink-0">
              <div className="relative w-48 md:w-64 aspect-[3/4] rounded-xl overflow-hidden shadow-2xl">
                <Image
                  src={cover}
                  alt={title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 192px, 256px"
                  priority
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 space-y-4">
              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-display font-bold text-gradient">
                {title}
              </h1>

              {/* Alternative Titles */}
              {(anime.title?.english || anime.title?.native) && (
                <p className="text-muted-foreground">
                  {anime.title?.english && anime.title.english !== title && (
                    <span>{anime.title.english}</span>
                  )}
                  {anime.title?.native && (
                    <span className="ml-2">{anime.title.native}</span>
                  )}
                </p>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {anime.status && (
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full text-sm font-medium">
                    {anime.status.replace("_", " ")}
                  </span>
                )}
                {anime.format && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    {anime.format.replace("_", " ")}
                  </span>
                )}
                {anime.season && anime.seasonYear && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-sm">
                    {anime.season} {anime.seasonYear}
                  </span>
                )}
              </div>

              {/* Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                {anime.averageScore && (
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <div>
                      <p className="font-medium">{anime.averageScore / 10}/10</p>
                      <p className="text-muted-foreground text-xs">Rating</p>
                    </div>
                  </div>
                )}
                {anime.episodes && (
                  <div className="flex items-center gap-2">
                    <Tv className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{anime.episodes} eps</p>
                      <p className="text-muted-foreground text-xs">Episodes</p>
                    </div>
                  </div>
                )}
                {anime.duration && (
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{anime.duration} min</p>
                      <p className="text-muted-foreground text-xs">Duration</p>
                    </div>
                  </div>
                )}
                {anime.seasonYear && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{anime.seasonYear}</p>
                      <p className="text-muted-foreground text-xs">Year</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Next Airing */}
              {nextAiring && (
                <div className="flex items-center gap-2 text-primary">
                  <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <span className="text-sm font-medium">{nextAiring}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-2">
                <WatchLinkButton href={`/watch/${anime.id}/1`}>
                  <span className="flex items-center gap-2">
                    <Play className="w-5 h-5" />
                    Watch Now
                  </span>
                </WatchLinkButton>
                <AnimeActions animeId={anime.id} animeTitle={title} />
              </div>

              {/* External Links */}
              {anime.externalLinks && anime.externalLinks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {anime.externalLinks.map((link, i: number) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg text-sm hover:bg-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>{link.site}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function InfoSection({ anime }: { anime: Media }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
      {/* Main Content */}
      <div className="lg:col-span-2 space-y-8">
        {/* Synopsis */}
        <GlassCard>
          <h2 className="text-xl font-semibold mb-4">Synopsis</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {anime.description || "No description available."}
          </p>
        </GlassCard>

        {/* Episodes */}
        <GlassCard>
          <h2 className="text-xl font-semibold mb-4">Episodes</h2>
          {anime.episodes ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {Array.from({ length: Math.min(anime.episodes, 24) }).map((_, i) => {
                const epNum = i + 1;
                return (
                  <Link
                    key={epNum}
                    href={`/watch/${anime.id}/${epNum}`}
                    className="group relative aspect-video rounded-lg overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Play className="w-8 h-8 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                      <span className="text-sm font-medium">Ep {epNum}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground">Episode information not available.</p>
          )}
        </GlassCard>

        {/* Characters */}
        {anime.characters?.edges && anime.characters.edges.length > 0 && (
          <GlassCard>
            <h2 className="text-xl font-semibold mb-4">Characters</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {anime.characters.edges.map((edge) => (
                <div key={edge.node.id} className="text-center">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                    <Image
                      src={edge.node.image.large}
                      alt={edge.node.name.full}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  </div>
                  <p className="text-sm font-medium truncate">{edge.node.name.full}</p>
                  <p className="text-xs text-muted-foreground">{edge.role}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* Stats */}
        <GlassCard>
          <h3 className="font-semibold mb-4">Statistics</h3>
          <div className="space-y-3 text-sm">
            {anime.averageScore && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Score</span>
                <span className="font-medium">{anime.averageScore / 10}/10</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ranked</span>
              <span className="font-medium">#{anime.popularity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Popularity</span>
              <span className="font-medium">{anime.popularity.toLocaleString()}</span>
            </div>
            {anime.favourites && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Favorites</span>
                <span className="font-medium">{anime.favourites.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Trending</span>
              <span className="font-medium">#{anime.trending}</span>
            </div>
          </div>
        </GlassCard>

        {/* Information */}
        <GlassCard>
          <h3 className="font-semibold mb-4">Information</h3>
          <div className="space-y-3 text-sm">
            {anime.format && (
              <div>
                <p className="text-muted-foreground">Format</p>
                <p className="font-medium">{anime.format.replace("_", " ")}</p>
              </div>
            )}
            {anime.episodes && (
              <div>
                <p className="text-muted-foreground">Episodes</p>
                <p className="font-medium">{anime.episodes}</p>
              </div>
            )}
            {anime.duration && (
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="font-medium">{anime.duration} minutes</p>
              </div>
            )}
            {anime.status && (
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium">{anime.status.replace("_", " ")}</p>
              </div>
            )}
            {anime.season && anime.seasonYear && (
              <div>
                <p className="text-muted-foreground">Season</p>
                <p className="font-medium">
                  {anime.season} {anime.seasonYear}
                </p>
              </div>
            )}
            {anime.studios?.nodes && anime.studios.nodes.length > 0 && (
              <div>
                <p className="text-muted-foreground">Studios</p>
                <p className="font-medium">{anime.studios.nodes.map((s) => s.name).join(", ")}</p>
              </div>
            )}
            {anime.source && (
              <div>
                <p className="text-muted-foreground">Source</p>
                <p className="font-medium">{anime.source.replace("_", " ")}</p>
              </div>
            )}
            {anime.countryOfOrigin && (
              <div>
                <p className="text-muted-foreground">Country</p>
                <p className="font-medium">{anime.countryOfOrigin}</p>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Genres */}
        {anime.genres && anime.genres.length > 0 && (
          <GlassCard>
            <h3 className="font-semibold mb-4">Genres</h3>
            <div className="flex flex-wrap gap-2">
              {anime.genres.map((genre: string) => (
                <Link
                  key={genre}
                  href={`/search?genre=${encodeURIComponent(genre)}`}
                  className="px-3 py-1.5 bg-primary/20 text-primary rounded-full text-sm hover:bg-primary/30 transition-colors"
                >
                  {genre}
                </Link>
              ))}
            </div>
          </GlassCard>
        )}

        {/* Tags */}
        {anime.tags && anime.tags.length > 0 && (
          <GlassCard>
            <h3 className="font-semibold mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {anime.tags.slice(0, 10).map((tag) => (
                <span
                  key={tag.id}
                  className="px-3 py-1.5 bg-white/5 rounded-full text-xs"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </GlassCard>
        )}
      </div>
    </div>
  );
}

async function RecommendationsSection({ animeId }: { animeId: number }) {
  const result = await anilist.getRecommendations(animeId);

  interface RecommendationNode {
    mediaRecommendation: Media | null;
  }

  interface RecommendationResponse {
    Media: {
      recommendations: {
        nodes: RecommendationNode[];
      } | null;
    } | null;
  }

  const recommendations = (result.data as RecommendationResponse | null)?.Media?.recommendations?.nodes
    ?.map((n) => n.mediaRecommendation)
    .filter((media): media is Media => media !== null);

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-display font-semibold mb-6">You May Also Like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {recommendations.map((anime) => (
          <AnimeCardCompact key={anime.id} anime={anime} />
        ))}
      </div>
    </div>
  );
}

async function RelationsSection({ anime }: { anime: Media }) {
  if (!anime.relations?.edges || anime.relations.edges.length === 0) {
    return null;
  }

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-display font-semibold mb-6">Relations</h2>
      <div className="space-y-3">
        {anime.relations.edges.map((edge, index: number) => (
          <AnimeCardCompact
            key={edge.node.id || index}
            anime={edge.node}
          />
        ))}
      </div>
    </div>
  );
}

// ===================================
// Page Component
// ===================================

export default async function AnimeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const anime = await getAnimeDetails(id);

  if (!anime) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Anime Not Found</h1>
            <p className="text-muted-foreground mb-4">
              The anime you&apos;re looking for doesn&apos;t exist.
            </p>
            <WatchLinkButton href="/">Go Home</WatchLinkButton>
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
        {/* Hero Section */}
        <Suspense fallback={<div className="h-[50vh] animate-pulse bg-muted" />}>
          <HeroSection anime={anime} />
        </Suspense>

        <div className="container mx-auto px-4 pb-12">
          {/* Info Section */}
          <Suspense fallback={<EpisodeGridSkeleton count={12} />}>
            <InfoSection anime={anime} />
          </Suspense>

          {/* Relations */}
          <Suspense>
            <RelationsSection anime={anime} />
          </Suspense>

          {/* Recommendations */}
          <Suspense>
            <RecommendationsSection animeId={anime.id} />
          </Suspense>

          {/* Comments & Reviews */}
          <div className="mt-12">
            <Suspense fallback={<EpisodeGridSkeleton count={4} />}>
              <CommentsSection animeId={anime.id} animeTitle={getAnimeTitle(anime)} />
            </Suspense>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

// ===================================
// Metadata
// ===================================

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const anime = await getAnimeDetails(id);

  if (!anime) {
    return {
      title: "Not Found",
    };
  }

  const title = getAnimeTitle(anime);
  const description = anime.description?.slice(0, 160) || `Watch ${title} online.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [getAnimeCover(anime)],
    },
  };
}
