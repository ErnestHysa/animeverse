/**
 * Notification Settings Component
 * Manages browser notification preferences
 */

"use client";

import { useState } from "react";
import { Bell, BellOff, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  areNotificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
} from "@/lib/notifications";

export function NotificationSettings() {
  // Use lazy initializers to avoid setState in effect
  const [permission, setPermission] = useState(() => getNotificationPermission());
  const [isSupported] = useState(() => areNotificationsSupported());
  const [requesting, setRequesting] = useState(false);

  const handleRequestPermission = async () => {
    setRequesting(true);
    const result = await requestNotificationPermission();
    setPermission(result);
    setRequesting(false);
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <BellOff className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">Notifications Not Supported</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your browser doesn&apos;t support push notifications. Try using a modern browser like Chrome, Firefox, or Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Permission Status */}
      <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
        <div className="flex items-center gap-3">
          {permission === "granted" ? (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-500" />
            </div>
          ) : permission === "denied" ? (
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <BellOff className="w-5 h-5 text-red-500" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-yellow-500" />
            </div>
          )}
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted-foreground">
              {permission === "granted" && "Notifications are enabled"}
              {permission === "denied" && "Notifications are blocked"}
              {permission === "default" && "Enable notifications to stay updated"}
            </p>
          </div>
        </div>

        {permission === "default" && (
          <Button
            onClick={handleRequestPermission}
            disabled={requesting}
            size="sm"
          >
            {requesting ? "Requesting..." : "Enable"}
          </Button>
        )}

        {permission === "granted" && (
          <div className="flex items-center gap-1 text-green-500">
            <Check className="w-5 h-5" />
          </div>
        )}

        {permission === "denied" && (
          <div className="flex items-center gap-1 text-red-500">
            <X className="w-5 h-5" />
          </div>
        )}
      </div>

      {/* Instructions for denied permission */}
      {permission === "denied" && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="font-medium text-red-400 mb-2">Notifications Blocked</p>
          <p className="text-sm text-muted-foreground">
            You&apos;ve blocked notifications. To enable them:
          </p>
          <ol className="text-sm text-muted-foreground mt-2 space-y-1 list-decimal list-inside">
            <li>Click the lock/info icon in your browser&apos;s address bar</li>
            <li>Find &quot;Notifications&quot; in the permissions</li>
            <li>Select &quot;Allow&quot; and refresh the page</li>
          </ol>
        </div>
      )}

      {/* Notification Types (only shown when granted) */}
      {permission === "granted" && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Notify me about:</p>

          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <p className="font-medium">New Episodes</p>
              <p className="text-xs text-muted-foreground">When a new episode of anime in your watchlist airs</p>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded" defaultChecked />
          </label>

          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <p className="font-medium">Airing Reminders</p>
              <p className="text-xs text-muted-foreground">30 minutes before your favorite anime airs</p>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded" />
          </label>

          <label className="flex items-center justify-between p-3 bg-white/5 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
            <div>
              <p className="font-medium">Recommendations</p>
              <p className="text-xs text-muted-foreground">New anime we think you&apos;ll like based on your history</p>
            </div>
            <input type="checkbox" className="w-5 h-5 rounded" />
          </label>
        </div>
      )}

      {/* Test Notification (only when granted) */}
      {permission === "granted" && (
        <Button
          variant="glass"
          onClick={() => {
            if (typeof window !== "undefined" && "Notification" in window) {
              new Notification("AnimeVerse", {
                body: "Test notification! You're all set up.",
                icon: "/icon-192x192.png",
              });
            }
          }}
          className="w-full"
        >
          Test Notification
        </Button>
      )}
    </div>
  );
}
