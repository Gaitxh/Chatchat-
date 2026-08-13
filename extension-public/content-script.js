(() => {
  if (globalThis.__CHATCHAT_EXTENSION_BRIDGE__) return;
  globalThis.__CHATCHAT_EXTENSION_BRIDGE__ = true;

  const DEFAULT_TIMEOUT_MS = 120_000;
  const STABLE_MS = 1_400;
  let teachCleanup = null;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.__chatchat !== true) return undefined;

    const run = async () => {
      switch (message.type) {
        case "PING":
          return pageInfo();
        case "PROBE":
          return probePage();
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
    return {
      ...pageInfo(),
      inputs: document.querySelectorAll("input,textarea,[contenteditable='true']").length,
      buttons: document.querySelectorAll("button,[role='button']").length,
      assistantCandidates: document.querySelectorAll(
        "[data-message-author-role='assistant'],[data-testid*='assistant'],[class*='assistant']",
      ).length,
    };
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
    const inputType =
      element instanceof HTMLInputElement ? element.type || null : null;
    if (inputType?.toLowerCase() === "password") {
      throw new Error("ChatChat refuses to teach against password fields.");
    }

    const tag = element.tagName.toLowerCase();
    const contentEditable = element.getAttribute("contenteditable") === "true";
    if (
      role === "composer" &&
      !contentEditable &&
      tag !== "textarea" &&
      tag !== "input"
    ) {
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
        const sameTag = [...parent.children].filter(
          (child) => child.tagName === current.tagName,
        );
        if (sameTag.length > 1) {
          part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
        }
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
      const responseCount = safeQueryAll(recipe?.responseSelector).length;
      if (composer && send && responseCount >= 0) {
        return { ready: true, elapsedMs: Date.now() - started };
      }
      await sleep(350);
    }
    throw new Error("Provider tab did not become ready for the taught recipe in time.");
  }

  async function runSpeech(recipe, prompt, timeoutMs) {
    if (!prompt.trim()) throw new Error("ChatChat cannot send an empty Council prompt.");
    const composer = requiredQuery(recipe?.composerSelector, "composer");
    const send = requiredQuery(recipe?.sendSelector, "send");
    const responseSelector = requiredSelector(recipe?.responseSelector, "response");

    const baseline = responseSnapshot(responseSelector);
    fillComposer(composer, prompt);
    await sleep(60);
    send.click();

    const started = Date.now();
    let candidate = "";
    let stableSince = 0;
    let lastObservedCount = baseline.count;

    while (Date.now() - started < timeoutMs) {
      const snapshot = responseSnapshot(responseSelector);
      const changed =
        snapshot.count > baseline.count ||
        (snapshot.lastText && snapshot.lastText !== baseline.lastText);

      if (changed && snapshot.lastText.trim()) {
        const next = snapshot.lastText.trim();
        if (next !== candidate) {
          candidate = next;
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
    throw new Error("Timed out waiting for a changed AI response from the taught response selector.");
  }

  function fillComposer(element, text) {
    element.focus();
    if (element instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set;
      setter?.call(element, text);
    } else if (element instanceof HTMLInputElement) {
      const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set;
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
      throw new Error("Taught composer is no longer an editable element.");
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
    if (!element) throw new Error(`Taught ${label} selector no longer matches the Provider page.`);
    return element;
  }

  function requiredSelector(selector, label) {
    if (typeof selector !== "string" || !selector.trim()) {
      throw new Error(`Missing taught ${label} selector.`);
    }
    return selector.trim();
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
