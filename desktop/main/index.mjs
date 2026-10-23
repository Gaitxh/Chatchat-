import { app, BrowserWindow, protocol, ipcMain, dialog, shell, session } from 'electron';
import { randomUUID, createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, CHANNEL, STATE_CHANNEL, trustedFrame, validateCommand, rendererPath } from './policy.mjs';
import { ManagedBrowserRuntime } from '../runtime/index.mjs';
import { createController } from './controller.mjs';
import { inspectMeetingBackup } from './backup.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
app.setName('ChatChat');
app.setAppUserModelId('com.gaitxh.chatchat.desktop');
// Test overrides never affect packaged applications or any personal browser profile.
if(!app.isPackaged && process.env.CHATCHAT_TEST_USER_DATA) app.setPath('userData',path.resolve(process.env.CHATCHAT_TEST_USER_DATA));
protocol.registerSchemesAsPrivileged([{scheme:'chatchat',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow, controller, runtime, loginPoll, polling=false, quitting=false;
// Restore preview exists ONLY in this process. Renderer never sees the source
// path, JSON bytes, or any browser/session files.
let restorePreview=null;
const RESTORE_PREVIEW_TTL=10*60*1000;
const BACKUP_MAX_BYTES=64*1024*1024;
async function readUserSelectedBackup(filePath){
 try {
  const stat=await fs.lstat(filePath);
  if(!stat.isFile() || stat.isSymbolicLink() || stat.size>BACKUP_MAX_BYTES) {
   throw new Error('Invalid selected file.');
  }
  const content=await fs.readFile(filePath,'utf8');
  if(Buffer.byteLength(content,'utf8')>BACKUP_MAX_BYTES) throw new Error('Oversized file.');
  return content;
 }catch{
  // Do not relay native file paths and system exception details to the
  // renderer; the operating-system picker already knows the selected path.
  throw new Error('无法读取或验证此备份文件，请检查文件是否完整。');
 }
}
const gotLock=app.requestSingleInstanceLock();
if(!gotLock) app.quit();
else {
 app.on('second-instance',()=>{ if(mainWindow){if(mainWindow.isMinimized()) mainWindow.restore();mainWindow.show();mainWindow.focus();} });
 app.whenReady().then(boot).catch(error=>{dialog.showErrorBox('ChatChat 启动失败',String(error?.message || error).slice(0,500));app.exit(1);});
 app.on('window-all-closed',()=>app.quit());
 app.on('before-quit',event=>{
   if(quitting) return; event.preventDefault(); quitting=true; clearInterval(loginPoll);
   void (async()=>{
    try { await Promise.race([(async()=>{await controller?.close();await runtime?.close();})(),new Promise(r=>setTimeout(r,10000))]); }
    finally { app.quit(); }
   })();
 });
}
function publish(state){if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(STATE_CHANNEL,state);}
async function boot(){
 const rendererRoot=path.resolve(here,'../renderer');
 protocol.handle('chatchat',async request=>{
   if(request.method!=='GET') return new Response('Method not allowed',{status:405});
   const file=rendererPath(request.url,rendererRoot); if(!file) return new Response('Not found',{status:404});
   try {
    const body=await fs.readFile(file);
    const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'}[path.extname(file)];
    return new Response(body,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'"}});
   }catch{return new Response('Not found',{status:404});}
 });
 const dataDir=app.getPath('userData');await fs.mkdir(dataDir,{recursive:true});
 let executablePath=path.join(process.resourcesPath,'browser','chrome-win64','chrome.exe');
 if(!app.isPackaged && process.env.CHATCHAT_BROWSER_EXECUTABLE) executablePath=path.resolve(process.env.CHATCHAT_BROWSER_EXECUTABLE);
 runtime=new ManagedBrowserRuntime({dataDir,executablePath,
  // Developer-only smoke tests may use an installed browser path;
  // packaged builds always verify the pinned bundled Chromium binary set.
  ...(app.isPackaged ? {} : {browserVerifier:null}),
  onChange:(seat)=>{if(controller) controller.runtimeChanged(seat);}});
 controller=await createController({runtime,dataDir,version:app.getVersion(),onChange:publish});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 session.defaultSession.setPermissionCheckHandler(()=>false);
 mainWindow=new BrowserWindow({width:1360,height:900,minWidth:720,minHeight:480,title:'ChatChat · 多模型协商室',backgroundColor:'#f4f5f9',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(here,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,devTools:!app.isPackaged}});
 mainWindow.removeMenu();
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 // A renderer crash removes the user's Stop control. Abort the meeting before
 // any later Provider turn can dispatch; preserve already-persisted history.
 mainWindow.webContents.on('render-process-gone', () => {
   try { void Promise.resolve(controller?.stopMeeting()).catch(() => {}); } catch {}
   try { void Promise.resolve(runtime?.stop()).catch(() => {}); } catch {}
 });
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(url!==APP_URL)event.preventDefault();});
 mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
 mainWindow.once('ready-to-show',()=>mainWindow.show());
 ipcMain.handle(CHANNEL,async(event,input)=>{
   if(!trustedFrame(event,mainWindow)) return {ok:false,error:'Untrusted desktop caller.'};
   try {
    const {method,args}=validateCommand(input);
    if(method==='openDataFolder') {const error=await shell.openPath(dataDir);if(error)throw new Error('无法打开本地数据目录。');return {ok:true,result:{opened:true}};}
    if(method==='previewRestoreBackup') {
      restorePreview=null;
      if(controller.getState().busy) throw new Error('Finish the current meeting operation before restoring history.');
      const choice=await dialog.showOpenDialog(mainWindow,{
        title:'选择 ChatChat 历史备份（先预览，不导入）',
        properties:['openFile'],
        filters:[{name:'ChatChat JSON 备份',extensions:['json']}],
      });
      if(choice.canceled || !choice.filePaths?.length) return {ok:true,result:{selected:false}};
      const filePath=choice.filePaths[0];
      const content=await readUserSelectedBackup(filePath);
      const summary=controller.previewRestoreData(content);
      const hash=createHash('sha256').update(content,'utf8').digest('hex');
      const previewToken=randomUUID();
      restorePreview={previewToken,filePath,hash,createdAt:Date.now(),summary};
      return {ok:true,result:{selected:true,previewToken,...summary}};
    }
    if(method==='confirmRestoreBackup') {
      const preview=restorePreview;
      restorePreview=null; // Single-use token, even for cancel/rejection.
      if(!preview || preview.previewToken!==args || Date.now()-preview.createdAt>RESTORE_PREVIEW_TTL) {
        throw new Error('Restore preview expired. Please choose the backup again.');
      }
      if(controller.getState().busy) throw new Error('Finish the current meeting operation before importing history.');
      const content=await readUserSelectedBackup(preview.filePath);
      if(createHash('sha256').update(content,'utf8').digest('hex')!==preview.hash){
        throw new Error('Backup changed after preview. No history was imported.');
      }
      const summary=controller.previewRestoreData(content);
      if(JSON.stringify(summary)!==JSON.stringify(preview.summary)){
        throw new Error('Local history or backup changed since preview. Preview again before importing.');
      }
      const response=await dialog.showMessageBox(mainWindow,{
        type:'warning',title:'确认恢复历史会议',
        message:'只导入尚不存在的历史会议，不覆盖现有记录。',
        detail:'预计新导入 '+summary.newMeetings+' 场；跳过已有 '+summary.existingMeetings+' 场。'
          +' 备份中的 '+summary.ignoredSeatBookmarks+' 个席位书签不会自动加入，更不会恢复登录状态、Cookie 或发送模型请求。'
          + (summary.excludedDamagedInSource > 0
            ? ' 注意：源备份曾遗漏 '+summary.excludedDamagedInSource+' 份受损历史。' : '')
          +' 本操作需要你确认。',
        buttons:['取消','确认导入历史'],defaultId:0,cancelId:0,noLink:true,
      });
      if(response.response!==1) return {ok:true,result:{restored:false}};
      const result=await controller.restoreBackupData(content);
      return {ok:true,result:{restored:true,...result}};
    }
    if(method==='verifyBackupFile') {
      const choice=await dialog.showOpenDialog(mainWindow,{
        title:'验证 ChatChat 会议备份（只读，不会导入）',
        properties:['openFile'],
        filters:[{name:'ChatChat JSON 备份',extensions:['json']}],
      });
      if(choice.canceled || !choice.filePaths?.length) return {ok:true,result:{verified:false}};
      const filePath=choice.filePaths[0];
      const stat=await fs.stat(filePath);
      if(!stat.isFile() || stat.size>64*1024*1024) throw new Error('Selected backup file is too large or invalid.');
      const details=inspectMeetingBackup(await fs.readFile(filePath,'utf8'));
      return {ok:true,result:{verified:true,...details}};
    }
    if(method==='backupLocalData') {
      const backup=await controller.backupData();
      if(!backup || typeof backup.content!=='string'
        || Buffer.byteLength(backup.content,'utf8')>64*1024*1024) throw new Error('Local backup exceeds its safety limit.');
      const choice=await dialog.showSaveDialog(mainWindow,{
        title:'备份 ChatChat 本地会议（不含网页登录）',
        defaultPath:'ChatChat-Meetings-Backup-'+new Date().toISOString().slice(0,10)+'.json',
        filters:[{name:'ChatChat JSON 备份',extensions:['json']}],
      });
      if(choice.canceled || !choice.filePath) return {ok:true,result:{saved:false}};
      // Write to a sibling then atomically replace. An interrupted backup
      // must not leave the user with a half-written "complete" JSON file.
      const temporary=choice.filePath+'.'+randomUUID()+'.tmp';
      let file;
      try {
        file=await fs.open(temporary,'wx',0o600);
        await file.writeFile(backup.content,'utf8');
        await file.sync();
        await file.close();
        file=null;
        await fs.rename(temporary,choice.filePath);
      } finally {
        await file?.close().catch(()=>{});
        await fs.unlink(temporary).catch(()=>{});
      }
      return {ok:true,result:{saved:true,meetingCount:backup.meetingCount,
        skippedDamagedArchives:backup.skippedDamagedArchives}};
    }
    if(method==='exportMeeting') {
      const text=await controller.exportData(args);if(typeof text!=='string'||text.length>10000000)throw new Error('Meeting export is unavailable or too large.');
      const choice=await dialog.showSaveDialog(mainWindow,{title:'导出会议记录',defaultPath:`ChatChat-${args.slice(0,60)}.md`,filters:[{name:'Markdown',extensions:['md']}]});
      if(choice.canceled||!choice.filePath)return {ok:true,result:{saved:false}};
      await fs.writeFile(choice.filePath,text,'utf8');return {ok:true,result:{saved:true}};
    }
    const result=await controller[method](args);
    return {ok:true,result};
   } catch(error){return {ok:false,error:String(error?.message||'操作失败，请重试。').slice(0,500)};}
 });
 // Passive login completion detection: inspect only already-open, owned pages.
 // No page creation, navigation, prompt, or automatic retry submission is permitted here.
 loginPoll=setInterval(async()=>{
  if(polling||quitting||controller.getState().busy)return;
  polling=true;
  try {
   for(const seat of runtime.list()){
    if(quitting||controller.getState().busy)break;
    if(!['needs_login','opening','attention'].includes(seat.status))continue;
    try {controller.runtimeChanged(await runtime.checkSeat(seat.id));}catch{/* UI retains the last safe state. */}
   }
  }finally{polling=false;}
 },2500);
 loginPoll.unref();
 await mainWindow.loadURL(APP_URL);
}
