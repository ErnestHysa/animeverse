/**
 * Video Source Loader Component
 * Client component that fetches video sources from API and loads player
 */

"use client";

import { useState, useEffect } from "react";
import { EnhancedVideoPlayer, type VideoQuality } from "@/components/player/enhanced-video-player";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoSourceLoaderProps {
  animeId: number;
  episodeNumber: number;
  animeTitle?: string;
  poster?: string;
  nextEpisodeUrl?: string;
  onError?: (error: Error) => void;
  onEpisodeEnd?: () => void;
}

export function VideoSourceLoader({
  animeId,
  episodeNumber,
  animeTitle,
  poster,
  nextEpisodeUrl,
  onError,
  onEpisodeEnd,
}: VideoSourceLoaderProps) {
  const [sources, setSources] = useState<{
    type: "magnet" | "torrent" | "direct";
    url: string;
    qualities?: VideoQuality[];
  } | null>(null);
  const [allServers, setAllServers] = useState<Array<{
    id: string;
    name: string;
    url: string;
    quality: string;
    type: "mp4" | "hls" | "webm";
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Language options (typically Sub/Dub)
  const allLanguages = [
    { id: "sub", label: "Subtitles", type: "sub" as const },
    { id: "dub", label: "Dubbed", type: "dub" as const },
  ];

  // Server change handler
  const handleServerChange = (serverId: string) => {
    const server = allServers.find((s) => s.id === serverId);
    if (server) {
      // Reload video with new server
      setSources({
        type: "direct",
        url: server.url,
        qualities: sources?.qualities || [],
      });
    }
  };

  // Language change handler
  const handleLanguageChange = (languageId: string) => {
    // In production, this would fetch a different source for Dub/Sub
    // For now, we show a toast message
    console.log(`Language changed to: ${languageId}`);
  };

  useEffect(() => {
    async function fetchSources() {
      setLoading(true);
      setError(null);

      try {
        const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, window.location.origin);

        if (animeTitle) {
          url.searchParams.set("title", animeTitle);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error(`Failed to fetch sources: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.sources || data.sources.length === 0) {
          throw new Error("No video sources found");
        }

        // Group sources by quality for quality selector
        const qualities: VideoQuality[] = data.sources.map((s: any) => ({
          url: s.url,
          quality: s.quality,
          label: s.label || s.quality,
          size: s.size,
        }));

        // Create server options for server selector
        const serverOptions: Array<{
          id: string;
          name: string;
          url: string;
          quality: string;
          type: "mp4" | "hls" | "webm";
        }> = [];

        // Group by provider and quality to create server options
        const uniqueQualities = [...new Set(data.sources.map((s: any) => s.quality))];
        uniqueQualities.forEach((quality) => {
          const sourceForQuality = data.sources.find((s: any) => s.quality === quality);
          if (sourceForQuality) {
            serverOptions.push({
              id: `${data.provider}-${quality}`,
              name: `${data.provider || "Server"} - ${quality}`,
              url: sourceForQuality.url,
              quality: sourceForQuality.quality,
              type: sourceForQuality.type || "mp4",
            });
          }
        });

        // Find the best quality source as the default
        const defaultSource = data.sources.find((s: any) => s.quality === "1080p") ||
                            data.sources.find((s: any) => s.quality === "720p") ||
                            data.sources[0];

        setAllServers(serverOptions);
        setSources({
          type: "direct",
          url: defaultSource.url,
          qualities,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load video sources";
        setError(message);
        onError?.(new Error(message));
      } finally {
        setLoading(false);
      }
    }

    fetchSources();
  }, [animeId, episodeNumber, animeTitle, onError]);

  // Loading state
  if (loading) {
    return (
      <GlassCard className="aspect-video flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading video sources...</p>
        </div>
      </GlassCard>
    );
  }

  // Error state
  if (error || !sources) {
    return (
      <GlassCard className="aspect-video flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Failed to Load Video</h3>
          <p className="text-muted-foreground mb-6">{error || "No video sources available"}</p>
          <Button onClick={() => window.location.reload()} variant="default">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </GlassCard>
    );
  }

  // Success - render player
  return (
    <EnhancedVideoPlayer
      source={sources}
      poster={poster}
      animeId={animeId}
      episodeNumber={episodeNumber}
      nextEpisodeUrl={nextEpisodeUrl}
      onError={onError}
      onEpisodeEnd={onEpisodeEnd}
      allServers={allServers}
      allLanguages={allLanguages}
      onServerChange={handleServerChange}
      onLanguageChange={handleLanguageChange}
    />
  );
}
