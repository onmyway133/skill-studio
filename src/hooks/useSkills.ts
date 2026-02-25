import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Skill, RepoInfo } from "../types/skill";

export function useSkills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [repos, setRepos] = useState<RepoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [skillsResult, reposResult] = await Promise.all([
        invoke<Skill[]>("get_all_skills"),
        invoke<RepoInfo[]>("get_all_repos"),
      ]);
      setSkills(skillsResult);
      setRepos(reposResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { skills, repos, loading, error, refresh: fetchData };
}
