/**
 * Custom Lists Page
 * Users can create and manage unlimited custom anime lists
 */

"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, X, Check, Star, Heart, Flame } from "lucide-react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { useCustomLists, type CustomList } from "@/lib/custom-lists";
import { useStore } from "@/store";
import { AnimeCard } from "@/components/anime/anime-card";
import { toast } from "react-hot-toast";
import Link from "next/link";

const LIST_EMOJIS = ["📚", "🌟", "🔥", "💎", "🎯", "⚔️", "🌸", "🎌", "🏆", "🎬", "📺", "🎭", "🎪", "🌈"];

export default function CustomListsPage() {
  const { lists, addList, updateList, deleteList, addAnimeToList, removeAnimeFromList } = useCustomLists();
  const mediaCache = useStore((s) => s.mediaCache);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingList, setEditingList] = useState<CustomList | null>(null);
  const [ newListName, setNewListName] = useState("");
  const [newListDesc, setNewListDesc] = useState("");
  const [newListEmoji, setNewListEmoji] = useState("📚");
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ msg: string; onConfirm: () => void } | null>(null);

  const handleCreateList = () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    addList({
      name: newListName.trim(),
      description: newListDesc.trim(),
      emoji: newListEmoji,
      animeIds: [],
      isPublic: false,
    });

    setNewListName("");
    setNewListDesc("");
    setNewListEmoji("📚");
    setShowCreateForm(false);
    toast.success("List created!");
  };

  const handleDeleteList = (id: string, name: string) => {
    setConfirmDialog({
      msg: `Delete "${name}"?`,
      onConfirm: () => {
        deleteList(id);
        toast.success("List deleted");
      },
    });
  };

  const handleAddToList = (listId: string, animeId: number) => {
    addAnimeToList(listId, animeId);
    toast.success("Added to list!");
  };

  const handleRemoveFromList = (listId: string, animeId: number) => {
    removeAnimeFromList(listId, animeId);
  };

  const selectedList = selectedListId ? lists.find((l) => l.id === selectedListId) : null;

  // Sort lists by updatedAt (most recently modified first)
  const sortedLists = [...lists].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <>
      <Header />
      <main className="min-h-screen">
        <div className="container mx-auto px-4 pt-24 pb-12">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-display font-bold mb-2">My Lists</h1>
              <p className="text-muted-foreground">
                {lists.length === 0
                  ? "Create custom lists to organize your anime"
                  : `${lists.length} custom list${lists.length > 1 ? "s" : ""}`}
              </p>
            </div>
            <Button onClick={() => setShowCreateForm(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create New List
            </Button>
          </div>

          {/* Create List Form */}
          {showCreateForm && (
            <GlassCard className="max-w-2xl mx-auto p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Create New List</h2>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">List Name *</label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    placeholder="e.g., Summer 2024 Favorites"
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={newListDesc}
                    onChange={(e) => setNewListDesc(e.target.value)}
                    placeholder="What's this list about?"
                    rows={2}
                    className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Choose an Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {LIST_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setNewListEmoji(emoji)}
                        className={`w-10 h-10 text-xl rounded-lg transition-all ${
                          newListEmoji === emoji
                            ? "bg-primary ring-2 ring-primary/50"
                            : "bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <Button onClick={handleCreateList} className="w-full">
                  Create List
                </Button>
              </div>
            </GlassCard>
          )}

          {/* Lists Grid */}
          {lists.length === 0 ? (
            <GlassCard className="max-w-2xl mx-auto p-12 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
                <Plus className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-bold mb-3">No Custom Lists Yet</h2>
              <p className="text-muted-foreground mb-6">
                Create custom lists to organize your anime by genre, mood, season, or whatever you like!
              </p>
              <Button onClick={() => setShowCreateForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First List
              </Button>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* List Cards */}
              <div className="space-y-4">
                {sortedLists.map((list) => (
                  <GlassCard
                    key={list.id}
                    className={`p-6 cursor-pointer transition-all hover:bg-white/5 ${
                      selectedListId === list.id ? "ring-2 ring-primary" : ""
                    }`}
                    onClick={() => setSelectedListId(selectedListId === list.id ? null : list.id)}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{list.emoji}</span>
                        <div>
                          <h3 className="font-semibold text-lg">{list.name}</h3>
                          {list.description && (
                            <p className="text-sm text-muted-foreground">{list.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteList(list.id, list.name);
                          }}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        {list.animeIds.length} anime
                      </span>
                      <span>
                        Updated {new Date(list.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </GlassCard>
                ))}
              </div>

              {/* Selected List Detail */}
              {selectedList && selectedListId && (
                <div className="md:col-span-2 lg:col-span-2">
                  <GlassCard className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <span className="text-4xl">{selectedList.emoji}</span>
                        <div>
                          <h2 className="text-2xl font-bold">{selectedList.name}</h2>
                          {selectedList.description && (
                            <p className="text-muted-foreground">{selectedList.description}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedListId(null)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {selectedList.animeIds.length === 0 ? (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground mb-4">
                          This list is empty. Add anime from your favorites or browse to discover new ones!
                        </p>
                        <div className="flex gap-3 justify-center">
                          <Link href="/favorites">
                            <Button variant="outline">
                              <Heart className="w-4 h-4 mr-2" />
                              From Favorites
                            </Button>
                          </Link>
                          <Link href="/">
                            <Button>
                              <Flame className="w-4 h-4 mr-2" />
                              Browse Anime
                            </Button>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {selectedList.animeIds.map((animeId) => {
                          const anime = mediaCache[animeId];
                          if (!anime) return null;

                          return (
                            <div key={animeId} className="group relative">
                              <AnimeCard anime={anime} />
                              <button
                                onClick={() => handleRemoveFromList(selectedList.id, animeId)}
                                className="absolute top-2 right-2 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Remove from list"
                              >
                                <X className="w-3 h-3 text-white" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </GlassCard>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            <p className="text-white mb-4">{confirmDialog.msg}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
