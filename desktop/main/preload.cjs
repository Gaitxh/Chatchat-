const { contextBridge, ipcRenderer } = require('electron');
const methods=['getState','addSeat','openSeat','checkSeat','removeSeat','startMeeting','synthesizeMeeting','stopMeeting','newMeeting','loadMeeting','exportMeeting','backupLocalData','verifyBackupFile','previewRestoreBackup','confirmRestoreBackup','openDataFolder'];
const bridge={};
for(const method of methods) bridge[method]=async(args)=>{
  const reply=await ipcRenderer.invoke('chatchat:command',{method,...(args===undefined?{}:{args})});
  if(!reply?.ok) throw new Error(reply?.error || 'Desktop operation failed.');
  return reply.result;
};
bridge.onState=(callback)=>{
  if(typeof callback!=='function') throw new TypeError('State listener must be a function.');
  const listener=(_event,state)=>callback(state);
  ipcRenderer.on('chatchat:state',listener);
  return ()=>ipcRenderer.removeListener('chatchat:state',listener);
};
contextBridge.exposeInMainWorld('chatChat',Object.freeze(bridge));
