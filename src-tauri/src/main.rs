// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use bitbucket_notifier_lib::tauri_dock_badge;

fn main() {
    tauri_dock_badge::run()
}
