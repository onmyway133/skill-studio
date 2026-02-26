#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod models;

use commands::{
    get_all_skills, get_catalog, get_fetched_repos, get_installed_skills,
    get_settings, install_skill, save_settings, uninstall_skill, fetch_repo,
    add_custom_repo, remove_custom_repo, get_custom_repos, get_repo_readme, get_favorites,
    toggle_favorite_skill, toggle_favorite_repo, reveal_skill_in_finder, get_all_repos
};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_catalog,
            get_all_skills,
            get_all_repos,
            get_fetched_repos,
            fetch_repo,
            get_installed_skills,
            get_settings,
            save_settings,
            install_skill,
            uninstall_skill,
            add_custom_repo,
            remove_custom_repo,
            get_custom_repos,
            get_repo_readme,
            get_favorites,
            toggle_favorite_skill,
            toggle_favorite_repo,
            reveal_skill_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
