/**
 * Video Source Loader Component
 * Client component that fetches video sources from API and loads player
 * Supports Sub/Dub switching with automatic re-fetching
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { EnhancedVideoPlayer, type VideoQuality } from "@/components/player/enhanced-video-player";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface VideoSourceLoaderProps {
  animeId: number;
  episodeNumber: number;
  animeTitle?: string;
  poster?: string;
  nextEpisodeUrl?: string;
  onError?: (error: Error) => void;
  onEpisodeEnd?: () => void;
}

interface LanguageOption {
  id: string;
  label: string;
  type: "sub" | "dub";
  available: boolean;
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
  const [allLanguages, setAllLanguages] = useState<LanguageOption[]>([
    { id: "sub", label: "Subtitles", type: "sub", available: true },
    { id: "dub", label: "Dubbed", type: "dub", available: false },
  ]);
  const [currentLanguage, setCurrentLanguage] = useState<"sub" | "dub">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("animeverse-currentLanguage");
      return (saved === "dub" ? "dub" : "sub");
    }
    return "sub";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch video sources from API
   * Uses the current language preference
   */
  const fetchSources = useCallback(async (language: "sub" | "dub") => {
    setLoading(true);
    setError(null);

    try {
      const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, window.location.origin);

      if (animeTitle) {
        url.searchParams.set("title", animeTitle);
      }
      url.searchParams.set("language", language);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Failed to fetch sources: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.sources || data.sources.length === 0) {
        throw new Error("No video sources found");
      }

      // Update available languages based on API response
      if (data.availableLanguages) {
        setAllLanguages((prev) =>
          prev.map((lang) => ({
            ...lang,
            available: data.availableLanguages.find(
              (al: any) => al.type === lang.type
            )?.available ?? lang.available,
          }))
        );
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

      const defaultSource =
        data.sources.find((s: any) => s.quality === "1080p") ||
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
  }, [animeId, episodeNumber, animeTitle, onError]);

  // Initial fetch and re-fetch when language changes
  useEffect(() => {
    fetchSources(currentLanguage);
  }, [fetchSources, currentLanguage]);

  /**
   * Server change handler - switches video source within current quality options
   */
  const handleServerChange = (serverId: string) => {
    const server = allServers.find((s) => s.id === serverId);
    if (server) {
      setSources({
        type: "direct",
        url: server.url,
        qualities: sources?.qualities || [],
      });
    }
  };

  /**
   * Language change handler - re-fetches sources with new language preference
   */
  const handleLanguageChange = async (languageId: string) => {
    const newLanguage = languageId as "sub" | "dub";

    // Check if the requested language is available
    const languageOption = allLanguages.find((l) => l.id === languageId);
    if (languageOption && !languageOption.available) {
      toast.error(
        `${languageOption.label} version is not available for this anime`,
        { id: "lang-unavailable" }
      );
      return;
    }

    // Save preference
    localStorage.setItem("animeverse-currentLanguage", newLanguage);
    setCurrentLanguage(newLanguage);

    // Show loading toast
    toast.loading(`Switching to ${newLanguage === "dub" ? "Dubbed" : "Subtitled"} version...`, {
      id: "lang-switch",
    });

    // Re-fetch sources with new language
    await fetchSources(newLanguage);

    toast.success(`Now playing ${newLanguage === "dub" ? "Dubbed" : "Subtitled"} version`, {
      id: "lang-switch",
    });
  };

  // Loading state
  if (loading) {
    return (
      <GlassCard className="aspect-video flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">
            Loading {currentLanguage === "dub" ? "Dubbed" : "Subtitled"} version...
          </p>
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
          <Button
            onClick={() => fetchSources(currentLanguage)}
            variant="default"
          >
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
