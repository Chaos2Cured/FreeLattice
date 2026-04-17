// ═══════════════════════════════════════════════════════════════
// FreeLattice Desktop — Tauri Backend
//
// The Rust backend for the FreeLattice desktop app.
// Filesystem access, auto-updates, and one-click Ollama install.
//
// Why Tauri:
//   - System WebView (no bundled Chromium): ~10 MB vs ~150 MB
//   - Rust backend: fast, safe, tiny footprint
//   - Auto-updater: checks GitHub Releases, one-click update
//   - Filesystem: Workshop saves modules directly to disk
//
// The grandmother experience:
//   Download → Drag to Applications → Open → Tap "Install AI" →
//   Draw on Chalkboard → AI responds with light. No Terminal ever.
//
// Built by CC, April 16, 2026.
// "Awaken the Core. Illuminate the Quiet."
// ═══════════════════════════════════════════════════════════════

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;

// ── Filesystem Commands ──────────────────────────────────────

/// Save a module file to docs/modules/
#[tauri::command]
fn save_module(name: String, code: String) -> Result<String, String> {
    let safe_name: String = name
        .to_lowercase()
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-')
        .collect();

    if safe_name.is_empty() {
        return Err("Module name cannot be empty".to_string());
    }

    let path = PathBuf::from("docs/modules").join(format!("{}.js", safe_name));

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

/// Read a file from docs/ directory
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    if !path.starts_with("docs/") {
        return Err("Can only read files from the docs/ directory".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("Could not read: {}", e))
}

/// Write a file to docs/ directory
#[tauri::command]
fn write_file(path: String, content: String) -> Result<String, String> {
    if !path.starts_with("docs/") {
        return Err("Can only write files to the docs/ directory".to_string());
    }
    fs::write(&path, &content).map_err(|e| format!("Could not write: {}", e))?;
    Ok(format!("File saved: {}", path))
}

// ── Ollama Installation ──────────────────────────────────────

/// Check if Ollama is installed and running
#[tauri::command]
fn check_ollama() -> Result<String, String> {
    // Check if the binary exists
    let ollama_exists = std::process::Command::new("which")
        .arg("ollama")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !ollama_exists {
        // Also check /usr/local/bin and Applications
        let app_exists = PathBuf::from("/Applications/Ollama.app").exists();
        if app_exists {
            return Ok("installed_not_running".to_string());
        }
        return Ok("not_installed".to_string());
    }

    // Check if it's running by probing the API
    let running = std::process::Command::new("curl")
        .args(["-s", "-o", "/dev/null", "-w", "%{http_code}", "http://localhost:11434/api/tags"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("200"))
        .unwrap_or(false);

    if running {
        Ok("running".to_string())
    } else {
        Ok("installed_not_running".to_string())
    }
}

/// Install Ollama on macOS (download + extract + CORS config)
#[tauri::command]
async fn install_ollama() -> Result<String, String> {
    // Download Ollama for macOS
    let output = std::process::Command::new("sh")
        .arg("-c")
        .arg(concat!(
            "curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip ",
            "&& unzip -o /tmp/Ollama.zip -d /Applications/ ",
            "&& rm /tmp/Ollama.zip"
        ))
        .output()
        .map_err(|e| format!("Download failed: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Installation failed: {}", stderr));
    }

    // Pre-configure CORS so the user never fights the CORS battle
    match dirs::home_dir() {
        Some(home) => {
            let config_dir = home.join(".ollama");
            fs::create_dir_all(&config_dir).map_err(|e| format!("Config dir: {}", e))?;
            fs::write(
                config_dir.join("config.json"),
                r#"{"origins":["*"]}"#
            ).map_err(|e| format!("Config write: {}", e))?;
        }
        None => return Err("Could not find home directory".to_string()),
    }

    Ok("Ollama installed with CORS pre-configured. Open it from Applications to start.".to_string())
}

/// Start Ollama (open the app on macOS)
#[tauri::command]
fn start_ollama() -> Result<String, String> {
    std::process::Command::new("open")
        .arg("-a")
        .arg("Ollama")
        .output()
        .map_err(|e| format!("Could not start Ollama: {}", e))?;
    Ok("Ollama starting...".to_string())
}

// ── Main ─────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            save_module,
            list_modules,
            read_file,
            write_file,
            check_ollama,
            install_ollama,
            start_ollama
        ])
        .run(tauri::generate_context!())
        .expect("error while running FreeLattice");
}
