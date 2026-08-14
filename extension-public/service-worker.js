import {
  isTextualContent,
  observeTextSource,
  publicEvidenceUrl,
} from "./source-extract.js";
import { createRecoveryClaimRegistry } from "./recovery-claims.js";

const MAX_EVIDENCE_BYTES = 256 * 1024;
const EVIDENCE_TIMEOUT_MS = 8_000;
const providerRecoveryClaims = createRecoveryClaimRegistry();

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
  if (message?.type === "CLAIM_PROVIDER_SELF_HEALING") {
    const seatId = String(message.seatId ?? "");
    sendResponse({ ok: true, result: { claimed: providerRecoveryClaims.claim(seatId) } });
    return undefined;
  }

  if (message?.type === "RELEASE_PROVIDER_SELF_HEALING") {
    const seatId = String(message.seatId ?? "");
    sendResponse({ ok: true, result: { released: providerRecoveryClaims.release(seatId) } });
    return undefined;
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

async function verifyEvidenceSource(rawUrl) {
  const url = publicEvidenceUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EVIDENCE_TIMEOUT_MS);
  const observedAt = new Date().toISOString();

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      credentials: "omit",
      redirect: "follow",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
      headers: {
        Accept: "text/html,text/plain,application/json,application/xml;q=0.9,*/*;q=0.4",
      },
    });

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
      error: error?.name === "AbortError"
        ? "Source check timed out."
        : "Source could not be reached by the bounded verifier.",
    };
  } finally {
    clearTimeout(timeout);
  }
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