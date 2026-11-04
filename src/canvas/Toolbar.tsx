import { useRef, useState } from 'react';
import {
  Type, Pen, Highlighter, Eraser, LassoSelect, Shapes, ImagePlus, Undo2, Redo2, ZoomIn, ZoomOut,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Heading1, Heading2, SquareCheck, Star, CircleHelp,
  Lightbulb, Baseline, Highlighter as HlIcon, StickyNote, Ellipsis, Printer, Trash2, Minus, Square, Circle, MoveUpRight,
} from 'lucide-react';
import { IconButton, Popover } from '../ui/ui';
import { settings, type Tool } from '../lib/store';
import { HIGHLIGHT_COLORS, PEN_COLORS, TEXT_COLORS } from '../lib/palette';
import { exec, toggleTag } from './textCommands';
import { PAPER_COLORS, PAPER_TYPES } from './paper';
import type { Paper } from '../db/db';

const noFocus = (e: React.PointerEvent | React.MouseEvent) => e.preventDefault();

interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  zoom: number;
  onZoom: (z: number) => void;
  onFit: () => void;
  onInsertImage: (f: File) => void;
  paper: Paper;
  onPaper: (p: Paper, asDefault: boolean) => void;
  onPrint: () => void;
  onDeletePage: () => void;
  isPdf: boolean;
}

const TOOLS: { id: Tool; label: string; key: string; icon: React.ReactNode }[] = [
  { id: 'type', label: 'Tippen & Auswählen', key: 'T', icon: <Type size={18} /> },
  { id: 'pen', label: 'Stift', key: 'P', icon: <Pen size={18} /> },
  { id: 'highlighter', label: 'Marker', key: 'H', icon: <Highlighter size={18} /> },
  { id: 'eraser', label: 'Radierer', key: 'E', icon: <Eraser size={18} /> },
  { id: 'lasso', label: 'Lasso', key: 'L', icon: <LassoSelect size={18} /> },
  { id: 'shape', label: 'Formen', key: 'S', icon: <Shapes size={18} /> },
];

export function Toolbar(p: Props) {
  const s = settings.use();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pop, setPop] = useState<null | { kind: 'textColor' | 'hlColor' | 'paper' | 'more' | 'tags'; anchor: HTMLElement }>(null);
  const toggle = (kind: NonNullable<typeof pop>['kind']) => (e: React.MouseEvent<HTMLElement>) =>
    setPop(pop?.kind === kind ? null : { kind, anchor: e.currentTarget });

  return (
    <div className="toolbar" role="toolbar" aria-label="Werkzeuge">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <IconButton key={t.id} label={t.label} shortcut={t.key} active={s.tool === t.id} onClick={() => settings.set({ tool: t.id })}>
            {t.icon}
          </IconButton>
        ))}
        <IconButton label="Bild einfügen" onClick={() => fileRef.current?.click()}><ImagePlus size={18} /></IconButton>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) p.onInsertImage(f); }} />
      </div>

      <div className="tool-sep" />

      <div className="tool-group tool-options" aria-label="Werkzeugoptionen">
        {s.tool === 'type' && (
          <>
            <IconButton label="Fett" shortcut="Strg B" onPointerDown={noFocus} onClick={() => exec('bold')}><Bold size={17} /></IconButton>
            <IconButton label="Kursiv" shortcut="Strg I" onPointerDown={noFocus} onClick={() => exec('italic')}><Italic size={17} /></IconButton>
            <IconButton label="Unterstrichen" shortcut="Strg U" onPointerDown={noFocus} onClick={() => exec('underline')}><Underline size={17} /></IconButton>
            <IconButton label="Durchgestrichen" onPointerDown={noFocus} onClick={() => exec('strikeThrough')}><Strikethrough size={17} /></IconButton>
            <IconButton label="Überschrift 1" onPointerDown={noFocus} onClick={() => exec('formatBlock', '<h1>')}><Heading1 size={17} /></IconButton>
            <IconButton label="Überschrift 2" onPointerDown={noFocus} onClick={() => exec('formatBlock', '<h2>')}><Heading2 size={17} /></IconButton>
            <IconButton label="Aufzählung" onPointerDown={noFocus} onClick={() => exec('insertUnorderedList')}><List size={17} /></IconButton>
            <IconButton label="Nummerierung" onPointerDown={noFocus} onClick={() => exec('insertOrderedList')}><ListOrdered size={17} /></IconButton>
            <IconButton label="Textfarbe" onPointerDown={noFocus} onClick={toggle('textColor')}><Baseline size={17} /></IconButton>
            <IconButton label="Text hervorheben" onPointerDown={noFocus} onClick={toggle('hlColor')}><HlIcon size={17} /></IconButton>
            <IconButton label="Tag setzen" onPointerDown={noFocus} onClick={toggle('tags')}><SquareCheck size={17} /></IconButton>
          </>
        )}
        {(s.tool === 'pen' || s.tool === 'shape') && (
          <>
            {s.tool === 'shape' && (
              <>
                {([['line', 'Linie', <Minus size={17} key="l" />], ['rect', 'Rechteck', <Square size={17} key="r" />], ['ellipse', 'Ellipse', <Circle size={17} key="e" />], ['arrow', 'Pfeil', <MoveUpRight size={17} key="a" />]] as const).map(([id, label, icon]) => (
                  <IconButton key={id} label={label} active={s.shape === id} onClick={() => settings.set({ shape: id })}>{icon}</IconButton>
                ))}
                <span className="tool-sep thin" />
              </>
            )}
            {PEN_COLORS.map((c) => {
              const cur = s.tool === 'pen' ? s.penColor : s.shapeColor;
              return (
                <button key={c.id} type="button" className={`swatch ${cur === c.id ? 'is-selected' : ''}`} style={{ background: c.id }} aria-label={c.name} aria-pressed={cur === c.id} title={c.name}
                  onClick={() => settings.set(s.tool === 'pen' ? { penColor: c.id } : { shapeColor: c.id })} />
              );
            })}
            <WidthPicker
              value={s.tool === 'pen' ? s.penWidth : s.shapeWidth}
              options={[1.5, 3, 5, 8]}
              color={s.tool === 'pen' ? s.penColor : s.shapeColor}
              onChange={(w) => settings.set(s.tool === 'pen' ? { penWidth: w } : { shapeWidth: w })}
            />
          </>
        )}
        {s.tool === 'highlighter' && (
          <>
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c.id} type="button" className={`swatch ${s.hlColor === c.id ? 'is-selected' : ''}`} style={{ background: c.id }} aria-label={c.name} aria-pressed={s.hlColor === c.id} title={c.name} onClick={() => settings.set({ hlColor: c.id })} />
            ))}
            <WidthPicker value={s.hlWidth} options={[10, 18, 28]} color={s.hlColor} onChange={(w) => settings.set({ hlWidth: w })} />
          </>
        )}
        {s.tool === 'eraser' && (
          <>
            <WidthPicker value={s.eraserSize} options={[6, 14, 30]} color="var(--text-muted)" onChange={(w) => settings.set({ eraserSize: w })} label="Radierergröße" />
            <label className="check">
              <input type="checkbox" checked={s.eraserHlOnly} onChange={(e) => settings.set({ eraserHlOnly: e.target.checked })} />
              nur Marker
            </label>
          </>
        )}
        {s.tool === 'lasso' && <span className="muted small tool-hint">Umkreisen, dann ziehen · Entf löscht</span>}
      </div>

      <div className="tool-group tool-right">
        <IconButton label="Rückgängig" shortcut="Strg Z" disabled={!p.canUndo} onClick={p.onUndo}><Undo2 size={18} /></IconButton>
        <IconButton label="Wiederholen" shortcut="Strg Y" disabled={!p.canRedo} onClick={p.onRedo}><Redo2 size={18} /></IconButton>
        <span className="tool-sep thin" />
        <IconButton label="Verkleinern" shortcut="Strg −" onClick={() => p.onZoom(p.zoom / 1.2)}><ZoomOut size={18} /></IconButton>
        <button type="button" className="zoom-label" onClick={p.onFit} title="An Breite anpassen">{Math.round(p.zoom * 100)} %</button>
        <IconButton label="Vergrößern" shortcut="Strg +" onClick={() => p.onZoom(p.zoom * 1.2)}><ZoomIn size={18} /></IconButton>
        <span className="tool-sep thin" />
        <IconButton label="Papier" onClick={toggle('paper')} disabled={p.isPdf}><StickyNote size={18} /></IconButton>
        <IconButton label="Mehr" onClick={toggle('more')}><Ellipsis size={18} /></IconButton>
      </div>

      {pop?.kind === 'textColor' && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label="Textfarbe">
          <div className="swatches" onPointerDown={noFocus}>
            {TEXT_COLORS.map((c) => (
              <button key={c} type="button" className="swatch" style={{ background: c }} aria-label={`Textfarbe ${c}`} onClick={() => { exec('foreColor', c); setPop(null); }} />
            ))}
          </div>
        </Popover>
      )}
      {pop?.kind === 'hlColor' && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label="Hervorhebung">
          <div className="swatches" onPointerDown={noFocus}>
            {HIGHLIGHT_COLORS.map((c) => (
              <button key={c.id} type="button" className="swatch" style={{ background: c.id }} aria-label={c.name} onClick={() => { exec('hiliteColor', c.id); setPop(null); }} />
            ))}
            <button type="button" className="swatch swatch-none" aria-label="Keine Hervorhebung" onClick={() => { exec('hiliteColor', 'transparent'); setPop(null); }} />
          </div>
        </Popover>
      )}
      {pop?.kind === 'tags' && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label="Tags">
          <div className="menu-inline" onPointerDown={noFocus}>
            {([['todo', 'To-Do', <SquareCheck size={16} key="t" />, 'Strg 1'], ['important', 'Wichtig', <Star size={16} key="i" />, 'Strg 2'], ['question', 'Frage', <CircleHelp size={16} key="q" />, 'Strg 3'], ['idea', 'Idee', <Lightbulb size={16} key="d" />, 'Strg 4']] as const).map(([id, label, icon, key]) => (
              <button key={id} type="button" className="menu-item" onClick={() => { toggleTag(id); setPop(null); }}>
                <span className="menu-icon">{icon}</span>{label}<kbd className="menu-kbd">{key}</kbd>
              </button>
            ))}
          </div>
        </Popover>
      )}
      {pop?.kind === 'paper' && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label="Papier">
          <PaperPicker paper={p.paper} onPaper={p.onPaper} />
        </Popover>
      )}
      {pop?.kind === 'more' && (
        <Popover anchor={pop.anchor} onClose={() => setPop(null)} label="Mehr">
          <div className="menu-inline">
            <button type="button" className="menu-item" onClick={() => { setPop(null); p.onPrint(); }}><span className="menu-icon"><Printer size={16} /></span>Drucken / als PDF sichern</button>
            <button type="button" className="menu-item is-danger" onClick={() => { setPop(null); p.onDeletePage(); }}><span className="menu-icon"><Trash2 size={16} /></span>Seite in den Papierkorb</button>
          </div>
        </Popover>
      )}
    </div>
  );
}

function WidthPicker({ value, options, color, onChange, label = 'Strichstärke' }: { value: number; options: number[]; color: string; onChange: (w: number) => void; label?: string }) {
  return (
    <div className="widths" role="group" aria-label={label}>
      {options.map((w) => (
        <button key={w} type="button" className={`width-dot ${value === w ? 'is-selected' : ''}`} aria-label={`${label} ${w}`} aria-pressed={value === w} onClick={() => onChange(w)}>
          <span style={{ width: Math.min(22, Math.max(4, w)), height: Math.min(22, Math.max(4, w)), background: color }} />
        </button>
      ))}
    </div>
  );
}

function PaperPicker({ paper, onPaper }: { paper: Paper; onPaper: (p: Paper, asDefault: boolean) => void }) {
  const [asDefault, setAsDefault] = useState(false);
  return (
    <div className="paper-picker">
      <div className="small strong">Vorlage</div>
      <div className="paper-options">
        {PAPER_TYPES.map((t) => (
          <button key={t.id} type="button" className={`paper-option ${paper.type === t.id ? 'is-selected' : ''}`} aria-pressed={paper.type === t.id} onClick={() => onPaper({ ...paper, type: t.id }, asDefault)}>
            <span className={`paper-thumb paper-${t.id} paper-c-${paper.color}`} aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      <div className="small strong">Farbe</div>
      <div className="paper-options">
        {PAPER_COLORS.map((c) => (
          <button key={c.id} type="button" className={`paper-option ${paper.color === c.id ? 'is-selected' : ''}`} aria-pressed={paper.color === c.id} onClick={() => onPaper({ ...paper, color: c.id }, asDefault)}>
            <span className={`paper-thumb paper-${paper.type} paper-c-${c.id}`} aria-hidden />
            {c.label}
          </button>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" checked={asDefault} onChange={(e) => { setAsDefault(e.target.checked); if (e.target.checked) onPaper(paper, true); }} />
        Standard für neue Seiten in diesem Notizbuch
      </label>
    </div>
  );
}
