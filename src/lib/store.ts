import { useSyncExternalStore } from 'react';

/** Kleiner Store mit Abo, optional in localStorage gespiegelt (nur Komfort-Einstellungen). */
export function createStore<T extends object>(initial: T, storageKey?: string) {
  let state = initial;
  if (storageKey) {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) state = { ...initial, ...JSON.parse(raw) };
    } catch {
      /* privates Fenster o. Ä. */
    }
  }
  const subs = new Set<() => void>();
  const get = () => state;
  const set = (patch: Partial<T> | ((s: T) => Partial<T>)) => {
    state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* egal */ }
    }
    subs.forEach((f) => f());
  };
  const subscribe = (f: () => void) => {
    subs.add(f);
    return () => subs.delete(f);
  };
  function use(): T;
  function use<U>(sel: (s: T) => U): U;
  function use<U>(sel?: (s: T) => U) {
    return useSyncExternalStore(subscribe, () => (sel ? sel(state) : state));
  }
  return { get, set, subscribe, use };
}

export type Theme = 'system' | 'light' | 'dark';
export type Tool = 'type' | 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'shape';

export const settings = createStore(
  {
    theme: 'system' as Theme,
    penOnly: false, // true: Finger scrollt, nur Stift zeichnet
    penSeen: false,
    tool: 'type' as Tool,
    penColor: '#16191f',
    penWidth: 3,
    hlColor: '#ffe066',
    hlWidth: 18,
    eraserSize: 14,
    eraserHlOnly: false,
    shape: 'rect' as 'line' | 'rect' | 'ellipse' | 'arrow',
    shapeColor: '#3b5bdb',
    shapeWidth: 3,
    sidebar: true,
  },
  'fingernote:settings',
);

export type Panel = null | 'search' | 'tags' | 'trash' | 'settings' | 'pdf';
export const ui = createStore({ panel: null as Panel, searchQuery: '' });
