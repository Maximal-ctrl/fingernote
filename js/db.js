// IndexedDB-Speicher: alles bleibt auf dem Gerät.
//  items : Ordner und Notizbücher
//  pages : Seiten (Striche, Texte, Bilder)
//  blobs : Bilder und PDF-Hintergründe (als ArrayBuffer – robust in Safari)

let DB_NAME = 'fingernote';
const DB_VERSION = 1;
let dbPromise = null;
let quiet = 0;

/** Jedes Konto hat seine eigene Datenbank. */
export function useDatabase(name) {
  if (name === DB_NAME && dbPromise) return;
  if (dbPromise) dbPromise.then((db) => db.close()).catch(() => {});
  dbPromise = null;
  DB_NAME = name;
}

export function deleteDatabase(name) {
  return new Promise((res) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });
}

/** Schreibzugriffe melden (für die automatische OneDrive-Sicherung). */
let changeT = 0;
function notifyChange() {
  if (quiet) return;
  clearTimeout(changeT);
  changeT = setTimeout(() => window.dispatchEvent(new Event('fingernote:changed')), 300);
}
export async function silently(fn) { quiet++; try { return await fn(); } finally { quiet--; } }

export function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('items')) db.createObjectStore('items', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('pages')) {
          const s = db.createObjectStore('pages', { keyPath: 'id' });
          s.createIndex('nb', 'nb');
        }
        if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs', { keyPath: 'id' });
      };
      r.onsuccess = () => {
        const db = r.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      r.onerror = () => reject(r.error);
      r.onblocked = () => reject(new Error('Datenbank blockiert – bitte App neu starten.'));
    });
  }
  return dbPromise;
}

const asPromise = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

async function run(stores, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, mode);
    let result;
    t.oncomplete = () => { if (mode === 'readwrite') notifyChange(); resolve(result); };
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Transaktion abgebrochen'));
    Promise.resolve(fn(t)).then((r) => { result = r; }, (e) => { try { t.abort(); } catch (x) { /* */ } reject(e); });
  });
}

export const get = (store, id) => run([store], 'readonly', (t) => asPromise(t.objectStore(store).get(id)));
export const getAll = (store) => run([store], 'readonly', (t) => asPromise(t.objectStore(store).getAll()));
export const getByIndex = (store, index, key) =>
  run([store], 'readonly', (t) => asPromise(t.objectStore(store).index(index).getAll(key)));

export const put = (store, value) => run([store], 'readwrite', (t) => { t.objectStore(store).put(value); });
export const putMany = (store, values) => run([store], 'readwrite', (t) => {
  const s = t.objectStore(store);
  for (const v of values) s.put(v);
});
export const del = (store, id) => run([store], 'readwrite', (t) => { t.objectStore(store).delete(id); });
export const delMany = (store, ids) => run([store], 'readwrite', (t) => {
  const s = t.objectStore(store);
  for (const id of ids) s.delete(id);
});

/** Mehrere Stores in einer Transaktion schreiben: ops = [{store, put?: obj, del?: id}] */
export const batch = (ops) => {
  const stores = [...new Set(ops.map((o) => o.store))];
  if (!stores.length) return Promise.resolve();
  return run(stores, 'readwrite', (t) => {
    for (const o of ops) {
      const s = t.objectStore(o.store);
      if (o.put) s.put(o.put);
      if (o.del) s.delete(o.del);
    }
  });
};

export const getAllKeys = (store) => run([store], 'readonly', (t) => asPromise(t.objectStore(store).getAllKeys()));
