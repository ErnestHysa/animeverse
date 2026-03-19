/**
 * Server Selector Component
 * Allows switching between video providers
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { Server, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ServerOption {
  id: string;
  name: string;
  url: string;
  quality: string;
  type: "mp4" | "hls" | "webm";
  latency?: number;
}

interface ServerSelectorProps {
  servers: ServerOption[];
  currentServer: string;
  onServerChange: (serverId: string) => void;
  isLoading?: boolean;
}

export function ServerSelector({
  servers,
  currentServer,
  onServerChange,
  isLoading = false,
}: ServerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate dropdown position and update on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      } else {
        setDropdownStyle({});
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  // Get server display info
  const getServerInfo = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return { name: "Unknown", quality: "Auto" };
    return {
      name: server.name,
      quality: server.quality,
      latency: server.latency,
    };
  };

  const currentInfo = getServerInfo(currentServer);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
        disabled={isLoading}
        aria-label="Select server"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Server className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">{currentInfo.name}</span>
        <span className="text-muted-foreground hidden xs:inline">({currentInfo.quality})</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      {isOpen && (
        <div
          className="fixed bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden shadow-xl z-[9999] w-56"
          style={dropdownStyle}
          role="listbox"
          aria-label="Server options"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs font-medium text-muted-foreground">Select Server</p>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {servers.map((server) => {
              const isSelected = server.id === currentServer;
              return (
                <button
                  key={server.id}
                  onClick={() => {
                    onServerChange(server.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/10 transition-colors",
                    isSelected && "bg-primary/20"
                  )}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${server.name} - ${server.quality} ${server.type.toUpperCase()}`}
                >
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-medium">{server.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {server.quality} • {server.type.toUpperCase()}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary" aria-hidden="true" />
                    )}
                  </div>
                </button>
              );
            })}

            {servers.length === 0 && (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground" role="status">
                No servers available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Language Selector (Sub/Dub)
 */
export interface LanguageOption {
  id: string;
  label: string;
  type: "sub" | "dub" | "both";
  available?: boolean;
}

interface LanguageSelectorProps {
  languages: LanguageOption[];
  currentLanguage: string;
  onLanguageChange: (languageId: string) => void;
}

export function LanguageSelector({
  languages,
  currentLanguage,
  onLanguageChange,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Calculate dropdown position and update on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      if (isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownStyle({
          position: 'fixed',
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      } else {
        setDropdownStyle({});
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen]);

  const currentLang = languages.find((l) => l.id === currentLanguage);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <Globe className="w-4 h-4" aria-hidden="true" />
        <span className="hidden xs:inline">{currentLang?.label || "Sub"}</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-[9998]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}
      {isOpen && (
        <div
          className="fixed bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden shadow-xl z-[9999] w-48"
          style={dropdownStyle}
          role="listbox"
          aria-label="Language options"
        >
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs font-medium text-muted-foreground">Language</p>
          </div>

          <div className="py-1">
            {languages.map((lang) => {
              const isSelected = lang.id === currentLanguage;
              const isAvailable = lang.available !== false;
              return (
                <button
                  key={lang.id}
                  onClick={() => {
                    if (isAvailable) {
                      onLanguageChange(lang.id);
                      setIsOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left transition-colors",
                    isAvailable && "hover:bg-white/10",
                    !isAvailable && "opacity-50 cursor-not-allowed",
                    isSelected && "bg-primary/20"
                  )}
                  disabled={!isAvailable}
                  role="option"
                  aria-selected={isSelected}
                  aria-label={`${lang.label}${!isAvailable ? " - Not available" : ""}`}
                    >
                      <span className="text-sm">{lang.label}</span>
                      <div className="flex items-center gap-2">
                        {!isAvailable && (
                          <span className="text-xs text-muted-foreground">(N/A)</span>
                        )}
                        {isSelected && (
                          <Check className="w-4 h-4 text-primary" aria-hidden="true" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
        )}
      </div>
  );
}

// Globe icon import
function Globe({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
