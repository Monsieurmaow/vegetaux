/* Service worker - Reconnaissance des vegetaux
   Increments VERSION a chaque mise a jour du fichier index.html */
const VERSION = 'v1';
const APP   = 'vege-app-' + VERSION;
const MEDIA = 'vege-media-v1';      /* photos : conserve entre les versions */
const API   = 'vege-api-v1';

const COQUILLE = ['./', './index.html', './manifest.json',
                  './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k.startsWith('vege-app-') && k !== APP).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* met en cache sans jamais faire echouer la reponse */
function garder(cache, req, rep) {
  if (rep && (rep.ok || rep.type === 'opaque')) {
    const copie = rep.clone();
    caches.open(cache).then(c => c.put(req, copie)).catch(() => {});
  }
  return rep;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 1. navigation : reseau d'abord (pour recevoir les mises a jour), cache en secours */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(r => garder(APP, req, r))
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  /* 2. photos Wikimedia : cache d'abord, telechargement une seule fois */
  if (url.hostname.endsWith('wikimedia.org') && url.pathname.indexOf('/api.php') < 0) {
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(r => garder(MEDIA, req, r)))
    );
    return;
  }

  /* 3. API Wikipedia : reseau d'abord, cache en secours (permet un lancement hors ligne) */
  if (url.pathname.indexOf('/w/api.php') >= 0) {
    e.respondWith(
      fetch(req).then(r => garder(API, req, r)).catch(() => caches.match(req))
    );
    return;
  }

  /* 4. fichiers de l'application */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(c => c || fetch(req).then(r => garder(APP, req, r)))
    );
  }
});

/* message envoye par la page pour connaitre le poids du cache photos */
self.addEventListener('message', async e => {
  if (e.data === 'taille-cache') {
    let n = 0;
    try { n = (await (await caches.open(MEDIA)).keys()).length; } catch (err) {}
    e.source.postMessage({ photos: n });
  }
  if (e.data === 'vider-photos') {
    await caches.delete(MEDIA);
    e.source.postMessage({ photos: 0 });
  }
});
