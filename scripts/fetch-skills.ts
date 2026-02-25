#!/usr/bin/env npx tsx

import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import * as yaml from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SkillRepository {
  owner: string;
  repo: string;
  branch?: string;
  skillsPath?: string;
}

interface SkillIndexEntry {
  id: string;
  name: string;
  description: string;
  owner: string;
  repo: string;
  path: string;
  localPath: string;
}

interface SkillIndex {
  version: string;
  lastUpdated: string;
  repositories: SkillRepository[];
  skills: SkillIndexEntry[];
}

// Load repositories from catalog.json
const CATALOG_PATH = path.join(__dirname, "..", "library", "catalog.json");

function loadRepositoriesFromCatalog(): SkillRepository[] {
  if (!fs.existsSync(CATALOG_PATH)) {
    console.log("Warning: catalog.json not found, using defaults");
    return [];
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
  return catalog.repos.map((repoStr: string) => {
    const [owner, repo] = repoStr.split("/");
    // Determine skillsPath based on known patterns
    const skillsPath = getSkillsPath(owner, repo);
    return { owner, repo, skillsPath };
  });
}

function getSkillsPath(owner: string, repo: string): string {
  // Single-skill repos (skill at root level)
  const singleSkillRepos = [
    "avdlee/swiftui-agent-skill",
    "avdlee/swift-concurrency-agent-skill",
    "avdlee/swift-testing-agent-skill",
    "nextlevelbuilder/ui-ux-pro-max-skill",
    "199-biotechnologies/claude-deep-research-skill",
    "superdesigndev/superdesign-skill",
    "yusukebe/hono-skill",
    "heredotnow/skill",
    "leonxlnx/taste-skill",
    "pleaseprompto/notebooklm-skill",
  ];

  const fullName = `${owner}/${repo}`;

  if (singleSkillRepos.includes(fullName) || repo.endsWith("-skill")) {
    return ".";
  }

  // Most repos use skills/ folder
  return "skills/";
}

const REPOSITORIES: SkillRepository[] = loadRepositoriesFromCatalog();

const LIBRARY_PATH = path.join(__dirname, "..", "library");
const SKILLS_PATH = path.join(LIBRARY_PATH, "skills");
const INDEX_PATH = path.join(LIBRARY_PATH, "index.json");

function fetchRepository(repo: SkillRepository): void {
  const repoPath = path.join(SKILLS_PATH, repo.owner, repo.repo);
  const repoUrl = `https://github.com/${repo.owner}/${repo.repo}.git`;

  if (fs.existsSync(repoPath)) {
    console.log(`Updating ${repo.owner}/${repo.repo}...`);
    try {
      execSync("git pull", { cwd: repoPath, stdio: "inherit" });
    } catch (e) {
      console.log(`  Warning: Could not pull ${repo.owner}/${repo.repo}`);
    }
  } else {
    console.log(`Cloning ${repo.owner}/${repo.repo}...`);
    fs.mkdirSync(path.dirname(repoPath), { recursive: true });
    try {
      execSync(`git clone --depth 1 ${repoUrl} ${repoPath}`, { stdio: "inherit" });
    } catch (e) {
      console.log(`  Warning: Could not clone ${repo.owner}/${repo.repo}`);
    }
  }
}

interface ParsedSkill {
  name: string;
  description: string;
  license?: string;
}

function parseSkillFile(filePath: string): ParsedSkill | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) return null;

    const frontmatter = yaml.parse(frontmatterMatch[1]);
    return {
      name: frontmatter.name || path.basename(path.dirname(filePath)),
      description: frontmatter.description || "",
      license: frontmatter.license,
    };
  } catch {
    return null;
  }
}

function findSkillFile(dir: string): string | null {
  const possibleNames = ["SKILL.md", "skill.md", "Skill.md"];
  for (const name of possibleNames) {
    const filePath = path.join(dir, name);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

function findSkills(owner: string, repo: string, repoPath: string, skillsPath: string): SkillIndexEntry[] {
  const skills: SkillIndexEntry[] = [];

  // Case 1: Single skill at root level (skillsPath is ".")
  if (skillsPath === ".") {
    const skillFile = findSkillFile(repoPath);
    if (skillFile) {
      const parsed = parseSkillFile(skillFile);
      if (parsed) {
        skills.push({
          id: `${owner}/${repo}/${parsed.name}`,
          name: parsed.name,
          description: parsed.description,
          owner,
          repo,
          path: ".",
          localPath: path.relative(LIBRARY_PATH, repoPath),
        });
      }
    }
    return skills;
  }

  // Case 2: Try skills/ folder
  const fullPath = path.join(repoPath, skillsPath);
  if (fs.existsSync(fullPath)) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(fullPath, { withFileTypes: true });
    } catch {
      return skills;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillDir = path.join(fullPath, entry.name);
      const skillFile = findSkillFile(skillDir);

      if (!skillFile) continue;

      const parsed = parseSkillFile(skillFile);
      if (!parsed) continue;

      skills.push({
        id: `${owner}/${repo}/${parsed.name}`,
        name: parsed.name,
        description: parsed.description,
        owner,
        repo,
        path: entry.name,
        localPath: path.relative(LIBRARY_PATH, skillDir),
      });
    }
  }

  // Case 3: If no skills found, check root for a single skill
  if (skills.length === 0) {
    const rootSkillFile = findSkillFile(repoPath);
    if (rootSkillFile) {
      const parsed = parseSkillFile(rootSkillFile);
      if (parsed) {
        skills.push({
          id: `${owner}/${repo}/${parsed.name}`,
          name: parsed.name,
          description: parsed.description,
          owner,
          repo,
          path: ".",
          localPath: path.relative(LIBRARY_PATH, repoPath),
        });
      }
    }
  }

  return skills;
}

async function main() {
  console.log("=== Skill Studio: Fetching Skills ===\n");

  // Create directories
  fs.mkdirSync(SKILLS_PATH, { recursive: true });

  // Fetch all repositories
  console.log("Fetching repositories...\n");
  for (const repo of REPOSITORIES) {
    fetchRepository(repo);
  }

  console.log("\nIndexing skills...\n");

  // Build index
  const allSkills: SkillIndexEntry[] = [];

  for (const repo of REPOSITORIES) {
    const repoPath = path.join(SKILLS_PATH, repo.owner, repo.repo);
    if (!fs.existsSync(repoPath)) continue;

    const skills = findSkills(repo.owner, repo.repo, repoPath, repo.skillsPath || "skills/");
    allSkills.push(...skills);
    console.log(`Found ${skills.length} skills in ${repo.owner}/${repo.repo}`);
  }

  const index: SkillIndex = {
    version: "1.0.0",
    lastUpdated: new Date().toISOString(),
    repositories: REPOSITORIES,
    skills: allSkills,
  };

  fs.writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
  console.log(`\nIndexed ${allSkills.length} total skills`);
  console.log(`Index saved to: ${INDEX_PATH}`);
}

main().catch(console.error);
