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
  malId?: number | null;
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
  malId,
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
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  // NEW: Subtitle state
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{
    url: string;
    lang: string;
    label: string;
  }>>([]);

  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  /**
   * Sleep utility for retry delay
   */
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Fetch video sources from API with retry logic
   * Uses the current language preference
   */
  const fetchSources = useCallback(async (language: "sub" | "dub", retryAttempt = 0) => {
    if (retryAttempt === 0) {
      setLoading(true);
      setError(null);
    } else {
      setIsRetrying(true);
    }

    try {
      const url = new URL(`/api/video-sources/${animeId}/${episodeNumber}`, window.location.origin);

      if (animeTitle) {
        url.searchParams.set("title", animeTitle);
      }
      if (malId) {
        url.searchParams.set("malId", malId.toString());
      }
      url.searchParams.set("language", language);

      const response = await fetch(url.toString());

      if (!response.ok) {
        if (response.status === 503) {
          // API unavailable error
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            errorData.message || "The video source API is currently unavailable. Please try again later."
          );
        }
        throw new Error(`Failed to fetch sources: ${response.statusText}`);
      }

      const data = await response.json();

      // Check for API unavailable error
      if (data.error === "API_UNAVAILABLE" || (!data.sources || data.sources.length === 0)) {
        const errorMessage = data.message || "No video sources found. The video API may be unavailable.";
        throw new Error(errorMessage);
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

      // CRITICAL: Extract and store subtitles
      if (data.subtitles && data.subtitles.length > 0) {
        setSubtitleTracks(data.subtitles);
      } else {
        setSubtitleTracks([]);
      }

      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const isRetryable = err instanceof Error && (
        err.message.includes("fetch") ||
        err.message.includes("network") ||
        err.message.includes("timeout") ||
        err.message.includes("503") ||
        err.message.includes("502") ||
        err.message.includes("API")
      );

      // Retry logic for retryable errors
      if (isRetryable && retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryAttempt); // Exponential backoff
        await sleep(delay);
        return fetchSources(language, retryAttempt + 1);
      }

      // Final error after all retries exhausted
      const message = err instanceof Error ? err.message : "Failed to load video sources";
      const errorMessage = retryAttempt > 0
        ? `${message} (Failed after ${MAX_RETRIES} retry attempts)`
        : message;
      setError(errorMessage);
      onError?.(new Error(errorMessage));
      setRetryCount(retryAttempt);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [animeId, episodeNumber, animeTitle, malId, onError]);

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
      <GlassCard className="aspect-video flex items-center justify-center animate-fadeIn">
        <div className="text-center">
          {/* Animated spinner with glow effect */}
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
            {/* Glow effect */}
            <div className="absolute inset-0 w-16 h-16 bg-primary/20 rounded-full animate-pulse-glow blur-xl" />
          </div>
          <p className="text-muted-foreground font-medium">
            {isRetrying
              ? `Retrying... (Attempt ${retryCount + 1}/${MAX_RETRIES})`
              : `Loading ${currentLanguage === "dub" ? "Dubbed" : "Subtitled"} version...`
            }
          </p>
          {/* Animated dots */}
          <div className="flex gap-1 justify-center mt-3">
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          {isRetrying && (
            <p className="text-xs text-muted-foreground mt-4 max-w-xs mx-auto">
              This is taking longer than usual. The server might be busy.
            </p>
          )}
        </div>
      </GlassCard>
    );
  }

  // Error state
  if (error || !sources) {
    const isApiUnavailable = error?.includes("API") || error?.includes("unavailable") || error?.includes("Consumet");
    const hasRetryFailed = error?.includes("Failed after") || retryCount >= MAX_RETRIES;

    return (
      <GlassCard className="aspect-video flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {hasRetryFailed ? "Still Having Trouble" : isApiUnavailable ? "Video Source API Unavailable" : "Failed to Load Video"}
          </h3>
          <p className="text-muted-foreground mb-4 text-sm">
            {error || "No video sources available"}
          </p>
          {hasRetryFailed && (
            <div className="text-xs text-muted-foreground mb-4 p-3 bg-white/5 rounded-lg">
              <p className="font-medium mb-2">Suggestions:</p>
              <ul className="text-left space-y-1">
                <li>• Check your internet connection</li>
                <li>• Try switching between Sub/Dub versions</li>
                <li>• The anime might not be available on this server</li>
                <li>• Try again in a few minutes</li>
              </ul>
            </div>
          )}
          {isApiUnavailable && !hasRetryFailed && (
            <p className="text-xs text-muted-foreground mb-6">
              The public video API is currently down. This is usually temporary.
            </p>
          )}
          <div className="flex gap-2 justify-center">
            <Button
              onClick={() => {
                setRetryCount(0);
                fetchSources(currentLanguage);
              }}
              variant="default"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            {allLanguages.find(l => l.id !== currentLanguage && l.available) && (
              <Button
                onClick={() => handleLanguageChange(currentLanguage === "sub" ? "dub" : "sub")}
                variant="outline"
              >
                Switch to {currentLanguage === "sub" ? "Dub" : "Sub"}
              </Button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  }

  // Success - render player
  return (
    <EnhancedVideoPlayer
      source={sources}
      poster={poster}
      animeTitle={animeTitle}
      animeId={animeId}
      episodeNumber={episodeNumber}
      nextEpisodeUrl={nextEpisodeUrl}
      onError={onError}
      onEpisodeEnd={onEpisodeEnd}
      allServers={allServers}
      allLanguages={allLanguages}
      onServerChange={handleServerChange}
      onLanguageChange={handleLanguageChange}
      subtitles={subtitleTracks}
    />
  );
}
