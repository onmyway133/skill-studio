import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Favorites } from "../types/skill";

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorites>({ skills: [], repos: [] });
  const [loading, setLoading] = useState(true);

  const loadFavorites = useCallback(async () => {
    try {
      const data = await invoke<Favorites>("get_favorites");
      setFavorites(data);
    } catch (e) {
      console.error("Failed to load favorites:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleSkillFavorite = useCallback(async (skillId: string) => {
    try {
      const updated = await invoke<Favorites>("toggle_favorite_skill", { skillId });
      setFavorites(updated);
    } catch (e) {
      console.error("Failed to toggle skill favorite:", e);
    }
  }, []);

  const toggleRepoFavorite = useCallback(async (repoKey: string) => {
    try {
      const updated = await invoke<Favorites>("toggle_favorite_repo", { repoKey });
      setFavorites(updated);
    } catch (e) {
      console.error("Failed to toggle repo favorite:", e);
    }
  }, []);

  const isSkillFavorite = useCallback((skillId: string) => {
    return favorites.skills.includes(skillId);
  }, [favorites.skills]);

  const isRepoFavorite = useCallback((repoKey: string) => {
    return favorites.repos.includes(repoKey);
  }, [favorites.repos]);

  return {
    favorites,
    loading,
    toggleSkillFavorite,
    toggleRepoFavorite,
    isSkillFavorite,
    isRepoFavorite,
    refresh: loadFavorites,
  };
}
