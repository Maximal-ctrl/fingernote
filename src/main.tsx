import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/app.css';
import { App } from './App';
import { recoverPending } from './db/repo';

await recoverPending();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Browser bitten, die lokalen Notizen nicht automatisch zu räumen.
navigator.storage?.persist?.().catch(() => {});
