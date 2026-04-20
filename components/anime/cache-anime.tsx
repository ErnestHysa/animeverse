"use client";

import { useEffect, useMemo } from "react";
import type { Media } from "@/types/anilist";
import { useStore } from "@/store";

interface CacheAnimeProps {
  media: Media | Media[] | null | undefined;
}

export function CacheAnime({ media }: CacheAnimeProps) {
  const setMediaCache = useStore((state) => state.setMediaCache);
  const getMediaCache = useStore((state) => state.getMediaCache);

  // Use a serialized key to avoid re-running on new array references with same content
  const mediaKey = useMemo(() => {
    const items = Array.isArray(media) ? media : media ? [media] : [];
    return items.map(m => m.id).join(',');
  }, [media]);

  useEffect(() => {
    const items = Array.isArray(media) ? media : media ? [media] : [];

    for (const item of items) {
      if (!getMediaCache(item.id)) {
        setMediaCache(item);
      }
    }
  }, [getMediaCache, mediaKey, setMediaCache]);

  return null;
}
