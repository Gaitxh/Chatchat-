import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const extract=require('extract-zip');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const lock=JSON.parse(await fs.readFile(path.join(root,'runtime-lock.json'),'utf8'));
const item=lock.downloads.find(x=>x?.name==='chromium-win.zip');
if(!item || !/^[a-f0-9]{64}$/.test(item.sha256) || new URL(item.url).origin!=='https://cdn.playwright.dev') throw new Error('Invalid pinned browser package.');
const cache=path.join(root,'.build-cache');await fs.mkdir(cache,{recursive:true});
const archive=path.join(cache,'chromium-win.zip');
let bytes;
try { bytes=await fs.readFile(archive); } catch {}
if(!bytes || createHash('sha256').update(bytes).digest('hex')!==item.sha256){
 const response=await fetch(item.url,{signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw new Error('Browser download failed: '+response.status);
 bytes=Buffer.from(await response.arrayBuffer());
 if(bytes.length>400*1024*1024 || createHash('sha256').update(bytes).digest('hex')!==item.sha256) throw new Error('Browser checksum mismatch.');
 await fs.writeFile(archive,bytes);
}
const dest=path.join(cache,'browser');await fs.rm(dest,{recursive:true,force:true});await fs.mkdir(dest,{recursive:true});
await extract(archive,{dir:dest});
await fs.access(path.join(dest,'chrome-win64','chrome.exe'));
console.log('Verified and bundled pinned Windows Chromium. No end-user download or configuration is needed.');
