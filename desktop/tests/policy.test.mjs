import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_URL,trustedFrame,validateCommand,rendererPath} from '../main/policy.mjs';
import path from 'node:path';
test('privileged commands require exact main frame and local URL',()=>{
 const frame={url:APP_URL},wc={mainFrame:frame},w={webContents:wc,isDestroyed:()=>false};
 assert(trustedFrame({sender:wc,senderFrame:frame},w));
 for(const e of [{sender:{},senderFrame:frame},{sender:wc,senderFrame:{url:APP_URL}},{sender:wc,senderFrame:{url:'https://example.com'}}])assert(!trustedFrame(e,w));
});
test('no generic paths, script execution, credential or unknown command IPC',()=>{
 for(const input of [{method:'evaluate',args:'evil'},{method:'getState',args:{path:'/etc/passwd'}},{method:'openSeat',args:'../secret'},{method:'addSeat',args:{url:'https://example.com',providerId:'x'}},{method:'startMeeting',args:{proposal:'',mode:'balanced',maxRounds:3}},{method:'startMeeting',args:{proposal:'a',mode:'balanced',maxRounds:999}}])assert.throws(()=>validateCommand(input));
 assert.equal(validateCommand({method:'getState'}).method,'getState');
 assert.equal(validateCommand({method:'synthesizeMeeting'}).method,'synthesizeMeeting');
 assert.equal(validateCommand({method:'backupLocalData'}).method,'backupLocalData');
 assert.equal(validateCommand({method:'verifyBackupFile'}).method,'verifyBackupFile');
 assert.throws(()=>validateCommand({method:'verifyBackupFile',args:{path:'C:/secret'}}));
 assert.throws(()=>validateCommand({method:'backupLocalData',args:{directory:'C:\\Windows'}}));
 assert.throws(()=>validateCommand({method:'synthesizeMeeting',args:{force:true}}));
 assert.equal(validateCommand({method:'startMeeting',args:{proposal:'test',mode:'balanced',maxRounds:3}}).args.maxRounds,3);
});
test('custom protocol serves only renderer assets',()=>{
 const root=path.resolve('/tmp/renderer'); assert.equal(rendererPath(APP_URL,root),path.join(root,'index.html'));
 for(const raw of ['file:///etc/passwd','https://app/index.html','chatchat://other/index.html','chatchat://app/%2e%2e%2fmain/preload.cjs','chatchat://app/../main/index.mjs','chatchat://app/index.html?script=x','chatchat://app/private.json','chatchat://user:pass@app/index.html'])assert.equal(rendererPath(raw,root),null,raw);
});
