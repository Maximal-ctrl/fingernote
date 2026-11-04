import { useEffect, useRef, useState, useCallback, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  return <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />;
}

export function IconButton({ label, active, className = '', children, shortcut, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; shortcut?: string }) {
  return (
    <button
      type="button"
      className={`icon-btn ${active ? 'is-active' : ''} ${className}`}
      aria-label={label}
      aria-pressed={active === undefined ? undefined : active}
      title={shortcut ? `${label} (${shortcut})` : label}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Modal ---------- */

export function Modal({ title, onClose, children, footer, size = 'md' }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>('[autofocus], input, button:not(.modal-close), select, textarea');
    (first ?? el).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const items = Array.from(el.querySelectorAll<HTMLElement>('button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])')).filter((x) => !x.hasAttribute('disabled'));
        if (!items.length) return;
        const firstEl = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); firstEl.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return createPortal(
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={ref} tabIndex={-1}>
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <IconButton label="Schließen" className="modal-close" onClick={onClose}><X size={18} /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Kontextmenü ---------- */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
  colors?: { value: string; label: string; selected?: boolean; onSelect: () => void }[];
}

export interface MenuState { x: number; y: number; items: MenuItem[] }

export function ContextMenu({ menu, onClose }: { menu: MenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: menu.x, y: menu.y });
  useEffect(() => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      y: Math.max(8, Math.min(menu.y, window.innerHeight - r.height - 8)),
    });
    el.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const close = (e: Event) => {
      if (!el.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(el.querySelectorAll<HTMLElement>('[role=menuitem]:not([disabled])'));
        const i = items.indexOf(document.activeElement as HTMLElement);
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('blur', onClose);
    };
  }, [menu, onClose]);
  return createPortal(
    <div className="menu" role="menu" ref={ref} style={{ left: pos.x, top: pos.y }}>
      {menu.items.map((item, i) =>
        item.separator ? (
          <div key={i} className="menu-sep" role="separator" />
        ) : item.colors ? (
          <div key={i} className="menu-colors" role="group" aria-label={item.label}>
            {item.colors.map((c) => (
              <button
                key={c.value}
                type="button"
                role="menuitem"
                className={`swatch ${c.selected ? 'is-selected' : ''}`}
                style={{ background: c.value }}
                aria-label={c.label}
                title={c.label}
                onClick={() => { c.onSelect(); onClose(); }}
              />
            ))}
          </div>
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`menu-item ${item.danger ? 'is-danger' : ''}`}
            disabled={item.disabled}
            onClick={() => { onClose(); item.onSelect?.(); }}
          >
            <span className="menu-icon" aria-hidden>{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}

export function useMenu() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const open = useCallback((e: { clientX: number; clientY: number; preventDefault?: () => void }, items: MenuItem[]) => {
    e.preventDefault?.();
    setMenu({ x: e.clientX, y: e.clientY, items });
  }, []);
  const node = menu ? <ContextMenu menu={menu} onClose={() => setMenu(null)} /> : null;
  return { open, node };
}

/* ---------- Popover ---------- */

export function Popover({ anchor, onClose, children, label }: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const a = anchor.getBoundingClientRect();
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    setPos({
      x: Math.max(8, Math.min(a.left, window.innerWidth - r.width - 8)),
      y: a.bottom + 6 + r.height > window.innerHeight ? Math.max(8, a.top - r.height - 6) : a.bottom + 6,
    });
    const close = (e: Event) => {
      if (!el.contains(e.target as Node) && !anchor.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);
  return createPortal(
    <div className="popover" role="dialog" aria-label={label} ref={ref} style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden', left: 0, top: 0 }}>
      {children}
    </div>,
    document.body,
  );
}

/* ---------- Toast ---------- */

type ToastMsg = { id: number; text: string; kind: 'info' | 'error'; action?: { label: string; run: () => void } };
let pushToast: (t: Omit<ToastMsg, 'id'>) => void = () => {};
export const toast = (text: string, kind: 'info' | 'error' = 'info', action?: ToastMsg['action']) => pushToast({ text, kind, action });

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([]);
  useEffect(() => {
    let n = 0;
    pushToast = (t) => {
      const id = ++n;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), t.action ? 6000 : 3200);
    };
  }, []);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>
          <span>{t.text}</span>
          {t.action && (
            <button type="button" className="toast-action" onClick={() => { t.action!.run(); setItems((xs) => xs.filter((x) => x.id !== t.id)); }}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Bestätigen ---------- */

export function ConfirmDialog({ title, text, confirmLabel, danger, onConfirm, onClose }: { title: string; text: ReactNode; confirmLabel: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }} autoFocus>{confirmLabel}</Button>
        </>
      }
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}

/* ---------- Inline umbenennen ---------- */

export function InlineEdit({ value, onCommit, onCancel, className = '', label }: { value: string; onCommit: (v: string) => void; onCancel: () => void; className?: string; label: string }) {
  const [v, setV] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const done = useRef(false);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    const t = v.trim();
    if (t && t !== value) onCommit(t);
    else onCancel();
  };
  return (
    <input
      ref={ref}
      className={`inline-edit ${className}`}
      aria-label={label}
      value={v}
      maxLength={120}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { done.current = true; onCancel(); }
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
