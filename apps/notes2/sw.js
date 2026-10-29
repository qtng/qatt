/*
Service worker of QATT notes (apps/notes2/): the app works offline.
Raise CACHE when a file of PRECACHE changes (a new name = a new cache; the old ones are deleted when the new worker takes over, the open page keeps what it has and the next start uses the new files).
Keep PRECACHE equal to what index.html loads (a test compares them).
  - the files of PRECACHE: from the cache, renewed in the background
  - decodings.json: from the network first (a changed table arrives without an app update), the stored copy offline
  - ime.js of chunom.org (Telex) is cached the first time it loads, and at install if the network allows
*/
const CACHE = 'qatt-notes2-v1';
const IME = 'https://chunom.org/chunom/js/ime.js';
const PAGE = '/apps/notes2/';
const PRECACHE = [
  PAGE, '/apps/notes2/notes.css', '/apps/notes2/notes.js', '/apps/notes2/notes-core.js', '/apps/notes2/notes-db.js', '/apps/notes2/notes-styles.js', '/apps/notes2/lang.js',
  '/apps/notes2/manifest.webmanifest', '/apps/notes2/icons/icon-192.png', '/apps/notes2/icons/icon-512.png', '/apps/notes2/icons/maskable-512.png',
  '/js/parser.js', '/js/fonts.js', '/js/qatt-text.js', '/apps/notes2/notes-editor.js', '/apps/notes2/ce-adapter.js',
  '/vendor/bootstrap-icons/bootstrap-icons.min.css', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  '/fonts/qatt-pen-medium.woff2?v=6', '/fonts/qatt-serif.woff2?v=6', '/fonts/qatt-gothic.woff2?v=6', '/fonts/qatt-gothic-wide.woff2?v=6',
  '/decodings.json',
];

// the caches of earlier versions of this app
const staleCaches = (keys, current) => keys.filter(k => k.startsWith('qatt-notes2-') && k !== current);
if (typeof module !== 'undefined') module.exports = { CACHE, PRECACHE, IME, staleCaches };

if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  const keyOf = req => {
    const url = new URL(req.url);
    return req.mode === 'navigate' || url.pathname === '/apps/notes2/index.html' ? PAGE : req;
  };
  const known = req => {
    const url = new URL(req.url);
    if (req.url === IME) return true;
    if (url.origin !== location.origin) return false;
    if (req.mode === 'navigate') return url.pathname === PAGE || url.pathname === '/apps/notes2/index.html';
    return /^\/fonts\/[\w.-]+\.(woff2|ttf)$/.test(url.pathname) || PRECACHE.some(p => p.split('?')[0] === url.pathname);   // the other fonts (admins) are cached when they load
  };

  self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async url => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res);
    }));
    try { const res = await fetch(new Request(IME, { cache: 'reload', mode: 'cors' })); if (res.ok) await cache.put(IME, res); } catch (e) { /* cached when the page loads it */ }
    await self.skipWaiting();
  })()));

  self.addEventListener('activate', event => event.waitUntil((async () => {
    for (const key of staleCaches(await caches.keys(), CACHE)) await caches.delete(key);
    await self.clients.claim();
  })()));

  self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin === location.origin && url.pathname === '/decodings.json') {
      event.respondWith((async () => {
        const cache = await caches.open(CACHE);
        try { const res = await fetch(req); if (res.ok) cache.put(url.pathname, res.clone()); return res; }
        catch (e) { return (await cache.match(url.pathname)) || Response.error(); }
      })());
      return;
    }
    if (!known(req)) return;
    event.respondWith((async () => {
      const cache = await caches.open(CACHE), key = keyOf(req);
      const hit = await cache.match(key, { ignoreSearch: true });
      const refresh = fetch(req).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });
      if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
      return refresh;
    })());
  });
}
