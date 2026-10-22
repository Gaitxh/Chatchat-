import { isIP } from 'node:net';

/** Deliberately excludes non-public and special-purpose address ranges. */
export function isPublicAddress(input) {
  const address = input.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
      || (a === 192 && b === 0 && c === 2) || (a === 198 && (b === 18 || b === 19))
      || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    // Only global unicast, excluding documentation, translation and transition ranges.
    return /^[23][0-9a-f]{0,3}:/.test(address)
      && !/^2001:(?:0:|db8:|[012][0-9a-f]:)/.test(address)
      && !address.startsWith('2002:') && !address.startsWith('3fff:');
  }
  return false;
}

export function validatePublicUrl(input, { navigation = false } = {}) {
  if (typeof input !== 'string' || input.length < 1 || input.length > 2048
    || /[\u0000-\u0020\u007f\\]/.test(input)) throw new Error('INVALID_URL');
  let url;
  try { url = new URL(input); } catch { throw new Error('INVALID_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password
    || (url.port && url.port !== '443')) throw new Error('INVALID_URL');
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new Error('INVALID_URL');
  } else if (!host.includes('.') || host.endsWith('.') || host.length > 253
    || !host.split('.').every((part) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(part))
    || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|onion|arpa)$/.test(host)
    || /(?:^|\.)(?:localhost|localdomain)(?:\.|$)/.test(host)) {
    throw new Error('INVALID_URL');
  }
  // Seat preferences must not become a token/account URL store. Navigation is never persisted.
  if (!navigation && (url.search || url.hash)) throw new Error('INVALID_URL');
  return url;
}

export function isLoginLocation(url) {
  return /(?:^|\/)(?:auth|oauth|oauth2|login|log-in|signin|sign-in|signup|sign-up|accounts?|sso|challenge|captcha)(?:\/|$)/i.test(url.pathname);
}
