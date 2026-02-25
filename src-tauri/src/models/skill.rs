use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub owner: String,
    pub repo: String,
    pub skills_path: String,
    pub path: String,
    pub content: Option<String>,
    pub is_installed: bool,
    pub is_fetched: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub version: String,
    pub last_updated: String,
    pub repos: Vec<CatalogRepo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CatalogRepo {
    pub url: String,  // "owner/repo" format
    #[serde(default)]
    pub highlight: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct FetchedRepos {
    pub repos: HashMap<String, String>, // "owner/repo" -> lastFetched ISO date
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub install_method: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            install_method: "copy".to_string(),
        }
    }
}
