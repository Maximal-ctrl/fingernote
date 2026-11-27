// Einstieg: Anmeldung, Bibliothek und Editor verbinden, Offline-Betrieb, OneDrive.
import { applyTheme, getSettings, saveSettings } from './util.js';
import * as store from './store.js';
import { Library } from './library.js';
import { Editor } from './editor.js';
import { SchematicEditor } from './schematic.js';
import { toast } from './ui.js';
import * as accounts from './accounts.js';
import * as od from './onedrive.js';
import { silently } from './db.js';

// Immer über die sichere Adresse (https) laden – außer beim lokalen Testen
if (location.protocol === 'http:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
  location.replace('https://' + location.host + location.pathname + location.search + location.hash);
}

class App {
  async init() {
    applyTheme();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { applyTheme(); this.editor && this.editor.themeChanged(); });
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker', e));
    }
    // Safari: Zoomen der ganzen Seite verhindern (die App zoomt selbst)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    this.libEl = document.getElementById('library');
    this.edEl = document.getElementById('editor');
    document.body.classList.remove('loading');

    // Rückkehr von der Microsoft-Anmeldung?
    const oauth = await od.handleRedirect();

    // Anmelden (innerhalb einer Sitzung, z. B. nach der OneDrive-Anmeldung, nicht erneut)
    let acc = accounts.resumeSession();
    let restored = null, notice = '';
    if (oauth && oauth.account === '__restore__') {
      // Konto von einem anderen Gerät über OneDrive holen
      if (oauth.error) notice = 'OneDrive: ' + oauth.error;
      else {
        try { restored = await od.restoreAccount(); acc = restored.account; }
        catch (e) { notice = e.message; }
      }
    } else if (oauth && oauth.account) acc = accounts.listAccounts().find((a) => a.id === oauth.account) || acc;
    while (!acc) {
      const r = await accounts.showLogin({ canRestore: !!od.clientId(), notice });
      notice = '';
      if (r.account) acc = r.account;
      else if (r.restore) {
        try { await od.connect(r.restore); return; } // Weiterleitung zu Microsoft
        catch (e) { notice = e.message; }
      }
    }
    accounts.activate(acc);
    applyTheme();
    if (restored) {
      try {
        await silently(() => store.importData(new File([restored.blob], 'onedrive.json')));
        saveSettings({ welcomed: true });
        toast(`Willkommen zurück, ${acc.name} – deine Bücher wurden aus OneDrive geladen.`, { ms: 5000 });
      } catch (e) { toast('Konto angelegt, aber die Bücher konnten nicht geladen werden: ' + e.message, { ms: 7000 }); }
    }

    try {
      await store.purgeOldTrash();
      const st = getSettings();
      if (!st.welcomed) {
        const items = await store.listItems();
        if (!items.length) await store.createWelcome();
        saveSettings({ welcomed: true });
        store.requestPersist();
      }
    } catch (e) {
      console.error(e);
      toast('Der Speicher ist nicht verfügbar (privater Modus?). Notizen können nicht gesichert werden.', { ms: 8000 });
    }

    this.library = new Library(this);
    this.editor = new Editor(this);
    this.sch = new SchematicEditor(this);
    this.libEl.hidden = false;
    window.fingernoteStarted = true;
    await this.library.refresh();
    od.startAutoSync();

    if (oauth && oauth.purpose === 'notes') {
      const parent = sessionStorage.getItem('fingernote.notesParent') || null;
      sessionStorage.removeItem('fingernote.notesParent');
      if (oauth.ok) this.library.importOneNote(parent, true);
      else toast('OneNote: ' + oauth.error, { ms: 6000 });
      return;
    }
    if (oauth && !restored && oauth.account !== '__restore__') {
      if (oauth.ok) { toast('OneDrive verbunden – wird gesichert …'); od.upload().then(() => toast('In OneDrive gesichert')).catch((e) => toast(e.message)); }
      else toast('OneDrive: ' + oauth.error, { ms: 6000 });
      return;
    }

    // Zuletzt geöffnetes Buch wieder öffnen (iPadOS beendet Web-Apps im Hintergrund gern)
    let last = null;
    try { last = JSON.parse(localStorage.getItem(accounts.accountKey('last')) || 'null'); } catch (e) { /* */ }
    if (last && last.nb) {
      const ok = await this.openNotebook(last.nb, last.page);
      if (!ok) localStorage.removeItem(accounts.accountKey('last'));
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && (this.editor.isOpen || this.sch.isOpen)) this.rememberPage();
    });
  }

  rememberPage() {
    if (this.sch.isOpen) { localStorage.setItem(accounts.accountKey('last'), JSON.stringify({ nb: this.sch.nb.id, page: this.sch.pages[this.sch.idx].id })); return; }
    const ed = this.editor;
    if (!ed.isOpen || !ed.nb) return;
    const p = ed.pages[ed.currentIndex()];
    localStorage.setItem(accounts.accountKey('last'), JSON.stringify({ nb: ed.nb.id, page: p && p.id }));
  }

  async openNotebook(id, pageId) {
    const item = await store.getItem(id);
    if (item && ['schematic', 'install', 'cabinet'].includes(item.mode)) {
      this.libEl.hidden = true;
      const ok = await this.sch.open(id, pageId);
      if (!ok) { this.libEl.hidden = false; return false; }
      localStorage.setItem(accounts.accountKey('last'), JSON.stringify({ nb: id, page: pageId || null }));
      return true;
    }
    this.libEl.hidden = true;
    this.edEl.hidden = false;
    const ok = await this.editor.open(id, pageId);
    if (!ok) {
      this.edEl.hidden = true;
      this.libEl.hidden = false;
      return false;
    }
    localStorage.setItem(accounts.accountKey('last'), JSON.stringify({ nb: id, page: pageId || null }));
    return true;
  }

  async closeEditor() {
    if (this.sch.isOpen) await this.sch.close();
    if (this.editor.isOpen) await this.editor.close();
    localStorage.removeItem(accounts.accountKey('last'));
    this.edEl.hidden = true;
    this.libEl.hidden = false;
    window.fingernoteStarted = true;
    await this.library.refresh();
  }

  /** Abmelden: offenes Buch speichern, dann Anmeldebildschirm. */
  async lock() {
    if (this.editor && this.editor.isOpen) await this.editor.close();
    if (this.sch && this.sch.isOpen) await this.sch.close();
    accounts.logout();
  }
}

const app = new App();
window.fingernote = app;
app.init();
