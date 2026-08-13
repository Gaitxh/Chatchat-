use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::Manager;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCouncilPrepareRequest {
    profile_id: String,
    expected_origin: String,
    start_url: String,
    composer_selector: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ComposerReadySnapshot {
    ok: bool,
    found: bool,
    input_type: Option<String>,
    ready_state: String,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderCouncilPrepareResult {
    url: String,
    ready_state: String,
    elapsed_ms: u128,
}

#[tauri::command]
pub async fn prepare_provider_council_session(
    app_handle: tauri::AppHandle,
    webview_window: tauri::WebviewWindow,
    request: ProviderCouncilPrepareRequest,
) -> Result<ProviderCouncilPrepareResult, String> {
    ensure_main_caller(&webview_window)?;
    validate_selector(&request.composer_selector)?;

    let expected = tauri::Url::parse(&request.expected_origin).map_err(|error| error.to_string())?;
    let target = tauri::Url::parse(&request.start_url).map_err(|error| error.to_string())?;
    if !matches!(target.scheme(), "http" | "https") {
        return Err("Council start URL must use http/https.".into());
    }
    if !same_provider_host(&target, &expected) {
        return Err("Council start URL must stay on the Provider host.".into());
    }

    let provider = app_handle
        .get_webview_window(&provider_window_label(&request.profile_id))
        .ok_or("Provider login window is not open.")?;
    let current = provider.url().map_err(|error| error.to_string())?;
    if !same_provider_host(&current, &expected) {
        return Err(format!(
            "Provider is currently on {}. Finish login and return to {} before opening Council.",
            current.origin().ascii_serialization(),
            expected.origin().ascii_serialization()
        ));
    }

    provider.navigate(target).map_err(|error| error.to_string())?;
    let started = Instant::now();
    let timeout = Duration::from_secs(35);
    let script = composer_ready_script(&request.composer_selector);

    loop {
        tokio::time::sleep(Duration::from_millis(450)).await;
        let current = provider.url().map_err(|error| error.to_string())?;
        if !same_provider_host(&current, &expected) {
            if started.elapsed() > Duration::from_secs(8) {
                return Err(format!(
                    "Provider redirected to {} while preparing a fresh Council session. Re-open the Provider window and sign in again.",
                    current.origin().ascii_serialization()
                ));
            }
            continue;
        }

        if let Ok(value) = eval_json(&provider, script.clone()).await {
            if let Ok(snapshot) = serde_json::from_value::<ComposerReadySnapshot>(value) {
                if !snapshot.ok {
                    if let Some(error) = snapshot.error {
                        return Err(format!("Provider composer readiness probe failed: {error}"));
                    }
                } else if snapshot.found {
                    if snapshot
                        .input_type
                        .as_deref()
                        .is_some_and(|value| value.eq_ignore_ascii_case("password"))
                    {
                        return Err("ChatChat refuses to use a password field as the Council composer.".into());
                    }
                    return Ok(ProviderCouncilPrepareResult {
                        url: current.to_string(),
                        ready_state: snapshot.ready_state,
                        elapsed_ms: started.elapsed().as_millis(),
                    });
                }
            }
        }

        if started.elapsed() >= timeout {
            return Err(format!(
                "Provider did not expose the taught composer within {} seconds after navigating to the Council start page.",
                timeout.as_secs()
            ));
        }
    }
}

fn composer_ready_script(selector: &str) -> String {
    let selector_json = serde_json::to_string(selector).expect("selector JSON");
    format!(
        "(() => {{ const selector = {selector_json}; try {{ const element = document.querySelector(selector); return {{ ok: true, found: Boolean(element), inputType: element instanceof HTMLInputElement ? element.type : null, readyState: document.readyState, error: null }}; }} catch (error) {{ return {{ ok: false, found: false, inputType: null, readyState: document.readyState, error: String(error) }}; }} }})()"
    )
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
    let raw = tokio::time::timeout(Duration::from_secs(5), receiver)
        .await
        .map_err(|_| "Provider readiness callback timed out.".to_string())?
        .map_err(|_| "Provider readiness callback closed before returning.".to_string())?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("Provider readiness callback returned invalid JSON: {error}"))
}

fn validate_selector(selector: &str) -> Result<(), String> {
    if selector.trim().is_empty() || selector.len() > 512 || selector.contains('\0') {
        Err("Invalid taught composer selector.".into())
    } else {
        Ok(())
    }
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
        Err("Provider session preparation may only be called by the main ChatChat window.".into())
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
