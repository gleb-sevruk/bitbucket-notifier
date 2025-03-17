// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
use crate::commands::update_dock_badge_safe;
use crate::logging::setup_logging;
use log::info;

mod commands;
mod logging;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_logging();
    info!("Starting app  🤬 🤯 😳 🥵 🥶 😱 😨 ");
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_dock_badge_safe])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
