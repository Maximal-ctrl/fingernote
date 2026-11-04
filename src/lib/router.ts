import { useSyncExternalStore } from 'react';

const sub = (f: () => void) => {
  window.addEventListener('hashchange', f);
  return () => window.removeEventListener('hashchange', f);
};

export function useHash() {
  return useSyncExternalStore(sub, () => window.location.hash.slice(1) || '/');
}

export function navigate(path: string, replace = false) {
  const url = '#' + path;
  if (replace) {
    history.replaceState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = path;
}

export type Route =
  | { name: 'library' }
  | { name: 'notebook'; notebookId: string; pageId?: string; q?: string }
  | { name: 'design' };

export function parseRoute(hash: string): Route {
  const [path, query] = hash.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  if (parts[0] === 'nb' && parts[1]) {
    const q = new URLSearchParams(query || '').get('q') || undefined;
    return { name: 'notebook', notebookId: parts[1], pageId: parts[2] === 'p' ? parts[3] : undefined, q };
  }
  if (parts[0] === 'design') return { name: 'design' };
  return { name: 'library' };
}

export const pagePath = (notebookId: string, pageId: string, q?: string) =>
  `/nb/${notebookId}/p/${pageId}` + (q ? `?q=${encodeURIComponent(q)}` : '');
