import type { PaperColor, PaperType } from '../db/db';

export const PAPER_TYPES: { id: PaperType; label: string }[] = [
  { id: 'blank', label: 'Leer' },
  { id: 'lined', label: 'Liniert' },
  { id: 'grid', label: 'Kariert' },
  { id: 'dotted', label: 'Punkte' },
  { id: 'cornell', label: 'Cornell' },
];

export const PAPER_COLORS: { id: PaperColor; label: string }[] = [
  { id: 'white', label: 'Weiß' },
  { id: 'cream', label: 'Creme' },
  { id: 'gray', label: 'Grau' },
  { id: 'dark', label: 'Dunkel' },
];

export const paperClass = (type: PaperType, color: PaperColor) => `paper paper-${type} paper-c-${color}`;
