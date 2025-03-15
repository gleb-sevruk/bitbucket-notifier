use tauri::{AppHandle, Builder, Manager};
use log::info;
use crate::logging::setup_logging;

#[tauri::command]
fn update_dock_badge_safe(app_handle: AppHandle, count: u32) -> Result<(), String> {
    let window = app_handle
        .get_webview_window("main")
        .ok_or_else(|| "Window not found".to_string())?;

    if count > 0 {
        window
            .set_badge_label(Some(count.to_string()))
            .map_err(|e| e.to_string())?;
    } else {
        window.set_badge_label(None).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    setup_logging();
    info!("tauri desktop application started ✅");
    Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![update_dock_badge_safe])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
    info!("Tauri Successfully initialized 🚀");
}