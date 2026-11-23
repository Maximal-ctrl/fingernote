/*
 * Service Worker von FingerNote: speichert alle Programmdateien auf dem Gerät,
 * damit die App auch ohne Internet startet. Notizen liegen NICHT hier, sondern
 * im App-Speicher (IndexedDB) – sie verlassen das Gerät nie (außer zur eigenen OneDrive).
 *
 * Online wird immer zuerst die aktuelle Datei vom Server geholt (so mischen sich nie
 * alte und neue Programmteile), offline kommt sie aus dem Gerätespeicher.
 * Bei jeder Veröffentlichung VERSION erhöhen.
 */
const VERSION = 'fingernote-v2.2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/boot.js',
  'js/app.js', 'js/util.js', 'js/db.js', 'js/store.js', 'js/ink.js', 'js/shapes.js', 'js/tools.js',
  'js/ruler.js', 'js/editor.js', 'js/editor-ui.js', 'js/library.js', 'js/ui.js', 'js/icons.js',
  'js/pickers.js', 'js/pdfio.js', 'js/accounts.js', 'js/config.js', 'js/onedrive.js', 'js/world.js', 'js/schematic.js', 'js/schem-symbols.js',
  'lib/pdf.min.js', 'lib/pdf.worker.min.js',
  'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  // cache: 'reload' umgeht den Browser-Zwischenspeicher – sonst landen alte Dateien im neuen Speicher
  event.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (cached) return cached;
      return (req.mode === 'navigate' && (await cache.match('index.html'))) || Response.error();
    }
  })());
});
