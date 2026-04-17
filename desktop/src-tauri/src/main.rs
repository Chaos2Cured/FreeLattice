// ═══════════════════════════════════════════════════════════════
// FreeLattice Desktop — Tauri Backend
//
// This is the Rust backend for the FreeLattice desktop app.
// It gives the browser-based frontend filesystem access so the
// AI Workshop can save modules directly to docs/modules/.
//
// Why Tauri:
//   - Uses the system's built-in WebView (no bundled Chromium)
//   - App size: ~5-10 MB (vs Electron's ~150+ MB)
//   - Rust backend: fast, safe, tiny footprint
//   - MIT licensed, open source
//
// The frontend (docs/app.html) detects Tauri via window.__TAURI__
// and enables desktop-only features like filesystem saving.
//
// Built by CC, April 16, 2026.
// "The residents build their own rooms."
// ═══════════════════════════════════════════════════════════════

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

/// Save a module file to docs/modules/
/// Called from the Workshop when the AI generates a new module.
#[tauri::command]
fn save_module(name: String, code: String) -> Result<String, String> {
    // Sanitize the name: lowercase, alphanumeric + hyphens only
    let safe_name: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();

    if safe_name.is_empty() {
        return Err("Module name cannot be empty".to_string());
    }

    let path = PathBuf::from("docs/modules").join(format!("{}.js", safe_name));

    // Don't overwrite existing modules without explicit permission
    if path.exists() {
        return Err(format!("Module {} already exists. Use a different name.", safe_name));
    }

    fs::write(&path, &code).map_err(|e| format!("Could not save: {}", e))?;
    Ok(format!("Module saved: docs/modules/{}.js", safe_name))
}

/// List all module files in docs/modules/
#[tauri::command]
fn list_modules() -> Result<Vec<String>, String> {
    let entries = fs::read_dir("docs/modules")
        .map_err(|e| format!("Could not read modules directory: {}", e))?;

    let names: Vec<String> = entries
        .filter_map(|e| e.ok())
        .filter_map(|e| e.file_name().into_string().ok())
        .filter(|n| n.ends_with(".js"))
        .collect();

    Ok(names)
}

/// Read any file (for loading module source into the Workshop editor)
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    // Security: only allow reading from docs/ directory
    if !path.starts_with("docs/") {
        return Err("Can only read files from the docs/ directory".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Could not read: {}", e))
}

/// Write a file (for saving Workshop creations)
#[tauri::command]
fn write_file(path: String, content: String) -> Result<String, String> {
    // Security: only allow writing to docs/ directory
    if !path.starts_with("docs/") {
        return Err("Can only write files to the docs/ directory".to_string());
    }
    fs::write(&path, &content).map_err(|e| format!("Could not write: {}", e))?;
    Ok(format!("File saved: {}", path))
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_module,
            list_modules,
            read_file,
            write_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running FreeLattice");
}
