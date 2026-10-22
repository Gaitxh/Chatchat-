import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const build = path.resolve(process.argv[2] ?? 'dist-extension');
const output = path.resolve(process.argv[3] ?? 'artifacts/installed-extension');
const chrome = process.env.CHROME_BIN ?? '/usr/bin/google-chrome';
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'chatchat-install-smoke-'));
let browser, socket, seq = 0; const pending = new Map(); let stderr = '';
const checks = []; const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wait(read, label, budget = 20000) {
 const until = Date.now() + budget;
 while (Date.now() < until) { const value = await read(); if (value) return value; if (browser?.exitCode !== null) throw new Error(`Browser exited: ${stderr.slice(-1200)}`); await sleep(80); }
 throw new Error(`Timed out: ${label}`);
}
function call(method, params = {}, sessionId) {
 return new Promise((resolve,reject) => {
  const id=++seq; const timer=setTimeout(() => {pending.delete(id); reject(new Error(`CDP timeout: ${method}`));},10000);
  pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
 });
}
async function evaluate(sessionId, expression) {
 const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true},sessionId);
 if(r.exceptionDetails)throw new Error(`Page exception: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description ?? ''}`);
 return r.result.value;
}
async function attach(targetId) {const {sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});await call('Runtime.enable',{},sessionId);await call('Page.enable',{},sessionId);return sessionId;}
async function targets(){return (await call('Target.getTargets')).targetInfos;}
async function capture(sessionId, basename) {
 await call('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false},sessionId);
 await sleep(180);
 const image=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false},sessionId);
 await fs.writeFile(path.join(output,basename+'.png'),Buffer.from(image.data,'base64'));
 const dom=await evaluate(sessionId,'document.documentElement.outerHTML');await fs.writeFile(path.join(output,basename+'.html'),dom);
}
try {
 await fs.mkdir(output,{recursive:true});
 browser=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--disable-sync','--disable-background-networking','--disable-component-update','--disable-default-apps','--enable-unsafe-extension-debugging','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
 browser.stderr.on('data',d=>{stderr=(stderr+String(d)).slice(-4000);});
 const port=await wait(async()=>{try{return Number((await fs.readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);}catch{return null;}},'isolated browser startup');
 const version=await(await fetch(`http://127.0.0.1:${port}/json/version`)).json();
 socket=new WebSocket(version.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
 socket.addEventListener('message',ev=>{const x=JSON.parse(ev.data);if(x.id){const p=pending.get(x.id);if(!p)return;pending.delete(x.id);clearTimeout(p.timer);x.error?p.reject(new Error(`${x.error.code}: ${x.error.message}`)):p.resolve(x.result);}else if(x.method==='Runtime.exceptionThrown')errors.push(x.params.exceptionDetails?.text??'exception');});
 const {id}=await call('Extensions.loadUnpacked',{path:build});checks.push('production extension loaded in a fresh isolated browser profile');
 const base=`chrome-extension://${id}/`;
 const welcome=await wait(async()=> (await targets()).find(t=>t.type==='page'&&t.url===base+'welcome.html'),'first-install welcome');
 checks.push('first installation opened local welcome page');const ws=await attach(welcome.targetId);
 const permissions=await evaluate(ws,'chrome.permissions.getAll()');assert.deepEqual(permissions.origins??[],[]);checks.push('no provider host permissions granted on installation');
 await capture(ws,'welcome');
 await evaluate(ws,'document.querySelector("#open-meeting-room").click()');
 const room=await wait(async()=> (await targets()).find(t=>t.type==='page'&&t.url===base+'app/app.html'),'meeting window');const rs=await attach(room.targetId);
 await wait(()=>evaluate(rs,'Boolean(document.querySelector(".participants-card"))'),'room rendered');
 const state=await evaluate(rs,'({surface:document.documentElement.dataset.surface,ready:document.readyState,invite:!!document.querySelector("[data-chatchat-invite-ai]"),visible:(()=>{const x=document.querySelector(".participants-card");return !!x&&getComputedStyle(x).display!=="none"&&x.getBoundingClientRect().height>0})()})');
 assert(state.visible,'empty room must show participant choices');assert(state.invite,'empty room must expose invitation');checks.push('empty meeting window exposes seat selection');
 const windows=await evaluate(ws,'chrome.windows.getAll({populate:true}).then(xs=>xs.map(x=>({type:x.type,urls:x.tabs.map(t=>t.url)})))');
 assert(windows.some(w=>w.type==='popup'&&w.urls.includes(base+'app/app.html')));checks.push('meeting is a real browser popup window, not an embedded provider webview');
 const tabTargets=(await call('Target.getTargets',{filter:[{type:'tab',exclude:false},{exclude:true}]})).targetInfos;
 const actionTab=tabTargets.find(t=>t.url===base+'welcome.html')??tabTargets[0];assert(actionTab,'browser must expose a tab target for toolbar test');
 await Promise.all([call('Extensions.triggerAction',{id,targetId:actionTab.targetId}),call('Extensions.triggerAction',{id,targetId:actionTab.targetId})]);await sleep(500);
 const rooms=(await targets()).filter(t=>t.type==='page'&&t.url===base+'app/app.html');assert.equal(rooms.length,1);checks.push('rapid toolbar actions reuse one live meeting without resetting it');
 const all=await targets();assert(!all.some(t=>t.type==='page'&&/^https?:/.test(t.url)));checks.push('installation and room entry opened no third-party provider website');
 await capture(rs,'empty-room');assert.equal(errors.length,0,`uncaught page errors: ${errors.join('; ')}`);checks.push('welcome and empty room had no uncaught page exceptions');
 const syntheticChecks=[];
 for (const kind of ['known','custom']) {
  const {targetId}=await call('Target.createTarget',{url:base+`app/app.html?showcase=invite-ai&target=${kind}&lang=zh`});
  const session=await attach(targetId);
  await wait(async()=>{
   const state=await evaluate(session,'({status:document.documentElement.dataset.chatchatInviteAiShowcase,error:document.documentElement.dataset.chatchatInviteAiDebug})');
   if(state.status==='failed')throw new Error(`Synthetic ${kind} invite: ${state.error}`);
   return state.status==='complete';
  },`explicit ${kind} invitation synthetic UI`,25000);
  if(kind==='custom')assert.equal(await evaluate(session,'document.documentElement.dataset.chatchatInviteAiCustomConfirmed'),'true');
  await capture(session,`synthetic-invite-${kind}-zh`);syntheticChecks.push(`${kind} invitation UI completed with an explicitly labeled fixture`);
  await call('Target.closeTarget',{targetId});
 }
 const evidence={status:'passed',browser:version.Browser,checks,syntheticChecks,providerInferenceTested:false,profile:'fresh isolated temporary profile; removed after test'};
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
} catch(error) {
 await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'result.json'),JSON.stringify({status:'failed',checks,error:error.message,providerInferenceTested:false},null,2)+'\n');console.error(error);process.exitCode=1;
} finally {
 if(socket?.readyState===WebSocket.OPEN){try{await call('Browser.close');}catch{}socket.close();}
 if(browser&&browser.exitCode===null){browser.kill('SIGTERM');await sleep(250);if(browser.exitCode===null)browser.kill('SIGKILL');}
 for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('Browser closed'));}pending.clear();
 await fs.rm(profile,{recursive:true,force:true,maxRetries:3}).catch(()=>{});
}
