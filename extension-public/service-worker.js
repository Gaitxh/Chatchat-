import {
  isTextualContent,
  observeTextSource,
  publicEvidenceUrl,
} from "./source-extract.js";

const MAX_EVIDENCE_BYTES = 256 * 1024;
const EVIDENCE_TIMEOUT_MS = 8_000;
const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const CLAIM_PROVIDER_SELF_HEALING = "CLAIM_PROVIDER_SELF_HEALING";
const SELF_HEALING_CLAIMS_KEY = "chatchat.provider-self-healing.claims.v1";
const PARTICIPANTS_KEY = "chatchat.consultation.participants.v1";
let recoveryClaimQueue = Promise.resolve();

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
  if (message?.type === CLAIM_PROVIDER_SELF_HEALING) {
    claimProviderSelfHealing(message)
      .then((claimed) => sendResponse({ ok: true, claimed }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }));
    return true;
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

async function claimProviderSelfHealing(message) {
  const seatId = String(message?.seatId ?? "").trim();
  const tabId = Number(message?.tabId);
  if (!seatId || !Number.isInteger(tabId)) return false;
  const claimKey = `${seatId}:${tabId}`;

  const task = recoveryClaimQueue.then(async () => {
    const store = chrome.storage.session ?? chrome.storage.local;
    // Re-read current authority at the final navigation claim boundary. A user
    // may click Protect after page inspection began but before MV3 receives this
    // claim; stale front-end state must never win that race.
    if (!(await hasCurrentManagedAuthority(store, seatId, tabId))) return false;

    const stored = await store.get(SELF_HEALING_CLAIMS_KEY);
    const current = stored?.[SELF_HEALING_CLAIMS_KEY];
    const claims = current && typeof current === "object" ? { ...current } : {};
    if (claims[claimKey]) return false;
    claims[claimKey] = {
      seatId,
      tabId,
      claimedAt: new Date().toISOString(),
    };
    // Persist the claim before navigation. MV3 service-worker suspension must not
    // turn one bounded recovery into an accidental navigation loop.
    await store.set({ [SELF_HEALING_CLAIMS_KEY]: claims });
    return true;
  });
  recoveryClaimQueue = task.then(() => undefined, () => undefined);
  return task;
}

async function hasCurrentManagedAuthority(store, seatId, tabId) {
  const stored = await store.get(PARTICIPANTS_KEY);
  const participants = stored?.[PARTICIPANTS_KEY];
  if (!Array.isArray(participants)) return false;
  const participant = participants.find((candidate) => (
    candidate
      && typeof candidate === "object"
      && candidate.seatId === seatId
      && candidate.tabId === tabId
  ));
  return participant?.createdByChatChat === true
    && participant?.automationProtected !== true;
}

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
