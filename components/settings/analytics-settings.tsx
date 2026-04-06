/**
 * Analytics Settings Component
 * User-facing settings for analytics and monitoring
 *
 * Phase 9: Monitoring & Analytics
 */

"use client";

import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ui/glass-card";
import { Info, Shield } from "lucide-react";

export function AnalyticsSettings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true);
  const [diagnosticsEnabled, setDiagnosticsEnabled] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const stored = localStorage.getItem("analytics-settings");
    if (stored) {
      const settings = JSON.parse(stored);
      setAnalyticsEnabled(settings.analyticsEnabled ?? true);
      setDiagnosticsEnabled(settings.diagnosticsEnabled ?? false);
    }
  }, []);

  const handleAnalyticsChange = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    localStorage.setItem(
      "analytics-settings",
      JSON.stringify({
        analyticsEnabled: enabled,
        diagnosticsEnabled,
      })
    );

    // Enable/disable analytics tracking
    try {
      const { enableAnalytics, disableAnalytics } = require("@/lib/hybrid-stream-manager");
      if (enabled) {
        enableAnalytics();
      } else {
        disableAnalytics();
      }
    } catch (error) {
      console.error("Failed to toggle analytics:", error);
    }
  };

  const handleDiagnosticsChange = (enabled: boolean) => {
    setDiagnosticsEnabled(enabled);
    localStorage.setItem(
      "analytics-settings",
      JSON.stringify({
        analyticsEnabled,
        diagnosticsEnabled: enabled,
      })
    );
  };

  return (
    <GlassCard className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Info className="w-5 h-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Analytics & Diagnostics</h3>
          <p className="text-sm text-gray-400">
            Help us improve the streaming experience
          </p>
        </div>
      </div>

      {/* Analytics Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="analytics-toggle" className="text-base">
            Anonymous Analytics
          </Label>
          <p className="text-sm text-gray-400">
            Help us understand streaming performance and issues
          </p>
        </div>
        <Switch
          id="analytics-toggle"
          checked={analyticsEnabled}
          onCheckedChange={handleAnalyticsChange}
        />
      </div>

      {/* Diagnostics Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
        <div className="space-y-1">
          <Label htmlFor="diagnostics-toggle" className="text-base">
            Diagnostic Data
          </Label>
          <p className="text-sm text-gray-400">
            Include detailed performance metrics for troubleshooting
          </p>
        </div>
        <Switch
          id="diagnostics-toggle"
          checked={diagnosticsEnabled}
          onCheckedChange={handleDiagnosticsChange}
        />
      </div>

      {/* Privacy Notice */}
      <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1 text-sm">
          <p className="font-medium text-blue-400">Privacy First</p>
          <p className="text-gray-400">
            All analytics data is anonymized and aggregated. We never collect
            personal information, viewing history, or track individual users.
            Data helps us improve streaming quality and reduce buffering.
          </p>
        </div>
      </div>

      {/* What We Track */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">
          What we track (when enabled):
        </h4>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Streaming method usage (HLS vs WebTorrent vs Hybrid)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Fallback events and reasons
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Average seed/peer counts for torrents
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Buffering events and duration
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            Quality changes and network performance
          </li>
        </ul>
      </div>
    </GlassCard>
  );
}
