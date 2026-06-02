// ── App Check (REST, no SDK) ──────────────────────────────────────────────────
const RECAPTCHA_SITE_KEY = "6LeWGaUsAAAAALJprup9vtheAIT9tnMqP7V4Pk23";
const AC_BASE = "https://firebaseappcheck.googleapis.com/v1/projects/newton-93d05/apps/1%3A697007558928%3Aweb%3Ac4ff7f4bf936f340be5595";
const AC_KEY = `?key=${import.meta.env.VITE_FIREBASE_API_KEY}`;

// Set VITE_FIREBASE_DEBUG_TOKEN in .env.local (never commit it). Leave unset in Netlify.
const DEV_DEBUG_TOKEN = import.meta.env.VITE_FIREBASE_DEBUG_TOKEN;

let _acToken = null;
let _acExpiry = 0;
let _acPending = null;
let _acRefreshTimer = null;

function scheduleAcRefresh(msUntilExpiry) {
  clearTimeout(_acRefreshTimer);
  const delay = Math.max(0, msUntilExpiry - 10 * 60 * 1000);
  _acRefreshTimer = setTimeout(() => {
    _acToken = null;
    getAppCheckToken().catch(() => {});
  }, delay);
}

export async function getAppCheckToken() {
  if (_acToken && Date.now() < _acExpiry) return _acToken;
  if (_acPending) return _acPending;
  _acPending = (async () => {
    let data;
    if (import.meta.env.DEV) {
      const r = await fetch(`${AC_BASE}:exchangeDebugToken${AC_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ debug_token: DEV_DEBUG_TOKEN }),
      });
      data = await r.json();
    } else {
      await new Promise(resolve => window.grecaptcha
        ? window.grecaptcha.ready(resolve)
        : window.addEventListener("load", () => window.grecaptcha.ready(resolve), { once: true })
      );
      const rcToken = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: "firebase" });
      const r = await fetch(`${AC_BASE}:exchangeRecaptchaV3Token${AC_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recaptchaV3Token: rcToken }),
      });
      data = await r.json();
    }
    if (!data.token) throw new Error(`App Check exchange failed: ${JSON.stringify(data)}`);
    _acToken = data.token;
    const msUntilExpiry = (parseInt(data.ttl) - 60) * 1000;
    _acExpiry = Date.now() + msUntilExpiry;
    scheduleAcRefresh(msUntilExpiry);
    return _acToken;
  })().finally(() => { _acPending = null; });
  return _acPending;
}

if (!import.meta.env.DEV) getAppCheckToken().catch(() => {});

// ── Anonymous Auth (REST, no SDK) ─────────────────────────────────────────────
const AUTH_SIGN_UP = `https://identitytoolkit.googleapis.com/v1/accounts:signUp${AC_KEY}`;
const AUTH_REFRESH = `https://securetoken.googleapis.com/v1/token${AC_KEY}`;

let _authToken = null;
let _authExpiry = 0;
let _authRefreshToken = null;
let _authPending = null;

export async function getAuthToken() {
  if (_authToken && Date.now() < _authExpiry) return _authToken;
  if (_authPending) return _authPending;
  _authPending = (async () => {
    let idToken, expiresIn, refreshToken;
    if (_authRefreshToken) {
      const r = await fetch(AUTH_REFRESH, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `grant_type=refresh_token&refresh_token=${_authRefreshToken}`,
      });
      const data = await r.json();
      if (!data.id_token) throw new Error(`Auth refresh failed: ${JSON.stringify(data)}`);
      idToken = data.id_token;
      expiresIn = parseInt(data.expires_in);
      refreshToken = data.refresh_token;
    } else {
      const r = await fetch(AUTH_SIGN_UP, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      });
      const data = await r.json();
      if (!data.idToken) throw new Error(`Anonymous sign-in failed: ${JSON.stringify(data)}`);
      idToken = data.idToken;
      expiresIn = parseInt(data.expiresIn);
      refreshToken = data.refreshToken;
    }
    _authToken = idToken;
    _authExpiry = Date.now() + (expiresIn - 60) * 1000;
    _authRefreshToken = refreshToken;
    return _authToken;
  })().finally(() => { _authPending = null; });
  return _authPending;
}

getAuthToken().catch(() => {});

export const FIREBASE = "https://newton-93d05-default-rtdb.firebaseio.com";

export async function fbGet(path) {
  const [acToken, authToken] = await Promise.all([getAppCheckToken(), getAuthToken()]);
  const r = await fetch(`${FIREBASE}/${path}.json?auth=${authToken}`, {
    headers: { "X-Firebase-AppCheck": acToken },
  });
  if (!r.ok) throw new Error(`GET ${path} → HTTP ${r.status}`);
  return await r.json();
}

export async function fbSet(path, data) {
  const [acToken, authToken] = await Promise.all([getAppCheckToken(), getAuthToken()]);
  const r = await fetch(`${FIREBASE}/${path}.json?auth=${authToken}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "X-Firebase-AppCheck": acToken },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error(`PUT ${path} → HTTP ${r.status}: ${await r.text()}`);
}

export async function fbConnectTest() {
  const val = Date.now();
  await fbSet('_test', { t: val });
  const back = await fbGet('_test');
  if (!back || back.t !== val) throw new Error("Write succeeded but read-back mismatch");
  return true;
}

export const classPath = (classId, suffix) => `classes/${classId}/${suffix}`;

// ── Firebase Storage (REST, no SDK) ───────────────────────────────────────────
export const STORAGE_BUCKET = "newton-93d05.firebasestorage.app";
const STORAGE_BASE = `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o`;

// Upload a File to Firebase Storage. Returns { storagePath, downloadUrl, size, mime }.
// onProgress(fraction 0..1) is called as the upload streams.
export function fbUpload(storagePath, file, onProgress) {
  return new Promise(async (resolve, reject) => {
    try {
      const [acToken, authToken] = await Promise.all([getAppCheckToken(), getAuthToken()]);
      const url = `${STORAGE_BASE}?name=${encodeURIComponent(storagePath)}&uploadType=media`;
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("Authorization", `Firebase ${authToken}`);
      xhr.setRequestHeader("X-Firebase-AppCheck", acToken);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
      };
      xhr.onload = () => {
        if (xhr.status < 200 || xhr.status >= 300) {
          return reject(new Error(`Upload failed: HTTP ${xhr.status} ${xhr.responseText || ""}`.trim()));
        }
        try {
          const meta = JSON.parse(xhr.responseText);
          const token = (meta.downloadTokens || "").split(",")[0];
          const downloadUrl = `${STORAGE_BASE}/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
          resolve({
            storagePath,
            downloadUrl,
            size: parseInt(meta.size || file.size, 10),
            mime: meta.contentType || file.type || "application/octet-stream",
          });
        } catch (e) { reject(new Error(`Upload succeeded but response malformed: ${e?.message || e}`)); }
      };
      xhr.onerror = () => reject(new Error("Upload network error"));
      xhr.send(file);
    } catch (e) { reject(e); }
  });
}

export async function fbDeleteStorage(storagePath) {
  const [acToken, authToken] = await Promise.all([getAppCheckToken(), getAuthToken()]);
  const r = await fetch(`${STORAGE_BASE}/${encodeURIComponent(storagePath)}`, {
    method: "DELETE",
    headers: { "Authorization": `Firebase ${authToken}`, "X-Firebase-AppCheck": acToken },
  });
  if (!r.ok && r.status !== 404) throw new Error(`DELETE ${storagePath} → HTTP ${r.status}`);
}

export function slugifyClassId(name) {
  const base = (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return base || "class";
}

export function uniqueClassId(name, existingIds) {
  const base = slugifyClassId(name);
  const set = existingIds instanceof Set ? existingIds : new Set(existingIds || []);
  if (!set.has(base)) return base;
  for (let i = 2; i < 1000; i++) { const c = `${base}-${i}`; if (!set.has(c)) return c; }
  return `${base}-${Date.now()}`;
}
