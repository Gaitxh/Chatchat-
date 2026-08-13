(() => {
  if (globalThis.__CHATCHAT_CONTENT_READY__) return;
  globalThis.__CHATCHAT_CONTENT_READY__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handle(message)
      .then((result) => sendResponse({ ok: true, result }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: String(error instanceof Error ? error.message : error),
        }),
      );
    return true;
  });

  async function handle(message) {
    switch (message?.type) {
      case "CHATCHAT_PING":
        return {
          href: location.href,
          host: location.hostname,
          title: document.title,
        };
      case "CHATCHAT_CHECK_RECIPE":
        return checkRecipe(message.recipe);
      case "CHATCHAT_TEACH":
        return teachSelector(message.role);
      case "CHATCHAT_TEST":
      case "CHATCHAT_TURN":
        return sendAndCapture(
          message.recipe,
          String(message.message ?? message.prompt ?? ""),
          message.timeoutMs ?? 90000,
        );
      default:
        throw new Error("Unknown ChatChat content command.");
    }
  }

  function checkRecipe(recipe) {
    validateRecipe(recipe);
    const composer = document.querySelector(recipe.composer);
    const send = document.querySelector(recipe.send);
    const responses = [...document.querySelectorAll(recipe.response)].filter(
      (node) => node instanceof HTMLElement && visible(node),
    );
    return {
      composer: composer instanceof HTMLElement,
      send: send instanceof HTMLElement,
      response: responses.length > 0,
      ready:
        composer instanceof HTMLElement &&
        send instanceof HTMLElement &&
        responses.length > 0,
    };
  }

  function teachSelector(role) {
    if (!["composer", "send", "response"].includes(role)) {
      throw new Error("Unknown Teach role.");
    }

    return new Promise((resolve, reject) => {
      let hovered = null;
      const previousOutline = new WeakMap();

      const restore = (element) => {
        if (!(element instanceof HTMLElement)) return;
        element.style.outline = previousOutline.get(element) ?? "";
      };

      const cleanup = () => {
        document.removeEventListener("mousemove", move, true);
        document.removeEventListener("click", click, true);
        document.removeEventListener("keydown", keydown, true);
        if (hovered) restore(hovered);
        window.clearTimeout(timer);
      };

      const move = (event) => {
        const next = event.target instanceof HTMLElement ? event.target : null;
        if (!next || next === hovered) return;
        if (hovered) restore(hovered);
        hovered = next;
        previousOutline.set(next, next.style.outline);
        next.style.outline = "2px solid #667eea";
      };

      const click = (event) => {
        const element = event.target instanceof HTMLElement ? event.target : null;
        if (!element) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        if (element instanceof HTMLInputElement && element.type === "password") {
          cleanup();
          reject(
            new Error(
              "ChatChat refuses to teach or store a password-field selector.",
            ),
          );
          return;
        }

        const selector = stableSelector(element);
        cleanup();
        resolve({
          role,
          selector,
          tag: element.tagName.toLocaleLowerCase(),
          label:
            element.getAttribute("aria-label") ||
            element.getAttribute("placeholder") ||
            element.getAttribute("role") ||
            "",
        });
      };

      const keydown = (event) => {
        if (event.key !== "Escape") return;
        cleanup();
        reject(new Error("Teach Mode cancelled."));
      };

      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("Teach Mode timed out."));
      }, 30000);

      document.addEventListener("mousemove", move, true);
      document.addEventListener("click", click, true);
      document.addEventListener("keydown", keydown, true);
    });
  }

  async function sendAndCapture(recipe, message, timeoutMs) {
    validateRecipe(recipe);
    if (!message.trim()) throw new Error("Message is empty.");

    const composer = document.querySelector(recipe.composer);
    const send = document.querySelector(recipe.send);
    if (!(composer instanceof HTMLElement)) {
      throw new Error("Composer selector no longer matches.");
    }
    if (!(send instanceof HTMLElement)) {
      throw new Error("Send selector no longer matches.");
    }

    const baseline = responseText(recipe.response);
    fillComposer(composer, message);
    await sleep(80);
    send.click();

    const started = Date.now();
    let last = baseline;
    let stable = 0;
    while (Date.now() - started < timeoutMs) {
      await sleep(700);
      const current = responseText(recipe.response);
      if (!current || current === baseline) continue;
      if (current === last) stable += 1;
      else stable = 0;
      last = current;
      if (stable >= 3) {
        return {
          text: current.slice(0, 120000),
          elapsedMs: Date.now() - started,
          truncated: current.length > 120000,
        };
      }
    }
    throw new Error("Timed out waiting for a stable new response.");
  }

  function fillComposer(element, text) {
    element.focus();
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      const proto =
        element instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      if (setter) setter.call(element, text);
      else element.value = text;
    } else if (element.isContentEditable) {
      element.textContent = text;
    } else {
      throw new Error(
        "Taught composer is not input/textarea/contenteditable.",
      );
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

  function responseText(selector) {
    const nodes = [...document.querySelectorAll(selector)].filter(
      (node) => node instanceof HTMLElement && visible(node),
    );
    const node = nodes.at(-1);
    return node?.innerText?.trim() || node?.textContent?.trim() || "";
  }

  function validateRecipe(recipe) {
    for (const key of ["composer", "send", "response"]) {
      if (
        !recipe ||
        typeof recipe[key] !== "string" ||
        !recipe[key].trim() ||
        recipe[key].length > 1000
      ) {
        throw new Error(`Missing taught ${key} selector.`);
      }
    }
  }

  function stableSelector(element) {
    if (element.id) {
      const selector = `#${CSS.escape(element.id)}`;
      if (unique(selector)) return selector;
    }

    for (const attribute of [
      "data-testid",
      "data-test-id",
      "aria-label",
      "placeholder",
      "name",
      "role",
    ]) {
      const value = element.getAttribute(attribute);
      if (!value || value.length > 180) continue;
      const selector = `${element.tagName.toLocaleLowerCase()}[${attribute}="${cssString(value)}"]`;
      if (unique(selector)) return selector;
    }

    const parts = [];
    let current = element;
    for (
      let depth = 0;
      current && current !== document.body && depth < 5;
      depth += 1
    ) {
      const tag = current.tagName.toLocaleLowerCase();
      const siblings = current.parentElement
        ? [...current.parentElement.children].filter(
            (child) => child.tagName === current.tagName,
          )
        : [];
      const index = siblings.indexOf(current) + 1;
      parts.unshift(
        siblings.length > 1 ? `${tag}:nth-of-type(${index})` : tag,
      );
      const selector = parts.join(" > ");
      if (unique(selector)) return selector;
      current = current.parentElement;
    }

    throw new Error("Could not derive a stable selector for this element.");
  }

  function unique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function cssString(value) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function visible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function sleep(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
})();
