use serde::Serialize;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;

pub const PROVIDER_WINDOW_HEALTH_EVENT: &str = "provider-window-health";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderWindowHealthEvent {
    profile_id: String,
    state: String,
    url: Option<String>,
    on_provider_host: bool,
    observed_at: String,
}

pub fn emit_page_health(
    app_handle: &tauri::AppHandle,
    profile_id: &str,
    expected_origin: &str,
    url: &tauri::Url,
) {
    let expected = tauri::Url::parse(expected_origin).ok();
    let on_provider_host = expected
        .as_ref()
        .is_some_and(|expected| same_provider_host(url, expected));
    let state = if on_provider_host { "provider" } else { "external" };
    let _ = app_handle.emit_to(
        "main",
        PROVIDER_WINDOW_HEALTH_EVENT,
        ProviderWindowHealthEvent {
            profile_id: profile_id.to_string(),
            state: state.to_string(),
            url: Some(url.to_string()),
            on_provider_host,
            observed_at: observed_at(),
        },
    );
}

pub fn emit_closed_health(app_handle: &tauri::AppHandle, profile_id: &str) {
    let _ = app_handle.emit_to(
        "main",
        PROVIDER_WINDOW_HEALTH_EVENT,
        ProviderWindowHealthEvent {
            profile_id: profile_id.to_string(),
            state: "closed".into(),
            url: None,
            on_provider_host: false,
            observed_at: observed_at(),
        },
    );
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

fn observed_at() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".into())
}
