declare const chrome: any;
const PARTICIPANTS_KEY="chatchat.consultation.participants.v1";
const lastAttempt=new Map<string,number>();

chrome.tabs.onUpdated.addListener((tabId:number,changeInfo:{status?:string;url?:string})=>{
  if(changeInfo.status!=="complete"&&!changeInfo.url)return;
  window.setTimeout(()=>void retryParticipant(tabId),1000);
});

async function retryParticipant(tabId:number){
  const store=chrome.storage.session??chrome.storage.local;
  const state=await store.get(PARTICIPANTS_KEY);
  const participants=Array.isArray(state[PARTICIPANTS_KEY])?state[PARTICIPANTS_KEY]:[];
  const index=participants.findIndex((item:{tabId?:number})=>item.tabId===tabId);
  if(index<0)return;
  const seatId=String(participants[index]?.seatId??tabId);
  if(Date.now()-(lastAttempt.get(seatId)??0)<8000)return;
  const row=[...document.querySelectorAll<HTMLElement>(".participant-row")][index];
  if(!row||row.classList.contains("connection-ready")||row.classList.contains("connection-connecting"))return;
  const button=[...document.querySelectorAll<HTMLButtonElement>(".setup-participant .verify-button")][index];
  if(!button||button.disabled||button.classList.contains("is-ready"))return;
  lastAttempt.set(seatId,Date.now());
  button.click();
}
