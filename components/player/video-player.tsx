/**
 * Video Player Component
 * Hybrid WebTorrent + Direct video player with anime aesthetic
 * Client-side only component
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings, Download, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

// ===================================
// Types
// ===================================

interface VideoPlayerProps {
  source: {
    type: "magnet" | "torrent" | "direct";
    url: string;
  };
  poster?: string;
  className?: string;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// ===================================
// Component
// ===================================

export function VideoPlayer({ source, poster, className, onEnd, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [bufferProgress, setBufferProgress] = useState(0);

  // WebTorrent stats (only for non-direct sources)
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [peers, setPeers] = useState(0);
  const [torrentProgress, setTorrentProgress] = useState(0);
  const [webTorrentReady, setWebTorrentReady] = useState(false);

  // Load video source
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);

    if (source.type === "direct") {
      // Direct video URL - simple load
      video.src = source.url;

      const handleLoad = () => setIsLoading(false);
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
      // WebTorrent - load dynamically
      const loadWebTorrent = async () => {
        try {
          const { webTorrentManager } = await import("@/lib/webtorrent");
          await webTorrentManager.init();

          await webTorrentManager.loadTorrent(source, video, {
            onReady: () => {
              setIsLoading(false);
              setWebTorrentReady(true);
            },
            onError: (err: Error) => {
              setIsLoading(false);
              onError?.(err);
            },
          });
        } catch (err) {
          setIsLoading(false);
          onError?.(err as Error);
        }
      };

      loadWebTorrent();

      // Set up stats interval for WebTorrent
      const statsInterval = setInterval(async () => {
        if (webTorrentReady) {
          try {
            const { webTorrentManager } = await import("@/lib/webtorrent");
            const state = webTorrentManager.getState();
            setDownloadSpeed(state.downloadSpeed);
            setUploadSpeed(state.uploadSpeed);
            setPeers(state.peers);
            setTorrentProgress(state.progress);
          } catch {
            // Ignore errors
          }
        }
      }, 1000);

      return () => clearInterval(statsInterval);
    }
  }, [source, webTorrentReady]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          seek(video.currentTime - 10);
          break;
        case "ArrowRight":
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
        case "j":
          seek(video.currentTime - 5);
          break;
        case "l":
          seek(video.currentTime + 5);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onEnd?.();
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(0);
        setBufferProgress((buffered / video.duration) * 100);
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("durationchange", handleDurationChange);
    video.addEventListener("ended", handleEnded);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("progress", handleProgress);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("durationchange", handleDurationChange);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("progress", handleProgress);
    };
  }, [onEnd]);

  // Volume
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.volume = volume;
      video.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Controls auto-hide
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const resetTimeout = () => {
      setShowControls(true);
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    if (isPlaying) {
      resetTimeout();
    }

    containerRef.current?.addEventListener("mousemove", resetTimeout);
    containerRef.current?.addEventListener("click", resetTimeout);

    return () => {
      clearTimeout(timeout);
      containerRef.current?.removeEventListener("mousemove", resetTimeout);
      containerRef.current?.removeEventListener("click", resetTimeout);
    };
  }, [isPlaying]);

  // Handlers
  const togglePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      try {
        await video.play();
      } catch {
        // Ignore autoplay errors
      }
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
      setIsFullscreen(false);
    } else {
      container.requestFullscreen();
      setIsFullscreen(true);
    }
  }, []);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = Math.max(0, Math.min(duration, time));
    }
  }, [duration]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  }, [seek]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
    setIsMuted(false);
  }, []);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seek(pos * duration);
  }, [duration]);

  // Format helper
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative aspect-video bg-black rounded-xl overflow-hidden group",
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {/* Play/Pause Overlay */}
      {!isPlaying && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="w-20 h-20 rounded-full bg-primary/90 flex items-center justify-center">
            <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress Bar */}
        <div
          className="relative h-1.5 bg-white/20 rounded-full mb-4 cursor-pointer group/progress"
          onClick={handleProgressClick}
        >
          {/* Buffer Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-white/30 rounded-full"
            style={{ width: `${bufferProgress}%` }}
          />

          {/* Play Progress */}
          <div
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all"
            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
          />

          {/* Torrent Progress (for WebTorrent) */}
          {source.type !== "direct" && torrentProgress < 1 && (
            <div
              className="absolute top-0 left-0 h-full bg-secondary/50 rounded-full"
              style={{ width: `${torrentProgress * 100}%` }}
            />
          )}

          {/* Hover Indicator */}
          <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left Controls */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/volume">
              <button
                onClick={toggleMute}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
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
          <div className="flex items-center gap-2">
            {/* P2P Stats (for WebTorrent) */}
            {source.type !== "direct" && (
              <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1" title="Download Speed">
                  <Download className="w-3 h-3" />
                  <span>{formatBytes(downloadSpeed)}/s</span>
                </div>
                <div className="flex items-center gap-1" title="Upload Speed">
                  <Upload className="w-3 h-3" />
                  <span>{formatBytes(uploadSpeed)}/s</span>
                </div>
                <div className="flex items-center gap-1" title="Connected Peers">
                  <span>{peers} peers</span>
                </div>
                {torrentProgress < 1 && (
                  <div className="flex items-center gap-1" title="Download Progress">
                    <span>{Math.round(torrentProgress * 100)}%</span>
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
