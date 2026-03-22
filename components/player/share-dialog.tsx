/**
 * Share Dialog Component
 * Share anime episodes on social media
 */

"use client";

import { useState, useMemo } from "react";
import { Share2, X, Check, Link as LinkIcon, Facebook, Twitter, MessageCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  url: string;
  episode?: number;
}

const PLATFORMS = [
  {
    id: "twitter",
    name: "Twitter",
    icon: Twitter,
    color: "hover:bg-[#1DA1F2]/20 hover:text-[#1DA1F2]",
    getShareUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Watching ${title}`)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: Facebook,
    color: "hover:bg-[#4267B2]/20 hover:text-[#4267B2]",
    getShareUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    icon: MessageCircle,
    color: "hover:bg-[#25D366]/20 hover:text-[#25D366]",
    getShareUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} - ${url}`)}`,
  },
  {
    id: "copy",
    name: "Copy Link",
    icon: LinkIcon,
    color: "",
    getShareUrl: () => "",
  },
];

export function ShareDialog({ isOpen, onClose, title, url, episode }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  // Derive shareUrl from props instead of using state + effect
  const shareUrl = useMemo(() => url, [url]);

  if (!isOpen) return null;

  const handleShare = async (platform: typeof PLATFORMS[0]) => {
    if (platform.id === "copy") {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        toast.success("Link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        toast.error("Failed to copy link to clipboard");
      }
      return;
    }

    const platformUrl = platform.getShareUrl(shareUrl, title);
    window.open(platformUrl, "_blank", "width=600,height=400");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url: shareUrl,
        });
        onClose();
      } catch (error) {
        // Silently handle share errors - browser may not support sharing
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <GlassCard className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Share</h2>
              <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                {title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Native Share */}
          {typeof navigator.share !== "undefined" && (
            <Button
              onClick={handleNativeShare}
              variant="default"
              className="w-full mb-4"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share...
            </Button>
          )}

          {/* Platforms */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {PLATFORMS.map((platform) => {
              const Icon = platform.icon;
              return (
                <button
                  key={platform.id}
                  onClick={() => handleShare(platform)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-lg bg-white/5 transition-colors ${platform.color}`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs">
                    {platform.id === "copy" && copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      platform.name
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* URL Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm"
              />
              <Button
                onClick={() => handleShare(PLATFORMS[3]!)}
                variant="outline"
                size="icon"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <LinkIcon className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/**
 * Share Button
 * Triggers the share dialog
 */
interface ShareButtonProps {
  title: string;
  url?: string;
  episode?: number;
}

export function ShareButton({ title, url, episode }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get current URL if not provided
  const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        title="Share"
      >
        <Share2 className="w-5 h-5" />
      </button>
      <ShareDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
        url={shareUrl}
        episode={episode}
      />
    </>
  );
}
