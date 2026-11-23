// Notbremse: Startet die App nicht (z. B. nach einem misslungenen Update), erscheint statt
// eines weißen Bildschirms ein Hinweis mit „App reparieren“. Klassisches Skript, kein Modul.
(function () {
  var shown = false;
  function repair() {
    var jobs = [];
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    }
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    Promise.all(jobs).catch(function () {}).then(function () { location.replace(location.pathname + '?r=' + Date.now()); });
  }
  function show(msg) {
    // Sobald die App gestartet ist (Anmeldebildschirm oder Bibliothek sichtbar), nie mehr eingreifen
    if (shown || window.fingernoteStarted) return;
    if (document.querySelector('#login:not([hidden]) .login-card, #library:not([hidden]) .lib-h1, #editor:not([hidden]) .ed-stage, #schematic:not([hidden]) canvas')) { window.fingernoteStarted = true; return; }
    shown = true;
    var box = document.createElement('div');
    box.className = 'boot-fail';
    box.innerHTML = '<div><h1>FingerNote konnte nicht starten</h1><p>Meist liegt das an einer halb geladenen neuen Version. ' +
      'Deine Notizen sind nicht betroffen – sie liegen sicher im App-Speicher.</p><button type="button">App reparieren</button><small></small></div>';
    box.querySelector('small').textContent = msg ? String(msg).slice(0, 160) : '';
    box.querySelector('button').onclick = repair;
    document.body.appendChild(box);
  }
  window.addEventListener('error', function (e) { setTimeout(function () { show(e.message); }, 1500); });
  window.addEventListener('unhandledrejection', function (e) { setTimeout(function () { show(e.reason && e.reason.message); }, 1500); });
  setTimeout(function () { show(''); }, 9000);
  window.fingernoteRepair = repair;
})();
