import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron } from 'playwright-core';
import { buildMeetingBackup } from '../main/backup.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (process.platform !== 'win32') throw new Error('Windows-only isolated desktop smoke.');
const executablePath = process.env.CHATCHAT_ELECTRON_EXECUTABLE;
const browserPath = process.env.CHATCHAT_SMOKE_BROWSER;
if (!executablePath || !browserPath) throw new Error('Use the local pinned Electron and Chromium test binaries.');
const dir = await mkdtemp(path.join(os.tmpdir(),'chatchat-native-restore-'));
const userData = path.join(dir,'app-owned-user-data');
await mkdir(userData);
const backupPath = path.join(dir,'verified-restore.json');
const id = 'meeting-9aa13d9d-1234-4dcb-a5ea-56d1527d05d9';
const fixture = {
 createdAt:'2026-10-22T09:00:00.000Z',
 seats:[{id:'seat-alpha-1',providerId:'alpha',name:'Alpha',url:'https://alpha.example/'}],
 skippedDamagedArchives:0,
 meetings:[{
  schema:1,mode:'balanced',maxRounds:2,updatedAt:'2026-10-22T09:00:00.000Z',
  roster:[{id:'seat-alpha-1',providerId:'alpha',name:'Alpha',url:'https://alpha.example/'}],
  meeting:{id,proposal:'Native restore test, not a real AI session',status:'cancelled',
   phase:'cancelled',round:0,events:[],report:null},
 }],
};
const bytes = buildMeetingBackup(fixture);
await writeFile(backupPath,bytes,'utf8');

let app;
try {
 // A GitHub-hosted Windows runner may have no interactive desktop session.
 // This best-effort CI diagnostic can use Chromium headless mode; the local
 // Windows release smoke still runs normally with its full window.
 const ciHeadless = process.env.CHATCHAT_CI_HEADLESS === '1';
 const electronEnv = { ...process.env, CHATCHAT_TEST_USER_DATA:userData,
   CHATCHAT_BROWSER_EXECUTABLE:browserPath };
 delete electronEnv.ELECTRON_RUN_AS_NODE;
 app=await _electron.launch({
  executablePath,
  args:ciHeadless ? [root,'--headless','--disable-gpu'] : [root],
  env:electronEnv,
  timeout:30_000,
 });
 const page=await app.firstWindow();
 const errors=[];
 page.on('pageerror',(error)=>errors.push(error.message));
 await page.waitForFunction(()=>Boolean(window.chatChat && document.getElementById('preview-restore')),
   {}, {timeout:12_000});
 assert.equal((await page.evaluate(()=>window.chatChat.getState())).history.length,0);
 assert.equal((await page.evaluate(()=>window.chatChat.getState())).seats.length,0);
 await app.evaluate(({dialog}, filePath)=>{
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[filePath]});
  dialog.showMessageBox=async()=>({response:0});
 },backupPath);

 await page.locator('#history-open').click();
 await page.locator('#history-dialog').waitFor({state:'visible'});
 await page.locator('#preview-restore').click();
 await page.locator('#restore-preview').waitFor({state:'visible'});
 assert.match(await page.locator('#restore-preview').textContent(), /可新增 1 场/);
 assert.equal(await page.locator('#confirm-restore').isEnabled(),true);
 await page.locator('#confirm-restore').click();
 assert.equal((await page.evaluate(()=>window.chatChat.getState())).history.length,0,
  'Native confirmation cancellation must never write archives');

 // Re-preview, then mutate the file before native confirmation. The saved
 // fingerprint must reject the change before any archive or provider work.
 await page.locator('#preview-restore').click();
 await page.locator('#restore-preview').waitFor({state:'visible'});
 await writeFile(backupPath,'{"forged":"replacement"}');
 await page.locator('#confirm-restore').click();
 assert.equal((await page.evaluate(()=>window.chatChat.getState())).history.length,0,
  'Changed file after preview must fail without creating an archive');

 await writeFile(backupPath,bytes,'utf8');
 await app.evaluate(({dialog})=>{
  dialog.showMessageBox=async()=>({response:1});
 });
 await page.locator('#preview-restore').click();
 await page.locator('#restore-preview').waitFor({state:'visible'});
 await page.locator('#confirm-restore').click();
 // The IPC bridge is async. Page.waitForFunction can observe a truthy
 // promise before the file transaction has completed on some Electron builds.
 // Poll completed controller snapshots from the test process, and only
 // finish after mutation has stopped AND the history entry exists.
 let state;
 const commitDeadline=Date.now()+15_000;
 for (;;) {
   state=await page.evaluate(()=>window.chatChat.getState());
   if (state.history.length===1 && state.busy===false) break;
   if (Date.now()>commitDeadline) {
     throw new Error('Restore did not finish or persist one meeting before its deadline.');
   }
   await new Promise((resolve)=>setTimeout(resolve,60));
 }
 assert.equal(state.history[0].id,id);
 assert.equal(state.seats.length,0);
 assert.equal(state.meeting,null);
 assert.equal(state.synthesisAvailable,false);
 const allWindows=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length);
 assert.equal(allWindows,1,'Import must not open any provider windows');

 const historic=await page.evaluate((meetingId)=>window.chatChat.loadMeeting(meetingId),id);
 assert.equal(historic.meeting.status,'cancelled');
 assert.equal(historic.meeting.proposal,'Native restore test, not a real AI session');
 assert.deepEqual(errors,[]);
 console.log('PASS_WINDOWS_NATIVE_BACKUP_PREVIEW_CANCEL_TAMPER_CONFIRM_AND_HISTORY',
   JSON.stringify({restoredMeetings:state.history.length,activeSeats:state.seats.length,
    providerWindows:allWindows,nativeInstallTested:false}));
} finally {
 await app?.close();
 await rm(dir,{recursive:true,force:true,maxRetries:30,retryDelay:200});
}
