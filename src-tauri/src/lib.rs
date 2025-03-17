// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;

// #[cfg(target_os = "macos")]
// use objc::{class, msg_send, sel, sel_impl};
// #[cfg(target_os = "macos")]
// use cocoa::base::{id, nil};
// #[cfg(target_os = "macos")]
// use cocoa::foundation::NSString;

// #[tauri::command]
// async fn update_dock_badge(_app: AppHandle, count: u32) -> Result<(), String> {
//     #[cfg(target_os = "macos")]
//     unsafe {
//         // Get the shared application
//         let app: id = msg_send![class!(NSApplication), sharedApplication];
//
//         // Get the dock tile
//         let dock_tile: id = msg_send![app, dockTile];
//
//         if count > 0 {
//             // Format the badge text
//             let badge_text = if count > 99 { "99+".to_string() } else { count.to_string() };
//
//             // Create NSString for badge
//             let badge_str = NSString::alloc(nil).init_str(&badge_text);
//
//             // Set the badge
//             let _: () = msg_send![dock_tile, setBadgeLabel:badge_str];
//         } else {
//             // Clear the badge
//             let _: () = msg_send![dock_tile, setBadgeLabel:nil];
//         }
//     }
//
//     Ok(())
// }

#[tauri::command]
fn update_dock_badge_safe(app_handle: tauri::AppHandle, count: u32) -> Result<(), String> {
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

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn greet_2(name: &str) -> String {
    format!("Hello pidor, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![greet_2])
        // .invoke_handler(tauri::generate_handler![update_dock_badge])
        .invoke_handler(tauri::generate_handler![update_dock_badge_safe])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
