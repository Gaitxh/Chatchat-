import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const chrome = required(args.chrome, "--chrome");
const url = required(args.url, "--url");
const screenshotPath = required(args.screenshot, "--screenshot");
const domPath = required(args.dom, "--dom");
const readySelector = required(args.readySelector, "--ready-selector");
const focusSelector = typeof args.focusSelector === "string" ? args.focusSelector : null;
const width = positiveInteger(args.width ?? "1440", "--width");
const height = positiveInteger(args.height ?? "2800", "--height");
const waitMs = positiveInteger(args.waitMs ?? "26000", "--wait-ms");
const port = await freeDebugPort();
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chatchat-chromium-proof-"));

let browser;
try {
  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--run-all-compositor-stages-before-draw",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const stderr = [];
  browser.stderr?.on("data", (chunk) => stderr.push(String(chunk)));
  browser.stdout?.resume();

  const target = await waitForPageTarget(port, waitMs);
  const cdp = await connectCdp(target.webSocketDebuggerUrl);
  try {
    await cdp.call("Page.enable");
    await cdp.call("Runtime.enable");
    await cdp.call("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await cdp.call("Page.navigate", { url });
    await waitForReady(cdp, readySelector, waitMs);
    if (focusSelector) {
      await focusElement(cdp, focusSelector);
    } else {
      await evaluate(cdp, `(() => {
        window.scrollTo(0, 0);
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
        return { x: window.scrollX, y: window.scrollY };
      })()`);
    }
    await waitForPaint(cdp);

    const dom = await evaluate(cdp, "document.documentElement.outerHTML");
    if (typeof dom !== "string" || !dom.includes(readySelectorHint(readySelector))) {
      throw new Error(`Ready DOM was not captured after selector ${readySelector}.`);
    }
    if (focusSelector && !dom.includes(readySelectorHint(focusSelector))) {
      throw new Error(`Focused DOM did not contain selector ${focusSelector}.`);
    }
    await fs.mkdir(path.dirname(domPath), { recursive: true });
    await fs.writeFile(domPath, `<!doctype html>\n${dom}\n`, "utf8");

    const shot = await cdp.call("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!shot?.data) throw new Error("Chromium did not return screenshot bytes.");
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, Buffer.from(shot.data, "base64"));
  } finally {
    cdp.close();
  }
} catch (error) {
  console.error(`Chromium proof capture failed: ${message(error)}`);
  throw error;
} finally {
  if (browser && !browser.killed) browser.kill("SIGTERM");
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function waitForReady(cdp, selector, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = await evaluate(cdp, `Boolean(document.querySelector(${JSON.stringify(selector)}))`);
    if (ready) return;
    await sleep(80);
  }
  const snapshot = await evaluate(cdp, `({
    href: location.href,
    readyState: document.readyState,
    dataset: { ...document.documentElement.dataset },
    text: document.body?.innerText?.slice(0, 800) ?? ""
  })`);
  throw new Error(`Timed out waiting for ${selector}. Last page state: ${JSON.stringify(snapshot)}`);
}

async function focusElement(cdp, selector) {
  const result = await evaluate(cdp, `(() => {
    const element = document.querySelector(${JSON.stringify(selector)});
    if (!element) return null;
    element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" });
    const scrolling = document.scrollingElement;
    if (scrolling) scrolling.scrollTop = Math.max(0, scrolling.scrollTop - 18);
    const rect = element.getBoundingClientRect();
    return { top: rect.top, left: rect.left, width: rect.width, height: rect.height, x: window.scrollX, y: window.scrollY };
  })()`);
  if (!result) throw new Error(`Could not focus selector ${selector}.`);
}

async function waitForPaint(cdp) {
  await cdp.call("Runtime.evaluate", {
    expression: "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))",
    awaitPromise: true,
    returnByValue: true,
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.call("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result?.exceptionDetails) throw new Error(`Runtime evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  return result?.result?.value;
}

async function waitForPageTarget(port, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {}
    await sleep(80);
  }
  throw new Error(`Chromium DevTools endpoint did not expose a page target on port ${port}.`);
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("Could not connect to Chromium DevTools WebSocket.")), { once: true });
  });
  socket.addEventListener("message", (event) => {
    let payload;
    try { payload = JSON.parse(String(event.data)); } catch { return; }
    if (!payload.id) return;
    const waiter = pending.get(payload.id);
    if (!waiter) return;
    pending.delete(payload.id);
    if (payload.error) waiter.reject(new Error(`CDP ${waiter.method} failed: ${JSON.stringify(payload.error)}`));
    else waiter.resolve(payload.result);
  });
  socket.addEventListener("close", () => {
    for (const waiter of pending.values()) waiter.reject(new Error(`CDP socket closed while waiting for ${waiter.method}.`));
    pending.clear();
  });
  return {
    async call(method, params = {}) {
      await opened;
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

async function freeDebugPort() {
  const net = await import("node:net");
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
    server.on("error", reject);
  });
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item?.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = values[index + 1];
    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else result[key] = "true";
  }
  return result;
}

function readySelectorHint(selector) {
  const match = selector.match(/data-[a-z0-9-]+/i);
  return match?.[0] ?? selector;
}

function positiveInteger(value, flag) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${flag} must be a positive integer.`);
  return parsed;
}

function required(value, flag) {
  if (!value) throw new Error(`Missing required ${flag}.`);
  return value;
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function message(error) { return error instanceof Error ? error.message : String(error); }
