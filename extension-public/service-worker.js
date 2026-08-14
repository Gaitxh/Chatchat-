import {
  isTextualContent,
  observeTextSource,
  publicEvidenceUrl,
} from "./source-extract.js";
import { claimProviderRecovery } from "./recovery-claims.js";

const MAX_EVIDENCE_BYTES = 256 * 1024;
const EVIDENCE_TIMEOUT_MS = 8_000;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const INSPECT_PROVIDER_PAGE = "INSPECT_PROVIDER_PAGE";
const CLAIM_PROVIDER_SELF_HEALING = "CLAIM_PROVIDER_SELF_HEALING";

const configurePrimaryAction = async () => {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
  } catch (error) {
    console.warn("ChatChat could not configure the primary Full Room action", error);
  }
};

chrome.runtime.onInstalled.addListener(() => {
  void configurePrimaryAction();
});

chrome.runtime.onStartup.addListener(() => {
  void configurePrimaryAction();
});

chrome.action.onClicked.addListener(() => {
  void openFullRoom();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === INSPECT_PROVIDER_PAGE) {
    inspectProviderPage(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
  }

  if (message?.type === CLAIM_PROVIDER_SELF_HEALING) {
    sendResponse({
      ok: true,
      claimed: claimProviderRecovery(message.seatId, message.tabId),
    });
    return false;
  }

  if (message?.type !== "VERIFY_EVIDENCE_SOURCE") return undefined;
  verifyEvidenceSource(String(message.url ?? ""))
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }));
  return true;
});

async function openFullRoom() {
  const appUrl = chrome.runtime.getURL("app/app.html");
  try {
    const tabs = await chrome.tabs.query({});
    const existing = tabs.find((tab) => typeof tab.url === "string" && tab.url.startsWith(appUrl));
    if (existing?.id) {
      await chrome.tabs.update(existing.id, { active: true });
      if (typeof existing.windowId === "number" && chrome.windows?.update) {
        await chrome.windows.update(existing.windowId, { focused: true }).catch(() => undefined);
      }
      return;
    }
    await chrome.tabs.create({ url: appUrl, active: true });
  } catch (error) {
    console.warn("ChatChat could not open the Full Room", error);
  }
}

async function inspectProviderPage(message) {
  const tabId = Number(message?.tabId);
  if (!Number.isInteger(tabId)) throw new Error("Provider page inspection requires a valid tab id.");
  const expectedOrigin = normalizedOrigin(message?.expectedOrigin);
  if (!expectedOrigin) throw new Error("Provider page inspection requires a valid expected origin.");

  const tab = await chrome.tabs.get(tabId);
  const url = String(tab?.url ?? "");
  const title = String(tab?.title ?? "");
  const urlMatchesProvider = normalizedOrigin(url) === expectedOrigin;
  if (!urlMatchesProvider) {
    return {
      url,
      title,
      urlMatchesProvider,
      passwordInputs: 0,
      loginControls: 0,
      composerCandidates: 0,
    };
  }

  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const visible = (element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      };
      const loginPhrases = ["log in", "login", "sign in", "登录", "登入", "connexion", "iniciar sesión"];
      const bodyText = String(document.body?.innerText ?? "").slice(0, 80_000).toLocaleLowerCase();
      const visibleControls = [...document.querySelectorAll("button,a,[role='button']")].filter((element) => visible(element));
      const loginControls = visibleControls.filter((element) => {
        const text = String(element.textContent ?? "").toLocaleLowerCase();
        return loginPhrases.some((phrase) => text.includes(phrase));
      }).length;
      const passwordInputs = [...document.querySelectorAll("input[type='password']")]
        .filter((element) => visible(element)).length;
      const composerCandidates = [...document.querySelectorAll("textarea,[contenteditable='true'],div[role='textbox']")]
        .filter((element) => visible(element)).length;
      return {
        passwordInputs,
        loginControls: loginControls + (loginPhrases.some((phrase) => bodyText.includes(phrase)) ? 1 : 0),
        composerCandidates,
      };
    },
  });

  return {
    url,
    title,
    urlMatchesProvider,
    passwordInputs: Number(result?.passwordInputs ?? 0),
    loginControls: Number(result?.loginControls ?? 0),
    composerCandidates: Number(result?.composerCandidates ?? 0),
  };
}

function normalizedOrigin(value) {
  try {
    const parsed = new URL(String(value ?? ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : "";
  } catch {
    return "";
  }
}

async function verifyEvidenceSource(rawUrl) {
  const url = publicEvidenceUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EVIDENCE_TIMEOUT_MS);
  const observedAt = new Date().toISOString();

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "omit",
      // Never follow a redirect here. A public URL can redirect to localhost or a
      // private network; validating only response.url after following would be too late.
      redirect: "manual",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.4",
      },
    });

    if (response.type === "opaqueredirect" || REDIRECT_STATUS_CODES.has(response.status)) {
      throw new Error("Evidence source redirected. ChatChat does not follow redirects for safety; verify the final public URL directly.");
    }

    const finalUrl = publicEvidenceUrl(response.url || url.toString());
    const contentType = (response.headers.get("content-type") ?? "").slice(0, 160);
    const declaredLength = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_EVIDENCE_BYTES * 4) {
      return {
        state: response.ok ? "reachable" : "unavailable",
        observedAt,
        requestedUrl: url.toString(),
        finalUrl: finalUrl.toString(),
        statusCode: response.status,
        contentType,
        bytesRead: 0,
        truncated: true,
        error: "Source response is too large for ChatChat's bounded verifier.",
      };
    }

    const body = await readBoundedText(response, MAX_EVIDENCE_BYTES);
    const observation = isTextualContent(contentType, body.text)
      ? await observeTextSource(body.text, contentType)
      : {};

    return {
      state: response.ok ? "reachable" : "unavailable",
      observedAt,
      requestedUrl: url.toString(),
      finalUrl: finalUrl.toString(),
      statusCode: response.status,
      contentType,
      ...observation,
      bytesRead: body.bytesRead,
      truncated: body.truncated,
      ...(!response.ok ? { error: `HTTP ${response.status}` } : {}),
    };
  } catch (error) {
    return {
      state: "unavailable",
      observedAt,
      requestedUrl: url.toString(),
      error: verifierErrorMessage(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function verifierErrorMessage(error) {
  if (error?.name === "AbortError") return "Source check timed out.";
  if (error instanceof Error && error.message.startsWith("Evidence source redirected.")) {
    return error.message;
  }
  return "Source could not be reached by the bounded verifier.";
}

async function readBoundedText(response, maxBytes) {
  if (!response.body) return { text: "", bytesRead: 0, truncated: false };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytesRead = 0;
  let truncated = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      const remaining = maxBytes - bytesRead;
      if (remaining <= 0) {
        truncated = true;
        break;
      }
      const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
      bytesRead += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (chunk.byteLength < value.byteLength || bytesRead >= maxBytes) {
        truncated = true;
        break;
      }
    }
    text += decoder.decode();
  } finally {
    if (truncated) await reader.cancel().catch(() => undefined);
    else reader.releaseLock();
  }

  return { text, bytesRead, truncated };
}

void configurePrimaryAction();
