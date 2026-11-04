import Dexie, { type Table } from 'dexie';

export type PaperType = 'blank' | 'lined' | 'grid' | 'dotted' | 'cornell';
export type PaperColor = 'white' | 'cream' | 'gray' | 'dark';
export interface Paper {
  type: PaperType;
  color: PaperColor;
}

export interface Notebook {
  id: string;
  title: string;
  color: string;
  favorite: boolean;
  paper: Paper;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
}

export interface Section {
  id: string;
  notebookId: string;
  title: string;
  color: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface Page {
  id: string;
  notebookId: string;
  sectionId: string;
  title: string;
  level: number; // 0..2, Unterseiten
  sortOrder: number;
  paper: Paper;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export type BlockKind = 'text' | 'image' | 'pdf';
export interface Block {
  id: string;
  pageId: string;
  kind: BlockKind;
  x: number;
  y: number;
  w: number;
  h?: number;
  html?: string;
  assetId?: string;
  pdfPage?: number;
}

export type StrokeTool = 'pen' | 'highlighter' | 'shape';
export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'arrow';
export interface Stroke {
  id: string;
  pageId: string;
  tool: StrokeTool;
  color: string;
  width: number;
  /** flach: x, y, druck, x, y, druck … (Seitenkoordinaten) */
  points: number[];
  pressure?: boolean;
  shape?: ShapeKind;
}

export interface Asset {
  id: string;
  mime: string;
  name?: string;
  blob: Blob;
}

class FingernoteDB extends Dexie {
  notebooks!: Table<Notebook, string>;
  sections!: Table<Section, string>;
  pages!: Table<Page, string>;
  blocks!: Table<Block, string>;
  strokes!: Table<Stroke, string>;
  assets!: Table<Asset, string>;

  constructor() {
    super('fingernote');
    this.version(1).stores({
      notebooks: 'id, sortOrder, updatedAt',
      sections: 'id, notebookId, sortOrder',
      pages: 'id, sectionId, notebookId, sortOrder, updatedAt',
      blocks: 'id, pageId',
      strokes: 'id, pageId',
      assets: 'id',
    });
  }
}

export const db = new FingernoteDB();

export const PAGE_W = 1000;
export const PAGE_MIN_H = 1414; // A4-Verhältnis bei 1000 Breite
