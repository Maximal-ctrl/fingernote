import { useEffect } from 'react';
import { useHash, parseRoute } from './lib/router';
import { settings, ui } from './lib/store';
import { Toaster } from './ui/ui';
import { Library } from './screens/Library';
import { NotebookView } from './screens/NotebookView';
import { DesignPage } from './screens/DesignPage';
import { AboutPage } from './screens/AboutPage';
import { SearchPanel } from './screens/SearchPanel';
import { TagsPanel } from './screens/TagsPanel';
import { TrashPanel } from './screens/TrashPanel';
import { SettingsModal } from './screens/SettingsModal';

export function App() {
  const route = parseRoute(useHash());
  const theme = settings.use((s) => s.theme);
  const panel = ui.use((s) => s.panel);

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#15181d' : '#ffffff');
    };
    apply();
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  // Globale Kürzel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        ui.set({ panel: 'search' });
      }
      if (mod && e.key === ',') {
        e.preventDefault();
        ui.set({ panel: 'settings' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = () => ui.set({ panel: null });

  return (
    <>
      {route.name === 'library' && <Library />}
      {route.name === 'notebook' && <NotebookView key={route.notebookId} notebookId={route.notebookId} pageId={route.pageId} q={route.q} />}
      {route.name === 'design' && <DesignPage />}
      {route.name === 'about' && <AboutPage />}
      {panel === 'search' && <SearchPanel onClose={close} />}
      {panel === 'tags' && <TagsPanel onClose={close} />}
      {panel === 'trash' && <TrashPanel onClose={close} />}
      {panel === 'settings' && <SettingsModal onClose={close} />}
      <Toaster />
    </>
  );
}
