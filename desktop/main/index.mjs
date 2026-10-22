import { app, BrowserWindow, protocol, ipcMain, dialog, shell, session } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_URL, CHANNEL, STATE_CHANNEL, trustedFrame, validateCommand, rendererPath } from './policy.mjs';
import { ManagedBrowserRuntime } from '../runtime/index.mjs';
import { createController } from './controller.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
app.setName('ChatChat');
app.setAppUserModelId('com.gaitxh.chatchat.desktop');
// Test overrides never affect packaged applications or any personal browser profile.
if(!app.isPackaged && process.env.CHATCHAT_TEST_USER_DATA) app.setPath('userData',path.resolve(process.env.CHATCHAT_TEST_USER_DATA));
protocol.registerSchemesAsPrivileged([{scheme:'chatchat',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow, controller, runtime, loginPoll, polling=false, quitting=false;
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
