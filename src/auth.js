// ── Password hashing ──────────────────────────────────────────────────────────
export async function hashPw(pw, salt) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(salt + pw));
  return Array.from(new Uint8Array(b)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function genSalt() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPw(input, hash, salt) {
  return (await hashPw(input, salt)) === hash;
}

export async function makeHash(pw) {
  const salt = genSalt();
  return { hash: await hashPw(pw, salt), salt };
}

// ── TOTP (RFC 6238) helpers ───────────────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function b32ToBytes(s) {
  const str = s.toUpperCase().replace(/=+$/, '');
  let bits = 0, val = 0;
  const out = [];
  for (const c of str) {
    val = (val << 5) | B32.indexOf(c);
    bits += 5;
    if (bits >= 8) { bits -= 8; out.push((val >> bits) & 255); }
  }
  return new Uint8Array(out);
}

export function genTotpSecret() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  let r = '', bits = 0, val = 0;
  for (const b of bytes) {
    val = (val << 8) | b;
    bits += 8;
    while (bits >= 5) { bits -= 5; r += B32[(val >> bits) & 31]; }
  }
  if (bits > 0) r += B32[(val << (5 - bits)) & 31];
  while (r.length % 8) r += '=';
  return r;
}

async function totpCode(secret, counter) {
  const key = await crypto.subtle.importKey('raw', b32ToBytes(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const ctr = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i--) { ctr[i] = c & 0xff; c = Math.floor(c / 256); }
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, ctr));
  const off = sig[19] & 0xf;
  const code = ((sig[off] & 0x7f) << 24) | (sig[off + 1] << 16) | (sig[off + 2] << 8) | sig[off + 3];
  return String(code % 1000000).padStart(6, '0');
}

export async function verifyTotp(secret, userCode) {
  const win = Math.floor(Date.now() / 30000);
  for (const w of [win - 1, win, win + 1]) {
    if (await totpCode(secret, w) === userCode.trim()) return true;
  }
  return false;
}

export function genDeviceToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
}

export async function hashToken(tok) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(tok));
  return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
}
