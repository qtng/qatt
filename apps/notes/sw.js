/*
Service worker of QATT notes (apps/notes/): the app works offline.
Raise CACHE when a file of PRECACHE changes (a new name = a new cache; the old ones are deleted when the new worker takes over, the open page keeps what it has and the next start uses the new files).
Keep PRECACHE equal to what index.html loads (a test compares them).
  - the files of PRECACHE: from the cache, renewed in the background
  - decodings.json: from the network first (a changed table arrives without an app update), the stored copy offline
  - ime.js of chunom.org (Telex), its dictionaries (the Chữ Nôm candidates) are cached the first time they load, and at install if the network allows
*/
const CACHE = 'qatt-notes-v70';
const IME = 'https://chunom.org/chunom/js/ime.js';
// the Latin of the fonts that have a big font (js/fonts.js, big): the text field shows Latin in them (qattFieldFont), also offline
const CDN = 'https://cdn.jsdelivr.net/gh/qtng/cdn@main/fonts/';   // the font files (js/fonts.js, QATT_CDN: this address first, then CDN_PAGES)
const CDN_PAGES = 'https://chunom.org/cdn/fonts/';   // jsDelivr answers an uncached file of that repository with a 403 now and then (more than 50 MB), so the page and the install take this address next
const LATIN = ['qatt-pen', 'qatt-pen-thin', 'qatt-pen-light', 'qatt-pen-medium', 'migoi', 'celluloid', 'phongthao'].map(n => `${CDN}web/${n}-latin.woff2`);
const CHUNOM = [IME, 'https://chunom.org/chunom/js/generated_chars.json', 'https://chunom.org/chunom/js/base_chars.json', ...LATIN];
const NOM_NA_TONG = 'https://chunom.org/chunom-assets/fonts/nomnatong-supplement.woff2?v=2'; // 8 MB (?v=2: the first file had wrong vertical metrics; a copy kept for ever needs a new address): cached when a character needs it, not at install
// the Nôm fonts never change: cached for ever, the two small ones at install, the big one when first needed
// the CJK of QATT Pen, Migoi, Celluloid, Phong Thảo: small slices (js/fonts.js), each cached in CACHE when the page first needs it, like the other fonts of qtng/cdn
const CJK_SLICES = /^https:\/\/(?:cdn\.jsdelivr\.net\/gh\/qtng\/cdn@main|chunom\.org\/cdn)\/fonts\/(?:web\/)?[\w.-]+\.woff2(?:\?v=[\w%.-]+)?$/;   // every font file of qtng/cdn, from either address, with the version of js/fonts.js (?v=<date of the font>) or without
const OLD_FOREVER = ['https://chunom.org/chunom-assets/fonts/qatt-pen.woff2?v=2', 'https://chunom.org/chunom-assets/fonts/qatt-pen.woff2?v=3'];   // the whole font before the slices: removed from the permanent cache
const NOM_FONTS = ['https://chunom.org/chunom-assets/fonts/hannom-gothic-supplement.woff2', 'https://chunom.org/chunom-assets/fonts/nomkhai-supplement.woff2', NOM_NA_TONG];
const FOREVER = 'nom-fonts';   // survives every app version (the name does not start with qatt-notes-): the files never change, so each is fetched once and never checked again
const PAGE = '/apps/notes/';
const PRECACHE = [
  PAGE, '/apps/notes/notes.css', '/apps/notes/notes.js', '/apps/notes/notes-core.js', '/apps/notes/notes-db.js', '/apps/notes/notes-styles.js', '/apps/notes/lang.js', '/apps/notes/notes-stats.js',
  '/apps/notes/manifest.webmanifest', '/apps/notes/icons/icon-192.png', '/apps/notes/icons/icon-512.png', '/apps/notes/icons/maskable-512.png',
  '/js/parser.js', '/js/fonts.js', '/js/qatt-text.js', '/apps/notes/notes-editor.js',
  '/vendor/bootstrap-icons/bootstrap-icons.min.css', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff2', '/vendor/bootstrap-icons/fonts/bootstrap-icons.woff',
  ...['qatt-pen-letters.woff2', 'qatt-pen-medium-letters.woff2', 'celluloid-letters.woff2', 'migoi-letters.woff2', 'qatt-serif.woff2', 'qatt-gothic.woff2', 'qatt-gothic-wide.woff2', 'qatt-hat-gao.woff2', 'qatt-snip.woff2', 'qatt-manh.woff2', 'qatt-metro.woff2', 'qatt-n7k.woff2', 'phongthao-letters.woff2'].map(n => CDN + n),
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
    if (CHUNOM.includes(req.url) || CJK_SLICES.test(req.url)) return true;
    if (url.origin !== location.origin) return false;
    if (req.mode === 'navigate') return url.pathname === PAGE || url.pathname === '/apps/notes/index.html';
    return PRECACHE.some(p => p.split('?')[0] === url.pathname);   // the other fonts (admins) are cached when they load
  };

  self.addEventListener('install', event => event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(PRECACHE.map(async url => {
      let res = await fetch(new Request(url, { cache: 'reload' })).catch(() => null);
      if ((!res || !res.ok) && url.startsWith(CDN)) res = await fetch(new Request(CDN_PAGES + url.slice(CDN.length), { cache: 'reload' }));   // kept under the first address: the page asks for that one first
      if (!res || !res.ok) throw new Error(url + ' ' + (res && res.status));
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
      await forever.delete('https://chunom.org/chunom-assets/fonts/nomnatong-supplement.woff2');   // the first file (wrong vertical metrics), replaced by ?v=2
      for (const url of OLD_FOREVER) await forever.delete(url);
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
      const font = CJK_SLICES.test(req.url);
      if (font && req.url.includes('?v=')) {   // a font file with its version: a new date is a new address, so cache first and never asked again; the copies of older versions of it go
        const hit = await cache.match(req.url);
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res.ok) {
            const path = req.url.split('?')[0];
            for (const k of await cache.keys()) if (k.url !== req.url && k.url.split('?')[0] === path) await cache.delete(k);
            cache.put(req.url, res.clone());
          }
          return res;
        } catch (e) { const old = await cache.match(req.url.split('?')[0]); if (old) return old; throw e; }   // offline: the copy without a version
      }
      const hit = await cache.match(key, { ignoreSearch: !font });
      const refresh = fetch(new Request(req, { cache: 'no-cache' })).then(res => { if (res.ok) cache.put(key, res.clone()); return res; });   // no-cache: asks the server (a 304 costs nothing) even when the HTTP cache still holds the file (jsDelivr: 7 days), so a new font is there at the next start
      if (hit) { event.waitUntil(refresh.catch(() => {})); return hit; }
      return refresh;
    })());
  });
}
