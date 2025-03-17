use tauri::Manager;

#[tauri::command]
pub fn update_dock_badge_safe(app_handle: tauri::AppHandle, count: u32) -> Result<(), String> {
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