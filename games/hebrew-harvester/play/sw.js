// Offline support for the installed app: pages are fetched fresh when online, assets are cached as they load.
const CACHE = 'hebrew-harvester-v14';

const ARCADE = [
  './arcade/embed.js',
  './arcade/embed.css',
  './arcade/site.css',
  './arcade/audio.js',
  './arcade/scores.js',
  './arcade/manna-mover/index.html',
  './arcade/babel-builder/index.html',
  './arcade/passover-pillage/index.html',
  './arcade/temple-throwdown/index.html',
  './arcade/davids-defenders/index.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon.svg', './ey-logo.png', ...ARCADE])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isAppStart(url) {
  return !url.pathname.includes('/arcade/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    const start = isAppStart(url);
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(start ? './' : req, copy));
          return res;
        })
        .catch(() => caches.match(start ? './' : req).then((hit) => hit || caches.match('./'))),
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
