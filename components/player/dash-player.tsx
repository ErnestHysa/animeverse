/**
 * DASH Player Component
 *
 * Phase 10: DASH Streaming Support
 * Provides alternative to HLS with better adaptive bitrate
 *
 * Features:
 * - Dash.js integration
 * - Adaptive bitrate streaming
 * - Multiple quality profiles
 * - Smooth quality switching
 * - Subtitle support
 * - Works alongside existing HLS player
 */

"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { createScopedLogger } from "@/lib/logger";

const logger = createScopedLogger("dash-player");

// ===================================
// Types
// ===================================

export interface DASHQuality {
  bitrate: number;
  width: number;
  height: number;
  label: string;
}

export interface DASHPlayerProps {
  manifestUrl: string;
  autoPlay?: boolean;
  initialQuality?: string;
  className?: string;
  onError?: (error: Error) => void;
  onQualityChange?: (quality: DASHQuality) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onProgress?: (progress: number) => void;
  subtitles?: Array<{
    language: string;
    label: string;
    url: string;
  }>;
}

export interface DASHPlayerRef {
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setQuality: (quality: DASHQuality) => void;
  getQualities: () => DASHQuality[];
  getCurrentQuality: () => DASHQuality | null;
  getCurrentTime: () => number;
  getDuration: () => number;
  destroy: () => void;
}

// ===================================
// Component
// ===================================

export const DASHPlayer = React.forwardRef<DASHPlayerRef, DASHPlayerProps>(
  ({ manifestUrl, autoPlay = false, initialQuality, className, onError, onQualityChange, onTimeUpdate, onProgress, subtitles }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const dashInstanceRef = useRef<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [qualities, setQualities] = useState<DASHQuality[]>([]);
    const [currentQuality, setCurrentQuality] = useState<DASHQuality | null>(null);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playing, setPlaying] = useState(false);

    /**
     * Initialize DASH player
     */
    const initializeDASH = useCallback(async () => {
      if (!videoRef.current || !manifestUrl) return;

      try {
        setLoading(true);
        setError(null);

        // Dynamically import dash.js
        const dashjs = await import("dashjs");
        const Dash = dashjs;

        // Create DASH instance
        const dashInstance = Dash.MediaPlayer().create();

        // Configure DASH player
        dashInstance.updateSettings({
          streaming: {
            abr: {
              autoSwitchBitrate: { video: true },
              initialBitrate: { video: initialQuality ? parseInt(initialQuality) : undefined },
              limitBitrateByPortal: true,
            },
            buffer: {
              fastSwitchEnabled: true,
              bufferPruningInterval: 10,
              bufferToKeep: 30,
              bufferTimeAtTopQuality: 30,
              bufferTimeAtTopQualityLongForm: 60,
            },
            delay: {
              liveDelayFragmentCount: 4,
            },
          },
          debug: {
            logLevel: dashjs.Debug.LOG_LEVEL_NONE,
          },
        } as any);

        // Initialize with video element
        (dashInstance as any).initialize(videoRef.current, false);

        // Attach event listeners
        dashInstance.on((dashjs.MediaPlayer.events as any).STREAM_INITIALIZED, () => {
          logger.info("Stream initialized");
        });

        dashInstance.on((dashjs.MediaPlayer.events as any).QUALITY_CHANGE_RENDERED, (e: any) => {
          if (e.mediaType === "video") {
            const newQuality = {
              bitrate: e.newQuality.bitrate,
              width: e.newQuality.width,
              height: e.newQuality.height,
              label: `${e.newQuality.height}p`,
            };
            setCurrentQuality(newQuality);
            onQualityChange?.(newQuality);
          }
        });

        dashInstance.on((dashjs.MediaPlayer.events as any).BUFFER_LOADED, () => {
          setLoading(false);
          logger.info("Buffer loaded");
        });

        dashInstance.on((dashjs.MediaPlayer.events as any).ERROR, (e: any) => {
          logger.error("DASH error:", e);
          const errorMsg = `DASH error: ${e.error || "Unknown error"}`;
          setError(errorMsg);
          setLoading(false);
          onError?.(new Error(errorMsg));
          toast.error(errorMsg);
        });

        // Load manifest
        await dashInstance.attachSource(manifestUrl);

        // Get available qualities
        const qualities = getQualitiesFromDASH(dashInstance);
        setQualities(qualities);

        dashInstanceRef.current = dashInstance;

        // Auto play if requested
        if (autoPlay) {
          try {
            await videoRef.current.play();
            setPlaying(true);
          } catch (err) {
            console.warn("[DASHPlayer] Auto-play prevented:", err);
          }
        }

        logger.info("Initialized successfully");
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error("Initialization failed:", error);
        setError(error.message);
        setLoading(false);
        onError?.(error);
        toast.error(`Failed to load DASH stream: ${error.message}`);
      }
    }, [manifestUrl, autoPlay, initialQuality, onError, onQualityChange]);

    /**
     * Get available qualities from DASH instance
     */
    const getQualitiesFromDASH = (dashInstance: any): DASHQuality[] => {
      try {
        const videoQualities = dashInstance.getBitrateInfoListFor("video") || [];
        return videoQualities
          .filter((q: any) => q.height > 0)
          .map((q: any) => ({
            bitrate: q.bitrate,
            width: q.width,
            height: q.height,
            label: `${q.height}p`,
          }))
          .sort((a: DASHQuality, b: DASHQuality) => b.bitrate - a.bitrate);
      } catch (err) {
        logger.error("Failed to get qualities:", err);
        return [];
      }
    };

    /**
     * Handle time update
     */
    const handleTimeUpdate = useCallback(() => {
      if (!videoRef.current) return;

      const time = videoRef.current.currentTime;
      const dur = videoRef.current.duration;

      setCurrentTime(time);
      setDuration(dur);

      onTimeUpdate?.(time);

      if (dur > 0) {
        onProgress?.((time / dur) * 100);
      }
    }, [onTimeUpdate, onProgress]);

    /**
     * Handle play/pause
     */
    const handlePlay = useCallback(() => {
      setPlaying(true);
    }, []);

    const handlePause = useCallback(() => {
      setPlaying(false);
    }, []);

    /**
     * Handle waiting (buffering)
     */
    const handleWaiting = useCallback(() => {
      setLoading(true);
    }, []);

    /**
     * Handle playing (buffering complete)
     */
    const handlePlaying = useCallback(() => {
      setLoading(false);
    }, []);

    /**
     * Expose player controls via ref
     */
    React.useImperativeHandle(ref, () => ({
      play: () => {
        videoRef.current?.play();
      },
      pause: () => {
        videoRef.current?.pause();
      },
      seek: (time: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = time;
        }
      },
      setQuality: (quality: DASHQuality) => {
        if (dashInstanceRef.current) {
          const qualities = dashInstanceRef.current.getBitrateInfoListFor("video") || [];
          const matchingQuality = qualities.find((q: any) => q.bitrate === quality.bitrate);
          if (matchingQuality) {
            dashInstanceRef.current.setQualityFor("video", matchingQuality.qualityIndex, true);
          }
        }
      },
      getQualities: () => {
        if (dashInstanceRef.current) {
          return getQualitiesFromDASH(dashInstanceRef.current);
        }
        return [];
      },
      getCurrentQuality: () => {
        return currentQuality;
      },
      getCurrentTime: () => {
        return videoRef.current?.currentTime || 0;
      },
      getDuration: () => {
        return videoRef.current?.duration || 0;
      },
      destroy: () => {
        if (dashInstanceRef.current) {
          dashInstanceRef.current.reset();
          dashInstanceRef.current = null;
        }
      },
    }), [currentQuality]);

    /**
     * Initialize on mount
     */
    useEffect(() => {
      initializeDASH();

      return () => {
        if (dashInstanceRef.current) {
          dashInstanceRef.current.reset();
          dashInstanceRef.current = null;
        }
      };
    }, [initializeDASH]);

    /**
     * Add external subtitles if provided
     */
    useEffect(() => {
      if (!videoRef.current || !subtitles || subtitles.length === 0) return;

      // Clear existing text tracks
      while (videoRef.current.textTracks.length > 0) {
        videoRef.current.textTracks[0].mode = "disabled";
      }

      // Add new text tracks
      subtitles.forEach((sub, index) => {
        const track = document.createElement("track");
        track.kind = "subtitles";
        track.label = sub.label;
        track.srclang = sub.language;
        track.src = sub.url;
        track.default = index === 0;
        videoRef.current?.appendChild(track);
      });
    }, [subtitles]);

    return (
      <div className={`relative ${className}`}>
        <video
          ref={videoRef}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onPlay={handlePlay}
          onPause={handlePause}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
        />

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <p className="text-sm">Loading stream...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <p className="text-red-500">Error: {error}</p>
            </div>
          </div>
        )}

        {qualities.length > 0 && currentQuality && (
          <div className="absolute bottom-4 right-4 bg-black/70 text-white px-3 py-1 rounded text-sm">
            {currentQuality.label}
          </div>
        )}
      </div>
    );
  }
);

DASHPlayer.displayName = "DASHPlayer";

// ===================================
// Export utility functions
// ===================================

export function isDASHSupported(): boolean {
  if (typeof window === "undefined") return false;
  const video = document.createElement("video");
  return video.canPlayType("application/dash+xml") !== "";
}

export function getDASHQualities(manifestUrl: string): Promise<DASHQuality[]> {
  return new Promise((resolve, reject) => {
    import("dashjs")
      .then((dashjs) => {
        const dashInstance: any = dashjs.MediaPlayer().create();
        const videoElement = document.createElement("video");

        dashInstance.initialize(videoElement, false);
        (dashInstance as any).attachSource(manifestUrl).then(() => {
          const qualities = (dashInstance as any).getBitrateInfoListFor("video") || [];
          const result = qualities
            .filter((q: any) => q.height > 0)
            .map((q: any) => ({
              bitrate: q.bitrate,
              width: q.width,
              height: q.height,
              label: `${q.height}p`,
            }))
            .sort((a: DASHQuality, b: DASHQuality) => b.bitrate - a.bitrate);

          dashInstance.reset();
          resolve(result);
        }).catch(reject);
      })
      .catch(reject);
  });
}
