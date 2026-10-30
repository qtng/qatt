/*
A contenteditable="plaintext-only" element that looks like a <textarea> to notes-editor.js and ime.js (value, selectionStart/End, setSelectionRange, setRangeText, readOnly), and that
carries inline formats: bold, italic and a size (percent of the size of the note) per piece of text. The element is the truth: the formats are <span data-b data-i data-z> in it, the
user types inside them as in any text, and every change by script goes through a model (the text and the format of each UTF-16 unit) that is built into the element again.

  CeAdapter.wrap(div)            the element with these members added (a Proxy: everything else is the element's own)
    runs                         the formats as runs [{ n, b?, i?, z? }] (n = length in UTF-16 units; [] when nothing is formatted)
    setModel(text, runs)         text and formats at once (runs that do not fit the text are ignored)
    mapText(fn)                  the text becomes fn(text); the formats follow (a boundary is moved to where fn(text before it) ends)
    format(kind, value)          kind 'b' | 'i' (1 or 0) or 'z' (percent, 0 = the size of the note) for the selection; with a cursor only, for the text typed next
    formatState()                { b, i, z } of the selection (null where it is mixed) or of the text at the cursor
    element                      the element itself
  CeAdapter.SIZES                the steps of the size buttons
  CeAdapter.normalize(runs, length)   the runs if they are valid for a text of this length, else []
*/
const CeAdapter = (() => {
  const SIZES = [60, 80, 100, 125, 150, 200, 300];
  const interned = new Map();
  const mk = (b, i, z) => { const k = b + ',' + i + ',' + z; if (!interned.has(k)) interned.set(k, Object.freeze({ b, i, z })); return interned.get(k); };
  const PLAIN = mk(0, 0, 0);
  const isPlain = a => a === PLAIN;

  const attrOf = (node, root) => {
    let b = 0, i = 0, z = 0;
    for (let p = node.parentElement; p && p !== root; p = p.parentElement) {
      if (p.dataset.b) b = 1;
      if (p.dataset.i) i = 1;
      if (!z && p.dataset.z) z = Number(p.dataset.z) || 0;
    }
    return mk(b, i, z);
  };
  const parse = root => {
    let text = ''; const units = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const a = attrOf(n, root); text += n.data; for (let k = 0; k < n.length; k++) units.push(a); }
    return { text, units };
  };
  const runsOf = units => {
    const runs = [];
    for (const a of units) {
      const last = runs[runs.length - 1];
      if (last && last.a === a) last.n++; else runs.push({ a, n: 1 });
    }
    return runs;
  };
  const build = (root, text, units) => {
    root.textContent = '';
    let at = 0;
    for (const { a, n } of runsOf(units)) {
      const piece = text.slice(at, at + n); at += n;
      if (isPlain(a)) { root.append(document.createTextNode(piece)); continue; }
      const s = document.createElement('span');
      if (a.b) s.dataset.b = '1';
      if (a.i) s.dataset.i = '1';
      if (a.z) { s.dataset.z = String(a.z); s.style.fontSize = a.z + '%'; }
      s.textContent = piece;
      root.append(s);
    }
  };
  const normalize = (runs, length) => {
    if (!Array.isArray(runs) || runs.length > 5000) return [];
    let sum = 0;
    for (const r of runs) {
      if (!r || !Number.isInteger(r.n) || r.n < 1) return [];
      if ((r.z !== undefined && !(Number.isFinite(r.z) && r.z >= 20 && r.z <= 500)) || (r.b !== undefined && typeof r.b !== 'boolean') || (r.i !== undefined && typeof r.i !== 'boolean')) return [];
      sum += r.n;
    }
    return sum === length ? runs.map(r => ({ n: r.n, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}), ...(r.z ? { z: Math.round(r.z) } : {}) })) : [];
  };
  const unitsFromRuns = (runs, length) => {
    const ok = normalize(runs, length), units = [];
    for (const r of ok) { const a = mk(r.b ? 1 : 0, r.i ? 1 : 0, r.z || 0); for (let k = 0; k < r.n; k++) units.push(a); }
    while (units.length < length) units.push(PLAIN);
    return units;
  };

  const textOffset = (root, node, offset) => {
    if (!root.contains(node)) return 0;
    const r = document.createRange(); r.selectNodeContents(root); r.setEnd(node, offset);
    return r.toString().length;
  };
  const place = (root, offset) => {
    let left = offset;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (left <= n.length) return [n, left]; left -= n.length; }
    return [root, root.childNodes.length];
  };

  const wrap = el => {
    el.setAttribute('contenteditable', 'plaintext-only');
    const sel = () => document.getSelection();
    let pending = null, pendingAt = -1;   // formats for the text typed next (a cursor, no selection)
    const caretStart = () => { const s = sel(); return s.rangeCount ? Math.min(textOffset(el, s.anchorNode, s.anchorOffset), textOffset(el, s.focusNode, s.focusOffset)) : 0; };
    const caretEnd = () => { const s = sel(); return s.rangeCount ? Math.max(textOffset(el, s.anchorNode, s.anchorOffset), textOffset(el, s.focusNode, s.focusOffset)) : 0; };
    const select = (a, b) => {
      const [n1, o1] = place(el, a), [n2, o2] = place(el, b);
      const r = document.createRange(); r.setStart(n1, o1); r.setEnd(n2, o2);
      const s = sel(); s.removeAllRanges(); s.addRange(r);
    };
    const inside = () => { const s = sel(); return s.rangeCount && el.contains(s.anchorNode); };
    // replaces the model and builds the element; `keep` = the selection to set afterwards (only when the element has it)
    const rebuild = (text, units, keep) => { build(el, text, units); if (keep) select(Math.min(keep[0], text.length), Math.min(keep[1], text.length)); };
    const attrFor = (units, at) => units[at] || units[at - 1] || PLAIN;

    const self = {
      get element() { return el; },
      get value() { return el.textContent; },
      set value(v) {   // the formats of the unchanged beginning and end stay
        const { text, units } = parse(el), had = inside();
        let p = 0; const max = Math.min(text.length, v.length);
        while (p < max && text[p] === v[p]) p++;
        let s = 0; while (s < max - p && text[text.length - 1 - s] === v[v.length - 1 - s]) s++;
        const mid = attrFor(units, p), next = units.slice(0, p);
        for (let k = p; k < v.length - s; k++) next.push(mid);
        for (let k = text.length - s; k < text.length; k++) next.push(units[k]);
        rebuild(v, next, had ? [v.length, v.length] : null);
      },
      get selectionStart() { return caretStart(); },
      get selectionEnd() { return caretEnd(); },
      get selectionDirection() { return 'none'; },
      setSelectionRange(a, b) { select(a, b); },
      setRangeText(insert, start, end, mode = 'preserve') {
        const { text, units } = parse(el), a = start ?? caretStart(), b = end ?? caretEnd(), ks = caretStart(), ke = caretEnd(), had = inside();
        const attr = a < b ? attrFor(units, a) : (units[a - 1] || units[a] || PLAIN);
        const next = units.slice(0, a);
        for (let k = 0; k < insert.length; k++) next.push(attr);
        next.push(...units.slice(b));
        const at = a + insert.length, shift = p => (p >= b ? p + insert.length - (b - a) : p > a ? a : p);
        const keep = mode === 'end' ? [at, at] : mode === 'start' ? [a, a] : mode === 'select' ? [a, at] : [shift(ks), shift(ke)];
        rebuild(text.slice(0, a) + insert + text.slice(b), next, had ? keep : null);
      },
      get readOnly() { return el.getAttribute('contenteditable') === 'false'; },
      set readOnly(on) { el.setAttribute('contenteditable', on ? 'false' : 'plaintext-only'); },

      get runs() {
        const { units } = parse(el);
        if (units.every(isPlain)) return [];
        return runsOf(units).map(({ a, n }) => ({ n, ...(a.b ? { b: true } : {}), ...(a.i ? { i: true } : {}), ...(a.z ? { z: a.z } : {}) }));
      },
      setModel(text, runs) { pending = null; build(el, text, unitsFromRuns(runs, text.length)); },
      mapText(fn) {
        const { text, units } = parse(el), had = inside(), ks = caretStart(), ke = caretEnd();
        const out = fn(text);
        if (out === text) return;
        const where = p => (p <= 0 ? 0 : p >= text.length ? out.length : Math.min(out.length, fn(text.slice(0, p)).length));
        const next = []; let at = 0;
        for (const { a, n } of runsOf(units)) {
          const to = where(at + n); for (let k = where(at); k < to; k++) next.push(a); at += n;
        }
        while (next.length < out.length) next.push(next[next.length - 1] || PLAIN);
        rebuild(out, next.slice(0, out.length), had ? [where(ks), where(ke)] : null);
      },
      format(kind, value) {
        const { text, units } = parse(el), a = caretStart(), b = caretEnd();
        const change = u => mk(kind === 'b' ? value : u.b, kind === 'i' ? value : u.i, kind === 'z' ? value : u.z);
        if (a === b) { pending = { ...(pending || {}), [kind]: value }; pendingAt = a; return; }
        const next = units.map((u, k) => (k >= a && k < b ? change(u) : u));
        rebuild(text, next, [a, b]);
      },
      formatState() {
        const { units } = parse(el), a = caretStart(), b = caretEnd();
        let state;
        if (a === b) { const u = attrFor(units, a > 0 ? a - 1 : 0); state = { b: u.b, i: u.i, z: u.z }; if (a === 0 && !units.length) state = { b: 0, i: 0, z: 0 }; }
        else {
          const part = units.slice(a, b), f = k => (part.every(u => u[k] === part[0][k]) ? part[0][k] : null);
          state = { b: f('b'), i: f('i'), z: f('z') };
        }
        if (pending && a === b && pendingAt === a) state = { ...state, ...pending };
        return state;
      },
    };

    // text typed with a pending format gets it after the browser has put it in
    el.addEventListener('input', e => {
      if (!pending || e.isComposing || !e.data || caretStart() !== caretEnd() || caretStart() !== pendingAt + e.data.length) return;
      const { text, units } = parse(el), end = caretStart(), start = end - e.data.length;
      const next = units.map((u, k) => (k >= start && k < end ? mk(pending.b ?? u.b, pending.i ?? u.i, pending.z ?? u.z) : u));
      rebuild(text, next, [end, end]);
      pendingAt = end;
    });
    document.addEventListener('selectionchange', () => { if (pending && inside() && caretStart() !== pendingAt) pending = null; });

    return new Proxy(el, {
      get(target, prop) {
        if (prop in self) return self[prop];
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      },
      set(target, prop, value) { if (prop in self) { self[prop] = value; return true; } return Reflect.set(target, prop, value, target); },
    });
  };
  return { wrap, SIZES, normalize };
})();
