import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { createController } from '../main/controller.mjs';
import { ManagedBrowserRuntime } from '../runtime/index.mjs';
import { CouncilOrchestrator } from '../generated/src/core/orchestrator.js';
import { BrowserConsultationAgent } from '../generated/src/provider-sdk/consultation-agent.js';

const executablePath = process.env.CHATCHAT_RENDERER_BROWSER;
const skip = executablePath ? false : 'Requires pinned local Chromium for real two-provider browser fixture.';

function providerFixture(provider) {
  const chatgpt = provider === 'openai-chatgpt';
  const composer = chatgpt
    ? '<textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">Send</button>'
    : '<textarea id="chat-input"></textarea><button aria-label="Send" type="button">Send</button>';
  const script = [
    'const who='+JSON.stringify(provider)+';',
    'let clicks=0;',
    'const answerFor=(prompt)=>{',
    '  let payload;',
    '  const sourceJson=()=>JSON.parse(prompt.slice(prompt.lastIndexOf("\\n\\n")+2));',
    '  if(prompt.includes("Return only <CHATCHAT_SYNTHESIS_V1>")){',
    '    const source=sourceJson(), ids=[], actors=new Set();',
    '    for(const entry of source.events){',
    '      if(!actors.has(entry.author)){ ids.push(entry.id);actors.add(entry.author); }',
    '      if(ids.length===2)break;',
    '    }',
    '    payload={answer:"Safest path: pilot first; keep the dissent visible.",',
    '      eventIds:ids,caveats:["Only the recorded model discussion was inspected."]};',
    '    return "<CHATCHAT_SYNTHESIS_V1>"+JSON.stringify(payload)+"</CHATCHAT_SYNTHESIS_V1>";',
    '  }',
    '  if(prompt.includes("Return only <CHATCHAT_REVIEW_V1>")){',
    '    const source=sourceJson();',
    '    payload={verdict:"approve",commentary:"Draft preserves the minority caution.",',
    '      eventIds:[source.source.events[0].id]};',
    '    return "<CHATCHAT_REVIEW_V1>"+JSON.stringify(payload)+"</CHATCHAT_REVIEW_V1>";',
    '  }',
    '  const phase=prompt.includes("PHASE: final")?"final":prompt.includes("PHASE: debate")?"debate":"sealed";',
    '  const stance=who==="openai-chatgpt"?"Pilot with safeguards":"Wait for a safer baseline";',
    '  payload={contributions:[{kind:phase==="final"?"final_position":"argument",',
    '    stance,content:who+" "+phase+" documented perspective",confidence:0.65,',
    '    ...(phase==="final"?{caveats:["Fixture output, not a verified Provider claim."]}:{})}]};',
    '  return "<CHATCHAT_COUNCIL_JSON>"+JSON.stringify(payload)+"</CHATCHAT_COUNCIL_JSON>";',
    '};',
    'document.querySelector("button").addEventListener("click",()=>{',
    '  const editor=document.querySelector("textarea"),prompt=editor.value;',
    '  editor.value="";clicks++;document.documentElement.dataset.clicks=String(clicks);',
    '  const roleName=who==="openai-chatgpt"?"data-message-author-role":"data-role";',
    '  const user=document.createElement("article");user.setAttribute(roleName,"user");',
    '  user.textContent=prompt;document.querySelector("#turns").append(user);',
    '  const bot=document.createElement("article");bot.setAttribute(roleName,"assistant");',
    '  const md=document.createElement("div");md.className="markdown";md.textContent=answerFor(prompt);',
    '  bot.append(md);const copy=document.createElement("button");copy.textContent="Copy";',
    '  if(who==="openai-chatgpt")copy.setAttribute("data-testid","copy-turn-action-button");',
    '  else copy.setAttribute("aria-label","Copy");',
    '  bot.append(copy);document.querySelector("#turns").append(bot);',
    '});',
  ].join('\n');
  return '<!doctype html><meta charset="utf-8"><title>Local controlled AI fixture</title>'
    +'<main><section id="turns"></section><form onsubmit="return false">'
    +composer+'</form></main><script>'+script+'</script>';
}

async function settled(controller, timeoutMs = 50_000) {
  const start = Date.now();
  while (controller.getState().busy) {
    if (Date.now()-start > timeoutMs) throw new Error('Council fixture did not settle: '+controller.getState().meeting?.phase);
    await new Promise((resolve)=>setTimeout(resolve,40));
  }
  return controller.getState();
}

test('real sandboxed two-browser council → opt-in draft → peer review → local replay',
{skip, timeout:120_000}, async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(),'chatchat-full-council-'));
  const contexts=[], urls=[];
  let controller;
  const driver = {
    async launchPersistentContext(profile, options) {
      assert.equal(options.chromiumSandbox,true);
      const site = profile.includes('openai-chatgpt') ? 'openai-chatgpt' : 'deepseek-chat';
      const allowed = site==='openai-chatgpt'?'https://chatgpt.com/':'https://chat.deepseek.com/';
      const context=await chromium.launchPersistentContext(profile,{...options,executablePath,headless:true});
      contexts.push(context);
      const newPage=context.newPage.bind(context);
      context.newPage=async ()=>{
        const page=await newPage();
        await page.route('**/*', async (route)=>{
          const url=route.request().url();
          if(url===allowed){
            urls.push(url);
            await route.fulfill({status:200, contentType:'text/html; charset=utf-8', body:providerFixture(site)});
          } else await route.abort();
        });
        return page;
      };
      return context;
    }
  };
  const runtime = new ManagedBrowserRuntime({dataDir,executablePath,headless:true,chromium:driver,
    onChange:(seat)=>controller?.runtimeChanged(seat)});
  controller=createController({runtime,dataDir,
    core:{CouncilOrchestrator,BrowserConsultationAgent,timeoutMs:9000,prepareTimeoutMs:9000,closeTimeoutMs:3500}});
  t.after(async ()=>{
    await controller.close();
    await runtime.close();
    await Promise.allSettled(contexts.map((context)=>context.close()));
    await fs.rm(dataDir,{recursive:true,force:true});
  });

  await controller.addSeat({providerId:'openai-chatgpt'});
  await controller.addSeat({providerId:'deepseek-chat'});
  assert.equal(controller.getState().seats.filter((seat)=>seat.status==='ready').length,2);

  controller.startMeeting({proposal:'Should we deploy a reversible pilot?',mode:'balanced',maxRounds:2});
  const first=await settled(controller);
  assert.equal(first.meeting.status,'completed',first.meeting.error);
  assert.ok(first.meeting.events.length>=4);
  assert.equal(first.meeting.report.positions.length,2);
  assert.equal(first.synthesisAvailable,true);
  const before=await Promise.all(contexts.map(async c=>{
    const page=c.pages().find(p=>p.url().startsWith('https:'));
    return page?Number(await page.evaluate(()=>document.documentElement.dataset.clicks)):0;
  }));
  assert.equal(first.meeting.synthesis,undefined,'No automatic synthesis should be sent');
  controller.synthesizeMeeting();
  const final=await settled(controller);
  assert.equal(final.meeting.status,'completed');
  assert.equal(final.meeting.synthesis.status,'reviewed',
    JSON.stringify(final.meeting.synthesis));
  assert.equal(final.meeting.synthesis.reviews.length,1);
  const last=await Promise.all(contexts.map(async c=>{
    const page=c.pages().find(p=>p.url().startsWith('https:'));
    return page?Number(await page.evaluate(()=>document.documentElement.dataset.clicks)):0;
  }));
  assert.equal(last.reduce((a,b)=>a+b,0)-before.reduce((a,b)=>a+b,0),2,
    'Exactly one draft and one review sent');
  const exported=await controller.exportData(final.meeting.id);
  assert.match(exported,/Optional post-meeting synthesis/);
  assert.match(exported,/Safest path: pilot first/);
  assert.ok(urls.includes('https://chatgpt.com/'));
  assert.ok(urls.includes('https://chat.deepseek.com/'));
  const total=last.reduce((a,b)=>a+b,0);
  await controller.newMeeting();
  await controller.loadMeeting(final.meeting.id);
  assert.equal(controller.getState().meeting.synthesis.status,'reviewed');
  assert.equal(controller.getState().synthesisAvailable,false);
  const after=await Promise.all(contexts.map(async c=>{
    const page=c.pages().find(p=>p.url().startsWith('https:'));
    return page?Number(await page.evaluate(()=>document.documentElement.dataset.clicks)):0;
  }));
  assert.equal(after.reduce((a,b)=>a+b,0),total,'History replay must not touch provider chats');
});
