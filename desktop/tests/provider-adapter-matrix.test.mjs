import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium as realChromium } from 'playwright-core';
import { ManagedBrowserRuntime } from '../runtime/index.mjs';
import { ADAPTERS, PROVIDERS } from '../runtime/providers.mjs';

const browserBinary = process.env.CHATCHAT_RENDERER_BROWSER;
const hasBrowser = browserBinary ? false : 'Requires a local isolated Chromium; never opens a real account.';
const experiments = PROVIDERS.filter((provider) => provider.automation === 'experimental');
const layouts = {
  'openai-chatgpt': {
    composer: '<textarea id="prompt-textarea"></textarea>',
    send: '<button data-testid="send-button">Send</button>',
    user: '<article data-message-author-role="user"></article>',
    assistant: '<article data-message-author-role="assistant"></article>',
    answer: '<div class="markdown"></div>',
    copy: '<button data-testid="copy-turn-action-button">Copy</button>',
  },
  'anthropic-claude': {
    composer: '<div class="ProseMirror" role="textbox" contenteditable="true"></div>',
    send: '<button aria-label="Send message">Send</button>',
    user: '<div data-testid="user-message"></div>',
    assistant: '<div data-is-streaming="false"></div>',
    answer: '<div class="font-claude-response"></div>',
    copy: '<button aria-label="Copy">Copy</button>',
  },
  'deepseek-chat': {
    composer: '<textarea id="chat-input"></textarea>',
    send: '<button aria-label="Send">Send</button>',
    user: '<article data-role="user"></article>',
    assistant: '<article data-role="assistant"></article>',
    answer: '<div class="ds-markdown"></div>',
    copy: '<button aria-label="Copy">Copy</button>',
  },
  'qwen-chat': {
    composer: '<textarea id="chat-input"></textarea>',
    send: '<button aria-label="Send message">Send</button>',
    user: '<article data-role="user"></article>',
    assistant: '<article data-role="assistant"></article>',
    answer: '<div class="qwen-markdown"></div>',
    copy: '<button aria-label="Copy">Copy</button>',
  },
  'google-gemini': {
    composer: '<rich-textarea><div role="textbox" contenteditable="true"></div></rich-textarea>',
    send: '<button class="send-button">Send</button>',
    user: '<user-query></user-query>',
    assistant: '<model-response></model-response>',
    answer: '<message-content></message-content>',
    copy: '<button aria-label="Copy response">Copy</button>',
  },
};
assert.deepEqual(experiments.map((provider) => provider.id).sort(),Object.keys(layouts).sort(),
  'Add a reviewed fixture before advertising another automatic experimental Provider.');

function fixtureMarkup(id) {
  const recipe = layouts[id];
  const data = JSON.stringify({ id, ...recipe }).replace(/</g,'\\u003c');
  return '<!doctype html><meta charset="utf-8">'
    +'<title>CONTROLLED FIXTURE: NOT A PROVIDER SITE</title>'
    +'<main><section id="messages"></section><form onsubmit="return false">'
    +recipe.composer+recipe.send+'</form></main>'
    +'<script>'
    +'const fixture='+data+';'
    +'const box=document.querySelector("form");'
    +'const editor=box.querySelector("textarea,[contenteditable=true]");'
    +'document.querySelector("form button").addEventListener("click",()=>{'
    +'const prompt=editor.tagName==="TEXTAREA"?editor.value:editor.innerText;'
    +'if(editor.tagName==="TEXTAREA")editor.value="";else editor.textContent="";'
    +'const list=document.getElementById("messages");'
    +'const fromUser=document.createElement("div");fromUser.innerHTML=fixture.user;'
    +'const user=fromUser.firstElementChild;user.textContent=prompt;list.append(user);'
    +'const fromModel=document.createElement("div");fromModel.innerHTML=fixture.assistant;'
    +'const model=fromModel.firstElementChild;'
    +'const text=document.createElement("div");text.innerHTML=fixture.answer;'
    +'text.firstElementChild.textContent="Controlled reply from "+fixture.id+": "+prompt;'
    +'model.append(text.firstElementChild);'
    +'const actions=document.createElement("div");actions.innerHTML=fixture.copy;'
    +'model.append(actions.firstElementChild);list.append(model);'
    +'document.documentElement.dataset.sends=String(Number(document.documentElement.dataset.sends||0)+1);'
    +'});'
    +'</script>';
}

for (const provider of experiments) {
  test('real Chromium DOM adapter contract: '+provider.id+' (simulated offline DOM only)',{
    skip:hasBrowser,timeout:30_000,
  },async (t)=>{
    const dataDir=await mkdtemp(path.join(os.tmpdir(),'chatchat-adapter-'+provider.id+'-'));
    let context;
    let outside=0;
    let fixturePages=0;
    const driver={
      async launchPersistentContext(profile,options) {
        assert.equal(options.chromiumSandbox,true);
        context=await realChromium.launchPersistentContext(profile,{
          ...options,headless:true,executablePath:browserBinary,
        });
        const create=context.newPage.bind(context);
        context.newPage=async()=>{
          const page=await create();
          await page.route('**/*',async(route)=>{
            if(route.request().url()!==provider.url){outside++;return route.abort();}
            fixturePages++;
            return route.fulfill({status:200,contentType:'text/html; charset=utf-8',
              body:fixtureMarkup(provider.id)});
          });
          return page;
        };
        return context;
      },
    };
    const runtime=new ManagedBrowserRuntime({
      dataDir,chromium:driver,executablePath:browserBinary,headless:true,
    });
    t.after(async()=>{
      await runtime.close();
      await context?.close().catch(()=>{});
      await rm(dataDir,{recursive:true,force:true,maxRetries:16,retryDelay:150});
    });
    assert.ok(ADAPTERS[provider.id]);
    const seat=await runtime.addSeat({providerId:provider.id});
    assert.equal(seat.status,'ready','Fixture readiness is NOT a live provider compatibility proof.');
    await runtime.prepareSeat(seat.id,{sessionId:'fixture-'+provider.id});
    const prompt='Check safe automatic chat recipe for '+provider.id;
    const answer=await runtime.send(seat.id,{
      prompt,operationId:'once-'+provider.id,timeoutMs:12_000,
    });
    assert.equal(answer.responseText,'Controlled reply from '+provider.id+': '+prompt);
    const page=context.pages().find((entry)=>entry.url().startsWith('https:'));
    assert.ok(page);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.sends),'1');
    assert.equal(fixturePages,2,'Adding a seat and preparing a new meeting each uses a separate owned page.');
    // A Provider may change DOM selectors after login. That is a site/layout
    // problem, not evidence that the human has logged out.
    await page.evaluate(()=>document.querySelector('textarea,[contenteditable="true"]').remove());
    const modified = await runtime.checkSeat(seat.id);
    assert.equal(modified.status,'attention',
      'Changed Provider DOM must be diagnosed rather than misreported as a login problem.');
    assert.match(modified.detail,/composer/);
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.sends),'1');
    assert.equal(outside,0,'No online provider page, external resource or account is contacted.');
  });
}
