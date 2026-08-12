use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{Manager, WebviewUrl};
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:chatchat.db";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderLoginRequest {
    profile_id: String,
    profile_key: String,
    url: String,
    display_name: String,
}

#[derive(Debug, Serialize)]
struct ProviderLoginWindowResult {
    label: String,
    reused: bool,
}

#[tauri::command]
async fn open_provider_login(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderLoginRequest,
) -> Result<ProviderLoginWindowResult, String> {
    ensure_main_caller(&webview_window)?;
    let url = tauri::Url::parse(&request.url).map_err(|error| error.to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" {
        return Err("Provider login only supports http/https URLs.".into());
    }

    let label = provider_window_label(&request.profile_id);
    if let Some(existing) = app_handle.get_webview_window(&label) {
        existing.show().map_err(|error| error.to_string())?;
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(ProviderLoginWindowResult { label, reused: true });
    }

    let mut builder = tauri::WebviewWindowBuilder::new(
        &app_handle,
        &label,
        WebviewUrl::External(url),
    )
    .title(format!("ChatChat Login — {}", request.display_name))
    .inner_size(1180.0, 820.0)
    .min_inner_size(760.0, 620.0)
    .resizable(true)
    .center()
    .on_navigation(|url| matches!(url.scheme(), "http" | "https"));

    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|error| error.to_string())?
            .join("provider-webviews")
            .join(&request.profile_key);
        std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
        builder = builder.data_directory(data_dir);
    }

    #[cfg(target_os = "macos")]
    {
        builder = builder.data_store_identifier(profile_store_identifier(&request.profile_key));
    }

    builder.build().map_err(|error| error.to_string())?;
    Ok(ProviderLoginWindowResult { label, reused: false })
}

#[tauri::command]
async fn close_provider_login(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    profile_id: String,
) -> Result<(), String> {
    ensure_main_caller(&webview_window)?;
    if let Some(window) = app_handle.get_webview_window(&provider_window_label(&profile_id)) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn ensure_main_caller(webview_window: &tauri::WebviewWindow) -> Result<(), String> {
    if webview_window.label() != "main" {
        return Err("Provider login commands may only be called by the main ChatChat window.".into());
    }
    Ok(())
}

fn provider_window_label(profile_id: &str) -> String {
    let safe: String = profile_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | ':' | '/') {
                character
            } else {
                '_'
            }
        })
        .collect();
    format!("provider-{safe}")
}

#[cfg(target_os = "macos")]
fn profile_store_identifier(profile_key: &str) -> [u8; 16] {
    let digest = Sha256::digest(profile_key.as_bytes());
    let mut identifier = [0u8; 16];
    identifier.copy_from_slice(&digest[..16]);
    identifier
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration { version: 1, description: "create_council_history", sql: include_str!("../migrations/0001_council_history.sql"), kind: MigrationKind::Up },
        Migration { version: 2, description: "create_provider_profiles", sql: include_str!("../migrations/0002_provider_profiles.sql"), kind: MigrationKind::Up },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![open_provider_login, close_provider_login])
        .run(tauri::generate_context!())
        .expect("error while running ChatChat");
}
