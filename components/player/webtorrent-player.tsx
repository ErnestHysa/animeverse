/**
 * WebTorrent Player Component
 * Streams video from torrent magnet links using WebTorrent
 *
 * Phase 3: WebTorrent Player Integration
 * - Initialize WebTorrent client
 * - Load torrent from magnet link
 * - Stream video to <video> element
 * - Show download progress/seed count
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { formatBytes } from "@/lib/downloads";
import { Play, Pause, Download, Users, AlertCircle, CheckCircle } from "lucide-react";

// WebTorrent is only available in the browser
declare const WebTorrent: any;

// Static style constant to avoid recreating object on every render
const HIDDEN_STYLE = { display: "none" };

interface TorrentProgress {
  progress: number; // 0-1
  downloadSpeed: number; // bytes/s
  uploadSpeed: number; // bytes/s
  numPeers: number;
  timeRemaining: number; // seconds
  downloaded: number; // bytes
  uploaded: number; // bytes
}

interface WebTorrentPlayerProps {
  magnet: string;
  infoHash: string;
  title: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function WebTorrentPlayer({
  magnet,
  infoHash,
  title,
  onReady,
  onError,
  className = "",
}: WebTorrentPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<any>(null);
  const torrentRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Use ref for onError to avoid client recreation on every parent re-render
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Use ref for onReady to avoid infinite useEffect recreation
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const [isClientReady, setIsClientReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<TorrentProgress>({
    progress: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
    numPeers: 0,
    timeRemaining: 0,
    downloaded: 0,
    uploaded: 0,
  });

  // Format seconds to human readable
  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds === 0) return "Unknown";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }, []);

  // Initialize WebTorrent client
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if WebTorrent is available
    if (typeof WebTorrent === "undefined") {
      const errorMsg = "WebTorrent is not loaded. Please ensure webtorrent library is available.";
      setError(errorMsg);
      onErrorRef.current?.(new Error(errorMsg));
      toast.error(errorMsg);
      return;
    }

    try {
      // Create WebTorrent client
      const client = new WebTorrent({
        tracker: {
          rtcConfig: {
            iceServers: [
              { urls: "stun:stun.l.google.com:19302" },
              { urls: "stun:global.stun.twilio.com:3478" },
            ],
          },
        },
      });

      clientRef.current = client;
      setIsClientReady(true);

      console.log("[WebTorrent] Client initialized");

      return () => {
        // Cleanup on unmount
        if (torrentRef.current) {
          client.remove(torrentRef.current.infoHash, () => {
            console.log("[WebTorrent] Torrent removed");
          });
        }
        client.destroy(() => {
          console.log("[WebTorrent] Client destroyed");
        });
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to initialize WebTorrent";
      setError(errorMsg);
      onErrorRef.current?.(new Error(errorMsg));
      toast.error(`WebTorrent Error: ${errorMsg}`);
    }
  }, []);

  // Load torrent from magnet link
  useEffect(() => {
    if (!isClientReady || !clientRef.current || !magnet) return;

    console.log("[WebTorrent] Loading torrent:", infoHash);

    // Add timeout for torrent loading
    const loadTimeout = setTimeout(() => {
      if (isLoadingRef.current) {
        const timeoutMsg = "Torrent loading timeout. No seeds found.";
        setError(timeoutMsg);
        setIsLoading(false);
        onErrorRef.current?.(new Error(timeoutMsg));
        toast.error(timeoutMsg);
      }
    }, 30000); // 30 second timeout

    clientRef.current.add(magnet, (torrent: any) => {
      clearTimeout(loadTimeout);
      torrentRef.current = torrent;

      console.log("[WebTorrent] Torrent added:", torrent.infoHash);

      // Find video file in torrent
      const videoFile = torrent.files.find((file: any) => {
        const name = file.name.toLowerCase();
        return (
          name.endsWith(".mp4") ||
          name.endsWith(".mkv") ||
          name.endsWith(".avi") ||
          name.endsWith(".webm") ||
          name.endsWith(".mov")
        );
      });

      if (!videoFile) {
        const errorMsg = "No video file found in torrent";
        setError(errorMsg);
        setIsLoading(false);
        onErrorRef.current?.(new Error(errorMsg));
        toast.error(errorMsg);
        return;
      }

      console.log("[WebTorrent] Video file found:", videoFile.name);

      // Stream to video element via dedicated container
      videoFile.appendTo(containerRef.current, (err: Error) => {
        if (err) {
          setError(err.message);
          setIsLoading(false);
          onErrorRef.current?.(err);
          toast.error(`Streaming Error: ${err.message}`);
          return;
        }

        // Get the video element created by WebTorrent (scoped to container)
        const videoElement = containerRef.current?.querySelector("video");
        if (videoElement && videoRef.current) {
          // Replace the WebTorrent video with our controlled video element
          videoRef.current.src = videoElement.src;
          videoElement.remove();

          setIsLoading(false);
          onReadyRef.current?.();
          toast.success("Torrent loaded successfully!");
        }
      });

      // Update progress (throttled to avoid excessive re-renders)
      let lastProgressUpdate = 0;
      const PROGRESS_THROTTLE_MS = 500;
      torrent.on("download", () => {
        const now = Date.now();
        if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS) {
          lastProgressUpdate = now;
          setProgress({
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            numPeers: torrent.numPeers,
            timeRemaining: torrent.timeRemaining,
            downloaded: torrent.downloaded,
            uploaded: torrent.uploaded,
          });
        }
      });

      torrent.on("upload", () => {
        const now = Date.now();
        if (now - lastProgressUpdate >= PROGRESS_THROTTLE_MS) {
          lastProgressUpdate = now;
          setProgress({
            progress: torrent.progress,
            downloadSpeed: torrent.downloadSpeed,
            uploadSpeed: torrent.uploadSpeed,
            numPeers: torrent.numPeers,
            timeRemaining: torrent.timeRemaining,
            downloaded: torrent.downloaded,
            uploaded: torrent.uploaded,
          });
        }
      });

      torrent.on("done", () => {
        console.log("[WebTorrent] Download complete");
        toast.success("Download complete!");
      });

      torrent.on("error", (err: Error) => {
        console.error("[WebTorrent] Torrent error:", err);
        setError(err.message);
        setIsLoading(false);
        onErrorRef.current?.(err);
        toast.error(`Torrent Error: ${err.message}`);
      });
    });

    return () => {
      clearTimeout(loadTimeout);
      if (torrentRef.current) {
        torrentRef.current.removeAllListeners();
      }
    };
  }, [isClientReady, magnet, infoHash]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      toast.success("Episode finished!");
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Calculate progress percentage
  const progressPercent = Math.round(progress.progress * 100);

  return (
    <div className={`webtorrent-player relative ${className}`}>
      {/* Hidden container for WebTorrent video injection */}
      <div ref={containerRef} style={HIDDEN_STYLE} />

      {/* Video Element */}
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        controlsList="nodownload"
        playsInline
      />

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4" />
            <p className="text-lg font-semibold mb-2">Loading Torrent...</p>
            <p className="text-sm text-gray-400 mb-4">{title}</p>
            {progress.progress > 0 && (
              <div className="w-64 mx-auto">
                <div className="bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">{progressPercent}% downloaded</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-20">
          <div className="text-center text-white max-w-md px-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Torrent Error</h3>
            <p className="text-gray-400 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              The torrent may not have enough seeds. Please try another quality or source.
            </p>
          </div>
        </div>
      )}

      {/* Stats Overlay */}
      {!isLoading && !error && (
        <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-sm max-w-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-400" />
              <span>↓ {formatBytes(progress.downloadSpeed)}/s</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-green-400" />
              <span>{progress.numPeers} peers</span>
            </div>
            {progress.timeRemaining > 0 && progress.timeRemaining !== Infinity && (
              <div className="text-xs text-gray-400">
                ETA: {formatTime(progress.timeRemaining)}
              </div>
            )}
            <div className="text-xs text-gray-400">
              Downloaded: {formatBytes(progress.downloaded)}
            </div>
          </div>
        </div>
      )}

      {/* Ready Indicator */}
      {!isLoading && !error && progress.progress >= 1 && (
        <div className="absolute top-4 right-4 bg-green-500/90 backdrop-blur-sm rounded-full p-2">
          <CheckCircle className="h-5 w-5 text-white" />
        </div>
      )}
    </div>
  );
}

// Helper function to check if WebTorrent is available
export function isWebTorrentAvailable(): boolean {
  return typeof window !== "undefined" && typeof (window as any).WebTorrent !== "undefined";
}

// Helper to load WebTorrent dynamically
export function loadWebTorrent(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (isWebTorrentAvailable()) {
      resolve();
      return;
    }

    // Dynamic import for WebTorrent
    import("webtorrent")
      .then(() => resolve())
      .catch(reject);
  });
}
