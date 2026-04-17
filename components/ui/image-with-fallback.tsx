/**
 * ImageWithFallback Component
 * Image component with loading states, error handling, and fallback UI
 */

"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";

interface ImageWithFallbackProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
  quality?: number;
  fallbackClassName?: string;
  placeholderClassName?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
}

export function ImageWithFallback({
  src,
  alt,
  width,
  height,
  fill = false,
  className = "",
  sizes,
  priority = false,
  quality = 75,
  fallbackClassName = "",
  placeholderClassName = "",
  objectFit = "cover",
}: ImageWithFallbackProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Reset loading state when src changes so placeholder shows for new image
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [src]);

  const handleLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  // Show fallback if no src or error occurred
  if (!src || imageError) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${fallbackClassName || className}`}
        style={fill ? undefined : { width, height }}
      >
        <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
      </div>
    );
  }

  // Show placeholder while loading
  const imageElement = (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      className={`transition-opacity duration-300 ${!imageLoaded ? "opacity-0" : "opacity-100"} ${className}`}
      sizes={sizes}
      priority={priority}
      quality={quality}
      onLoad={handleLoad}
      onError={handleError}
    />
  );

  if (fill) {
    return (
      <div className="relative w-full h-full">
        {!imageLoaded && (
          <div className={`absolute inset-0 bg-muted animate-shimmer ${placeholderClassName}`} />
        )}
        {imageElement}
      </div>
    );
  }

  return (
    <div className="relative" style={{ width, height }}>
      {!imageLoaded && (
        <div className={`absolute inset-0 bg-muted animate-shimmer ${placeholderClassName}`} />
      )}
      {imageElement}
    </div>
  );
}
