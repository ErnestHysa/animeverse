/**
 * Batch Operations Component
 * Allows bulk actions on favorites, watchlist, and custom lists
 */

"use client";

import { useState } from "react";
import { useStore } from "@/store";
import { useCustomLists } from "@/lib/custom-lists";
import {
  Heart,
  Clock,
  List as ListIcon,
  Trash2,
  Plus,
  X,
  Check,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

interface BatchOperationsProps {
  className?: string;
}

export function BatchOperations({ className = "" }: BatchOperationsProps) {
  const { favorites, toggleFavorite, clearFavorites, watchlist, toggleWatchlist, clearWatchlist } = useStore();
  const { lists, addAnimeToList } = useCustomLists();
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState<"favorites" | "watchlist" | null>(null);
  const [showAddToList, setShowAddToList] = useState(false);

  const items = selectionMode === "favorites" ? favorites : selectionMode === "watchlist" ? watchlist : [];

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedItems(newSelection);
  };

  const selectAll = () => {
    setSelectedItems(new Set(items));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const removeSelected = async () => {
    if (selectionMode === "favorites") {
      for (const id of selectedItems) {
        toggleFavorite(id);
      }
      toast.success(`Removed ${selectedItems.size} anime from favorites`);
    } else if (selectionMode === "watchlist") {
      for (const id of selectedItems) {
        toggleWatchlist(id);
      }
      toast.success(`Removed ${selectedItems.size} anime from watchlist`);
    }
    setSelectedItems(new Set());
  };

  const addSelectedToList = async (listId: string) => {
    const list = lists.find((l) => l.id === listId);
    if (!list) return;

    let added = 0;
    for (const id of selectedItems) {
      if (!list.animeIds.includes(id)) {
        addAnimeToList(listId, id);
        added++;
      }
    }

    toast.success(`Added ${added} anime to "${list.name}"`);
    setShowAddToList(false);
    setSelectedItems(new Set());
  };

  if (!selectionMode) {
    return (
      <div className={`space-y-4 ${className}`}>
        <h2 className="text-xl font-semibold">Batch Operations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <GlassCard
            className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setSelectionMode("favorites")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-500/20">
                <Heart className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Favorites</h3>
                <p className="text-sm text-muted-foreground">{favorites.length} favorites</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard
            className="p-6 cursor-pointer hover:bg-white/5 transition-colors"
            onClick={() => setSelectionMode("watchlist")}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <Clock className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Watchlist</h3>
                <p className="text-sm text-muted-foreground">{watchlist.length} anime</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectionMode(null);
              setSelectedItems(new Set());
            }}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-semibold">
            {selectionMode === "favorites" ? "Manage Favorites" : "Manage Watchlist"}
          </h2>
          <span className="text-sm text-muted-foreground">
            {selectedItems.size} of {items.length} selected
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedItems.size > 0 && (
            <>
              <Button
                size="sm"
                variant="glass"
                onClick={() => setShowAddToList(!showAddToList)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add to List
              </Button>
              <Button
                size="sm"
                variant="glass"
                onClick={removeSelected}
                className="text-red-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Remove
              </Button>
            </>
          )}
          <Button size="sm" variant="glass" onClick={selectAll}>
            Select All
          </Button>
          <Button size="sm" variant="glass" onClick={clearSelection}>
            Clear
          </Button>
        </div>
      </div>

      {/* Add to List Dropdown */}
      {showAddToList && selectedItems.size > 0 && (
        <GlassCard className="p-4">
          <h3 className="font-medium mb-3">Add {selectedItems.size} anime to:</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {lists.map((list) => (
              <button
                key={list.id}
                onClick={() => addSelectedToList(list.id)}
                className="flex items-center gap-2 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
              >
                <span className="text-xl">{list.emoji}</span>
                <span className="text-sm truncate">{list.name}</span>
              </button>
            ))}
            {lists.length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-4">
                No custom lists. Create one first!
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* Items Grid */}
      {items.length === 0 ? (
        <GlassCard className="p-8 text-center">
          <p className="text-muted-foreground">
            {selectionMode === "favorites" ? "No favorites yet" : "Your watchlist is empty"}
          </p>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {items.map((id) => {
            const isSelected = selectedItems.has(id);
            return (
              <div
                key={id}
                className="relative group cursor-pointer"
                onClick={() => toggleSelection(id)}
              >
                <div
                  className={`aspect-[3/4] rounded-lg overflow-hidden bg-muted transition-all ${
                    isSelected ? "ring-2 ring-primary" : ""
                  }`}
                >
                  {/* Placeholder for anime cover - in real implementation, would fetch from mediaCache */}
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-2xl font-bold text-primary/50">{id}</span>
                  </div>
                </div>

                {/* Selection Checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
