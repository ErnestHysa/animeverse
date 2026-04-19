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

    // Store event handler references so they can be removed on re-init
    const eventHandlersRef = useRef<Array<{ event: string; handler: (e: any) => void }>>([]);
    const initGenerationRef = useRef(0);

    // Use refs for callbacks to avoid re-init loop from dep array changes
    const onErrorRef = useRef(onError);
    onErrorRef.current = onError;
    const onQualityChangeRef = useRef(onQualityChange);
    onQualityChangeRef.current = onQualityChange;

    /**
     * Initialize DASH player
     */
    const initializeDASH = useCallback(async () => {
      if (!videoRef.current || !manifestUrl) return;

      const generation = ++initGenerationRef.current;

      try {
        setLoading(true);
        setError(null);

        // Remove previous event listeners if re-initializing
        if (dashInstanceRef.current && eventHandlersRef.current.length > 0) {
          for (const { event, handler } of eventHandlersRef.current) {
            dashInstanceRef.current.off(event, handler);
          }
          eventHandlersRef.current = [];
          dashInstanceRef.current.reset();
        }

        // Dynamically import dash.js
        const dashjs = await import("dashjs");

        // Guard: if a newer init started while we awaited, bail out
        if (generation !== initGenerationRef.current) return;

        const Dash = dashjs;

        // Create DASH instance
        const dashInstance = Dash.MediaPlayer().create();

        // Configure DASH player
        dashInstance.updateSettings({
          streaming: {
            abr: {
              autoSwitchBitrate: { video: true },
              initialBitrate: { video: (() => {
                const parsedQuality = parseInt(initialQuality || '');
                return !isNaN(parsedQuality) && parsedQuality > 0 ? parsedQuality : undefined;
              })() },
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

        // Define named event handlers so they can be removed later
        const streamInitializedHandler = () => {
          logger.info("Stream initialized");
        };
        const qualityChangeHandler = (e: any) => {
          if (e.mediaType === "video") {
            const newQuality = {
              bitrate: e.newQuality.bitrate,
              width: e.newQuality.width,
              height: e.newQuality.height,
              label: `${e.newQuality.height}p`,
            };
            setCurrentQuality(newQuality);
            onQualityChangeRef.current?.(newQuality);
          }
        };
        const bufferLoadedHandler = () => {
          setLoading(false);
          logger.info("Buffer loaded");
        };
        const errorHandler = (e: any) => {
          logger.error("DASH error:", e);
          const errorMsg = `DASH error: ${e.error || "Unknown error"}`;
          setError(errorMsg);
          setLoading(false);
          onErrorRef.current?.(new Error(errorMsg));
          toast.error(errorMsg);
        };

        // Store references for cleanup
        const events = Dash.MediaPlayer.events as any;
        const handlers = [
          { event: events.STREAM_INITIALIZED, handler: streamInitializedHandler },
          { event: events.QUALITY_CHANGE_RENDERED, handler: qualityChangeHandler },
          { event: events.BUFFER_LOADED, handler: bufferLoadedHandler },
          { event: events.ERROR, handler: errorHandler },
        ];
        eventHandlersRef.current = handlers;

        // Attach event listeners
        dashInstance.on(events.STREAM_INITIALIZED, streamInitializedHandler);
        dashInstance.on(events.QUALITY_CHANGE_RENDERED, qualityChangeHandler);
        dashInstance.on(events.BUFFER_LOADED, bufferLoadedHandler);
        dashInstance.on(events.ERROR, errorHandler);

        // Load manifest
        await dashInstance.attachSource(manifestUrl);

        // Guard: bail out if a newer init started while attaching source
        if (generation !== initGenerationRef.current) {
          dashInstance.reset();
          return;
        }

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
        onErrorRef.current?.(error);
        toast.error(`Failed to load DASH stream: ${error.message}`);
      }
    }, [manifestUrl, autoPlay, initialQuality]);

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
          // Remove all registered event listeners
          for (const { event, handler } of eventHandlersRef.current) {
            dashInstanceRef.current.off(event, handler);
          }
          eventHandlersRef.current = [];
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

      // Remove old track elements
      const existingTracks = videoRef.current.querySelectorAll('track');
      existingTracks.forEach(track => track.remove());

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

      return () => {
        if (videoRef.current) {
          const tracks = videoRef.current.querySelectorAll('track');
          tracks.forEach(track => track.remove());
        }
      };
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

let _isDASHSupported: boolean | null = null;

export function isDASHSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (_isDASHSupported !== null) return _isDASHSupported;
  const video = document.createElement("video");
  _isDASHSupported = video.canPlayType("application/dash+xml") !== "";
  video.remove();
  return _isDASHSupported;
}

export function getDASHQualities(manifestUrl: string): Promise<DASHQuality[]> {
  return new Promise((resolve, reject) => {
    let dashInstance: any = null;
    let videoElement: HTMLVideoElement | null = null;

    import("dashjs")
      .then((dashjs) => {
        dashInstance = dashjs.MediaPlayer().create();
        videoElement = document.createElement("video");

        try {
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

            resolve(result);
          }).catch((err: any) => {
            reject(err);
          }).finally(() => {
            if (dashInstance) dashInstance.reset();
            videoElement?.remove();
          });
        } catch (err) {
          reject(err);
          if (dashInstance) dashInstance.reset();
          videoElement?.remove();
        }
      })
      .catch((err) => {
        // Import failed — clean up any partially-created resources
        if (dashInstance) dashInstance.reset();
        videoElement?.remove();
        reject(err);
      });
  });
}
