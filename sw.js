/*
 * Service Worker von FingerNote: speichert alle Programmdateien auf dem Gerät,
 * damit die App auch ohne Internet startet. Notizen liegen NICHT hier, sondern
 * im App-Speicher (IndexedDB) – sie verlassen das Gerät nie.
 *
 * Aktualisierung: Die App startet aus dem Gerätespeicher und lädt im Hintergrund
 * neuere Programmdateien nach; sie sind beim nächsten Start aktiv.
 * Bei jeder Veröffentlichung VERSION erhöhen.
 */
const VERSION = 'fingernote-v1.01';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/util.js', 'js/db.js', 'js/store.js', 'js/ink.js', 'js/shapes.js', 'js/tools.js',
  'js/ruler.js', 'js/editor.js', 'js/editor-ui.js', 'js/library.js', 'js/ui.js', 'js/icons.js',
  'js/pickers.js', 'js/pdfio.js',
  'lib/pdf.min.js', 'lib/pdf.worker.min.js',
  'apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
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
    const cached = await cache.match(req, { ignoreSearch: true });
    const fromNet = fetch(req).then(async (res) => {
      if (res.ok) await cache.put(req, res.clone());
      return res;
    });
    if (cached) {
      event.waitUntil(fromNet.catch(() => { /* offline – Gerätespeicher genügt */ }));
      return cached;
    }
    try {
      return await fromNet;
    } catch (e) {
      return (req.mode === 'navigate' && (await cache.match('index.html'))) || Response.error();
    }
  })());
});
