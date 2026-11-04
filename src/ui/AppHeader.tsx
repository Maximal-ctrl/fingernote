import type { ReactNode } from 'react';
import { Search, Tag, Trash2, Settings } from 'lucide-react';
import { IconButton } from './ui';
import { ui } from '../lib/store';
import { Logo } from './Logo';

export function AppHeader({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="app-header">
      <div className="app-header-left">{left ?? <Logo />}</div>
      <button type="button" className="search-trigger" onClick={() => ui.set({ panel: 'search' })} aria-label="Alle Notizen durchsuchen">
        <Search size={16} aria-hidden />
        <span>Suchen</span>
        <kbd>Strg F</kbd>
      </button>
      <div className="app-header-right">
        {right}
        <IconButton label="Tags" onClick={() => ui.set({ panel: 'tags' })}><Tag size={18} /></IconButton>
        <IconButton label="Papierkorb" onClick={() => ui.set({ panel: 'trash' })}><Trash2 size={18} /></IconButton>
        <IconButton label="Einstellungen" shortcut="Strg ," onClick={() => ui.set({ panel: 'settings' })}><Settings size={18} /></IconButton>
      </div>
    </header>
  );
}
