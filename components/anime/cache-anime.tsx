"use client";

import { useEffect } from "react";
import type { Media } from "@/types/anilist";
import { useStore } from "@/store";

interface CacheAnimeProps {
  media: Media | Media[] | null | undefined;
}

export function CacheAnime({ media }: CacheAnimeProps) {
  const setMediaCache = useStore((state) => state.setMediaCache);

  useEffect(() => {
    const items = Array.isArray(media) ? media : media ? [media] : [];

    for (const item of items) {
      setMediaCache(item);
    }
  }, [media, setMediaCache]);

  return null;
}
