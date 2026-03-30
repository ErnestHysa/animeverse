"use client";

import { useState, useEffect } from "react";
import { Zap } from "lucide-react";

interface AiringCountdownProps {
  episode: number;
  airingAt: number; // Unix timestamp (seconds)
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Airing now";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function AiringCountdown({ episode, airingAt }: AiringCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor(airingAt - Date.now() / 1000))
  );

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.floor(airingAt - Date.now() / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [airingAt]);

  const isImminent = secondsLeft < 3600; // < 1 hour

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        isImminent
          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
          : "bg-primary/10 text-primary border border-primary/20"
      }`}
    >
      <Zap className={`w-3.5 h-3.5 ${isImminent ? "animate-pulse" : ""}`} />
      <span>
        Ep {episode} in{" "}
        <span className="font-mono tabular-nums">{formatCountdown(secondsLeft)}</span>
      </span>
    </div>
  );
}
