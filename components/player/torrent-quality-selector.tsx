/**
 * Torrent Quality Selector Component
 * Quality selector for WebTorrent streaming with seed count display
 *
 * Phase 3: WebTorrent Player Integration
 * - 1080p, 720p, 480p options
 * - Prefer higher seed count over quality
 * - Show download/upload stats
 * - Allow manual quality override
 */

"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronDown, Check, Users, Download, Upload, AlertCircle } from "lucide-react";
import type { MagnetLink } from "@/lib/torrent-finder";
import {
  groupTorrentsByQuality,
  formatBytes,
  analyzeTorrentQuality,
} from "@/lib/torrent-stream-loader";

interface TorrentQualitySelectorProps {
  torrents: MagnetLink[];
  selectedInfoHash: string;
  onQualityChange: (magnet: MagnetLink) => void;
  className?: string;
}

interface QualityOption {
  quality: string;
  torrents: MagnetLink[];
  bestTorrent: MagnetLink;
  totalSeeders: number;
  avgSpeed: number;
  qualityRating: "excellent" | "good" | "fair" | "poor";
  totalLeechers: number;
}

export function TorrentQualitySelector({
  torrents,
  selectedInfoHash,
  onQualityChange,
  className = "",
}: TorrentQualitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<string>("");
  const [showDetails, setShowDetails] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Group torrents by quality
  const qualityGroups = useMemo(() => {
    const groups = groupTorrentsByQuality(torrents);

    // Convert to quality options
    const options: QualityOption[] = [];
    const qualityOrder = ["1080p", "720p", "480p", "360p", "unknown"];

    for (const quality of qualityOrder) {
      const torrentsForQuality = groups.get(quality);
      if (torrentsForQuality && torrentsForQuality.length > 0) {
        const best = torrentsForQuality[0]; // Already sorted by seeders
        const totalSeeders = torrentsForQuality.reduce((sum, t) => sum + t.seeders, 0);
        const totalLeechers = torrentsForQuality.reduce((sum, t) => sum + t.leechers, 0);
        const analysis = analyzeTorrentQuality(best as any);

        options.push({
          quality,
          torrents: torrentsForQuality.map((t) => ({
            magnet: t.magnet,
            infoHash: t.infoHash,
            title: t.title,
            quality: t.quality,
            size: t.size,
            seeders: t.seeders,
            leechers: t.leechers,
            provider: t.provider,
            uploadedAt: undefined,
          })),
          bestTorrent: best as any,
          totalSeeders,
          totalLeechers,
          avgSpeed: 0, // Would need real-time data
          qualityRating: analysis.quality,
        });
      }
    }

    return options;
  }, [torrents]);

  // Find currently selected quality
  const selectedOption = useMemo(() => {
    return qualityGroups.find((opt) =>
      opt.torrents.some((t) => t.infoHash === selectedInfoHash)
    );
  }, [qualityGroups, selectedInfoHash]);

  // Update selected quality when selection changes
  useEffect(() => {
    if (selectedOption) {
      setSelectedQuality(selectedOption.quality);
    }
  }, [selectedOption]);

  // Get quality color
  const getQualityColor = (quality: string): string => {
    switch (quality) {
      case "1080p":
        return "text-purple-400";
      case "720p":
        return "text-blue-400";
      case "480p":
        return "text-green-400";
      case "360p":
        return "text-yellow-400";
      default:
        return "text-gray-400";
    }
  };

  // Get quality badge
  const getQualityBadge = (rating: "excellent" | "good" | "fair" | "poor") => {
    switch (rating) {
      case "excellent":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "good":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "fair":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "poor":
        return "bg-red-500/20 text-red-400 border-red-500/30";
    }
  };

  // Handle quality selection
  const handleQualitySelect = (option: QualityOption) => {
    // Select best torrent for this quality
    onQualityChange(option.bestTorrent);
    setSelectedQuality(option.quality);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
        setActiveIndex(0);
      }
      return;
    }
    switch (e.key) {
      case 'Escape':
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => Math.min(prev + 1, qualityGroups.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (activeIndex >= 0 && activeIndex < qualityGroups.length) {
          handleQualitySelect(qualityGroups[activeIndex]);
        }
        break;
    }
  }, [isOpen, activeIndex, qualityGroups, handleQualitySelect]);

  return (
    <div ref={dropdownRef} className={`torrent-quality-selector ${className}`}>
      {/* Selected Quality Display */}
      <button
        onClick={() => { setIsOpen(!isOpen); setActiveIndex(-1); }}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onKeyDown={handleKeyDown}
        className="w-full flex items-center justify-between bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-lg px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg ${getQualityColor(selectedQuality)}`}>
                {selectedQuality === "unknown" ? "Auto" : selectedQuality.toUpperCase()}
              </span>
              {selectedOption && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${getQualityBadge(selectedOption.qualityRating)}`}>
                  {selectedOption.qualityRating}
                </span>
              )}
            </div>
            {selectedOption && (
              <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{selectedOption.totalSeeders} seeds</span>
                </div>
                <div className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  <span>{formatBytes(selectedOption.bestTorrent.size)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Quality Dropdown */}
      {isOpen && (
        <div role="listbox" aria-label="Video quality" className="absolute z-50 mt-2 w-full bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {qualityGroups.map((option, index) => (
              <div key={option.quality} className="border-b border-gray-700 last:border-b-0">
                {/* Quality Header */}
                <button
                  onClick={() => handleQualitySelect(option)}
                  role="option"
                  aria-selected={selectedQuality === option.quality}
                  className={`w-full px-4 py-3 hover:bg-white/10 transition-colors ${activeIndex === index ? 'bg-white/15 ring-1 ring-blue-400/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${getQualityColor(option.quality)}`}>
                            {option.quality === "unknown" ? "Auto" : option.quality.toUpperCase()}
                          </span>
                          {selectedQuality === option.quality && (
                            <Check className="h-4 w-4 text-green-400" />
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${getQualityBadge(option.qualityRating)}`}>
                            {option.qualityRating}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{option.totalSeeders} seeds</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Download className="h-3 w-3" />
                            <span>{formatBytes(option.bestTorrent.size)}</span>
                          </div>
                          <span className="text-gray-500">{option.bestTorrent.provider}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Torrent Details Toggle */}
                {option.torrents.length > 1 && (
                  <button
                    onClick={() => setShowDetails(showDetails === option.quality ? null : option.quality)}
                    className="w-full px-4 py-2 text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <AlertCircle className="h-3 w-3" />
                    <span>
                      {showDetails === option.quality
                        ? "Hide alternatives"
                        : `Show ${option.torrents.length - 1} alternative(s)`}
                    </span>
                  </button>
                )}

                {/* Alternative Torrents */}
                {showDetails === option.quality && option.torrents.length > 1 && (
                  <div className="px-4 pb-3 space-y-2">
                    {option.torrents.slice(1).map((torrent, idx) => (
                      <button
                        key={torrent.infoHash}
                        onClick={() => onQualityChange(torrent as any)}
                        className="w-full text-left px-3 py-2 bg-black/30 hover:bg-black/50 rounded border border-gray-700 hover:border-gray-600 transition-colors"
                      >
                        <div className="text-xs text-gray-400 truncate mb-1">
                          {torrent.title}
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Users className="h-3 w-3" />
                            <span>{torrent.seeders} seeds</span>
                          </div>
                          <div className="flex items-center gap-1 text-gray-500">
                            <Download className="h-3 w-3" />
                            <span>{formatBytes(torrent.size)}</span>
                          </div>
                          <span className="text-gray-600">{torrent.provider}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer Info */}
          <div className="px-4 py-3 bg-black/30 text-xs text-gray-500 border-t border-gray-700">
            <p>💡 Higher seed count = faster download. Quality automatically selected based on availability.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Export a compact version for use in player controls
export function CompactTorrentQualitySelector({
  torrents,
  selectedInfoHash,
  onQualityChange,
}: Omit<TorrentQualitySelectorProps, "className">) {
  const qualityGroups = useMemo(() => {
    const groups = groupTorrentsByQuality(torrents);
    return Array.from(groups.keys()).sort((a, b) => {
      const order = ["1080p", "720p", "480p", "360p", "unknown"];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [torrents]);

  const selectedQuality = useMemo(() => {
    const selected = torrents.find((t) => t.infoHash === selectedInfoHash);
    return selected?.quality || "unknown";
  }, [torrents, selectedInfoHash]);

  return (
    <div className="flex items-center gap-2">
      {qualityGroups.slice(0, 4).map((quality) => {
        const isSelected = quality === selectedQuality;
        const hasSeeds = torrents.some((t) => t.quality === quality && t.seeders > 0);

        return (
          <button
            key={quality}
            onClick={() => {
              const torrent = torrents
                .filter((t) => t.quality === quality)
                .sort((a, b) => b.seeders - a.seeders)[0];
              if (torrent) onQualityChange(torrent);
            }}
            disabled={!hasSeeds}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
              isSelected
                ? "bg-blue-500 text-white"
                : hasSeeds
                ? "bg-white/10 text-gray-300 hover:bg-white/20"
                : "bg-white/5 text-gray-600 cursor-not-allowed"
            }`}
          >
            {quality === "unknown" ? "Auto" : quality}
          </button>
        );
      })}
    </div>
  );
}
