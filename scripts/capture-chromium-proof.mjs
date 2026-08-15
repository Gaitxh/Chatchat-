import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const options = parseArgs(process.argv.slice(2));
if (!options.chrome || !options.url || !options.marker || !options.screenshot || !options.dom) {
  throw new Error("Usage: node scripts/capture-chromium-proof.mjs --chrome <bin> --url <url> --marker attr=value --screenshot <png> --dom <html> [--width 1440 --height 3200 --timeout-ms 45000]");
}

const width = Number(options.width ?? 1440);
const height = Number(options.height ?? 3200);
const timeoutMs = Number(options["timeout-ms"] ?? 45_000);
const [markerAttribute, markerValue = "complete"] = splitMarker(options.marker);
const profile = await fs.mkdtemp(path.join(os.tmpdir(), "chatchat-cdp-"));
let chrome;
try {
  chrome = spawn(options.chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    options.url,
  ], { stdio: ["ignore", "pipe", "pipe"] });

  let stderr = "";
  chrome.stderr.setEncoding("utf8");
  chrome.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-16_000); });

  const portFile = path.join(profile, "DevToolsActivePort");
  const portText = await waitForFile(portFile, timeoutMs, () => chrome.exitCode != null);
  const port = Number(portText.split(/\r?\n/)[0]);
  if (!Number.isFinite(port)) throw new Error(`Could not read Chromium DevTools port. ${stderr}`);

  const page = await waitForPage(port, options.url, timeoutMs);
  const cdp = await connectCdp(page.webSocketDebuggerUrl);
  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });

    await waitForMarker(cdp, markerAttribute, markerValue, timeoutMs);
    await cdp.send("Runtime.evaluate", {
      expression: "window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body && (document.body.scrollTop = 0);",
      awaitPromise: false,
    });
    await sleep(120);

    const dom = await evaluateValue(cdp, "document.documentElement.outerHTML");
    await fs.mkdir(path.dirname(options.dom), { recursive: true });
    await fs.writeFile(options.dom, `<!doctype html>\n${dom}\n`, "utf8");

    const shot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    if (!shot?.data) throw new Error("Chromium returned no screenshot data.");
    await fs.mkdir(path.dirname(options.screenshot), { recursive: true });
    await fs.writeFile(options.screenshot, Buffer.from(shot.data, "base64"));

    const dimensions = await evaluateValue(cdp, "JSON.stringify({w:innerWidth,h:innerHeight,scrollY,body:document.body?.scrollHeight||0})");
    process.stdout.write(`✓ captured ${options.marker} at ${options.url}\n${dimensions}\n`);
  } finally {
    cdp.close();
  }
} catch (error) {
  const exit = chrome?.exitCode;
  throw new Error(`Chromium proof capture failed${exit == null ? "" : ` (exit ${exit})`}: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  if (chrome && chrome.exitCode == null) chrome.kill("SIGKILL");
  await fs.rm(profile, { recursive: true, force: true });
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const token = values[index];
    if (!token?.startsWith("--")) continue;
    const key = token.slice(2);
    const value = values[index + 1];
    if (!value || value.startsWith("--")) result[key] = "true";
    else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function splitMarker(value) {
  const index = value.indexOf("=");
  if (index < 1) return [value, "complete"];
  return [value.slice(0, index), value.slice(index + 1)];
}

async function waitForFile(file, timeout, exited) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (exited()) throw new Error("Chromium exited before exposing DevToolsActivePort.");
    try { return await fs.readFile(file, "utf8"); } catch {}
    await sleep(40);
  }
  throw new Error(`Timed out waiting for ${file}.`);
}

async function waitForPage(port, expectedUrl, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      const pages = await response.json();
      const page = pages.find((item) => item.type === "page" && item.url === expectedUrl)
        ?? pages.find((item) => item.type === "page" && item.url !== "about:blank")
        ?? pages.find((item) => item.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(50);
  }
  throw new Error("Timed out waiting for a Chromium page target.");
}

async function waitForMarker(cdp, attribute, value, timeout) {
  const deadline = Date.now() + timeout;
  const expression = `document.documentElement.getAttribute(${JSON.stringify(attribute)}) === ${JSON.stringify(value)}`;
  while (Date.now() < deadline) {
    const matched = await evaluateValue(cdp, expression).catch(() => false);
    if (matched === true) return;
    await sleep(60);
  }
  const diagnostics = await evaluateValue(cdp, `JSON.stringify({ready:document.readyState,attrs:Object.fromEntries([...document.documentElement.attributes].map(a=>[a.name,a.value])),text:(document.body?.innerText||"").slice(0,1200)})`).catch(() => "unavailable");
  throw new Error(`Timed out waiting for ${attribute}=${value}. Diagnostics: ${diagnostics}`);
}

async function evaluateValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result?.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Runtime evaluation failed.");
  return result?.result?.value;
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timed out connecting to Chromium DevTools WebSocket.")), 8_000);
    socket.addEventListener("open", () => { clearTimeout(timer); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("Could not connect to Chromium DevTools WebSocket.")); }, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
    else waiter.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const waiter of pending.values()) waiter.reject(new Error("Chromium DevTools WebSocket closed."));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      const requestId = ++id;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    close() { socket.close(); },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
