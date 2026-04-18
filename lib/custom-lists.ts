/**
 * Custom Lists Feature
 * Users can create unlimited custom lists beyond favorites/watchlist
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface CustomList {
  id: string;
  name: string;
  description: string;
  emoji: string;
  animeIds: number[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

interface CustomListsState {
  lists: CustomList[];
  addList: (list: Omit<CustomList, "id" | "createdAt" | "updatedAt">) => void;
  updateList: (id: string, updates: Partial<CustomList>) => void;
  deleteList: (id: string) => void;
  addAnimeToList: (listId: string, animeId: number) => void;
  removeAnimeFromList: (listId: string, animeId: number) => void;
  getList: (id: string) => CustomList | undefined;
}

export const useCustomLists = create<CustomListsState>()(
  persist(
    (set, get) => ({
      lists: [],

      addList: (listData) => {
        const newList: CustomList = {
          ...listData,
          id: typeof crypto !== 'undefined' && crypto.randomUUID
            ? `list-${crypto.randomUUID()}`
            : `list-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          lists: [...state.lists, newList],
        }));
      },

      updateList: (id, updates) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === id
              ? { ...list, ...updates, updatedAt: Date.now() }
              : list
          ),
        }));
      },

      deleteList: (id) => {
        set((state) => ({
          lists: state.lists.filter((list) => list.id !== id),
        }));
      },

      addAnimeToList: (listId, animeId) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId && !list.animeIds.includes(animeId)
              ? {
                  ...list,
                  animeIds: [...list.animeIds, animeId],
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      removeAnimeFromList: (listId, animeId) => {
        set((state) => ({
          lists: state.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  animeIds: list.animeIds.filter((id) => id !== animeId),
                  updatedAt: Date.now(),
                }
              : list
          ),
        }));
      },

      getList: (id) => {
        return get().lists.find((list) => list.id === id);
      },
    }),
    {
      name: "animeverse-custom-lists",
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          try {
            if (typeof window === "undefined") return null;
            const item = localStorage.getItem(name);
            return item ? JSON.parse(item) : null;
          } catch (error) {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            if (typeof window === "undefined") return;
            localStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            console.error("Failed to save custom lists:", error);
          }
        },
        removeItem: (name) => {
          try {
            if (typeof window === "undefined") return;
            localStorage.removeItem(name);
          } catch (error) {
            console.error("Failed to remove custom lists:", error);
          }
        },
      })),
    }
  )
);
