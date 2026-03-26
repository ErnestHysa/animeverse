/**
 * Keyboard Shortcuts Help Modal
 * Displays all available keyboard shortcuts
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { keyboardManager, registerDefaultShortcuts, formatKey } from "@/lib/keyboard-shortcuts";
import { X, Keyboard } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  navigation: "Navigation",
  search: "Search",
  player: "Video Player",
  general: "General",
};

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const shortcuts = useMemo(
    () => (isOpen ? keyboardManager.getShortcuts() : []),
    [isOpen]
  );

  useEffect(() => {
    registerDefaultShortcuts();
  }, []);

  useEffect(() => {
    const handleToggle = () => onClose();
    window.addEventListener("toggleShortcutsHelp", handleToggle);
    return () => window.removeEventListener("toggleShortcutsHelp", handleToggle);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const grouped = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, typeof shortcuts>);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-background/95 backdrop-blur-sm p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Keyboard className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Keyboard Shortcuts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {Object.entries(grouped).map(([category, categoryShortcuts]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {CATEGORY_LABELS[category] || category}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryShortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-white/10 rounded">
                      {formatKey(shortcut.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/10 text-center text-sm text-muted-foreground">
          Press <kbd className="px-1 py-0.5 text-xs font-mono bg-white/10 rounded">?</kbd> to toggle this help
        </div>
      </GlassCard>
    </div>
  );
}

/**
 * Keyboard Shortcuts Button
 * Floating button to open shortcuts help
 */
export function KeyboardShortcutsButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-3 rounded-full bg-primary/90 hover:bg-primary text-white shadow-lg transition-all hover:scale-110"
        title="Keyboard Shortcuts (?)"
      >
        <Keyboard className="w-5 h-5" />
      </button>
      <ShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
