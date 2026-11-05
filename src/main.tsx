import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { recoverPending } from './db/repo';
import { ErrorBoundary } from './ui/ErrorBoundary';

declare global { interface Window { __fnBoot?: string; __fnMounted?: boolean; __fnLog?: (m: string) => void } }
window.__fnBoot = 'modul geladen';

function start() {
  window.__fnBoot = 'render gestartet';
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Erst nicht gespeicherte Änderungen nachholen, dann starten: auch wenn das Nachholen scheitert oder hängt (max. 2 s).
window.__fnBoot = 'nachholen';
Promise.race([recoverPending(), new Promise((r) => setTimeout(r, 2000))])
  .catch((e) => window.__fnLog?.('Nachholen fehlgeschlagen: ' + e))
  .finally(start);

// Browser bitten, die lokalen Notizen nicht automatisch zu räumen.
navigator.storage?.persist?.().catch(() => {});
