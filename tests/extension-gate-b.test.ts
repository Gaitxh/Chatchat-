import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import { createEmptyAdapterRecipe } from "../src/provider-sdk/recipe.js";
import { captureAdmittedBrowserHouseProviderProof, captureBrowserHouseProviderProof, seatStillOnProviderOrigin } from "../src/extension/gate-b.js";
import { buildGateBProofPack, gateBProofJson } from "../src/validation/proof-pack.js";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Assertion failed: ${message}`); }
const a={seatId:"extension:openai-chatgpt:101",providerId:"openai-chatgpt",origin:"https://chatgpt.com"};
const b={seatId:"extension:deepseek-chat:102",providerId:"deepseek-chat",origin:"https://chat.deepseek.com"};
const recipes={
  [a.origin]:{...createEmptyAdapterRecipe(a.origin),composerSelector:"#PRIVATE_A_COMPOSER",sendSelector:"#PRIVATE_A_SEND",responseSelector:"#PRIVATE_A_RESPONSE"},
  [b.origin]:{...createEmptyAdapterRecipe(b.origin),composerSelector:"#PRIVATE_B_COMPOSER",sendSelector:"#PRIVATE_B_SEND",responseSelector:"#PRIVATE_B_RESPONSE"}
};
const explicit=captureBrowserHouseProviderProof({seats:[a,b],recipes,tests:{[a.seatId]:"pass",[b.seatId]:"pass"},gates:{[a.seatId]:"pass",[b.seatId]:"pass"},providerHostSeatIds:[a.seatId,b.seatId]});
assert(explicit.every(row=>row.testPassed&&row.councilGatePassed),"Explicit Browser proof should preserve per-seat Test/Gate state.");
const admitted=captureAdmittedBrowserHouseProviderProof({seats:[a,b],recipes,providerHostSeatIds:[a.seatId,b.seatId]});
assert(admitted.every(row=>row.testPassed&&row.councilGatePassed&&row.recipeReady&&row.providerHostHealthy),"Admitted participants may derive Test/Gate only while Recipe/Host remain explicit.");
assert(seatStillOnProviderOrigin(a.origin,"https://chatgpt.com/c/private"),"Same Provider origin should be healthy.");
assert(!seatStillOnProviderOrigin(a.origin,"https://auth.openai.com/login"),"OAuth/external origin should be unhealthy.");
assert(!seatStillOnProviderOrigin(a.origin,"chrome://settings"),"Non-http(s) pages should be unhealthy.");

const events:CouncilEvent[]=[
  {id:"a1",sessionId:"PRIVATE_SESSION",round:1,actorId:a.seatId,kind:"argument",stance:"A",content:"PRIVATE ANSWER A",confidence:.7,createdAt:"2026-08-13T00:00:00.000Z"},
  {id:"b1",sessionId:"PRIVATE_SESSION",round:1,actorId:b.seatId,kind:"argument",stance:"B",content:"PRIVATE ANSWER B",confidence:.7,createdAt:"2026-08-13T00:00:01.000Z"},
  {id:"b2",sessionId:"PRIVATE_SESSION",round:2,actorId:b.seatId,kind:"challenge",targetEventId:"a1",content:"PRIVATE CHALLENGE",createdAt:"2026-08-13T00:00:02.000Z"},
  {id:"a2",sessionId:"PRIVATE_SESSION",round:2,actorId:a.seatId,kind:"revision",previousEventId:"a1",stance:"B",content:"PRIVATE REVISION",confidence:.8,causedBy:["b2"],createdAt:"2026-08-13T00:00:03.000Z"},
  {id:"a3",sessionId:"PRIVATE_SESSION",round:3,actorId:a.seatId,kind:"final_position",stance:"B",content:"PRIVATE FINAL A",confidence:.82,caveats:[],createdAt:"2026-08-13T00:00:04.000Z"},
  {id:"b3",sessionId:"PRIVATE_SESSION",round:3,actorId:b.seatId,kind:"final_position",stance:"B",content:"PRIVATE FINAL B",confidence:.84,caveats:[],createdAt:"2026-08-13T00:00:05.000Z"}
];
const report:CouncilReport={sessionId:"PRIVATE_SESSION",question:"PRIVATE KING QUESTION",consensusStance:"B",consensusRatio:1,confidence:.83,rounds:3,positions:[
  {participant:{id:a.seatId,name:"PRIVATE TAB A",provider:a.providerId,role:"Browser Tab Delegate"},stance:"B",content:"PRIVATE POSITION A",confidence:.82,caveats:[]},
  {participant:{id:b.seatId,name:"PRIVATE TAB B",provider:b.providerId,role:"Browser Tab Delegate"},stance:"B",content:"PRIVATE POSITION B",confidence:.84,caveats:[]}
],disagreements:[],eventCount:events.length};
const pack=buildGateBProofPack({providers:admitted,report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"});
assert(pack.verdict==="gate-b-candidate","Clean two-provider Browser Council should satisfy shared Gate B candidate rule.");
const exported=gateBProofJson(pack);
for(const secret of ["PRIVATE KING QUESTION","PRIVATE ANSWER","PRIVATE_A_COMPOSER","PRIVATE TAB"]){assert(!exported.includes(secret),`Browser proof export must not leak ${secret}.`)}
const offHost=captureAdmittedBrowserHouseProviderProof({seats:[a,b],recipes,providerHostSeatIds:[a.seatId]});
assert(buildGateBProofPack({providers:offHost,report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"}).verdict==="incomplete","One off-host participant must fail closed.");
assert(buildGateBProofPack({providers:admitted.slice(0,1),report,events,mode:"live",chatChatVersion:"0.9.0",environment:"Chromium"}).verdict==="incomplete","Every real participant needs a frozen Provider proof row.");
console.log("✓ ChatChat Browser House Gate B proof tests passed");
