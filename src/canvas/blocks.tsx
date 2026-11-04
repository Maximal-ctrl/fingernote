import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { GripHorizontal, Trash2 } from 'lucide-react';
import type { Block } from '../db/db';
import { db } from '../db/db';
import { renderPdfPage } from '../lib/pdf';
import { sanitizeHtml } from '../lib/sanitize';
import { currentParagraph, fire, toggleTag } from './textCommands';
import type { TagKind } from '../db/repo';

/* ---------- Asset-URLs ---------- */

const urlCache = new Map<string, Promise<string>>();
export function assetUrl(id: string) {
  let p = urlCache.get(id);
  if (!p) {
    p = db.assets.get(id).then((a) => {
      if (!a) throw new Error('Bild fehlt');
      return URL.createObjectURL(a.blob);
    });
    urlCache.set(id, p);
    p.catch(() => urlCache.delete(id));
  }
  return p;
}

function useAssetUrl(id?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!id) return;
    let live = true;
    assetUrl(id).then((u) => live && setUrl(u)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [id]);
  return { url, failed };
}

/* ---------- Text ---------- */

const TAG_KEYS: Record<string, TagKind> = { '1': 'todo', '2': 'important', '3': 'question', '4': 'idea' };

interface TextProps {
  block: Block;
  autoFocus: boolean;
  selected: boolean;
  interactive: boolean;
  onChange: (id: string, html: string) => void;
  onFocusIn: (id: string) => void;
  onFocusOut: (id: string, html: string) => void;
  onMoveStart: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (id: string, e: React.PointerEvent) => void;
  onDelete: (id: string) => void;
  onHeight: (id: string, h: number) => void;
  onPasteImage: (file: File, near: Block) => void;
}

export const TextBlockView = memo(function TextBlockView(p: TextProps) {
  const { block } = p;
  const ref = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current!;
    if (el.innerHTML !== (block.html ?? '')) el.innerHTML = block.html ?? '';
  }, [block.html]);

  useEffect(() => {
    if (p.autoFocus) {
      const el = ref.current!;
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      getSelection()?.removeAllRanges();
      getSelection()?.addRange(r);
    }
  }, [p.autoFocus]);

  useEffect(() => {
    const el = wrap.current!;
    const ro = new ResizeObserver(() => p.onHeight(block.id, el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id]);

  const emit = () => p.onChange(block.id, ref.current!.innerHTML);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const el = ref.current!;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && TAG_KEYS[e.key]) {
      e.preventDefault();
      toggleTag(TAG_KEYS[e.key], el);
      return;
    }
    if (e.key === 'Escape') {
      el.blur();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand(e.shiftKey ? 'outdent' : 'indent');
      fire(el);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      const para = currentParagraph(el);
      if (para?.hasAttribute('data-tag') && !(para.textContent || '').trim()) {
        e.preventDefault();
        para.removeAttribute('data-tag');
        para.removeAttribute('data-done');
        fire(el);
      }
    }
    e.stopPropagation(); // Werkzeug-Kürzel nicht auslösen
  };

  const onInput = (e: React.FormEvent<HTMLDivElement>) => {
    if ((e.nativeEvent as InputEvent).inputType === 'insertParagraph') {
      currentParagraph(ref.current!)?.removeAttribute('data-done');
    }
    emit();
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = (e.target as HTMLElement).closest('[data-tag="todo"]') as HTMLElement | null;
    if (t && e.clientX - t.getBoundingClientRect().left < 24 * (t.getBoundingClientRect().width / t.offsetWidth || 1)) {
      e.preventDefault();
      if (t.getAttribute('data-done') === '1') t.removeAttribute('data-done');
      else t.setAttribute('data-done', '1');
      emit();
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      p.onPasteImage(file, block);
      return;
    }
    const html = e.clipboardData.getData('text/html');
    if (html) {
      e.preventDefault();
      document.execCommand('insertHTML', false, sanitizeHtml(html.replace(/<!--[\s\S]*?-->/g, '')));
      emit();
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const html = e.dataTransfer.getData('text/html');
    if (html || e.dataTransfer.files.length) {
      e.preventDefault();
      if (html) {
        document.execCommand('insertHTML', false, sanitizeHtml(html));
        emit();
      }
    }
  };

  return (
    <div
      ref={wrap}
      className={`tb ${p.selected ? 'is-selected' : ''}`}
      style={{ left: block.x, top: block.y, width: block.w }}
      data-block={block.id}
    >
      {p.interactive && (
        <div className="tb-bar" onPointerDown={(e) => p.onMoveStart(block.id, e)} title="Ziehen zum Verschieben">
          <GripHorizontal size={14} aria-hidden />
          <button
            type="button"
            className="tb-del"
            aria-label="Textfeld löschen"
            title="Textfeld löschen"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => p.onDelete(block.id)}
          >
            <Trash2 size={13} />
          </button>
        </div>
      )}
      <div
        ref={ref}
        className="tb-content"
        contentEditable={p.interactive}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Notiztext"
        spellCheck
        onInput={onInput}
        onKeyDown={onKeyDown}
        onFocus={() => p.onFocusIn(block.id)}
        onBlur={() => p.onFocusOut(block.id, ref.current!.innerHTML)}
        onPointerDown={onPointerDown}
        onPaste={onPaste}
        onDrop={onDrop}
      />
      {p.interactive && <div className="tb-resize" onPointerDown={(e) => p.onResizeStart(block.id, e)} title="Breite ändern" aria-hidden />}
    </div>
  );
});

/* ---------- Bild ---------- */

export const ImageBlockView = memo(function ImageBlockView({ block, selected, interactive, onPointerDown, onResizeStart }: {
  block: Block; selected: boolean; interactive: boolean;
  onPointerDown: (id: string, e: React.PointerEvent) => void;
  onResizeStart: (id: string, e: React.PointerEvent) => void;
}) {
  const { url, failed } = useAssetUrl(block.assetId);
  return (
    <div
      className={`ib ${selected ? 'is-selected' : ''} ${interactive ? 'is-interactive' : ''}`}
      style={{ left: block.x, top: block.y, width: block.w, height: block.h }}
      onPointerDown={(e) => interactive && onPointerDown(block.id, e)}
      data-block={block.id}
    >
      {url ? <img src={url} alt="Eingefügtes Bild" draggable={false} /> : <div className="ib-missing">{failed ? 'Bild fehlt' : ''}</div>}
      {interactive && selected && <div className="ib-resize" onPointerDown={(e) => { e.stopPropagation(); onResizeStart(block.id, e); }} aria-hidden />}
    </div>
  );
});

/* ---------- PDF-Seite ---------- */

export const PdfBlockView = memo(function PdfBlockView({ block, zoom }: { block: Block; zoom: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const px = block.w * zoom * (window.devicePixelRatio || 1);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      renderPdfPage(block.assetId!, block.pdfPage ?? 1, px).then((u) => live && setUrl(u)).catch(() => live && setFailed(true));
    }, url ? 250 : 0);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.assetId, block.pdfPage, Math.ceil(px / 400)]);
  return (
    <div className="pdfb" style={{ left: block.x, top: block.y, width: block.w, height: block.h }} data-block={block.id}>
      {url ? <img src={url} alt={`PDF-Seite ${block.pdfPage}`} draggable={false} /> : <div className="pdfb-loading">{failed ? 'PDF-Seite konnte nicht geladen werden.' : 'PDF-Seite wird geladen …'}</div>}
    </div>
  );
});
