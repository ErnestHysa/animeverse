/**
 * Server Selector Component
 * Allows switching between video providers
 */

"use client";

import { useState, useEffect } from "react";
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
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm",
          isLoading && "opacity-50 cursor-not-allowed"
        )}
        disabled={isLoading}
      >
        <Server className="w-4 h-4" />
        <span className="hidden sm:inline">{currentInfo.name}</span>
        <span className="text-muted-foreground">({currentInfo.quality})</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 z-50 w-56">
            <div className="bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden shadow-xl">
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
                    >
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{server.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {server.quality} • {server.type.toUpperCase()}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  );
                })}

                {servers.length === 0 && (
                  <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                    No servers available
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
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

  const currentLang = languages.find((l) => l.id === currentLanguage);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-sm"
      >
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLang?.label || "Sub"}</span>
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          <div className="absolute right-0 top-full mt-2 z-50 w-48">
            <div className="bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden shadow-xl">
              <div className="px-3 py-2 border-b border-white/10">
                <p className="text-xs font-medium text-muted-foreground">Language</p>
              </div>

              <div className="py-1">
                {languages.map((lang) => {
                  const isSelected = lang.id === currentLanguage;
                  return (
                    <button
                      key={lang.id}
                      onClick={() => {
                        onLanguageChange(lang.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/10 transition-colors",
                        isSelected && "bg-primary/20"
                      )}
                    >
                      <span className="text-sm">{lang.label}</span>
                      {isSelected && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
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
