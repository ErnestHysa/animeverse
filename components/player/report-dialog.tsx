/**
 * Report Broken Video Dialog
 * Allows users to report issues with video playback
 */

"use client";

import { useState } from "react";
import { Flag, X, Send, CheckCircle2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { reportBrokenVideo } from "@/lib/video-sources";

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  animeId?: number;
  animeTitle?: string;
  episodeNumber?: number;
}

const ISSUES = [
  { id: "video-not-loading", label: "Video not loading" },
  { id: "buffering", label: "Constant buffering" },
  { id: "wrong-episode", label: "Wrong episode" },
  { id: "audio-out-of-sync", label: "Audio out of sync" },
  { id: "poor-quality", label: "Poor video quality" },
  { id: "subtitles-missing", label: "Subtitles missing" },
  { id: "subtitles-wrong", label: "Subtitles incorrect" },
  { id: "other", label: "Other issue" },
];

export function ReportDialog({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  episodeNumber,
}: ReportDialogProps) {
  const [selectedIssue, setSelectedIssue] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedIssue) {
      toast.error("Please select an issue");
      return;
    }

    setIsSubmitting(true);

    try {
      await reportBrokenVideo({
        animeId: animeId || 0,
        episodeNumber: episodeNumber || 0,
        source: "main",
        issue: selectedIssue,
      });

      setSubmitted(true);
      toast.success("Report submitted. Thank you!");

      // Reset after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (error) {
      toast.error("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedIssue("");
    setDescription("");
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <GlassCard className="max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Report Issue</h2>
              <p className="text-sm text-muted-foreground">
                {animeTitle} - Episode {episodeNumber}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-medium mb-2">Report Submitted!</h3>
              <p className="text-sm text-muted-foreground">
                Thank you for helping us improve our service.
              </p>
            </div>
          ) : (
            <>
              {/* Issue Selection */}
              <div className="mb-6">
                <label className="text-sm font-medium mb-3 block">
                  What issue are you experiencing?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {ISSUES.map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => setSelectedIssue(issue.id)}
                      className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        selectedIssue === issue.id
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-white/5 hover:bg-white/10 border border-transparent"
                      }`}
                    >
                      {issue.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  Additional details (optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in more detail..."
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-red-500/50 resize-none"
                  rows={3}
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!selectedIssue || isSubmitting}
                className="w-full bg-red-500 hover:bg-red-600 text-white"
              >
                {isSubmitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Report
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

/**
 * Report Button
 * Triggers the report dialog
 */
interface ReportButtonProps {
  animeId?: number;
  animeTitle?: string;
  episodeNumber?: number;
}

export function ReportButton({ animeId, animeTitle, episodeNumber }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
        title="Report broken video"
      >
        <Flag className="w-5 h-5" />
      </button>
      <ReportDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        animeId={animeId}
        animeTitle={animeTitle}
        episodeNumber={episodeNumber}
      />
    </>
  );
}
