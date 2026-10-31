/*
Service worker of QATT notes (apps/notes/): the app works offline.
Raise CACHE when a file of PRECACHE changes (a new name = a new cache; the old ones are deleted when the new worker takes over, the open page keeps what it has and the next start uses the new files).
Keep PRECACHE equal to what index.html loads (a test compares them).
  - the files of PRECACHE: from the cache, renewed in the background
  - decodings.json: from the network first (a changed table arrives without an app update), the stored copy offline
  - ime.js of chunom.org (Telex), its dictionaries (the Chữ Nôm candidates) are cached the first time they load, and at install if the network allows
*/
const CACHE = 'qatt-notes-v34';
const IME = 'https://chunom.org/chunom/js/ime.js';
const CHUNOM = [IME, 'https://chunom.org/chunom/js/generated_chars.json', 'https://chunom.org/chunom/js/base_chars.json'];
const NOM_NA_TONG = 'https://chunom.org/chunom-assets/fonts/nomnatong-supplement.woff2';   // 8 MB: cached when a character needs it, not at install
// the Nôm fonts never change: cached for ever, the two small ones at install, the big one when first needed
const NOM_FONTS = ['https://chunom.org/chunom-assets/fonts/hannom-gothic-supplement.woff2', 'https://chunom.org/chunom-assets/fonts/nomkhai-supplement.woff2', NOM_NA_TONG];
const FOREVER = 'nom-fonts';   // survives every app version (the name does not start with qatt-notes-): the files never change, so each is fetched once and never checked again
const PAGE = '/apps/notes/';
const PRECACHE = [
  PAGE, '/apps/notes/notes.css', '/apps/notes/notes.js', '/apps/notes/notes-core.js', '/apps/notes/notes-db.js', '/apps/notes/notes-styles.js', '/apps/notes/lang.js', '/apps/notes/notes-stats.js',
  '/apps/notes/manifest.webmanifest', '/apps/notes/icons/icon-192.png', '/apps/notes/icons/icon-512.png', '/apps/notes/icons/maskable-512.png',
  '/js/parser.js', '/js/fonts.js', '/js/qatt-text.js', '/apps/notes/notes-editor.js',
  '/vendor/bootstrap-icons/bootstrap-icons.min.css', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  '/fonts/qatt-pen-medium.woff2', '/fonts/qatt-serif.woff2', '/fonts/qatt-gothic.woff2', '/fonts/qatt-gothic-wide.woff2', '/fonts/qatt-hat-gao.woff2', '/fonts/qatt-snip.woff2', '/fonts/qatt-manh.woff2', '/fonts/qatt-metro.woff2', '/fonts/qatt-n7k.woff2', '/fonts/qatt-phong-thao.woff2',
  '/decodings.json',
];

// the caches of earlier versions of this app
const staleCaches = (keys, current) => keys.filter(k => k.startsWith('qatt-notes-') && k !== current);
if (typeof module !== 'undefined') module.exports = { CACHE, PRECACHE, IME, CHUNOM, NOM_FONTS, FOREVER, staleCaches };

if (typeof ServiceWorkerGlobalScope !== 'undefined' && self instanceof ServiceWorkerGlobalScope) {
  const keyOf = req => {
    const url = new URL(req.url);
    return req.mode === 'navigate' || url.pathname === '/apps/notes/index.html' ? PAGE : req;
  };
  const known = req => {
    const url = new URL(req.url);
    if (CHUNOM.includes(req.url)) return true;
    if (url.origin !== location.origin) return false;
    if (req.mode === 'navigate') return url.pathname === PAGE || url.pathname === '/apps/notes/index.html';
    return /^\/fonts\/[\w.-]+\.(woff2|ttf)$/.test(url.pathname) || PRECACHE.some(p => p.split('?')[0] === url.pathname);   // the other fonts (admins) are cached when they load
  };

  self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async url => {
      const res = await fetch(new Request(url, { cache: 'reload' }));
      if (!res.ok) throw new Error(url + ' ' + res.status);
      await cache.put(url, res);
    }));
    await Promise.all(CHUNOM.map(async url => {
      try { const res = await fetch(new Request(url, { cache: 'reload', mode: 'cors' })); if (res.ok) await cache.put(url, res); } catch (e) { /* cached when the page loads it */ }
    }));
    try {
      const forever = await caches.open(FOREVER);
      await Promise.all(NOM_FONTS.filter(u => u !== NOM_NA_TONG).map(async url => {
        if (await forever.match(url)) return;
        const old = await caches.match(url);
        if (old) return forever.put(url, old);
        const res = await fetch(new Request(url, { mode: 'cors' }));
        if (res.ok) await forever.put(url, res);
      }));
    } catch (e) { /* cached when the page loads them */ }
    await self.skipWaiting();
  })()));

  self.addEventListener('activate', event => event.waitUntil((async () => {
    try {   // a copy the earlier versions already hold moves to the permanent cache instead of being downloaded again
      const forever = await caches.open(FOREVER);
      for (const url of NOM_FONTS) if (!(await forever.match(url))) { const old = await caches.match(url); if (old) await forever.put(url, old); }
    } catch (e) { /* downloaded when needed */ }
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
    if (NOM_FONTS.includes(req.url)) {   // cache first, for ever: no check for a new version, no download again
      event.respondWith((async () => {
        const forever = await caches.open(FOREVER);
        const hit = await forever.match(req.url);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) forever.put(req.url, res.clone());
        return res;
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
