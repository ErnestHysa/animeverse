/**
 * Global Components
 * Client-side components that appear on all pages
 */

"use client";

import { KeyboardShortcutsButton } from "@/components/ui/shortcuts-modal";
import { registerDefaultShortcuts } from "@/lib/keyboard-shortcuts";
import { useEffect } from "react";
import { AppSuiteOrchestrator } from "@/components/layout/app-suite-orchestrator";
import { MiniPlayer } from "@/components/player/mini-player";

export function GlobalComponents() {
  useEffect(() => {
    // Register keyboard shortcuts on mount
    registerDefaultShortcuts();
  }, []);

  return (
    <>
      <AppSuiteOrchestrator />
      <KeyboardShortcutsButton />
      <MiniPlayer />
    </>
  );
}
