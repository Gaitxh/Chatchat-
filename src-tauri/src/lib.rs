use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, WebviewUrl};
use tauri_plugin_sql::{Migration, MigrationKind};

const DATABASE_URL: &str = "sqlite:chatchat.db";
const PROVIDER_PROBE_SCRIPT: &str = r#"
(() => {
  try {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const describe = (element) => ({
      tag: element.tagName.toLowerCase(),
      id: element.id || null,
      role: element.getAttribute('role'),
      ariaLabel: element.getAttribute('aria-label'),
      placeholder: element.getAttribute('placeholder'),
      dataTestId: element.getAttribute('data-testid'),
      inputType: element.getAttribute('type'),
      contentEditable: element.isContentEditable === true,
      disabled: element.matches(':disabled')
    });
    const composerSelector = 'textarea, [contenteditable="true"], input[type="text"], input:not([type])';
    const composers = Array.from(document.querySelectorAll(composerSelector))
      .filter(visible)
      .slice(0, 12)
      .map(describe);
    const actions = Array.from(document.querySelectorAll('button'))
      .filter(visible)
      .map(describe)
      .filter((item) => item.id || item.role || item.ariaLabel || item.dataTestId)
      .slice(0, 24);
    return {
      ok: true,
      url: window.location.href,
      origin: window.location.origin,
      title: document.title,
      readyState: document.readyState,
      composerCandidates: composers,
      actionCandidates: actions,
      counts: {
        forms: document.forms.length,
        textareas: document.querySelectorAll('textarea').length,
        contentEditables: document.querySelectorAll('[contenteditable="true"]').length,
        buttons: document.querySelectorAll('button').length
      },
      probedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      ok: false,
      url: window.location.href,
      origin: window.location.origin,
      title: document.title,
      readyState: document.readyState,
      composerCandidates: [],
      actionCandidates: [],
      counts: { forms: 0, textareas: 0, contentEditables: 0, buttons: 0 },
      probedAt: new Date().toISOString(),
      error: String(error)
    };
  }
})()
"#;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderLoginRequest { profile_id: String, profile_key: String, url: String, display_name: String }

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderProbeRequest { profile_id: String, expected_origin: String }

#[derive(Debug, Serialize)]
struct ProviderLoginWindowResult { label: String, reused: bool }

#[tauri::command]
async fn open_provider_login(app_handle: tauri::AppHandle, webview_window: tauri::WebviewWindow, request: ProviderLoginRequest) -> Result<ProviderLoginWindowResult, String> {
    ensure_main_caller(&webview_window)?;
    let url = tauri::Url::parse(&request.url).map_err(|error| error.to_string())?;
    if url.scheme() != "https" && url.scheme() != "http" { return Err("Provider login only supports http/https URLs.".into()); }
    let label = provider_window_label(&request.profile_id);
    if let Some(existing) = app_handle.get_webview_window(&label) {
        existing.show().map_err(|error| error.to_string())?;
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(ProviderLoginWindowResult { label, reused: true });
    }
    let mut builder = tauri::WebviewWindowBuilder::new(&app_handle, &label, WebviewUrl::External(url))
        .title(format!("ChatChat Login — {}", request.display_name))
        .inner_size(1180.0, 820.0)
        .min_inner_size(760.0, 620.0)
        .resizable(true)
        .center()
        .on_navigation(|url| matches!(url.scheme(), "http" | "https"));
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let data_dir = app_handle.path().app_data_dir().map_err(|error| error.to_string())?.join("provider-webviews").join(&request.profile_key);
        std::fs::create_dir_all(&data_dir).map_err(|error| error.to_string())?;
        builder = builder.data_directory(data_dir);
    }
    #[cfg(target_os = "macos")]
    { builder = builder.data_store_identifier(profile_store_identifier(&request.profile_key)); }
    builder.build().map_err(|error| error.to_string())?;
    Ok(ProviderLoginWindowResult { label, reused: false })
}

#[tauri::command]
async fn probe_provider_page(app_handle: tauri::AppHandle, webview_window: tauri::WebviewWindow, request: ProviderProbeRequest) -> Result<serde_json::Value, String> {
    ensure_main_caller(&webview_window)?;
    let provider_window = app_handle.get_webview_window(&provider_window_label(&request.profile_id)).ok_or("Provider login window is not open.")?;
    let current_url = provider_window.url().map_err(|error| error.to_string())?;
    let expected = tauri::Url::parse(&request.expected_origin).map_err(|error| error.to_string())?;
    if !same_provider_host(&current_url, &expected) {
        return Err(format!("Provider is currently on {}. Navigate back to {} before probing.", current_url.origin().ascii_serialization(), expected.origin().ascii_serialization()));
    }
    eval_json(&provider_window, PROVIDER_PROBE_SCRIPT).await
}

#[tauri::command]
async fn close_provider_login(app_handle: tauri::AppHandle, webview_window: tauri::WebviewWindow, profile_id: String) -> Result<(), String> {
    ensure_main_caller(&webview_window)?;
    if let Some(window) = app_handle.get_webview_window(&provider_window_label(&profile_id)) { window.close().map_err(|error| error.to_string())?; }
    Ok(())
}

async fn eval_json(window: &tauri::WebviewWindow, script: impl Into<String>) -> Result<serde_json::Value, String> {
    let (sender, receiver) = tokio::sync::oneshot::channel::<String>();
    let sender = Arc::new(Mutex::new(Some(sender)));
    let callback_sender = Arc::clone(&sender);
    window.eval_with_callback(script, move |result| {
        if let Ok(mut guard) = callback_sender.lock() {
            if let Some(sender) = guard.take() { let _ = sender.send(result); }
        }
    }).map_err(|error| error.to_string())?;
    let raw = tokio::time::timeout(Duration::from_secs(8), receiver)
        .await
        .map_err(|_| "Provider probe timed out.".to_string())?
        .map_err(|_| "Provider probe callback closed before returning.".to_string())?;
    serde_json::from_str(&raw).map_err(|error| format!("Provider probe returned invalid JSON: {error}"))
}

fn same_provider_host(current: &tauri::Url, expected: &tauri::Url) -> bool {
    if !matches!(current.scheme(), "http" | "https") { return false; }
    let Some(current_host) = current.host_str() else { return false; };
    let Some(expected_host) = expected.host_str() else { return false; };
    current_host.eq_ignore_ascii_case(expected_host) || current_host.to_ascii_lowercase().ends_with(&format!(".{}", expected_host.to_ascii_lowercase()))
}

fn ensure_main_caller(webview_window: &tauri::WebviewWindow) -> Result<(), String> { if webview_window.label() != "main" { Err("Provider commands may only be called by the main ChatChat window.".into()) } else { Ok(()) } }
fn provider_window_label(profile_id: &str) -> String { let safe: String = profile_id.chars().map(|character| if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | ':' | '/') { character } else { '_' }).collect(); format!("provider-{safe}") }
#[cfg(target_os = "macos")]
fn profile_store_identifier(profile_key: &str) -> [u8; 16] { let digest = Sha256::digest(profile_key.as_bytes()); let mut identifier = [0u8; 16]; identifier.copy_from_slice(&digest[..16]); identifier }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration { version: 1, description: "create_council_history", sql: include_str!("../migrations/0001_council_history.sql"), kind: MigrationKind::Up }, Migration { version: 2, description: "create_provider_profiles", sql: include_str!("../migrations/0002_provider_profiles.sql"), kind: MigrationKind::Up }];
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().add_migrations(DATABASE_URL, migrations).build())
        .invoke_handler(tauri::generate_handler![open_provider_login, probe_provider_page, close_provider_login])
        .run(tauri::generate_context!())
        .expect("error while running ChatChat");
}
