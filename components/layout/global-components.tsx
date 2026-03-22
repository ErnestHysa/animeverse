/**
 * Global Components
 * Client-side components that appear on all pages
 */

"use client";

import { KeyboardShortcutsButton } from "@/components/ui/shortcuts-modal";
import { registerDefaultShortcuts } from "@/lib/keyboard-shortcuts";
import { useEffect } from "react";

export function GlobalComponents() {
  useEffect(() => {
    // Register keyboard shortcuts on mount
    registerDefaultShortcuts();
  }, []);

  return (
    <>
      <KeyboardShortcutsButton />
    </>
  );
}
