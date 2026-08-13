(() => {
  const showcase = new URLSearchParams(location.search).get("showcase") === "gate-b";
  if (!showcase || globalThis.chrome?.storage?.session) return;

  const proofKey = "chatchat.extension.gate-b-proof.v1";
  const pack = {
    schemaVersion: 1,
    generatedAt: "2026-08-13T04:00:30.000Z",
    evidenceCapturedAt: "2026-08-13T04:00:24.000Z",
    chatChatVersion: "0.9.0",
    environment: "Chromium Side Panel · deterministic showcase",
    verdict: "gate-b-candidate",
    providers: [
      { providerId:"openai-chatgpt",adapterId:"extension.tab",host:"chatgpt.com",recipeReady:true,testPassed:true,councilGatePassed:true,providerHostHealthy:true,seated:true },
      { providerId:"deepseek-chat",adapterId:"extension.tab",host:"chat.deepseek.com",recipeReady:true,testPassed:true,councilGatePassed:true,providerHostHealthy:true,seated:true }
    ],
    council: {
      mode:"live",sessionFingerprint:"showcaseB001",realParticipantCount:2,rounds:3,eventCount:6,realEventCount:6,
      eventKinds:{argument:2,challenge:1,evidence:0,support:0,defense:0,revision:1,concede:0,question:0,uncertain:0,final_position:2},
      finalPositionCount:2,zeroConfidenceFinalCount:0,consensusRatio:1,minorityOpinionPresent:false,durationMs:24000
    },
    privacy:{questionIncluded:false,eventTextIncluded:false,responseTextIncluded:false,selectorsIncluded:false,profileKeysIncluded:false,credentialsIncluded:false}
  };
  const localState={}; const sessionState={ [proofKey]: pack };
  const showcaseChrome={
    storage:{ local:store(localState), session:store(sessionState) },
    tabs:{ query:async()=>[],get:async()=>undefined,create:async({url,active})=>({id:901,url,active:Boolean(active),status:"complete"}),update:async(id,patch)=>({id,...patch,status:"complete"}),sendMessage:async()=>({ok:false,error:"Gate B showcase has no live Provider tabs."}),onUpdated:{addListener:()=>{},removeListener:()=>{}} },
    permissions:{contains:async()=>false,request:async()=>false}, scripting:{executeScript:async()=>[]}
  };
  if(globalThis.chrome)Object.assign(globalThis.chrome,showcaseChrome);else globalThis.chrome=showcaseChrome;
  document.documentElement.dataset.chatchatGateBShowcase="booted";
  window.addEventListener("load",()=>{const badge=document.createElement("div");badge.textContent="DETERMINISTIC GATE B SHOWCASE · METADATA ONLY · NO REAL ACCOUNT";badge.style.cssText="position:fixed;z-index:999999;right:8px;bottom:8px;padding:6px 8px;border-radius:999px;background:#205d45;color:#fff;font:700 8px system-ui;letter-spacing:.05em;opacity:.9;pointer-events:none";document.body.appendChild(badge)});
  function store(target){return{get:async(key)=>({[key]:target[key]}),set:async(values)=>Object.assign(target,values),remove:async(key)=>delete target[key]}}
})();
