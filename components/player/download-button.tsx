/**
 * Download Button Component
 * Handles offline video downloads
 */

"use client";

import { useState, useEffect } from "react";
import { Download, Check, X, Trash2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import { downloadManager, formatBytes, isVideoDownloaded } from "@/lib/downloads";
import { toast } from "react-hot-toast";

interface DownloadButtonProps {
  animeId: number;
  animeTitle: string;
  episodeNumber: number;
  videoUrl: string;
  thumbnailUrl?: string;
}

export function DownloadButton({
  animeId,
  animeTitle,
  episodeNumber,
  videoUrl,
  thumbnailUrl,
}: DownloadButtonProps) {
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showManager, setShowManager] = useState(false);
  const [downloads, setDownloads] = useState<any[]>([]);
  const [storageSize, setStorageSize] = useState(0);

  useEffect(() => {
    checkDownloadStatus();
    loadDownloads();
  }, [animeId, episodeNumber]);

  const checkDownloadStatus = async () => {
    const downloaded = await isVideoDownloaded(animeId, episodeNumber);
    setIsDownloaded(downloaded);
  };

  const loadDownloads = async () => {
    try {
      const allDownloads = await downloadManager.getAllDownloads();
      setDownloads(allDownloads);
      const size = await downloadManager.getStorageSize();
      setStorageSize(size);
    } catch (error) {
      console.error("Failed to load downloads:", error);
    }
  };

  const handleDownload = async () => {
    if (isDownloaded) {
      setShowManager(true);
      return;
    }

    setIsDownloading(true);
    setProgress(0);

    try {
      // For HLS streams, use direct browser download for better progress
      const isHLS = videoUrl.includes('.m3u8');

      if (isHLS) {
        // Use the proxy API and trigger browser download
        const proxyUrl = new URL('/api/download-hls', window.location.origin);
        proxyUrl.searchParams.set('url', videoUrl);
        proxyUrl.searchParams.set('title', animeTitle);
        proxyUrl.searchParams.set('episode', episodeNumber.toString());

        // Create a direct download link
        const link = document.createElement('a');
        link.href = proxyUrl.toString();
        link.download = `${animeTitle.replace(/[^a-z0-9]/gi, '_')}_EP${episodeNumber}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("Download started! Check your browser's download manager.");

        // Mark as "downloading" in background but don't wait
        downloadManager.addDownload({
          id: `${animeId}-${episodeNumber}`,
          animeId,
          animeTitle,
          episodeNumber,
          videoUrl,
          thumbnailUrl,
          size: 0,
          downloadedAt: Date.now(),
        }).catch(() => {});

        setIsDownloaded(true); // Show as downloaded
      } else {
        // For direct videos, use the cache manager with progress
        await downloadManager.downloadVideo(
          animeId,
          animeTitle,
          episodeNumber,
          videoUrl,
          thumbnailUrl,
          (prog) => setProgress(prog)
        );

        setIsDownloaded(true);
        toast.success("Episode downloaded for offline viewing!");
        await loadDownloads();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download episode");
      console.error(error);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await downloadManager.deleteDownload(id);
      toast.success("Download removed");
      await loadDownloads();
      await checkDownloadStatus();
    } catch (error) {
      toast.error("Failed to remove download");
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to delete all downloads?")) return;
    
    try {
      await downloadManager.clearAllDownloads();
      toast.success("All downloads cleared");
      await loadDownloads();
      await checkDownloadStatus();
    } catch (error) {
      toast.error("Failed to clear downloads");
    }
  };

  return (
    <>
      <Button
        variant="glass"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        className="relative"
      >
        {isDownloading ? (
          <>
            <Download className="w-4 h-4 mr-2 animate-pulse" />
            {progress}%
          </>
        ) : isDownloaded ? (
          <>
            <Check className="w-4 h-4 mr-2 text-green-400" />
            Downloaded
          </>
        ) : (
          <>
            <Download className="w-4 h-4 mr-2" />
            Download
          </>
        )}
      </Button>

      {showManager && (
        <DownloadManager
          downloads={downloads}
          storageSize={storageSize}
          onClose={() => setShowManager(false)}
          onDelete={handleDelete}
          onClearAll={handleClearAll}
        />
      )}
    </>
  );
}

interface DownloadManagerProps {
  downloads: any[];
  storageSize: number;
  onClose: () => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

function DownloadManager({
  downloads,
  storageSize,
  onClose,
  onDelete,
  onClearAll,
}: DownloadManagerProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <GlassCard className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Offline Downloads</h2>
              <p className="text-sm text-muted-foreground">
                {downloads.length} episodes • {formatBytes(storageSize)} used
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
        <div className="flex-1 overflow-y-auto p-6">
          {downloads.length === 0 ? (
            <div className="text-center py-12">
              <Download className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No Downloads Yet</h3>
              <p className="text-sm text-muted-foreground">
                Download episodes to watch them offline
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {downloads.map((download) => (
                <div
                  key={download.id}
                  className="flex items-center gap-4 p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{download.animeTitle}</h4>
                    <p className="text-sm text-muted-foreground">
                      Episode {download.episodeNumber} • {formatBytes(download.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {download.status === "completed" && (
                      <Check className="w-5 h-5 text-green-400" />
                    )}
                    <button
                      onClick={() => onDelete(download.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Remove download"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {downloads.length > 0 && (
          <div className="p-6 border-t border-white/10">
            <button
              onClick={onClearAll}
              className="w-full px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
            >
              Clear All Downloads
            </button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
