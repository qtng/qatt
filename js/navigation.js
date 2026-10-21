// Menu bar of both sites, with the translation (Lang). One file for qatt.org and the Chunom site: it lives in qtng/qatt (served at qatt.org/js/navigation.js)
// and the pages of the Chunom site load it from there (https://qatt.org/js/navigation.js).
// The two sites are separate: the links to the other site are absolute, the links of the site of the page start at the root.
// Load it early in <head> as a normal (not defer) script, so that Lang translates the page while it is parsed.

// ---------- Lang: the translation of a page ----------
// The language is localStorage.lang ("en" or "vi") if it was chosen (the switch in the menu bar, license.html, or ?lang=vi in the address), else the first of English and
// Vietnamese in the languages of the browser (vi only if it comes before en). It is not stored until somebody chooses it.
// In vi every tag that has data-vi and no tags inside gets the text of data-vi as its text content; the English text is kept and comes back in en.
// A MutationObserver does it for the tags of the page while it is parsed and for every tag that JavaScript adds or changes later.
//   Lang.current        "en" or "vi"
//   Lang.set("vi")      choose and remember a language, the page changes at once; the event "langchange" is sent to the document
//   Lang.t("Next", "Tiếp")   the text for the language, for texts that are not in a tag of their own
// Attributes: data-vi-label, data-vi-title, data-vi-placeholder, data-vi-aria-label give the attribute without data-vi- (e.g. the label of an <optgroup>) its text in vi.
window.Lang = window.Lang || (function() {
    const KEY = "lang";
    const valid = l => l === "en" || l === "vi";
    const stored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
    const store = l => { try { localStorage.setItem(KEY, l); } catch (e) {} };
    const detect = () => {
        for (const l of navigator.languages || [navigator.language || "en"]) {
            const primary = String(l).toLowerCase().split("-")[0];
            if (valid(primary)) return primary;
        }
        return "en";
    };
    const asked = new URLSearchParams(location.search).get("lang");
    if (valid(asked)) store(asked);
    // a page can ask for its language: <html data-page-lang="vi"> (the Vietnamese copy of the homepage, vi.html, for a visitor from a search)
    const pageLang = document.documentElement.getAttribute("data-page-lang");
    if (valid(pageLang)) store(pageLang);   // visiting vi.html switches the site to Vietnamese (EN there goes to index.html in English)
    let current = valid(stored()) ? stored() : detect();

    const states = new WeakMap();   // per tag: the English text and the text shown last (to tell a change of the page from our own change)
    const waiting = new Set();      // tags the parser may not have finished (no tag after them yet)
    const apply = el => {
        if (!el.hasAttribute("data-vi")) return;
        if (el.children.length) return;   // tags inside: not translated (the rule: data-vi only on tags without tags inside)
        const text = el.textContent;
        if (text === "") return;          // not filled yet: the change of its content will come
        if (document.readyState === "loading" && !el.nextSibling) { waiting.add(el); return; }   // the parser may still be writing its text
        waiting.delete(el);
        let st = states.get(el);
        if (!st) states.set(el, st = { en: text, shown: text });
        else if (text !== st.shown) st.en = text;   // a new text from the page: the English one
        const want = current === "vi" ? el.getAttribute("data-vi") : st.en;
        if (text !== want) el.textContent = want;
        st.shown = want;
    };
    const ATTRS = ["label", "title", "placeholder", "aria-label"];
    const attrStates = new WeakMap();   // per tag and attribute: the English value and the value shown last
    const applyAttr = (el, name) => {
        const vi = el.getAttribute("data-vi-" + name), cur = el.getAttribute(name);
        if (vi === null || cur === null) return;
        let sts = attrStates.get(el);
        if (!sts) attrStates.set(el, sts = {});
        let st = sts[name];
        if (!st) sts[name] = st = { en: cur, shown: cur };
        else if (cur !== st.shown) st.en = cur;
        const want = current === "vi" ? vi : st.en;
        if (cur !== want) el.setAttribute(name, want);
        st.shown = want;
    };
    const applyAll = el => { apply(el); ATTRS.forEach(a => applyAttr(el, a)); };
    const SELECTOR = ["data-vi", ...ATTRS.map(a => "data-vi-" + a)].map(a => `[${a}]`).join(",");
    const all = root => {
        if (root.nodeType !== 1 && root.nodeType !== 9) return;
        if (root.nodeType === 1) applyAll(root);
        root.querySelectorAll(SELECTOR).forEach(applyAll);
    };
    const flush = () => { for (const el of [...waiting]) if (el.nextSibling || document.readyState !== "loading") apply(el); };
    new MutationObserver(records => {
        for (const r of records) {
            if (r.type === "attributes") {
                const name = r.attributeName.replace(/^data-vi-/, "");
                if (ATTRS.includes(name)) applyAttr(r.target, name); else apply(r.target);
            }
            else if (r.type === "characterData") r.target.parentElement && apply(r.target.parentElement);
            else {
                if (r.target.nodeType === 1) apply(r.target);   // its content changed
                r.addedNodes.forEach(all);
            }
        }
        flush();
    }).observe(document, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-vi", ...ATTRS, ...ATTRS.map(a => "data-vi-" + a)] });
    document.addEventListener("DOMContentLoaded", () => { flush(); all(document); });

    const setLang = l => {
        if (!valid(l)) return;
        store(l);
        current = l;
        document.documentElement.lang = l;
        all(document);
        document.dispatchEvent(new CustomEvent("langchange", { detail: l }));
    };
    if (current === "vi") document.documentElement.lang = "vi";
    return { get current() { return current; }, set: setLang, t: (en, vi) => current === "vi" ? vi : en, valid };
})();

// ---------- the menu ----------
// ---------- Theme: the look of the pages ----------
// localStorage.theme1 (a key of Theme.list, e.g. "classic", "retro", "popart"; chosen with the palette button next to EN | VI, in license.html, or ?theme=<name>) says which file
// css/theme-<name>.css of qatt.org is part of the page. Every theme is a complete file of its own, none builds on or overrides another; the pages only have their layout
// (css/site.css has what all themes share). The file is written into the <head> while the page is parsed (document.write, so that the page is not drawn without it)
// and data-theme is set on <html> (the themes other than classic need it to be more specific than the pages).
// qatt.org: every page. The Chunom site: the pages under /chunom/ load the theme from qatt.org (they link https://qatt.org/css/site.css themselves) and have the
// skeleton of qatt.org, so a theme can be chosen there too (stored per site, like the login: localStorage is per origin); CHUNOM_THEMES = false would keep them "classic".
// The landing pages (/pages/) and the assets have no theme.
//   Theme.list          {name: [English, Tiếng Việt]}
//   Theme.current       the name of the theme
//   Theme.choosable     whether a theme can be chosen on this page
//   Theme.set("popart") choose and remember a theme, the page changes at once; the event "themechange" is sent to the document
// Day and night (where a theme can be chosen): by the clock of the visitor it is night from NIGHT_START to DAY_START o'clock (22:00 to 06:00, in Vietnam 18:00 to 06:00, see NIGHT_RULES) and the theme "nocturne" is shown instead of the chosen one.
// The icon in the menu bar (sun by day, moon by night) switches by hand; that choice lasts only until the next change between day and night: localStorage.daynight1 =
// {"mode":"day"|"night","key":"2026-10-21n"} (key: the date the period began and d/n; a night that began yesterday evening is still "yesterday n"), void when the key is no longer the current one.
//   Theme.dayNight      { available, night (is the night theme shown by the clock or the choice), toggle() }; the event "daynightchange" is sent to the document
window.Theme = window.Theme || (function() {
    const KEY = "theme1";   // the key was "theme" before: a new key, so that the choices made earlier no longer count (the default theme is bohemian now)
    const list = { classic: ["Classic", "Cổ điển"], retro: ["Retro", "Retro"], popart: ["Pop art", "Pop art"], editorial: ["Editorial", "Tạp chí"], swiss: ["Swiss", "Thụy Sĩ"],
        glass: ["Glassmorphism", "Kính mờ"], clay: ["Clay", "Đất sét"], boho: ["Bohemian", "Bohemian"], pixel: ["Pixel art", "Pixel art"], vector: ["Vector art", "Vector art"], future: ["Futuristic", "Tương lai"],
        neobrutal: ["Neobrutalism", "Tân thô mộc"], vietnam: ["Modern Vietnam", "Việt Nam hiện đại"], nocturne: ["Nocturne", "Đêm khuya"] };
    const onChunom = /(^|\.)chunom\.org$/.test(location.hostname) || /^\/(chunom|pages|chunom-assets)\//.test(location.pathname);
    const CHUNOM_THEMES = true;
    const themed = !onChunom || /^\/chunom\//.test(location.pathname);
    const choosable = themed && (!onChunom || CHUNOM_THEMES);
    const base = onChunom ? "https://qatt.org" : "";
    let chosen = onChunom ? (CHUNOM_THEMES ? "boho" : "classic") : "popart";   // the theme of a visitor who has not chosen one: bohemian on the Chunom site, pop art on qatt.org
    const valid = s => Object.prototype.hasOwnProperty.call(list, s);
    if (choosable) try { const s = localStorage.getItem(KEY); if (valid(s)) chosen = s; } catch (e) {}
    // day and night: night is from NIGHT_START to DAY_START o'clock (the clock of the visitor); then the theme NIGHT_THEME is shown instead of the chosen one
    // the hours of the night: 22:00 to 06:00 is night everywhere; for the main audience (Vietnam: the sun sets between 17:30 and 18:30 all year) it is more exact: 18:00 to 06:00.
    // Rules by time zone of the browser (the name as Intl gives it; Asia/Saigon is the older name of Asia/Ho_Chi_Minh); start must be later than end.
    const DAY_KEY = "daynight1", NIGHT_THEME = "nocturne";
    const NIGHT_DEFAULT = { start: 22, end: 6 };
    const NIGHT_RULES = { "Asia/Ho_Chi_Minh": { start: 18, end: 6 }, "Asia/Saigon": { start: 18, end: 6 } };
    let zone = ""; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
    const NIGHT_START = (NIGHT_RULES[zone] || NIGHT_DEFAULT).start, DAY_START = (NIGHT_RULES[zone] || NIGHT_DEFAULT).end;
    const autoNight = choosable;
    let pinned = false;   // ?theme=<name> in the address: that theme is shown on this page whatever the time
    const pad = n => String(n).padStart(2, "0");
    const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    // the period of a moment: night (and the key of it: the date the period began, n or d)
    const phase = d => {
        const h = d.getHours();
        if (h >= NIGHT_START) return { night: true, key: ymd(d) + "n" };
        if (h < DAY_START) { const y = new Date(d); y.setDate(y.getDate() - 1); return { night: true, key: ymd(y) + "n" }; }
        return { night: false, key: ymd(d) + "d" };
    };
    const override = () => { try { const o = JSON.parse(localStorage.getItem(DAY_KEY)); return o && (o.mode === "day" || o.mode === "night") && typeof o.key === "string" ? o : null; } catch (e) { return null; } };
    // night now: the manual choice while it is of this period (same key), else the clock
    const isNight = () => { const p = phase(new Date()), o = override(); return o && o.key === p.key ? o.mode === "night" : p.night; };
    const pick = () => autoNight && !pinned && isNight() ? NIGHT_THEME : chosen;
    let current = pick();
    // ?theme=<name> in the address (license.html sends a visitor back with it): chosen and remembered where themes can be chosen, else only shown on this page
    // (a preview); the parameter is taken out of the address
    const params = new URLSearchParams(location.search), asked = params.get("theme");
    if (asked !== null) {
        if (themed && valid(asked)) { chosen = current = asked; pinned = true; if (choosable) try { localStorage.setItem(KEY, asked); } catch (e) {} }
        params.delete("theme");
        try { history.replaceState(history.state, "", location.pathname + (params.toString() ? "?" + params : "") + location.hash); } catch (e) {}
    }
    const href = () => base + "/css/theme-" + current + ".css";
    const apply = () => {
        if (!themed) return;
        if (current === "classic") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", current);
        const link = document.getElementById("theme-css");
        if (link) link.setAttribute("href", href());
    };
    if (themed) {
        if (document.readyState === "loading") document.write('<link rel="stylesheet" id="theme-css" href="' + href() + '">');
        else { const l = document.createElement("link"); l.rel = "stylesheet"; l.id = "theme-css"; l.href = href(); document.head.append(l); }
        apply();
    }
    // show what the clock and the choices say now; the events tell the menu bar
    const update = () => {
        current = pick();
        apply();
        document.dispatchEvent(new Event("themechange"));
        document.dispatchEvent(new Event("daynightchange"));
    };
    // a manual choice of day or night holds until the next change between them (the key of the period is stored with it)
    const setOverride = mode => {
        const p = phase(new Date());
        try { if (mode === (p.night ? "night" : "day")) localStorage.removeItem(DAY_KEY); else localStorage.setItem(DAY_KEY, JSON.stringify({ mode, key: p.key })); } catch (e) {}
    };
    if (autoNight) {
        // the next change between day and night: switch then (a sleeping tab catches up when it is shown again)
        const nextChange = () => {
            const d = new Date(), t = new Date(d); t.setMinutes(0, 0, 0);
            if (d.getHours() < DAY_START) t.setHours(DAY_START);
            else if (d.getHours() < NIGHT_START) t.setHours(NIGHT_START);
            else { t.setDate(t.getDate() + 1); t.setHours(DAY_START); }
            return t - d;
        };
        const arm = () => setTimeout(() => { update(); arm(); }, nextChange() + 500);
        arm();
        document.addEventListener("visibilitychange", () => { if (!document.hidden && pick() !== current) update(); });
        window.addEventListener("storage", e => { if (e.key === DAY_KEY) update(); });
    }
    return {
        list,
        get current() { return current; },
        get choosable() { return choosable; },
        set(name) {
            if (!choosable || !Object.prototype.hasOwnProperty.call(list, name)) return;
            chosen = name; pinned = false;
            try { localStorage.setItem(KEY, name); } catch (e) {}
            if (autoNight && name !== NIGHT_THEME && isNight()) setOverride("day");   // a theme chosen at night is shown
            update();
        },
        dayNight: {
            get available() { return autoNight; },
            get night() { return autoNight && !pinned && isNight(); },
            toggle() {
                if (!autoNight) return;
                const to = isNight() && !pinned ? "day" : "night";
                pinned = false;
                setOverride(to);
                update();
            }
        }
    };
})();

(function() {
    const CHUNOM_SITE = "https://chunom.org";
    const QATT_SITE = "https://qatt.org";
    // the site of this page: the Chunom site (chunom.org, the folders /chunom/, /pages/, /chunom-assets/) or qatt.org
    const onChunom = /(^|\.)chunom\.org$/.test(location.hostname) || /^\/(chunom|pages|chunom-assets)\//.test(location.pathname);
    const qattBlock = {
        header: "Quốc Âm Tân Tự (QATT)",
        themeClass: "text-info",
        linkClass: "link-qatt",
        site: onChunom ? QATT_SITE : "",
        links: [
            { name: "Qatt.org home", vi: "Trang chủ Qatt.org", bar: "Home", barOrder: 1, barVi: "Trang chủ", url: "/index.html", icon: "bi-house" },
            { name: "QATT writer", vi: "Gõ chữ QATT", bar: "Write", barOrder: 3, barVi: "Gõ chữ", url: "/editor.html", icon: "bi-pencil-square" },
            { name: "Spell it!", vi: "Đánh vần!", bar: "Spell it!", barOrder: 4, barVi: "Đánh vần!", url: "/spell.html", icon: "bi-mortarboard" },
            { name: "Symbols", vi: "Bảng chữ", bar: "Symbols", barOrder: 2, barVi: "Bảng chữ", url: "/symbols.html", icon: "bi-book" },
            { name: "Decodings", vi: "Giải mã", url: "/decodings.html", icon: "bi-puzzle" },
            { name: "Unicode", url: "/unicode.html", icon: "bi-fonts" },
            { name: "Wiki", url: "/wiki.html", icon: "bi-wikipedia" },
        ]
    };
    const nomBlock = {
        header: "Chữ Nôm",
        themeClass: "text-warning",
        linkClass: "link-nom",
        site: onChunom ? "" : CHUNOM_SITE,
        links: [
            { name: "Chunom.org home", vi: "Trang chủ Chunom.org", bar: "Home", barVi: "Trang chủ", barOrder: 1, url: "/chunom/index.html", icon: "bi-house" },
            { name: "Practice / decks", vi: "Luyện tập / Bộ thẻ", bar: "Practice", barVi: "Luyện tập", barOrder: 4, url: "/chunom/decks/index.html", icon: "bi-mortarboard" },
            { name: "Chữ Nôm writer", vi: "Gõ chữ Nôm", bar: "Write", barVi: "Gõ chữ", barOrder: 3, url: "/chunom/writer.html", icon: "bi-pencil-square" },
            { name: "Nôm converter", vi: "Bộ chuyển đổi", bar: "Translate", barVi: "Dịch", barOrder: 2, url: "/chunom/translate.html", icon: "bi-translate" },
            { name: "Dictionary: Génibrel 1898", vi: "Từ điển: Génibrel 1898", url: "/chunom/dict/genibrel.html", icon: "bi-book" },
            { name: "Dictionary: Bonet 1899", vi: "Từ điển: Bonet 1899", url: "/chunom/dict/bonet.html", icon: "bi-book" },
        ]
    };
    // what differs between the sites: brand, logo, icons, the colour of the bottom bar; own block first
    const navConfig = onChunom ? {
        title: "Chunom.org",
        home: "/chunom/",
        own: "link-nom",
        accent: "var(--bs-warning)",
        license: QATT_SITE + "/license.html",
        logo: "/chunom/img/chunom-logo.png", // without a background of its own: the bar shows through (its tint in a theme)
        icons: `<link rel="icon" type="image/svg+xml" href="/chunom/img/chunom-favicon.svg">
                <link rel="icon" type="image/png" sizes="32x32" href="/chunom/img/chunom-favicon-32.png">
                <link rel="apple-touch-icon" href="/chunom/img/chunom-apple-touch-icon.png">`,
        brand: (logo, title, menu) => `<img src="${logo}" alt="${title}" height="${menu ? 34 : 42}" style="width:auto;border-radius:4px">`,
        sections: [nomBlock, qattBlock]
    } : {
        title: "Qatt.org",
        home: "/index.html",
        own: "link-qatt",
        accent: "var(--bs-info)",
        license: "/license.html",
        logo: "/img/logo.svg",
        icons: `<link rel="icon" type="image/svg+xml" href="/img/favicon.svg">
                <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">`,
        brand: (logo, title, menu) => `<img src="${logo}" alt="" width="${menu ? 28 : 32}" height="${menu ? 28 : 32}">${title}`,
        sections: [qattBlock, nomBlock]
    };

    // the shared libraries (Bootstrap, Bootstrap Icons) come from /vendor next to /js of this script, also when a page of another site loads it
    const vendor = new URL("../vendor/", document.currentScript ? document.currentScript.src : location.href).href;

    function injectDependencies() {
        if (!document.querySelector('link[href*="bootstrap-icons"]')) {
            const icons = document.createElement('link');
            icons.rel = 'stylesheet';
            icons.href = vendor + 'bootstrap-icons/bootstrap-icons.min.css';
            document.head.appendChild(icons);
        }

        if (typeof bootstrap === 'undefined' && !document.querySelector('script[src*="bootstrap"]')) {
            const bsScript = document.createElement('script');
            bsScript.src = vendor + 'bootstrap/js/bootstrap.bundle.min.js';
            document.head.appendChild(bsScript);
        }

        const style = document.createElement('style');
        style.textContent = `
            @media (min-width: 1400px) {
                .container, .container-lg, .container-md, .container-sm, .container-xl, .container-xxl {
                    max-width: 1040px;
                }
            }
            svg { /* global defaults for rendered QATT SVGs */
              stroke-linecap: square;
              stroke-linejoin: square;
            }
            /* the colours of the bars: dark grey; a theme gives them a dark tint of its own (css/theme-*.css: html[data-theme="…"] { --nav-bg: …; }):
               --nav-bg the menu bar and its menus, --nav-bottom-bg the bottom bar of the phone (dark grey with only 22% of the theme tint unless a theme sets it), --nav-alpha how opaque they are,
               --nav-line the line at their edge (a lighter shade of the bar unless a theme sets it) */
            :root { --nav-bg: #212529; --nav-bottom-bg: color-mix(in srgb, var(--nav-bg) 22%, #212529); --nav-alpha: 95%; }
            .nav-backdrop{
              height: 60px; /* the page content starts below it, see the body padding */
              background: color-mix(in srgb, var(--nav-bg) var(--nav-alpha), transparent);
              backdrop-filter: blur(15px);
              border-bottom: 1px solid var(--nav-line, color-mix(in srgb, var(--nav-bg) 72%, #fff));
            }
            /* desktop: the links of the own block in the bar, the other site in a dropdown; below 992px the offcanvas menu and the bottom bar do it */
            .desk-links, .desk-other { display: none; }
            @media (min-width: 992px) {
                #navTogglerCustom { display: none; }
                .desk-links { display: flex; align-items: stretch; gap: .15rem; align-self: stretch; margin: 0 auto 0 .5rem; padding: 0; list-style: none; }
                .desk-other { display: block; position: relative; margin-right: 1rem; }
            }
            .desk-links a, .desk-other > button { display: flex; align-items: center; gap: .4rem; height: 100%; padding: 0 .6rem; color: rgba(255, 255, 255, .65); text-decoration: none; background: none; border: 0; border-bottom: 3px solid transparent; font-size: .92rem; white-space: nowrap; }
            .desk-links a:hover, .desk-other > button:hover { color: #fff; }
            .desk-links a.active { color: #fff; border-bottom-color: var(--bar-accent); }
            .desk-other > button { height: 36px; border: 1px solid rgba(255, 255, 255, .25); border-radius: .4rem; }
            .desk-other .desk-menu { display: none; position: absolute; right: 0; top: calc(100% + .6rem); min-width: 14rem; padding: .4rem 0; background: color-mix(in srgb, var(--nav-bg) 98%, transparent); border: 1px solid rgba(255, 255, 255, .15); border-radius: .5rem; box-shadow: 0 8px 24px rgba(0, 0, 0, .4); }
            .desk-other.open .desk-menu { display: block; }
            .desk-other .desk-menu a { display: flex; align-items: center; gap: .6rem; padding: .45rem 1rem; color: rgba(255, 255, 255, .8); text-decoration: none; font-size: .92rem; }
            .desk-other .desk-menu a:hover { background: rgba(255, 255, 255, .08); color: #fff; }
            @media (max-width: 1199.98px) { .desk-links .dl-text { display: none; } .desk-links a { padding: 0 .75rem; } .desk-links i { font-size: 1.15rem; } }
            .lang-switch { display: flex; align-items: center; gap: .35rem; margin-right: .5rem; color: rgba(255, 255, 255, .35); font-size: .8rem; }
            .lang-switch button { background: none; border: 0; padding: .25rem .15rem; color: rgba(255, 255, 255, .6); font-weight: 600; letter-spacing: .04em; cursor: pointer; }
            .lang-switch button:hover { color: #fff; }
            .lang-switch button.active { color: #fff; text-decoration: underline; text-underline-offset: .3em; }
            /* day and night: a sun or moon left of EN | VI, switches by hand until the next change between day and night */
            .daynight-switch { background: none; border: 0; padding: .25rem .35rem; margin-right: .3rem; color: rgba(255, 255, 255, .6); font-size: 1.05rem; line-height: 1; cursor: pointer; }
            .daynight-switch:hover { color: #fff; }
            .daynight-switch[hidden] { display: none; }
            /* the theme: a palette button next to EN | VI with a small list of the themes */
            .theme-switch { position: relative; margin-right: .4rem; }
            .theme-switch > button { background: none; border: 0; padding: .25rem .35rem; color: rgba(255, 255, 255, .6); font-size: 1.05rem; line-height: 1; cursor: pointer; }
            .theme-switch > button:hover, .theme-switch > button[aria-expanded="true"] { color: #fff; }
            /* what only admins see is bright yellow: the palette button and the shield */
            .admin-link, .theme-switch > button { color: #ffe600 !important; }
            .admin-link:hover, .theme-switch > button:hover, .theme-switch > button[aria-expanded="true"] { color: #fff59d !important; }
            .admin-link { margin-right: .4rem; padding: .25rem .35rem; color: rgba(255, 255, 255, .6); font-size: 1.05rem; line-height: 1; text-decoration: none; }   /* only shown to admins */
            .admin-link:hover { color: #fff; }
            .theme-menu { position: absolute; right: 0; top: calc(100% + .4rem); z-index: 1080; min-width: 11rem; max-height: 70vh; overflow: auto; padding: .3rem; background: var(--nav-bg); border: 1px solid rgba(255, 255, 255, .15); border-radius: .5rem; box-shadow: 0 .5rem 1.5rem rgba(0, 0, 0, .35); font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
            .theme-menu button { display: block; width: 100%; text-align: left; background: none; border: 0; border-radius: .35rem; padding: .3rem .6rem; color: rgba(255, 255, 255, .8); font-size: .9rem; }
            .theme-menu button:hover { background: rgba(255, 255, 255, .1); color: #fff; }
            .theme-menu button.active { color: #fff; font-weight: 600; }
            .theme-menu button.active::before { content: "✓ "; }
            .navmenu-backdrop{
              background: color-mix(in srgb, var(--nav-bg) 85%, transparent);   /* the text stays readable over bright pages */
              backdrop-filter: blur(10px);
            }
            .nav-section-header {
                font-size: 0.75rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.08rem;
                padding: 1.5rem 1.25rem 0.5rem;
            }
            .offcanvas-nav-link {
                color: #adb5bd;
                padding: 0.7rem 1.25rem;
                display: flex;
                align-items: center;
                text-decoration: none;
                transition: all 0.2s ease;
                border-left: 3px solid transparent;
            }
            .link-nom.active, .link-nom:hover {
                border-left-color: var(--bs-warning);
                background: linear-gradient(90deg, rgba(255, 193, 7, 0.1) 0%, rgba(255, 193, 7, 0) 100%);
                color: #fff !important;
            }
            .link-qatt.active, .link-qatt:hover {
                border-left-color: var(--bs-info);
                background: linear-gradient(90deg, rgba(13, 202, 240, 0.1) 0%, rgba(13, 202, 240, 0) 100%);
                color: #fff !important;
            }
            .offcanvas-nav-link i { margin-right: 12px; width: 20px; text-align: center; }
            /* bottom bar of the phone: the links of the current block (those with a "bar" label) and the menu */
            .bottom-bar { display: none; }
            @media (max-width: 767.98px) and (min-height: 480px) {
                body.has-bottom-bar { padding-bottom: calc(60px + env(safe-area-inset-bottom)); }
                .bottom-bar {
                    display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 1030;
                    padding-bottom: env(safe-area-inset-bottom);
                    background: color-mix(in srgb, var(--nav-bottom-bg) var(--nav-alpha), transparent); backdrop-filter: blur(15px);
                    border-top: 1px solid var(--nav-line, color-mix(in srgb, var(--nav-bottom-bg) 72%, #fff));
                }
                .bottom-bar.typing { display: none; } /* while the on-screen keyboard is open */
                body.bar-typing { padding-bottom: 0; }
                .bottom-bar a, .bottom-bar button {
                    flex: 1 1 0; min-width: 0; height: 60px; border: 0; background: none; color: #adb5bd;
                    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
                    font-size: .68rem; text-decoration: none; border-top: 3px solid transparent; white-space: nowrap;
                }
                .bottom-bar i { font-size: 1.35rem; line-height: 1; }
                .bottom-bar .active { color: #fff; border-top-color: var(--bar-accent); }
                .bottom-bar .active i { color: var(--bar-accent); }
            }
            /* round button that scrolls to the top: in the colour of the bar, shown after some scrolling, above the bottom bar of the phone */
            .to-top { position: fixed; right: 1rem; bottom: calc(1rem + env(safe-area-inset-bottom)); z-index: 1020; width: 3rem; height: 3rem; padding: 0; border: 0; border-radius: 50%; background: var(--nav-bg); color: #fff; font-size: 1.5rem; line-height: 1; display: flex; align-items: center; justify-content: center; box-shadow: 0 .2rem .7rem rgba(0, 0, 0, .35); opacity: 0; pointer-events: none; transition: opacity .2s; }
            .to-top.show { opacity: 1; pointer-events: auto; }
            @media (max-width: 991.98px) { body.has-bottom-bar:not(.bar-typing) .to-top { bottom: calc(60px + 1rem + env(safe-area-inset-bottom)); } }
            #siteOffcanvas { width: 280px; transition: transform 0.3s ease-in-out; }
            .powered-by { text-align: center; font-size: .7rem; padding: 1.5rem 1rem 1rem; }
            .powered-by a { color: inherit; opacity: .45; text-decoration: none; }
            .powered-by a:hover { opacity: .9; text-decoration: underline; }
        `;
        document.head.appendChild(style);
    }

    // footnote "powered by chunom.org": links to license.html, the hash lists the scripts and styles this page has loaded (no fonts)
    // (taken when the link is used, so also the files loaded later are in it)
    function injectFooter(licenseUrl) {
        // paths are relative to the site of license.html; files of the other site need the full address
        const licenseOrigin = new URL(licenseUrl, location.href).origin;
        const sources = () => {
            const seen = new Set();
            performance.getEntriesByType('resource').forEach(e => {
                const url = new URL(e.name, location.href);
                if (!/^https?:$/.test(url.protocol) || /license\.html$/.test(url.pathname) || !/\.(js|css)$/i.test(url.pathname)) return;
                seen.add(url.origin === licenseOrigin ? url.pathname : url.origin + url.pathname);
            });
            return [...seen];
        };
        const footer = document.createElement('div');
        footer.className = 'powered-by';
        const link = document.createElement('a');
        link.textContent = 'powered by chunom.org';
        link.title = 'Licenses and the files this page uses';
        // ?back= the page itself, so that license.html can send the visitor back (with the theme chosen there)
        const update = () => { link.href = `${licenseUrl}?back=${encodeURIComponent(location.origin + location.pathname + location.search)}#${sources().map(encodeURIComponent).join(',')}`; };
        update();
        ['pointerdown', 'focus', 'touchstart', 'contextmenu'].forEach(t => link.addEventListener(t, update));
        window.addEventListener('load', update);
        footer.appendChild(link);
        // the page qatt.html (the script), on every page of qatt.org except the admin area
        if (!/^\/admin\//.test(location.pathname) && !onChunom) {
            const sep = document.createTextNode(' · ');
            const shapes = document.createElement('a');
            shapes.href = '/qatt.html';
            shapes.textContent = 'Quốc Âm Tân Tự';
            footer.append(sep, shapes);
        }
        document.body.appendChild(footer);
    }

    function injectNav() {
        const home = navConfig.home;
        const logo = navConfig.logo;
        const brandTitle = navConfig.title;
        const sections = navConfig.sections;
        if (!document.querySelector('link[rel~="icon"]')) {
            document.head.insertAdjacentHTML('beforeend', navConfig.icons);
        }

        const currentPath = window.location.pathname;
        const navId = "siteOffcanvas";

        // desktop bar: the links of the own block, the other site in a dropdown
        const ownSection = sections.find(sec => sec.linkClass === navConfig.own) || sections[0];
        const otherSection = sections.find(sec => sec !== ownSection);
        const isActive = (sec, link) => !sec.site && (currentPath === link.url || currentPath === link.url.replace(/index\.html$/, ''));
        const deskLinks = ownSection.links.map(link =>
            `<li><a href="${ownSection.site || ''}${link.url}" title="${link.name}" class="${isActive(ownSection, link) ? 'active' : ''}"><i class="bi ${link.icon}"></i><span class="dl-text${link.vi ? '" data-vi="' + link.vi : ''}">${link.name}</span></a></li>`).join('');
        const otherLabel = onChunom ? 'QATT' : 'Chữ Nôm';
        const otherLinks = otherSection.links.map(link =>
            `<a href="${otherSection.site || ''}${link.url}"><i class="bi ${link.icon}"></i><span${link.vi ? ` data-vi="${link.vi}"` : ''}>${link.name}</span></a>`).join('');

        // the palette button only for admins (app_metadata.is_admin in the session of this browser; the session is per site); the others keep the theme they have
        // (license.html can still choose one). Only what is shown: nothing depends on it.
        function isAdmin() {
            try { const u = (JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token")) || {}).user; return !!(u && u.app_metadata && u.app_metadata.is_admin === true); }
            catch (e) { return false; }
        }
        const header = document.createElement('nav');
        header.className = "nav-backdrop navbar navbar-dark fixed-top shadow-sm";
        header.style.setProperty('--bar-accent', navConfig.accent);
        header.innerHTML = `
            <div class="container-fluid">
                <a class="navbar-brand fw-bold d-flex align-items-center gap-2" href="${home}">
                    ${navConfig.brand(logo, brandTitle, false)}
                </a>
                <ul class="desk-links">${deskLinks}</ul>
                <div class="desk-other">
                    <button type="button" aria-haspopup="true" aria-expanded="false">${otherLabel} <i class="bi bi-chevron-down small"></i></button>
                    <div class="desk-menu">${otherLinks}</div>
                </div>
                <div class="ms-auto d-flex align-items-center">
                    <button type="button" class="daynight-switch"${Theme.dayNight.available ? '' : ' hidden'}><i class="bi bi-sun-fill"></i></button>
                    <div class="lang-switch" role="group" aria-label="Language">
                        <button type="button" data-lang="en">EN</button><span aria-hidden="true">|</span><button type="button" data-lang="vi">VI</button>
                    </div>
                    <div class="theme-switch"${Theme.choosable && isAdmin() ? '' : ' hidden'}>
                        <button type="button" aria-haspopup="true" aria-expanded="false" title="Theme" data-vi-title="Giao diện" aria-label="Theme" data-vi-aria-label="Giao diện"><i class="bi bi-palette"></i></button>
                        <div class="theme-menu" role="menu" hidden></div>
                    </div>
                    <a class="admin-link" href="${QATT_SITE}/admin/"${isAdmin() ? '' : ' hidden'} title="Admin" data-vi-title="Quản trị" aria-label="Admin" data-vi-aria-label="Quản trị"><i class="bi bi-shield-lock"></i></a>
                    <button class="navbar-toggler border-0" type="button" id="navTogglerCustom">
                        <span class="navbar-toggler-icon"></span>
                    </button>
                </div>
            </div>
        `;

        const offcanvas = document.createElement('div');
        offcanvas.className = "navmenu-backdrop offcanvas offcanvas-end text-light";
        offcanvas.id = navId;
        offcanvas.tabIndex = "-1";

        const sectionsHtml = sections.map(section => {
            const linksHtml = section.links.map(link => {
                const isActive = !section.site && (currentPath === link.url || currentPath === link.url.replace(/index\.html$/, ''));
                return `<a href="${section.site || ''}${link.url}" class="offcanvas-nav-link ${section.linkClass} ${isActive ? 'active' : ''}">
                            <i class="bi ${link.icon}"></i> <span${link.vi ? ` data-vi="${link.vi}"` : ''}>${link.name}</span>
                        </a>`;
            }).join('');
            return `<div class="nav-section-header ${section.themeClass}">${section.header}</div>
                    <div class="nav flex-column">${linksHtml}</div>`;
        }).join('');

        offcanvas.innerHTML = `
            <div class="offcanvas-header border-bottom border-secondary">
                <h5 class="offcanvas-title fw-bold text-white d-flex align-items-center gap-2">${navConfig.brand(logo, brandTitle, true)}</h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="offcanvas"></button>
            </div>
            <div class="offcanvas-body p-0">${sectionsHtml}</div>
        `;

        // bottom bar for phones: only the links of the block of this page; not on the immersive page
        const ownBottomBar = /\/immersive\.html$/.test(currentPath);
        if (!ownBottomBar) {
            const block = sections.find(sec => sec.links.some(l => l.bar));
            const own = sections.find(sec => sec.linkClass === navConfig.own) || block;
            const barLinks = own.links.filter(l => l.bar).sort((a, b) => (a.barOrder ?? 0) - (b.barOrder ?? 0)).map(link => {
                const isActive = currentPath === link.url || currentPath === link.url.replace(/index\.html$/, '');
                return `<a href="${link.url}" class="${isActive ? 'active' : ''}"><i class="bi ${link.icon}"></i><span${link.barVi ? ` data-vi="${link.barVi}"` : ''}>${link.bar}</span></a>`;
            }).join('');
            const bar = document.createElement('nav');
            bar.className = 'bottom-bar';
            bar.setAttribute('aria-label', 'Main');
            bar.style.setProperty('--bar-accent', navConfig.accent);
            bar.innerHTML = `${barLinks}<button type="button" id="barMenu"><i class="bi bi-list"></i>Menu</button>`;
            document.body.appendChild(bar);
            document.body.classList.add('has-bottom-bar');
            bar.querySelector('#barMenu').addEventListener('click', () => document.getElementById('navTogglerCustom').click());
            // hide it while the on-screen keyboard is open (the visual viewport is much shorter than the window)
            // or while the user has put the cursor in a text field and the window is lower than wide (a field focused by the page itself does not count)
            let keyboard = false, field = false, lastTouch = 0;
            const update = () => {
                // a focused field hides it only while the window is lower than wide (the keyboard is up); with the keyboard closed and the cursor still in the field it comes back
                const hide = keyboard || (field && window.innerHeight < window.innerWidth);
                bar.classList.toggle('typing', hide);
                document.body.classList.toggle('bar-typing', hide);
            };
            const isField = el => el && el.matches && el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, [contenteditable=true]');
            ['pointerdown', 'touchstart', 'keydown'].forEach(t => document.addEventListener(t, () => { lastTouch = Date.now(); }, true));
            document.addEventListener('focusin', e => { if (isField(e.target) && Date.now() - lastTouch < 800) { field = true; update(); } });
            document.addEventListener('focusout', () => { field = false; update(); });
            window.addEventListener('resize', update);
            if (window.visualViewport) {
                const vv = window.visualViewport;
                vv.addEventListener('resize', () => { keyboard = window.innerHeight - vv.height > 150; update(); });
            }
            // the safe area below the bar needs viewport-fit=cover
            const viewport = document.querySelector('meta[name="viewport"]');
            if (viewport && !/viewport-fit/.test(viewport.content)) viewport.content += ', viewport-fit=cover';
        }

        // dropdown of the other site: click opens, a click elsewhere or Escape closes
        const other = header.querySelector('.desk-other');
        const otherButton = other.querySelector('button');
        const closeOther = () => { other.classList.remove('open'); otherButton.setAttribute('aria-expanded', 'false'); };
        otherButton.addEventListener('click', () => { const open = other.classList.toggle('open'); otherButton.setAttribute('aria-expanded', open); });
        document.addEventListener('click', e => { if (!other.contains(e.target)) closeOther(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeOther(); });

        // language switch EN | VI next to the menu button; the choice is remembered (Lang.set)
        const langButtons = header.querySelectorAll('.lang-switch button');
        const markLang = () => langButtons.forEach(b => { const on = b.dataset.lang === Lang.current; b.classList.toggle('active', on); b.setAttribute('aria-pressed', on); });
        langButtons.forEach(b => b.addEventListener('click', () => {
            Lang.set(b.dataset.lang);
            // vi.html is the Vietnamese copy of the homepage: EN goes to the English one
            if (b.dataset.lang === 'en' && document.documentElement.getAttribute('data-page-lang') === 'vi') location.href = '/index.html';
            // and VI on the English homepage goes to vi.html
            else if (b.dataset.lang === 'vi' && !onChunom && /^\/(index\.html)?$/.test(location.pathname)) location.href = '/vi.html';
        }));
        document.addEventListener('langchange', markLang);
        markLang();

        // day and night: the icon shows the time of day (sun, moon); a click switches by hand (Theme.dayNight.toggle), until the next change between day and night
        const dnBtn = header.querySelector('.daynight-switch');
        const markDayNight = () => {
            const night = Theme.dayNight.night, label = night ? Lang.t('Switch to day', 'Chuyển sang ban ngày') : Lang.t('Switch to night', 'Chuyển sang ban đêm');
            dnBtn.querySelector('i').className = 'bi ' + (night ? 'bi-moon-stars-fill' : 'bi-sun-fill');
            dnBtn.title = label; dnBtn.setAttribute('aria-label', label);
        };
        dnBtn.addEventListener('click', () => Theme.dayNight.toggle());
        document.addEventListener('daynightchange', markDayNight);
        document.addEventListener('langchange', markDayNight);
        markDayNight();

        // theme: the palette button opens the list of Theme.list; a choice is remembered (Theme.set), a click outside or Esc closes the list
        const themeBtn = header.querySelector('.theme-switch > button'), themeMenu = header.querySelector('.theme-menu');
        for (const [name, [en, vi]] of Object.entries(Theme.list)) {
            const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'menuitem'); b.dataset.theme = name;
            const s = document.createElement('span'); s.textContent = en; if (vi !== en) s.setAttribute('data-vi', vi);
            b.append(s); themeMenu.append(b);
        }
        const markTheme = () => themeMenu.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.theme === Theme.current));
        const closeTheme = () => { themeMenu.hidden = true; themeBtn.setAttribute('aria-expanded', 'false'); };
        themeBtn.addEventListener('click', e => { e.stopPropagation(); const open = themeMenu.hidden; themeMenu.hidden = !open; themeBtn.setAttribute('aria-expanded', String(open)); });
        themeMenu.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { Theme.set(b.dataset.theme); closeTheme(); } });
        document.addEventListener('click', e => { if (!themeMenu.hidden && !e.target.closest('.theme-switch')) closeTheme(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeTheme(); });
        document.addEventListener('themechange', markTheme);
        markTheme();

        document.body.style.paddingTop = "60px";
        document.body.prepend(header);
        document.body.appendChild(offcanvas);
        if (!ownBottomBar) injectFooter(navConfig.license);

        const initOffcanvas = () => {
            const toggler = document.getElementById('navTogglerCustom');
            const offcanvasEl = document.getElementById(navId);
            
            if (toggler && offcanvasEl && typeof bootstrap !== 'undefined') {
                const bsOffcanvas = new bootstrap.Offcanvas(offcanvasEl);
                toggler.addEventListener('click', (e) => {
                    e.preventDefault();
                    bsOffcanvas.toggle();
                });
            } else if (typeof bootstrap === 'undefined') {
                setTimeout(initOffcanvas, 200);
            }
        };
        initOffcanvas();
    }

    function injectToTop() {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'to-top';
        button.setAttribute('aria-label', 'Back to top'); button.setAttribute('data-vi-aria-label', 'Lên đầu trang');
        button.innerHTML = '<i class="bi bi-arrow-up"></i>';
        button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        window.addEventListener('scroll', () => button.classList.toggle('show', window.scrollY > 400), { passive: true });
        document.body.appendChild(button);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            injectDependencies();
            injectNav();
            injectToTop();
        });
    } else {
        injectDependencies();
        injectNav();
        injectToTop();
    }
})();

// ---------- Visit counter ----------
// Counts the visits in Supabase (db/visits.sql): only numbers, no cookie, no id, no address of the page. It counts only on qatt.org and chunom.org,
// only when somebody uses the page (tap, key, mouse wheel or button; so most bots do not count) and not for browsers that name themselves as bots.
// localStorage "qv" = { d: the UTC day of the last count, t: the time of the last activity }: once per browser and day = a visitor, a pause of more
// than 30 minutes = a new visit. kind: "account" if the session of the browser is a signed-in user, else "anonymous".
// Admins (app_metadata.is_admin in the session of the browser) are not counted; localStorage.qv_off = "1" switches it off in a browser that is not signed in.
(function() {
    try {
        const SITE = location.hostname === "qatt.org" ? "qatt.org" : location.hostname === "chunom.org" ? "chunom.org" : null;
        const BOT = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|python|curl|wget|httpclient|java\//i;
        if (!SITE || navigator.webdriver || BOT.test(navigator.userAgent) || localStorage.getItem("qv_off")) return;
        const SUPABASE = "https://kfgqhhmdzboszpwsqkxt.supabase.co", KEY = "sb_publishable_99iUsu3_BQ6mp1TbZUEWlw_iVhDJhPi";
        const PAUSE = 30 * 60 * 1000, EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"];   // no "scroll": a page that restores or sets its position fires it without anybody
        const read = () => { try { return JSON.parse(localStorage.getItem("qv")) || {}; } catch (e) { return {}; } };
        const write = s => { try { localStorage.setItem("qv", JSON.stringify(s)); } catch (e) {} };
        const kind = () => {
            try {
                const u = (JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token")) || {}).user;
                if (u && u.app_metadata && u.app_metadata.is_admin === true) return "admin";   // admins are not counted
                return u && u.is_anonymous === false ? "account" : "anonymous";
            }
            catch (e) { return "anonymous"; }
        };
        const count = e => {
            if (e && e.isTrusted === false) return;   // events made by a script
            EVENTS.forEach(ev => removeEventListener(ev, count));
            const s = read(), now = Date.now(), today = new Date().toISOString().slice(0, 10);
            const newVisitor = s.d !== today, newVisit = newVisitor || !s.t || now - s.t > PAUSE;
            write({ d: today, t: now });
            if (!newVisit) return;
            const k = kind();
            if (k === "admin") return;
            fetch(SUPABASE + "/rest/v1/rpc/count_visit", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
                body: JSON.stringify({ p_site: SITE, p_kind: k, p_new_visitor: newVisitor }) }).catch(() => {});
        };
        EVENTS.forEach(e => addEventListener(e, count, { passive: true }));
        // when the page is left the time of the last activity is stored, so a pause is measured from there
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState !== "hidden") return;
            const s = read();
            if (s.d) { s.t = Date.now(); write(s); }
        });
    } catch (e) { /* the counter must never disturb a page */ }
})();
