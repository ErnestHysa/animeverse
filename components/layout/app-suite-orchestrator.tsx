"use client";

import { useEffect, useRef } from "react";
import { Toaster } from "react-hot-toast";
import { useStore } from "@/store";
import { useCustomLists } from "@/lib/custom-lists";
import { calculateStats, saveStats } from "@/lib/stats";

interface LegacyAchievementsPayload {
  achievements?: Record<string, number>;
  unlocked?: string[];
}

function loadLegacyAchievements(): LegacyAchievementsPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem("animeverse_achievements");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as LegacyAchievementsPayload;
    return {
      achievements: parsed.achievements ?? {},
      unlocked: parsed.unlocked ?? [],
    };
  } catch {
    return null;
  }
}

export function AppSuiteOrchestrator() {
  const watchHistory = useStore((state) => state.watchHistory);
  const favorites = useStore((state) => state.favorites);
  const mediaCache = useStore((state) => state.mediaCache);
  const checkAndUnlockAchievements = useStore((state) => state.checkAndUnlockAchievements);
  const updateAchievementProgress = useStore((state) => state.updateAchievementProgress);
  const { lists } = useCustomLists();
  const restoredLegacyAchievementsRef = useRef(false);

  useEffect(() => {
    if (restoredLegacyAchievementsRef.current) {
      return;
    }

    restoredLegacyAchievementsRef.current = true;
    const legacy = loadLegacyAchievements();

    if (!legacy || (!legacy.unlocked?.length && !Object.keys(legacy.achievements ?? {}).length)) {
      return;
    }

    useStore.setState((state) => ({
      achievements: {
        ...legacy.achievements,
        ...state.achievements,
      },
      unlockedAchievements: Array.from(
        new Set([...(legacy.unlocked ?? []), ...state.unlockedAchievements])
      ),
    }));
    localStorage.removeItem("animeverse_achievements");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    saveStats(calculateStats(watchHistory, mediaCache));
  }, [watchHistory, mediaCache]);

  useEffect(() => {
    checkAndUnlockAchievements();
  }, [watchHistory, favorites, checkAndUnlockAchievements]);

  useEffect(() => {
    updateAchievementProgress("list-creator", lists.length);
  }, [lists.length, updateAchievementProgress]);

  return (
    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 2500,
        style: {
          background: "rgba(17, 24, 39, 0.92)",
          color: "#f9fafb",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          backdropFilter: "blur(10px)",
        },
      }}
    />
  );
}
