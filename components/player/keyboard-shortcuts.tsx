/**
 * Keyboard Shortcuts Help Modal
 * Shows all available keyboard shortcuts for the video player
 */

"use client";

import { useState, useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";

interface ShortcutItem {
  id: string;
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: ShortcutItem[] = [
  { id: "play-pause", keys: ["Space", "K"], description: "Play / Pause", category: "Playback" },
  { id: "seek-jl", keys: ["J", "L"], description: "Rewind / Forward 10s", category: "Playback" },
  { id: "seek-arrows", keys: ["←", "→"], description: "Seek -5s / +5s", category: "Playback" },
  { id: "volume-arrows", keys: ["↓", "↑"], description: "Volume -5% / +5%", category: "Audio" },
  { id: "mute", keys: ["M"], description: "Mute / Unmute", category: "Audio" },
  { id: "fullscreen", keys: ["F"], description: "Toggle Fullscreen", category: "Display" },
  { id: "theater", keys: ["T"], description: "Toggle Theater Mode", category: "Display" },
  { id: "pip", keys: ["P"], description: "Toggle Picture-in-Picture", category: "Display" },
  { id: "captions", keys: ["C"], description: "Toggle Captions", category: "Display" },
  { id: "next-episode", keys: ["N"], description: "Next Episode", category: "Navigation" },
  { id: "speed", keys: ["1", "2", "3", "4", "5"], description: "Speed (0.5x - 2x)", category: "Playback" },
  { id: "skip-intro", keys: ["I"], description: "Skip Intro", category: "Navigation" },
  { id: "skip-outro", keys: ["O"], description: "Skip Outro", category: "Navigation" },
  { id: "escape", keys: ["ESC"], description: "Exit Fullscreen / Close Modals", category: "General" },
  { id: "help", keys: ["?"], description: "Show Keyboard Shortcuts", category: "General" },
];

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  const [activeShortcuts, setActiveShortcuts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Highlight pressed key
      setActiveShortcuts(new Set([e.key.toUpperCase()]));
    };

    const handleKeyUp = () => {
      setActiveShortcuts(new Set());
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Group shortcuts by category
  const categories = Array.from(new Set(SHORTCUTS.map(s => s.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <GlassCard className="max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Keyboard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Keyboard Shortcuts</h2>
              <p className="text-sm text-muted-foreground">
                Navigate the player without a mouse
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Shortcuts */}
        <div className="p-6 space-y-6">
          {categories.map(category => (
            <div key={category}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {category}
              </h3>
              <div className="space-y-2">
                {SHORTCUTS.filter(s => s.category === category).map((shortcut) => (
                  <div
                    key={shortcut.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key) => (
                        <span
                          key={`${shortcut.id}-${key}`}
                          className={`px-2 py-1 rounded text-xs font-mono min-w-[32px] text-center transition-colors ${
                            activeShortcuts.has(key.toUpperCase())
                              ? "bg-primary text-primary-foreground scale-110"
                              : "bg-white/10"
                          }`}
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 text-center">
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-2 py-1 rounded bg-white/10 text-xs font-mono">?</kbd> anywhere to open this help
          </p>
        </div>
      </GlassCard>
    </div>
  );
}

/**
 * Keyboard Shortcuts Button
 * Shows a button to open the shortcuts modal
 */
export function KeyboardShortcutsButton() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        // Only trigger if not in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        title="Keyboard Shortcuts (?)"
      >
        <Keyboard className="w-5 h-5" />
      </button>
      <KeyboardShortcutsModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
