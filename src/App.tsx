import { useState, useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { DetailPanel } from "./components/DetailPanel";
import { Settings } from "./components/Settings";
import { useSkills } from "./hooks/useSkills";
import { useSettings } from "./hooks/useSettings";
import { useFavorites } from "./hooks/useFavorites";
import { Selection } from "./types/skill";

function App() {
  const { skills, repos, loading, error, refresh } = useSkills();
  const { settings } = useSettings();
  const { favorites, toggleSkillFavorite, toggleRepoFavorite, isSkillFavorite, isRepoFavorite } = useFavorites();
  const [selection, setSelection] = useState<Selection>({ type: "none" });
  const [showSettings, setShowSettings] = useState(false);

  // Sync selection with updated skills data (e.g., after install/uninstall)
  useEffect(() => {
    if (selection.type === "skill") {
      const updatedSkill = skills.find(s => s.id === selection.skill.id);
      if (updatedSkill && updatedSkill.isInstalled !== selection.skill.isInstalled) {
        setSelection({ type: "skill", skill: updatedSkill });
      }
    } else if (selection.type === "repo") {
      const updatedRepo = repos.find(r =>
        r.owner === selection.repo.owner && r.repo === selection.repo.repo
      );
      if (updatedRepo) {
        const repoSkills = skills.filter(s =>
          s.owner === selection.repo.owner && s.repo === selection.repo.repo
        );
        setSelection({
          type: "repo",
          repo: { ...selection.repo, skills: repoSkills, isFetched: updatedRepo.isFetched }
        });
      }
    }
  }, [skills, repos]);

  return (
    <div className="h-screen flex bg-[var(--bg-primary)]">
      {/* Sidebar */}
      <Sidebar
        skills={skills}
        repos={repos}
        loading={loading}
        error={error}
        selection={selection}
        onSelectionChange={setSelection}
        onRefresh={refresh}
        onOpenSettings={() => setShowSettings(true)}
        favorites={favorites}
        onToggleRepoFavorite={toggleRepoFavorite}
        onToggleSkillFavorite={toggleSkillFavorite}
        isRepoFavorite={isRepoFavorite}
        isSkillFavorite={isSkillFavorite}
      />

      {/* Main Content */}
      <DetailPanel
        selection={selection}
        skills={skills}
        installMethod={settings.installMethod}
        onRefresh={refresh}
        onToggleSkillFavorite={toggleSkillFavorite}
        isSkillFavorite={isSkillFavorite}
      />

      {/* Settings Modal */}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
