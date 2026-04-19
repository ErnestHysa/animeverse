/**
 * Enhanced Video Player Component
 * With quality selector, autoplay, speed control, PIP, theater mode, keyboard shortcuts
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatBytes } from "@/lib/downloads";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Settings,
  Download,
  SkipBack,
  SkipForward,
  Monitor,
  Copy,
  X,
  Camera,
  Sparkles,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { usePreferences, useStore } from "@/store";
import { toast } from "react-hot-toast";
import logger from "@/lib/logger";
import { ServerSelector, LanguageSelector } from "@/components/player/server-selector";
import dynamic from "next/dynamic";
import { SimpleThumbnailPreview } from "@/components/player/episode-thumbnails";
import { DownloadButton } from "@/components/player/download-button";
import {
  getIntroOutroTimestamps,
  getEstimatedTimestamps,
  type IntroOutroTimestamps,
} from "@/lib/aniskip";
// Lazy-loaded hls.js to reduce initial bundle size (H13)
let HlsConstructor: typeof import('hls.js').default | null = null;
type HlsType = typeof import('hls.js').default;
import { type HlsConfig } from "hls.js";

// Static style constants to avoid recreating objects on every render
const ANIMATION_DELAY_0 = { animationDelay: "0ms" };
const ANIMATION_DELAY_150 = { animationDelay: "150ms" };
const ANIMATION_DELAY_300 = { animationDelay: "300ms" };

// Dynamic import for watch party controls to reduce initial bundle
const WatchPartyControls = dynamic(
  () => import("@/components/player/watch-party").then(mod => ({ default: mod.WatchPartyControls })),
  { ssr: false, loading: () => <div className="h-10" /> }
);

// ===================================
// Types
// ===================================

interface VideoPlayerProps {
  source: {
    type: "magnet" | "torrent" | "direct";
    url: string;
    qualities?: VideoQuality[];
    referer?: string;
  };
  poster?: string;
  animeTitle?: string;
  className?: string;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onEpisodeEnd?: () => void;
  animeId?: number;
  episodeNumber?: number;
  malId?: number | null;
  nextEpisodeUrl?: string;
  prevEpisodeUrl?: string;
  // New props for server/language selection
  allServers?: Array<{
    id: string;
    name: string;
    url: string;
    quality: string;
    type: "mp4" | "hls" | "webm";
  }>;
  allLanguages?: Array<{
    id: string;
    label: string;
    type: "sub" | "dub";
  }>;
  onServerChange?: (serverId: string) => void;
  onLanguageChange?: (languageId: string) => void;
}

export interface VideoQuality {
  url: string;
    quality: "360p" | "480p" | "720p" | "1080p" | "auto";
    label: string;
    size?: string;
}

export interface SubtitleTrack {
  url: string;
  lang: string;
  label: string;
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenContainer = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

type SeekableVideoElement = HTMLVideoElement & {
  __lastSeekTime?: number;
};

// ===================================
// Default props (defined outside component to avoid re-creation)
// ===================================

const DEFAULT_LANGUAGES = [
  { id: "sub", label: "Subtitles", type: "sub" as const },
  { id: "dub", label: "Dubbed", type: "dub" as const },
];

// ===================================
// Main Component
// ===================================

export function EnhancedVideoPlayer({
  source,
  poster,
  animeTitle,
  className,
  onError,
  onEpisodeEnd,
  animeId,
  episodeNumber,
  malId,
  nextEpisodeUrl,
  prevEpisodeUrl,
  allServers = [],
  allLanguages = DEFAULT_LANGUAGES,
  onServerChange,
  onLanguageChange,
  subtitles = [], // NEW: Subtitle tracks from API
}: VideoPlayerProps & { subtitles?: SubtitleTrack[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const bufferingSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Debounce timeout for waiting event to prevent false positive buffering overlay
  const waitingDebounceRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for 15s buffering fallback timeout (to clear on unmount)
  const bufferingFallbackRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for HLS seek recovery timeout (to clear on unmount)
  const seekRecoveryRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for play() fallback timeout (to clear on unmount)
  const playFallbackRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for checkReady() polling timeout (to clear on unmount)
  const checkReadyTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for subtitle loading setTimeout (to clear on unmount)
  const subtitleTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Ref for seek timeout in play() function (to clear on unmount)
  const playFallbackRef2 = useRef<NodeJS.Timeout | null>(null);
  // Debounce ref for volume localStorage writes
  const volumeSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fix M12: Unique player instance ID for scoped subtitle styles
  const playerIdRef = useRef(Math.random().toString(36).substring(2));

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('player-volume');
      return saved ? Math.max(0, Math.min(1, parseFloat(saved))) : 1;
    }
    return 1;
  });
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('player-muted') === 'true';
    }
    return false;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);
  const [hlsReady, setHlsReady] = useState(false);
  // Use a ref so the HLS event-handler closures always read the latest value
  // (avoids the stale-closure bug where clicking play before MANIFEST_PARSED had no effect)
  const userInitiatedPlayRef = useRef(false);

  // Throttled time update to improve performance
  const lastTimeUpdateRef = useRef(0);

  // Server and Language state
  const [currentServer, setCurrentServer] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`preferred-server-${animeId}-${episodeNumber}`) || "default";
    }
    return "default";
  });
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(`preferred-language-${animeId}`) || localStorage.getItem("preferred-language") || "sub";
    }
    return "sub";
  });

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('player-speed');
      const rate = saved ? parseFloat(saved) : 1;
      return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(rate) ? rate : 1;
    }
    return 1;
  });
  const [currentQuality, setCurrentQuality] = useState<string>("auto");

  // NEW: Subtitle state
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState(0);
  const [portalDropdownStyle, setPortalDropdownStyle] = useState<React.CSSProperties>({});

  // Subtitle customization
  const [subtitleSize, setSubtitleSize] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("subtitle-size") || "20", 10);
    }
    return 20;
  });
  const [subtitleColor, setSubtitleColor] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("subtitle-color") || "#ffffff";
    }
    return "#ffffff";
  });
  const [subtitleBackground, setSubtitleBackground] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("subtitle-background") || "rgba(0,0,0,0.75)";
    }
    return "rgba(0,0,0,0.75)";
  });
  const [subtitlePosition, setSubtitlePosition] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("subtitle-position") || "bottom";
    }
    return "bottom";
  });

  // Video sources (for quality selector)
  const [sources, setSources] = useState<VideoQuality[]>([
    { url: source.url, quality: "auto", label: "Auto" },
    ...(source.qualities || []),
  ]);

  // Theater mode
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Chromecast
  const [isCasting, setIsCasting] = useState(false);

  // AirPlay availability
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);

  // Ambient / glow mode
  const [isAmbientMode, setIsAmbientMode] = useState(false);
  const ambientCanvasRef = useRef<HTMLCanvasElement>(null);
  const ambientRafRef = useRef<number>(0);

  // PIP
  const [isPip, setIsPip] = useState(false);

  // Autoplay countdown
  const [showAutoplayCountdown, setShowAutoplayCountdown] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState(10);

  // Skip intro/outro/recap buttons
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [showSkipRecap, setShowSkipRecap] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [outroSkipped, setOutroSkipped] = useState(false);
  const [recapSkipped, setRecapSkipped] = useState(false);
  // Fix 3: Use refs for skip state to avoid re-registering the autoskip listener
  const introSkippedRef = useRef(false);
  const outroSkippedRef = useRef(false);
  const recapSkippedRef = useRef(false);

  // WebTorrent stats
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [peers, setPeers] = useState(0);
  const [torrentProgress, setTorrentProgress] = useState(0);

  // Touch gestures
  const [showLeftTapAnimation, setShowLeftTapAnimation] = useState(false);
  const [showRightTapAnimation, setShowRightTapAnimation] = useState(false);
  const [showMobileVolumeSlider, setShowMobileVolumeSlider] = useState(false);
  const lastTapRef = useRef<{ time: number; x: number; side: 'left' | 'right' } | null>(null);
  const tapAnimationTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Ref-based "useLatest" pattern to avoid stale closures in useEffect
  // without re-registering event listeners on every render
  const handlersRef = useRef<Record<string, (...args: unknown[]) => void>>({});
  const goToNextEpisodeRef = useRef<() => void>(() => {});
  const startAutoplayCountdownRef = useRef<() => void>(() => {});

  // Toast debounce ref for keyboard seek toasts (Fix 7: prevent toast stacking)
  const seekToastIdRef = useRef<string | null>(null);
  const seekDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // User preferences
  const { preferences, updatePreferences } = usePreferences();

  // Next.js router for client-side navigation
  const router = useRouter();

  // Store for watch history
  const addToWatchHistory = useStore(s => s.addToWatchHistory);


  // Dynamic intro/outro timestamps from AniSkip API
  const [skipTimestamps, setSkipTimestamps] = useState<IntroOutroTimestamps>({});

  useEffect(() => {
    const subtitleStyle = preferences.subtitleStyle;
    if (!subtitleStyle) {
      return;
    }

    const backgroundAlpha = Math.max(0, Math.min(1, subtitleStyle.backgroundOpacity / 100));
    const normalizedBackground =
      subtitleStyle.backgroundOpacity === 0
        ? "transparent"
        : `${subtitleStyle.backgroundColor}${Math.round(backgroundAlpha * 255)
            .toString(16)
            .padStart(2, "0")}`;

    setSubtitleSize((current) => (current === subtitleStyle.fontSize ? current : subtitleStyle.fontSize));
    setSubtitleColor((current) => (current === subtitleStyle.fontColor ? current : subtitleStyle.fontColor));
    setSubtitleBackground((current) => (current === normalizedBackground ? current : normalizedBackground));
    setSubtitlePosition((current) => (current === subtitleStyle.position ? current : subtitleStyle.position));
  }, [preferences.subtitleStyle]);

  // AirPlay: detect availability via WebKit API
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // WebKit AirPlay availability event
    const handleAirPlayAvailability = (event: Event) => {
      setAirPlayAvailable((event as CustomEvent).detail?.availability === "available");
    };
    video.addEventListener("webkitplaybacktargetavailabilitychanged", handleAirPlayAvailability);
    return () => video.removeEventListener("webkitplaybacktargetavailabilitychanged", handleAirPlayAvailability);
  }, []);

  // Chromecast: initialise SDK once it's loaded
  useEffect(() => {
    type CastContextInstance = {
      setOptions: (o: object) => void;
      addEventListener: (e: string, cb: (ev: { sessionState: string }) => void) => void;
      requestSession: () => void;
    };
    type CastWindow = {
      cast?: {
        framework?: {
          CastContext?: { getInstance: () => CastContextInstance };
          SessionState?: Record<string, string>;
        };
      };
      __onGCastApiAvailable?: (isAvailable: boolean) => void;
    };

    let castCtx: CastContextInstance | null = null;
    let handler: ((ev: any) => void) | null = null;

    const initCast = () => {
      if (typeof window === "undefined") return;
      const w = window as unknown as CastWindow;
      const CastContext = w.cast?.framework?.CastContext;
      if (!CastContext) return;
      try {
        const ctx = CastContext.getInstance();
        castCtx = ctx;
        ctx.setOptions({ receiverApplicationId: "CC1AD845", autoJoinPolicy: "origin_scoped" });
        handler = (ev: any) => {
          const states = (window as unknown as CastWindow).cast?.framework?.SessionState;
          if (!states) return;
          if (ev.sessionState === states.SESSION_STARTED) setIsCasting(true);
          if (ev.sessionState === states.SESSION_ENDING) setIsCasting(false);
        };
        ctx.addEventListener("SESSION_STATE_CHANGED", handler);
      } catch {
        // Cast SDK not available
      }
    };

    const w = window as unknown as CastWindow;
    if (w.__onGCastApiAvailable) {
      initCast();
    } else {
      w.__onGCastApiAvailable = (isAvailable: boolean) => {
        if (isAvailable) initCast();
      };
    }

    return () => {
      if (castCtx && handler) {
        (castCtx as any).removeEventListener("SESSION_STATE_CHANGED", handler);
      }
    };
  }, []);

  // Ambient mode: draw blurred video frames to canvas behind player
  useEffect(() => {
    const canvas = ambientCanvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || !isAmbientMode) {
      cancelAnimationFrame(ambientRafRef.current);
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let lastDraw = 0;
    const draw = (timestamp: number) => {
      if (timestamp - lastDraw > 66) { // ~15fps is enough for ambient glow
        lastDraw = timestamp;
        if (!video.paused && video.readyState >= 2) {
          canvas.width = 64;
          canvas.height = 36;
          ctx.drawImage(video, 0, 0, 64, 36);
        }
      }
      ambientRafRef.current = requestAnimationFrame(draw);
    };
    ambientRafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(ambientRafRef.current);
  }, [isAmbientMode]);

  // Computed timestamps with fallback to defaults
  const introStart = skipTimestamps.intro?.start ?? 85;
  const introEnd = skipTimestamps.intro?.end ?? 170;
  const outroStart = skipTimestamps.outro?.start ?? 1320;
  const outroEnd = skipTimestamps.outro?.end ?? 1410;
  const recapStart = skipTimestamps.recap?.start ?? null;
  const recapEnd = skipTimestamps.recap?.end ?? null;

  // ===================================
  // Helper Functions
  // ===================================

  const saveWatchProgress = useCallback(
    (mediaId: number, epNumber: number, progress: number, completed: boolean = false) => {
      try {
        // Save to Zustand store (this persists to localStorage automatically)
        addToWatchHistory({
          mediaId,
          episodeNumber: epNumber,
          progress,
          completed,
        });

        // Also save to individual progress localStorage for quick resume
        const key = `watch_progress_${mediaId}`;
        let data: Record<string, { progress: number; timestamp: number }>;
        try {
          data = JSON.parse(localStorage.getItem(key) || "{}");
        } catch {
          localStorage.removeItem(key);
          data = {};
        }
        data[epNumber] = {
          progress,
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(data));

        // Fix M1: Periodically clean up orphaned watch_progress_ keys
        if (Math.random() < 0.1) {
          try {
            const currentHistory = useStore.getState().watchHistory;
            const activeIds = new Set(currentHistory.map((h: any) => h.mediaId));
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const lKey = localStorage.key(i);
              if (lKey?.startsWith('watch_progress_')) {
                const mId = lKey.replace('watch_progress_', '');
                if (!activeIds.has(Number(mId) || mId)) {
                  keysToRemove.push(lKey);
                }
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch {
            // Cleanup is best-effort
          }
        }

      } catch (e) {
        // Silently fail - app will work without persistence
      }
    },
    [addToWatchHistory]
  );

  // Ref to keep saveWatchProgress fresh without re-registering listeners
  const saveWatchProgressRef = useRef<typeof saveWatchProgress>(saveWatchProgress);
  saveWatchProgressRef.current = saveWatchProgress;

  // ===================================
  // Video Loading
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let innerCleanup: (() => void) | null = null;
    let loadingTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let manifestFallbackTimeout: ReturnType<typeof setTimeout> | null = null;

    (async () => {
    logger.log("[VideoPlayer] Loading video source:", {
      type: source.type,
      url: source.url,
      hasReferer: !!source.referer,
    });

    // Clean up previous HLS instance if exists
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setIsBuffering(false);
    setHlsReady(false); // Reset HLS ready state
    userInitiatedPlayRef.current = false; // Reset user initiated play state

    // Timeout fallback to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      logger.warn("Video loading timeout - clearing loading state");
      setIsLoading(false);
      setIsBuffering(false);
    }, 15000); // 15 seconds max (reduced from 30 for faster UX)
    loadingTimeoutId = loadingTimeout;

    // Fallback safety timeout - ensures loading state is always cleared
    const safetyTimeout = setTimeout(() => {
      logger.warn("Video safety timeout - forcing loading state clear");
      setIsLoading(false);
      setIsBuffering(false);
    }, 30000); // 30 seconds absolute max
    safetyTimeoutId = safetyTimeout;

    const handleLoad = () => {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      // Auto-play based on preferences
      if (preferences.autoplay) {
        play();
      }
    };

    const handleError = (e?: Event | Error) => {
      clearTimeout(loadingTimeout);
      setIsLoading(false);
      setIsBuffering(false);

      let errorMessage = "Failed to load video";
      if (e) {
        if (e instanceof ErrorEvent) {
          errorMessage = e.message || "Unknown error";
          logger.error("Video error:", errorMessage);
        } else if (e instanceof Error) {
          errorMessage = e.message;
          logger.error("Video error:", errorMessage);
        } else {
          logger.warn("Video error event received");
        }
      }

      onError?.(new Error(`Failed to load video: ${errorMessage}`));
    };

    if (source.type === "direct") {
      const isHls = source.url.includes(".m3u8");

      // Helper function to create proxy URL for CORS-prone sources
      const createProxyUrl = (originalUrl: string, type: "manifest" | "segment" | "video") => {
        // Don't double-proxy URLs that are already going through our proxy
        // This prevents the circular reference: proxy(proxy(url))
        if (originalUrl.includes("/api/proxy-hls")) {
          return originalUrl;
        }
        let proxyUrl = `/api/proxy-hls?url=${encodeURIComponent(originalUrl)}&type=${type}`;
        // Add referer if available from the provider
        if (source.referer) {
          proxyUrl += `&referer=${encodeURIComponent(source.referer)}`;
        }
        return proxyUrl;
      };

      // Determine if we need to use proxy
      // Proxy when: 1) CDN referer is required, OR 2) External HLS (likely to have CORS issues)
      // This fixes empty ArrayBuffer payloads on segments
      const isExternalHls = isHls && !source.url.includes(window.location.hostname);
      const needsProxy = !!source.referer || isExternalHls;
      logger.log("[HLS] Proxy decision:", {
        isHls,
        sourceUrl: source.url.substring(0, 50),
        hostname: window.location.hostname,
        isExternalHls,
        hasReferer: !!source.referer,
        needsProxy,
      });

      if (isHls) {
        // Lazy-load hls.js on demand (H13)
        if (!HlsConstructor) {
          const hlsModule = await import('hls.js');
          HlsConstructor = hlsModule.default;
        }
        const Hls = HlsConstructor;

        if (!Hls.isSupported()) {
          // Fallback to native HLS (Safari)
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            if (manifestFallbackTimeout) { clearTimeout(manifestFallbackTimeout); manifestFallbackTimeout = null; }
            const videoUrl = needsProxy ? createProxyUrl(source.url, "manifest") : source.url;
            video.src = videoUrl;
            const clearLoading = () => { clearTimeout(loadingTimeout); clearTimeout(safetyTimeout); setIsLoading(false); };
            video.addEventListener("loadeddata", clearLoading, { once: true });
            video.addEventListener("canplay", clearLoading, { once: true });
            video.addEventListener("error", handleError, { once: true });
            video.addEventListener("loadedmetadata", () => { if (preferences.autoplay) video.play().catch(() => {}); }, { once: true });
          }
        } else {
        // Use HLS.js for browsers that don't support HLS natively
        // Configure for better compatibility with various CDN formats
        const hlsConfig: Partial<HlsConfig> = {
          // Disable worker - can cause issues with some codec formats
          enableWorker: false,
          // Don't use low latency mode - more lenient parsing
          lowLatencyMode: false,
          // Progressive download - more compatible
          progressive: true,
          // ENHANCED: Increase buffer tolerance for better seeking and reduced buffering
          // CRITICAL FIX for slow upstream servers: Allow much larger buffer
          maxBufferLength: 120, // Increased from 60 to 120s (2 minutes) for pre-buffering on slow connections
          maxMaxBufferLength: 240, // Increased from 120 to 240s (4 minutes) max buffer capacity
          // Critical for seeking - allow more lenient fragment lookup
          maxFragLookUpTolerance: 1, // Increased from 0.5 for better seek recovery
          // Don't automatically switch levels (can cause parsing issues)
          autoStartLoad: true,
          // Cap level to player size to avoid unsupported resolutions
          capLevelToPlayerSize: true,
          // Use fetch API for all requests (more reliable than XHR)
          // Custom loader that proxies segments to avoid CORS issues
          loader: needsProxy ? class extends Hls.DefaultConfig.loader {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            constructor(config: any) {
              super(config);
              // Enable fetch-based loading for better CORS handling
              config.fetch = fetch.bind(globalThis);
            }
          } : Hls.DefaultConfig.loader,
          // Add seek handling settings
          maxBufferHole: 1, // Increased from 0.5 to handle larger gaps
          // CRITICAL FIX for slow upstream servers (segments taking ~10s each):
          // Increase fragment loading timeout and retry limits significantly
          fragLoadingMaxRetry: 10, // Increased from 6 - allow more retries for slow segments
          fragLoadingRetryDelay: 2000, // Increased from 1000ms - wait longer between retries
          fragLoadingMaxRetryTimeout: 90000, // CRITICAL: Increased from 24s to 90s to handle 10s segments + retries
          levelLoadingMaxRetry: 10, // Increased from 6 - more retries for level/playlist loading
          levelLoadingRetryDelay: 2000, // Increased from 1000ms
          levelLoadingMaxRetryTimeout: 60000, // NEW: 60s max for level loading
          // Handle seeking better by preloading around seek position
          // Progressive back buffer loading to reduce memory
          backBufferLength: 30,
          // Better handling of manifest parsing errors for slow servers
          manifestLoadingMaxRetry: 10, // Increased from 6
          manifestLoadingRetryDelay: 2000, // Increased from 1000ms
          manifestLoadingMaxRetryTimeout: 60000, // CRITICAL: Increased from 20s to 60s for slow manifest loading
          // NEW: Additional timeout settings for fetch-based loader
          fetchSetup: (context, initParams) => {
            // Extend timeout for fetch requests to handle slow servers
            return {
              ...initParams,
              // Note: AbortSignal.timeout can be used but we handle via AbortController in the proxy
              // The fetch API itself doesn't have a built-in timeout option
            };
          },
        };

        // Determine the actual URL to load
        // If proxy is needed, use the proxied manifest URL
        // The manifest itself will contain rewritten URLs to the proxy
        const manifestUrl = needsProxy ? createProxyUrl(source.url, "manifest") : source.url;

        logger.log("[HLS] Loading manifest:", needsProxy ? "(via proxy)" : "(direct)", {
          original: source.url,
          proxied: manifestUrl !== source.url ? manifestUrl : "(same)",
        });

        const hls = new Hls(hlsConfig);

        hlsRef.current = hls;

        // CRITICAL: Add a timeout to clear loading state even if HLS events fail
        // This prevents infinite loading when manifest is valid but has no playable content
        let manifestTimeoutCleared = false;
        const clearLoadingState = () => {
          if (!manifestTimeoutCleared) {
            manifestTimeoutCleared = true;
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            setIsLoading(false);
            setHlsReady(true);
          }
        };

        // Clear loading after 12 seconds if manifest hasn't loaded
        // This is shorter than the main timeout to provide better UX
        manifestFallbackTimeout = setTimeout(() => {
          if (!manifestTimeoutCleared) {
            logger.warn("[HLS] Manifest loading timeout - clearing loading state after 12s");
            clearLoadingState();
            // Trigger error to notify parent component
            onError?.(new Error("Manifest loading timeout. Video source may be unavailable."));
          }
        }, 12000);

        // CRITICAL: Attach media BEFORE loading source
        // This is the correct HLS.js initialization order
        hls.attachMedia(video);

        // Wait for media to be attached before loading source
        let mediaAttached = false;
        const onMediaAttached = () => {
          if (!mediaAttached) {
            mediaAttached = true;
            logger.log("[HLS] Media attached, loading source:", manifestUrl);
            hls.loadSource(manifestUrl);
            hls.off(Hls.Events.MEDIA_ATTACHED, onMediaAttached);
          }
        };
        hls.on(Hls.Events.MEDIA_ATTACHED, onMediaAttached);

        // If media attach fails, try loading anyway after a short delay
        setTimeout(() => {
          if (hlsRef.current && !hlsRef.current.media && !mediaAttached) {
            logger.warn("[HLS] Media attach timeout, forcing source load");
            mediaAttached = true;
            hls.loadSource(manifestUrl);
          }
        }, 1000);

        // Comprehensive HLS event logging for debugging
        hls.on(Hls.Events.MEDIA_ATTACHED, (event, data) => {
          logger.log("[HLS] Media attached event fired:", data);
        });

        hls.on(Hls.Events.MANIFEST_LOADING, (event, data) => {
          logger.log("[HLS] Manifest loading:", data);
        });

        hls.on(Hls.Events.MANIFEST_LOADED, (event, data) => {
          logger.log("[HLS] Manifest loaded:", data);
          logger.log("[HLS] Levels available:", data.levels.length);
          // CRITICAL FIX: Check if there are any playable levels
          if (data.levels.length === 0) {
            logger.error("[HLS] No playable levels in manifest");
            if (manifestFallbackTimeout) clearTimeout(manifestFallbackTimeout);
            clearLoadingState();
            // Trigger error to notify parent component
            onError?.(new Error("No playable video quality levels found. Trying next server..."));
            return;
          }
          // CRITICAL FIX: Clear loading state on MANIFEST_LOADED, not just MANIFEST_PARSED
          // This prevents infinite loading when manifest has parseable content but no playable levels
          if (manifestFallbackTimeout) clearTimeout(manifestFallbackTimeout);
          clearLoadingState();
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          logger.log("[HLS] Manifest parsed successfully:", data);
          // Clear any remaining timeouts since manifest is now fully parsed
          if (manifestFallbackTimeout) clearTimeout(manifestFallbackTimeout);
          // Play if autoplay is enabled OR if user initiated playback
          // userInitiatedPlayRef is a ref so we always read the current value (no stale closure)
          if (preferences.autoplay || userInitiatedPlayRef.current) {
            logger.log("[HLS] Starting playback (autoplay:", preferences.autoplay, "userInitiated:", userInitiatedPlayRef.current, ")");
            play().catch((err) => { if (process.env.NODE_ENV === 'development') console.warn('Autoplay blocked:', err); });
          }
        });

        // NEW: Handle case where MANIFEST_PARSED never fires (audio-only, single level, etc.)
        // After 3 seconds from MANIFEST_LOADED, try to start playback anyway
        let parseCheckTimeout: NodeJS.Timeout | null = null;
        hls.once(Hls.Events.MANIFEST_LOADED, () => {
          parseCheckTimeout = setTimeout(() => {
            if (video.readyState >= 1 && hlsRef.current) {
              logger.log("[HLS] Manifest parsed event not fired, but video has data - attempting playback");
              if (preferences.autoplay || userInitiatedPlayRef.current) {
                play().catch((err) => { if (err.name !== 'NotAllowedError') console.error('Play failed:', err); });
              }
            }
          }, 3000);
        });

        hls.on(Hls.Events.LEVEL_LOADING, (event, data) => {
          logger.log("[HLS] Level loading:", data);
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          logger.log("[HLS] Level loaded:", data);
        });

        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          logger.log("[HLS] Fragment loading:", data);
          // CRITICAL FIX: Don't set buffering on FRAG_LOADING - HLS continuously loads fragments
          // during normal playback. The video element 'waiting' event is the reliable indicator.
          // Only set buffering if we're actually in a waiting state (checked by video events)
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          logger.log("[HLS] Fragment loaded:", data);
          // CRITICAL FIX: Don't clear buffering here - let video element events handle it
          // Clearing here can interfere with the waiting event debounce logic
          // If user initiated play and we have the first fragment, try to play
          if (userInitiatedPlayRef.current && video.paused && video.readyState >= 2) {
            logger.log("[HLS] Fragment loaded and user wants to play, starting playback...");
            video.play().catch(() => {});
          }
        });

        // NEW: Handle buffer appended event for better state management
        hls.on(Hls.Events.BUFFER_APPENDED, () => {
          // Buffer has been appended, we should be able to play
          if (video.paused && userInitiatedPlayRef.current) {
            video.play().catch(() => {});
          }
        });

        // Track repeated non-fatal media errors to trigger fallback
        let mediaErrorCount = 0;
        const MAX_MEDIA_ERRORS = 5; // Trigger fallback after 5 media errors
        let lastErrorTime = 0;
        const ERROR_RESET_TIME = 5000; // Reset counter if 5 seconds pass without errors
        let recoveryAttempts = 0;
        const MAX_RECOVERY_ATTEMPTS = 2;

        hls.on(Hls.Events.ERROR, (event, data) => {
          const now = Date.now();

          // Use warn for non-fatal errors to reduce console noise
          if (data.fatal) {
            logger.error("HLS fatal error:", {
              type: data.type,
              details: data.details,
              reason: data.reason,
            });
          } else {
            logger.warn("HLS non-fatal error:", {
              type: data.type,
              details: data.details,
            });
          }

          // Track non-fatal media parsing errors (fragParsingError, etc.)
          if (!data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Reset counter if enough time has passed since last error
            if (now - lastErrorTime > ERROR_RESET_TIME) {
              mediaErrorCount = 0;
            }

            mediaErrorCount++;
            lastErrorTime = now;

            logger.warn(`Media error count: ${mediaErrorCount}/${MAX_MEDIA_ERRORS}`);

            // Try recovery before giving up on the server
            if (mediaErrorCount < MAX_MEDIA_ERRORS && recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
              recoveryAttempts++;
              logger.warn(`Attempting media error recovery (attempt ${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`);
              hls.recoverMediaError();
              return;
            }

            // If we hit the threshold, trigger fallback to next server
            if (mediaErrorCount >= MAX_MEDIA_ERRORS) {
              logger.warn("Too many media errors, triggering server fallback");
              onError?.(new Error(`Media parsing failed after ${MAX_MEDIA_ERRORS} attempts. Trying next server...`));
              // Don't try to recover - let the parent component switch servers
              return;
            }
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                logger.log("Attempting to recover from network error...");
                // ENHANCED: Try to recover from current position for better seek handling
                const currentPos = video.currentTime || 0;
                hls.startLoad(currentPos);
                // Clear buffering state since we're attempting recovery
                setIsBuffering(false);
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                logger.log("Attempting to recover from media error...");
                hls.recoverMediaError();
                // Clear buffering state on recovery attempt
                setIsBuffering(false);
                break;
              default:
                logger.error("Fatal HLS error, cannot recover");
                handleError();
                break;
            }
          }
        });

        innerCleanup = () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          if (manifestFallbackTimeout) clearTimeout(manifestFallbackTimeout);
          if (parseCheckTimeout) clearTimeout(parseCheckTimeout);
          hls.destroy();
        };
        }
      } else {
        // Regular MP4 video - use proxy if needed for CORS
        const videoUrl = (needsProxy && source.url.includes(".mp4")) ? createProxyUrl(source.url, "video") : source.url;
        video.src = videoUrl;

        // Add multiple event handlers to ensure loading state is cleared
        const clearLoading = () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          setIsLoading(false);
        };

        video.addEventListener("loadeddata", clearLoading, { once: true });
        video.addEventListener("canplay", clearLoading, { once: true });
        video.addEventListener("canplaythrough", clearLoading, { once: true });
        video.addEventListener("error", handleError, { once: true });

        // Try autoplay if enabled
        video.addEventListener("loadedmetadata", () => {
          if (preferences.autoplay) {
            video.play().catch(() => {});
          }
        }, { once: true });

        innerCleanup = () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          if (manifestFallbackTimeout) { clearTimeout(manifestFallbackTimeout); manifestFallbackTimeout = null; }
          video.removeEventListener("loadeddata", clearLoading);
          video.removeEventListener("canplay", clearLoading);
          video.removeEventListener("canplaythrough", clearLoading);
          video.removeEventListener("error", handleError);
        };
      }
    } else {
      // WebTorrent handling (magnet/torrent links)
      import("@/lib/webtorrent").then(({ webTorrentManager }) => {
        if (cancelled) return;
        webTorrentManager.loadDirectVideo(source.url, video, {
          onReady: () => {
            if (cancelled) return;
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            setIsLoading(false);
            if (preferences.autoplay) play();
          },
          onError: (err: Error) => {
            if (cancelled) return;
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            setIsLoading(false);
            onError?.(err);
          },
        });
      }).catch(() => {});
    }
    })(); // end async IIFE

    return () => {
      cancelled = true;
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
      if (safetyTimeoutId) clearTimeout(safetyTimeoutId);
      if (manifestFallbackTimeout) { clearTimeout(manifestFallbackTimeout); manifestFallbackTimeout = null; }
      if (innerCleanup) innerCleanup();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [source.url, source.type, source.referer, preferences.autoplay]);

  // ===================================
  // Update sources when source.qualities changes
  // ===================================

  useEffect(() => {
    if (source.qualities) {
      setSources([
        { url: source.url, quality: "auto", label: "Auto" },
        ...source.qualities,
      ]);
    }
  }, [source.qualities, source.url]);

  // ===================================
  // Fetch Intro/Outro Timestamps from AniSkip API
  // ===================================

  useEffect(() => {
    // Only fetch if we have episodeNumber
    if (!episodeNumber) return;

    // We need the MyAnimeList ID for AniSkip API
    // Use malId prop if available, otherwise fall back to animeId
    const effectiveMalId = malId || animeId;

    if (!effectiveMalId) return;

    let cancelled = false;

    const fetchTimestamps = async () => {
      try {
        // Store MAL ID for future use
        if (malId && typeof window !== "undefined") {
          localStorage.setItem(`mal-id-${animeId}`, malId.toString());
        }

        // Fetch timestamps from AniSkip API
        const timestamps = await getIntroOutroTimestamps(
          effectiveMalId,
          episodeNumber,
          animeId
        );

        if (cancelled) return;

        // If we got timestamps, use them
        if (timestamps.intro || timestamps.outro) {
          setSkipTimestamps(timestamps);
        } else {
          // No data from API, use estimated timestamps based on duration
          const video = videoRef.current;
          const estimated = getEstimatedTimestamps(video?.duration);
          setSkipTimestamps(estimated);
        }
      } catch (error) {
        if (cancelled) return;

        // Silently fall back to estimated timestamps
        const video = videoRef.current;
        const estimated = getEstimatedTimestamps(video?.duration);
        setSkipTimestamps(estimated);
      }
    };

    fetchTimestamps();

    return () => { cancelled = true; };
  }, [malId, animeId, episodeNumber]);

  // ===================================
  // Load Subtitles - CRITICAL FIX
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let subtitleLoadCancelled = false;

    // Clear existing text tracks to prevent memory leaks from accumulating tracks
    for (let i = video.textTracks.length - 1; i >= 0; i--) {
      const track = video.textTracks[i];
      while (track.cues && track.cues.length > 0) {
        track.removeCue(track.cues[0]);
      }
      track.mode = 'disabled';
    }

    // Add new subtitle tracks if available
    if (subtitles && subtitles.length > 0) {
      if (subtitleLoadCancelled) return;
      setSubtitleTracks(subtitles);

      // Load subtitles sequentially to avoid race conditions
      const loadSubtitles = async () => {
        let loadedCount = 0;
        let firstTrack: TextTrack | null = null;
        let englishTrack: TextTrack | null = null;

        for (let index = 0; index < subtitles.length; index++) {
          if (subtitleLoadCancelled) break;
          const sub = subtitles[index];

          try {
            // Use proxy API to avoid CORS/403 errors
            const proxyUrl = `/api/proxy-subtitle?url=${encodeURIComponent(sub.url)}`;

            const response = await fetch(proxyUrl);
            if (!response.ok) {
              // Silently skip failed subtitle loads
              continue;
            }

            const subtitleText = await response.text();

            // Convert SRT to VTT if needed
            let processedText = subtitleText;
            if (!subtitleText.trim().startsWith('WEBVTT')) {
              // SRT format: convert timestamps and add WEBVTT header
              processedText = 'WEBVTT\n\n' + subtitleText
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2') // SRT timestamp → VTT
                .replace(/^\d+\s*\n/gm, '') // Remove cue sequence numbers
                .trim();
            }

            // Create a new track for this subtitle
            const track = video.addTextTrack("captions", sub.label, sub.lang || `sub${index}`);

            // Parse VTT content and add cues
            const lines = processedText.split('\n');
            const cues: Array<{ start: number; end: number; text: string }> = [];
            let currentCue: { start: number; end: number; text: string } | null = null;

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              if (!line) continue;

              // Parse timestamp line: 00:00:00.000 --> 00:00:05.000
              if (line.includes('-->')) {
                // Save previous cue if exists
                if (currentCue && currentCue.text) {
                  cues.push(currentCue);
                }

                const [startPart, endPart] = line.split('-->');
                const parseTime = (t: string): number => {
                  const parts = t.trim().split(':');
                  if (parts.length === 3) {
                    const h = parseFloat(parts[0]) || 0;
                    const m = parseFloat(parts[1]) || 0;
                    const s = parseFloat(parts[2]) || 0;
                    return h * 3600 + m * 60 + s;
                  } else if (parts.length === 2) {
                    const m = parseFloat(parts[0]) || 0;
                    const s = parseFloat(parts[1]) || 0;
                    return m * 60 + s;
                  }
                  return parseFloat(t) || 0;
                };

                const start = parseTime(startPart);
                const end = parseTime(endPart);
                currentCue = { start, end, text: "" };
              } else if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('X-TIMESTAMP')) {
                // Skip metadata lines
                continue;
              } else if (currentCue !== null) {
                // This is subtitle text - append to current cue
                if (currentCue.text) {
                  currentCue.text += '\n' + line;
                } else {
                  currentCue.text = line;
                }
              }
            }

            // Add the last cue
            if (currentCue && currentCue.text) {
              cues.push(currentCue);
            }

            // Add all cues to the track
            for (const cue of cues) {
              try {
                const vttCue = new VTTCue(cue.start, cue.end, cue.text);
                track.addCue(vttCue);
              } catch (e) {
                // Silently skip invalid cues
              }
            }

            // Track references for enabling
            if (index === 0) firstTrack = track;
            const langCode = (sub.lang || "").toLowerCase();
            const labelLower = sub.label.toLowerCase();
            if (
              langCode === "en" ||
              langCode.startsWith("en-") ||
              langCode === "eng" ||
              labelLower.includes("english")
            ) {
              englishTrack = track;
            }

            loadedCount++;
          } catch (err) {
            // Silently skip failed subtitle loads
          }
        }

        // After all subtitles are loaded, enable the appropriate track
        // Use setTimeout to ensure cues are fully processed
        subtitleTimerRef.current = setTimeout(() => {
          if (subtitleLoadCancelled) return;
          const trackToEnable = englishTrack || firstTrack;
          if (trackToEnable && subtitlesEnabled) {
            // Disable all tracks first
            for (let i = 0; i < video.textTracks.length; i++) {
              video.textTracks[i].mode = "disabled";
            }
            // Enable the selected track
            trackToEnable.mode = "showing";
            // Find the index of the enabled track
            const enabledIndex = subtitles.findIndex(s =>
              s.lang === trackToEnable.language || s.label === trackToEnable.label
            );
            if (subtitleLoadCancelled) return;
            setCurrentSubtitle(enabledIndex >= 0 ? enabledIndex : 0);
            if (subtitleLoadCancelled) return;
            toast.success(`Subtitles loaded: ${trackToEnable.label}`, { duration: 2000 });
          }
        }, 100);
      };

      loadSubtitles();
    } else {
      if (!subtitleLoadCancelled) {
        setSubtitleTracks([]);
      }
    }

    return () => {
      subtitleLoadCancelled = true;
      if (subtitleTimerRef.current) clearTimeout(subtitleTimerRef.current);

      // Clean up text tracks on unmount to prevent memory leaks
      if (video) {
        for (let i = video.textTracks.length - 1; i >= 0; i--) {
          const track = video.textTracks[i];
          while (track.cues && track.cues.length > 0) {
            track.removeCue(track.cues[0]);
          }
          track.mode = 'disabled';
        }
      }
    };
  }, [subtitles, subtitlesEnabled]);

  // ===================================
  // Update torrent stats
  // ===================================

  useEffect(() => {
    if (source.type !== "direct") {
      const interval = setInterval(async () => {
        try {
          const { webTorrentManager } = await import("@/lib/webtorrent");
          const state = webTorrentManager.getState();
          setDownloadSpeed(state.downloadSpeed);
          setUploadSpeed(state.uploadSpeed);
          setPeers(state.peers);
          setTorrentProgress(state.progress);
        } catch {
          // Ignore
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [source.type]);

  // ===================================
  // Keyboard Controls
  // ===================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      // Read latest handlers from ref to avoid stale closures
      const handlers = handlersRef.current;

      // Keys that the player handles -- stop propagation so the global
      // keyboard-shortcut system does not also fire for these keys.
      const PLAYER_KEYS = new Set([
        " ", "k", "ArrowLeft", "ArrowRight", "j", "l",
        "ArrowUp", "ArrowDown", "m", "f", "t", "p", "c",
        "n", "?", "Escape",
        "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
      ]);

      if (PLAYER_KEYS.has(e.key)) {
        e.stopPropagation();
      }

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          handlers.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlers.seek(video.currentTime - 5);
          // Debounced seek toast: rapid seeks only show the final toast
          if (seekToastIdRef.current !== null) toast.dismiss(seekToastIdRef.current);
          if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
          seekDebounceRef.current = setTimeout(() => {
            seekToastIdRef.current = toast("-5s", { icon: "⏪", duration: 500 });
          }, 300);
          break;
        case "ArrowRight":
          e.preventDefault();
          handlers.seek(video.currentTime + 5);
          if (seekToastIdRef.current !== null) toast.dismiss(seekToastIdRef.current);
          if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
          seekDebounceRef.current = setTimeout(() => {
            seekToastIdRef.current = toast("+5s", { icon: "⏩", duration: 500 });
          }, 300);
          break;
        case "j":
          handlers.seek(video.currentTime - 10);
          if (seekToastIdRef.current !== null) toast.dismiss(seekToastIdRef.current);
          if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
          seekDebounceRef.current = setTimeout(() => {
            seekToastIdRef.current = toast("-10s", { icon: "⏪", duration: 500 });
          }, 300);
          break;
        case "l":
          handlers.seek(video.currentTime + 10);
          if (seekToastIdRef.current !== null) toast.dismiss(seekToastIdRef.current);
          if (seekDebounceRef.current) clearTimeout(seekDebounceRef.current);
          seekDebounceRef.current = setTimeout(() => {
            seekToastIdRef.current = toast("+10s", { icon: "⏩", duration: 500 });
          }, 300);
          break;
        case "ArrowUp":
          e.preventDefault();
          setVolume((v) => Math.min(1, v + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          setVolume((v) => Math.max(0, v - 0.1));
          break;
        case "m":
          handlers.toggleMute();
          toast(isMuted ? "Muted" : "Unmuted", { duration: 500 });
          break;
        case "f":
          handlers.toggleFullscreen();
          break;
        case "t":
          handlers.toggleTheaterMode();
          break;
        case "p":
          handlers.togglePip();
          break;
        case "c":
          // Toggle captions
          if (video.textTracks.length > 0) {
            const newState = video.textTracks[0].mode === "showing" ? "hidden" : "showing";
            video.textTracks[0].mode = newState;
            toast(newState === "showing" ? "Subtitles ON" : "Subtitles OFF", { duration: 500 });
          } else {
            toast("No subtitles available", { icon: "⚠️", duration: 2000 });
          }
          break;
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          // Speed control
          const rate = parseInt(e.key) * 0.25;
          if (rate >= 0.25 && rate <= 16) {
            setPlaybackRate(rate);
            toast(`Speed: ${rate}x`, { duration: 500 });
          }
          break;
        case "0":
          setPlaybackRate(1);
          toast("Speed: 1x (Normal)", { duration: 500 });
          break;
        case "n":
          // Next episode
          if (nextEpisodeUrl && preferences.autoNext) {
            handlers.goToNextEpisode();
          }
          break;
        case "?":
          // Show keyboard shortcuts help
          toast(`
Keyboard Shortcuts:
Space/K: Play/Pause | Arrow: ±5s | L/R: ±10s | M: Mute | F: Fullscreen
C: Subtitles | 0-9: Speed | N: Next | T: Theater | P: PiP | ESC: Exit
          `, { duration: 5000, icon: "⌨️" });
          break;
        case "Escape":
          // Exit fullscreen
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          setShowSettings(false);
          setShowSubtitleSettings(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []); // Fix 1: empty deps — handlersRef always has latest references

  // ===================================
  // Touch Gestures (Double-tap to seek)
  // ===================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const SEEK_AMOUNT = 10; // seconds to seek on double-tap
    const DOUBLE_TAP_DELAY = 300; // ms between taps to count as double-tap

    const handleTouchStart = (e: TouchEvent) => {
      // Ignore if touching controls
      const target = e.target as HTMLElement;
      if (target.closest('[data-controls]')) return;

      const touch = e.touches[0];
      const rect = container.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const side = x < rect.width / 2 ? 'left' : 'right';

      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap &&
          now - lastTap.time < DOUBLE_TAP_DELAY &&
          lastTap.side === side) {
        // Double-tap detected!
        const video = videoRef.current;
        if (!video) return;

        if (side === 'left') {
          // Seek backward
          const newTime = Math.max(0, video.currentTime - SEEK_AMOUNT);
          video.currentTime = newTime;
          setShowLeftTapAnimation(true);
          clearTimeout(tapAnimationTimeoutRef.current);
          tapAnimationTimeoutRef.current = setTimeout(() => {
            setShowLeftTapAnimation(false);
          }, 500);
          toast(`-${SEEK_AMOUNT}s`, { icon: '⏪', duration: 500 });
        } else {
          // Seek forward
          const newTime = Math.min(duration, video.currentTime + SEEK_AMOUNT);
          video.currentTime = newTime;
          setShowRightTapAnimation(true);
          clearTimeout(tapAnimationTimeoutRef.current);
          tapAnimationTimeoutRef.current = setTimeout(() => {
            setShowRightTapAnimation(false);
          }, 500);
          toast(`+${SEEK_AMOUNT}s`, { icon: '⏩', duration: 500 });
        }

        lastTapRef.current = null;
      } else {
        // First tap
        lastTapRef.current = { time: now, x, side };
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      clearTimeout(tapAnimationTimeoutRef.current);
    };
  }, [duration]);

  // ===================================
  // Video Event Handlers
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const now = Date.now();
      // Throttle to update at most 4 times per second (250ms)
      if (now - lastTimeUpdateRef.current >= 250) {
        lastTimeUpdateRef.current = now;
        setCurrentTime(video.currentTime);
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);

      // Save watch progress - episode completed
      if (animeId && episodeNumber) {
        saveWatchProgressRef.current(animeId, episodeNumber, video.duration, true);
      }

      // Handle next episode autoplay
      if (onEpisodeEnd) {
        onEpisodeEnd();
      }

      if (nextEpisodeUrl && preferences.autoNext) {
        startAutoplayCountdownRef.current();
      }
    };
    const handlePlay = () => {
      setIsPlaying(true);
      // CRITICAL FIX: Ensure HLS is loading when video starts playing
      // This handles the case where browser's native play() is called (not via our play() function)
      const hls = hlsRef.current;
      if (hls && hlsReady) {
        logger.log("[handlePlay] Video started playing, ensuring HLS is loading");
        try {
          hls.startLoad(video.currentTime);
        } catch (e) {
          // HLS might already be loading or in a state where startLoad isn't needed
          logger.debug("[handlePlay] HLS startLoad skipped:", e);
        }
      }
    };
    const handlePause = () => setIsPlaying(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.length > 0
          ? video.buffered.end(video.buffered.length - 1)
          : 0;
        setBufferProgress((buffered / video.duration) * 100);
      }
    };
    const handleWaiting = () => {
      logger.log("[Video Player] Waiting event - debouncing to prevent false positive");

      // Clear any existing debounce timeout
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
      }

      // CRITICAL FIX: Debounce waiting event to prevent false positive buffering
      // Only show buffering if waiting persists for 500ms (HLS preload triggers quick waiting events)
      waitingDebounceRef.current = setTimeout(() => {
        // Double-check we're actually waiting (video hasn't started playing)
        if (video.paused || video.readyState < 3) {
          logger.log("[Video Player] Confirmed buffering state - video is stalled");
          setIsBuffering(true);
          setIsPlaying(false);

          // Clear any existing buffering timeout
          if (bufferingSafetyTimeoutRef.current) {
            clearTimeout(bufferingSafetyTimeoutRef.current);
          }

          // ENHANCED: Reduced safety timeout with progressive retry
          // First check: 5 seconds for quick recovery
          bufferingSafetyTimeoutRef.current = setTimeout(() => {
            // Try to recover HLS if it exists
            const hls = hlsRef.current;
            if (hls && hls.media) {
              logger.warn("[Buffering Recovery] Attempting HLS recovery after 5s");
              try {
                hls.startLoad(video.currentTime);
              } catch (e) {
                logger.error("[Buffering Recovery] HLS startLoad failed:", e);
              }
            }
          }, 5000); // First recovery attempt at 5s

          // Set final safety timeout
          bufferingFallbackRef.current = setTimeout(() => {
            if (bufferingSafetyTimeoutRef.current) {
              logger.warn("Buffering safety timeout - forcing buffering state clear");
              setIsBuffering(false);
              bufferingSafetyTimeoutRef.current = null;
            }
          }, 15000); // Reduced from 30s to 15s for better UX
        } else {
          logger.log("[Video Player] Waiting event cleared - video is playing");
        }
      }, 500); // 500ms debounce to filter out transient waiting events
    };
    const handleCanPlay = () => {
      logger.log("[Video Player] CanPlay event - ready to play");
      // CRITICAL: Clear waiting debounce immediately
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
        waitingDebounceRef.current = null;
      }
      // Clear the buffering safety timeout since we can play now
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
      setIsBuffering(false);
      setIsLoading(false);
    };
    // NEW: Handle canplaythrough for smoother playback
    const handleCanPlayThrough = () => {
      logger.log("[Video Player] CanPlayThrough event - should play without stalling");
      // CRITICAL: Clear waiting debounce immediately
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
        waitingDebounceRef.current = null;
      }
      setIsBuffering(false);
      setIsLoading(false);
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
    };
    const handleRateChange = () => {
      if (video.playbackRate !== playbackRate) {
        video.playbackRate = playbackRate;
      }
    };
    // ENHANCED: Better seek handling with explicit HLS recovery
    const handleSeeking = () => {
      logger.log(`[Video Player] Seeking to ${video.currentTime}s`);
      setIsBuffering(true);

      // For HLS, explicitly start loading from the new position
      // This helps prevent getting stuck in buffering state
      const hls = hlsRef.current;
      if (hls && hls.media) {
        try {
          // Stop current loading and restart from seek position
          hls.stopLoad();
          // Clear any previous seek recovery timeout
          if (seekRecoveryRef.current) clearTimeout(seekRecoveryRef.current);
          // Small delay to let the stop take effect
          seekRecoveryRef.current = setTimeout(() => {
            if (hlsRef.current) {
              hlsRef.current.startLoad(video.currentTime);
            }
          }, 50);
        } catch (e) {
          logger.warn("[HLS] Seek recovery failed:", e);
        }
      }
    };
    const handleSeeked = () => {
      logger.log(`[Video Player] Seeked to ${video.currentTime}s`);
      // CRITICAL: Clear waiting debounce after seek completes
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
        waitingDebounceRef.current = null;
      }
      setIsBuffering(false);
    };
    // NEW: Handle stalled event when download stops
    const handleStalled = () => {
      logger.log("[Video Player] Download stalled, checking if recovery needed");
      // Only set buffering if we're actually playing (not paused)
      if (!video.paused && video.readyState < 3) {
        setIsBuffering(true);
        // Try to kickstart HLS if applicable
        const hls = hlsRef.current;
        if (hls && hls.media) {
          try {
            hls.startLoad(video.currentTime);
          } catch (e) {
            logger.error("[Stalled Recovery] HLS restart failed:", e);
          }
        }
      }
    };
    // NEW: Handle playing event to ensure buffering state is cleared
    const handlePlaying = () => {
      logger.log("[Video Player] Playing event - clearing buffering state");
      // CRITICAL: Clear waiting debounce immediately when playing starts
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
        waitingDebounceRef.current = null;
      }
      setIsBuffering(false);
      setIsPlaying(true);
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("progress", handleProgress);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("canplaythrough", handleCanPlayThrough);
    video.addEventListener("ratechange", handleRateChange);
    video.addEventListener("seeking", handleSeeking);
    video.addEventListener("seeked", handleSeeked);
    // NEW: Add stalled and playing event handlers
    video.addEventListener("stalled", handleStalled);
    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("seeking", handleSeeking);
      video.removeEventListener("seeked", handleSeeked);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("canplaythrough", handleCanPlayThrough);
      video.removeEventListener("ratechange", handleRateChange);
      // NEW: Clean up new event handlers
      video.removeEventListener("stalled", handleStalled);
      video.removeEventListener("playing", handlePlaying);
      // Clean up buffering safety timeout
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
      // Clean up waiting debounce timeout
      if (waitingDebounceRef.current) {
        clearTimeout(waitingDebounceRef.current);
        waitingDebounceRef.current = null;
      }
      // Clean up buffering fallback timeout
      if (bufferingFallbackRef.current) {
        clearTimeout(bufferingFallbackRef.current);
        bufferingFallbackRef.current = null;
      }
      // Clean up seek recovery timeout
      if (seekRecoveryRef.current) {
        clearTimeout(seekRecoveryRef.current);
        seekRecoveryRef.current = null;
      }
      // Clean up subtitle loading timeout
      if (subtitleTimerRef.current) {
        clearTimeout(subtitleTimerRef.current);
        subtitleTimerRef.current = null;
      }
      // Clean up play fallback timeout
      if (playFallbackRef2.current) {
        clearTimeout(playFallbackRef2.current);
        playFallbackRef2.current = null;
      }
    };
  }, [playbackRate, animeId, episodeNumber, nextEpisodeUrl, preferences.autoNext, onEpisodeEnd]); // Fix 2: saveWatchProgressRef is a ref so no stale closure

  // Auto-skip intro/outro
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleAutoSkip = () => {
      const time = video.currentTime;

      // Show skip intro button during intro
      if (time >= introStart && time <= introEnd && !introSkippedRef.current) {
        setShowSkipIntro(true);

        // Auto-skip intro if enabled
        if (preferences.autoSkipIntro && time > introStart + 2) {
          // Don't auto-skip in first 2 seconds of intro (give user time to cancel)
          video.currentTime = introEnd;
          introSkippedRef.current = true;
          setIntroSkipped(true);
          setShowSkipIntro(false);
        }
      } else {
        setShowSkipIntro(false);
        // Reset intro skip when past intro
        if (time > introEnd + 5) {
          introSkippedRef.current = false;
          setIntroSkipped(false);
        }
      }

      // Show skip outro button during outro
      if (time >= outroStart && time <= outroEnd && !outroSkippedRef.current) {
        setShowSkipOutro(true);

        // Auto-skip outro if enabled
        if (preferences.autoSkipOutro && time > outroStart + 2) {
          video.currentTime = outroEnd;
          outroSkippedRef.current = true;
          setOutroSkipped(true);
          setShowSkipOutro(false);
        }
      } else {
        setShowSkipOutro(false);
        // Reset outro skip when past outro
        if (time > outroEnd + 5) {
          outroSkippedRef.current = false;
          setOutroSkipped(false);
        }
      }

      // Show skip recap button during recap
      if (recapStart !== null && recapEnd !== null && time >= recapStart && time <= recapEnd && !recapSkippedRef.current) {
        setShowSkipRecap(true);
      } else {
        setShowSkipRecap(false);
        if (recapEnd !== null && time > recapEnd + 5) {
          recapSkippedRef.current = false;
          setRecapSkipped(false);
        }
      }
    };

    video.addEventListener("timeupdate", handleAutoSkip);
    return () => video.removeEventListener("timeupdate", handleAutoSkip);
  }, [introStart, introEnd, outroStart, outroEnd, recapStart, recapEnd, preferences.autoSkipIntro, preferences.autoSkipOutro]); // Fix 3: removed introSkipped/outroSkipped/recapSkipped from deps — using refs instead

  // Apply subtitle styles
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSubtitleStyles = () => {
      // Fix M12: Use player-instance-specific style ID to avoid conflicts with multiple players
      const styleId = `subtitle-style-${playerIdRef.current}`;
      // Create or update style element for ::cue pseudo-element
      let styleEl = document.getElementById(styleId);
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      // Apply styles to video container's subtitles
      const positionStyle = subtitlePosition === "top" ? "top: 10% !important; bottom: auto !important;" : "bottom: 5% !important; top: auto !important;";
      styleEl.textContent = `
        video::-webkit-media-text-track-display {
          font-size: ${subtitleSize}px !important;
          font-family: Arial, sans-serif !important;
          ${positionStyle}
          text-shadow: 2px 2px 4px rgba(0,0,0,0.9) !important;
          background-color: ${subtitleBackground} !important;
          color: ${subtitleColor} !important;
        }
        video::cue {
          font-size: ${subtitleSize}px !important;
          font-family: Arial, sans-serif !important;
          ${positionStyle}
          text-shadow: 2px 2px 4px rgba(0,0,0,0.9) !important;
          background-color: ${subtitleBackground} !important;
          color: ${subtitleColor} !important;
        }
      `;
    };

    updateSubtitleStyles();

    // Save subtitle preferences
    localStorage.setItem("subtitle-size", subtitleSize.toString());
    localStorage.setItem("subtitle-color", subtitleColor);
    localStorage.setItem("subtitle-background", subtitleBackground);
    localStorage.setItem("subtitle-position", subtitlePosition);

    return () => {
      const styleId = `subtitle-style-${playerIdRef.current}`;
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, [subtitleSize, subtitleColor, subtitleBackground, subtitlePosition]);

  // Skip functions
  const skipIntro = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = introEnd;
      setIntroSkipped(true);
      setShowSkipIntro(false);
    }
  };

  const skipOutro = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = outroEnd;
      setOutroSkipped(true);
      setShowSkipOutro(false);
    }
  };

  // Apply playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Calculate settings dropdown position for portal rendering
  useEffect(() => {
    if (!showSettings || !settingsButtonRef.current) {
      setPortalDropdownStyle({});
      return;
    }

    const updatePosition = () => {
      const button = settingsButtonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const estimatedHeight = showSubtitleSettings ? 500 : 300;

      // Determine if there's more space above or below
      const spaceAbove = rect.top;
      const spaceBelow = viewportHeight - rect.bottom;

      // Position above if there's enough space, otherwise below
      const positionTop = spaceAbove >= estimatedHeight;

      // Calculate fixed position for portal
      if (positionTop) {
        setPortalDropdownStyle({
          position: 'fixed',
          bottom: viewportHeight - rect.top + 8,
          right: window.innerWidth - rect.right,
        });
      } else {
        setPortalDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    };

    updatePosition();

    // Recalculate on scroll and resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showSettings, showSubtitleSettings]);

  // ===================================
  // ===================================
  // Player Controls
  // ===================================

  const play = async () => {
    const video = videoRef.current;
    const hls = hlsRef.current;

    if (!video) {
      logger.warn("[play] No video element available");
      return;
    }

    logger.log("[play] Called - video.paused:", video.paused, "hlsReady:", hlsReady, "hls exists:", !!hls, "readyState:", video.readyState);

    // CRITICAL FIX: When resuming from pause, HLS.js needs startLoad() to restart buffering
    // HLS.js automatically calls stopLoad() when paused, but doesn't auto-restart
    if (hls && video.paused && hlsReady) {
      logger.log("[play] Resuming from pause - calling hls.startLoad() at position:", video.currentTime);
      try {
        hls.startLoad(video.currentTime);
      } catch (e) {
        logger.error("[play] HLS startLoad failed:", e);
      }
    }

    // Mark that user initiated playback (ref so HLS event handlers see the current value immediately)
    userInitiatedPlayRef.current = true;

    // Check if HLS is being used but not ready yet
    if (hls && !hlsReady) {
      logger.log("[play] HLS exists but not ready, waiting for MANIFEST_PARSED...");
      setIsLoading(true);
      toast("Loading stream...", { icon: "⏳", duration: 2000 });

      // Set up a one-time listener to play when ready
      const onManifestParsed = () => {
        logger.log("[play] Manifest parsed, starting playback...");
        video.play().catch((err) => {
          logger.error("[play] Play failed after manifest parsed:", err);
        });
      };

      // Listen for MANIFEST_PARSED if not already ready
      hls.once(HlsConstructor!.Events.MANIFEST_PARSED, onManifestParsed);

      // Also try to play after a short delay as fallback
      if (playFallbackRef2.current) clearTimeout(playFallbackRef2.current);
      playFallbackRef2.current = setTimeout(() => {
        if (video.paused && video.readyState >= 2) {
          logger.log("[play] Fallback: Video has data, attempting play...");
          video.play().catch(() => {});
        }
      }, 2000);

      return;
    }

    // Check video readyState before attempting to play
    if (video.readyState < 2) { // HAVE_CURRENT_DATA
      logger.log(`[play] Video not ready (readyState: ${video.readyState}), waiting...`);
      setIsLoading(true);

      // Wait for video to be ready
      let retries = 0;
      const checkReady = () => {
        if (video.readyState >= 2) {
          logger.log("[play] Video is now ready, playing...");
          setIsLoading(false);
          video.play().catch((err) => {
            logger.warn("[play] Play failed:", err);
            toast("Click to play video", { icon: "🎬", duration: 2000 });
          });
        } else {
          // Check again in 100ms (max 100 retries = 10 seconds)
          if (retries < 100) {
            retries++;
            setTimeout(checkReady, 100);
          } else {
            logger.warn("[play] Gave up waiting for video to be ready");
            setIsLoading(false);
            toast("Video failed to load. Try refreshing.", { icon: "⚠️", duration: 3000 });
          }
        }
      };

      checkReady();
      return;
    }

    try {
      logger.log("[play] Playing video (readyState:", video.readyState, "paused:", video.paused, ")");
      await video.play();
      setIsLoading(false);
    } catch (e) {
      logger.error("[play] Failed to play:", e);
      // Auto-play was blocked or other error
      toast("Click to play video", { icon: "🎬", duration: 2000 });
    }
  };

  const pause = () => {
    videoRef.current?.pause();
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      play();
    } else {
      pause();
    }
  };

  const toggleMute = () => {
    setIsMuted((m) => {
      const newMuted = !m;
      if (typeof window !== 'undefined') {
        localStorage.setItem('player-muted', String(newMuted));
      }
      return newMuted;
    });
  };

  const toggleFullscreen = () => {
    const container = containerRef.current as FullscreenContainer | null;
    const fullscreenDocument = document as FullscreenDocument;
    if (!container) return;

    if (document.fullscreenElement) {
      // Exit fullscreen - try all vendor methods
      if (fullscreenDocument.exitFullscreen) {
        fullscreenDocument.exitFullscreen();
      } else if (fullscreenDocument.webkitExitFullscreen) {
        fullscreenDocument.webkitExitFullscreen();
      } else if (fullscreenDocument.mozCancelFullScreen) {
        fullscreenDocument.mozCancelFullScreen();
      } else if (fullscreenDocument.msExitFullscreen) {
        fullscreenDocument.msExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      // Enter fullscreen - try all vendor methods
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if (container.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
      } else if (container.mozRequestFullScreen) {
        container.mozRequestFullScreen();
      } else if (container.msRequestFullscreen) {
        container.msRequestFullscreen();
      }
      setIsFullscreen(true);
    }
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode((t) => !t);
  };

  // AirPlay: show native picker
  const handleAirPlay = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      (video as HTMLVideoElement & { webkitShowPlaybackTargetPicker?: () => void }).webkitShowPlaybackTargetPicker?.();
    } catch {
      // not supported
    }
  };

  // Chromecast: request session
  const handleCast = () => {
    type CastWin = { cast?: { framework?: { CastContext?: { getInstance: () => { requestSession: () => void } } } } };
    try {
      const ctx = (window as unknown as CastWin).cast?.framework?.CastContext?.getInstance();
      if (ctx) {
        ctx.requestSession();
      } else {
        toast.error("Chromecast not available");
      }
    } catch {
      toast.error("Chromecast not available");
    }
  };

  const takeScreenshot = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const episodePart = episodeNumber ? `-ep${episodeNumber}` : "";
        const timePart = video.currentTime ? `-${Math.floor(video.currentTime)}s` : "";
        a.download = `animeverse-${animeTitle?.replace(/[^a-z0-9]/gi, "-").toLowerCase() || "screenshot"}${episodePart}${timePart}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Screenshot saved!");
      }, "image/png");
    } catch {
      toast.error("Screenshot failed");
    }
  }, [animeTitle, episodeNumber]);

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPip(false);
      } else if ("requestPictureInPicture" in video) {
        await video.requestPictureInPicture();
        setIsPip(true);
      }
    } catch (e) {
      toast("Picture-in-Picture is not supported in this browser");
    }
  };

  const seek = (time: number) => {
    const video = videoRef.current;
    if (video) {
      // Use video.duration directly instead of state to avoid stale values
      const videoDuration = video.duration || duration;
      const seekTime = Math.max(0, Math.min(videoDuration, time));
      logger.log(`[Video Player] Seeking to ${seekTime}s (current: ${video.currentTime}s, duration: ${videoDuration}s)`);

      // For HLS, we need to ensure we don't trigger a reload
      // HLS.js should handle seeking natively
      video.currentTime = seekTime;

      // Store the seek time for recovery if needed
      (video as SeekableVideoElement).__lastSeekTime = seekTime;
    }
  };

  // ===================================
  // Quality & Speed
  // ===================================

  const changeQuality = (qualityUrl: string, qualityLabel: string) => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;
    const wasPlaying = !video.paused;

    // Destroy existing HLS instance before switching source
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    video.src = qualityUrl;
    video.currentTime = currentTime;

    video.addEventListener("loadedmetadata", () => {
      if (wasPlaying) {
        video.play().catch(() => {
          // Auto-play blocked, user needs to click
        });
      }
    }, { once: true });

    setCurrentQuality(qualityLabel);
    localStorage.setItem("animeverse-preferredQuality", qualityLabel);
    toast(`Quality changed to ${qualityLabel}`, { duration: 2000 });
  };

  const changeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    localStorage.setItem('player-speed', speed.toString());
    toast(`Playback speed: ${speed}x`, { duration: 2000 });
  };

  // ===================================
  // Autoplay Next Episode
  // ===================================

  const startAutoplayCountdown = () => {
    setShowAutoplayCountdown(true);
    setAutoplayCountdown(10);
  };

  const cancelAutoplay = () => {
    setShowAutoplayCountdown(false);
    setAutoplayCountdown(10);
  };

  const goToNextEpisode = () => {
    if (nextEpisodeUrl) {
      router.push(nextEpisodeUrl);
    }
  };

  // Keep refs up-to-date for stale-closure-free effects
  goToNextEpisodeRef.current = goToNextEpisode;
  startAutoplayCountdownRef.current = startAutoplayCountdown;
  handlersRef.current = {
    togglePlay,
    toggleMute,
    toggleFullscreen,
    toggleTheaterMode,
    togglePip,
    seek,
    goToNextEpisode,
    startAutoplayCountdown,
  } as Record<string, (...args: unknown[]) => void>;

  // Use effect for autoplay countdown
  useEffect(() => {
    if (!showAutoplayCountdown) return;

    if (autoplayCountdown <= 0) {
      goToNextEpisode();
      return;
    }

    const timer = setTimeout(() => {
      setAutoplayCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [showAutoplayCountdown, autoplayCountdown, nextEpisodeUrl]);

  // ===================================
  // Controls Auto-Hide
  // ===================================

  const resetControlsTimeout = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);

    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetControlsTimeout();
    return () => clearTimeout(controlsTimeoutRef.current);
  }, [resetControlsTimeout, isPlaying]);

  // ===================================
  // Volume Control
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (volumeSaveRef.current) clearTimeout(volumeSaveRef.current);
      volumeSaveRef.current = setTimeout(() => {
        localStorage.setItem('player-volume', volume.toString());
      }, 500);
    }
    return () => {
      if (volumeSaveRef.current) clearTimeout(volumeSaveRef.current);
    };
  }, [volume]);

  // ===================================
  // Media Session API
  // ===================================

  // Media Session API — lock screen / notification controls
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: episodeNumber ? `Episode ${episodeNumber}` : (animeTitle || 'Anime'),
      artist: animeTitle || '',
      album: 'AnimeVerse',
      artwork: poster ? [
        { src: poster, sizes: '512x512', type: 'image/jpeg' }
      ] : [],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      videoRef.current?.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      videoRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - (details.seekOffset || 10));
      }
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(videoRef.current.duration || Infinity, videoRef.current.currentTime + (details.seekOffset || 10));
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', prevEpisodeUrl ? () => {
      window.location.href = prevEpisodeUrl;
    } : null);
    navigator.mediaSession.setActionHandler('nexttrack', nextEpisodeUrl ? () => {
      goToNextEpisodeRef.current();
    } : null);

    return () => {
      try {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
        navigator.mediaSession.setActionHandler('previoustrack', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
      } catch {
        // Some browsers throw when setting handler to null
      }
    };
  }, [animeTitle, episodeNumber, poster, nextEpisodeUrl, prevEpisodeUrl]);

  // Update Media Session position state when time changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator) || !duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: playbackRate,
        position: currentTime,
      });
    } catch {
      // setPositionState may throw in some browsers
    }
  }, [currentTime, duration, playbackRate]);

  // Sync media session playback state
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  // ===================================
  // Fullscreen Change Handler
  // ===================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFS = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement
      );
      setIsFullscreen(isFS);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // ===================================
  // Progress Click
  // ===================================

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) {
      logger.warn("[handleProgressClick] No video or duration available");
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * video.duration);
  };

  // ===================================
  // Render
  // ===================================

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn("relative", !isTheaterMode && "w-full")}>
      {/* Ambient glow canvas — rendered behind the player, blurred */}
      {isAmbientMode && !isTheaterMode && (
        <canvas
          ref={ambientCanvasRef}
          className="absolute -inset-8 w-[calc(100%+4rem)] h-[calc(100%+4rem)] opacity-60 blur-3xl scale-110 pointer-events-none z-0"
          aria-hidden="true"
        />
      )}
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-xl overflow-hidden group w-full z-10",
        isTheaterMode ? "fixed inset-0 z-50 rounded-none" : "",
        !isTheaterMode && "max-w-full",
        className
      )}
      style={!isTheaterMode ? { height: 'auto', aspectRatio: '16/9', maxHeight: 'calc(100vh - 300px)' } : {}}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        onClick={togglePlay}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        // AirPlay support
        {...({ "x-webkit-airplay": "allow" } as React.HTMLAttributes<HTMLVideoElement>)}
      />

      {/* Loading/Buffering Overlay */}
      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn z-30 pointer-events-none">
          <div className="relative">
            {/* Spinner with glow */}
            <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
            <div className="absolute inset-0 w-16 h-16 bg-primary/20 rounded-full animate-pulse-glow blur-xl" />
          </div>

          {bufferProgress > 0 && bufferProgress < 95 ? (
            <div className="w-48 flex flex-col items-center gap-2">
              <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(bufferProgress, 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Buffering... {Math.round(bufferProgress)}%
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium">
                {isBuffering ? 'Buffering...' : source?.url?.includes('.m3u8') ? 'Loading stream...' : 'Loading video...'}
              </p>
              {/* Animated dots */}
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_0} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_150} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={ANIMATION_DELAY_300} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-20 pointer-events-none"
        >
          <button
            className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center pointer-events-none"
            type="button"
            tabIndex={-1}
            aria-hidden="true"
          >
            <Play className="w-12 h-12 text-white ml-1" fill="currentColor" />
          </button>
        </div>
      )}

      {/* Autoplay Countdown Overlay */}
      {showAutoplayCountdown && nextEpisodeUrl && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-20">
          <div className="text-center">
            <p className="text-lg mb-4">Playing next episode in</p>
            <p className="text-4xl font-bold text-primary">{autoplayCountdown}</p>
            <button
              onClick={cancelAutoplay}
              className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Cancel autoplay"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Double-tap Zones for Mobile */}
      <div className="absolute inset-0 flex pointer-events-none z-10">
        {/* Left Zone - Seek Backward */}
        <div className="w-1/3 h-full flex items-center justify-center">
          {showLeftTapAnimation && (
            <div className="flex items-center gap-2 animate-ping">
              <SkipBack className="w-12 h-12 text-white/80" fill="currentColor" />
              <span className="text-2xl font-bold text-white/80">-10s</span>
            </div>
          )}
        </div>
        {/* Center Zone - Empty for play/pause tap */}
        <div className="w-1/3 h-full" />
        {/* Right Zone - Seek Forward */}
        <div className="w-1/3 h-full flex items-center justify-center">
          {showRightTapAnimation && (
            <div className="flex items-center gap-2 animate-ping">
              <span className="text-2xl font-bold text-white/80">+10s</span>
              <SkipForward className="w-12 h-12 text-white/80" fill="currentColor" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 px-3 py-2 sm:p-4 sm:pb-6 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onMouseMove={resetControlsTimeout}
      >
        {/* Progress Bar with Thumbnail Preview */}
        <div className="relative mb-2 sm:mb-4">
          <div
            className="relative h-1.5 sm:h-2 bg-white/20 rounded-full cursor-pointer group/progress active:h-2 sm:active:h-3 transition-all"
            onClick={handleProgressClick}
            role="slider"
            aria-label="Video progress"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration || 0)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration || 0)}`}
            tabIndex={0}
            onKeyDown={(e) => {
              const video = videoRef.current;
              if (!video) return;
              if (e.key === 'ArrowLeft') {
                video.currentTime = Math.max(0, video.currentTime - 5);
                e.preventDefault();
              } else if (e.key === 'ArrowRight') {
                const videoDuration = video.duration || duration;
                video.currentTime = Math.min(videoDuration, video.currentTime + 5);
                e.preventDefault();
              }
            }}
          >
            <div className="absolute top-0 left-0 h-full bg-white/30 rounded-full" style={{ width: `${bufferProgress}%` }} />
            <div className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
            {source.type !== "direct" && torrentProgress < 1 && (
              <div className="absolute top-0 left-0 h-full bg-secondary/50 rounded-full" style={{ width: `${torrentProgress * 100}%` }} />
            )}
          </div>
          {/* Time Tooltip Preview */}
          <SimpleThumbnailPreview duration={duration || 0} currentTime={currentTime} />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 lg:gap-4">
          {/* Left Controls */}
          <div className="flex items-center gap-0.5 sm:gap-1">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" />}
            </button>

            {/* Skip Buttons */}
            {showSkipIntro && (
              <button
                onClick={skipIntro}
                className="px-4 py-3 sm:px-3 sm:py-2 bg-primary/80 hover:bg-primary text-white rounded-full transition-colors text-sm font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
                aria-label="Skip intro"
                title="Skip Intro"
              >
                <SkipBack className="w-4 h-4" />
                <span className="hidden sm:inline">Skip Intro</span>
              </button>
            )}
            {showSkipOutro && (
              <button
                onClick={skipOutro}
                className="px-4 py-3 sm:px-3 sm:py-2 bg-primary/80 hover:bg-primary text-white rounded-full transition-colors text-sm font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
                aria-label="Skip outro"
                title="Skip Outro"
              >
                Skip Outro
                <SkipForward className="w-4 h-4" />
              </button>
            )}
            {showSkipRecap && (
              <button
                onClick={() => {
                  const video = videoRef.current;
                  if (video && recapEnd !== null) {
                    video.currentTime = recapEnd;
                    setRecapSkipped(true);
                    setShowSkipRecap(false);
                  }
                }}
                className="px-4 py-3 sm:px-3 sm:py-2 bg-orange-500/80 hover:bg-orange-500 text-white rounded-full transition-colors text-sm font-medium flex items-center gap-1 min-h-[44px] sm:min-h-0"
                aria-label="Skip recap"
                title="Skip Recap"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden sm:inline">Skip Recap</span>
              </button>
            )}

            {/* Volume - Desktop */}
            <div className="hidden sm:flex items-center gap-1 group/volume">
              <button
                onClick={toggleMute}
                className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" /> : <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-0 group-hover/volume:w-20 transition-all duration-200 accent-primary"
                aria-label="Volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
              />
            </div>

            {/* Volume - Mobile */}
            <div className="sm:hidden relative">
              <button
                onClick={() => {
                  toggleMute();
                  setShowMobileVolumeSlider(!showMobileVolumeSlider);
                }}
                className="p-3 hover:bg-white/10 rounded-full transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
              </button>
              {showMobileVolumeSlider && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 bg-black/90 rounded-xl backdrop-blur-sm">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      setIsMuted(parseFloat(e.target.value) === 0);
                    }}
                    className="w-32 accent-primary"
                    aria-label="Volume"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
                    aria-valuetext={`${Math.round((isMuted ? 0 : volume) * 100)}%`}
                  />
                  <p className="text-center text-xs mt-1">{Math.round((isMuted ? 0 : volume) * 100)}%</p>
                </div>
              )}
            </div>

            {/* Time Display - hidden on very small screens */}
            <div className="text-sm font-medium hidden xs:block">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-0 sm:gap-0.5 lg:gap-2">
            {/* Language Selector (Sub/Dub) */}
            {allLanguages && allLanguages.length > 0 && (
              <LanguageSelector
                languages={allLanguages}
                currentLanguage={currentLanguage}
                onLanguageChange={(langId) => {
                  setCurrentLanguage(langId);
                  localStorage.setItem("preferred-language", langId);
                  if (animeId) {
                    localStorage.setItem(`preferred-language-${animeId}`, langId);
                  }
                  onLanguageChange?.(langId);
                }}
              />
            )}

            {/* Server Selector */}
            {allServers && allServers.length > 0 && (
              <ServerSelector
                servers={allServers}
                currentServer={currentServer}
                onServerChange={(serverId) => {
                  setCurrentServer(serverId);
                  localStorage.setItem(`preferred-server-${animeId}-${episodeNumber}`, serverId);
                  onServerChange?.(serverId);
                }}
                isLoading={isLoading}
              />
            )}

            {/* Watch Party - hidden on smaller screens to save space */}
            <div className="hidden lg:block">
              <WatchPartyControls
              animeId={animeId || 0}
              episodeNumber={episodeNumber || 0}
              onSync={(time, playing) => {
                if (videoRef.current && Math.abs(videoRef.current.currentTime - time) > 2) {
                  videoRef.current.currentTime = time;
                }
                if (playing && !isPlaying) {
                  videoRef.current?.play();
                } else if (!playing && isPlaying) {
                  videoRef.current?.pause();
                }
              }}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
            </div>

            {/* P2P Stats (for WebTorrent) */}
            {source.type !== "direct" && (
              <div className="hidden lg:flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1" title="Download Speed">
                  <Download className="w-3 h-3" />
                  <span>{formatBytes(downloadSpeed)}/s</span>
                </div>
                <div className="flex items-center gap-1" title="Peers">
                  <span>{peers} peers</span>
                </div>
              </div>
            )}

            {/* Download Button - hidden on smaller screens to prioritize fullscreen */}
            {source.type === "direct" && animeId && episodeNumber && animeTitle && (
              <div className="hidden md:block">
                <DownloadButton
                  animeId={animeId}
                  animeTitle={animeTitle}
                  episodeNumber={episodeNumber}
                  videoUrl={source.url}
                  thumbnailUrl={poster}
                />
              </div>
            )}

            {/* Previous Episode */}
            {prevEpisodeUrl && (
              <button
                onClick={() => { window.location.href = prevEpisodeUrl!; }}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
                title="Previous Episode"
                aria-label="Previous Episode"
              >
                <SkipBack className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>
            )}

            {/* Next Episode */}
            {nextEpisodeUrl && (
              <button
                onClick={goToNextEpisode}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-white/10 hover:bg-white/20 rounded transition-colors"
                title="Next Episode"
                aria-label="Next Episode"
              >
                <SkipForward className="w-4 h-4" />
                <span className="hidden sm:inline">Next</span>
              </button>
            )}

            {/* Settings */}
            <div className="relative">
              <button
                ref={settingsButtonRef}
                onClick={() => {
                  setShowSettings(!showSettings);
                }}
                className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-2"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Settings Dropdown - Fixed positioning to avoid overflow clipping */}
              {/* Backdrop */}
              {showSettings && (
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setShowSettings(false)}
                  aria-hidden="true"
                />
              )}
              {/* Dropdown */}
              {showSettings && (
                <div
                  ref={settingsDropdownRef}
                  className="settings-dropdown fixed bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden min-w-[200px] max-h-[60vh] overflow-y-auto z-[9999] shadow-xl"
                  style={portalDropdownStyle}
                >
                  {/* Quality Selector */}
                  <div className="p-2 border-b border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">Quality</p>
                    {sources.map((s, index) => (
                      <button
                        key={`${s.quality}-${index}`}
                        onClick={() => changeQuality(s.url, s.label)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/10 transition-colors text-sm",
                          currentQuality === s.label && "bg-white/10"
                        )}
                      >
                        <span>{s.label}</span>
                        {currentQuality === s.label && <div className="w-2 h-2 bg-primary rounded-full" />}
                      </button>
                    ))}
                  </div>

                  {/* Speed Selector */}
                  <div className="p-2 border-b border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">Playback Speed</p>
                    <div className="grid grid-cols-3 gap-1">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => changeSpeed(speed)}
                          className={cn(
                            "px-3 py-1 rounded hover:bg-white/10 transition-colors text-sm",
                            playbackRate === speed && "bg-white/10"
                          )}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Auto-Skip Settings */}
                  <div className="p-2 border-b border-white/10">
                    <div className="border-t border-white/10 pt-2 mt-2">
                      <p className="text-xs text-white/50 mb-2">Auto-Skip</p>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={preferences.autoSkipIntro}
                          onChange={(e) => updatePreferences({ autoSkipIntro: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-xs">Skip Intro</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={preferences.autoSkipOutro}
                          onChange={(e) => updatePreferences({ autoSkipOutro: e.target.checked })}
                          className="accent-primary"
                        />
                        <span className="text-xs">Skip Outro</span>
                      </label>
                    </div>
                  </div>

                  {/* Subtitle Settings */}
                  <div className="p-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted-foreground">Subtitles</p>
                      <button
                        onClick={() => setShowSubtitleSettings(!showSubtitleSettings)}
                        className="text-xs text-primary hover:underline"
                      >
                        {showSubtitleSettings ? "Hide" : "Customize"}
                      </button>
                    </div>

                    {/* Subtitle Language Selector */}
                    {subtitleTracks.length > 0 && (
                      <div className="mb-2">
                        <p className="text-xs text-muted-foreground mb-1">Language</p>
                        <div className="max-h-32 overflow-y-auto">
                          <button
                            onClick={() => {
                              const video = videoRef.current;
                              if (!video) return;
                              // Disable all tracks
                              for (let i = 0; i < video.textTracks.length; i++) {
                                video.textTracks[i].mode = "disabled";
                              }
                              setSubtitlesEnabled(false);
                              setCurrentSubtitle(-1);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/10 transition-colors text-sm",
                              !subtitlesEnabled && "bg-white/10"
                            )}
                          >
                            <span>Off</span>
                            {!subtitlesEnabled && <div className="w-2 h-2 bg-primary rounded-full" />}
                          </button>
                          {subtitleTracks.map((track, idx) => (
                            <button
                              key={`${track.lang}-${idx}`}
                              onClick={() => {
                                const video = videoRef.current;
                                if (!video) return;
                                // Disable all tracks
                                for (let i = 0; i < video.textTracks.length; i++) {
                                  video.textTracks[i].mode = "disabled";
                                }
                                // Find and enable the selected track
                                for (let i = 0; i < video.textTracks.length; i++) {
                                  const tt = video.textTracks[i];
                                  if ((tt.language === track.lang || tt.label === track.label) && tt.kind === "captions") {
                                    tt.mode = "showing";
                                    setCurrentSubtitle(idx);
                                    setSubtitlesEnabled(true);
                                    break;
                                  }
                                }
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded hover:bg-white/10 transition-colors text-sm",
                                subtitlesEnabled && currentSubtitle === idx && "bg-white/10"
                              )}
                            >
                              <span>{track.label}</span>
                              {subtitlesEnabled && currentSubtitle === idx && <div className="w-2 h-2 bg-primary rounded-full" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {showSubtitleSettings && (
                      <div className="space-y-3 mt-2">
                        {/* Size */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Size</p>
                          <div className="flex gap-1">
                            {[16, 18, 20, 24, 28, 32].map((size) => (
                              <button
                                key={size}
                                onClick={() => setSubtitleSize(size)}
                                className={cn(
                                  "flex-1 px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors",
                                  subtitleSize === size && "bg-white/10"
                                )}
                              >
                                {size}px
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Color */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Color</p>
                          <div className="flex gap-1">
                            {[
                              { color: "#ffffff", label: "White" },
                              { color: "#ffff00", label: "Yellow" },
                              { color: "#00ffff", label: "Cyan" },
                              { color: "#ff00ff", label: "Magenta" },
                            ].map((c) => (
                              <button
                                key={c.color}
                                onClick={() => setSubtitleColor(c.color)}
                                className={cn(
                                  "flex-1 px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors",
                                  subtitleColor === c.color && "bg-white/10"
                                )}
                                style={{ color: c.color }}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Background */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Background</p>
                          <div className="flex gap-1">
                            {[
                              { bg: "rgba(0,0,0,0.75)", label: "Dark" },
                              { bg: "rgba(0,0,0,0.5)", label: "Light" },
                              { bg: "transparent", label: "None" },
                            ].map((b) => (
                              <button
                                key={b.bg}
                                onClick={() => setSubtitleBackground(b.bg)}
                                className={cn(
                                  "flex-1 px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors",
                                  subtitleBackground === b.bg && "bg-white/10"
                                )}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Position */}
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Position</p>
                          <div className="flex gap-1">
                            {[
                              { pos: "bottom", label: "Bottom" },
                              { pos: "top", label: "Top" },
                            ].map((p) => (
                              <button
                                key={p.pos}
                                onClick={() => setSubtitlePosition(p.pos)}
                                className={cn(
                                  "flex-1 px-2 py-1 rounded text-xs hover:bg-white/10 transition-colors",
                                  subtitlePosition === p.pos && "bg-white/10"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="pt-2 border-t border-white/10">
                          <p className="text-xs text-muted-foreground mb-1">Preview</p>
                          <div
                            className="px-3 py-2 rounded text-center text-sm"
                            style={{
                              backgroundColor: subtitleBackground,
                              color: subtitleColor,
                              fontSize: `${Math.min(subtitleSize, 24)}px`,
                            }}
                          >
                            Sample subtitle text
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                )}
            </div>

            {/* Screenshot */}
            <button
              onClick={takeScreenshot}
              className="p-1 sm:p-1.5 hover:bg-white/10 rounded-full transition-colors min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0 hidden sm:flex items-center justify-center"
              aria-label="Take screenshot"
              title="Screenshot (saves to file)"
            >
              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Ambient Mode */}
            <button
              onClick={() => setIsAmbientMode((v) => !v)}
              className={cn(
                "p-1 sm:p-1.5 hover:bg-white/10 rounded-full transition-colors min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0",
                isAmbientMode && "bg-purple-500/30 text-purple-300"
              )}
              aria-label={isAmbientMode ? "Disable ambient mode" : "Ambient mode"}
              title={isAmbientMode ? "Disable ambient glow" : "Ambient glow mode"}
            >
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* AirPlay */}
            {airPlayAvailable && (
              <button
                onClick={handleAirPlay}
                className="p-1 sm:p-1.5 hover:bg-white/10 rounded-full transition-colors min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0"
                aria-label="AirPlay"
                title="AirPlay to Apple TV"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 17l7-7 7 7H5zM2 19h20v2H2v-2z" />
                  <path d="M12 2C6.477 2 2 6.477 2 12h2a8 8 0 1 1 16 0h2C22 6.477 17.523 2 12 2z" opacity="0.5" />
                </svg>
              </button>
            )}

            {/* Chromecast */}
            <button
              onClick={handleCast}
              className={cn(
                "p-1 sm:p-1.5 hover:bg-white/10 rounded-full transition-colors min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0",
                isCasting && "bg-blue-500/30 text-blue-300"
              )}
              aria-label={isCasting ? "Stop casting" : "Cast to TV"}
              title={isCasting ? "Stop Chromecast" : "Cast to Chromecast"}
            >
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M1 18v3h3c0-1.66-1.34-3-3-3z" />
                <path d="M1 14v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7z" />
                <path d="M1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11z" />
                <path d="M21 3H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
              </svg>
            </button>

            {/* Theater Mode - now visible on all screens */}
            <button
              onClick={toggleTheaterMode}
              className={cn(
                "p-1 sm:p-1.5 hover:bg-white/10 rounded-full transition-colors min-w-[32px] min-h-[32px] sm:min-w-0 sm:min-h-0",
                isTheaterMode && "bg-white/10"
              )}
              aria-label={isTheaterMode ? "Exit theater mode" : "Theater mode"}
              title={isTheaterMode ? "Exit theater mode" : "Theater mode"}
            >
              <Monitor className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* PIP */}
            <button
              onClick={togglePip}
              className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5"
              aria-label="Picture-in-Picture"
              title="Picture-in-Picture"
            >
              <Copy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2.5 hover:bg-white/10 rounded-full transition-colors min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 sm:p-1.5"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Theater Mode Exit Button */}
      {isTheaterMode && (
        <button
          onClick={toggleTheaterMode}
          className="absolute top-4 right-4 p-3 sm:p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg transition-colors z-50 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
          aria-label="Exit theater mode"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
    </div>
  );
}
