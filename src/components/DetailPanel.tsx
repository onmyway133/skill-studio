import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import MarkdownPreview from "@uiw/react-markdown-preview";
import {
  Download,
  ExternalLink,
  Check,
  Trash2,
  Github,
  FileText,
  Sparkles,
  PackagePlus,
  FolderGit2,
  Star,
  FolderOpen,
} from "lucide-react";
import { Skill, InstallMethod, Selection } from "../types/skill";

interface DetailPanelProps {
  selection: Selection;
  skills: Skill[];
  installMethod: InstallMethod;
  onRefresh: () => void;
  onToggleSkillFavorite: (skillId: string) => void;
  isSkillFavorite: (skillId: string) => boolean;
}

export function DetailPanel({ selection, skills, installMethod, onRefresh, onToggleSkillFavorite, isSkillFavorite }: DetailPanelProps) {
  const [installing, setInstalling] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoReadme, setRepoReadme] = useState<string | null>(null);
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [selectedSkillInRepo, setSelectedSkillInRepo] = useState<Skill | null>(null);
  const [viewMode, setViewMode] = useState<"readme" | "skill">("readme");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; skillId: string } | null>(null);
  const [localFetched, setLocalFetched] = useState(false);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Update selectedSkillInRepo when skills array changes (after install/uninstall)
  useEffect(() => {
    if (selectedSkillInRepo) {
      const updatedSkill = skills.find(s => s.id === selectedSkillInRepo.id);
      if (updatedSkill) {
        setSelectedSkillInRepo(updatedSkill);
      }
    }
  }, [skills]);

  // Sync localFetched with repo.isFetched when it becomes true from backend
  useEffect(() => {
    if (selection.type === "repo" && selection.repo.isFetched && !localFetched) {
      setLocalFetched(true);
    }
  }, [selection, localFetched]);

  // Track which repo we're viewing to detect actual repo changes
  const currentRepoKey = selection.type === "repo"
    ? `${selection.repo.owner}/${selection.repo.repo}`
    : null;

  // Fetch README from GitHub raw URL - only when repo actually changes
  useEffect(() => {
    if (selection.type === "repo") {
      setLoadingReadme(true);
      const rawUrl = `https://raw.githubusercontent.com/${selection.repo.owner}/${selection.repo.repo}/main/README.md`;
      fetch(rawUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Not found");
          return res.text();
        })
        .then((readme) => {
          setRepoReadme(readme);
        })
        .catch(() => {
          // Try master branch if main doesn't exist
          const masterUrl = `https://raw.githubusercontent.com/${selection.repo.owner}/${selection.repo.repo}/master/README.md`;
          fetch(masterUrl)
            .then((res) => {
              if (!res.ok) throw new Error("Not found");
              return res.text();
            })
            .then((readme) => {
              setRepoReadme(readme);
            })
            .catch(() => {
              setRepoReadme(null);
            });
        })
        .finally(() => {
          setLoadingReadme(false);
        });
      // Reset skill selection and view mode when repo changes
      setSelectedSkillInRepo(null);
      setViewMode("readme");
      setLocalFetched(false);
    } else {
      setRepoReadme(null);
      setSelectedSkillInRepo(null);
      setViewMode("readme");
      setLocalFetched(false);
    }
  }, [currentRepoKey]); // Only trigger when actual repo changes, not selection object reference

  // Empty state
  if (selection.type === "none") {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[var(--bg-tertiary)] flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-secondary)]">Select a source or skill to view details</p>
        </div>
      </div>
    );
  }

  // Repo view
  if (selection.type === "repo") {
    const repo = selection.repo;
    const githubUrl = `https://github.com/${repo.owner}/${repo.repo}`;
    const repoSkills = skills.filter(s => s.owner === repo.owner && s.repo === repo.repo);

    const handleFetchRepo = async () => {
      setFetching(true);
      setError(null);
      try {
        await invoke("fetch_repo", { owner: repo.owner, repo: repo.repo });
        setLocalFetched(true);
        onRefresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setFetching(false);
      }
    };

    const handleInstallSkill = async (skill: Skill) => {
      setInstalling(skill.id);
      setError(null);
      try {
        await invoke("install_skill", {
          owner: skill.owner,
          repo: skill.repo,
          skillName: skill.name,
          skillPath: skill.path,
          skillsPath: skill.skillsPath,
          method: installMethod,
        });
        onRefresh();
      } catch (e) {
        setError(String(e));
      } finally {
        setInstalling(null);
      }
    };

    const handleUninstallSkill = async (skill: Skill) => {
      setError(null);
      try {
        await invoke("uninstall_skill", { skillName: skill.name });
        onRefresh();
      } catch (e) {
        setError(String(e));
      }
    };

    return (
      <div className="flex-1 flex flex-col bg-[var(--bg-secondary)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-gradient-to-br from-gray-600 to-gray-800 rounded-xl flex items-center justify-center shadow-lg">
              <FolderGit2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">{repo.owner}/{repo.repo}</h2>
              <p className="text-sm text-[var(--text-muted)]">
                {repoSkills.length} skill{repoSkills.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {error && <span className="text-sm text-red-500 mr-2">{error}</span>}

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
              title="Open on GitHub"
            >
              <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
            </a>

            {/* Show skill actions when a skill is selected, otherwise show Fetch Skills */}
            {viewMode === "skill" && selectedSkillInRepo ? (
              <>
                {selectedSkillInRepo.isInstalled && (
                  <button
                    onClick={() => invoke("reveal_skill_in_finder", { skillName: selectedSkillInRepo.name })}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors text-sm font-medium"
                    title="Reveal in Finder"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Reveal
                  </button>
                )}
                {selectedSkillInRepo.isInstalled ? (
                  <button
                    onClick={() => handleUninstallSkill(selectedSkillInRepo)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Uninstall
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstallSkill(selectedSkillInRepo)}
                    disabled={installing === selectedSkillInRepo.id}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
                  >
                    <PackagePlus className="w-4 h-4" />
                    {installing === selectedSkillInRepo.id ? "Installing..." : "Install"}
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={handleFetchRepo}
                disabled={fetching}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
              >
                <Download className="w-4 h-4" />
                {fetching ? "Fetching..." : "Fetch Skills"}
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Skills List */}
          <div className="w-80 border-r border-[var(--border)] overflow-y-auto flex flex-col">
            <div className="p-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--text-primary)]">Contents</h3>
            </div>
            <div className="p-2 flex-1 overflow-y-auto">
              {/* README row */}
              <div
                onClick={() => {
                  setSelectedSkillInRepo(null);
                  setViewMode("readme");
                }}
                className={`p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                  viewMode === "readme"
                    ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                    : "hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className={`w-4 h-4 ${viewMode === "readme" ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                  <span className={`font-medium text-sm ${
                    viewMode === "readme" ? "text-[var(--accent)]" : "text-[var(--text-primary)]"
                  }`}>README</span>
                </div>
              </div>

              {/* Skills section */}
              {(repo.isFetched || localFetched) && repoSkills.length > 0 ? (
                <>
                  {/* Divider */}
                  <div className="px-3 py-2">
                    <span className="text-xs text-[var(--text-muted)] font-medium uppercase tracking-wide">Skills ({repoSkills.length})</span>
                  </div>

                  {repoSkills.map((skill) => {
                    const isFavorite = isSkillFavorite(skill.id);
                    return (
                      <div
                        key={skill.id}
                        onClick={() => {
                          setSelectedSkillInRepo(skill);
                          setViewMode("skill");
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, skillId: skill.id });
                        }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors mb-1 ${
                          selectedSkillInRepo?.id === skill.id
                            ? "bg-[var(--accent)]/10 border border-[var(--accent)]/30"
                            : "hover:bg-[var(--bg-tertiary)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isFavorite && (
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500 flex-shrink-0" />
                              )}
                              <span className={`font-medium text-sm ${
                                selectedSkillInRepo?.id === skill.id
                                  ? "text-[var(--accent)]"
                                  : "text-[var(--text-primary)]"
                              }`}>{skill.name}</span>
                              {skill.isInstalled && (
                                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{skill.description}</p>
                          </div>
                          {skill.isInstalled ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUninstallSkill(skill);
                              }}
                              className="p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                              title="Uninstall"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInstallSkill(skill);
                              }}
                              disabled={installing === skill.id}
                              className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded transition-colors disabled:opacity-50"
                              title="Install"
                            >
                              <PackagePlus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              ) : !(repo.isFetched || localFetched) ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-[var(--text-muted)]">Fetch skills to view and install them</p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Content Pane - README or Skill */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-2 bg-[var(--bg-tertiary)] border-b border-[var(--border)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)] font-medium">
                {viewMode === "skill" && selectedSkillInRepo ? selectedSkillInRepo.name : "README"}
              </span>
              {loadingReadme && (
                <span className="text-xs text-[var(--text-muted)] ml-auto">Loading...</span>
              )}
              {!(repo.isFetched || localFetched) && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full ml-auto font-medium">
                  Fetch skills to view and install
                </span>
              )}
              {viewMode === "skill" && selectedSkillInRepo?.isInstalled && (
                <button
                  onClick={() => invoke("reveal_skill_in_finder", { skillName: selectedSkillInRepo.name })}
                  className="ml-auto flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--bg-secondary)] hover:bg-[var(--border)] text-[var(--text-secondary)] rounded-md transition-colors"
                  title="Reveal in Finder"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  Reveal
                </button>
              )}
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewMode === "skill" && selectedSkillInRepo?.content ? (
                <MarkdownPreview
                  source={selectedSkillInRepo.content}
                  style={{ backgroundColor: "transparent" }}
                  wrapperElement={{ "data-color-mode": "dark" }}
                />
              ) : repoReadme ? (
                <MarkdownPreview
                  source={repoReadme}
                  style={{ backgroundColor: "transparent" }}
                  wrapperElement={{ "data-color-mode": "dark" }}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
                  {loadingReadme ? "Loading README..." : "No README found"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg shadow-xl py-1 z-50 min-w-[160px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={() => {
                onToggleSkillFavorite(contextMenu.skillId);
                setContextMenu(null);
              }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-[var(--bg-tertiary)] flex items-center gap-2 text-[var(--text-primary)]"
            >
              <Star className={`w-4 h-4 ${isSkillFavorite(contextMenu.skillId) ? "text-amber-500 fill-amber-500" : "text-[var(--text-muted)]"}`} />
              {isSkillFavorite(contextMenu.skillId) ? "Remove from Favorites" : "Add to Favorites"}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Skill view
  const skill = selection.skill;
  const githubUrl = `https://github.com/${skill.owner}/${skill.repo}`;
  const skillFileUrl = `${githubUrl}/blob/main/${skill.skillsPath}/${skill.path}/SKILL.md`;

  const handleFetch = async () => {
    setFetching(true);
    setError(null);
    try {
      await invoke("fetch_repo", { owner: skill.owner, repo: skill.repo });
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setFetching(false);
    }
  };

  const handleInstall = async () => {
    setInstalling(skill.id);
    setError(null);
    try {
      await invoke("install_skill", {
        owner: skill.owner,
        repo: skill.repo,
        skillName: skill.name,
        skillPath: skill.path,
        skillsPath: skill.skillsPath,
        method: installMethod,
      });
      onRefresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async () => {
    setError(null);
    try {
      await invoke("uninstall_skill", { skillName: skill.name });
      onRefresh();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-secondary)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">{skill.name}</h2>
            <p className="text-sm text-[var(--text-muted)]">
              {skill.owner}/{skill.repo}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {error && <span className="text-sm text-red-500 mr-2">{error}</span>}

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 hover:bg-[var(--bg-tertiary)] rounded-lg transition-colors"
            title="Open on GitHub"
          >
            <ExternalLink className="w-4 h-4 text-[var(--text-muted)]" />
          </a>

          {!skill.isFetched && (
            <button
              onClick={handleFetch}
              disabled={fetching}
              className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
            >
              <Download className="w-4 h-4" />
              {fetching ? "Fetching..." : "Fetch"}
            </button>
          )}

          {skill.isFetched && !skill.isInstalled && (
            <button
              onClick={handleInstall}
              disabled={installing === skill.id}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium shadow-sm"
            >
              <PackagePlus className="w-4 h-4" />
              {installing === skill.id ? "Installing..." : "Install"}
            </button>
          )}

          {skill.isInstalled && (
            <>
              <button
                onClick={() => invoke("reveal_skill_in_finder", { skillName: skill.name })}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-tertiary)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--border)] transition-colors text-sm font-medium"
                title="Reveal in Finder"
              >
                <FolderOpen className="w-4 h-4" />
                Reveal
              </button>
              <button
                onClick={handleUninstall}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                Uninstall
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {skill.isFetched && skill.content ? (
          <div className="h-full overflow-y-auto p-6">
            <MarkdownPreview
              source={skill.content}
              style={{ backgroundColor: "transparent" }}
              wrapperElement={{ "data-color-mode": "dark" }}
            />
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* GitHub Preview Header */}
            <div className="px-4 py-2.5 bg-[var(--bg-tertiary)] border-b border-[var(--border)] flex items-center gap-2">
              <Github className="w-4 h-4 text-[var(--text-muted)]" />
              <span className="text-sm text-[var(--text-secondary)] font-medium">GitHub Preview</span>
              {!skill.isFetched && (
                <span className="text-xs bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 px-2.5 py-0.5 rounded-full ml-auto font-medium">
                  Not fetched
                </span>
              )}
            </div>
            {/* Iframe for GitHub */}
            <iframe
              src={skill.skillsPath === "." ? `${githubUrl}/tree/main/${skill.path}` : skillFileUrl}
              className="flex-1 w-full border-0 bg-white"
              title="GitHub Preview"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>
    </div>
  );
}
