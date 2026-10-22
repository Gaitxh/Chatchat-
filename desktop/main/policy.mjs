import path from 'node:path';
export const APP_URL = 'chatchat://app/index.html';
export const CHANNEL = 'chatchat:command';
export const STATE_CHANNEL = 'chatchat:state';
export const METHODS = Object.freeze(['getState','addSeat','openSeat','checkSeat','removeSeat','startMeeting','synthesizeMeeting','stopMeeting','newMeeting','loadMeeting','exportMeeting','openDataFolder']);
export function trustedFrame(event, window) {
  return Boolean(window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === APP_URL);
}
export function validateCommand(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !['method','args'].includes(k)) || !METHODS.includes(value.method)) throw new Error('Invalid desktop command.');
  const text = JSON.stringify(value); if (text.length > 100000) throw new Error('Desktop command is too large.');
  const args = value.args;
  if (['getState','synthesizeMeeting','stopMeeting','newMeeting','openDataFolder'].includes(value.method)) {
    if (args !== undefined && args !== null) throw new Error('This command takes no arguments.');
  } else if (['openSeat','checkSeat','removeSeat','loadMeeting','exportMeeting'].includes(value.method)) {
    if (typeof args !== 'string' || !/^[a-zA-Z0-9:_-]{1,180}$/.test(args)) throw new Error('Invalid seat or meeting identifier.');
  } else if (value.method === 'addSeat') {
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length !== 1) throw new Error('Choose one provider or website.');
    if ('providerId' in args) { if (typeof args.providerId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(args.providerId)) throw new Error('Invalid provider.'); }
    else if ('url' in args) { if (typeof args.url !== 'string' || args.url.length > 2048) throw new Error('Invalid website.'); }
    else throw new Error('Choose a provider or website.');
  } else if (value.method === 'startMeeting') {
    if (!args || typeof args !== 'object' || Array.isArray(args) || Object.keys(args).some(k=>!['proposal','mode','maxRounds'].includes(k))) throw new Error('Invalid meeting request.');
    if (typeof args.proposal !== 'string' || !args.proposal.trim() || args.proposal.length > 8000) throw new Error('Proposal must contain 1–8,000 characters.');
    if (!['balanced','explore','decide','verify','stress_test'].includes(args.mode)) throw new Error('Invalid consultation mode.');
    if (!Number.isInteger(args.maxRounds) || args.maxRounds < 2 || args.maxRounds > 5) throw new Error('Choose 2–5 discussion rounds.');
  }
  return {method:value.method,args};
}
export function rendererPath(raw, root) {
  if (typeof raw !== 'string' || /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(raw)) return null;
  let u; try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'chatchat:' || u.hostname !== 'app' || u.port || u.username || u.password || u.search) return null;
  let pathname; try { pathname = decodeURIComponent(u.pathname); } catch { return null; }
  if (!/^\/[a-zA-Z0-9_.\/-]+$/.test(pathname) || pathname.includes('..') || pathname.includes('\\')) return null;
  const target=path.resolve(root, '.'+pathname); if (!target.startsWith(path.resolve(root)+path.sep)) return null;
  if (!['.html','.css','.mjs','.js','.svg','.png','.ico'].includes(path.extname(target))) return null;
  return target;
}
