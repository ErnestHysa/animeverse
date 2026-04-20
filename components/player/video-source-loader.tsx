/**
 * Video Source Loader Component
 * Client component that fetches video sources from API and loads player
 * Supports Sub/Dub switching with automatic re-fetching
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { EnhancedVideoPlayer, type VideoQuality as PlayerVideoQuality } from "@/components/player/enhanced-video-player";
import { GlassCard } from "@/components/ui/glass-card";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { usePreferences, useStore } from "@/store";
import { anilist } from "@/lib/anilist";
import logger from "@/lib/logger";
import { loadStream, cancelStreamAttempt, type StreamingMethod, type StreamSource, type VideoQuality } from "@/lib/hybrid-stream-manager";

// Static style constants to avoid recreating objects on every render
const ANIMATION_DELAY_0 = { animationDelay: "0ms" };
const ANIMATION_DELAY_150 = { animationDelay: "150ms" };
const ANIMATION_DELAY_300 = { animationDelay: "300ms" };

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
  previewMode?: boolean;
  previewAvailable?: boolean;
}

const DEMO_PREVIEW_SOURCES: PlayerVideoQuality[] = [
  {
    url: "https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8",
    quality: "auto",
    label: "Preview (Sintel)",
  },
];

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
  const getPerAnimePref = useStore((s) => s.getPerAnimePref);

  // AniList reverse-sync: push episode progress back to AniList when authenticated
  const anilistToken = useStore((s) => s.anilistToken);
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const updateAniListEntryLocally = useStore((s) => s.updateAniListEntryLocally);
  const anilistSyncedRef = useRef(false); // prevent duplicate syncs per episode

  // MAL reverse-sync
  const malToken = useStore((s) => s.malToken);
  const malSyncedRef = useRef(false);

  // Get per-anime streaming preference (overrides global preference)
  // Fix M10: Extract scalar values to avoid unstable object reference in deps
  const perAnimePref = getPerAnimePref(animeId);
  const perAnimeStreamingMethod = perAnimePref?.streamingMethod;
  const effectiveStreamingMethod = perAnimeStreamingMethod || preferences.streamingMethod;

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

  const [sources, setSources] = useState<StreamSource | null>(null);
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
  const [currentStreamingMethod, setCurrentStreamingMethod] = useState<StreamingMethod>("hls");
  const [fallbackOccurred, setFallbackOccurred] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [previewAvailable, setPreviewAvailable] = useState(false);

  // Fix H7: Request generation counter to cancel stale fetches
  const fetchGenerationRef = useRef(0);

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
   * Fetch video sources using hybrid fallback system
   * Tries primary method (user preference) then falls back to secondary
   */
  const fetchSources = useCallback(async (language: "sub" | "dub", retryAttempt = 0) => {
    // Fix H7: Bump generation to invalidate stale requests
    const currentGeneration = ++fetchGenerationRef.current;

    if (retryAttempt === 0) {
      setLoading(true);
      setError(null);
      setFallbackOccurred(false);
      setFallbackReason(null);
      setPreviewAvailable(false);
    } else {
      setIsRetrying(true);
    }

    try {
      // Get effective streaming method (per-anime preference overrides global)
      const preferredMethod = effectiveStreamingMethod === "direct" ? "hls" : effectiveStreamingMethod;

      logger.info(
        `[VideoSourceLoader] Fetching sources for anime ${animeId} episode ${episodeNumber}`,
        { method: preferredMethod, language, perAnimeOverride: !!perAnimePref?.streamingMethod }
      );

      // Use hybrid stream manager
      const result = await loadStream({
        primaryMethod: preferredMethod,
        animeId,
        episodeNumber,
        language,
        animeTitle,
        malId,
        timeoutWebTorrent: 30000, // 30 seconds
        timeoutHLS: 15000, // 15 seconds
        onFallback: (from, to, reason) => {
          logger.warn(`[VideoSourceLoader] Fallback from ${from} to ${to}: ${reason}`);
          setFallbackOccurred(true);
          setFallbackReason(reason);
          toast.loading(`Switching to ${to === "hls" ? "HLS" : "P2P"} streaming...`, {
            id: "stream-fallback",
          });
        },
      });

      // Fix H7: Bail if a newer fetch has started
      if (currentGeneration !== fetchGenerationRef.current) return;

      if (result.error) {
        throw result.error;
      }

      if (!result.source) {
        throw new Error("No video sources available");
      }

      // Update available languages (for HLS sources)
      if (result.source.type === "direct") {
        // For HLS, we need to check available languages
        // This is handled by the API response
      }

      // Convert source to expected format
      const qualities: PlayerVideoQuality[] = (result.source?.qualities?.map((q) => ({
        url: q.url,
        quality: q.quality as PlayerVideoQuality["quality"],
        label: q.label,
        size: q.size,
      })) || []) as PlayerVideoQuality[];

      // Create server options for server selector
      const serverOptions: Array<{
        id: string;
        name: string;
        url: string;
        quality: string;
        type: "mp4" | "hls" | "webm";
      }> = [];

      if (result.source?.qualities) {
        const source = result.source; // Non-null assertion for the block
        const qualities = source.qualities ?? [];
        const uniqueQualities = [...new Set(qualities.map((q) => q.quality))];
        uniqueQualities.forEach((quality) => {
          const qualitySource = qualities.find((q) => q.quality === quality);
          if (qualitySource) {
            serverOptions.push({
              id: `${source.provider || "server"}-${quality}`,
              name: `${source.provider || "Server"} - ${quality}${source.seeders ? ` (${source.seeders} seeders)` : ""}`,
              url: qualitySource.url,
              quality: qualitySource.quality,
              type: source.type === "magnet" ? "mp4" : "hls",
            });
          }
        });
      }

      // Determine initial quality
      const savedQuality = typeof window !== 'undefined'
        ? localStorage.getItem('animeverse-preferredQuality')
        : null;
      const preferredQuality =
        savedQuality ||
        (preferences.defaultQuality !== "auto" ? preferences.defaultQuality : null) ||
        getPreferredQualityForNetwork();

      const defaultQuality =
        result.source?.qualities?.find((q) => q.quality === preferredQuality)?.url ||
        result.source?.qualities?.find((q) => q.quality === "1080p")?.url ||
        result.source?.qualities?.find((q) => q.quality === "720p")?.url ||
        result.source?.url;

      setAllServers(serverOptions);
      setSources({
        type: result.source.type,
        url: defaultQuality || result.source.url,
        qualities,
        referer: result.source.referer,
      });

      setCurrentStreamingMethod(result.method);

      // Handle fallback notification
      if (result.fallbackOccurred) {
        toast.success(`Now streaming via ${result.method === "hls" ? "HLS" : "P2P"}`, {
          id: "stream-fallback",
          duration: 3000,
        });
      }

      // Reset subtitle tracks (will be loaded by player)
      setSubtitleTracks([]);
      setIsFallback(false);

      setRetryCount(0); // Reset retry count on success
    } catch (err) {
      // Fix H7: Bail if a newer fetch has started
      if (currentGeneration !== fetchGenerationRef.current) return;

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
        err.message.includes("not in our database") ||
        err.message.includes("No playable sources found")
      );

      // Retry logic for retryable errors
      if (isRetryable && !isFinalError && retryAttempt < MAX_RETRIES) {
        const delay = RETRY_DELAY * Math.pow(2, retryAttempt); // Exponential backoff
        await sleep(delay);

        // Fix H7: Bail if a newer fetch has started after sleep
        if (currentGeneration !== fetchGenerationRef.current) return;

        return fetchSources(language, retryAttempt + 1);
      }

      // Final error after all retries exhausted or non-retryable error
      const finalMessage = retryAttempt > 0
        ? `${errorMessage} (Failed after ${MAX_RETRIES} retry attempts)`
        : errorMessage;
      setError(finalMessage);
      setPreviewAvailable(true);
      onError?.(new Error(finalMessage));
      setRetryCount(retryAttempt);
    } finally {
      // Fix H7: Only clear loading if this is still the current generation
      if (currentGeneration === fetchGenerationRef.current) {
        setLoading(false);
        setIsRetrying(false);
      }
    }
  }, [animeId, episodeNumber, animeTitle, malId, onError, effectiveStreamingMethod, preferences.defaultQuality, perAnimeStreamingMethod]);

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

  // Initial fetch and re-fetch when language changes
  useEffect(() => {
    fetchSources(currentLanguage);
    return () => {
      cancelStreamAttempt(`${animeId}-${episodeNumber}-${currentLanguage}`);
    };
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

  const playPreview = () => {
    setSources({
      type: "direct",
      url: DEMO_PREVIEW_SOURCES[0].url,
      qualities: DEMO_PREVIEW_SOURCES,
    });
    setCurrentStreamingMethod("hls");
    setError(null);
    setLoading(false);
    setIsFallback(true);
    setFallbackReason("Preview stream");
    toast("Playing preview stream instead of the requested episode", { duration: 4000 });
  };

  // Loading state
  if (loading) {
    const isSlow = loadingSeconds >= 8;
    return (
      <GlassCard className="aspect-video flex items-center justify-center animate-fadeIn" data-testid="loading-indicator">
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
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_0} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_150} />
            <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_300} />
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
                onClick={playPreview}
              >
                Play Preview Instead
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
            {previewAvailable && (
              <Button onClick={playPreview} variant="outline">
                Play Preview
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
              <h4 className="font-semibold text-yellow-500">Preview Mode</h4>
              <p className="text-sm text-muted-foreground mt-1">
                You&apos;re watching a preview stream, not the requested episode. We only switch here
                when real playback was unavailable and you chose to continue with a preview.
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

      {/* Streaming method indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-2" data-testid="streaming-method-indicator">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1" data-testid="streaming-method-text">
            {currentStreamingMethod === "webtorrent" ? (
              <>
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Streaming via P2P (WebTorrent)
                {sources?.seeders !== undefined && (
                  <span className="ml-1 text-green-400" data-testid="seed-count">({sources.seeders} seeders)</span>
                )}
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                Streaming via HLS (CDN)
              </>
            )}
          </span>
          {fallbackOccurred && fallbackReason && (
            <span className="text-yellow-400" data-testid="fallback-indicator">(Fallback: {fallbackReason})</span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          data-testid="retry-button"
          onClick={() => {
            setRetryCount(0);
            fetchSources(currentLanguage);
          }}
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Retry
        </Button>
      </div>

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
