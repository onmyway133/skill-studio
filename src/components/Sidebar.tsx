import { useState, useMemo, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Search,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderGit2,
  Sparkles,
  Check,
  Download,
  RefreshCw,
  Plus,
  X,
  Star,
  Trash2,
} from "lucide-react";
import { Skill, RepoInfo, RepoGroup, Selection, Favorites } from "../types/skill";

interface ContextMenuState {
  x: number;
  y: number;
  type: "repo" | "skill";
  repoKey?: string;
  isCustomRepo?: boolean;
  skillId?: string;
}

interface SidebarProps {
  skills: Skill[];
  repos: RepoInfo[];
  loading: boolean;
  error: string | null;
  selection: Selection;
  onSelectionChange: (selection: Selection) => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  favorites: Favorites;
  onToggleRepoFavorite: (repoKey: string) => void;
  onToggleSkillFavorite: (skillId: string) => void;
  isRepoFavorite: (repoKey: string) => boolean;
  isSkillFavorite: (skillId: string) => boolean;
}

type FilterType = "all" | "fetched" | "installed";

export function Sidebar({
  skills,
  repos,
  loading,
  error,
  selection,
  onSelectionChange,
  onRefresh,
  onOpenSettings,
  onToggleRepoFavorite,
  onToggleSkillFavorite,
  isRepoFavorite,
  isSkillFavorite,
}: SidebarProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [skillsExpanded, setSkillsExpanded] = useState(true);
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRepoContextMenu = (e: React.MouseEvent, repoKey: string, isCustom: boolean) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "repo", repoKey, isCustomRepo: isCustom });
  };

  const handleSkillContextMenu = (e: React.MouseEvent, skillId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "skill", skillId });
  };

  // Build repo groups from repos list and skills
  const repoGroups = useMemo((): RepoGroup[] => {
    return repos.map((repo) => {
      const repoSkills = skills.filter(
        (s) => s.owner === repo.owner && s.repo === repo.repo
      );
      return {
        owner: repo.owner,
        repo: repo.repo,
        skills: repoSkills,
        isFetched: repo.isFetched,
        isCustom: repo.isCustom,
      };
    });
  }, [repos, skills]);

  // Filter repos based on filter tabs
  const filteredRepoGroups = useMemo(() => {
    return repoGroups.filter((group) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "fetched" && group.isFetched) ||
        (filter === "installed" && group.skills.some(s => s.isInstalled));
      const matchesSearch =
        search === "" ||
        `${group.owner}/${group.repo}`.toLowerCase().includes(search.toLowerCase()) ||
        group.skills.some(s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.description.toLowerCase().includes(search.toLowerCase())
        );
      return matchesFilter && matchesSearch;
    });
  }, [repoGroups, filter, search]);

  const filteredSkills = useMemo(() => {
    return skills.filter((skill) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "fetched" && skill.isFetched) ||
        (filter === "installed" && skill.isInstalled);
      const matchesSearch =
        search === "" ||
        skill.name.toLowerCase().includes(search.toLowerCase()) ||
        skill.description.toLowerCase().includes(search.toLowerCase()) ||
        `${skill.owner}/${skill.repo}`.toLowerCase().includes(search.toLowerCase());
      return matchesFilter && matchesSearch;
    });
  }, [skills, filter, search]);

  const handleAddRepo = async () => {
    if (!repoUrl.trim()) return;

    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\s]+)/);
    if (!match) {
      setAddError("Invalid GitHub URL");
      return;
    }

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, "");

    setAdding(true);
    setAddError(null);

    try {
      await invoke("add_custom_repo", { owner, repo });
      setRepoUrl("");
      setShowAddRepo(false);
      onRefresh();
    } catch (e) {
      setAddError(String(e));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRepo = async (repoKey: string) => {
    const [owner, repo] = repoKey.split("/");
    try {
      await invoke("remove_custom_repo", { owner, repo });
      setContextMenu(null);
      onRefresh();
    } catch (e) {
      console.error("Failed to remove repo:", e);
    }
  };

  const isRepoSelected = (group: RepoGroup) =>
    selection.type === "repo" &&
    selection.repo.owner === group.owner &&
    selection.repo.repo === group.repo;

  const isSkillSelected = (skill: Skill) =>
    selection.type === "skill" && selection.skill.id === skill.id;

  return (
    <div className="w-72 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <h1 className="font-semibold text-[var(--text-primary)]">Skill Studio</h1>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-2 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4 text-[var(--text-muted)]" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="relative">
          <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search skills..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
        </div>
        {/* Filter Pills */}
        <div className="flex gap-1.5 mt-2.5">
          {(["all", "fetched", "installed"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all capitalize ${
                filter === f
                  ? "bg-[var(--accent)] text-white shadow-sm"
                  : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-sm">
            Loading...
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500 text-sm">{error}</div>
        ) : (
          <>
            {/* Sources Section */}
            <div className="border-b border-[var(--border)]">
              <button
                onClick={() => setSourcesExpanded(!sourcesExpanded)}
                className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {sourcesExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                )}
                <FolderGit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Sources
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                  {filteredRepoGroups.length}
                </span>
              </button>
              {sourcesExpanded && (
                <div className="pb-2">
                  {/* Add Repo Button - only show on "all" filter */}
                  {filter === "all" && (
                    <button
                      onClick={() => setShowAddRepo(true)}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-[var(--accent)] hover:bg-[var(--bg-tertiary)] cursor-pointer mx-2 rounded-lg"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Repository</span>
                    </button>
                  )}
                  {filteredRepoGroups.map((group) => {
                    const repoKey = `${group.owner}/${group.repo}`;
                    const isFavorite = isRepoFavorite(repoKey);
                    return (
                      <button
                        key={repoKey}
                        onClick={() => onSelectionChange({ type: "repo", repo: group })}
                        onContextMenu={(e) => handleRepoContextMenu(e, repoKey, group.isCustom || false)}
                        className={`w-full px-3 py-2 flex items-center gap-2 text-sm text-left transition-colors mx-2 rounded-lg ${
                          isRepoSelected(group)
                            ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        }`}
                      >
                        {isFavorite ? (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        ) : group.isFetched ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Download className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                        )}
                        <span className="truncate">
                          {group.owner}/{group.repo}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] ml-auto">{group.skills.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Skills Section */}
            <div>
              <button
                onClick={() => setSkillsExpanded(!skillsExpanded)}
                className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {skillsExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[var(--text-muted)]" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                )}
                <Sparkles className="w-4 h-4 text-[var(--text-secondary)]" />
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  Skills
                </span>
                <span className="text-xs text-[var(--text-muted)] ml-auto bg-[var(--bg-tertiary)] px-1.5 py-0.5 rounded">
                  {filteredSkills.length}
                </span>
              </button>
              {skillsExpanded && (
                <div className="pb-2">
                  {filteredSkills.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[var(--text-muted)] ml-6">No skills found</div>
                  ) : (
                    filteredSkills.map((skill) => {
                      const isFavorite = isSkillFavorite(skill.id);
                      return (
                        <button
                          key={skill.id}
                          onClick={() => onSelectionChange({ type: "skill", skill })}
                          onContextMenu={(e) => handleSkillContextMenu(e, skill.id)}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left transition-colors mx-2 rounded-lg ${
                            isSkillSelected(skill)
                              ? "bg-[var(--accent)]/15"
                              : "hover:bg-[var(--bg-tertiary)]"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isFavorite && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                              )}
                              <span
                                className={`text-sm truncate ${
                                  isSkillSelected(skill)
                                    ? "text-[var(--accent)] font-medium"
                                    : "text-[var(--text-primary)]"
                                }`}
                              >
                                {skill.name}
                              </span>
                              {skill.isInstalled && (
                                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] truncate">{skill.description}</p>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Repo Modal */}
      {showAddRepo && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-secondary)] rounded-xl max-w-sm w-full shadow-2xl border border-[var(--border)]">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <h3 className="font-medium text-[var(--text-primary)]">Add Repository</h3>
              <button
                onClick={() => {
                  setShowAddRepo(false);
                  setRepoUrl("");
                  setAddError(null);
                }}
                className="p-1 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              >
                <X className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
            <div className="p-4">
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 text-sm bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                onKeyDown={(e) => e.key === "Enter" && handleAddRepo()}
              />
              {addError && <p className="text-red-500 text-xs mt-2">{addError}</p>}
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Enter a GitHub URL containing Claude skills
              </p>
              <button
                onClick={handleAddRepo}
                disabled={adding || !repoUrl.trim()}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                {adding ? "Adding..." : "Add Repository"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "repo" && contextMenu.repoKey && (
            <>
              <button
                onClick={() => {
                  onToggleRepoFavorite(contextMenu.repoKey!);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-[var(--text-primary)]"
              >
                <Star className={`w-4 h-4 ${isRepoFavorite(contextMenu.repoKey) ? "text-amber-500 fill-amber-500" : "text-[var(--text-muted)]"}`} />
                {isRepoFavorite(contextMenu.repoKey) ? "Remove from Favorites" : "Add to Favorites"}
              </button>
              {contextMenu.isCustomRepo && (
                <button
                  onClick={() => handleRemoveRepo(contextMenu.repoKey!)}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                  Remove Repository
                </button>
              )}
            </>
          )}
          {contextMenu.type === "skill" && contextMenu.skillId && (
            <button
              onClick={() => {
                onToggleSkillFavorite(contextMenu.skillId!);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-[var(--text-primary)]"
            >
              <Star className={`w-4 h-4 ${isSkillFavorite(contextMenu.skillId) ? "text-amber-500 fill-amber-500" : "text-[var(--text-muted)]"}`} />
              {isSkillFavorite(contextMenu.skillId) ? "Remove from Favorites" : "Add to Favorites"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
