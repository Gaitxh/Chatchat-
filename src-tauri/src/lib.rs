use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager, WebviewUrl};
use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg(target_os = "macos")]
use sha2::{Digest, Sha256};

const DATABASE_URL: &str = "sqlite:chatchat.db";
const PROVIDER_PROBE_SCRIPT: &str = include_str!("provider_probe.js");
const PROVIDER_TEACH_SCRIPT: &str = include_str!("provider_teach.js");

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderLoginRequest {
    profile_id: String,
    profile_key: String,
    url: String,
    display_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderProbeRequest {
    profile_id: String,
    expected_origin: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderTeachRequest {
    profile_id: String,
    expected_origin: String,
    role: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderTeachReadRequest {
    profile_id: String,
    expected_origin: String,
}

#[derive(Debug, Serialize)]
struct ProviderLoginWindowResult {
    label: String,
    reused: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderTeachEvent {
    profile_id: String,
}

#[tauri::command]
async fn open_provider_login(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderLoginRequest,
) -> Result<ProviderLoginWindowResult, String> {
    ensure_main_caller(&webview_window)?;

    let url = tauri::Url::parse(&request.url).map_err(|error| error.to_string())?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err("Provider login only supports http/https URLs.".into());
    }

    let label = provider_window_label(&request.profile_id);
    if let Some(existing) = app_handle.get_webview_window(&label) {
        existing.show().map_err(|error| error.to_string())?;
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(ProviderLoginWindowResult {
            label,
            reused: true,
        });
    }

    let navigation_app = app_handle.clone();
    let navigation_profile = request.profile_id.clone();
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
    .on_navigation(move |url| {
        if url.scheme() == "chatchat-teach" {
            let _ = navigation_app.emit_to(
                "main",
                "provider-teach-selected",
                ProviderTeachEvent {
                    profile_id: navigation_profile.clone(),
                },
            );
            return false;
        }

        matches!(url.scheme(), "http" | "https")
    });

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

    Ok(ProviderLoginWindowResult {
        label,
        reused: false,
    })
}

#[tauri::command]
async fn probe_provider_page(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderProbeRequest,
) -> Result<serde_json::Value, String> {
    ensure_main_caller(&webview_window)?;
    let provider = provider_window_for_host(
        &app_handle,
        &request.profile_id,
        &request.expected_origin,
    )?;
    eval_json(&provider, PROVIDER_PROBE_SCRIPT).await
}

#[tauri::command]
async fn start_provider_teach(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderTeachRequest,
) -> Result<(), String> {
    ensure_main_caller(&webview_window)?;
    if !matches!(request.role.as_str(), "composer" | "send" | "response") {
        return Err("Unknown Teach Mode role.".into());
    }

    let provider = provider_window_for_host(
        &app_handle,
        &request.profile_id,
        &request.expected_origin,
    )?;
    let role_json = serde_json::to_string(&request.role).map_err(|error| error.to_string())?;

    provider
        .eval(build_teach_script(&role_json))
        .map_err(|error| error.to_string())?;
    provider.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
async fn read_provider_teach(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderTeachReadRequest,
) -> Result<serde_json::Value, String> {
    ensure_main_caller(&webview_window)?;
    let provider = provider_window_for_host(
        &app_handle,
        &request.profile_id,
        &request.expected_origin,
    )?;

    eval_json(
        &provider,
        "(() => { const value = window.__CHATCHAT_TEACH_SELECTION__ ?? null; window.__CHATCHAT_TEACH_SELECTION__ = null; return value; })()",
    )
    .await
}

#[tauri::command]
async fn cancel_provider_teach(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderTeachReadRequest,
) -> Result<(), String> {
    ensure_main_caller(&webview_window)?;
    let provider = provider_window_for_host(
        &app_handle,
        &request.profile_id,
        &request.expected_origin,
    )?;

    provider
        .eval(
            "(() => { window.__CHATCHAT_TEACH_CLEANUP__?.(); window.__CHATCHAT_TEACH_SELECTION__ = null; })()",
        )
        .map_err(|error| error.to_string())
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

fn provider_window_for_host(
    app_handle: &tauri::AppHandle,
    profile_id: &str,
    expected_origin: &str,
) -> Result<tauri::WebviewWindow, String> {
    let window = app_handle
        .get_webview_window(&provider_window_label(profile_id))
        .ok_or("Provider login window is not open.")?;
    let current = window.url().map_err(|error| error.to_string())?;
    let expected = tauri::Url::parse(expected_origin).map_err(|error| error.to_string())?;

    if !same_provider_host(&current, &expected) {
        return Err(format!(
            "Provider is currently on {}. Navigate back to {} before using the Adapter Lab.",
            current.origin().ascii_serialization(),
            expected.origin().ascii_serialization(),
        ));
    }

    Ok(window)
}

async fn eval_json(
    window: &tauri::WebviewWindow,
    script: impl Into<String>,
) -> Result<serde_json::Value, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    let callback_sender = Arc::clone(&sender);

    window
        .eval_with_callback(script, move |result| {
            if let Ok(mut guard) = callback_sender.lock() {
                if let Some(sender) = guard.take() {
                    let _ = sender.send(result);
                }
            }
        })
        .map_err(|error| error.to_string())?;

    let raw = tokio::time::timeout(Duration::from_secs(8), receiver)
        .await
        .map_err(|_| "Provider callback timed out.".to_string())?
        .map_err(|_| "Provider callback closed before returning.".to_string())?;

    serde_json::from_str(&raw)
        .map_err(|error| format!("Provider callback returned invalid JSON: {error}"))
}

fn build_teach_script(role_json: &str) -> String {
    PROVIDER_TEACH_SCRIPT.replace("__CHATCHAT_ROLE_JSON__", role_json)
}

fn same_provider_host(current: &tauri::Url, expected: &tauri::Url) -> bool {
    if !matches!(current.scheme(), "http" | "https") {
        return false;
    }

    let (Some(current_host), Some(expected_host)) = (current.host_str(), expected.host_str()) else {
        return false;
    };

    current_host.eq_ignore_ascii_case(expected_host)
        || current_host
            .to_ascii_lowercase()
            .ends_with(&format!(".{}", expected_host.to_ascii_lowercase()))
}

fn ensure_main_caller(window: &tauri::WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        Err("Provider commands may only be called by the main ChatChat window.".into())
    } else {
        Ok(())
    }
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
        Migration {
            version: 1,
            description: "create_council_history",
            sql: include_str!("../migrations/0001_council_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_provider_profiles",
            sql: include_str!("../migrations/0002_provider_profiles.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_adapter_recipes",
            sql: include_str!("../migrations/0003_adapter_recipes.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DATABASE_URL, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            open_provider_login,
            probe_provider_page,
            start_provider_teach,
            read_provider_teach,
            cancel_provider_teach,
            close_provider_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ChatChat");
}
