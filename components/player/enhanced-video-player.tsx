/**
 * Enhanced Video Player Component
 * With quality selector, autoplay, speed control, PIP, theater mode, keyboard shortcuts
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
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
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { usePreferences, useStore } from "@/store";
import { toast } from "react-hot-toast";
import { ServerSelector, LanguageSelector } from "@/components/player/server-selector";
import dynamic from "next/dynamic";
import { SimpleThumbnailPreview } from "@/components/player/episode-thumbnails";
import { DownloadButton } from "@/components/player/download-button";
import {
  getIntroOutroTimestamps,
  getEstimatedTimestamps,
  type IntroOutroTimestamps,
} from "@/lib/aniskip";
import Hls from "hls.js";

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
  allServers = [],
  allLanguages = [
    { id: "sub", label: "Subtitles", type: "sub" },
    { id: "dub", label: "Dubbed", type: "dub" },
  ],
  onServerChange,
  onLanguageChange,
  subtitles = [], // NEW: Subtitle tracks from API
}: VideoPlayerProps & { subtitles?: SubtitleTrack[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const hlsRef = useRef<Hls | null>(null);
  const bufferingSafetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferProgress, setBufferProgress] = useState(0);

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
      return localStorage.getItem("preferred-language") || "sub";
    }
    return "sub";
  });

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
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

  // PIP
  const [isPip, setIsPip] = useState(false);

  // Autoplay countdown
  const [showAutoplayCountdown, setShowAutoplayCountdown] = useState(false);
  const [autoplayCountdown, setAutoplayCountdown] = useState(10);

  // Skip intro/outro buttons
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [showSkipOutro, setShowSkipOutro] = useState(false);
  const [introSkipped, setIntroSkipped] = useState(false);
  const [outroSkipped, setOutroSkipped] = useState(false);

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

  // User preferences
  const { preferences, updatePreferences } = usePreferences();

  // Store for watch history
  const { addToWatchHistory } = useStore();

  // Dynamic intro/outro timestamps from AniSkip API
  const [skipTimestamps, setSkipTimestamps] = useState<IntroOutroTimestamps>({});

  // Computed timestamps with fallback to defaults
  const introStart = skipTimestamps.intro?.start ?? 85;
  const introEnd = skipTimestamps.intro?.end ?? 170;
  const outroStart = skipTimestamps.outro?.start ?? 1320;
  const outroEnd = skipTimestamps.outro?.end ?? 1410;

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
        const data = JSON.parse(localStorage.getItem(key) || "{}");
        data[epNumber] = {
          progress,
          timestamp: Date.now(),
        };
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        // Silently fail - app will work without persistence
      }
    },
    [addToWatchHistory]
  );

  // ===================================
  // Video Loading
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    console.log("[VideoPlayer] Loading video source:", {
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

    // Timeout fallback to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn("Video loading timeout - clearing loading state");
      setIsLoading(false);
      setIsBuffering(false);
    }, 15000); // 15 seconds max (reduced from 30 for faster UX)

    // Fallback safety timeout - ensures loading state is always cleared
    const safetyTimeout = setTimeout(() => {
      console.warn("Video safety timeout - forcing loading state clear");
      setIsLoading(false);
      setIsBuffering(false);
    }, 30000); // 30 seconds absolute max

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
          console.error("Video error:", errorMessage);
        } else if (e instanceof Error) {
          errorMessage = e.message;
          console.error("Video error:", errorMessage);
        } else {
          console.error("Video error:", JSON.stringify(e));
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

      // Determine if we need to use proxy (has referer or external domain)
      const needsProxy = source.referer || !source.url.includes(window.location.hostname);

      if (isHls && typeof Hls !== "undefined" && Hls.isSupported()) {
        // Use HLS.js for browsers that don't support HLS natively
        // Configure for better compatibility with various CDN formats
        const hlsConfig: any = {
          // Disable worker - can cause issues with some codec formats
          enableWorker: false,
          // Don't use low latency mode - more lenient parsing
          lowLatencyMode: false,
          // Progressive download - more compatible
          progressive: true,
          // Increase buffer tolerance
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          // Don't automatically switch levels (can cause parsing issues)
          autoStartLoad: true,
          // Cap level to player size to avoid unsupported resolutions
          capLevelToPlayerSize: true,
          // Add more lenient error recovery
          recoverMediaErrorDuration: 10000,
          // Prefer MP4A audio codec (more compatible)
          preferredCodecs: {
            video: ['avc1', 'hvc1'],
            audio: ['mp4a', 'aac'],
          },
          // Use fetch API for all requests (more reliable than XHR)
          // This allows us to intercept and proxy all requests uniformly
          loader: Hls.DefaultConfig.loader,
        };

        // Determine the actual URL to load
        // If proxy is needed, use the proxied manifest URL
        // The manifest itself will contain rewritten URLs to the proxy
        const manifestUrl = needsProxy ? createProxyUrl(source.url, "manifest") : source.url;

        console.log("[HLS] Loading manifest:", needsProxy ? "(via proxy)" : "(direct)", {
          original: source.url,
          proxied: manifestUrl !== source.url ? manifestUrl : "(same)",
        });

        const hls = new Hls(hlsConfig);

        hlsRef.current = hls;

        // CRITICAL: Attach media BEFORE loading source
        // This is the correct HLS.js initialization order
        hls.attachMedia(video);

        // Wait for media to be attached before loading source
        let mediaAttached = false;
        const onMediaAttached = () => {
          if (!mediaAttached) {
            mediaAttached = true;
            console.log("[HLS] Media attached, loading source:", manifestUrl);
            hls.loadSource(manifestUrl);
            hls.off(Hls.Events.MEDIA_ATTACHED, onMediaAttached);
          }
        };
        hls.on(Hls.Events.MEDIA_ATTACHED, onMediaAttached);

        // If media attach fails, try loading anyway after a short delay
        setTimeout(() => {
          if (hlsRef.current && !hlsRef.current.media && !mediaAttached) {
            console.warn("[HLS] Media attach timeout, forcing source load");
            mediaAttached = true;
            hls.loadSource(manifestUrl);
          }
        }, 1000);

        // Comprehensive HLS event logging for debugging
        hls.on(Hls.Events.MEDIA_ATTACHED, (event, data) => {
          console.log("[HLS] Media attached event fired:", data);
        });

        hls.on(Hls.Events.MANIFEST_LOADING, (event, data) => {
          console.log("[HLS] Manifest loading:", data);
        });

        hls.on(Hls.Events.MANIFEST_LOADED, (event, data) => {
          console.log("[HLS] Manifest loaded:", data);
          console.log("[HLS] Levels available:", data.levels.length);
        });

        hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
          console.log("[HLS] Manifest parsed successfully:", data);
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          setIsLoading(false);
          if (preferences.autoplay) {
            play().catch(() => {});
          }
        });

        hls.on(Hls.Events.LEVEL_LOADING, (event, data) => {
          console.log("[HLS] Level loading:", data);
        });

        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
          console.log("[HLS] Level loaded:", data);
        });

        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log("[HLS] Fragment loading:", data);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log("[HLS] Fragment loaded:", data);
        });

        // Track repeated non-fatal media errors to trigger fallback
        let mediaErrorCount = 0;
        const MAX_MEDIA_ERRORS = 3; // Trigger fallback after 3 media errors
        let lastErrorTime = 0;
        const ERROR_RESET_TIME = 5000; // Reset counter if 5 seconds pass without errors

        hls.on(Hls.Events.ERROR, (event, data) => {
          const now = Date.now();

          console.error("HLS error:", {
            type: data.type,
            details: data.details,
            fatal: data.fatal,
            response: data.response,
            reason: data.reason,
          });

          // Track non-fatal media parsing errors (fragParsingError, etc.)
          if (!data.fatal && data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            // Reset counter if enough time has passed since last error
            if (now - lastErrorTime > ERROR_RESET_TIME) {
              mediaErrorCount = 0;
            }

            mediaErrorCount++;
            lastErrorTime = now;

            console.warn(`Media error count: ${mediaErrorCount}/${MAX_MEDIA_ERRORS}`);

            // If we hit the threshold, trigger fallback to next server
            if (mediaErrorCount >= MAX_MEDIA_ERRORS) {
              console.error("Too many media errors, triggering server fallback");
              onError?.(new Error(`Media parsing failed after ${MAX_MEDIA_ERRORS} attempts. Trying next server...`));
              // Don't try to recover - let the parent component switch servers
              return;
            }
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Attempting to recover from network error...");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Attempting to recover from media error...");
                hls.recoverMediaError();
                break;
              default:
                console.error("Fatal HLS error, cannot recover");
                handleError();
                break;
            }
          }
        });

        return () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          hls.destroy();
        };
      } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
        // Native HLS support (Safari)
        // Use proxied URL to bypass CORS if needed
        const videoUrl = needsProxy ? createProxyUrl(source.url, "manifest") : source.url;
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

        return () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          video.removeEventListener("loadeddata", clearLoading);
          video.removeEventListener("canplay", clearLoading);
          video.removeEventListener("canplaythrough", clearLoading);
          video.removeEventListener("error", handleError);
        };
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

        return () => {
          clearTimeout(loadingTimeout);
          clearTimeout(safetyTimeout);
          video.removeEventListener("loadeddata", clearLoading);
          video.removeEventListener("canplay", clearLoading);
          video.removeEventListener("canplaythrough", clearLoading);
          video.removeEventListener("error", handleError);
        };
      }
    } else {
      // WebTorrent handling (magnet/torrent links)
      import("@/lib/webtorrent").then(({ webTorrentManager }) => {
        webTorrentManager.loadDirectVideo(source.url, video, {
          onReady: () => {
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            setIsLoading(false);
            if (preferences.autoplay) play();
          },
          onError: (err: Error) => {
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            setIsLoading(false);
            onError?.(err);
          },
        });
      });
    }
  }, [source.url, preferences.autoplay]);

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
        // Silently fall back to estimated timestamps
        const video = videoRef.current;
        const estimated = getEstimatedTimestamps(video?.duration);
        setSkipTimestamps(estimated);
      }
    };

    fetchTimestamps();
  }, [malId, animeId, episodeNumber]);

  // ===================================
  // Load Subtitles - CRITICAL FIX
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Disable all existing text tracks first
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = "disabled";
    }

    // Add new subtitle tracks if available
    if (subtitles && subtitles.length > 0) {
      setSubtitleTracks(subtitles);

      // Load subtitles sequentially to avoid race conditions
      const loadSubtitles = async () => {
        let loadedCount = 0;
        let firstTrack: TextTrack | null = null;
        let englishTrack: TextTrack | null = null;

        for (let index = 0; index < subtitles.length; index++) {
          const sub = subtitles[index];

          try {
            // Use proxy API to avoid CORS/403 errors
            const proxyUrl = `/api/proxy-subtitle?url=${encodeURIComponent(sub.url)}`;

            const response = await fetch(proxyUrl);
            if (!response.ok) {
              // Silently skip failed subtitle loads
              continue;
            }

            const vttContent = await response.text();

            // Create a new track for this subtitle
            const track = video.addTextTrack("captions", sub.label, sub.lang || `sub${index}`);

            // Parse VTT content and add cues
            const lines = vttContent.split('\n');
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
                  currentCue.text += ' ' + line;
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
            if (sub.lang === "en" || sub.label.toLowerCase().includes("english")) {
              englishTrack = track;
            }

            loadedCount++;
          } catch (err) {
            // Silently skip failed subtitle loads
          }
        }

        // After all subtitles are loaded, enable the appropriate track
        // Use setTimeout to ensure cues are fully processed
        setTimeout(() => {
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
            setCurrentSubtitle(enabledIndex >= 0 ? enabledIndex : 0);
            toast.success(`Subtitles loaded: ${trackToEnable.label}`, { duration: 2000 });
          }
        }, 100);
      };

      loadSubtitles();
    } else {
      setSubtitleTracks([]);
    }
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

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(video.currentTime - 5);
          toast("-5s", { icon: "⏪", duration: 500 });
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(video.currentTime + 5);
          toast("+5s", { icon: "⏩", duration: 500 });
          break;
        case "j":
          seek(video.currentTime - 10);
          toast("-10s", { icon: "⏪", duration: 500 });
          break;
        case "l":
          seek(video.currentTime + 10);
          toast("+10s", { icon: "⏩", duration: 500 });
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
          toggleMute();
          toast(isMuted ? "Muted" : "Unmuted", { duration: 500 });
          break;
        case "f":
          toggleFullscreen();
          break;
        case "t":
          toggleTheaterMode();
          break;
        case "p":
          togglePip();
          break;
        case "c":
          // Toggle captions
          if (video.textTracks.length > 0) {
            const newState = video.textTracks[0].mode === "showing" ? "hidden" : "showing";
            video.textTracks[0].mode = newState;
            toast(newState ? "Subtitles ON" : "Subtitles OFF", { duration: 500 });
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
          setPlaybackRate(parseInt(e.key) * 0.25);
          toast(`Speed: ${parseInt(e.key) * 0.25}x`, { duration: 500 });
          break;
        case "0":
          setPlaybackRate(1);
          toast("Speed: 1x (Normal)", { duration: 500 });
          break;
        case "n":
          // Next episode
          if (nextEpisodeUrl && preferences.autoNext) {
            goToNextEpisode();
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
  }, [preferences.autoplay, preferences.autoNext, nextEpisodeUrl, isMuted, duration]);

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
        saveWatchProgress(animeId, episodeNumber, video.duration, true);
      }

      // Handle next episode autoplay
      if (onEpisodeEnd) {
        onEpisodeEnd();
      }

      if (nextEpisodeUrl && preferences.autoNext) {
        startAutoplayCountdown();
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0);
        setBufferProgress((buffered / video.duration) * 100);
      }
    };
    const handleWaiting = () => {
      setIsBuffering(true);
      setIsPlaying(false);

      // Clear any existing buffering timeout
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
      }

      // Set a safety timeout to clear buffering state if it gets stuck
      // This can happen if the video source fails after initial load
      bufferingSafetyTimeoutRef.current = setTimeout(() => {
        console.warn("Buffering safety timeout - forcing buffering state clear");
        setIsBuffering(false);
        bufferingSafetyTimeoutRef.current = null;
      }, 30000); // 30 seconds max buffering time
    };
    const handleCanPlay = () => {
      // Clear the buffering safety timeout since we can play now
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
      setIsBuffering(false);
      setIsLoading(false);
    };
    const handleRateChange = () => {
      if (video.playbackRate !== playbackRate) {
        video.playbackRate = playbackRate;
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
    video.addEventListener("ratechange", handleRateChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("ratechange", handleRateChange);
      // Clean up buffering safety timeout
      if (bufferingSafetyTimeoutRef.current) {
        clearTimeout(bufferingSafetyTimeoutRef.current);
        bufferingSafetyTimeoutRef.current = null;
      }
    };
  }, [playbackRate, animeId, episodeNumber, nextEpisodeUrl, preferences.autoNext, onEpisodeEnd]);

  // Auto-skip intro/outro
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleAutoSkip = () => {
      const time = video.currentTime;

      // Show skip intro button during intro
      if (time >= introStart && time <= introEnd && !introSkipped) {
        setShowSkipIntro(true);

        // Auto-skip intro if enabled
        if (preferences.autoSkipIntro && time > introStart + 2) {
          // Don't auto-skip in first 2 seconds of intro (give user time to cancel)
          video.currentTime = introEnd;
          setIntroSkipped(true);
          setShowSkipIntro(false);
        }
      } else {
        setShowSkipIntro(false);
        // Reset intro skip when past intro
        if (time > introEnd + 5) {
          setIntroSkipped(false);
        }
      }

      // Show skip outro button during outro
      if (time >= outroStart && time <= outroEnd && !outroSkipped) {
        setShowSkipOutro(true);

        // Auto-skip outro if enabled
        if (preferences.autoSkipOutro && time > outroStart + 2) {
          video.currentTime = outroEnd;
          setOutroSkipped(true);
          setShowSkipOutro(false);
        }
      } else {
        setShowSkipOutro(false);
        // Reset outro skip when past outro
        if (time > outroEnd + 5) {
          setOutroSkipped(false);
        }
      }
    };

    video.addEventListener("timeupdate", handleAutoSkip);
    return () => video.removeEventListener("timeupdate", handleAutoSkip);
  }, [introStart, introEnd, outroStart, outroEnd, preferences.autoSkipIntro, preferences.autoSkipOutro, introSkipped, outroSkipped]);

  // Apply subtitle styles
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateSubtitleStyles = () => {
      // Create or update style element for ::cue pseudo-element
      let styleEl = document.getElementById("subtitle-custom-style");
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "subtitle-custom-style";
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
  // Helper Functions
  // ===================================

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // ===================================
  // Player Controls
  // ===================================

  const play = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch {
      // Auto-play was blocked
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
    setIsMuted((m) => !m);
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      // Exit fullscreen - try all vendor methods
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).mozCancelFullScreen) {
        (document as any).mozCancelFullScreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    } else {
      // Enter fullscreen - try all vendor methods
      if (container.requestFullscreen) {
        container.requestFullscreen();
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else if ((container as any).mozRequestFullScreen) {
        (container as any).mozRequestFullScreen();
      } else if ((container as any).msRequestFullscreen) {
        (container as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    }
  };

  const toggleTheaterMode = () => {
    setIsTheaterMode((t) => !t);
  };

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
      video.currentTime = Math.max(0, Math.min(duration, time));
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
    toast(`Quality changed to ${qualityLabel}`, { duration: 2000 });
  };

  const changeSpeed = (speed: number) => {
    setPlaybackRate(speed);
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
      window.location.href = nextEpisodeUrl;
    }
  };

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

  // ===================================
  // Fullscreen Change Handler
  // ===================================

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ===================================
  // Progress Click
  // ===================================

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  };

  // ===================================
  // Render
  // ===================================

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative bg-black rounded-xl overflow-hidden group w-full",
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
      />

      {/* Loading/Buffering Overlay */}
      {(isLoading || isBuffering) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fadeIn z-30">
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
                {isBuffering ? 'Buffering...' : source.url.includes('.m3u8') ? 'Loading stream...' : 'Loading video...'}
              </p>
              {/* Animated dots */}
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center pointer-events-auto hover:bg-white/30 transition-colors"
            onClick={togglePlay}
            aria-label="Play"
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
              if (e.key === 'ArrowLeft') {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = Math.max(0, video.currentTime - 5);
                  e.preventDefault();
                }
              } else if (e.key === 'ArrowRight') {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = Math.min(duration || 0, video.currentTime + 5);
                  e.preventDefault();
                }
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
  );
}
