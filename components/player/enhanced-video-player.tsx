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
  Upload,
  SkipBack,
  SkipForward,
  RotateCw,
  Monitor,
  ChevronDown,
  ChevronUp,
  FastForward,
  Pipette,
  X,
  Globe,
} from "lucide-react";
import { cn, formatTime } from "@/lib/utils";
import { usePreferences } from "@/store";
import { toast } from "react-hot-toast";
import { ServerSelector, LanguageSelector } from "@/components/player/server-selector";
import { WatchPartyControls } from "@/components/player/watch-party";
import { SimpleThumbnailPreview } from "@/components/player/episode-thumbnails";
import { DownloadButton } from "@/components/player/download-button";

// ===================================
// Types
// ===================================

interface VideoPlayerProps {
  source: {
    type: "magnet" | "torrent" | "direct";
    url: string;
    qualities?: VideoQuality[];
  };
  poster?: string;
  animeTitle?: string;
  className?: string;
  onEnd?: () => void;
  onError?: (error: Error) => void;
  onEpisodeEnd?: () => void;
  animeId?: number;
  episodeNumber?: number;
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
  nextEpisodeUrl,
  allServers = [],
  allLanguages = [
    { id: "sub", label: "Subtitles", type: "sub" },
    { id: "dub", label: "Dubbed", type: "dub" },
  ],
  onServerChange,
  onLanguageChange,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDropdownRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [bufferProgress, setBufferProgress] = useState(0);

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
  const [showQualitySelector, setShowQualitySelector] = useState(false);
  const [showSpeedSelector, setShowSpeedSelector] = useState(false);
  const [showSubtitleSettings, setShowSubtitleSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentQuality, setCurrentQuality] = useState<string>("auto");
  const [settingsPosition, setSettingsPosition] = useState<'top' | 'bottom'>('top');

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

  // User preferences
  const { preferences, updatePreferences } = usePreferences();

  // Intro/outro timestamps (in seconds) - can be customized per anime
  const introStart = 85;
  const introEnd = 179;
  const outroStart = 1320;
  const outroEnd = 1410;

  // ===================================
  // Video Loading
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);

    if (source.type === "direct") {
      video.src = sources[0].url;

      const handleLoad = () => {
        setIsLoading(false);
        // Auto-play based on preferences
        if (preferences.autoplay) {
          play();
        }
      };

      const handleError = () => {
        setIsLoading(false);
        onError?.(new Error("Failed to load video"));
      };

      video.addEventListener("loadeddata", handleLoad, { once: true });
      video.addEventListener("error", handleError, { once: true });

      return () => {
        video.removeEventListener("loadeddata", handleLoad);
        video.removeEventListener("error", handleError);
      };
    } else {
      // WebTorrent handling (simplified for now)
      import("@/lib/webtorrent").then(({ webTorrentManager }) => {
        webTorrentManager.loadDirectVideo(source.url, video, {
          onReady: () => {
            setIsLoading(false);
            if (preferences.autoplay) play();
          },
          onError: (err: Error) => {
            setIsLoading(false);
            onError?.(err);
          },
        });
      });
    }
  }, [source, sources]);

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
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(video.currentTime + 5);
          break;
        case "j":
          seek(video.currentTime - 10);
          break;
        case "l":
          seek(video.currentTime + 10);
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
            video.textTracks[0].mode = video.textTracks[0].mode === "showing" ? "hidden" : "showing";
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
          break;
        case "n":
          // Next episode
          if (nextEpisodeUrl && preferences.autoNext) {
            goToNextEpisode();
          }
          break;
        case "Escape":
          // Exit fullscreen
          if (document.fullscreenElement) {
            document.exitFullscreen();
          }
          setShowSettings(false);
          setShowQualitySelector(false);
          setShowSpeedSelector(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [preferences.autoplay, preferences.autoNext]);

  // ===================================
  // Video Event Handlers
  // ===================================

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);

      // Save watch progress
      if (animeId && episodeNumber) {
        saveWatchProgress(animeId, episodeNumber, video.duration);
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
    video.addEventListener("ratechange", handleRateChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("progress", handleProgress);
      video.removeEventListener("ratechange", handleRateChange);
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

  // Save watch progress periodically
  useEffect(() => {
    if (!isPlaying || !animeId || !episodeNumber) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video) {
        saveWatchProgress(animeId, episodeNumber, video.currentTime);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isPlaying, animeId, episodeNumber]);

  // Apply playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // ===================================
  // Helper Functions
  // ===================================

  const saveWatchProgress = (mediaId: number, epNumber: number, progress: number) => {
    try {
      const key = `watch_progress_${mediaId}`;
      const data = JSON.parse(localStorage.getItem(key) || "{}");
      data[epNumber] = {
        progress,
        timestamp: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(data));

      // Also update global watch history
      const historyKey = "yggdrasil_watch_history";
      const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
      const existingIndex = history.findIndex((h: any) => h.mediaId === mediaId);
      const entry = {
        mediaId,
        episodeNumber: epNumber,
        progress,
        timestamp: Date.now(),
      };

      if (existingIndex >= 0) {
        history[existingIndex] = entry;
      } else {
        history.unshift(entry);
      }

      // Keep only last 100 entries
      localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 100)));
    } catch (e) {
      console.error("Failed to save watch progress:", e);
    }
  };

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
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
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
    setShowQualitySelector(false);
    toast(`Quality changed to ${qualityLabel}`, { duration: 2000 });
  };

  const changeSpeed = (speed: number) => {
    setPlaybackRate(speed);
    setShowSpeedSelector(false);
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
        "relative bg-black rounded-xl overflow-hidden group",
        isTheaterMode ? "fixed inset-0 z-50 rounded-none" : "aspect-video",
        className
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        poster={poster}
        onClick={togglePlay}
        playsInline
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          onClick={togglePlay}
        >
          <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-12 h-12 text-white ml-1" fill="currentColor" />
          </div>
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
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
        onMouseMove={resetControlsTimeout}
      >
        {/* Progress Bar with Thumbnail Preview */}
        <div className="relative mb-4">
          <div
            className="relative h-1.5 bg-white/20 rounded-full cursor-pointer group/progress hover:h-2 transition-all"
            onClick={handleProgressClick}
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
        <div className="flex items-center justify-between gap-4">
          {/* Left Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            {/* Skip Buttons */}
            {showSkipIntro && (
              <button
                onClick={skipIntro}
                className="px-3 py-2 bg-primary/80 hover:bg-primary text-white rounded-full transition-colors text-sm font-medium flex items-center gap-1"
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
                className="px-3 py-2 bg-primary/80 hover:bg-primary text-white rounded-full transition-colors text-sm font-medium flex items-center gap-1"
                aria-label="Skip outro"
                title="Skip Outro"
              >
                Skip Outro
                <SkipForward className="w-4 h-4" />
              </button>
            )}

            {/* Volume */}
            <div className="hidden sm:flex items-center gap-1 group/volume">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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
              />
            </div>

            {/* Time Display */}
            <div className="text-sm font-medium">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1 sm:gap-2">
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

            {/* Watch Party */}
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

            {/* Download Button */}
            {source.type === "direct" && animeId && episodeNumber && animeTitle && (
              <DownloadButton
                animeId={animeId}
                animeTitle={animeTitle}
                episodeNumber={episodeNumber}
                videoUrl={source.url}
                thumbnailUrl={poster}
              />
            )}

            {/* Settings */}
            <div className="relative">
              <button
                ref={settingsButtonRef}
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowQualitySelector(false);
                  setShowSpeedSelector(false);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Dropdown */}
              {showSettings && (
                <div
                  ref={settingsDropdownRef}
                  className={cn(
                    "settings-dropdown absolute bg-[#1a1a1a] border border-white/10 rounded-lg overflow-hidden min-w-[200px] max-h-[60vh] overflow-y-auto z-[9999] shadow-xl",
                    "bottom-full right-0 mb-2"
                  )}
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

            {/* Theater Mode */}
            <button
              onClick={toggleTheaterMode}
              className={cn(
                "p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block",
                isTheaterMode && "bg-white/10"
              )}
              aria-label="Theater mode"
            >
              <Monitor className="w-5 h-5" />
            </button>

            {/* PIP */}
            <button
              onClick={togglePip}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label="Picture-in-Picture"
            >
              <Pipette className="w-5 h-5" />
            </button>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Theater Mode Exit Button */}
      {isTheaterMode && (
        <button
          onClick={toggleTheaterMode}
          className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-lg transition-colors z-50"
          aria-label="Exit theater mode"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
