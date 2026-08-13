(() => {
  if (globalThis.__CHATCHAT_EXTENSION_BRIDGE__) return;
  globalThis.__CHATCHAT_EXTENSION_BRIDGE__ = true;

  const DEFAULT_TIMEOUT_MS = 120_000;
  const STABLE_MS = 1_400;
  const AUTO_STABLE_MS = 850;
  let teachCleanup = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.__chatchat !== true) return undefined;

    const run = async () => {
      switch (message.type) {
        case "PING":
          return pageInfo();
        case "PROBE":
          return probePage();
        case "AUTO_SETUP":
          return autoSetup(
            String(message.profileId ?? location.origin),
            String(message.prompt ?? ""),
            String(message.expectedText ?? "CHATCHAT_READY"),
            message.timeoutMs ?? 90_000,
          );
        case "TEACH":
          return teach(message.role);
        case "AWAIT_RECIPE":
          return awaitRecipe(message.recipe, message.timeoutMs ?? 35_000);
        case "RUN_SPEECH":
          return runSpeech(
            message.recipe,
            String(message.prompt ?? ""),
            message.timeoutMs ?? DEFAULT_TIMEOUT_MS,
          );
        default:
          throw new Error(`Unknown ChatChat extension message: ${String(message.type)}`);
      }
    };

    run()
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return true;
  });

  function pageInfo() {
    return {
      url: location.href,
      origin: location.origin,
      hostname: location.hostname,
      title: document.title,
      readyState: document.readyState,
    };
  }

  function probePage() {
    const composer = bestComposer();
    const send = composer ? bestSendButton(composer.element) : null;
    return {
      ...pageInfo(),
      inputs: document.querySelectorAll(
        "input,textarea,[contenteditable]:not([contenteditable='false']),[role='textbox']",
      ).length,
      buttons: document.querySelectorAll("button,[role='button']").length,
      assistantCandidates: document.querySelectorAll(
        "[data-message-author-role='assistant'],[data-testid*='assistant'],[data-role*='assistant'],[class*='assistant']",
      ).length,
      composerScore: composer?.score ?? 0,
      sendScore: send?.score ?? 0,
      interactionReady: Boolean(composer && composer.score >= 35 && send && send.score >= 42),
    };
  }

  async function autoSetup(profileId, prompt, expectedText, timeoutMs) {
    if (!prompt.trim()) throw new Error("Automatic setup requires a connection prompt.");
    const composerMatch = bestComposer();
    if (!composerMatch || composerMatch.score < 35) {
      throw new Error("ChatChat could not confidently identify the AI message box automatically.");
    }

    const composer = composerMatch.element;
    const composerSelector = selectorFor(composer);
    const initialSend = bestSendButton(composer);
    if (!initialSend || initialSend.score < 42) {
      throw new Error("ChatChat found the message box but could not confidently identify the send button.");
    }

    const startedAt = new Date().toISOString();
    const baselineExpectedCount = countTextOccurrences(document.body?.innerText ?? "", expectedText);
    fillComposer(composer, prompt);
    await sleep(140);

    const sendMatch = bestSendButton(composer) ?? initialSend;
    const send = sendMatch.element;
    if (!isClickable(send)) {
      await sleep(320);
    }
    if (!isClickable(send)) {
      throw new Error("The detected send button did not become clickable after ChatChat filled the message box.");
    }
    const sendSelector = selectorFor(send);
    send.click();

    const response = await waitForExpectedResponse(
      expectedText,
      composer,
      baselineExpectedCount,
      timeoutMs,
      prompt,
    );
    const responseSelector = inferResponseSelector(response.element, composer);
    const responseSnapshotAfterSetup = responseSnapshot(responseSelector);
    const responseText = responseSignal(
      responseSnapshotAfterSetup.lastText || response.text,
      prompt,
      "",
    ) || response.text;
    const now = new Date().toISOString();

    return {
      recipe: {
        profileId,
        composerSelector,
        sendSelector,
        responseSelector,
        createdAt: startedAt,
        updatedAt: now,
      },
      responseText,
      elapsedMs: response.elapsedMs,
      diagnostics: {
        mode: "automatic",
        composerScore: composerMatch.score,
        sendScore: sendMatch.score,
        responseStrategy: responseSelector,
      },
    };
  }

  function bestComposer() {
    const candidates = [
      ...document.querySelectorAll(
        "textarea,[contenteditable]:not([contenteditable='false']),[role='textbox'],input:not([type='password']):not([type='hidden']):not([type='file'])",
      ),
    ];
    let best = null;
    for (const element of candidates) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      if (element instanceof HTMLInputElement && ["search", "email", "tel", "url"].includes(element.type)) {
        continue;
      }
      const label = searchableLabel(element);
      if (/search|filter|email|phone|login|sign in|搜索|筛选|邮箱|登录/i.test(label)) continue;
      const rect = element.getBoundingClientRect();
      let score = 0;
      if (element instanceof HTMLTextAreaElement) score += 30;
      if (element.isContentEditable) score += 26;
      if (element.getAttribute("role") === "textbox") score += 22;
      if (element instanceof HTMLInputElement) score += 12;
      if (/prompt|message|chat|ask|question|composer|send|输入|消息|提问|聊天|问/i.test(label)) score += 48;
      if (element.closest("main,[role='main']")) score += 10;
      if (rect.width >= 240) score += 14;
      if (rect.height >= 32) score += 8;
      if (rect.top > window.innerHeight * 0.45) score += 10;
      if (element.getAttribute("aria-multiline") === "true") score += 12;
      if (!best || score > best.score) best = { element, score };
    }
    return best;
  }

  function bestSendButton(composer) {
    const form = composer.closest("form");
    const candidates = [
      ...(form ? form.querySelectorAll("button,[role='button']") : []),
      ...document.querySelectorAll("button,[role='button']"),
    ];
    const unique = [...new Set(candidates)];
    const composerRect = composer.getBoundingClientRect();
    let best = null;

    for (const element of unique) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      const label = searchableLabel(element);
      if (/attach|upload|image|photo|voice|microphone|record|stop|cancel|menu|more|附件|上传|图片|语音|麦克风|停止|取消|菜单/i.test(label)) {
        continue;
      }
      const rect = element.getBoundingClientRect();
      const dx = Math.abs(rect.left + rect.width / 2 - (composerRect.right - 24));
      const dy = Math.abs(rect.top + rect.height / 2 - (composerRect.top + composerRect.height / 2));
      let score = 0;
      if (form && form.contains(element)) score += 34;
      if (/send|submit|arrow.?up|paper.?plane|发送|提交/i.test(label)) score += 70;
      if (element instanceof HTMLButtonElement && element.type === "submit") score += 42;
      if (dx < 180 && dy < 100) score += 24;
      if (dx < 80 && dy < 70) score += 15;
      if (!element.hasAttribute("disabled") && element.getAttribute("aria-disabled") !== "true") score += 8;
      if (!best || score > best.score) best = { element, score };
    }
    return best;
  }

  function searchableLabel(element) {
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("title"),
      element.getAttribute("placeholder"),
      element.getAttribute("data-testid"),
      element.getAttribute("data-qa"),
      element.getAttribute("name"),
      element.textContent,
    ]
      .filter(Boolean)
      .join(" ")
      .slice(0, 800);
  }

  function isClickable(element) {
    return (
      isVisible(element) &&
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-disabled") !== "true"
    );
  }

  async function waitForExpectedResponse(expectedText, composer, baselineCount, timeoutMs, prompt) {
    const started = Date.now();
    let candidate = null;
    let candidateText = "";
    let stableSince = 0;

    while (Date.now() - started < timeoutMs) {
      const bodyText = document.body?.innerText ?? "";
      if (countTextOccurrences(bodyText, expectedText) > baselineCount) {
        const element = findSmallestExpectedElement(expectedText, composer, prompt);
        if (element) {
          const text = visibleText(element);
          if (element !== candidate || text !== candidateText) {
            candidate = element;
            candidateText = text;
            stableSince = Date.now();
          } else if (Date.now() - stableSince >= AUTO_STABLE_MS) {
            return {
              element,
              text,
              elapsedMs: Date.now() - started,
            };
          }
        }
      }
      await sleep(300);
    }
    throw new Error("The AI page did not return the automatic ChatChat connection reply in time.");
  }

  function findSmallestExpectedElement(expectedText, composer, prompt) {
    const all = [...document.querySelectorAll("main *,[role='main'] *,article,[role='article'],body *")];
    let best = null;
    let bestLength = Number.POSITIVE_INFINITY;
    for (const element of all) {
      if (!(element instanceof HTMLElement) || !isVisible(element)) continue;
      if (element === composer || element.contains(composer) || composer.contains(element)) continue;
      const text = visibleText(element);
      if (!text.includes(expectedText)) continue;
      if (looksLikePromptEcho(text, prompt)) continue;
      if (text.length < bestLength) {
        best = element;
        bestLength = text.length;
      }
    }
    return best;
  }

  function inferResponseSelector(element, composer) {
    let current = element;
    for (let depth = 0; current && depth < 8; depth += 1) {
      const author = current.getAttribute("data-message-author-role");
      if (author?.toLowerCase() === "assistant") {
        return `[data-message-author-role=${JSON.stringify(author)}]`;
      }
      const role = current.getAttribute("data-role");
      if (role && /assistant|model|response/i.test(role)) {
        return `[data-role=${JSON.stringify(role)}]`;
      }
      const testId = current.getAttribute("data-testid");
      if (testId && /assistant|response|message-content|model/i.test(testId) && testId.length < 180) {
        return `[data-testid=${JSON.stringify(testId)}]`;
      }
      const semanticClasses = [...current.classList].filter((name) =>
        /assistant|model-response|response-content|message-content|markdown/i.test(name),
      );
      for (const name of semanticClasses) {
        const selector = `${current.tagName.toLowerCase()}.${CSS.escape(name)}`;
        if (safeQueryAll(selector).length) return selector;
      }
      current = current.parentElement;
    }

    const main = element.closest("main,[role='main']");
    if (main instanceof HTMLElement) {
      if (main.matches("main") && document.querySelectorAll("main").length === 1) return "main";
      if (main.getAttribute("role") === "main") return '[role="main"]';
    }

    current = element;
    let fallback = element;
    for (let depth = 0; current?.parentElement && depth < 7; depth += 1) {
      const parent = current.parentElement;
      if (parent === document.body || parent.contains(composer)) break;
      fallback = parent;
      current = parent;
    }
    try {
      return selectorFor(fallback);
    } catch {
      return selectorFor(element);
    }
  }

  function countTextOccurrences(text, needle) {
    if (!needle) return 0;
    let count = 0;
    let index = 0;
    while ((index = text.indexOf(needle, index)) >= 0) {
      count += 1;
      index += needle.length;
    }
    return count;
  }

  function visibleText(element) {
    return (element.innerText || element.textContent || "").trim();
  }

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return (
      rect.width > 2 &&
      rect.height > 2 &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity || "1") > 0.01
    );
  }

  async function teach(role) {
    if (!["composer", "send", "response"].includes(role)) {
      throw new Error("Teach role must be composer, send, or response.");
    }
    teachCleanup?.();

    return await new Promise((resolve, reject) => {
      const style = document.createElement("style");
      style.dataset.chatchatTeach = "true";
      style.textContent = `
        .chatchat-teach-target {
          outline: 3px solid #57b894 !important;
          outline-offset: 3px !important;
          cursor: crosshair !important;
        }
        #chatchat-teach-badge {
          position: fixed;
          z-index: 2147483647;
          top: 16px;
          left: 50%;
          transform: translateX(-50%);
          padding: 10px 14px;
          border-radius: 999px;
          background: rgba(16, 42, 51, .94);
          color: white;
          font: 600 13px/1.2 ui-sans-serif, system-ui, sans-serif;
          box-shadow: 0 8px 30px rgba(0,0,0,.22);
          pointer-events: none;
        }
      `;
      document.documentElement.appendChild(style);

      const badge = document.createElement("div");
      badge.id = "chatchat-teach-badge";
      badge.textContent =
        role === "composer"
          ? "ChatChat · 点击 AI 消息输入框"
          : role === "send"
            ? "ChatChat · 点击发送按钮"
            : "ChatChat · 点击一条 AI 回答正文";
      document.documentElement.appendChild(badge);

      let hovered = null;
      let done = false;

      const cleanup = () => {
        hovered?.classList.remove("chatchat-teach-target");
        document.removeEventListener("mouseover", onOver, true);
        document.removeEventListener("mouseout", onOut, true);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("keydown", onKey, true);
        style.remove();
        badge.remove();
        teachCleanup = null;
      };
      teachCleanup = cleanup;

      const finish = (fn) => {
        if (done) return;
        done = true;
        cleanup();
        fn();
      };

      const onOver = (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target === badge) return;
        hovered?.classList.remove("chatchat-teach-target");
        hovered = target;
        hovered.classList.add("chatchat-teach-target");
      };

      const onOut = (event) => {
        const target = event.target;
        if (target instanceof Element && target === hovered) {
          target.classList.remove("chatchat-teach-target");
        }
      };

      const onKey = (event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        finish(() => reject(new Error("Teach Mode cancelled.")));
      };

      const onClick = (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target === badge) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        try {
          const selection = selectionFor(role, target);
          finish(() => resolve(selection));
        } catch (error) {
          finish(() => reject(error));
        }
      };

      document.addEventListener("mouseover", onOver, true);
      document.addEventListener("mouseout", onOut, true);
      document.addEventListener("click", onClick, true);
      document.addEventListener("keydown", onKey, true);
    });
  }

  function selectionFor(role, element) {
    const inputType = element instanceof HTMLInputElement ? element.type || null : null;
    if (inputType?.toLowerCase() === "password") {
      throw new Error("ChatChat refuses to teach against password fields.");
    }

    const tag = element.tagName.toLowerCase();
    const contentEditable = element instanceof HTMLElement && element.isContentEditable;
    if (role === "composer" && !contentEditable && tag !== "textarea" && tag !== "input") {
      throw new Error("Composer must be an input, textarea, or contenteditable element.");
    }

    return {
      role,
      selector: selectorFor(element),
      tag,
      id: element.id || null,
      ariaLabel: element.getAttribute("aria-label"),
      dataTestId: element.getAttribute("data-testid"),
      dataMessageAuthorRole: element.getAttribute("data-message-author-role"),
      inputType,
      contentEditable,
      selectedAt: new Date().toISOString(),
    };
  }

  function selectorFor(element) {
    if (element === document.body) return "body";
    if (element.id) {
      const candidate = `#${CSS.escape(element.id)}`;
      if (isUnique(candidate)) return candidate;
    }

    const stableAttributes = [
      "data-testid",
      "data-message-author-role",
      "data-qa",
      "data-role",
      "aria-label",
      "name",
    ];
    for (const attribute of stableAttributes) {
      const value = element.getAttribute(attribute);
      if (!value || value.length > 180) continue;
      const candidate = `${element.tagName.toLowerCase()}[${attribute}=${JSON.stringify(value)}]`;
      if (isUnique(candidate)) return candidate;
      if (attribute === "data-message-author-role") return `[${attribute}=${JSON.stringify(value)}]`;
    }

    const path = [];
    let current = element;
    for (let depth = 0; current && depth < 6; depth += 1) {
      let part = current.tagName.toLowerCase();
      const classes = [...current.classList]
        .filter((name) => /^[a-zA-Z_-][a-zA-Z0-9_-]{1,50}$/.test(name))
        .slice(0, 2);
      if (classes.length) part += classes.map((name) => `.${CSS.escape(name)}`).join("");
      const parent = current.parentElement;
      if (parent) {
        const sameTag = [...parent.children].filter((child) => child.tagName === current.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
      path.unshift(part);
      const candidate = path.join(" > ");
      if (isUnique(candidate)) return candidate;
      current = parent;
    }
    throw new Error("ChatChat could not build a stable selector for this element.");
  }

  function isUnique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  async function awaitRecipe(recipe, timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const composer = safeQuery(recipe?.composerSelector);
      const send = safeQuery(recipe?.sendSelector);
      const responseReady = selectorIsValid(recipe?.responseSelector);
      if (composer && send && responseReady) {
        return { ready: true, elapsedMs: Date.now() - started };
      }
      await sleep(350);
    }
    throw new Error("Provider tab did not become ready for the configured recipe in time.");
  }

  async function runSpeech(recipe, prompt, timeoutMs) {
    if (!prompt.trim()) throw new Error("ChatChat cannot send an empty consultation prompt.");
    const composer = requiredQuery(recipe?.composerSelector, "composer");
    const responseSelector = requiredSelector(recipe?.responseSelector, "response");

    const baseline = responseSnapshot(responseSelector);
    const baselineSignal = responseSignal(baseline.lastText, prompt, "");
    fillComposer(composer, prompt);
    await sleep(100);

    const refreshedSend = bestSendButton(composer)?.element;
    const send = refreshedSend && isClickable(refreshedSend)
      ? refreshedSend
      : requiredQuery(recipe?.sendSelector, "send");
    if (!isClickable(send)) throw new Error("Configured send button is currently unavailable.");
    send.click();

    const started = Date.now();
    let candidate = "";
    let stableSince = 0;
    let lastObservedCount = baseline.count;

    while (Date.now() - started < timeoutMs) {
      const snapshot = responseSnapshot(responseSelector);
      const signal = responseSignal(snapshot.lastText, prompt, baseline.lastText);
      const changed =
        snapshot.count > baseline.count ||
        (snapshot.lastText && snapshot.lastText !== baseline.lastText);

      if (changed && signal && signal !== baselineSignal) {
        if (signal !== candidate) {
          candidate = signal;
          stableSince = Date.now();
        } else if (Date.now() - stableSince >= STABLE_MS) {
          return {
            responseText: candidate,
            elapsedMs: Date.now() - started,
            responseCount: snapshot.count,
          };
        }
      }

      if (snapshot.count !== lastObservedCount) {
        lastObservedCount = snapshot.count;
        stableSince = Date.now();
      }
      await sleep(350);
    }

    if (candidate.trim()) {
      return {
        responseText: candidate.trim(),
        elapsedMs: Date.now() - started,
        responseCount: lastObservedCount,
        truncatedByTimeout: true,
      };
    }
    throw new Error("Timed out waiting for a changed AI response from the configured response area.");
  }

  function responseSignal(text, prompt, baselineText) {
    const source = stripPromptEcho(String(text ?? ""), prompt);
    const open = "<CHATCHAT_COUNCIL_JSON>";
    const close = "</CHATCHAT_COUNCIL_JSON>";
    const start = source.lastIndexOf(open);
    if (start >= 0) {
      const end = source.indexOf(close, start + open.length);
      if (end > start) return source.slice(start, end + close.length).trim();
    }

    const exact = prompt.match(/reply\s+with\s+exactly\s*:?\s*([A-Z0-9_-]{4,80})/i)?.[1];
    if (exact) {
      const before = countTextOccurrences(stripPromptEcho(String(baselineText ?? ""), prompt), exact);
      const after = countTextOccurrences(source, exact);
      if (after > before) return exact;
      return "";
    }
    return source.trim();
  }

  function stripPromptEcho(source, prompt) {
    const full = String(source ?? "");
    const message = String(prompt ?? "").trim();
    if (!message) return full;
    if (full.includes(message)) return full.replace(message, "");

    const fingerprint = promptFingerprint(message);
    if (!fingerprint) return full;
    const index = full.indexOf(fingerprint);
    if (index < 0) return full;
    return `${full.slice(0, index)}${full.slice(index + fingerprint.length)}`;
  }

  function looksLikePromptEcho(text, prompt) {
    const source = String(text ?? "").trim();
    const message = String(prompt ?? "").trim();
    if (!source || !message) return false;
    if (source.includes(message)) return true;
    const fingerprint = promptFingerprint(message);
    return Boolean(fingerprint && source.includes(fingerprint));
  }

  function promptFingerprint(prompt) {
    const normalized = String(prompt ?? "").replace(/\s+/g, " ").trim();
    if (normalized.length < 48) return normalized;
    return normalized.slice(0, 96);
  }

  function fillComposer(element, text) {
    element.focus();
    if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(element, text);
    } else if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setter?.call(element, text);
    } else if (element instanceof HTMLElement && element.isContentEditable) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(element);
      selection?.removeAllRanges();
      selection?.addRange(range);
      const inserted = document.execCommand?.("insertText", false, text);
      if (!inserted) element.textContent = text;
    } else {
      throw new Error("Configured composer is no longer an editable element.");
    }

    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: text,
      }),
    );
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function responseSnapshot(selector) {
    const elements = safeQueryAll(selector);
    const last = elements.at(-1);
    return {
      count: elements.length,
      lastText: last?.innerText || last?.textContent || "",
    };
  }

  function requiredQuery(selector, label) {
    const value = requiredSelector(selector, label);
    const element = safeQuery(value);
    if (!element) throw new Error(`Configured ${label} selector no longer matches the Provider page.`);
    return element;
  }

  function requiredSelector(selector, label) {
    if (typeof selector !== "string" || !selector.trim()) {
      throw new Error(`Missing configured ${label} selector.`);
    }
    return selector.trim();
  }

  function selectorIsValid(selector) {
    if (typeof selector !== "string" || !selector.trim()) return false;
    try {
      document.querySelectorAll(selector.trim());
      return true;
    } catch {
      return false;
    }
  }

  function safeQuery(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function safeQueryAll(selector) {
    if (!selector) return [];
    try {
      return [...document.querySelectorAll(selector)];
    } catch {
      return [];
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
})();