// Konten: Anmelden mit Name + eigenem Passwort. Neue Konten brauchen zusätzlich den
// zentralen Anmeldecode (config.js). Jedes Konto hat seine eigene Datenbank.
// Über OneDrive lässt sich ein Konto samt Büchern auf jedem Gerät wieder abrufen.
// Hinweis: Passwort und Code schützen vor fremdem Zugriff in der App – die Daten selbst
// liegen unverschlüsselt im App-Speicher des Geräts.
import { el, uid, useSettingsKey } from './util.js';
import { useDatabase, deleteDatabase } from './db.js';
import { logoSvg } from './icons.js';
import { REGISTER_CODE } from './config.js';

const AKEY = 'fingernote.accounts';
const SESSION = 'fingernote.unlocked';
export const ACCOUNT_COLORS = ['#5b5bf0', '#0ea5a4', '#ef4f6c', '#f59e0b', '#22a35a', '#8b5cf6', '#0ea5e9', '#64748b'];
export const MIN_PW = 4;

let current = null;

export function listAccounts() {
  try { return JSON.parse(localStorage.getItem(AKEY) || '[]'); } catch (e) { return []; }
}
function saveAccounts(list) { localStorage.setItem(AKEY, JSON.stringify(list)); }
const norm = (s) => (s || '').trim().toLowerCase();
export const findByName = (name) => listAccounts().find((a) => norm(a.name) === norm(name)) || null;

// ---------------------------------------------------------------- Passwörter
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256(text) {
  if (window.crypto && crypto.subtle) return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'f' + (h >>> 0).toString(16);
}
async function pbkdf2(pw, salt) {
  if (!(window.crypto && crypto.subtle)) return sha256(`fingernote:${salt}:${pw}`);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120000 }, key, 256);
  return hex(bits);
}
/** Passwort gegen gespeicherten Hash prüfen (auch alte Konten aus 2.0 mit 4-stelligem Code). */
export async function checkPassword(acc, pw) {
  if (acc.kdf === 'pbkdf2') return (await pbkdf2(pw, acc.salt)) === acc.pw;
  return (await sha256(`fingernote:${acc.salt}:${pw}`)) === (acc.pw || acc.pin);
}
async function makeSecret(pw) {
  const salt = uid() + uid();
  return { salt, pw: await pbkdf2(pw, salt), kdf: 'pbkdf2', pin: undefined };
}

export const checkRegisterCode = (code) => String(code || '').trim() === REGISTER_CODE;

export async function createAccount(name, pw, color, fixed = null) {
  const list = listAccounts();
  const first = !list.length;
  const id = fixed && fixed.id ? fixed.id : first ? 'main' : uid();
  if (list.some((a) => a.id === id)) throw new Error('Dieses Konto gibt es auf diesem Gerät schon.');
  const secret = fixed ? { salt: fixed.salt, pw: fixed.pw, kdf: fixed.kdf } : await makeSecret(pw);
  const acc = {
    id, name: (name || 'Ich').trim(), color: color || ACCOUNT_COLORS[list.length % ACCOUNT_COLORS.length],
    ...secret, created: fixed ? fixed.created || Date.now() : Date.now(),
    // Das erste Konto übernimmt vorhandene Notizen aus Version 1.x
    db: id === 'main' ? 'fingernote' : `fingernote-${id}`,
    skey: id === 'main' ? 'fingernote.settings' : `fingernote.settings.${id}`,
  };
  list.push(acc);
  saveAccounts(list);
  return acc;
}

/** Öffentliche Kontodaten für die OneDrive-Sicherung (nur Hash, nie das Passwort). */
export function portableAccount() {
  const a = current;
  return a ? { id: a.id, name: a.name, color: a.color, salt: a.salt, pw: a.pw || a.pin, kdf: a.kdf || 'sha', created: a.created } : null;
}

export async function changePassword(acc, pw) {
  const list = listAccounts();
  const a = list.find((x) => x.id === acc.id);
  if (!a) return;
  Object.assign(a, await makeSecret(pw));
  delete a.pin;
  saveAccounts(list);
  if (current && current.id === acc.id) Object.assign(current, a);
}

export function updateAccount(id, patch) {
  const list = listAccounts();
  const a = list.find((x) => x.id === id);
  if (!a) return null;
  Object.assign(a, patch);
  saveAccounts(list);
  if (current && current.id === id) Object.assign(current, patch);
  return a;
}

export async function deleteAccount(acc) {
  saveAccounts(listAccounts().filter((a) => a.id !== acc.id));
  for (const k of Object.keys(localStorage)) {
    if (k === acc.skey || k.endsWith('.' + acc.id) || k.includes(`.${acc.id}.`)) localStorage.removeItem(k);
  }
  await deleteDatabase(acc.db);
}

export function activate(acc) {
  current = acc;
  useDatabase(acc.db);
  useSettingsKey(acc.skey);
  sessionStorage.setItem(SESSION, acc.id);
}

export function currentAccount() { return current; }
export function accountKey(name) { return `fingernote.${name}.${current ? current.id : 'main'}`; }

/** Innerhalb derselben Sitzung (z. B. nach der OneDrive-Anmeldung) nicht erneut fragen. */
export function resumeSession() {
  const id = sessionStorage.getItem(SESSION);
  return id ? listAccounts().find((a) => a.id === id) || null : null;
}

export function logout() {
  sessionStorage.removeItem(SESSION);
  location.reload();
}

// ---------------------------------------------------------------- Anmeldebildschirm
const initials = (n) => (n || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
export function avatar(acc, size = 64) {
  return el('span', { class: 'avatar', style: { '--c': acc.color, width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.38) + 'px' } }, initials(acc.name));
}

function pwField(placeholder, autocomplete) {
  const inp = el('input', { class: 'inp', type: 'password', placeholder, autocomplete, autocapitalize: 'off', spellcheck: 'false' });
  const eye = el('button', { class: 'pw-eye', type: 'button', 'aria-label': 'Passwort zeigen' }, 'Zeigen');
  eye.addEventListener('click', () => { const show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.textContent = show ? 'Verbergen' : 'Zeigen'; });
  const wrap = el('div', { class: 'pw-wrap' }, inp, eye);
  wrap.input = inp;
  return wrap;
}

/**
 * Zeigt den Anmeldebildschirm. Liefert {account} oder {restore: {name, password}}
 * (Konto liegt nicht auf diesem Gerät → aus OneDrive holen).
 */
export function showLogin({ canRestore = false, notice = '' } = {}) {
  const root = document.getElementById('login');
  root.hidden = false;
  window.fingernoteStarted = true;
  return new Promise((resolve) => {
    let fails = 0, lockedUntil = 0;
    const finish = (v) => {
      root.classList.add('leaving');
      setTimeout(() => { root.hidden = true; root.classList.remove('leaving'); root.innerHTML = ''; }, 260);
      resolve(v);
    };
    const shell = (mode, ...content) => {
      root.innerHTML = '';
      const tabs = el('div', { class: 'login-tabs seg' },
        el('button', { type: 'button', class: mode === 'login' ? 'on' : '', onclick: () => login() }, 'Anmelden'),
        el('button', { type: 'button', class: mode === 'create' ? 'on' : '', onclick: () => create() }, 'Konto erstellen'));
      root.append(el('div', { class: 'login-bg' }), el('form', { class: 'login-card', novalidate: true, onsubmit: (e) => e.preventDefault() },
        el('div', { class: 'login-logo', html: logoSvg(60) }), tabs, ...content));
    };
    const msgEl = () => el('div', { class: 'pin-msg', role: 'alert' }, '');

    const login = (prefill = '') => {
      const list = listAccounts();
      if (!list.length && !prefill && !canRestore) { create(true); return; }
      const name = el('input', { class: 'inp', type: 'text', placeholder: 'Name', autocomplete: 'username', autocapitalize: 'words', value: prefill || (list.length === 1 ? list[0].name : '') });
      const pw = pwField('Passwort', 'current-password');
      const msg = msgEl();
      const restoreBox = el('div', { class: 'restore-box', hidden: true });
      const submit = async () => {
        msg.textContent = '';
        restoreBox.hidden = true;
        if (Date.now() < lockedUntil) { msg.textContent = `Zu viele Versuche – bitte ${Math.ceil((lockedUntil - Date.now()) / 1000)} s warten.`; return; }
        const n = name.value.trim(), p = pw.input.value;
        if (!n) { name.focus(); name.classList.add('shake'); setTimeout(() => name.classList.remove('shake'), 450); return; }
        if (!p) { pw.input.focus(); return; }
        const acc = findByName(n);
        if (!acc) {
          msg.textContent = `Auf diesem Gerät gibt es kein Konto „${n}“.`;
          restoreBox.hidden = false;
          restoreBox.replaceChildren(
            el('p', null, canRestore ? 'Hast du das Konto auf einem anderen Gerät angelegt und mit OneDrive gesichert? Dann hol es hierher:' : 'Konten lassen sich über OneDrive auf andere Geräte holen – dafür muss in der App einmal eine OneDrive-App-ID eingetragen sein (siehe README).'),
            canRestore ? el('button', { class: 'btn wide', type: 'button', onclick: () => finish({ restore: { name: n, password: p } }) }, 'Konto aus OneDrive holen') : null,
            el('button', { class: 'link-btn', type: 'button', onclick: () => create(false, n) }, 'Oder neues Konto erstellen'));
          return;
        }
        if (await checkPassword(acc, p)) { finish({ account: acc }); return; }
        fails++;
        if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; msg.textContent = 'Zu viele Versuche – 30 Sekunden warten.'; }
        else msg.textContent = 'Falsches Passwort';
        pw.input.value = '';
        pw.classList.add('shake'); setTimeout(() => pw.classList.remove('shake'), 450);
      };
      [name, pw.input].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (i === name) pw.input.focus(); else submit(); } }));
      const chips = list.length > 1 ? el('div', { class: 'acc-chips' }, list.map((a) => {
        const b = el('button', { class: 'acc-chip', type: 'button' }, avatar(a, 26), el('span', null, a.name));
        b.addEventListener('click', () => { name.value = a.name; pw.input.focus(); });
        return b;
      })) : null;
      shell('login',
        el('h1', { class: 'login-h' }, 'Willkommen zurück'),
        notice ? el('p', { class: 'login-notice' }, notice) : null,
        chips, name, pw, msg,
        el('button', { class: 'btn primary wide', type: 'button', onclick: submit }, 'Anmelden'),
        restoreBox);
      notice = '';
      setTimeout(() => (name.value ? pw.input : name).focus(), 60);
    };

    const create = (first = false, prefill = '') => {
      let color = ACCOUNT_COLORS[listAccounts().length % ACCOUNT_COLORS.length];
      const name = el('input', { class: 'inp', type: 'text', placeholder: 'Dein Name', autocomplete: 'username', autocapitalize: 'words', maxlength: '30', value: prefill });
      const pw = pwField(`Passwort (mind. ${MIN_PW} Zeichen)`, 'new-password');
      const pw2 = pwField('Passwort wiederholen', 'new-password');
      const code = el('input', { class: 'inp code', type: 'password', inputmode: 'numeric', placeholder: '4 Ziffern', autocomplete: 'off', maxlength: '12' });
      const msg = msgEl();
      const sw = el('div', { class: 'acc-colors' }, ACCOUNT_COLORS.map((c) => {
        const b = el('button', { class: `acc-color ${c === color ? 'on' : ''}`, type: 'button', style: { '--c': c }, 'aria-label': 'Farbe' });
        b.addEventListener('click', () => { color = c; sw.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
        return b;
      }));
      const fail = (t, inp) => { msg.textContent = t; if (inp) { inp.focus(); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 450); } };
      const submit = async () => {
        msg.textContent = '';
        const n = name.value.trim();
        if (!n) return fail('Bitte einen Namen eingeben.', name);
        if (findByName(n)) return fail(`„${n}“ gibt es auf diesem Gerät schon – bitte anmelden.`, name);
        if (pw.input.value.length < MIN_PW) return fail(`Das Passwort braucht mindestens ${MIN_PW} Zeichen.`, pw.input);
        if (pw.input.value !== pw2.input.value) return fail('Die Passwörter stimmen nicht überein.', pw2.input);
        if (!checkRegisterCode(code.value)) return fail('Der Anmeldecode ist falsch.', code);
        const acc = await createAccount(n, pw.input.value, color);
        finish({ account: acc, created: true });
      };
      [name, pw.input, pw2.input, code].forEach((i, k, arr) => i.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (k < arr.length - 1) arr[k + 1].focus(); else submit();
      }));
      shell('create',
        el('h1', { class: 'login-h' }, first ? 'Willkommen bei FingerNote' : 'Konto erstellen'),
        el('p', { class: 'login-sub' }, 'Name und Passwort wählst du selbst. Zum Erstellen brauchst du den Anmeldecode.'),
        name, pw, pw2,
        el('div', { class: 'code-row' }, el('span', { class: 'code-label' }, 'Anmeldecode'), code),
        sw, msg,
        el('button', { class: 'btn primary wide', type: 'button', onclick: submit }, 'Konto erstellen'));
      setTimeout(() => (prefill ? pw.input : name).focus(), 60);
    };

    login();
  });
}

/** Passwort abfragen (z. B. vor dem Löschen des Kontos). */
export function askPassword(acc, title) {
  return passwordDialog(title, [{ ph: 'Passwort', ac: 'current-password' }], async ([p]) => ((await checkPassword(acc, p)) ? p : 'Falsches Passwort'));
}

/** Neues Passwort festlegen. */
export function askNewPassword() {
  return passwordDialog('Neues Passwort', [{ ph: `Neues Passwort (mind. ${MIN_PW} Zeichen)`, ac: 'new-password' }, { ph: 'Wiederholen', ac: 'new-password' }],
    async ([a, b]) => (a.length < MIN_PW ? `Mindestens ${MIN_PW} Zeichen.` : a !== b ? 'Stimmt nicht überein.' : a));
}

function passwordDialog(title, fields, check) {
  return new Promise((resolve) => {
    const back = el('div', { class: 'dlg-back show' });
    const inputs = fields.map((f) => pwField(f.ph, f.ac));
    const msg = el('div', { class: 'pin-msg' }, '');
    const close = (v) => { back.remove(); resolve(v); };
    const ok = async () => {
      const vals = inputs.map((i) => i.input.value);
      const r = await check(vals);
      if (vals.includes('') || (typeof r === 'string' && r !== vals[0])) { msg.textContent = vals.includes('') ? 'Bitte ausfüllen.' : r; return; }
      close(r);
    };
    inputs.forEach((i) => i.input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') close(null); }));
    back.append(el('div', { class: 'dlg pw-dlg' }, el('h2', { class: 'dlg-title' }, title), ...inputs, msg,
      el('div', { class: 'dlg-btns' }, el('button', { class: 'btn', onclick: () => close(null) }, 'Abbrechen'), el('button', { class: 'btn primary', onclick: ok }, 'OK'))));
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(null); });
    document.getElementById('overlay').append(back);
    setTimeout(() => inputs[0].input.focus(), 60);
  });
}
