import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist-extension");
const manifestPath = path.join(root, "manifest.json");
const appPath = path.join(root, "app", "app.html");
for (const file of [manifestPath, appPath]) assertFile(file);

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(manifest.manifest_version === 3, "Extension must build as Manifest V3.");
assert(manifest.name === "ChatChat — AI Consultation", "Primary extension name must describe AI Consultation.");
assert(/equal participants/i.test(manifest.description), "Manifest description must describe equal participants.");
assert(!manifest.host_permissions, "Install-time host_permissions are forbidden.");
assert(Array.isArray(manifest.optional_host_permissions) && manifest.optional_host_permissions.length > 0, "Provider access must remain optional.");
assert(manifest.side_panel?.default_path, "Compact Side Panel compatibility entry is required.");
assert(manifest.action && !manifest.action.default_popup, "Toolbar action must be available for direct Full Room launch.");

const sidePath = path.join(root, manifest.side_panel.default_path);
const serviceWorkerPath = path.join(root, manifest.background.service_worker);
for (const file of [sidePath, serviceWorkerPath, path.join(root, "content-script.js")]) assertFile(file);

const app = fs.readFileSync(appPath, "utf8");
const side = fs.readFileSync(sidePath, "utf8");
const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");
const sourceApp = fs.readFileSync(path.resolve("app/app.html"), "utf8");
const sourceSide = fs.readFileSync(path.resolve("extension/sidepanel.html"), "utf8");

assert(/AI Consultation Room/.test(app) && /web-app/.test(app), "Full-page Web Room identity is missing.");
assert(!/open-web-room\.js/.test(side), "Side Panel must not be a mandatory trampoline into the Full Room.");
assert(/chrome\.action\.onClicked\.addListener/.test(serviceWorker), "Toolbar action must open the primary Full Room directly.");
assert(/openPanelOnActionClick:\s*false/.test(serviceWorker), "Toolbar action must not be captured by Side Panel behavior.");
assert(/app\/app\.html/.test(serviceWorker), "Toolbar action must target the extension-local Full Room.");
assert(/consultation-history-observer/.test(sourceSide), "Side Panel source entry must mount the shared consultation persistence observer.");
assert(/consultation-history-observer/.test(sourceApp), "Full Room source entry must mount the shared consultation persistence observer.");
assert(!/royal-onboarding|summon-house|committee-house|sidepanel\.tsx/.test(side), "Legacy House/Royal UI must not load.");

const js = walk(root).filter((file) => file.endsWith(".js"));
assert(js.some((file) => fs.readFileSync(file, "utf8").includes("__chatchatConsultationHistoryObserverV1")), "Production extension bundle must contain the shared consultation persistence observer.");
for (const file of js) {
  const source = fs.readFileSync(file, "utf8");
  assert(!/\beval\s*\(/.test(source), `${rel(file)} contains eval().`);
  assert(!/new\s+Function\s*\(/.test(source), `${rel(file)} contains new Function().`);
}

console.log(`✓ ChatChat zero-config Full Room extension validated (${js.length} JS files)`);

function assertFile(file) {
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `Missing extension artifact: ${rel(file)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Extension validation failed: ${message}`);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const value = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(value) : [value];
  });
}

function rel(file) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, "/");
}
