use crate::models::{Catalog, FetchedRepos, Skill};
use regex::Regex;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;

fn get_library_path(app: &tauri::AppHandle) -> PathBuf {
    // Try resource_dir first (for bundled apps)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let lib_path = resource_dir.join("library");
        if lib_path.join("catalog.json").exists() {
            return lib_path;
        }
    }

    // Fallback: try executable directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            let lib_path = exe_dir.join("library");
            if lib_path.join("catalog.json").exists() {
                return lib_path;
            }
        }
    }

    PathBuf::from(".").join("library")
}

fn get_data_path() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skill-studio")
}

fn get_fetched_repos_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skill-studio")
        .join("fetched-repos.json")
}

fn get_installed_skills_path() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".claude")
        .join("skills")
}

fn load_fetched_repos() -> FetchedRepos {
    let path = get_fetched_repos_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        FetchedRepos::default()
    }
}

fn save_fetched_repos(repos: &FetchedRepos) -> Result<(), String> {
    let path = get_fetched_repos_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(repos).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

fn parse_frontmatter(content: &str) -> (String, String) {
    let re = Regex::new(r"(?s)^---\n(.*?)\n---").unwrap();

    if let Some(caps) = re.captures(content) {
        let frontmatter = &caps[1];

        let name = Regex::new(r"name:\s*(.+)")
            .unwrap()
            .captures(frontmatter)
            .map(|c| c[1].trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        let description = Regex::new(r"description:\s*(.+)")
            .unwrap()
            .captures(frontmatter)
            .map(|c| c[1].trim().to_string())
            .unwrap_or_default();

        return (name, description);
    }

    ("Unknown".to_string(), String::new())
}

#[tauri::command]
pub async fn get_catalog(app: tauri::AppHandle) -> Result<Catalog, String> {
    let library_path = get_library_path(&app);
    let catalog_path = library_path.join("catalog.json");

    let content = fs::read_to_string(&catalog_path)
        .map_err(|e| format!("Failed to read catalog: {}", e))?;

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse catalog: {}", e))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub owner: String,
    pub repo: String,
    pub is_fetched: bool,
    pub is_custom: bool,
    pub highlight: bool,
}

#[tauri::command]
pub async fn get_all_repos(app: tauri::AppHandle) -> Result<Vec<RepoInfo>, String> {
    let library_path = get_library_path(&app);
    let catalog_path = library_path.join("catalog.json");
    let fetched_repos = load_fetched_repos();
    let custom_repos = load_custom_repos();

    let mut repos: Vec<RepoInfo> = Vec::new();

    // Add catalog repos
    if let Ok(catalog_content) = fs::read_to_string(&catalog_path) {
        if let Ok(catalog) = serde_json::from_str::<Catalog>(&catalog_content) {
            for catalog_repo in catalog.repos {
                if let Some((owner, repo)) = catalog_repo.url.split_once('/') {
                    let repo_key = format!("{}/{}", owner, repo);
                    repos.push(RepoInfo {
                        owner: owner.to_string(),
                        repo: repo.to_string(),
                        is_fetched: fetched_repos.repos.contains_key(&repo_key),
                        is_custom: false,
                        highlight: catalog_repo.highlight,
                    });
                }
            }
        }
    }

    // Add custom repos (avoid duplicates)
    for custom_repo in custom_repos.repos {
        let exists = repos.iter().any(|r|
            r.owner == custom_repo.owner && r.repo == custom_repo.repo
        );
        if !exists {
            let repo_key = format!("{}/{}", custom_repo.owner, custom_repo.repo);
            repos.push(RepoInfo {
                owner: custom_repo.owner,
                repo: custom_repo.repo,
                is_fetched: fetched_repos.repos.contains_key(&repo_key),
                is_custom: true,
                highlight: false,
            });
        }
    }

    Ok(repos)
}

// Unified repo source (from catalog or custom)
#[derive(Clone)]
struct RepoSource {
    owner: String,
    repo: String,
}

fn scan_repo_for_skills(
    source: &RepoSource,
    installed_skills: &[String],
) -> Vec<Skill> {
    let mut skills = Vec::new();
    let data_path = get_data_path();
    let repo_path = data_path
        .join("repos")
        .join(&source.owner)
        .join(&source.repo);

    if !repo_path.exists() {
        return skills;
    }

    // Auto-detect skills_path
    let skills_path = detect_skills_path(&repo_path);
    let skills_dir = if skills_path == "." {
        repo_path.clone()
    } else {
        repo_path.join(&skills_path)
    };

    if !skills_dir.exists() {
        return skills;
    }

    if let Ok(entries) = fs::read_dir(&skills_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if !entry_path.is_dir() {
                continue;
            }

            let skill_file = if entry_path.join("SKILL.md").exists() {
                entry_path.join("SKILL.md")
            } else if entry_path.join("skill.md").exists() {
                entry_path.join("skill.md")
            } else {
                continue;
            };

            let content = fs::read_to_string(&skill_file).ok();
            let skill_folder = entry.file_name().to_string_lossy().to_string();

            // Parse frontmatter for name and description
            let (name, description) = if let Some(ref c) = content {
                parse_frontmatter(c)
            } else {
                (skill_folder.clone(), String::new())
            };

            let id = format!("{}/{}/{}", source.owner, source.repo, skill_folder);
            let is_installed = installed_skills.iter().any(|s| s == &name || s == &skill_folder);

            skills.push(Skill {
                id,
                name,
                description,
                owner: source.owner.clone(),
                repo: source.repo.clone(),
                skills_path: skills_path.clone(),
                path: skill_folder,
                content,
                is_installed,
                is_fetched: true,
            });
        }
    }

    skills
}

#[tauri::command]
pub async fn get_all_skills(app: tauri::AppHandle) -> Result<Vec<Skill>, String> {
    let library_path = get_library_path(&app);
    let catalog_path = library_path.join("catalog.json");

    let fetched_repos = load_fetched_repos();
    let custom_repos = load_custom_repos();
    let installed_path = get_installed_skills_path();

    let installed_skills: Vec<String> = if installed_path.exists() {
        fs::read_dir(&installed_path)
            .map(|entries| {
                entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.file_name().to_string_lossy().to_string())
                    .collect()
            })
            .unwrap_or_default()
    } else {
        vec![]
    };

    // Collect all repo sources (catalog + custom)
    let mut all_sources: Vec<RepoSource> = Vec::new();

    // Add catalog repos
    if let Ok(catalog_content) = fs::read_to_string(&catalog_path) {
        if let Ok(catalog) = serde_json::from_str::<Catalog>(&catalog_content) {
            for catalog_repo in catalog.repos {
                if let Some((owner, repo)) = catalog_repo.url.split_once('/') {
                    all_sources.push(RepoSource {
                        owner: owner.to_string(),
                        repo: repo.to_string(),
                    });
                }
            }
        }
    }

    // Add custom repos (avoid duplicates)
    for custom_repo in custom_repos.repos {
        let exists = all_sources.iter().any(|s|
            s.owner == custom_repo.owner && s.repo == custom_repo.repo
        );
        if !exists {
            all_sources.push(RepoSource {
                owner: custom_repo.owner,
                repo: custom_repo.repo,
            });
        }
    }

    let mut skills = Vec::new();

    // Load skills from cache for each fetched repo
    for source in all_sources {
        let repo_key = format!("{}/{}", source.owner, source.repo);
        let is_fetched = fetched_repos.repos.contains_key(&repo_key);

        if is_fetched {
            // Try to load from cache first
            if let Some(mut cached_skills) = load_cached_skills(&source.owner, &source.repo) {
                // Update installed status
                for skill in &mut cached_skills {
                    skill.is_installed = installed_skills.iter().any(|s| s == &skill.name || s == &skill.path);
                }
                skills.extend(cached_skills);
            } else {
                // Fallback: scan repo and cache the results
                let repo_skills = scan_repo_for_skills(&source, &installed_skills);
                let _ = save_cached_skills(&source.owner, &source.repo, &repo_skills);
                skills.extend(repo_skills);
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
pub async fn get_fetched_repos() -> Result<FetchedRepos, String> {
    Ok(load_fetched_repos())
}

#[tauri::command]
pub async fn fetch_repo(
    owner: String,
    repo: String,
) -> Result<String, String> {
    let data_path = get_data_path();
    let repo_path = data_path.join("repos").join(&owner).join(&repo);
    let repo_url = format!("https://github.com/{}/{}.git", owner, repo);

    if repo_path.exists() {
        // Remove and re-fetch for updates
        fs::remove_dir_all(&repo_path).map_err(|e| format!("Failed to remove old repo: {}", e))?;
    }

    // Clone with minimal depth
    if let Some(parent) = repo_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }
    Command::new("git")
        .args(["clone", "--depth", "1", &repo_url, repo_path.to_str().unwrap()])
        .output()
        .map_err(|e| format!("Failed to clone: {}", e))?;

    // Remove .git folder to save space
    let git_dir = repo_path.join(".git");
    if git_dir.exists() {
        fs::remove_dir_all(&git_dir).ok(); // Ignore errors
    }

    // Scan and cache skills metadata
    let source = RepoSource {
        owner: owner.clone(),
        repo: repo.clone(),
    };
    let skills = scan_repo_for_skills(&source, &[]);
    save_cached_skills(&owner, &repo, &skills)?;

    // Update fetched repos
    let mut fetched = load_fetched_repos();
    let repo_key = format!("{}/{}", owner, repo);
    fetched.repos.insert(repo_key.clone(), chrono_now());
    save_fetched_repos(&fetched)?;

    Ok(format!("Fetched {} ({} skills)", repo_key, skills.len()))
}

// Cache skills metadata to JSON
fn save_cached_skills(owner: &str, repo: &str, skills: &[Skill]) -> Result<(), String> {
    let data_path = get_data_path();
    let cache_path = data_path.join("repos").join(owner).join(repo).join("_skills_cache.json");

    let content = serde_json::to_string_pretty(skills).map_err(|e| e.to_string())?;
    fs::write(&cache_path, content).map_err(|e| format!("Failed to write skills cache: {}", e))
}

// Load cached skills from JSON
fn load_cached_skills(owner: &str, repo: &str) -> Option<Vec<Skill>> {
    let data_path = get_data_path();
    let cache_path = data_path.join("repos").join(owner).join(repo).join("_skills_cache.json");

    if cache_path.exists() {
        fs::read_to_string(&cache_path)
            .ok()
            .and_then(|content| serde_json::from_str(&content).ok())
    } else {
        None
    }
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap();
    let secs = duration.as_secs();
    // Simple ISO-like format
    format!("{}", secs)
}

#[tauri::command]
pub async fn get_installed_skills() -> Result<Vec<String>, String> {
    let installed_path = get_installed_skills_path();

    if !installed_path.exists() {
        return Ok(vec![]);
    }

    let skills = fs::read_dir(&installed_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .collect();

    Ok(skills)
}

fn get_custom_repos_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skill-studio")
        .join("custom-repos.json")
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct CustomRepos {
    repos: Vec<CustomRepo>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
pub struct CustomRepo {
    owner: String,
    repo: String,
    skills_path: String,
}

fn load_custom_repos() -> CustomRepos {
    let path = get_custom_repos_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        CustomRepos::default()
    }
}

fn save_custom_repos(repos: &CustomRepos) -> Result<(), String> {
    let path = get_custom_repos_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(repos).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_custom_repo(
    owner: String,
    repo: String,
) -> Result<String, String> {
    let data_path = get_data_path();
    let repo_path = data_path.join("repos").join(&owner).join(&repo);
    let repo_url = format!("https://github.com/{}/{}.git", owner, repo);

    // Clone the repo
    if !repo_path.exists() {
        if let Some(parent) = repo_path.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
        }
        Command::new("git")
            .args(["clone", "--depth", "1", &repo_url, repo_path.to_str().unwrap()])
            .output()
            .map_err(|e| format!("Failed to clone: {}", e))?;

        // Remove .git folder to save space
        let git_dir = repo_path.join(".git");
        if git_dir.exists() {
            fs::remove_dir_all(&git_dir).ok();
        }
    }

    // Detect skills_path by looking for skill.md or SKILL.md files
    let skills_path = detect_skills_path(&repo_path);

    // Add to custom repos
    let mut custom = load_custom_repos();
    let repo_key = format!("{}/{}", owner, repo);

    // Check if already exists
    if !custom.repos.iter().any(|r| r.owner == owner && r.repo == repo) {
        custom.repos.push(CustomRepo {
            owner: owner.clone(),
            repo: repo.clone(),
            skills_path: skills_path.clone(),
        });
        save_custom_repos(&custom)?;
    }

    // Update fetched repos
    let mut fetched = load_fetched_repos();
    fetched.repos.insert(repo_key.clone(), chrono_now());
    save_fetched_repos(&fetched)?;

    Ok(format!("Added custom repo {}", repo_key))
}

fn detect_skills_path(repo_path: &PathBuf) -> String {
    // Common skill paths to check
    let paths = ["skills", "src/skills", "lib/skills", "."];

    let mut best_path = ".";
    let mut best_count = 0;

    for path in paths {
        let check_path = if path == "." {
            repo_path.clone()
        } else {
            repo_path.join(path)
        };

        if check_path.exists() && check_path.is_dir() {
            // Count skill folders in this path
            let mut count = 0;
            if let Ok(entries) = fs::read_dir(&check_path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    if !entry.path().is_dir() {
                        continue;
                    }
                    let skill_md = entry.path().join("SKILL.md");
                    let skill_md_lower = entry.path().join("skill.md");
                    if skill_md.exists() || skill_md_lower.exists() {
                        count += 1;
                    }
                }
            }
            // Use the path with the most skills
            if count > best_count {
                best_count = count;
                best_path = path;
            }
        }
    }

    best_path.to_string()
}

#[tauri::command]
pub async fn get_custom_repos() -> Result<Vec<CustomRepo>, String> {
    Ok(load_custom_repos().repos)
}

// Favorites
fn get_favorites_path() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("skill-studio")
        .join("favorites.json")
}

#[derive(serde::Serialize, serde::Deserialize, Default, Clone)]
pub struct Favorites {
    pub skills: Vec<String>,  // skill IDs
    pub repos: Vec<String>,   // "owner/repo" keys
}

fn load_favorites() -> Favorites {
    let path = get_favorites_path();
    if path.exists() {
        fs::read_to_string(&path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        Favorites::default()
    }
}

fn save_favorites(favorites: &Favorites) -> Result<(), String> {
    let path = get_favorites_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(favorites).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_favorites() -> Result<Favorites, String> {
    Ok(load_favorites())
}

#[tauri::command]
pub async fn toggle_favorite_skill(skill_id: String) -> Result<Favorites, String> {
    let mut favorites = load_favorites();
    if favorites.skills.contains(&skill_id) {
        favorites.skills.retain(|id| id != &skill_id);
    } else {
        favorites.skills.push(skill_id);
    }
    save_favorites(&favorites)?;
    Ok(favorites)
}

#[tauri::command]
pub async fn toggle_favorite_repo(repo_key: String) -> Result<Favorites, String> {
    let mut favorites = load_favorites();
    if favorites.repos.contains(&repo_key) {
        favorites.repos.retain(|key| key != &repo_key);
    } else {
        favorites.repos.push(repo_key);
    }
    save_favorites(&favorites)?;
    Ok(favorites)
}

#[tauri::command]
pub async fn reveal_skill_in_finder(skill_name: String) -> Result<(), String> {
    let skill_path = get_installed_skills_path().join(&skill_name);

    if !skill_path.exists() {
        return Err(format!("Skill folder not found: {}", skill_name));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", skill_path.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", skill_path.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Failed to reveal in Explorer: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(skill_path.parent().unwrap_or(&skill_path))
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_repo_readme(
    owner: String,
    repo: String,
) -> Result<Option<String>, String> {
    let data_path = get_data_path();
    let repo_path = data_path.join("repos").join(&owner).join(&repo);

    if !repo_path.exists() {
        return Ok(None);
    }

    // Try common README filenames
    let readme_names = ["README.md", "readme.md", "Readme.md", "README.MD"];

    for name in readme_names {
        let readme_path = repo_path.join(name);
        if readme_path.exists() {
            return fs::read_to_string(&readme_path)
                .map(Some)
                .map_err(|e| format!("Failed to read README: {}", e));
        }
    }

    Ok(None)
}
