import { Pen, Trash2 } from 'lucide-react';
import { Button, IconButton, toast } from '../ui/ui';
import { AppHeader } from '../ui/AppHeader';
import { COVER_COLORS, PEN_COLORS } from '../lib/palette';
import { PAPER_TYPES, PAPER_COLORS } from '../canvas/paper';

/** Design-System-Prüfseite (#/design): alle Grundbausteine in allen Zuständen. */
export function DesignPage() {
  return (
    <div className="screen">
      <AppHeader />
      <main className="design-page">
        <h1>Design-System</h1>
        <section>
          <h2>Buttons</h2>
          <div className="row gap-8 wrap">
            <Button variant="primary">Primär</Button>
            <Button>Sekundär</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Gefährlich</Button>
            <Button variant="primary" disabled>Deaktiviert</Button>
            <Button size="sm">Klein</Button>
            <IconButton label="Stift" active><Pen size={18} /></IconButton>
            <IconButton label="Löschen"><Trash2 size={18} /></IconButton>
            <Button onClick={() => toast('So sieht ein Hinweis aus.')}>Toast zeigen</Button>
            <Button onClick={() => toast('So sieht ein Fehler aus.', 'error')}>Fehler-Toast</Button>
          </div>
        </section>
        <section>
          <h2>Farbrollen</h2>
          <div className="token-grid">
            {['bg', 'surface', 'surface-2', 'border', 'border-input', 'text', 'text-muted', 'accent', 'accent-soft', 'on-accent', 'danger', 'success', 'warning', 'paper', 'paper-line', 'canvas'].map((t) => (
              <div key={t} className="token"><span style={{ background: `var(--${t})` }} /> {t}</div>
            ))}
          </div>
        </section>
        <section>
          <h2>Typografie</h2>
          <p className="t-display">Display 40</p>
          <p className="t-xl">Titel 28</p>
          <p className="t-lg">Abschnitt 20</p>
          <p>Fließtext 16: Notizen, die man wiederfindet.</p>
          <p className="small">Klein 14</p>
          <p className="xs muted">Hinweis 12</p>
        </section>
        <section>
          <h2>Cover & Stifte</h2>
          <div className="row gap-8 wrap">
            {COVER_COLORS.map((c) => <span key={c.id} className="swatch swatch-lg" style={{ background: c.id }} title={c.name} />)}
          </div>
          <div className="row gap-8 wrap" style={{ marginTop: 'var(--s-3)' }}>
            {PEN_COLORS.map((c) => <span key={c.id} className="swatch" style={{ background: c.id }} title={c.name} />)}
          </div>
        </section>
        <section>
          <h2>Papier</h2>
          <div className="row gap-8 wrap">
            {PAPER_COLORS.map((c) => PAPER_TYPES.map((t) => (
              <div key={c.id + t.id} className="paper-option"><span className={`paper-thumb paper-${t.id} paper-c-${c.id}`} />{t.label} · {c.label}</div>
            )))}
          </div>
        </section>
      </main>
    </div>
  );
}
