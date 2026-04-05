/**
 * Performance Settings Component
 *
 * Phase 6: Performance & Optimization
 * Configuration for torrent preloading, bandwidth management, and DHT optimization
 */

"use client";

import { useState } from "react";
import { usePreferences } from "@/store";
import {
  Zap,
  Wifi,
  Settings as SettingsIcon,
  Network,
  Gauge,
  Info,
  AlertTriangle,
  TrendingUp,
  Download,
  Upload,
  Router,
} from "lucide-react";

interface PerformanceSettingsProps {
  className?: string;
}

const UPLOAD_LIMIT_OPTIONS = [
  { value: 0, label: "Unlimited" },
  { value: 100 * 1024, label: "100 KB/s" },
  { value: 250 * 1024, label: "250 KB/s" },
  { value: 500 * 1024, label: "500 KB/s" },
  { value: 1024 * 1024, label: "1 MB/s" },
  { value: 2 * 1024 * 1024, label: "2 MB/s" },
];

const DOWNLOAD_LIMIT_OPTIONS = [
  { value: 0, label: "Unlimited" },
  { value: 500 * 1024, label: "500 KB/s" },
  { value: 1024 * 1024, label: "1 MB/s" },
  { value: 2 * 1024 * 1024, label: "2 MB/s" },
  { value: 5 * 1024 * 1024, label: "5 MB/s" },
  { value: 10 * 1024 * 1024, label: "10 MB/s" },
];

const PRELOAD_THRESHOLD_OPTIONS = [
  { value: 180, label: "3 minutes left" },
  { value: 120, label: "2 minutes left" },
  { value: 60, label: "1 minute left" },
  { value: 30, label: "30 seconds left" },
];

const PRELOAD_SIZE_OPTIONS = [
  { value: 50 * 1024 * 1024, label: "50 MB" },
  { value: 100 * 1024 * 1024, label: "100 MB" },
  { value: 200 * 1024 * 1024, label: "200 MB" },
  { value: 500 * 1024 * 1024, label: "500 MB" },
];

export function PerformanceSettings({ className = "" }: PerformanceSettingsProps) {
  const { preferences, updatePreferences } = usePreferences();

  // Get current values with defaults
  const preloadConfig = preferences?.preloadConfig || {
    enabled: true,
    preloadThreshold: 120,
    targetBytes: 100 * 1024 * 1024,
    wifiOnly: true,
  };

  const bandwidthConfig = preferences?.bandwidthConfig || {
    uploadLimit: 0,
    downloadLimit: 0,
    mode: "unlimited",
    adaptiveEnabled: false,
    wifiOnly: false,
  };

  const dhtConfig = preferences?.dhtConfig || {
    enablePreconnect: true,
    preferTrackers: true,
  };

  // ===================================
  // Preloading Settings
  // ===================================

  const handlePreloadEnabledToggle = () => {
    updatePreferences({
      preloadConfig: { ...preloadConfig, enabled: !preloadConfig.enabled },
    });
  };

  const handlePreloadThresholdChange = (value: number) => {
    updatePreferences({
      preloadConfig: { ...preloadConfig, preloadThreshold: value },
    });
  };

  const handlePreloadSizeChange = (value: number) => {
    updatePreferences({
      preloadConfig: { ...preloadConfig, targetBytes: value },
    });
  };

  const handlePreloadWifiOnlyToggle = () => {
    updatePreferences({
      preloadConfig: { ...preloadConfig, wifiOnly: !preloadConfig.wifiOnly },
    });
  };

  // ===================================
  // Bandwidth Settings
  // ===================================

  const handleUploadLimitChange = (value: number) => {
    const mode = value === 0 ? "unlimited" : bandwidthConfig.adaptiveEnabled ? "adaptive" : "custom";
    updatePreferences({
      bandwidthConfig: { ...bandwidthConfig, uploadLimit: value, mode },
    });
  };

  const handleDownloadLimitChange = (value: number) => {
    const mode = value === 0 ? "unlimited" : bandwidthConfig.adaptiveEnabled ? "adaptive" : "custom";
    updatePreferences({
      bandwidthConfig: { ...bandwidthConfig, downloadLimit: value, mode },
    });
  };

  const handleAdaptiveToggle = () => {
    updatePreferences({
      bandwidthConfig: {
        ...bandwidthConfig,
        adaptiveEnabled: !bandwidthConfig.adaptiveEnabled,
        mode: !bandwidthConfig.adaptiveEnabled ? "adaptive" : bandwidthConfig.uploadLimit > 0 ? "custom" : "unlimited",
      },
    });
  };

  const handleBandwidthWifiOnlyToggle = () => {
    updatePreferences({
      bandwidthConfig: { ...bandwidthConfig, wifiOnly: !bandwidthConfig.wifiOnly },
    });
  };

  // ===================================
  // DHT Settings
  // ===================================

  const handleDhtPreconnectToggle = () => {
    updatePreferences({
      dhtConfig: { ...dhtConfig, enablePreconnect: !dhtConfig.enablePreconnect },
    });
  };

  const handlePreferTrackersToggle = () => {
    updatePreferences({
      dhtConfig: { ...dhtConfig, preferTrackers: !dhtConfig.preferTrackers },
    });
  };

  // ===================================
  // Utility Functions
  // ===================================

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* =================================== */}
      {/* Torrent Preloading Section */}
      {/* =================================== */}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Download className="w-4 h-4" />
            Torrent Preloading
          </h4>
          <button
            onClick={handlePreloadEnabledToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              preloadConfig.enabled ? "bg-primary" : "bg-white/10"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                preloadConfig.enabled ? "translate-x-7" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        {preloadConfig.enabled && (
          <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
            {/* Preload Threshold */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                When to preload next episode
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRELOAD_THRESHOLD_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePreloadThresholdChange(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      preloadConfig.preloadThreshold === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Preload Size */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                How much to preload
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PRELOAD_SIZE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handlePreloadSizeChange(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                      preloadConfig.targetBytes === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* WiFi Only */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">WiFi only</span>
              </div>
              <button
                onClick={handlePreloadWifiOnlyToggle}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  preloadConfig.wifiOnly ? "bg-primary" : "bg-white/10"
                }`}
              >
                <span
                  className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                    preloadConfig.wifiOnly ? "translate-x-7" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {/* Info Card */}
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Preloading downloads the next episode in the background while you&apos;re watching.
                  This reduces waiting time between episodes but uses additional bandwidth.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =================================== */}
      {/* Bandwidth Management Section */}
      {/* =================================== */}

      <div>
        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Gauge className="w-4 h-4" />
          Bandwidth Management
        </h4>

        <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
          {/* Upload Limit */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <Upload className="w-3 h-3" />
              Upload limit (seeding)
            </label>
            <select
              value={bandwidthConfig.uploadLimit}
              onChange={(e) => handleUploadLimitChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
              disabled={bandwidthConfig.adaptiveEnabled}
            >
              {UPLOAD_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Limits how much bandwidth you use for seeding. Higher limits help other viewers.
            </p>
          </div>

          {/* Download Limit */}
          <div>
            <label className="text-xs text-muted-foreground mb-2 block flex items-center gap-1">
              <Download className="w-3 h-3" />
              Download limit
            </label>
            <select
              value={bandwidthConfig.downloadLimit}
              onChange={(e) => handleDownloadLimitChange(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary focus:outline-none"
              disabled={bandwidthConfig.adaptiveEnabled}
            >
              {DOWNLOAD_LIMIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Limits download speed for torrents. Usually left unlimited for best experience.
            </p>
          </div>

          {/* Adaptive Bandwidth */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Adaptive bandwidth</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically adjust based on network quality
              </p>
            </div>
            <button
              onClick={handleAdaptiveToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                bandwidthConfig.adaptiveEnabled ? "bg-primary" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  bandwidthConfig.adaptiveEnabled ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* WiFi Only for Bandwidth */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Only limit on WiFi</span>
            </div>
            <button
              onClick={handleBandwidthWifiOnlyToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                bandwidthConfig.wifiOnly ? "bg-primary" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  bandwidthConfig.wifiOnly ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Current Mode Badge */}
          <div className="flex items-center justify-center pt-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              bandwidthConfig.mode === "unlimited"
                ? "bg-green-500/20 text-green-400"
                : bandwidthConfig.mode === "adaptive"
                ? "bg-blue-500/20 text-blue-400"
                : "bg-purple-500/20 text-purple-400"
            }`}>
              Current mode: {bandwidthConfig.mode.charAt(0).toUpperCase() + bandwidthConfig.mode.slice(1)}
            </span>
          </div>

          {/* Warning for limited bandwidth */}
          {(bandwidthConfig.uploadLimit > 0 || bandwidthConfig.downloadLimit > 0) && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Limiting bandwidth may reduce video quality or increase buffering. Adaptive mode is recommended for
                most users.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =================================== */}
      {/* DHT Optimization Section */}
      {/* =================================== */}

      <div>
        <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
          <Router className="w-4 h-4" />
          DHT / Peer Discovery
        </h4>

        <div className="space-y-4 p-4 rounded-lg bg-white/5 border border-white/10">
          {/* Preconnect to DHT */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Preconnect to DHT nodes</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Reduces peer discovery time by connecting to known nodes
              </p>
            </div>
            <button
              onClick={handleDhtPreconnectToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                dhtConfig.enablePreconnect ? "bg-primary" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  dhtConfig.enablePreconnect ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Prefer Trackers */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Prefer trackers over DHT</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use trackers first for faster peer discovery
              </p>
            </div>
            <button
              onClick={handlePreferTrackersToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                dhtConfig.preferTrackers ? "bg-primary" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  dhtConfig.preferTrackers ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Info Card */}
          <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                DHT (Distributed Hash Table) is used to find peers without trackers. Preconnecting to known DHT nodes
                speeds up this process. Trackers provide faster peer discovery when available.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* =================================== */}
      {/* Overall Info Card */}
      {/* =================================== */}

      <div className="p-4 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30">
        <div className="flex items-start gap-3">
          <Zap className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-purple-400">Performance Optimization</p>
            <p className="text-sm text-muted-foreground mt-1">
              These settings help optimize your P2P streaming experience. Preloading reduces wait times between episodes.
              Bandwidth management lets you control how much you seed. DHT optimization speeds up peer discovery.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Changes take effect on the next episode or when you restart the player.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
