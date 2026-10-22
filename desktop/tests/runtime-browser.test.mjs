import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {ManagedBrowserRuntime} from '../runtime/index.mjs';
const executablePath=process.env.CHATCHAT_RENDERER_BROWSER;
const skip=executablePath?false:'Set CHATCHAT_RENDERER_BROWSER for sandboxed controlled-browser transport checks.';
const html=`<!doctype html><meta charset="utf-8"><title>Explicit local transport fixture, not a real provider</title><main><section id="turns"></section><form onsubmit="return false"><textarea id="prompt-textarea"></textarea><button type="button" data-testid="send-button">Send</button></form></main><script>
let clicks=0;document.querySelector('button').addEventListener('click',()=>{
const input=document.querySelector('textarea'), text=input.value;input.value='';clicks++;document.documentElement.dataset.clicks=String(clicks);
const user=document.createElement('article');user.dataset.messageAuthorRole='user';user.textContent=text;document.getElementById('turns').append(user);
if(text==='STALL')return;
const assistant=document.createElement('article');assistant.dataset.messageAuthorRole='assistant';const body=document.createElement('div');body.className='markdown';body.textContent='Fixture reply to '+text;const copy=document.createElement('button');copy.dataset.testid='copy-turn-action-button';copy.textContent='Copy';assistant.append(body,copy);document.getElementById('turns').append(assistant);
});</script>`;
async function setup(t){
 const dataDir=await fs.mkdtemp(path.join(os.tmpdir(),'chatchat-runtime-browser-'));const launches=[];const contexts=[];
 const driver={async launchPersistentContext(profile,options){
  assert.equal(options.chromiumSandbox,true);assert.equal(profile.startsWith(dataDir+path.sep),true);
  const context=await chromium.launchPersistentContext(profile,{...options,executablePath,headless:true});contexts.push(context);launches.push({profile,options});
  // Page-specific test routing wins over production context routing. No requests reach model sites.
  const newPage=context.newPage.bind(context);context.newPage=async()=>{const page=await newPage();await page.route('**/*',async route=>{
    if(route.request().url()==='https://chatgpt.com/')return route.fulfill({status:200,contentType:'text/html',body:html});
    return route.abort();
   });return page;};return context;
 }};
 const runtime=new ManagedBrowserRuntime({dataDir,executablePath,chromium:driver,headless:true});
 t.after(async()=>{await runtime.close();await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await fs.rm(dataDir,{recursive:true,force:true});});
 return {runtime,dataDir,launches,contexts,driver};
}
test('real sandboxed Chromium transports only the new assistant reply and reuses no old chat', {skip},async t=>{
 const {runtime,launches,contexts}=await setup(t);const seat=await runtime.addSeat({providerId:'openai-chatgpt'});
 assert.equal(seat.status,'ready');assert.equal(launches.length,1);
 const firstPage=contexts[0].pages()[0];await firstPage.evaluate(()=>localStorage.setItem('fixture-login','persisted'));
 await runtime.prepareSeat(seat.id,{sessionId:'meeting-a'});assert.equal(firstPage.isClosed(),true);
 const page=contexts[0].pages()[0];assert.equal(await page.evaluate(()=>localStorage.getItem('fixture-login')),'persisted');
 const [a,b]=await Promise.all([runtime.send(seat.id,{prompt:'first',operationId:'turn-a',timeoutMs:7000}),runtime.send(seat.id,{prompt:'first',operationId:'turn-a',timeoutMs:7000})]);
 assert.equal(a.responseText,'Fixture reply to first');assert.deepEqual(a,b);assert.equal(await page.evaluate(()=>document.documentElement.dataset.clicks),'1');
 const c=await runtime.send(seat.id,{prompt:'second',operationId:'turn-b',timeoutMs:7000});assert.equal(c.responseText,'Fixture reply to second');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.clicks),'2');
 await runtime.prepareSeat(seat.id,{sessionId:'meeting-b'});assert.equal(page.isClosed(),true);
 const next=contexts[0].pages()[0];assert.equal(await next.locator('[data-message-author-role]').count(),0);
 assert.equal(await next.evaluate(()=>localStorage.getItem('fixture-login')),'persisted');
});
test('ambiguous post-click timeout is not resent; reload journal blocks the same operation', {skip},async t=>{
 const {runtime,dataDir,contexts,driver}=await setup(t);const seat=await runtime.addSeat({providerId:'openai-chatgpt'});await runtime.prepareSeat(seat.id,{sessionId:'stalled'});
 await assert.rejects(runtime.send(seat.id,{prompt:'STALL',operationId:'never-repeat',timeoutMs:300}),e=>e.ambiguous===true);
 await assert.rejects(runtime.send(seat.id,{prompt:'STALL',operationId:'never-repeat',timeoutMs:300}),e=>e.ambiguous===true);
 const page=contexts[0].pages()[0];if(page&&!page.isClosed())assert.equal(await page.evaluate(()=>document.documentElement.dataset.clicks),'1');
 await runtime.close();
 const restarted=new ManagedBrowserRuntime({dataDir,executablePath,chromium:driver,headless:true});t.after(()=>restarted.close());
 assert.equal(restarted.list()[0].status,'closed');await assert.rejects(restarted.send(seat.id,{prompt:'STALL',operationId:'never-repeat',timeoutMs:300}),e=>e.ambiguous===true);
 assert.equal(contexts.length,1,'Journal rejection must not relaunch a browser.');
});
