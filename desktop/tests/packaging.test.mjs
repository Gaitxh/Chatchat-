import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const yaml=require('js-yaml');
test('Windows build is one-click, current-user, self-contained and equally hardened',async()=>{
 const cfg=yaml.load(await fs.readFile(new URL('../electron-builder.yml',import.meta.url),'utf8'));
 assert.equal(cfg.nsis.oneClick,true);assert.equal(cfg.nsis.perMachine,false);assert.equal(cfg.nsis.allowElevation,false);assert.equal(cfg.nsis.deleteAppDataOnUninstall,false);
 assert.equal(cfg.win.requestedExecutionLevel,'asInvoker');assert.equal(cfg.extraResources[0].to,'browser');
 assert.equal(cfg.win.icon,'assets/chatchat.ico'); assert.equal(cfg.nsis.installerIcon,'assets/chatchat.ico');
 assert.equal(cfg.electronFuses.runAsNode,false);assert.equal(cfg.electronFuses.enableNodeOptionsEnvironmentVariable,false);assert.equal(cfg.electronFuses.enableNodeCliInspectArguments,false);assert.equal(cfg.electronFuses.enableEmbeddedAsarIntegrityValidation,true);assert.equal(cfg.electronFuses.onlyLoadAppFromAsar,true);
 const packaging=await fs.readFile(new URL('../scripts/package-windows.mjs',import.meta.url),'utf8');
 assert.match(packaging,/electron-builder\/cli\.js/);
 assert.doesNotMatch(packaging,/preview\.nsi|stage-windows/);
 assert.match(cfg.nsis.artifactName,/ChatChat-Setup/);
 assert.ok(cfg.files.includes('runtime-lock.json'),'Packed browser manifest must be inside app.asar');
 const lock=JSON.parse(await fs.readFile(new URL('../runtime-lock.json',import.meta.url),'utf8'));
 assert.equal(lock.browserRuntimeFiles.length,4);
 for(const file of lock.browserRuntimeFiles){
   assert.ok(['chrome.exe','chrome.dll','resources.pak','icudtl.dat'].includes(file.name));
   assert.match(file.sha256,/^[a-f0-9]{64}$/);
   assert.ok(Number.isInteger(file.bytes) && file.bytes>1000000);
 }
 assert.match(packaging,/assertBrowserIntegrity/);
 assert.match(packaging,/asar.extractFile/);
 assert.match(packaging,/getCurrentFuseWire/);
 assert.match(packaging,/verifySetupPayload/);
 assert.match(packaging,/NSIS-PAYLOAD-VERIFICATION/);
 for(const category of ['main','runtime','renderer','generated/src']){
   assert.ok(packaging.includes('packagedSourceFiles("'+category+'")'),
     'Production build must compare the full '+category+' tree');
 }
 assert.match(packaging,/SHA256SUMS.txt/);
 const workflow=await fs.readFile(new URL('../../.github/workflows/windows-desktop.yml',import.meta.url),'utf8');
 assert.match(workflow,/pull_request:/);
 assert.match(workflow,/branches: \[main\]/);
 assert.match(workflow,/contents: read/);
 assert.match(workflow,/npm run check/);
 assert.match(workflow,/npm run test:ci/);
 assert.match(workflow,/runs-on: windows-latest/);
 assert.match(workflow,/npm run package:win/);

});
test('renderer crash aborts controller and provider runtime rather than leaving invisible automated sends', async()=>{
 const source=await fs.readFile(new URL('../main/index.mjs',import.meta.url),'utf8');
 const start=source.indexOf("mainWindow.webContents.on('render-process-gone'");
 assert.ok(start>=0,'Renderer crash event is required');
 const boundary=source.slice(start,source.indexOf("mainWindow.webContents.on('will-navigate'",start));
 assert.match(boundary,/controller\?\.stopMeeting/);
 assert.match(boundary,/runtime\?\.stop/);
});
test('login completion polling never adds a seat or creates/navigates browser pages',async()=>{
 const source=await fs.readFile(new URL('../main/index.mjs',import.meta.url),'utf8');
 const polling=source.slice(source.indexOf('loginPoll=setInterval'),source.indexOf('loginPoll.unref'));
 assert.match(polling,/runtime.checkSeat/);assert.match(polling,/controller.getState\(\).busy/);assert.doesNotMatch(polling,/addSeat|openSeat|newPage|goto|send\(/);
});
