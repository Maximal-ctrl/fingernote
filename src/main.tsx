import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { recoverPending } from './db/repo';
import { ErrorBoundary } from './ui/ErrorBoundary';

function start() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Erst nicht gespeicherte Änderungen nachholen, dann starten (auch wenn das Nachholen scheitert).
recoverPending().catch((e) => console.warn(e)).finally(start);

// Browser bitten, die lokalen Notizen nicht automatisch zu räumen.
navigator.storage?.persist?.().catch(() => {});
