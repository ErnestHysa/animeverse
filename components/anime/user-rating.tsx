/**
 * User Rating Component
 * Star/number rating for anime with optional review text
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Star, X, Check, Edit2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";
import { getRating, setRating, removeRating, type AnimeRating } from "@/lib/ratings";
import { cn } from "@/lib/utils";

interface UserRatingProps {
  animeId: number;
  animeTitle?: string;
  compact?: boolean;
}

export function UserRating({ animeId, animeTitle, compact = false }: UserRatingProps) {
  const [rating, setRatingState] = useState<AnimeRating | null>(null);
  const [hoveredScore, setHoveredScore] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [pendingScore, setPendingScore] = useState<number | null>(null);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    const saved = getRating(animeId);
    if (saved) {
      setRatingState(saved);
      setReviewText(saved.review ?? "");
    }
  }, [animeId]);

  const handleScoreClick = useCallback((score: number) => {
    if (isSubmittingRef.current) return;
    if (!editMode && !rating) {
      setPendingScore(score);
      setEditMode(true);
    } else {
      setPendingScore(score);
    }
  }, [animeId, editMode, rating]);

  const handleSave = useCallback(() => {
    const score = pendingScore ?? rating?.score ?? 7;
    const saved = setRating(animeId, score, reviewText.trim() || undefined);
    setRatingState(saved);
    setPendingScore(null);
    setEditMode(false);
    toast.success(`Rating saved: ${score}/10`);
  }, [animeId, pendingScore, rating, reviewText]);

  const handleRemove = useCallback(() => {
    removeRating(animeId);
    setRatingState(null);
    setPendingScore(null);
    setReviewText("");
    setEditMode(false);
    toast.success("Rating removed");
  }, [animeId]);

  const displayScore = hoveredScore ?? pendingScore ?? rating?.score ?? null;

  const scoreLabels: Record<number, string> = {
    1: "Appalling", 2: "Horrible", 3: "Very Bad", 4: "Bad",
    5: "Average", 6: "Fine", 7: "Good", 8: "Very Good",
    9: "Great", 10: "Masterpiece",
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {rating ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm font-medium">
            <Star className="w-3.5 h-3.5 fill-yellow-400" />
            <span>My Score: {rating.score}/10</span>
          </div>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground rounded-lg text-sm transition-colors"
          >
            <Star className="w-3.5 h-3.5" />
            <span>Rate</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400" />
          Your Rating
        </h3>
        {rating && !editMode && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { setEditMode(true); setPendingScore(rating.score); }}
              className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              title="Edit rating"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleRemove}
              className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-muted-foreground hover:text-red-400"
              title="Remove rating"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Score Grid - 1 to 10 */}
      <div className="flex flex-wrap gap-1 mb-2" role="radiogroup" aria-label="Rating">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => {
          const isActive = displayScore !== null && score <= displayScore;
          return (
            <button
              key={score}
              onClick={() => handleScoreClick(score)}
              onMouseEnter={() => setHoveredScore(score)}
              onMouseLeave={() => setHoveredScore(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleScoreClick(score);
                }
              }}
              aria-label={`Rate ${score} out of 10`}
              role="radio"
              aria-checked={rating?.score === score}
              tabIndex={0}
              className={cn(
                "w-7 h-7 rounded text-xs font-bold transition-all",
                isActive
                  ? "bg-yellow-500 text-black scale-110"
                  : "bg-white/10 hover:bg-yellow-500/30 text-muted-foreground"
              )}
            >
              {score}
            </button>
          );
        })}
      </div>

      {/* Score label */}
      {displayScore && (
        <p className="text-xs text-yellow-400 font-medium mb-3">
          {displayScore}/10 — {scoreLabels[displayScore]}
        </p>
      )}

      {/* Review text input (edit mode or no rating yet) */}
      {(editMode || (!rating && pendingScore)) && (
        <div className="space-y-2 mt-3">
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Write a short review (optional)..."
            rows={3}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm resize-none focus:outline-none focus:border-primary"
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditMode(false); setPendingScore(null); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!pendingScore && !rating}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Show review if saved */}
      {rating?.review && !editMode && (
        <p className="text-sm text-muted-foreground mt-2 italic line-clamp-3">
          &ldquo;{rating.review}&rdquo;
        </p>
      )}

      {/* Prompt to rate */}
      {!rating && !pendingScore && !editMode && (
        <p className="text-xs text-muted-foreground">
          Click a score above to rate this anime
        </p>
      )}
    </GlassCard>
  );
}
