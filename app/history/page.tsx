/**
 * Watch History Page
 * Displays user's watch history with continue watching functionality
 */

"use client";

import { useStore } from "@/store";
import { Clock, Play, Trash2, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimeCard } from "@/components/anime/anime-card";
import { GlassCard } from "@/components/ui/glass-card";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { formatDistanceToNow } from "@/lib/utils";
import Link from "next/link";

export default function HistoryPage() {
  const { watchHistory, mediaCache, clearWatchHistory, clearMediaHistory, anilistMediaList, isAuthenticated } = useStore();

  // Get unique anime from watch history (most recent first)
  const uniqueHistory = watchHistory
    .sort((a, b) => b.timestamp - a.timestamp)
    .filter((item, index, self) =>
      index === self.findIndex((t) => t.mediaId === item.mediaId)
    );

  // Group by completion status
  const inProgress = uniqueHistory.filter((item) => !item.completed);
  const completed = uniqueHistory.filter((item) => item.completed);

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all watch history?")) {
      clearWatchHistory();
    }
  };

  const handleClearMedia = (mediaId: number) => {
    if (confirm("Remove this anime from history?")) {
      clearMediaHistory(mediaId);
    }
  };

  if (uniqueHistory.length === 0) {
    return (
      <>
        <Header />
        <main className="min-h-screen">
          <div className="container mx-auto px-4 pt-24 pb-12">
            <GlassCard className="max-w-2xl mx-auto p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <Clock className="w-12 h-12 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-3">No Watch History</h2>
              <p className="text-muted-foreground mb-6">
                Start watching anime to build your history. Your progress will be automatically saved.
              </p>
              {isAuthenticated && anilistMediaList.length > 0 ? (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    You have {anilistMediaList.length} anime synced from AniList.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Link href="/">
                      <Button>Browse Anime</Button>
                    </Link>
                    <Link href="/settings">
                      <Button variant="outline">Go to Settings</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <Link href="/">
                  <Button>Browse Anime</Button>
                </Link>
              )}
            </GlassCard>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Watch History</h1>
          <p className="text-muted-foreground">
            {uniqueHistory.length} {uniqueHistory.length === 1 ? "anime" : "anime"} in your history
          </p>
        </div>
        {uniqueHistory.length > 0 && (
          <Button variant="outline" onClick={handleClearAll}>
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        )}
      </div>

      {/* Continue Watching */}
      {inProgress.length > 0 ? (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Play className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Continue Watching</h2>
            <span className="text-sm text-muted-foreground">
              ({inProgress.length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {inProgress.map((item) => {
              const media = mediaCache[item.mediaId];
              if (!media) return null;

              const progressPercent = item.progress
                ? Math.min(100, (item.progress / (media.episodes || 24 * 60)) * 100)
                : 0;

              return (
                <div key={item.mediaId} className="group relative">
                  <AnimeCard anime={media} />
                  <div className="mt-2">
                    <p className="text-sm font-medium truncate">
                      Episode {item.episodeNumber}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(progressPercent)}%
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(item.timestamp))} ago
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleClearMedia(item.mediaId)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 bg-black/50 hover:bg-black/70"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ) : completed.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Play className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Continue Watching</h2>
          </div>
          <div className="text-center py-12 bg-white/5 rounded-lg">
            <p className="text-muted-foreground">No anime in progress. Start watching something to see it here!</p>
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <div className="flex items-center gap-3 mb-6">
            <Film className="w-6 h-6 text-green-500" />
            <h2 className="text-2xl font-bold">Completed</h2>
            <span className="text-sm text-muted-foreground">
              ({completed.length})
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {completed.map((item) => {
              const media = mediaCache[item.mediaId];
              if (!media) return null;

              return (
                <div key={item.mediaId} className="group relative">
                  <AnimeCard anime={media} />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    <div className="text-center p-4">
                      <p className="text-green-400 font-bold mb-1">Completed</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.timestamp))} ago
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleClearMedia(item.mediaId)}
                        className="mt-3"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
      </main>
      <Footer />
    </>
  );
}
