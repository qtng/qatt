/*
The visit counter of QATT notes (apps/notes/): the same numbers as js/navigation.js counts for the website (tools/db/visits.sql, tools/db/page_views.sql in the
private repository), because the app does not load navigation.js. It shares localStorage "qv" and "qv_off" and the session with the site (same origin), so a visitor
who uses the site and the app counts once a day, and an admin is not counted. Only numbers: no cookie, no id; the page is /apps/notes/, the language, the kind of
device by the width, a rough region by the time zone. It counts once the app is used (tap, key, wheel), not for bots, only on qatt.org; offline the call is lost.
*/
(() => {
  try {
    if (location.hostname !== 'qatt.org' || navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|python|curl|wget|httpclient|java\//i.test(navigator.userAgent)) return;
    const SUPABASE = 'https://kfgqhhmdzboszpwsqkxt.supabase.co', KEY = 'sb_publishable_99iUsu3_BQ6mp1TbZUEWlw_iVhDJhPi';
    const PAUSE = 30 * 60 * 1000, EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
    const read = () => { try { return JSON.parse(localStorage.getItem('qv')) || {}; } catch (e) { return {}; } };
    const write = s => { try { localStorage.setItem('qv', JSON.stringify(s)); } catch (e) { /* no storage */ } };
    const kind = () => {
      try {
        const u = (JSON.parse(localStorage.getItem('sb-kfgqhhmdzboszpwsqkxt-auth-token')) || {}).user;
        if (u && u.app_metadata && u.app_metadata.is_admin === true) { try { localStorage.setItem('qv_off', '1'); } catch (e) { /* as above */ } return 'admin'; }
        return u && u.is_anonymous === false ? 'account' : 'anonymous';
      } catch (e) { return 'anonymous'; }
    };
    const view = () => {
      const lang = window.Lang && (Lang.current === 'en' || Lang.current === 'vi') ? Lang.current : 'other';
      const w = innerWidth, device = w < 768 ? 'phone' : w < 1200 ? 'tablet' : 'desktop';
      let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* none */ }
      const region = /^Asia\/(Ho_Chi_Minh|Saigon)$/.test(zone) ? 'vietnam' : /^Asia\//.test(zone) ? 'asia' : /^Europe\//.test(zone) ? 'europe' : /^America\//.test(zone) ? 'americas'
        : /^Africa\//.test(zone) ? 'africa' : /^(Australia|Pacific)\//.test(zone) ? 'oceania' : 'other';
      return { p_site: 'qatt.org', p_page: '/apps/notes/', p_lang: lang, p_device: device, p_region: region };
    };
    const count = e => {
      if (e && e.isTrusted === false) return;
      EVENTS.forEach(ev => removeEventListener(ev, count));
      const s = read(), now = Date.now(), today = new Date().toISOString().slice(0, 10);
      const newVisitor = s.d !== today, newVisit = newVisitor || !s.t || now - s.t > PAUSE;
      write({ d: today, t: now });
      const k = kind();
      if (k === 'admin') return;
      const call = (fn, body) => fetch(SUPABASE + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).catch(() => {});
      call('count_view', view());
      if (newVisit) call('count_visit', { p_site: 'qatt.org', p_kind: k, p_new_visitor: newVisitor });
    };
    if (kind() === 'admin' || localStorage.getItem('qv_off')) return;
    EVENTS.forEach(e => addEventListener(e, count, { passive: true }));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'hidden') return;
      const s = read();
      if (s.d) { s.t = Date.now(); write(s); }
    });
  } catch (e) { /* the counter must never disturb the app */ }
})();
