// Konten: mehrere Personen auf einem Gerät, jede mit eigenem Anmeldecode und eigener Datenbank.
// Hinweis: Der Code schützt vor neugierigen Blicken – die Daten selbst liegen unverschlüsselt im App-Speicher.
import { el, uid, useSettingsKey } from './util.js';
import { useDatabase, deleteDatabase } from './db.js';
import { logoSvg } from './icons.js';

const AKEY = 'fingernote.accounts';
const SESSION = 'fingernote.unlocked';
export const ACCOUNT_COLORS = ['#5b5bf0', '#0ea5a4', '#ef4f6c', '#f59e0b', '#22a35a', '#8b5cf6', '#0ea5e9', '#64748b'];

let current = null;

export function listAccounts() {
  try { return JSON.parse(localStorage.getItem(AKEY) || '[]'); } catch (e) { return []; }
}
function saveAccounts(list) { localStorage.setItem(AKEY, JSON.stringify(list)); }

async function sha256(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Notlösung ohne sichere Umgebung (z. B. lokales Testen über http)
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'f' + (h >>> 0).toString(16);
}
const hashPin = (pin, salt) => sha256(`fingernote:${salt}:${pin}`);

export async function createAccount(name, pin, color) {
  const list = listAccounts();
  const first = !list.length;
  const id = first ? 'main' : uid();
  const salt = uid() + uid();
  const acc = {
    id, name: name || 'Ich', color: color || ACCOUNT_COLORS[list.length % ACCOUNT_COLORS.length],
    salt, pin: await hashPin(pin, salt), created: Date.now(),
    // Das erste Konto übernimmt vorhandene Notizen aus Version 1.x
    db: first ? 'fingernote' : `fingernote-${id}`,
    skey: first ? 'fingernote.settings' : `fingernote.settings.${id}`,
  };
  list.push(acc);
  saveAccounts(list);
  return acc;
}

export async function verifyPin(acc, pin) { return (await hashPin(pin, acc.salt)) === acc.pin; }

export async function changePin(acc, pin) {
  const list = listAccounts();
  const a = list.find((x) => x.id === acc.id);
  if (!a) return;
  a.salt = uid() + uid();
  a.pin = await hashPin(pin, a.salt);
  saveAccounts(list);
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

/** Innerhalb derselben Sitzung (z. B. nach der OneDrive-Anmeldung) nicht erneut nach dem Code fragen. */
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

function pinPad(onDigit, onDelete) {
  const pad = el('div', { class: 'pinpad' });
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].forEach((k) => {
    if (!k) { pad.append(el('span')); return; }
    const b = el('button', { class: `pin-key ${k === '⌫' ? 'del' : ''}`, type: 'button', 'aria-label': k === '⌫' ? 'Löschen' : k }, k);
    b.addEventListener('click', () => (k === '⌫' ? onDelete() : onDigit(k)));
    pad.append(b);
  });
  return pad;
}

function pinDots(n, filled) {
  return el('div', { class: 'pin-dots' }, Array.from({ length: n }, (_, i) => el('span', { class: i < filled ? 'on' : '' })));
}

/** Zeigt den Anmeldebildschirm und liefert das entsperrte Konto. */
export function showLogin() {
  const root = document.getElementById('login');
  root.hidden = false;
  return new Promise((resolve) => {
    let fails = 0, lockedUntil = 0;
    let keyH = null;
    const setKey = (fn) => { if (keyH) document.removeEventListener('keydown', keyH); keyH = fn; if (fn) document.addEventListener('keydown', fn); };
    const shell = (...content) => {
      root.innerHTML = '';
      root.append(el('div', { class: 'login-bg' }), el('div', { class: 'login-card' },
        el('div', { class: 'login-logo', html: logoSvg(64) }), ...content));
    };

    const chooser = () => {
      setKey(null);
      const list = listAccounts();
      if (!list.length) { create(true); return; }
      if (list.length === 1) { enterPin(list[0], true); return; }
      shell(
        el('h1', { class: 'login-h' }, 'Wer schreibt?'),
        el('div', { class: 'acc-grid' }, list.map((a) => {
          const b = el('button', { class: 'acc-tile', type: 'button' }, avatar(a, 72), el('span', null, a.name));
          b.addEventListener('click', () => enterPin(a));
          return b;
        })),
        el('button', { class: 'link-btn', type: 'button', onclick: () => create(false) }, '+ Neues Konto'));
    };

    const enterPin = (acc, only) => {
      let code = '';
      const dots = el('div');
      const msg = el('div', { class: 'pin-msg' }, '');
      const render = () => { dots.replaceChildren(pinDots(4, code.length)); };
      const submit = async () => {
        if (Date.now() < lockedUntil) { msg.textContent = `Bitte ${Math.ceil((lockedUntil - Date.now()) / 1000)} s warten.`; code = ''; render(); return; }
        if (await verifyPin(acc, code)) {
          setKey(null);
          root.classList.add('leaving');
          setTimeout(() => { root.hidden = true; root.classList.remove('leaving'); root.innerHTML = ''; }, 260);
          resolve(acc);
          return;
        }
        fails++;
        if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; msg.textContent = 'Zu viele Versuche – 30 Sekunden warten.'; }
        else msg.textContent = 'Falscher Code';
        dots.firstChild.classList.add('shake');
        code = '';
        setTimeout(render, 380);
      };
      const digit = (d) => { if (code.length >= 4) return; code += d; msg.textContent = ''; render(); if (code.length === 4) setTimeout(submit, 120); };
      const back = () => { code = code.slice(0, -1); render(); };
      const onKey = (e) => {
        if (/^[0-9]$/.test(e.key)) digit(e.key);
        else if (e.key === 'Backspace') back();
        else if (e.key === 'Escape' && !only) { setKey(null); chooser(); }
      };
      setKey(onKey);
      render();
      shell(
        avatar(acc, 76),
        el('h1', { class: 'login-h' }, `Hallo, ${acc.name}`),
        el('p', { class: 'login-sub' }, 'Anmeldecode eingeben'),
        dots, msg, pinPad(digit, back),
        el('div', { class: 'login-links' },
          !only ? el('button', { class: 'link-btn', type: 'button', onclick: () => { setKey(null); chooser(); } }, 'Anderes Konto') : null,
          el('button', { class: 'link-btn', type: 'button', onclick: () => { setKey(null); create(false); } }, '+ Neues Konto')));
    };

    const create = (first) => {
      setKey(null);
      let name = '', color = ACCOUNT_COLORS[listAccounts().length % ACCOUNT_COLORS.length], code = '', step = 'name';
      const draw = () => {
        if (step === 'name') {
          setKey(null);
          const inp = el('input', { class: 'inp big', type: 'text', placeholder: 'Dein Name', value: name, autocomplete: 'off', autocapitalize: 'words', maxlength: '30' });
          const sw = el('div', { class: 'acc-colors' }, ACCOUNT_COLORS.map((c) => {
            const b = el('button', { class: `acc-color ${c === color ? 'on' : ''}`, type: 'button', style: { '--c': c } });
            b.addEventListener('click', () => { color = c; name = inp.value; draw(); });
            return b;
          }));
          const next = () => { name = inp.value.trim(); if (!name) { inp.focus(); inp.classList.add('shake'); return; } step = 'pin'; draw(); };
          inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') next(); });
          shell(
            el('h1', { class: 'login-h' }, first ? 'Willkommen bei FingerNote' : 'Neues Konto'),
            el('p', { class: 'login-sub' }, first ? 'Lege dein Konto an. Deine Notizen bleiben auf diesem Gerät.' : 'Jedes Konto hat eigene Bücher und einen eigenen Code.'),
            inp, sw,
            el('button', { class: 'btn primary wide', type: 'button', onclick: next }, 'Weiter'),
            !first ? el('button', { class: 'link-btn', type: 'button', onclick: chooser }, 'Abbrechen') : null);
          setTimeout(() => inp.focus(), 60);
          return;
        }
        let entry = '';
        const dots = el('div');
        const msg = el('div', { class: 'pin-msg' }, '');
        const render = () => dots.replaceChildren(pinDots(4, entry.length));
        const confirmStep = step === 'confirm';
        const digit = async (d) => {
          if (entry.length >= 4) return;
          entry += d; render();
          if (entry.length < 4) return;
          if (!confirmStep) { code = entry; step = 'confirm'; draw(); return; }
          if (entry !== code) { msg.textContent = 'Codes stimmen nicht überein – nochmal'; dots.firstChild.classList.add('shake'); code = ''; step = 'pin'; setTimeout(draw, 700); return; }
          const acc = await createAccount(name, code, color);
          setKey(null);
          root.hidden = true; root.innerHTML = '';
          resolve(acc);
        };
        const back = () => { entry = entry.slice(0, -1); render(); };
        const onKey = (e) => { if (/^[0-9]$/.test(e.key)) digit(e.key); else if (e.key === 'Backspace') back(); };
        setKey(onKey);
        render();
        shell(
          avatar({ name, color }, 76),
          el('h1', { class: 'login-h' }, confirmStep ? 'Code bestätigen' : 'Anmeldecode festlegen'),
          el('p', { class: 'login-sub' }, confirmStep ? 'Bitte denselben Code noch einmal eingeben.' : '4 Ziffern, z. B. 1111 – damit öffnest du dein Konto.'),
          dots, msg, pinPad(digit, back),
          el('button', { class: 'link-btn', type: 'button', onclick: () => { setKey(null); step = 'name'; draw(); } }, 'Zurück'));
      };
      draw();
    };

    chooser();
  });
}

/** Code abfragen (z. B. vor dem Löschen eines Kontos). */
export function askPin(acc, title) {
  return new Promise((resolve) => {
    const back = el('div', { class: 'dlg-back show' });
    let code = '';
    const dots = el('div');
    const render = () => dots.replaceChildren(pinDots(4, code.length));
    const close = (v) => { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); };
    const digit = async (d) => {
      if (code.length >= 4) return;
      code += d; render();
      if (code.length === 4) {
        if (await verifyPin(acc, code)) close(code);
        else { dots.firstChild.classList.add('shake'); code = ''; setTimeout(render, 380); }
      }
    };
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) digit(e.key); else if (e.key === 'Backspace') { code = code.slice(0, -1); render(); } else if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    render();
    back.append(el('div', { class: 'dlg pin-dlg' }, el('h2', { class: 'dlg-title' }, title), dots, pinPad(digit, () => { code = code.slice(0, -1); render(); }),
      el('div', { class: 'dlg-btns' }, el('button', { class: 'btn', onclick: () => close(null) }, 'Abbrechen'))));
    back.addEventListener('pointerdown', (e) => { if (e.target === back) close(null); });
    document.getElementById('overlay').append(back);
  });
}

/** Neuen Code über einen kleinen PIN-Dialog festlegen. */
export function askNewPin() {
  return new Promise((resolve) => {
    const back = el('div', { class: 'dlg-back show' });
    let code = '', first = null;
    const dots = el('div');
    const title = el('h2', { class: 'dlg-title' }, 'Neuen Code eingeben');
    const render = () => dots.replaceChildren(pinDots(4, code.length));
    const close = (v) => { document.removeEventListener('keydown', onKey); back.remove(); resolve(v); };
    const digit = (d) => {
      if (code.length >= 4) return;
      code += d; render();
      if (code.length < 4) return;
      if (first == null) { first = code; code = ''; title.textContent = 'Code bestätigen'; setTimeout(render, 150); return; }
      if (first === code) close(code);
      else { dots.firstChild.classList.add('shake'); first = null; code = ''; title.textContent = 'Stimmte nicht – neuen Code eingeben'; setTimeout(render, 380); }
    };
    const del = () => { code = code.slice(0, -1); render(); };
    const onKey = (e) => { if (/^[0-9]$/.test(e.key)) digit(e.key); else if (e.key === 'Backspace') del(); else if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', onKey);
    render();
    back.append(el('div', { class: 'dlg pin-dlg' }, title, dots, pinPad(digit, del),
      el('div', { class: 'dlg-btns' }, el('button', { class: 'btn', onclick: () => close(null) }, 'Abbrechen'))));
    document.getElementById('overlay').append(back);
  });
}
