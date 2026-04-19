/**
 * Streaming Settings Component
 * Configuration for HLS, P2P/Torrent, and Hybrid streaming methods
 */

"use client";

import { useState } from "react";
import { usePreferences } from "@/store";
import {
  Settings as SettingsIcon,
  Wifi,
  Globe,
  Shuffle,
  Zap,
  AlertTriangle,
  Info,
} from "lucide-react";

interface StreamingSettingsProps {
  className?: string;
}

const STREAMING_METHODS = [
  {
    value: "direct" as const,
    label: "HLS (Default)",
    description: "Traditional CDN-based streaming. Works everywhere, reliable.",
    icon: Globe,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  {
    value: "webtorrent" as const,
    label: "P2P/Torrent",
    description: "Browser-based P2P streaming. Faster when available, shares bandwidth.",
    icon: Wifi,
    color: "text-green-400",
    bgColor: "bg-green-500/20",
  },
  {
    value: "hybrid" as const,
    label: "Hybrid (Auto-switch)",
    description: "Automatically switches between P2P and HLS for best experience.",
    icon: Shuffle,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
];

const QUALITY_OPTIONS = [
  { value: "auto" as const, label: "Auto (Highest Available)" },
  { value: "1080p" as const, label: "1080p (Full HD)" },
  { value: "720p" as const, label: "720p (HD)" },
  { value: "480p" as const, label: "480p (SD)" },
  { value: "360p" as const, label: "360p (Low)" },
];

export function StreamingSettings({ className = "" }: StreamingSettingsProps) {
  const { preferences, updatePreferences } = usePreferences();
  const [showDetails, setShowDetails] = useState<string | null>(null);

  // Get current values with defaults
  const streamingMethod = preferences?.streamingMethod ?? "direct";
  const defaultQuality = preferences?.defaultQuality ?? "auto";
  const preferDubs = preferences?.preferDubs ?? false;

  const handleStreamingMethodChange = (method: typeof streamingMethod) => {
    updatePreferences({ streamingMethod: method });
  };

  const handleQualityChange = (quality: string) => {
    const validated = QUALITY_OPTIONS.some(opt => opt.value === quality) ? quality as typeof defaultQuality : 'auto' as typeof defaultQuality;
    updatePreferences({ defaultQuality: validated });
  };

  const handlePreferDubsToggle = () => {
    updatePreferences({ preferDubs: !preferDubs });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Streaming Method Selection */}
      <div>
        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4" />
          Streaming Method
        </h4>
        <div className="space-y-2">
          {STREAMING_METHODS.map((method) => {
            const Icon = method.icon;
            const isSelected = streamingMethod === method.value;
            const isExperimental = method.value === "webtorrent";

            return (
              <div key={method.value} className="relative">
                <button
                  onClick={() => handleStreamingMethodChange(method.value)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    isSelected
                      ? `border-primary ${method.bgColor}`
                      : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${method.bgColor}`}>
                      <Icon className={`w-5 h-5 ${method.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{method.label}</span>
                        {isExperimental && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Experimental
                          </span>
                        )}
                        {isSelected && (
                          <span className={`px-2 py-0.5 text-xs rounded-full ${method.bgColor} ${method.color} border border-current`}>
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{method.description}</p>
                    </div>
                  </div>
                </button>

                {/* Details toggle */}
                <button
                  onClick={() => setShowDetails(showDetails === method.value ? null : method.value)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-white/5 hover:bg-white/10 transition-colors"
                  aria-label="Toggle streaming method details"
                >
                  <Info className="w-4 h-4 text-muted-foreground" />
                </button>

                {/* Expanded details */}
                {showDetails === method.value && (
                  <div className="mt-2 p-3 rounded-lg bg-white/5 border border-white/10 text-sm">
                    {method.value === "direct" && (
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✓ Works on all devices and browsers</li>
                        <li>✓ No bandwidth sharing required</li>
                        <li>✓ Consistent quality delivery</li>
                        <li>✗ Higher server costs</li>
                        <li>✗ 10-90 second startup delay</li>
                      </ul>
                    )}
                    {method.value === "webtorrent" && (
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✓ Starts in &lt;5 seconds when available</li>
                        <li>✓ Reduces CDN bandwidth usage</li>
                        <li>✓ Bandwidth shared between viewers</li>
                        <li>✗ Requires active seeders</li>
                        <li>✗ May not work on some networks</li>
                        <li>⚠ ISP may throttle P2P traffic</li>
                      </ul>
                    )}
                    {method.value === "hybrid" && (
                      <ul className="space-y-1 text-muted-foreground">
                        <li>✓ Best of both worlds</li>
                        <li>✓ Tries P2P first (faster)</li>
                        <li>✓ Falls back to HLS if needed</li>
                        <li>✓ Smart seed count detection</li>
                        <li>✓ Network-aware switching</li>
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Warning for P2P */}
        {streamingMethod === "webtorrent" && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-200">
              <p className="font-medium text-yellow-500">P2P Streaming Notice</p>
              <p className="text-muted-foreground mt-1">
                This method shares your bandwidth with other viewers. On limited data plans, consider using HLS instead.
                Some ISPs may throttle P2P traffic.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quality Preference */}
      <div>
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Default Quality
        </h4>
        <select
          aria-label="Preferred streaming method"
          value={defaultQuality}
          onChange={(e) => handleQualityChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
        >
          {QUALITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-2">
          Preferred video quality. Will be used if available. &quot;Auto&quot; selects the highest quality.
        </p>
      </div>

      {/* Prefer Dubs Toggle */}
      <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
        <div>
          <h4 className="text-sm font-medium">Prefer Dubs for Torrents</h4>
          <p className="text-xs text-muted-foreground mt-1">
            When using P2P streaming, prioritize dubbed versions if available.
          </p>
        </div>
        <button
          role="switch"
          aria-checked={preferDubs}
          aria-label="Prefer dubbed audio"
          onClick={handlePreferDubsToggle}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            preferDubs ? "bg-primary" : "bg-white/10"
          }`}
        >
          <span
            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
              preferDubs ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Info Card */}
      <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-400">How Hybrid Mode Works</p>
            <p className="text-muted-foreground mt-1">
              Hybrid mode tries P2P streaming first for faster startup. If there aren&apos;t enough seeders (&lt;3) or
              the torrent isn&apos;t available, it automatically falls back to HLS streaming. You can also manually
              retry with the retry button in the player.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
