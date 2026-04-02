/**
 * Video Source Loader Component
 * Client component that fetches video sources from API and loads player
 * Supports Sub/Dub switching with automatic re-fetching
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EnhancedVideoPlayer, type VideoQuality } from "@/components/player/enhanced-video-player";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { usePreferences, useStore } from "@/store";
import { anilist } from "@/lib/anilist";
import logger from "@/lib/logger";

interface VideoSourceLoaderProps {
  animeId: number;
  episodeNumber: number;
  animeTitle?: string;
  malId?: number | null;
  poster?: string;
  nextEpisodeUrl?: string;
  prevEpisodeUrl?: string;
  onError?: (error: Error) => void;
  onEpisodeEnd?: () => void;
}

interface LanguageOption {
  id: string;
  label: string;
  type: "sub" | "dub";
  available: boolean;
}

interface AvailableLanguageResponse {
  type: "sub" | "dub";
  available: boolean;
}

interface ApiVideoSource {
  url: string;
  quality: VideoQuality["quality"];
  label?: string;
  size?: string;
  type?: "mp4" | "hls" | "webm";
}

interface VideoSourcesResponse {
  error?: string;
  message?: string;
  provider?: string;
  referer?: string;
  isFallback?: boolean;
  sources?: ApiVideoSource[];
  subtitles?: Array<{
    url: string;
    lang: string;
    label: string;
  }>;
  availableLanguages?: AvailableLanguageResponse[];
}

// Bandwidth-aware initial quality selection
function getPreferredQualityForNetwork(): string {
  if (typeof navigator === 'undefined') return 'auto';
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  if (!conn) return 'auto';
  if (conn.saveData) return '360p'; // Data saver mode
  if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') return '360p';
  if (conn.effectiveType === '3g') return '480p';
  return 'auto'; // 4g and above: auto/highest available
}

export function VideoSourceLoader({
  animeId,
  episodeNumber,
  animeTitle,
  malId,
  poster,
  nextEpisodeUrl,
  prevEpisodeUrl,
  onError,
  onEpisodeEnd,
}: VideoSourceLoaderProps) {
  const { preferences } = usePreferences();

  // AniList reverse-sync: push episode progress back to AniList when authenticated
  const anilistToken = useStore((s) => s.anilistToken);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const updateAniListEntryLocally = useStore((s) => s.updateAniListEntryLocally);
  const anilistSyncedRef = useRef(false); // prevent duplicate syncs per episode

  // MAL reverse-sync
  const malToken = useStore((s) => s.malToken);
  const malSyncedRef = useRef(false);

  const syncProgressToAniList = useCallback(async () => {
    if (!isAuthenticated || !anilistToken || anilistSyncedRef.current) return;
    anilistSyncedRef.current = true;
    try {
      const result = await anilist.saveMediaListEntry(anilistToken, animeId, episodeNumber, "CURRENT");
      if (result.error) {
        logger.warn("[AniList Sync] Failed:", result.error.message);
        return;
      }
      updateAniListEntryLocally(animeId, episodeNumber, "CURRENT");
      toast.success("Synced to AniList ✓", { duration: 2000, position: "bottom-right" });
    } catch (err) {
      logger.warn("[AniList Sync] Error:", err);
    }
  }, [isAuthenticated, anilistToken, animeId, episodeNumber, updateAniListEntryLocally]);

  const syncProgressToMAL = useCallback(async () => {
    if (!malToken || !malId || malSyncedRef.current) return;
    malSyncedRef.current = true;
    try {
      const { updateMALEntry } = await import("@/lib/mal-api");
      await updateMALEntry(malToken, malId, "watching", episodeNumber);
      logger.info("[MAL Sync] Pushed ep", episodeNumber, "malId", malId);
    } catch (err) {
      logger.warn("[MAL Sync] Error:", err);
    }
  }, [malToken, malId, episodeNumber]);

  // Reset sync flags when episode changes
  useEffect(() => {
    anilistSyncedRef.current = false;
    malSyncedRef.current = false;
  }, [animeId, episodeNumber]);

  const [sources, setSources] = useState<{
    type: "magnet" | "torrent" | "direct";
    url: string;
    qualities?: VideoQuality[];
    referer?: string;
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
      const saved =
        localStorage.getItem(`preferred-language-${animeId}`) ||
        localStorage.getItem("preferred-language") ||
        localStorage.getItem("animeverse-currentLanguage");
      return (saved === "dub" ? "dub" : "sub");
    }
    return "sub";
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [loadingSeconds, setLoadingSeconds] = useState(0);

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

      // 404 means anime/episode not found - don't retry
      if (response.status === 404) {
        throw new Error("This episode is not available. The anime may not be in our database yet.");
      }

      if (!response.ok) {
        if (response.status === 503) {
          // API unavailable error
          const errorData = await response.json().catch(
            (): VideoSourcesResponse => ({})
          );
          throw new Error(
            errorData.message || "The video source API is currently unavailable. Please try again later."
          );
        }
        throw new Error(`Failed to fetch sources: ${response.statusText}`);
      }

      const data: VideoSourcesResponse = await response.json();

      // Check for API unavailable error
      if (data.error === "API_UNAVAILABLE" || !data.sources || data.sources.length === 0) {
        const errorMessage = data.message || "No video sources found. The video API may be unavailable.";
        throw new Error(errorMessage);
      }

      // Check if this is a fallback video (demo mode)
      const isFallbackSource = data.isFallback === true;
      setIsFallback(isFallbackSource);

      // Update available languages based on API response
      if (data.availableLanguages) {
        const availableLanguages = data.availableLanguages;
        setAllLanguages((prev) =>
          prev.map((lang) => ({
            ...lang,
            available: availableLanguages.find(
              (availableLanguage) => availableLanguage.type === lang.type
            )?.available ?? lang.available,
          }))
        );
      }

      // Group sources by quality for quality selector
      const qualities: VideoQuality[] = data.sources.map((source) => ({
        url: source.url,
        quality: source.quality,
        label: source.label || source.quality,
        size: source.size,
      }));

      // Create server options for server selector
      const apiSources = data.sources;
      const serverOptions: Array<{
        id: string;
        name: string;
        url: string;
        quality: string;
        type: "mp4" | "hls" | "webm";
      }> = [];

      const uniqueQualities = [...new Set(apiSources.map((source) => source.quality))];
      uniqueQualities.forEach((quality) => {
        const sourceForQuality = apiSources.find((source) => source.quality === quality);
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

      // Determine initial quality: saved user preference takes priority,
      // then fall back to network-aware quality selection.
      const savedQuality = typeof window !== 'undefined'
        ? localStorage.getItem('animeverse-preferredQuality')
        : null;
      const preferredQuality =
        savedQuality ||
        (preferences.defaultQuality !== "auto" ? preferences.defaultQuality : null) ||
        getPreferredQualityForNetwork();

      const defaultSource =
        (preferredQuality !== 'auto'
          ? apiSources.find((source) => source.quality === preferredQuality)
          : null) ||
        apiSources.find((source) => source.quality === "1080p") ||
        apiSources.find((source) => source.quality === "720p") ||
        apiSources[0];

      setAllServers(serverOptions);
      const sourceUrl = defaultSource.url;
      setSources({
        type: "direct",
        url: sourceUrl,
        qualities,
        referer: data.referer,
      });

      // CRITICAL: Extract and store subtitles
      if (data.subtitles && data.subtitles.length > 0) {
        setSubtitleTracks(data.subtitles);
      } else {
        setSubtitleTracks([]);
      }

      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load video sources";

      // Check if error is retryable
      const isRetryable = err instanceof Error && (
        err.message.includes("fetch") ||
        err.message.includes("network") ||
        err.message.includes("timeout") ||
        err.message.includes("503") ||
        err.message.includes("502") ||
        err.message.includes("API")
      );

      // Don't retry 404 or "not available" errors
      const isFinalError = err instanceof Error && (
        err.message.includes("not available") ||
        err.message.includes("not in our database")
      );

      // Retry logic for retryable errors
      if (isRetryable && !isFinalError && retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryAttempt); // Exponential backoff
        await sleep(delay);
        return fetchSources(language, retryAttempt + 1);
      }

      // Final error after all retries exhausted or non-retryable error
      const finalMessage = retryAttempt > 0
        ? `${errorMessage} (Failed after ${MAX_RETRIES} retry attempts)`
        : errorMessage;
      setError(finalMessage);
      onError?.(new Error(finalMessage));
      setRetryCount(retryAttempt);
    } finally {
      setLoading(false);
      setIsRetrying(false);
    }
  }, [animeId, episodeNumber, animeTitle, malId, onError, preferences.defaultQuality]);

  // Reset loadingSeconds counter whenever a new load starts
  useEffect(() => {
    if (loading) {
      setLoadingSeconds(0);
    }
  }, [loading]);

  // Increment loadingSeconds every second while loading
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  // Auto-fallback to demo video after 12 seconds of loading
  useEffect(() => {
    if (loadingSeconds >= 12 && loading) {
      const demoSources = [
        { url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', quality: 'auto' as const, label: 'Demo (Sintel)' }
      ];
      setSources({ type: 'direct', url: demoSources[0].url, qualities: demoSources });
      setIsFallback(true);
      setLoading(false);
    }
  }, [loadingSeconds, loading]);

  // Initial fetch and re-fetch when language changes
  useEffect(() => {
    fetchSources(currentLanguage);
  }, [fetchSources, currentLanguage]);

  // Track current server index for automatic fallback
  const [currentServerIndex, setCurrentServerIndex] = useState(0);

  /**
   * Server change handler - switches video source within current quality options
   */
  const handleServerChange = (serverId: string) => {
    const server = allServers.find((s) => s.id === serverId);
    if (server) {
      const serverIndex = allServers.findIndex((s) => s.id === serverId);
      setCurrentServerIndex(serverIndex);
      setSources({
        type: "direct",
        url: server.url,
        qualities: sources?.qualities || [],
        referer: sources?.referer,
      });
    }
  };

  /**
   * Video player error handler - tries next server automatically on media errors
   */
  const handleVideoError = (error: Error) => {
    const errorMessage = error.message.toLowerCase();

    // Check if this is a media/parsing error (should try next server)
    const isMediaError =
      errorMessage.includes("media") ||
      errorMessage.includes("parsing") ||
      errorMessage.includes("transmuxer") ||
      errorMessage.includes("fragment");

    if (isMediaError && currentServerIndex < allServers.length - 1) {
      // Try the next server in the list
      const nextServer = allServers[currentServerIndex + 1];
      logger.info(`Media error detected, trying next server: ${nextServer.name}`);
      toast.loading(`Trying next server...`, { id: "server-fallback" });

      setCurrentServerIndex(currentServerIndex + 1);
      setSources({
        type: "direct",
        url: nextServer.url,
        qualities: sources?.qualities || [],
        referer: sources?.referer,
      });

      toast.success(`Switched to ${nextServer.name}`, { id: "server-fallback" });
      return; // Don't propagate error - we're handling it
    }

    // If we've tried all servers or it's not a media error, propagate to parent
    console.warn("[VideoSourceLoader] All servers failed or non-recoverable error");
    onError?.(error);
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
    localStorage.setItem("preferred-language", newLanguage);
    localStorage.setItem(`preferred-language-${animeId}`, newLanguage);
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
    const isSlow = loadingSeconds >= 8;
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
          {/* Progress indicator */}
          {!isRetrying && (
            <p className="text-xs text-muted-foreground mt-3">
              {loadingSeconds}s elapsed
            </p>
          )}
          {isSlow && (
            <div className="mt-4 max-w-xs mx-auto space-y-3">
              <p className="text-xs text-yellow-400">
                This is taking longer than expected. The video source may be unavailable.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const demoSources = [
                    { url: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8', quality: 'auto' as const, label: 'Demo (Sintel)' }
                  ];
                  setSources({ type: 'direct', url: demoSources[0].url, qualities: demoSources });
                  setIsFallback(true);
                  setLoading(false);
                }}
              >
                Use Demo Video
              </Button>
            </div>
          )}
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
    <div className="space-y-4">
      {/* Fallback notice */}
      {isFallback && (
        <GlassCard className="p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-yellow-500">Demo Mode</h4>
              <p className="text-sm text-muted-foreground mt-1">
                The requested anime is not currently available. Showing a demo video instead.
                This typically happens when the anime isn&apos;t in our database yet.
              </p>
            </div>
            <Button
              onClick={() => {
                setRetryCount(0);
                setIsFallback(false);
                fetchSources(currentLanguage);
              }}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </GlassCard>
      )}

      <EnhancedVideoPlayer
        source={sources}
        poster={poster}
        animeTitle={animeTitle}
        animeId={animeId}
        episodeNumber={episodeNumber}
        malId={malId}
        nextEpisodeUrl={nextEpisodeUrl}
        prevEpisodeUrl={prevEpisodeUrl}
        onError={handleVideoError}
        onEpisodeEnd={() => {
          syncProgressToAniList();
          syncProgressToMAL();
          onEpisodeEnd?.();
        }}
        allServers={allServers}
        allLanguages={allLanguages}
        onServerChange={handleServerChange}
        onLanguageChange={handleLanguageChange}
        subtitles={subtitleTracks}
      />
    </div>
  );
}
