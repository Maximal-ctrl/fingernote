// Fingernote ohne Installation starten: liefert den fertigen Build aus dist/ unter http://localhost:5173 aus.
// Nur Node.js nötig, keine Pakete. Aufruf: node serve.mjs
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const PORT = 5173; // fest: die Notizen hängen an der Adresse http://localhost:5173
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const URL_ = `http://localhost:${PORT}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
};

try {
  await stat(join(ROOT, 'index.html'));
} catch {
  console.error('\n  Der Ordner "dist" fehlt. Bitte das ZIP vollständig entpacken (nicht aus dem ZIP heraus starten).\n');
  process.exit(1);
}

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url ?? '/', URL_).pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = normalize(join(ROOT, path));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) {
      res.writeHead(403).end();
      return;
    }
    let body;
    let type = TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
    try {
      body = await readFile(file);
    } catch {
      body = await readFile(join(ROOT, 'index.html')); // App-Routen
      type = TYPES['.html'];
    }
    const cache = path.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  } catch {
    res.writeHead(500).end('Fehler');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\n  Port ${PORT} ist schon belegt. Läuft Fingernote schon? Dann einfach ${URL_} im Browser öffnen.`);
    console.log('  Sonst das andere Programm auf Port 5173 beenden und neu starten.\n');
  } else {
    console.error('\n  Server konnte nicht starten:', e.message, '\n');
  }
  process.exit(1);
});

server.listen(PORT, 'localhost', () => {
  console.log(`\n  Fingernote läuft: ${URL_}`);
  console.log('  Dieses Fenster offen lassen, solange du Fingernote benutzt. Beenden: Fenster schließen oder Strg+C.\n');
  const open = process.platform === 'win32' ? `start "" "${URL_}"` : process.platform === 'darwin' ? `open "${URL_}"` : `xdg-open "${URL_}"`;
  if (!process.argv.includes('--no-open')) exec(open, () => {});
});
