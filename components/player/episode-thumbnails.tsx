/**
 * Episode Thumbnails Preview
 * Shows thumbnail preview when hovering over progress bar
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface Thumbnail {
  time: number;
  url: string;
}

interface EpisodeThumbnailsProps {
  duration: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  thumbnails?: Thumbnail[];
  isGeneratingThumbnail?: React.MutableRefObject<boolean>;
}

export function EpisodeThumbnails({ duration, videoRef, thumbnails, isGeneratingThumbnail }: EpisodeThumbnailsProps) {
  const [hoverTime, setHoverTime] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [thumbnail, setThumbnail] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Flag to suppress timeupdate events during thumbnail generation
  const isGeneratingRef = useRef(false);
  // Track in-progress generation to cancel stale requests
  const generationIdRef = useRef(0);
  // Track mount status to avoid setState after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const generateThumbnail = useCallback(async (time: number, generationId: number) => {
    const video = videoRef.current;
    if (!video) return null;

    // Bail early if a newer seek has already been requested
    if (generationIdRef.current !== generationId) return null;

    // Create a temporary canvas to capture frame
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    canvas.width = 160;
    canvas.height = 90;

    // Suppress timeupdate propagation during thumbnail generation
    isGeneratingRef.current = true;
    if (isGeneratingThumbnail) isGeneratingThumbnail.current = true;

    // Seek to the time position
    const originalTime = video.currentTime;
    video.currentTime = time;

    // Wait for seek to complete
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);

      // Timeout in case seeked event doesn't fire
      setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      }, 1000);
    });

    // Check if this generation was superseded by a newer request
    if (generationIdRef.current !== generationId) {
      // Still need to restore position before bailing
      video.currentTime = originalTime;
      isGeneratingRef.current = false;
      if (isGeneratingThumbnail) isGeneratingThumbnail.current = false;
      return null;
    }

    // Draw frame to canvas
    try {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      return dataUrl;
    } catch {
      return null;
    } finally {
      // Only restore if no newer seek has been requested
      if (generationIdRef.current === generationId) {
        video.currentTime = originalTime;
      }
      // Delay clearing the flag so the seek-back doesn't trigger visible timeupdate
      setTimeout(() => {
        isGeneratingRef.current = false;
        if (isGeneratingThumbnail) isGeneratingThumbnail.current = false;
      }, 100);
    }
  }, [videoRef, isGeneratingThumbnail]);

  useEffect(() => {
    if (!isHovering || !videoRef.current) return;

    // Generate thumbnail for hover position
    const time = Math.floor(hoverTime);
    const existingThumbnail = thumbnails?.find(t => Math.abs(t.time - time) < 5);

    if (existingThumbnail) {
      setThumbnail(existingThumbnail.url);
    } else {
      // Increment generation ID to cancel any in-progress stale generation
      const thisGenerationId = ++generationIdRef.current;

      // Generate thumbnail on the fly (debounced)
      const timeout = setTimeout(async () => {
        const dataUrl = await generateThumbnail(time, thisGenerationId);
        if (dataUrl && isMountedRef.current) {
          setThumbnail(dataUrl);
        }
      }, 200);

      return () => clearTimeout(timeout);
    }
  }, [isHovering, hoverTime, thumbnails, videoRef, generateThumbnail]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;

    setHoverTime(time);
  };

  return (
    <div className="relative">
      {/* Progress Bar */}
      <div
        ref={containerRef}
        className="h-1 bg-white/20 rounded-full cursor-pointer group"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => {
          setIsHovering(false);
          setThumbnail("");
        }}
      >
        {/* Hover Position Indicator */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none transition-all"
          style={{
            left: duration > 0 ? `${(hoverTime / duration) * 100}%` : '0%',
          }}
        />
      </div>

      {/* Thumbnail Preview */}
      {isHovering && thumbnail && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 rounded-lg overflow-hidden shadow-xl border border-white/20 bg-black"
          style={{
            left: duration > 0 ? `${(hoverTime / duration) * 100}%` : '0%',
          }}
        >
          <img
            src={thumbnail}
            alt="Thumbnail preview"
            className="w-40 h-auto block"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div className="px-2 py-1 bg-black/80 text-xs text-white text-center">
            {formatTime(hoverTime)}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Simple Thumbnail Preview for Progress Bar
 * Shows time tooltip when hovering over progress bar
 */
interface SimpleThumbnailPreviewProps {
  duration: number;
  currentTime: number;
}

export function SimpleThumbnailPreview({ duration, currentTime }: SimpleThumbnailPreviewProps) {
  const [hoverTime, setHoverTime] = useState(currentTime);
  const [showPreview, setShowPreview] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPercentage = (time: number) => duration > 0 ? (time / duration) * 100 : 0;

  return (
    <div
      className="relative group"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const time = percentage * duration;
        setHoverTime(time);
        setShowPreview(true);
      }}
      onMouseLeave={() => setShowPreview(false)}
    >
      {/* Progress Bar */}
      <div className="h-1 bg-white/20 rounded-full cursor-pointer relative">
        {/* Hover Position */}
        {showPreview && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white"
            style={{ left: `${getPercentage(hoverTime)}%` }}
          />
        )}

        {/* Time Tooltip */}
        {showPreview && (
          <div
            className="absolute bottom-full mb-2 px-2 py-1 bg-black/90 text-white text-xs rounded whitespace-nowrap pointer-events-none"
            style={{ left: `${getPercentage(hoverTime)}%`, transform: "translateX(-50%)" }}
          >
            {formatTime(hoverTime)}
          </div>
        )}
      </div>
    </div>
  );
}
