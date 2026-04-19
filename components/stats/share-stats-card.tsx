"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Share2, Download, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

// Polyfill roundRect at module level so it only runs once
if (typeof CanvasRenderingContext2D !== "undefined" && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x: number, y: number, w: number, h: number, radii: number | number[]) {
    const r = typeof radii === "number" ? radii : Array.isArray(radii) ? radii[0] : 0;
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}

interface ShareStatsCardProps {
  totalEpisodes: number;
  totalHours: number;
  uniqueAnime: number;
  topGenre: string;
  completionRate: number;
  year?: number;
}

/**
 * Generates a shareable "Anime Year in Review" image via Canvas
 * and provides download / copy-to-clipboard options.
 */
export function ShareStatsCard({
  totalEpisodes,
  totalHours,
  uniqueAnime,
  topGenre,
  completionRate,
  year = new Date().getFullYear(),
}: ShareStatsCardProps) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const copiedTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Cleanup copied timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);
  function getCanvas(): HTMLCanvasElement {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    return canvasRef.current;
  }

  const generateCard = useCallback((): string => {
    const canvas = getCanvas();
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext("2d")!;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 600, 360);
    grad.addColorStop(0, "#0f0c29");
    grad.addColorStop(0.5, "#302b63");
    grad.addColorStop(1, "#24243e");
    ctx.fillStyle = grad;
    ctx.roundRect(0, 0, 600, 360, 20);
    ctx.fill();

    // Accent bar top
    const accent = ctx.createLinearGradient(0, 0, 600, 0);
    accent.addColorStop(0, "#7c3aed");
    accent.addColorStop(1, "#db2777");
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 600, 4);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 28px -apple-system, system-ui, sans-serif";
    ctx.fillText("AnimeVerse", 40, 60);
    ctx.fillStyle = "#a78bfa";
    ctx.font = "16px -apple-system, system-ui, sans-serif";
    ctx.fillText(`${year} Anime Recap`, 40, 85);

    // Stats grid (2×2)
    const stats = [
      { label: "Episodes Watched", value: totalEpisodes.toLocaleString() },
      { label: "Hours Streaming", value: totalHours.toLocaleString() },
      { label: "Series Explored", value: uniqueAnime.toLocaleString() },
      { label: "Completion Rate", value: `${completionRate}%` },
    ];

    stats.forEach((stat, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 40 + col * 270;
      const y = 130 + row * 100;

      // Card bg
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(x, y, 230, 75, 12);
      ctx.fill();

      // Value
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 30px -apple-system, system-ui, sans-serif";
      ctx.fillText(stat.value, x + 16, y + 42);

      // Label
      ctx.fillStyle = "#94a3b8";
      ctx.font = "13px -apple-system, system-ui, sans-serif";
      ctx.fillText(stat.label, x + 16, y + 62);
    });

    // Top genre pill
    if (topGenre) {
      const pillGrad = ctx.createLinearGradient(40, 340, 200, 340);
      pillGrad.addColorStop(0, "#7c3aed");
      pillGrad.addColorStop(1, "#db2777");
      ctx.fillStyle = pillGrad;
      ctx.beginPath();
      ctx.roundRect(40, 330, 200, 24, 12);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px -apple-system, system-ui, sans-serif";
      ctx.fillText(`Top Genre: ${topGenre}`, 55, 347);
    }

    // Watermark
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "12px -apple-system, system-ui, sans-serif";
    ctx.fillText("animeverse.app", 500, 345);

    return canvas.toDataURL("image/png");
  }, [totalEpisodes, totalHours, uniqueAnime, topGenre, completionRate, year]);

  const handleDownload = () => {
    const dataUrl = generateCard();
    if (!dataUrl || dataUrl === "data:,") {
      toast.error("Failed to generate image");
      return;
    }
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `animeverse-${year}-recap.png`;
    a.click();
    toast.success("Stats card downloaded!");
  };

  const handleCopy = async () => {
    try {
      const dataUrl = generateCard();
      if (!dataUrl || dataUrl === "data:,") {
        toast.error("Failed to generate image");
        return;
      }
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied(true);
      toast.success("Copied to clipboard!");
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — try Download instead");
    }
  };

  const handleShare = async () => {
    const dataUrl = generateCard();
    if (!dataUrl || dataUrl === "data:,") {
      toast.error("Failed to generate image");
      return;
    }
    if (navigator.share) {
      try {
        const res = await fetch(dataUrl);
        const blob = await res.blob();
        const file = new File([blob], `animeverse-${year}-recap.png`, { type: "image/png" });
        await navigator.share({ files: [file], title: `My ${year} AnimeVerse Recap` });
        return;
      } catch {
        // fall through to modal
      }
    }
    setOpen(true);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="flex items-center gap-2"
      >
        <Share2 className="w-4 h-4" />
        Share Stats
      </Button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-card border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Share Your {year} Recap</h3>
            <p className="text-sm text-muted-foreground">
              Download or copy your anime stats card to share on social media.
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="outline" className="flex-1" onClick={handleCopy}>
                {copied ? (
                  <Check className="w-4 h-4 mr-2 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
            <button
              className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
