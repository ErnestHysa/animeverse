/**
 * Keyboard Shortcuts Registry
 * Global keyboard shortcuts for the application
 */

export interface KeyboardShortcut {
  key: string;
  description: string;
  action: () => void;
  category: "navigation" | "search" | "player" | "general";
}

class KeyboardShortcutsManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private isEnabled = true;

  register(shortcut: KeyboardShortcut) {
    const key = shortcut.key.toLowerCase();
    this.shortcuts.set(key, shortcut);
  }

  unregister(key: string) {
    this.shortcuts.delete(key.toLowerCase());
  }

  handleKeyDown(event: KeyboardEvent) {
    if (!this.isEnabled) return;

    // Ignore if user is typing in an input
    const target = event.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.contentEditable === "true"
    ) {
      return;
    }

    const key = event.key.toLowerCase();
    const shortcut = this.shortcuts.get(key);

    if (shortcut) {
      event.preventDefault();
      shortcut.action();
    }
  }

  enable() {
    this.isEnabled = true;
  }

  disable() {
    this.isEnabled = false;
  }

  getShortcuts(category?: KeyboardShortcut["category"]) {
    const all = Array.from(this.shortcuts.values());
    return category ? all.filter((s) => s.category === category) : all;
  }
}

export const keyboardManager = new KeyboardShortcutsManager();

// Initialize global shortcuts
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => keyboardManager.handleKeyDown(e));
}

// Default shortcuts
export const DEFAULT_SHORTCUTS = {
  // Navigation
  HOME: { key: "h", description: "Go to Home", action: () => (window.location.href = "/"), category: "navigation" as const },
  SEARCH: { key: "/", description: "Open Search", action: () => {
    const searchInput = document.querySelector('input[type="search"], input[placeholder*="search"]') as HTMLInputElement;
    searchInput?.focus();
  }, category: "search" as const },
  FAVORITES: { key: "f", description: "Go to Favorites", action: () => (window.location.href = "/favorites"), category: "navigation" as const },
  WATCHLIST: { key: "w", description: "Go to Watchlist", action: () => (window.location.href = "/watchlist"), category: "navigation" as const },
  SETTINGS: { key: "s", description: "Go to Settings", action: () => (window.location.href = "/settings"), category: "navigation" as const },
  STATS: { key: "i", description: "Go to Stats", action: () => (window.location.href = "/stats"), category: "navigation" as const },
  ACHIEVEMENTS: { key: "a", description: "Go to Achievements", action: () => (window.location.href = "/achievements"), category: "navigation" as const },
  LISTS: { key: "l", description: "Go to Lists", action: () => (window.location.href = "/lists"), category: "navigation" as const },

  // General
  HELP: { key: "?", description: "Show Shortcuts", action: () => {
    window.dispatchEvent(new CustomEvent("toggleShortcutsHelp"));
  }, category: "general" as const },
};

// Register default shortcuts
export function registerDefaultShortcuts() {
  Object.values(DEFAULT_SHORTCUTS).forEach((shortcut) => {
    keyboardManager.register(shortcut);
  });
}

// Format key for display
export function formatKey(key: string): string {
  return key.length === 1 ? key.toUpperCase() : key;
}
