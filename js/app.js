// Einstieg: Bibliothek und Editor verbinden, Offline-Betrieb einrichten.
import { applyTheme, getSettings, saveSettings } from './util.js';
import * as store from './store.js';
import { Library } from './library.js';
import { Editor } from './editor.js';
import { toast } from './ui.js';

const LAST = 'fingernote.last';

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
    await this.library.refresh();
    document.body.classList.remove('loading');

    // Zuletzt geöffnetes Notizbuch wieder öffnen (iPadOS beendet Web-Apps im Hintergrund gern)
    let last = null;
    try { last = JSON.parse(localStorage.getItem(LAST) || 'null'); } catch (e) { /* */ }
    if (last && last.nb) {
      const ok = await this.openNotebook(last.nb, last.page);
      if (!ok) localStorage.removeItem(LAST);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.editor.isOpen) this.rememberPage();
    });
  }

  rememberPage() {
    const ed = this.editor;
    if (!ed.isOpen || !ed.nb) return;
    const p = ed.pages[ed.currentIndex()];
    localStorage.setItem(LAST, JSON.stringify({ nb: ed.nb.id, page: p && p.id }));
  }

  async openNotebook(id, pageId) {
    this.libEl.hidden = true;
    this.edEl.hidden = false;
    const ok = await this.editor.open(id, pageId);
    if (!ok) {
      this.edEl.hidden = true;
      this.libEl.hidden = false;
      return false;
    }
    localStorage.setItem(LAST, JSON.stringify({ nb: id, page: pageId || null }));
    return true;
  }

  async closeEditor() {
    await this.editor.close();
    localStorage.removeItem(LAST);
    this.edEl.hidden = true;
    this.libEl.hidden = false;
    await this.library.refresh();
  }
}

const app = new App();
window.fingernote = app;
app.init();
