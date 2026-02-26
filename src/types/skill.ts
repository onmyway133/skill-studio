export interface Skill {
  id: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  skillsPath: string;
  path: string;
  content?: string;
  isInstalled: boolean;
  isFetched: boolean;
}

export interface SkillRepository {
  owner: string;
  repo: string;
  skillsPath: string;
  lastFetched?: string;
}

export interface Catalog {
  version: string;
  lastUpdated: string;
  skills: CatalogSkill[];
}

export interface CatalogSkill {
  id: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  skillsPath: string;
  path: string;
}

export interface FetchedRepos {
  repos: Record<string, string>; // "owner/repo" -> lastFetched ISO date
}

export type InstallMethod = "npx" | "copy";

export interface Settings {
  installMethod: InstallMethod;
}

export interface RepoGroup {
  owner: string;
  repo: string;
  skills: Skill[];
  isFetched: boolean;
  isCustom?: boolean;
}

export interface RepoInfo {
  owner: string;
  repo: string;
  isFetched: boolean;
  isCustom: boolean;
  highlight: boolean;
}

export type Selection =
  | { type: "none" }
  | { type: "repo"; repo: RepoGroup }
  | { type: "skill"; skill: Skill };

export interface Favorites {
  skills: string[];  // skill IDs
  repos: string[];   // "owner/repo" keys
}
