/**
 * Watch Page
 * Enhanced video player with episode list, autoplay, and navigation
 */
export const dynamic = "force-dynamic";


import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { VideoSourceLoader } from "@/components/player/video-source-loader";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ShareButton } from "@/components/player/share-dialog";
import { ReportButton } from "@/components/player/report-dialog";
import { KeyboardShortcutsButton } from "@/components/player/keyboard-shortcuts";
import { ImageWithFallback } from "@/components/ui/image-with-fallback";
import { EpisodeList } from "@/components/player/episode-list";
import { anilist, getAnimeTitle } from "@/lib/anilist";
import { sanitizeDescription } from "@/lib/html-sanitizer";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { Media } from "@/types/anilist";
import { Suspense } from "react";
import { VideoPlayerSkeleton, EpisodeListSkeleton, AnimeGridSkeleton } from "@/components/ui/skeleton";
import { EpisodeCommentsSection } from "@/components/watch/episode-comments-section";

// ===================================
// Link Button Wrappers
// ===================================

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="no-underline">
      <Button>
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
    animeId: string;
    episode: string;
  }>;
}

async function getAnimeData(id: string): Promise<Media | null> {
  try {
    const result = await anilist.getById(parseInt(id));
    return result.data?.Media ?? null;
  } catch {
    return null;
  }
}

/** Minimal placeholder used when AniList is unreachable */
function makeStubAnime(animeId: string): Media {
  const id = parseInt(animeId, 10) || 0;
  return {
    id,
    idMal: null,
    title: { english: null, romaji: `Anime #${id}`, native: null },
    description: null,
    coverImage: { large: null, extraLarge: null, color: null },
    bannerImage: null,
    episodes: 99,
    format: "TV",
    status: "RELEASING",
    seasonYear: null,
    season: null,
    genres: [],
    averageScore: null,
    popularity: null,
    studios: null,
    nextAiringEpisode: null,
    relations: null,
    recommendations: null,
  } as unknown as Media;
}

// ===================================
// Components
// ===================================

async function VideoSection({ anime, episodeNum }: { anime: Media; episodeNum: number }) {
  const title = getAnimeTitle(anime);
  // Use English title for video API since AnimeKai indexes by English titles
  const englishTitle = anime.title?.english || anime.title?.romaji || title;
  const totalEpisodes = anime.episodes || 12;
  const hasNext = episodeNum < totalEpisodes;
  const hasPrev = episodeNum > 1;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground overflow-x-auto">
        <Link href="/" className="hover:text-foreground transition-colors flex-shrink-0">
          Home
        </Link>
        <span className="flex-shrink-0">›</span>
        <Link href={`/anime/${anime.id}`} className="hover:text-foreground transition-colors truncate max-w-[150px] flex-shrink-0">
          {title}
        </Link>
        <span className="flex-shrink-0">›</span>
        <span className="text-foreground flex-shrink-0">Episode {episodeNum}</span>
      </div>

      {/* Player */}
      <VideoSourceLoader
        animeId={anime.id}
        episodeNumber={episodeNum}
        animeTitle={englishTitle}
        malId={anime.idMal || null}
        poster={anime.coverImage?.extraLarge || undefined}
        nextEpisodeUrl={hasNext ? `/watch/${anime.id}/${episodeNum + 1}` : undefined}
        prevEpisodeUrl={hasPrev ? `/watch/${anime.id}/${episodeNum - 1}` : undefined}
      />

      {/* Episode Info & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {title} - Episode {episodeNum}
          </h1>
          <p className="text-muted-foreground mt-1">
            {anime.format && anime.format.replace("_", " ")} • {anime.seasonYear}
          </p>
        </div>

        {/* Navigation & Actions */}
        <div className="flex items-center gap-2">
          {hasPrev && (
            <Link href={`/watch/${anime.id}/${episodeNum - 1}`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>
            </Link>
          )}
          {hasNext && (
            <Link href={`/watch/${anime.id}/${episodeNum + 1}`}>
              <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 rounded-lg transition-colors">
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </Link>
          )}

          {/* Quick Actions */}
          <div className="hidden sm:flex items-center gap-2">
            <ReportButton
              animeId={anime.id}
              animeTitle={title}
              episodeNumber={episodeNum}
            />
            <ShareButton
              title={`${title} - Episode ${episodeNum}`}
            />
            <KeyboardShortcutsButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function EpisodesList({ anime, currentEpisode }: { anime: Media; currentEpisode: number }) {
  const totalEpisodes = anime.episodes || 12;

  return (
    <EpisodeList
      animeId={anime.id}
      malId={anime.idMal}
      totalEpisodes={totalEpisodes}
      currentEpisode={currentEpisode}
    />
  );
}

async function AnimeInfo({ anime }: { anime: Media }) {
  const title = getAnimeTitle(anime);

  return (
    <GlassCard className="p-4">
      <Link href={`/anime/${anime.id}`} className="flex gap-4 group">
        <div className="relative w-20 h-28 flex-shrink-0 rounded-lg overflow-hidden bg-muted">
          <ImageWithFallback
            src={anime.coverImage?.large || ""}
            alt={title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="80px"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
            {sanitizeDescription(anime.description?.slice(0, 150))}...
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {anime.genres?.slice(0, 3).map((genre: string) => (
              <span
                key={genre}
                className="px-2 py-1 bg-white/5 rounded text-xs"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </Link>

      {anime.genres && anime.genres.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-muted-foreground mb-2">Genres</p>
          <div className="flex flex-wrap gap-1">
            {anime.genres.slice(0, 6).map((genre: string) => (
              <span
                key={genre}
                className="px-2 py-1 bg-white/5 rounded text-xs"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

async function RecommendedSection({ animeId }: { animeId: number }) {
  const result = await anilist.getRecommendations(animeId);
  const recommendations = (result.data?.Media as { recommendations?: { nodes?: { mediaRecommendation?: Media }[] } } | null)?.recommendations?.nodes
    ?.map((n) => n.mediaRecommendation)
    .filter((media): media is Media => Boolean(media));

  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-6">
      <h3 className="font-semibold mb-4">You May Also Like</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {recommendations.slice(0, 8).map((rec) => (
          <Link
            key={rec.id}
            href={`/anime/${rec.id}`}
            className="group"
          >
            <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-2">
              <ImageWithFallback
                src={rec.coverImage?.large || ""}
                alt={rec.title?.romaji || rec.title?.english || "Unknown"}
                fill
                className="object-cover transition-transform group-hover:scale-105"
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            </div>
            <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
              {rec.title?.romaji || rec.title?.english || "Unknown"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ===================================
// Page Component
// ===================================

export default async function WatchPage({ params }: PageProps) {
  const { animeId, episode } = await params;
  // Fall back to a stub when AniList is unreachable so the player still renders
  const anime = (await getAnimeData(animeId)) ?? makeStubAnime(animeId);
  const episodeNum = parseInt(episode, 10);

  const totalEpisodes = anime.episodes || 12;

  // Validate episode number is a valid integer
  if (isNaN(episodeNum) || episodeNum < 1 || episodeNum > totalEpisodes) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Episode Not Found</h1>
            <p className="text-muted-foreground mb-4">
              This episode doesn&apos;t exist or hasn&apos;t been released yet.
            </p>
            <LinkButton href={`/anime/${animeId}`}>Back to Anime</LinkButton>
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <Suspense fallback={<VideoPlayerSkeleton />}>
                <VideoSection anime={anime} episodeNum={episodeNum} />
              </Suspense>

              <Suspense fallback={<AnimeGridSkeleton count={8} />}>
                <RecommendedSection animeId={anime.id} />
              </Suspense>

              {/* Episode Comments */}
              <EpisodeCommentsSection animeId={anime.id} episodeNumber={episodeNum} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Suspense fallback={<EpisodeListSkeleton />}>
                <EpisodesList anime={anime} currentEpisode={episodeNum} />
              </Suspense>

              <Suspense fallback={<div className="rounded-xl p-4 bg-muted/30 animate-pulse h-48" />}>
                <AnimeInfo anime={anime} />
              </Suspense>
            </div>
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
  const { animeId, episode } = await params;
  const anime = (await getAnimeData(animeId)) ?? makeStubAnime(animeId);
  const title = getAnimeTitle(anime);

  return {
    title: `Watching ${title} - Episode ${episode}`,
    description: `Watch ${title} Episode ${episode} online.`,
  };
}
