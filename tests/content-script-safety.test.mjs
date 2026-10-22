import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../extension-public/content-script.js", import.meta.url), "utf8");

// A controlled DOM, not a provider/browser compatibility claim. Evaluate the
// shipped script through its real message listener, with deterministic timers.
function fixture({ composerTag = "textarea", composerType = "text", onSleep } = {}) {
  const trace = [];
  let document;
  let now = 0;
  let listener;
  class Element {
    constructor(tag, attributes = {}) {
      this.tagName = tag.toUpperCase();
      this.attributes = new Map(Object.entries(attributes));
      this.children = [];
      this.parentElement = null;
      this.textContent = "";
      this.style = { display: "block", visibility: "visible", opacity: "1" };
      this.rect = { left: 300, top: 600, right: 700, width: 400, height: 50 };
      this.events = [];
      this.clicks = 0;
    }
    get ownerDocument() { return document; }
    get isConnected() { return this === document.documentElement || !!this.parentElement?.isConnected; }
    get id() { return this.getAttribute("id") || ""; }
    get innerText() { return this.textContent; }
    get isContentEditable() {
      const value = this.getAttribute("contenteditable");
      return value === null ? !!this.parentElement?.isContentEditable : value === "true" || value === "plaintext-only";
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    removeAttribute(name) { this.attributes.delete(name); }
    getBoundingClientRect() { return this.rect; }
    append(...children) {
      for (const child of children) {
        child.remove();
        child.parentElement = this;
        this.children.push(child);
      }
    }
    remove() {
      if (this.parentElement) {
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
        this.parentElement = null;
      }
    }
    contains(element) { return this === element || this.children.some((child) => child.contains(element)); }
    matches(selector) {
      return selector.split(",").some((part) => {
        part = part.trim();
        if (part.includes(":not(")) {
          const base = part.replace(/:not\(([^)]+)\)/g, "");
          const exclusions = [...part.matchAll(/:not\(([^)]+)\)/g)].map((match) => match[1]);
          return this.matches(base) && exclusions.every((selector) => !this.matches(selector));
        }
        if (part === ":disabled") {
          return ["INPUT", "TEXTAREA", "BUTTON"].includes(this.tagName) &&
            (this.hasAttribute("disabled") || !!this.closest("fieldset[disabled]"));
        }
        if (part.startsWith("#")) return this.id === part.slice(1);
        if (part.startsWith(".")) return (this.getAttribute("class") || "").split(/\s+/).includes(part.slice(1));
        const match = /^(\w+)?(?:\[([\w-]+)(?:=['"]?([^'"\]]+)['"]?)?\])?$/.exec(part);
        if (!match || !match[1] && !match[2]) throw new SyntaxError(`Unsupported controlled selector: ${part}`);
        return (!match[1] || this.tagName.toLowerCase() === match[1]) &&
          (!match[2] || (match[3] === undefined ? this.hasAttribute(match[2]) : this.getAttribute(match[2]) === match[3]));
      });
    }
    closest(selector) {
      for (let element = this; element; element = element.parentElement) {
        if (element.matches(selector)) return element;
      }
      return null;
    }
    querySelectorAll(selector) {
      return this.children.flatMap((child) => [
        ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
      ]);
    }
    focus() { trace.push(`focus:${this.id}`); this.onFocus?.(); }
    dispatchEvent(event) {
      this.events.push(event);
      this.onEvent?.(event);
      return true;
    }
    click() { this.clicks += 1; trace.push(`click:${this.id}`); this.onClick?.(); }
  }
  class HTMLElement extends Element {}
  class ValueElement extends HTMLElement {
    get value() { return this._value ?? ""; }
    set value(value) { this._value = value; trace.push(`write:${this.id}:${value}`); }
    get readOnly() { return this.hasAttribute("readonly"); }
    get form() {
      const id = this.getAttribute("form");
      return id ? document.querySelector(`#${id}`) : this.closest("form");
    }
  }
  // fillComposer uses these native-prototype descriptors, as in a browser.
  class HTMLTextAreaElement extends ValueElement {
    get value() { return super.value; }
    set value(value) { super.value = value; }
  }
  class HTMLInputElement extends ValueElement {
    get value() { return super.value; }
    set value(value) { super.value = value; }
    get type() { return this.getAttribute("type") || "text"; }
  }
  class HTMLButtonElement extends ValueElement {
    get type() { return this.getAttribute("type") || "submit"; }
  }
  class Event {
    constructor(type, init) { this.type = type; Object.assign(this, init); }
  }
  const element = (tag, attrs = {}) => {
    const Constructor = { textarea: HTMLTextAreaElement, input: HTMLInputElement, button: HTMLButtonElement }[tag] || HTMLElement;
    return new Constructor(tag, attrs);
  };
  const root = element("html");
  const body = element("body");
  const main = element("main");
  const form = element("form", { id: "chat-form" });
  const composer = element(composerTag, { id: "composer", ...(composerTag === "input" ? { type: composerType } : {}) });
  if (composerTag === "div") composer.setAttribute("contenteditable", "true");
  const send = element("button", { id: "send", type: "button", "aria-label": "Continue" });
  const reply = element("article", { id: "reply" });
  const newsletterForm = element("form", { id: "newsletter-form" });
  const newsletter = element("button", { id: "newsletter", type: "submit", "aria-label": "Send newsletter" });
  const sent = [];
  send.onClick = () => {
    const prompt = composer instanceof ValueElement ? composer.value : composer.textContent;
    sent.push(prompt);
    reply.textContent = `AI answer to ${prompt}`;
  };
  const recipe = { composerSelector: "#composer", sendSelector: "#send", responseSelector: "#reply" };
  document = {
    documentElement: root, body, title: "Controlled AI page", readyState: "complete",
    querySelectorAll(selector) {
      return [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)];
    },
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; },
    createRange() { return { selectNodeContents() {} }; },
    execCommand(_command, _showUI, text) {
      composer.textContent = text;
      trace.push(`write:${composer.id}:${text}`);
      return true;
    },
  };
  root.append(body);
  body.append(main);
  main.append(form, reply, newsletterForm);
  form.append(composer, send);
  newsletterForm.append(newsletter);
  const context = vm.createContext({
    document, Element, HTMLElement, HTMLTextAreaElement, HTMLInputElement, HTMLButtonElement,
    Event, InputEvent: Event, CSS: { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`) },
    getComputedStyle: (target) => target.style,
    location: { href: "https://controlled.invalid/chat", origin: "https://controlled.invalid", hostname: "controlled.invalid" },
    window: { innerHeight: 800, getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
    Date: class extends Date { static now() { return now; } },
    setTimeout(callback, ms) {
      return setImmediate(() => { now += ms; onSleep?.(ms); callback(); });
    },
    chrome: { runtime: { onMessage: { addListener(callback) { listener = callback; } } } },
  });
  vm.runInContext(source, context, { filename: "content-script.js" });
  const message = (overrides = {}) => new Promise((resolve) => {
    const keepOpen = listener({ __chatchat: true, type: "RUN_SPEECH", recipe, prompt: "hello", timeoutMs: 3000, ...overrides }, {}, resolve);
    assert.equal(keepOpen, true);
  });
  return { message, recipe, composer, send, newsletter, form, newsletterForm, main, reply, element, trace, sent };
}

function assertNoMutation(page) {
  assert.deepEqual(page.trace, []);
  assert.deepEqual(page.sent, []);
  assert.equal(page.send.clicks, 0);
  assert.equal(page.newsletter.clicks, 0);
}

test("the exact taught control wins over a higher-scoring Send newsletter button", async () => {
  const page = fixture();
  const result = await page.message();
  assert.equal(page.newsletter.clicks, 0);
  assert.equal(page.send.clicks, 1);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.responseText, "AI answer to hello");
  assert.deepEqual(page.sent, ["hello"]);
});

for (const target of ["composer", "send"]) {
  for (const state of ["missing", "ambiguous", "invalid", "unconfigured"]) {
    test(`${state} taught ${target} selector rejects before any prompt mutation`, async () => {
      const page = fixture();
      if (state === "missing") page[target].remove();
      if (state === "ambiguous") page.form.append(page.element(target === "composer" ? "textarea" : "button", { id: target }));
      if (state === "invalid") page.recipe[`${target}Selector`] = "[";
      if (state === "unconfigured") page.recipe[`${target}Selector`] = null;
      const result = await page.message();
      assertNoMutation(page);
      assert.equal(result.ok, false);
      assert.match(result.error, /selector/);
    });
  }
}

for (const composerType of ["password", "hidden", "file", "checkbox", "email"]) {
  test(`${composerType} inputs cannot receive consultation prompts`, async () => {
    const page = fixture({ composerTag: "input", composerType });
    // A misleading editable attribute must not bypass the input-type guard.
    page.composer.setAttribute("contenteditable", "true");
    const result = await page.message();
    assertNoMutation(page);
    assert.equal(result.ok, false);
    assert.match(result.error, /text input/);
  });
}

for (const state of ["non-editable", "readonly", "aria-readonly", "disabled", "fieldset-disabled", "aria-disabled", "hidden", "inert", "transparent-ancestor"]) {
  test(`${state} composers reject before focus or writing`, async () => {
    const page = fixture({ composerTag: state === "non-editable" ? "div" : "textarea" });
    if (state === "non-editable") page.composer.setAttribute("contenteditable", "false");
    else if (state === "fieldset-disabled") {
      const fieldset = page.element("fieldset", { disabled: "" });
      page.form.append(fieldset);
      fieldset.append(page.composer);
    } else if (state === "transparent-ancestor") page.form.style.opacity = "0";
    else page.composer.setAttribute(state, state.startsWith("aria-") ? "true" : "");
    const result = await page.message();
    assert.equal(result.ok, false);
    assertNoMutation(page);
  });
}

test("a taught generic container is not a send control", async () => {
  const page = fixture();
  page.recipe.sendSelector = "#reply";
  const result = await page.message();
  assert.equal(result.ok, false);
  assert.match(result.error, /send control/);
  assertNoMutation(page);
});

test("a reset button cannot be used as a send control", async () => {
  const page = fixture();
  page.send.setAttribute("type", "reset");
  assert.equal((await page.message()).ok, false);
  assertNoMutation(page);
});

for (const state of ["hidden", "inert", "zero-size", "display-none", "visibility-hidden"]) {
  test(`${state} send controls reject before prompt mutation`, async () => {
    const page = fixture();
    if (state === "zero-size") page.send.rect.width = 0;
    else if (state === "display-none") page.send.style.display = "none";
    else if (state === "visibility-hidden") page.send.style.visibility = "hidden";
    else page.send.setAttribute(state, "");
    const result = await page.message();
    assert.equal(result.ok, false);
    assertNoMutation(page);
  });
}

for (const state of ["disabled", "aria-disabled", "fieldset-disabled"]) {
  test(`${state} taught send controls never click or fall back`, async () => {
    const page = fixture();
    if (state === "fieldset-disabled") {
      const fieldset = page.element("fieldset", { disabled: "" });
      page.form.append(fieldset);
      fieldset.append(page.send);
    } else page.send.setAttribute(state, state === "aria-disabled" ? "true" : "");
    const result = await page.message();
    assert.equal(result.ok, false);
    assert.match(result.error, /disabled/);
    assert.equal(page.send.clicks, 0);
    assert.equal(page.newsletter.clicks, 0);
  });
}

for (const mismatch of ["another-form", "native-form-owner", "missing-native-form-owner", "another-region"]) {
  test(`wrong-scope send (${mismatch}) rejects before prompt mutation`, async () => {
    const page = fixture();
    if (mismatch === "another-form") page.newsletterForm.append(page.send);
    if (mismatch === "native-form-owner") page.send.setAttribute("form", "newsletter-form");
    if (mismatch === "missing-native-form-owner") page.send.setAttribute("form", "missing-form");
    if (mismatch === "another-region") {
      page.main.append(page.composer);
      const region = page.element("section");
      page.main.append(region);
      region.append(page.send);
    }
    const result = await page.message();
    assert.equal(result.ok, false);
    assert.match(result.error, /scope/);
    assertNoMutation(page);
  });
}

for (const drift of ["missing-send", "ambiguous-send", "hidden-send", "disabled-send", "wrong-scope-send", "password-composer", "replaced-composer", "ambiguous-composer", "readonly-composer"]) {
  test(`revalidates ${drift} after input and before submission`, async () => {
    const page = fixture({ composerTag: "input", onSleep(ms) {
      if (ms !== 100) return;
      if (drift === "missing-send") page.send.remove();
      if (drift === "ambiguous-send") page.form.append(page.element("button", { id: "send" }));
      if (drift === "hidden-send") page.send.setAttribute("hidden", "");
      if (drift === "disabled-send") page.send.setAttribute("disabled", "");
      if (drift === "wrong-scope-send") page.newsletterForm.append(page.send);
      if (drift === "password-composer") page.composer.setAttribute("type", "password");
      if (drift === "replaced-composer") {
        page.composer.remove();
        page.form.append(page.element("input", { id: "composer" }));
      }
      if (drift === "ambiguous-composer") page.form.append(page.element("input", { id: "composer" }));
      if (drift === "readonly-composer") page.composer.setAttribute("readonly", "");
    } });
    const result = await page.message();
    assert.equal(result.ok, false);
    assert.equal(page.send.clicks, 0);
    assert.equal(page.newsletter.clicks, 0);
  });
}

test("focus handlers cannot turn a text composer into a password before writing", async () => {
  const page = fixture({ composerTag: "input" });
  page.composer.onFocus = () => page.composer.setAttribute("type", "password");
  const result = await page.message();
  assert.equal(result.ok, false);
  assert.deepEqual(page.trace, ["focus:composer"]);
  assert.equal(page.send.clicks, 0);
  assert.equal(page.newsletter.clicks, 0);
});

for (const composerTag of ["textarea", "input", "div"]) {
  test(`valid ${composerTag} sends when its exact button enables after input`, async () => {
    const page = fixture({ composerTag });
    page.send.setAttribute("disabled", "");
    page.composer.onEvent = (event) => {
      if (event.type === "input") page.send.removeAttribute("disabled");
    };
    const result = await page.message();
    assert.equal(result.ok, true, result.error);
    assert.deepEqual(page.sent, ["hello"]);
    assert.deepEqual(page.composer.events.map((event) => event.type), ["input", "change"]);
    assert.equal(page.newsletter.clicks, 0);
  });
}

test("a formless contenteditable with an explicitly selected role button remains valid", async () => {
  const page = fixture({ composerTag: "div" });
  const button = page.element("div", { id: "custom-send", role: "button" });
  button.onClick = page.send.onClick;
  page.main.append(page.composer, button);
  page.recipe.sendSelector = "#custom-send";
  const result = await page.message();
  assert.equal(result.ok, true, result.error);
  assert.equal(button.clicks, 1);
  assert.equal(page.newsletter.clicks, 0);
});

test("native form-associated send outside the form remains valid", async () => {
  const page = fixture();
  page.main.append(page.send);
  page.send.setAttribute("form", "chat-form");
  const result = await page.message();
  assert.equal(result.ok, true, result.error);
  assert.deepEqual(page.sent, ["hello"]);
});

test("concurrent speech without operation IDs is serialized without conflating identical prompts", async () => {
  const page = fixture();
  page.newsletterForm.remove();
  const results = await Promise.all([page.message({ prompt: "first" }), page.message({ prompt: "second" }), page.message({ prompt: "first" })]);
  assert.deepEqual(page.sent, ["first", "second", "first"]);
  for (const result of results) assert.equal(result.ok, true, result.error);
  assert.deepEqual(page.trace.filter((entry) => !entry.startsWith("focus:")), [
    "write:composer:first", "click:send", "write:composer:second", "click:send", "write:composer:first", "click:send",
  ]);
});

for (const field of ["requestId", "operationId"]) {
  test(`duplicate ${field} is rejected both while pending and after completion`, async () => {
    const page = fixture();
    const first = page.message({ [field]: "turn-1" });
    const duplicate = await page.message({ [field]: "turn-1", prompt: "changed duplicate" });
    assert.equal(duplicate.ok, false);
    assert.match(duplicate.error, /Duplicate/);
    assert.equal((await first).ok, true);
    const replay = await page.message({ [field]: "turn-1" });
    assert.equal(replay.ok, false);
    assert.match(replay.error, /Duplicate/);
    assert.deepEqual(page.sent, ["hello"]);
  });
}

test("invalid or conflicting supplied IDs reject before any mutation", async () => {
  const page = fixture();
  for (const ids of [{ requestId: "" }, { operationId: null }, { requestId: 7 }, { requestId: "a", operationId: "b" }]) {
    assert.equal((await page.message(ids)).ok, false);
  }
  assertNoMutation(page);
});

test("a failed operation releases the queue but its supplied ID cannot be retried", async () => {
  const page = fixture();
  const badRecipe = { ...page.recipe, sendSelector: "#gone" };
  const [bad, good] = await Promise.all([
    page.message({ requestId: "failed", recipe: badRecipe }),
    page.message({ requestId: "next" }),
  ]);
  assert.equal(bad.ok, false);
  assert.equal(good.ok, true, good.error);
  const retry = await page.message({ requestId: "failed" });
  assert.equal(retry.ok, false);
  assert.match(retry.error, /Duplicate/);
  assert.deepEqual(page.sent, ["hello"]);
});

test("automatic setup shares the document's speech queue", async () => {
  const page = fixture();
  const order = [];
  const speech = page.message().then((result) => { order.push("speech"); return result; });
  const setup = page.message({ type: "AUTO_SETUP", prompt: "" }).then((result) => { order.push("setup"); return result; });
  assert.equal((await speech).ok, true);
  const result = await setup;
  assert.equal(result.ok, false);
  assert.match(result.error, /connection prompt/);
  assert.deepEqual(order, ["speech", "setup"]);
  assert.deepEqual(page.sent, ["hello"]);
});

test("operation IDs are not persisted or treated as exactly-once across document reload", async () => {
  const firstDocument = fixture();
  const reloadedDocument = fixture();
  assert.equal((await firstDocument.message({ requestId: "same-id" })).ok, true);
  assert.equal((await reloadedDocument.message({ requestId: "same-id" })).ok, true);
  assert.deepEqual(firstDocument.sent, ["hello"]);
  assert.deepEqual(reloadedDocument.sent, ["hello"]);
});

for (const type of ["RUN_SPEECH", "AUTO_SETUP", "TEACH", "AWAIT_RECIPE"]) {
  test(`${type} rejects a changed provider origin before any mutation`, async () => {
    const page = fixture();
    const result = await page.message({ type, expectedOrigin: "https://different.invalid" });
    assert.equal(result.ok, false);
    assert.match(result.error, /origin changed/);
    assertNoMutation(page);
  });
}

test("automatic setup scopes Send to the composer and accepts only a new assistant reply", async () => {
  const page = fixture();
  page.reply.setAttribute("data-message-author-role", "assistant");
  page.send.onClick = () => { page.sent.push(page.composer.value); page.reply.textContent = "CHATCHAT_READY"; };
  const result = await page.message({ type: "AUTO_SETUP", prompt: "Please reply with exactly CHATCHAT_READY", expectedText: "CHATCHAT_READY", expectedOrigin: "https://controlled.invalid" });
  assert.equal(page.newsletter.clicks, 0);
  assert.equal(page.send.clicks, 1);
  assert.equal(result.ok, true, result.error);
  assert.equal(result.result.responseText, "CHATCHAT_READY");
});

test("automatic setup cannot mistake a user prompt echo for READY", async () => {
  const page = fixture();
  const result = await page.message({ type: "AUTO_SETUP", prompt: "Please reply with exactly CHATCHAT_READY", expectedText: "CHATCHAT_READY" });
  assert.equal(result.ok, false);
  assert.match(result.error, /assistant-authored/);
  assert.equal(page.newsletter.clicks, 0);
});

test("automatic setup cannot reuse a historical assistant READY", async () => {
  const page = fixture(); page.reply.setAttribute("data-message-author-role", "assistant");page.reply.textContent = "CHATCHAT_READY";
  page.send.onClick = () => { page.sent.push(page.composer.value); };
  const result = await page.message({ type: "AUTO_SETUP", prompt: "Please reply with exactly CHATCHAT_READY", expectedText: "CHATCHAT_READY" });
  assert.equal(result.ok, false);assert.match(result.error, /assistant-authored/);
});
