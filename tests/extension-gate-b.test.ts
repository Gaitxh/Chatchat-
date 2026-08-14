import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import { createEmptyAdapterRecipe } from "../src/provider-sdk/recipe.js";
import {
  captureBrowserConsultationProviderProof,
  captureReadyBrowserConsultationProviderProof,
  participantStillOnProviderOrigin,
} from "../src/extension/gate-b.js";
import { buildGateBProofPack, gateBProofJson, gateBProofMarkdown } from "../src/validation/proof-pack.js";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Assertion failed: ${message}`); }
const a={seatId:"extension:openai-chatgpt:101",providerId:"openai-chatgpt",origin:"https://chatgpt.com"};
const b={seatId:"extension:deepseek-chat:102",providerId:"deepseek-chat",origin:"https://chat.deepseek.com"};
const recipes={
  [a.origin]:{...createEmptyAdapterRecipe(a.origin),composerSelector:"#PRIVATE_A_COMPOSER",sendSelector:"#PRIVATE_A_SEND",responseSelector:"#PRIVATE_A_RESPONSE"},
  [b.origin]:{...createEmptyAdapterRecipe(b.origin),composerSelector:"#PRIVATE_B_COMPOSER",sendSelector:"#PRIVATE_B_SEND",responseSelector:"#PRIVATE_B_RESPONSE"}
};
const explicit=captureBrowserConsultationProviderProof({participants:[a,b],recipes,tests:{[a.seatId]:"pass",[b.seatId]:"pass"},gates:{[a.seatId]:"pass",[b.seatId]:"pass"},providerHostSeatIds:[a.seatId,b.seatId]});
assert(explicit.every(row=>row.testPassed&&row.councilGatePassed),"Explicit Browser Consultation proof should preserve per-participant connection/protocol state.");
const ready=captureReadyBrowserConsultationProviderProof({participants:[a,b],recipes,readySeatIds:[a.seatId,b.seatId],providerHostSeatIds:[a.seatId,b.seatId]});
assert(ready.every(row=>row.testPassed&&row.councilGatePassed&&row.recipeReady&&row.providerHostHealthy),"Current READY participants may derive connection/protocol success while page-map and host health remain explicit.");
assert(participantStillOnProviderOrigin(a.origin,"https://chatgpt.com/c/private"),"Same Provider origin should be healthy.");
assert(!participantStillOnProviderOrigin(a.origin,"https://auth.openai.com/login"),"OAuth/external origin should be unhealthy.");
assert(!participantStillOnProviderOrigin(a.origin,"chrome://settings"),"Non-http(s) pages should be unhealthy.");

const events:CouncilEvent[]=[
  {id:"a1",sessionId:"PRIVATE_SESSION",round:1,actorId:a.seatId,kind:"argument",stance:"A",content:"PRIVATE ANSWER A",confidence:.7,createdAt:"2026-08-13T00:00:00.000Z"},
  {id:"b1",sessionId:"PRIVATE_SESSION",round:1,actorId:b.seatId,kind:"argument",stance:"B",content:"PRIVATE ANSWER B",confidence:.7,createdAt:"2026-08-13T00:00:01.000Z"},
  {id:"b2",sessionId:"PRIVATE_SESSION",round:2,actorId:b.seatId,kind:"challenge",targetEventId:"a1",content:"PRIVATE CHALLENGE",createdAt:"2026-08-13T00:00:02.000Z"},
  {id:"a2",sessionId:"PRIVATE_SESSION",round:2,actorId:a.seatId,kind:"revision",previousEventId:"a1",stance:"B",content:"PRIVATE REVISION",confidence:.8,causedBy:["b2"],createdAt:"2026-08-13T00:00:03.000Z"},
  {id:"a3",sessionId:"PRIVATE_SESSION",round:3,actorId:a.seatId,kind:"final_position",stance:"B",content:"PRIVATE FINAL A",confidence:.82,caveats:[],createdAt:"2026-08-13T00:00:04.000Z"},
  {id:"b3",sessionId:"PRIVATE_SESSION",round:3,actorId:b.seatId,kind:"final_position",stance:"B",content:"PRIVATE FINAL B",confidence:.84,caveats:[],createdAt:"2026-08-13T00:00:05.000Z"}
];
const report:CouncilReport={sessionId:"PRIVATE_SESSION",question:"PRIVATE USER PROPOSAL",consensusStance:"B",consensusRatio:1,confidence:.83,rounds:3,positions:[
  {participant:{id:a.seatId,name:"PRIVATE TAB A",provider:a.providerId,role:"Independent AI Participant"},stance:"B",content:"PRIVATE POSITION A",confidence:.82,caveats:[]},
  {participant:{id:b.seatId,name:"PRIVATE TAB B",provider:b.providerId,role:"Independent AI Participant"},stance:"B",content:"PRIVATE POSITION B",confidence:.84,caveats:[]}
],disagreements:[],eventCount:events.length};
const pack=buildGateBProofPack({providers:ready,report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium Full Room"});
assert(pack.verdict==="gate-b-candidate","Clean two-Provider Browser Consultation should satisfy the Gate B candidate rule.");
const exported=`${gateBProofJson(pack)}\n${gateBProofMarkdown(pack)}`;
for(const secret of ["PRIVATE USER PROPOSAL","PRIVATE ANSWER","PRIVATE_A_COMPOSER","PRIVATE TAB"]){assert(!exported.includes(secret),`Browser proof export must not leak ${secret}.`)}
assert(exported.includes("ChatChat Real Provider Proof"),"Current proof export should use the Real Provider product identity.");
for(const legacy of ["Royal Proof","King's","Browser House","advisor"]){assert(!exported.includes(legacy),`Current Gate B export must not use legacy product language: ${legacy}`);}
const offHost=captureReadyBrowserConsultationProviderProof({participants:[a,b],recipes,readySeatIds:[a.seatId,b.seatId],providerHostSeatIds:[a.seatId]});
assert(buildGateBProofPack({providers:offHost,report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"}).verdict==="incomplete","One off-host participant must fail closed.");
assert(buildGateBProofPack({providers:ready.slice(0,1),report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"}).verdict==="incomplete","Every real participant needs a frozen Provider proof row.");
const sameHost=ready.map((row)=>({...row,providerId:"duplicate-provider",host:"same.example"}));
assert(buildGateBProofPack({providers:sameHost,report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"}).verdict==="incomplete","Two seats from one Provider host must not masquerade as two-Provider Gate B evidence.");
console.log("✓ ChatChat current Browser Consultation Gate B proof tests passed");
