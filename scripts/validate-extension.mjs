import fs from "node:fs";
import path from "node:path";

const root = path.resolve("dist-extension");
const manifestPath = path.join(root, "manifest.json");
const appPath = path.join(root, "app", "app.html");

assertFile(manifestPath);
assertFile(appPath);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

assert(manifest.manifest_version === 3, "Extension must build as Manifest V3.");
assert(manifest.name === "ChatChat — AI Consultation", "Primary extension name must describe AI Consultation.");
assert(/equal participants/i.test(manifest.description), "Manifest description must describe equal participants.");
assert(!/parliament|house|chairman/i.test(`${manifest.name} ${manifest.description}`), "Manifest must not reintroduce hierarchy language.");
assert(manifest.side_panel?.default_path, "Manifest must keep the compact Side Panel compatibility entry.");
assert(manifest.background?.service_worker, "Manifest must declare a service worker.");
assert(!manifest.host_permissions, "Install-time host_permissions are forbidden; use optional_host_permissions.");
assert(
  Array.isArray(manifest.optional_host_permissions) && manifest.optional_host_permissions.length > 0,
  "Extension must request Provider origins only as optional host permissions.",
);

assertFile(path.join(root, manifest.side_panel.default_path));
assertFile(path.join(root, manifest.background.service_worker));
assertFile(path.join(root, "content-script.js"));

const appHtml = fs.readFileSync(appPath, "utf8");
assert(/AI Consultation Room/.test(appHtml), "Built full-page app must identify the consultation room.");
assert(/web-app/.test(appHtml), "Built full-page app must use the web-app surface.");

const serviceWorker = fs.readFileSync(path.join(root, manifest.background.service_worker), "utf8");
assert(/app\/app\.html/.test(serviceWorker), "Toolbar action must open the full-page ChatChat room.");

const sidePanelHtml = fs.readFileSync(path.join(root, manifest.side_panel.default_path), "utf8");
assert(/AI Consultation/.test(sidePanelHtml), "Built Side Panel must identify the consultation product.");
assert(!/royal-onboarding|summon-house|committee-house|sidepanel\.tsx/.test(sidePanelHtml), "Legacy House/Royal UI modules must not load in the compact Side Panel.");

const javascriptFiles = walk(root).filter((file) => file.endsWith(".js"));
for (const file of javascriptFiles) {
  const source = fs.readFileSync(file, "utf8");
  assert(!/\beval\s*\(/.test(source), `${relative(file)} contains eval(), which violates MV3 extension CSP.`);
  assert(!/new\s+Function\s*\(/.test(source), `${relative(file)} contains new Function(), which violates MV3 extension CSP.`);
}

console.log(
  `✓ ChatChat full-page AI Consultation extension validated (${javascriptFiles.length} JS files, optional Provider host permissions only)`,
);

function assertFile(file) {
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `Missing extension artifact: ${relative(file)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Extension validation failed: ${message}`);
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const value = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(value) : [value];
  });
}

function relative(file) {
  return path.relative(process.cwd(), file).replaceAll(path.sep, "/");
}
