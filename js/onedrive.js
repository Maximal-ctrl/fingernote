// OneDrive-Sicherung: Anmeldung mit Microsoft-Konto (OAuth 2.0 mit PKCE, ohne Server),
// Hochladen/Herunterladen einer Sicherungsdatei pro FingerNote-Konto im App-Ordner
// („Apps/FingerNote“) und automatisches Hochladen nach Änderungen, sobald online.
import { getSettings, saveSettings, uid } from './util.js';
import { ONEDRIVE_CLIENT_ID } from './config.js';
import { currentAccount, accountKey, portableAccount, checkPassword, createAccount, listAccounts } from './accounts.js';
import * as store from './store.js';
import { silently } from './db.js';

const AUTH = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'Files.ReadWrite.AppFolder User.Read offline_access';
const PENDING = 'fingernote.oauth';

export class NeedLogin extends Error { constructor() { super('Bitte erneut mit OneDrive verbinden.'); this.needLogin = true; } }

export const clientId = () => (getSettings().odClientId || ONEDRIVE_CLIENT_ID || '').trim();
const redirectUri = () => location.origin + location.pathname;
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function tokens() { try { return JSON.parse(localStorage.getItem(accountKey('od')) || 'null'); } catch (e) { return null; } }
function setTokens(t) { if (t) localStorage.setItem(accountKey('od'), JSON.stringify(t)); else localStorage.removeItem(accountKey('od')); }
export function status() {
  try { return JSON.parse(localStorage.getItem(accountKey('odstate')) || '{}'); } catch (e) { return {}; }
}
function setStatus(patch) {
  const s = { ...status(), ...patch };
  localStorage.setItem(accountKey('odstate'), JSON.stringify(s));
  window.dispatchEvent(new CustomEvent('fingernote:sync', { detail: s }));
  return s;
}

export const isConnected = () => !!tokens();
export const accountInfo = () => (tokens() || {}).user || null;

/** Weiterleitung zur Microsoft-Anmeldung. */
export async function connect(restore = null) {
  const id = clientId();
  if (!id) throw new Error('Es ist noch keine OneDrive-App-ID eingetragen.');
  if (restore) sessionStorage.setItem('fingernote.restore', JSON.stringify(restore));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = uid() + uid();
  localStorage.setItem(PENDING, JSON.stringify({ verifier, state, account: restore ? '__restore__' : currentAccount().id, redirect: redirectUri(), client: id }));
  const q = new URLSearchParams({
    client_id: id, response_type: 'code', redirect_uri: redirectUri(), response_mode: 'query',
    scope: SCOPE, state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account',
  });
  location.href = `${AUTH}/authorize?${q}`;
}

/** Nach der Rückkehr von Microsoft: Code gegen Tokens tauschen. Gibt {account, ok|error} zurück. */
export async function handleRedirect() {
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return null;
  history.replaceState(null, '', location.pathname + location.hash);
  let pend = null;
  try { pend = JSON.parse(localStorage.getItem(PENDING) || 'null'); } catch (e) { /* */ }
  localStorage.removeItem(PENDING);
  if (!pend) return null;
  if (q.has('error')) return { account: pend.account, error: q.get('error_description') || q.get('error') };
  if (q.get('state') !== pend.state) return { account: pend.account, error: 'Ungültige Antwort (state).' };
  try {
    const body = new URLSearchParams({
      client_id: pend.client, grant_type: 'authorization_code', code: q.get('code'),
      redirect_uri: pend.redirect, code_verifier: pend.verifier, scope: SCOPE,
    });
    const res = await fetch(`${AUTH}/token`, { method: 'POST', body });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error_description || j.error || 'Anmeldung fehlgeschlagen');
    const t = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + j.expires_in * 1000, client: pend.client };
    try {
      const me = await (await fetch(`${GRAPH}/me?$select=displayName,mail,userPrincipalName`, { headers: { Authorization: `Bearer ${t.access}` } })).json();
      t.user = { name: me.displayName || '', mail: me.mail || me.userPrincipalName || '' };
    } catch (e) { t.user = { name: 'OneDrive', mail: '' }; }
    // Tokens gehören zum Konto, das die Anmeldung gestartet hat
    localStorage.setItem(`fingernote.od.${pend.account}`, JSON.stringify(t));
    return { account: pend.account, ok: true };
  } catch (e) {
    return { account: pend.account, error: e.message };
  }
}

export function disconnect() { setTokens(null); setStatus({ lastUpload: 0, pending: false, error: '' }); }

async function accessToken() {
  const t = tokens();
  if (!t) throw new NeedLogin();
  if (Date.now() < t.exp - 90000) return t.access;
  if (!t.refresh) throw new NeedLogin();
  const body = new URLSearchParams({ client_id: t.client || clientId(), grant_type: 'refresh_token', refresh_token: t.refresh, scope: SCOPE });
  const res = await fetch(`${AUTH}/token`, { method: 'POST', body });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Microsoft lässt Anmeldungen von Web-Apps nach 24 Stunden ablaufen
    setStatus({ needLogin: true });
    throw new NeedLogin();
  }
  setTokens({ ...t, access: j.access_token, refresh: j.refresh_token || t.refresh, exp: Date.now() + j.expires_in * 1000 });
  setStatus({ needLogin: false });
  return j.access_token;
}

async function graph(path, opts = {}) {
  const tok = await accessToken();
  const res = await fetch(GRAPH + path, { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${tok}` } });
  if (res.status === 401) { setStatus({ needLogin: true }); throw new NeedLogin(); }
  return res;
}

function fileName() {
  const a = currentAccount();
  const safe = (a.name || 'Konto').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 30);
  return `FingerNote-${safe}-${a.id}.json`;
}
const itemPath = () => `/me/drive/special/approot:/${encodeURIComponent(fileName())}:`;

/** Alle Bücher dieses Kontos nach OneDrive hochladen. */
export async function upload() {
  if (!navigator.onLine) { setStatus({ pending: true }); throw new Error('Offline – wird hochgeladen, sobald du wieder online bist.'); }
  setStatus({ busy: true, error: '' });
  try {
    const blob = await store.exportData(null, { account: portableAccount() });
    if (blob.size < 3.5e6) {
      const res = await graph(`${itemPath()}/content`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: blob });
      if (!res.ok) throw new Error(`Hochladen fehlgeschlagen (${res.status})`);
    } else {
      const res = await graph(`${itemPath()}/createUploadSession`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': 'replace' } }),
      });
      if (!res.ok) throw new Error(`Hochladen fehlgeschlagen (${res.status})`);
      const { uploadUrl } = await res.json();
      const CH = 320 * 1024 * 12; // Vielfaches von 320 KiB
      for (let a = 0; a < blob.size; a += CH) {
        const b = Math.min(blob.size, a + CH);
        const r = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Range': `bytes ${a}-${b - 1}/${blob.size}` }, body: blob.slice(a, b) });
        if (!r.ok && r.status !== 202) throw new Error(`Hochladen fehlgeschlagen (${r.status})`);
        setStatus({ progress: b / blob.size });
      }
    }
    return setStatus({ busy: false, pending: false, lastUpload: Date.now(), size: blob.size, progress: 0, needLogin: false });
  } catch (e) {
    setStatus({ busy: false, pending: true, error: e.message, progress: 0 });
    throw e;
  }
}

/** Informationen zur Sicherung in OneDrive (oder null). */
export async function remoteInfo() {
  const res = await graph(`${itemPath()}?$select=id,size,lastModifiedDateTime`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`OneDrive antwortet nicht (${res.status})`);
  const j = await res.json();
  return { size: j.size, modified: Date.parse(j.lastModifiedDateTime) };
}

/** Sicherungsdatei aus OneDrive laden (als Blob). */
export async function downloadBlob() {
  const res = await graph(`${itemPath()}?$select=id,@microsoft.graph.downloadUrl`);
  if (res.status === 404) throw new Error('In OneDrive liegt noch keine Sicherung für dieses Konto.');
  if (!res.ok) throw new Error(`OneDrive antwortet nicht (${res.status})`);
  const j = await res.json();
  const url = j['@microsoft.graph.downloadUrl'];
  const r = url ? await fetch(url) : await graph(`${itemPath()}/content`);
  if (!r.ok) throw new Error(`Herunterladen fehlgeschlagen (${r.status})`);
  return new Blob([await r.arrayBuffer()], { type: 'application/json' });
}

/** Aus OneDrive in die App übernehmen (neuere Stände gewinnen, nichts wird gelöscht). */
export async function restore() {
  const blob = await downloadBlob();
  return silently(() => store.importData(new File([blob], 'onedrive.json')));
}

// ---------------------------------------------------------------- Automatisch hochladen
let timer = 0;
export function startAutoSync() {
  const kick = (delay) => {
    if (!isConnected() || !getSettings().odAuto) return;
    setStatus({ pending: true });
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!navigator.onLine) return;
      try { await upload(); } catch (e) { /* Status zeigt den Fehler */ }
    }, delay);
  };
  window.addEventListener('fingernote:changed', () => kick(45000));
  window.addEventListener('online', () => { if (status().pending) kick(3000); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && status().pending && navigator.onLine && isConnected() && getSettings().odAuto) {
      clearTimeout(timer);
      upload().catch(() => {});
    }
  });
  if (status().pending) kick(8000);
}

export function setAuto(on) { saveSettings({ odAuto: on }); }

// ---------------------------------------------------------------- Konto auf neuem Gerät holen
/** Nach der OneDrive-Anmeldung: Sicherung mit passendem Namen suchen, Passwort prüfen, Konto anlegen. */
export async function restoreAccount() {
  let req = null;
  try { req = JSON.parse(sessionStorage.getItem('fingernote.restore') || 'null'); } catch (e) { /* */ }
  sessionStorage.removeItem('fingernote.restore');
  const tmp = localStorage.getItem('fingernote.od.__restore__');
  localStorage.removeItem('fingernote.od.__restore__');
  if (!req || !tmp) throw new Error('Die Anmeldung bei OneDrive ist abgelaufen – bitte erneut versuchen.');
  const t = JSON.parse(tmp);
  const auth = { Authorization: `Bearer ${t.access}` };
  const res = await fetch(`${GRAPH}/me/drive/special/approot/children?$select=name,id&$top=200`, { headers: auth });
  if (!res.ok) throw new Error(`OneDrive antwortet nicht (${res.status})`);
  const files = ((await res.json()).value || []).filter((f) => /^FingerNote-.*\.json$/.test(f.name));
  const want = req.name.trim().toLowerCase();
  let found = null, wrongPw = false;
  for (const f of files) {
    const meta = await fetch(`${GRAPH}/me/drive/items/${f.id}?$select=@microsoft.graph.downloadUrl`, { headers: auth }).then((r) => r.json());
    const url = meta['@microsoft.graph.downloadUrl'];
    if (!url) continue;
    const blob = await fetch(url).then((r) => r.blob());
    let data;
    try { data = JSON.parse(await blob.text()); } catch (e) { continue; }
    const a = data.account;
    if (!a || (a.name || '').trim().toLowerCase() !== want) continue;
    if (!(await checkPassword(a, req.password))) { wrongPw = true; continue; }
    found = { a, blob };
    break;
  }
  if (!found) throw new Error(wrongPw ? 'Das Konto wurde gefunden, aber das Passwort stimmt nicht.' : `In dieser OneDrive gibt es kein FingerNote-Konto „${req.name}“.`);
  if (listAccounts().some((x) => x.id === found.a.id)) throw new Error('Dieses Konto ist auf diesem Gerät schon vorhanden.');
  const acc = await createAccount(found.a.name, null, found.a.color, found.a);
  localStorage.setItem(`fingernote.od.${acc.id}`, JSON.stringify(t));
  return { account: acc, blob: found.blob };
}
