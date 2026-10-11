// Editor of brush.html. Two views:
// - Symbols: each of the 66 symbols (22 shapes as rhyme, onset and centred form) is three strokes from the library between
//   two end points, plus its marks (six for the rhyme and the centred form, the medial for the onset form).
// - Stroke library: named strokes (bend and width profile) used by the symbols.
// Everything is kept in localStorage and can be exported and imported as JSON (the export also holds the finished outlines).
(() => {
  const B = QattBrush;
  const SVGNS = "http://www.w3.org/2000/svg";
  const STORE = "qatt-brush-v3";
  const SHAPES = VietnameseParser.SHAPES.map(s => s === "z" ? "_" : s);
  const TABLE = VietnameseParser.DECODINGS.qatt;
  const TONES = ["", "sắc", "huyền", "hỏi", "ngã", "nặng", "sắc (nhập)", "nặng (nhập)", "ngang"];
  const VIEWBOX = "-14 -28 128 136";   // the glyph box of qatt.js with room for the tone marks in the corners
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---- the original centre lines ----------------------------------------------------------------------------------------------
  const ORIG = {};
  new DOMParser().parseFromString(defaultSvgDefs, "image/svg+xml").querySelectorAll("path[id]").forEach(p => ORIG[p.id] = p.getAttribute("d"));
  const parsed = {};
  const original = id => parsed[id] || (parsed[id] = ORIG[id] ? B.parse(ORIG[id]) : []);
  const centred = ([x, y]) => [1.5 * x - 66.25, y];   // the v2c- copies of qatt.js: a rhyme alone, centred in the box

  // ---- defaults: the library and the symbols made from the original paths ---------------------------------------------------------
  // The standard library has five strokes; every original stroke goes to the nearest of them.
  const DEF = (() => {
    const sym = {}, slight = [];
    const measure = piece => { const segs = B.normalize(piece.s); return Object.assign({ kind: B.classify(segs) }, B.fit(segs)); };
    const keyOf = f => {
      const bend = Math.max(Math.abs(f.h1), Math.abs(f.h2));
      if (f.kind === "na") return "na";
      if (f.kind === "shu" && bend < 0.025) return "shu";
      if (f.kind === "shu" || f.kind === "pie") { if (f.kind === "shu" && bend < 0.1) slight.push(f); return "shu-slight"; }
      return "heng";
    };
    for (const s of SHAPES) {
      for (const id of ["v2-" + s, `v2-${s}-small`]) {
        const strokes = original(id).map(p => { const f = measure(p); return { lib: keyOf(f), a: f.a, b: f.b }; });
        const marks = (id.endsWith("-small") ? [`v2-${s}-medial`] : [1, 2, 3, 4, 5, 6].map(n => "v2-" + s + n))
          .map(m => { const p = original(m)[0]; if (!p) return null; const f = measure(p); return { lib: "mark", a: f.a, b: f.b }; });
        sym[id] = { strokes, marks };
      }
    }
    const avg = k => Math.round(slight.reduce((a, x) => a + x[k], 0) / (slight.length || 1) * 1000) / 1000;
    const lib = {
      heng: Object.assign({}, B.DEFAULT_PRESETS.heng, { name: "Horizontal", h1: 0, h2: 0 }),
      shu: Object.assign({}, B.DEFAULT_PRESETS.shu, { name: "Vertical", h1: 0, h2: 0 }),
      "shu-slight": Object.assign({}, B.DEFAULT_PRESETS.shu, { name: "Vertical, slightly curved", h1: avg("h1"), h2: avg("h2") }),
      na: Object.assign({}, B.DEFAULT_PRESETS.na, { name: "Right-falling", h1: 0, h2: 0 }),
      mark: Object.assign({}, B.DEFAULT_PRESETS.line, { name: "Mark", h1: 0, h2: 0, w0: 0.8, ws: 0.85, wm: 0.8, we: 0.8, w1: 0.75 }),
    };
    return { lib, sym };
  })();

  // ---- state, history, storage --------------------------------------------------------------------------------------------------
  const fresh = () => ({ params: { weight: 7, contrast: 0.2, nib: 0 }, lib: clone(DEF.lib), sym: {} });
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.lib && s.sym) state = Object.assign(fresh(), s); } catch (e) { }
  const undo = [], redo = [];
  let pending = false, saveTimer = null;
  const begin = () => { if (!pending) { undo.push(JSON.stringify(state)); if (undo.length > 200) undo.shift(); redo.length = 0; pending = true; } };
  const end = () => { pending = false; save(); };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }, 300); };
  const restore = json => { state = Object.assign(fresh(), JSON.parse(json)); if (!state.lib[libSel]) libSel = Object.keys(state.lib)[0]; save(); renderAll(); };
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(state)); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(state)); restore(redo.pop()); }

  // ---- symbols and outlines ----------------------------------------------------------------------------------------------------
  const moveItem = (it, f) => it && Object.assign({}, it, { a: f(it.a), b: f(it.b) });
  function symbolOf(id) {
    if (state.sym[id]) return state.sym[id];
    if (id.startsWith("v2c-")) { const r = symbolOf("v2-" + id.slice(4)); return { strokes: r.strokes.map(it => moveItem(it, centred)), marks: r.marks.map(it => moveItem(it, centred)), derived: true }; }
    return DEF.sym[id];
  }
  function editableSymbol(id) {
    if (!state.sym[id]) { state.sym[id] = clone(symbolOf(id)); delete state.sym[id].derived; }
    return state.sym[id];
  }
  // which symbol and which part of it a qatt.js path id is
  function target(id) {
    let m;
    if ((m = id.match(/^v2-(.+)-small$/)) && SHAPES.includes(m[1])) return { sym: id };
    if ((m = id.match(/^v2-(.+)-medial$/)) && SHAPES.includes(m[1])) return { sym: `v2-${m[1]}-small`, mark: 0 };
    if ((m = id.match(/^(v2c?)-(.+?)([1-6])$/)) && SHAPES.includes(m[2])) return { sym: `${m[1]}-${m[2]}`, mark: +m[3] - 1 };
    if ((m = id.match(/^(v2c?)-(.+)$/)) && SHAPES.includes(m[2])) return { sym: id };
    return null;
  }
  const placed = items => items.filter(Boolean).map(it => B.place(it.a, it.b, state.lib[it.lib] || state.lib.mark || DEF.lib.mark, state.lib[it.lib] ? it.lib : "mark"));
  // the strokes of a path: placed library strokes for the symbols, the old automatic brush for tones and codas
  function strokesOf(id) {
    const t = target(id);
    if (t) { const s = symbolOf(t.sym); return placed(t.mark === undefined ? s.strokes : [s.marks[t.mark]]); }
    if (id.startsWith("v2c-")) return B.transform(original("v2-" + id.slice(4)), centred);
    return original(id);
  }
  const cache = new Map();
  function outlineOf(id) {
    if (!cache.has(id)) {
      const t = target(id);
      cache.set(id, t ? B.outline(strokesOf(id), state.params, state.lib)
        : B.outline(strokesOf(id), Object.assign({}, B.DEFAULT_PARAMS, state.params, { weight: state.params.weight * (/^q[ts]/.test(id) ? 0.7 : 1) })));
    }
    return cache.get(id);
  }
  let frame = null;
  function changed() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null; cache.clear();
      document.querySelectorAll("path[data-id]").forEach(p => { const d = outlineOf(p.dataset.id); if (p.getAttribute("d") !== d) p.setAttribute("d", d); });
      if (view === "symbols") drawCanvas(); else drawLibCanvas();
      document.querySelectorAll("path[data-lib]").forEach(p => p.setAttribute("d", libPreviewD(p.dataset.lib, 0.62)));
    });
  }

  // ---- composing glyphs (as qatt.js does), readings ---------------------------------------------------------------------
  function compose({ onset, medial, rhyme, mark, tone }, fixed) {
    const ids = [];
    if (onset) { ids.push(`v2-${onset}-small`); if (medial) ids.push(`v2-${onset}-medial`); }
    if (rhyme) {
      const pre = !onset && !tone && !fixed ? "v2c-" : "v2-";
      ids.push(pre + rhyme);
      if (mark) ids.push(pre + rhyme + mark);
    }
    if (tone) ids.push((onset || rhyme ? "qt" : "qs") + (tone == 8 ? 0 : tone));
    return ids;
  }
  const ONSET_SPELLING = { _: "", d: "đ", dz: "d" };
  function syllable(onset, shape, mark, tone) {
    const row = SHAPES.indexOf(shape);
    if (row < 0 || !(mark >= 2 && mark <= 6)) return "";
    let r = TABLE[row][mark - 2], o = onset ? (onset in ONSET_SPELLING ? ONSET_SPELLING[onset] : onset) : "";
    if (o === "c" && /^[eêiy]/.test(r)) o = "k";
    if (o === "g" && /^[eêi]/.test(r)) o = "gh";
    if (o === "ng" && /^[eêi]/.test(r)) o = "ngh";
    if (o === "c" && /^(o[aăe]|u[âêơy])/.test(r)) { o = "qu"; r = r.slice(1); }
    if (o === "d" && /^i/.test(r)) o = "g";
    return withTone(o + r, tone);
  }
  function withTone(word, tone) {
    const mark = { 1: "́", 2: "̀", 3: "̉", 4: "̃", 5: "̣", 6: "́", 7: "̣" }[tone];
    if (!mark) return word;
    const chars = [...word.normalize("NFC")], vowel = c => "aăâeêioôơuưy".includes(c);
    const idx = chars.map((c, i) => vowel(c) ? i : -1).filter(i => i >= 0);
    if (!idx.length) return word;
    let at = idx.find(i => "ăâêôơư".includes(chars[i]) && !(chars[i] === "ư" && chars[i + 1] === "ơ"));
    if (at === undefined) {
      const tail = idx[idx.length - 1] < chars.length - 1;
      at = idx.length === 1 ? idx[0] : tail || /^(oa|oe|uy)/.test(chars.slice(idx[0], idx[0] + 2).join("")) ? idx[1] : idx[0];
      if (chars[idx[0] - 1] === "q" || (chars[idx[0] - 1] === "g" && chars[idx[0]] === "i" && idx.length > 1)) at = idx[1];
    }
    chars[at] = (chars[at] + mark).normalize("NFC");
    return chars.join("");
  }
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function glyph(ids, faint) {
    const svg = el("svg", { viewBox: VIEWBOX, class: "glyph" });
    for (const id of faint || []) el("path", { "data-id": id, d: outlineOf(id), class: "faint" }, svg);
    for (const id of ids) el("path", { "data-id": id, d: outlineOf(id) }, svg);
    return svg;
  }
  const shapeName = s => s === "_" ? "ʔ" : s;

  // ---- selection --------------------------------------------------------------------------------------------------------------
  // active: the one stroke ({type: "stroke", i}) or mark ({type: "mark", i}) that can be edited, everything else is locked;
  // mode: what a drag anywhere on the canvas moves ("all", "a" the start point, "b" the end point), null = no editing
  let view = "symbols", form = "rhyme", shape = "ng", active = { type: "stroke", i: 0 }, mode = null, markOpacity = 0.3, libSel = "shu";
  const ctx = { onset: "t", rhyme: "ng", mark: 2, tone: 0 };
  const FORMS = { rhyme: { title: "Rhyme forms", id: s => "v2-" + s }, onset: { title: "Onset forms", id: s => `v2-${s}-small` }, centred: { title: "Centred forms", id: s => "v2c-" + s } };
  const symId = () => FORMS[form].id(shape);
  const markIds = (id, n) => { const t = id.match(/^(v2c?)-(.+?)(-small)?$/); return t[3] ? `v2-${t[2]}-medial` : `${t[1]}-${t[2]}${n + 1}`; };
  const markLabel = i => form === "onset" ? "Medial" : String(i + 1);
  const isActive = (type, i) => active && active.type === type && active.i === i;
  const activeMark = () => active && active.type === "mark" ? active.i : null;
  const activeItem = sym => active && (active.type === "mark" ? sym.marks : sym.strokes)[active.i];
  function fixActive() { if (active && !activeItem(symbolOf(symId()))) active = null; }

  function selectSymbol(s) { shape = s; fixActive(); drawSymbolList(); drawSymbolView(); }

  // ---- symbols view: list ------------------------------------------------------------------------------------------------------
  function drawSymbolList() {
    document.querySelectorAll("#forms button").forEach(b => b.classList.toggle("active", b.dataset.form === form));
    const list = document.getElementById("sym-list"); list.innerHTML = "";
    for (const s of SHAPES) {
      const id = FORMS[form].id(s);
      const cell = document.createElement("button");
      cell.type = "button"; cell.className = "cell" + (s === shape ? " active" : "") + (state.sym[id] ? " edited" : "");
      cell.append(glyph([id]));
      const lab = document.createElement("span"); lab.textContent = shapeName(s); cell.append(lab);
      cell.addEventListener("click", () => selectSymbol(s));
      list.append(cell);
    }
  }
  const markEdited = () => document.querySelectorAll("#sym-list .cell").forEach((c, i) => c.classList.toggle("edited", !!state.sym[FORMS[form].id(SHAPES[i])]));

  // ---- symbols view: canvas -------------------------------------------------------------------------------------------------
  const canvas = document.getElementById("canvas");
  let drag = null, guides = [];
  const viewOpt = { orig: false, snap: true };

  function contextIds() {
    if (form === "rhyme") return compose({ onset: ctx.onset, rhyme: shape, tone: ctx.tone }, true).filter(id => id !== symId());
    if (form === "onset") return compose({ onset: shape, rhyme: ctx.rhyme, mark: ctx.mark, tone: ctx.tone }, true).filter(id => id !== symId());
    return [];
  }
  function drawCanvas() {
    canvas.innerHTML = "";
    canvas.classList.toggle("editing", !!(mode && active));
    const grid = el("g", { class: "grid" }, canvas);
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: -20, x2: v, y2: 105 }, grid); el("line", { x1: -5, y1: v, x2: 105, y2: v }, grid); }
    el("rect", { x: -9, y: -9, width: 118, height: 118, class: "box" }, grid);
    const id = symId(), sym = symbolOf(id), ctxIds = contextIds();
    for (const c of ctxIds) el("path", { "data-id": c, d: outlineOf(c), class: "ctx" }, canvas);
    if (viewOpt.orig) for (const c of [id, ...sym.marks.map((m, i) => markIds(id, i))].concat(ctxIds)) {
      const o = c.startsWith("v2c-") ? B.skeleton(B.transform(original("v2-" + c.slice(4)), centred)) : ORIG[c];
      if (o) el("path", { d: o, class: "orig" }, canvas);
    }
    sym.marks.forEach((m, i) => {
      if (!m) return;
      const p = el("path", { d: B.outline(placed([m]), state.params, state.lib), class: "mark" + (isActive("mark", i) ? " current" : "") }, canvas);
      if (!isActive("mark", i)) p.style.opacity = markOpacity;
    });
    sym.strokes.forEach((s, i) => el("path", { d: B.outline(placed([s]), state.params, state.lib), class: "stroke" + (isActive("stroke", i) ? " current" : "") }, canvas));
    for (const [x1, y1, x2, y2] of guides) el("line", { x1, y1, x2, y2, class: "guide" }, canvas);
    const it = activeItem(sym);
    if (!it) return;
    const h = el("g", { class: "handles" }, canvas);
    el("line", { x1: it.a[0], y1: it.a[1], x2: it.b[0], y2: it.b[1] }, h);
    for (const end of ["a", "b"]) el("circle", { cx: it[end][0], cy: it[end][1], r: 1.9, class: (end === "a" ? "start" : "") + (mode === end || mode === "all" ? " on" : "") }, h);
  }

  const toSvg = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const round = v => Math.round(v * 4) / 4;
  function snapTargets(skip) {
    const xs = [], ys = [];
    const add = p => { xs.push(p[0]); ys.push(p[1]); };
    const sym = symbolOf(symId());
    sym.strokes.forEach(it => { if (it !== skip) { add(it.a); add(it.b); } });
    for (const c of contextIds()) for (const st of strokesOf(c)) { const s0 = st.s[0], s1 = st.s[st.s.length - 1]; add([s0[0], s0[1]]); add([s1[6], s1[7]]); }
    return { xs, ys };
  }
  // a drag anywhere on the canvas moves the active stroke or mark as the mode says
  canvas.addEventListener("pointerdown", e => {
    if (!mode || !active || !activeItem(symbolOf(symId()))) return;
    e.preventDefault();
    begin();
    const it = activeItem(editableSymbol(symId()));
    drag = { it, end: mode === "all" ? null : mode, a: it.a.slice(), b: it.b.slice(), start: toSvg(canvas, e), targets: snapTargets(it), mark: active.type === "mark" };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = toSvg(canvas, e);
    let dx = round(p.x - drag.start.x), dy = round(p.y - drag.start.y);
    guides = [];
    const moving = drag.end ? [drag[drag.end]] : [drag.a, drag.b];
    if (viewOpt.snap && !e.altKey && !(drag.end && e.shiftKey)) {
      let bx = null, by = null;
      for (const [ax, ay] of moving) {
        for (const tx of drag.targets.xs) { const d = tx - (ax + dx); if (Math.abs(d) < 1.5 && (!bx || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: tx }; }
        for (const ty of drag.targets.ys) { const d = ty - (ay + dy); if (Math.abs(d) < 1.5 && (!by || Math.abs(d) < Math.abs(by.d))) by = { d, y: ty }; }
      }
      if (bx) { dx += bx.d; guides.push([bx.x, -25, bx.x, 105]); }
      if (by) { dy += by.d; guides.push([-12, by.y, 112, by.y]); }
    }
    if (!drag.end) { drag.it.a = [drag.a[0] + dx, drag.a[1] + dy]; drag.it.b = [drag.b[0] + dx, drag.b[1] + dy]; }
    else if (e.shiftKey) {
      // keep the length: turn around the other end (a mark turns around its middle)
      const other = drag.end === "a" ? drag.b : drag.a, piv = drag.mark ? [(drag.a[0] + drag.b[0]) / 2, (drag.a[1] + drag.b[1]) / 2] : other;
      const q = [drag[drag.end][0] + dx, drag[drag.end][1] + dy], r = Math.hypot(drag[drag.end][0] - piv[0], drag[drag.end][1] - piv[1]);
      const ang = Math.atan2(q[1] - piv[1], q[0] - piv[0]), np = [piv[0] + r * Math.cos(ang), piv[1] + r * Math.sin(ang)];
      drag.it[drag.end] = np;
      if (drag.mark) drag.it[drag.end === "a" ? "b" : "a"] = [2 * piv[0] - np[0], 2 * piv[1] - np[1]];
    } else drag.it[drag.end] = [drag[drag.end][0] + dx, drag[drag.end][1] + dy];
    changed();
  });
  const stopDrag = () => { if (!drag) return; drag = null; guides = []; end(); markEdited(); drawCanvas(); drawItems(); };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);

  function rotate(deg) {
    if (!active || !activeItem(symbolOf(symId()))) return;
    begin();
    const m = activeItem(editableSymbol(symId())), c = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2], r = deg * Math.PI / 180;
    const rot = p => [round(c[0] + (p[0] - c[0]) * Math.cos(r) - (p[1] - c[1]) * Math.sin(r)), round(c[1] + (p[0] - c[0]) * Math.sin(r) + (p[1] - c[1]) * Math.cos(r))];
    m.a = rot(m.a); m.b = rot(m.b);
    end(); markEdited(); changed(); drawItems();
  }

  // arrow keys move what the mode says
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
    if (view !== "symbols") return;
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || !mode || !active || !activeItem(symbolOf(symId()))) return;
    e.preventDefault();
    const step = e.shiftKey ? 2 : e.altKey ? 0.25 : 0.5;
    begin();
    const it = activeItem(editableSymbol(symId()));
    for (const k of mode === "all" ? ["a", "b"] : [mode]) it[k] = [it[k][0] + dir[0] * step, it[k][1] + dir[1] * step];
    end(); markEdited(); changed();
  });

  // ---- symbols view: what to edit ----------------------------------------------------------------------------------------------
  const libOptions = sel => Object.entries(state.lib).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${v.name.replace(/</g, "&lt;")}</option>`).join("");
  function button(box, text, on, title, onClick) {
    const b = document.createElement("button"); b.type = "button";
    b.className = "btn btn-sm " + (on ? "btn-dark" : "btn-outline-secondary"); b.textContent = text; if (title) b.title = title;
    b.addEventListener("click", onClick); box.append(b);
  }
  function drawItems() {
    const id = symId(), sym = symbolOf(id);
    document.getElementById("sym-name").textContent = `${FORMS[form].title.replace(/s$/, "")} ${shapeName(shape)}` + (state.sym[id] ? " · edited" : sym.derived ? " · follows the rhyme form" : "");
    const pick = (type, i) => () => { active = isActive(type, i) ? null : { type, i }; drawItems(); drawCanvas(); drawCombos(); };
    const sb = document.getElementById("stroke-buttons"); sb.innerHTML = "";
    sym.strokes.forEach((s, i) => button(sb, "ABC"[i] || i + 1, isActive("stroke", i), "Edit this stroke, lock everything else", pick("stroke", i)));
    const mb = document.getElementById("mark-buttons"); mb.innerHTML = "";
    sym.marks.forEach((m, i) => { if (m) button(mb, markLabel(i), isActive("mark", i), "Edit this mark, lock everything else", pick("mark", i)); });
    const md = document.getElementById("mode-buttons"); md.innerHTML = "";
    for (const [k, text, title] of [["all", "Move all", "A drag moves the whole stroke"], ["a", "Start point", "A drag moves only the start point"], ["b", "End point", "A drag moves only the end point"]])
      button(md, text, mode === k, title, () => { mode = mode === k ? null : k; drawItems(); drawCanvas(); });
    const it = activeItem(sym), lib = document.getElementById("item-lib");
    document.getElementById("item-controls").hidden = !it;
    if (it) lib.innerHTML = libOptions(it.lib);
    document.getElementById("sym-reset").textContent = form === "centred" ? "Follow the rhyme form" : "Reset symbol";
    document.getElementById("sym-reset").disabled = !state.sym[id];
  }
  document.getElementById("item-lib").addEventListener("change", e => { begin(); activeItem(editableSymbol(symId())).lib = e.target.value; end(); markEdited(); drawItems(); changed(); });
  document.getElementById("turn-left").addEventListener("click", () => rotate(-5));
  document.getElementById("turn-right").addEventListener("click", () => rotate(5));
  document.getElementById("mark-opacity").addEventListener("input", e => { markOpacity = +e.target.value; drawCanvas(); });
  document.getElementById("sym-reset").addEventListener("click", () => { begin(); delete state.sym[symId()]; end(); markEdited(); drawItems(); changed(); });

  // ---- symbols view: combinations and sample ----------------------------------------------------------------------------------
  function drawCombos() {
    const box = document.getElementById("combos"); box.innerHTML = "";
    const cells = [], m = activeMark() !== null ? activeMark() + 1 : ctx.mark || 0, title = document.getElementById("combos-title");
    if (form === "rhyme") {
      cells.push([compose({ rhyme: shape, mark: m, tone: ctx.tone }), syllable("", shape, m, ctx.tone) || "alone"]);
      for (const o of SHAPES) cells.push([compose({ onset: o, rhyme: shape, mark: m, tone: ctx.tone }), syllable(o, shape, m, ctx.tone)]);
      title.textContent = `Rhyme ${shapeName(shape)} after every onset`;
    } else if (form === "onset") {
      const medial = activeMark() !== null;
      for (const r of SHAPES) cells.push([compose({ onset: shape, medial, rhyme: r, mark: ctx.mark, tone: ctx.tone }), syllable(shape, r, ctx.mark, ctx.tone)]);
      title.textContent = `Onset ${shapeName(shape)} before every rhyme` + (medial ? ", with the medial" : "");
    } else {
      for (const s of SHAPES) cells.push([compose({ rhyme: s, mark: m }), syllable("", s, m) || shapeName(s)]);
      title.textContent = "All centred forms" + (m ? ` with mark ${m}` : "");
    }
    for (const [ids, text] of cells) {
      const c = document.createElement("div"); c.className = "combo";
      c.append(glyph(ids));
      const lab = document.createElement("span"); lab.textContent = text; c.append(lab);
      box.append(c);
    }
    drawSample();
  }
  const vp = new VietnameseParser();
  function drawSample() {
    const box = document.getElementById("sample-out"); box.innerHTML = "";
    for (const w of document.getElementById("sample").value.split(/\s+/).filter(Boolean)) {
      const word = w.replace(/[.,;:!?"“”()]/g, "");
      let code = null;
      try { const r = vp.parse(word); code = r && r.qatt; } catch (e) { }
      if (!code) continue;
      const [initial, vowel, , tone] = code.split(","), mm = vowel.match(/^(w?)(.+?)(\d?)$/);
      const ids = compose({ onset: initial === "_" && !mm[1] ? "" : initial, medial: !!mm[1], rhyme: mm[2], mark: +mm[3] || 0, tone: +tone || 0 })
        .filter(id => target(id) || ORIG[id.replace(/^v2c-/, "v2-")]);
      if (!ids.length) continue;
      const g = glyph(ids); g.setAttribute("title", word); box.append(g);
    }
  }

  function drawSymbolView() { drawItems(); drawCanvas(); drawCombos(); }

  // ---- library view -------------------------------------------------------------------------------------------------------------
  // where a library stroke is used: [symbol id, stroke index or "m" + mark index]
  function usages(key) {
    const out = [];
    for (const f of Object.keys(FORMS)) for (const s of SHAPES) {
      const id = FORMS[f].id(s), sym = symbolOf(id);
      sym.strokes.forEach((it, i) => { if (it.lib === key) out.push([id, i]); });
      sym.marks.forEach((it, i) => { if (it && it.lib === key) out.push([id, "m" + i]); });
    }
    return out;
  }
  // the typical chord of a library stroke: average direction and length of its uses
  function libChord(key) {
    let dx = 0, dy = 0, n = 0;
    for (const [id, i] of usages(key)) {
      const sym = symbolOf(id), it = typeof i === "string" ? sym.marks[+i.slice(1)] : sym.strokes[i];
      dx += it.b[0] - it.a[0]; dy += it.b[1] - it.a[1]; n++;
    }
    if (!n) return [0, 50];
    return [dx / n, dy / n];
  }
  function libPreviewD(key, scale) {
    const [dx, dy] = libChord(key), L = Math.hypot(dx, dy) || 1, f = 70 * scale / L;
    const a = [50 - dx * f / 2, 40 - dy * f / 2], b = [50 + dx * f / 2, 40 + dy * f / 2];
    return B.outline(placed([{ lib: key, a, b }]), state.params, state.lib);
  }
  function drawLibList() {
    const list = document.getElementById("lib-list"); list.innerHTML = "";
    for (const [key, e] of Object.entries(state.lib).sort((a, b) => a[1].name.localeCompare(b[1].name))) {
      const cell = document.createElement("button"); cell.type = "button"; cell.className = "lib-cell" + (key === libSel ? " active" : "");
      const svg = el("svg", { viewBox: "0 -10 100 100", class: "glyph" }); el("path", { "data-lib": key, d: libPreviewD(key, 0.62) }, svg);
      const n = usages(key).length;
      cell.append(svg);
      const lab = document.createElement("span"); lab.innerHTML = `${e.name.replace(/</g, "&lt;")}<small>${n ? "used " + n + "×" : "unused"}</small>`; cell.append(lab);
      cell.addEventListener("click", () => { libSel = key; drawLibView(); });
      list.append(cell);
    }
  }
  const libCanvas = document.getElementById("lib-canvas");
  let libDrag = null, libRef = null;
  function drawLibCanvas() {
    libCanvas.innerHTML = "";
    const e = state.lib[libSel]; if (!e) return;
    const grid = el("g", { class: "grid" }, libCanvas);
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: -10, x2: v, y2: 100 }, grid); el("line", { x1: 0, y1: v - 10, x2: 100, y2: v - 10 }, grid); }
    if (!libRef) { const [dx, dy] = libChord(libSel), L = Math.hypot(dx, dy) || 1, f = 60 / L; libRef = { a: [50 - dx * f / 2, 40 - dy * f / 2], b: [50 + dx * f / 2, 40 + dy * f / 2] }; }
    const st = placed([{ lib: libSel, a: libRef.a, b: libRef.b }]);
    el("path", { d: B.outline(st, state.params, state.lib), class: "stroke current" }, libCanvas);
    const s = st[0].s[0], h = el("g", { class: "handles" }, libCanvas);
    el("line", { x1: s[0], y1: s[1], x2: s[6], y2: s[7], class: "chord" }, h);
    el("path", { d: B.skeleton(st), class: "skel" }, h);
    el("line", { x1: s[0] + (s[6] - s[0]) / 3, y1: s[1] + (s[7] - s[1]) / 3, x2: s[2], y2: s[3] }, h);
    el("line", { x1: s[0] + (s[6] - s[0]) * 2 / 3, y1: s[1] + (s[7] - s[1]) * 2 / 3, x2: s[4], y2: s[5] }, h);
    for (const [k, x, y] of [["h1", s[2], s[3]], ["h2", s[4], s[5]]]) {
      const r = el("rect", { x: x - 1.6, y: y - 1.6, width: 3.2, height: 3.2, class: "ctrl" }, h);
      r.addEventListener("pointerdown", ev => { ev.preventDefault(); begin(); libDrag = { k }; libCanvas.setPointerCapture(ev.pointerId); });
    }
    for (const k of ["a", "b"]) {
      const c = el("circle", { cx: libRef[k][0], cy: libRef[k][1], r: 2, class: k === "a" ? "start" : "" }, h);
      c.addEventListener("pointerdown", ev => { ev.preventDefault(); libDrag = { end: k }; libCanvas.setPointerCapture(ev.pointerId); });
    }
  }
  libCanvas.addEventListener("pointermove", ev => {
    if (!libDrag) return;
    const p = toSvg(libCanvas, ev);
    if (libDrag.end) { libRef[libDrag.end] = [p.x, p.y]; drawLibCanvas(); return; }
    // bend: the distance of the handle from the chord, in units of its length, to the left of the writing direction
    const { a, b } = libRef, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    state.lib[libSel][libDrag.k] = Math.round(((p.x - a[0]) * dy / L - (p.y - a[1]) * dx / L) / L * 1000) / 1000;
    changed(); drawLibFields();
  });
  const stopLibDrag = () => { if (!libDrag) return; if (libDrag.k) end(); libDrag = null; };
  libCanvas.addEventListener("pointerup", stopLibDrag);
  libCanvas.addEventListener("pointercancel", stopLibDrag);

  const PRESET_FIELDS = [["h1", "Bend, first third", -0.3, 0.3], ["h2", "Bend, second third", -0.3, 0.3],
    ["w0", "Start width", 0, 1.6], ["ws", "Start press", 0, 1.6], ["sd", "Start press distance", 0, 3], ["bs", "Start press shift", -1, 1],
    ["wm", "Middle width", 0, 1.6], ["we", "End press", 0, 1.6], ["ed", "End press distance", 0, 3], ["be", "End press shift", -1, 1], ["w1", "End width", 0, 1.6],
    ["capS", "Start cap", 0, 1.5], ["capE", "End cap", 0, 1.5], ["skS", "Start cap shift", -1, 1], ["skE", "End cap shift", -1, 1]];
  function slider(box, label, value, min, max, step, onInput) {
    const row = document.createElement("label"); row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector("input"), out = row.querySelector("output"), fmt = v => (+v).toFixed(step < 1 ? (step < 0.01 ? 3 : 2) : 0);
    input.value = value; out.textContent = fmt(value);
    input.addEventListener("input", () => { begin(); onInput(+input.value); out.textContent = fmt(input.value); changed(); });
    input.addEventListener("change", () => end());
    box.append(row);
  }
  function drawLibFields() {
    const e = state.lib[libSel], box = document.getElementById("lib-fields"); box.innerHTML = "";
    for (const [k, name, min, max] of PRESET_FIELDS) slider(box, name, e[k] || 0, min, max, k[0] === "h" ? 0.005 : 0.01, v => e[k] = v);
  }
  function drawLibUses() {
    const box = document.getElementById("lib-uses"); box.innerHTML = "";
    const seen = new Set();
    for (const [id, i] of usages(libSel)) {
      const c = document.createElement("div"); c.className = "combo";
      const t = typeof i === "string" ? markIds(id, +i.slice(1)) : id;
      const s = id.match(/^v2c?-(.+?)(-small)?$/)[1];
      c.append(glyph(typeof i === "string" ? [t] : [id], typeof i === "string" ? [id] : []));
      const lab = document.createElement("span");
      lab.textContent = (id.startsWith("v2c-") ? "centred " : id.endsWith("-small") ? "onset " : "rhyme ") + shapeName(s) + (typeof i === "string" ? " · " + (id.endsWith("-small") ? "medial" : "mark " + (+i.slice(1) + 1)) : "");
      c.append(lab);
      c.title = "Open this symbol";
      c.addEventListener("click", () => { form = id.startsWith("v2c-") ? "centred" : id.endsWith("-small") ? "onset" : "rhyme"; shape = s; active = typeof i === "string" ? { type: "mark", i: +i.slice(1) } : { type: "stroke", i }; setView("symbols"); });
      if (!seen.has(t)) { seen.add(t); box.append(c); }
    }
    document.getElementById("lib-uses-title").textContent = box.children.length ? `Used in ${usages(libSel).length} places` : "Not used yet";
  }
  function drawLibView() {
    libRef = null;
    drawLibList();
    const e = state.lib[libSel];
    document.getElementById("lib-name").value = e.name;
    document.getElementById("lib-delete").disabled = usages(libSel).length > 0;
    drawLibCanvas(); drawLibFields(); drawLibUses();
  }
  document.getElementById("lib-name").addEventListener("input", e => { begin(); state.lib[libSel].name = e.target.value || "Unnamed"; });
  document.getElementById("lib-name").addEventListener("change", () => { end(); drawLibList(); });
  document.getElementById("lib-copy").addEventListener("click", () => {
    begin(); const key = "s" + Date.now().toString(36);
    state.lib[key] = Object.assign(clone(state.lib[libSel]), { name: state.lib[libSel].name + " (copy)" });
    end(); libSel = key; drawLibView();
  });
  document.getElementById("lib-delete").addEventListener("click", () => {
    if (usages(libSel).length || Object.keys(state.lib).length < 2) return;
    begin(); delete state.lib[libSel]; end(); libSel = Object.keys(state.lib)[0]; drawLibView();
  });
  document.getElementById("lib-reset").addEventListener("click", () => {
    if (!DEF.lib[libSel]) return;
    begin(); state.lib[libSel] = Object.assign(clone(DEF.lib[libSel]), { name: state.lib[libSel].name }); end(); drawLibView(); changed();
  });

  // ---- brush settings, context, storage -----------------------------------------------------------------------------------------
  function drawParams() {
    const box = document.getElementById("params"); box.innerHTML = "";
    for (const [k, name, min, max, step] of [["weight", "Weight", 3, 12, 0.1], ["contrast", "Contrast", 0, 0.8, 0.01], ["nib", "Nib angle", -60, 60, 1]])
      slider(box, name, state.params[k], min, max, step, v => state.params[k] = v);
  }
  document.getElementById("params-reset").addEventListener("click", () => { begin(); state.params = fresh().params; end(); drawParams(); changed(); });
  function drawContext() {
    const opts = (list, none) => `<option value="">${none}</option>` + list.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    const o = document.getElementById("ctx-onset"), r = document.getElementById("ctx-rhyme"), m = document.getElementById("ctx-mark"), t = document.getElementById("ctx-tone");
    o.innerHTML = opts(SHAPES.map(s => [s, shapeName(s)]), "none"); o.value = ctx.onset;
    r.innerHTML = opts(SHAPES.map(s => [s, shapeName(s)]), "none"); r.value = ctx.rhyme;
    m.innerHTML = opts([1, 2, 3, 4, 5, 6].map(v => [v, v]), "none"); m.value = ctx.mark || "";
    t.innerHTML = opts([1, 2, 3, 4, 5, 6, 7, 8].map(v => [v, TONES[v]]), "none"); t.value = ctx.tone || "";
  }
  for (const [key, num] of [["onset"], ["rhyme"], ["mark", 1], ["tone", 1]]) {
    const e = document.getElementById("ctx-" + key);
    e.addEventListener("change", () => { ctx[key] = num ? +e.value || 0 : e.value; drawCanvas(); drawCombos(); });
  }

  function exportJson() {
    const outlines = {};
    for (const id of Object.keys(ORIG)) {
      if (!/^(v2-|qt|qs)/.test(id)) continue;
      outlines[id] = outlineOf(id);
      const c = "v2c-" + id.slice(3);
      if (id.startsWith("v2-") && (ORIG[c] || target(c))) outlines[c] = outlineOf(c);
    }
    const data = { format: "qatt-brush", version: 2, params: state.params, lib: state.lib, sym: state.sym, outlines };
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = "qatt-brush.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  document.getElementById("export").addEventListener("click", exportJson);
  document.getElementById("import").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (d.format !== "qatt-brush" || d.version !== 2) throw new Error("not a qatt-brush file of this version");
      begin(); end(); restore(JSON.stringify({ params: d.params, lib: d.lib, sym: d.sym }));
    } catch (err) { alert("Import failed: " + err.message); }
    e.target.value = "";
  });
  document.getElementById("reset-all").addEventListener("click", () => {
    if (!confirm("Discard all changes (symbols, library and brush settings)?")) return;
    begin(); end(); restore(JSON.stringify(fresh()));
  });
  document.getElementById("undo").addEventListener("click", doUndo);
  document.getElementById("redo").addEventListener("click", doRedo);
  for (const key of ["orig", "snap"]) {
    const c = document.getElementById("view-" + key); c.checked = viewOpt[key];
    c.addEventListener("change", () => { viewOpt[key] = c.checked; drawCanvas(); });
  }

  // ---- start ------------------------------------------------------------------------------------------------------------------
  function setView(v) {
    view = v;
    document.querySelectorAll("#views button").forEach(b => b.classList.toggle("active", b.dataset.view === v));
    document.querySelectorAll("[data-only]").forEach(e => e.hidden = e.dataset.only !== v);
    if (v === "symbols") { drawSymbolList(); drawSymbolView(); } else drawLibView();
  }
  document.querySelectorAll("#views button").forEach(b => b.addEventListener("click", () => setView(b.dataset.view)));
  document.querySelectorAll("#forms button").forEach(b => b.addEventListener("click", () => { form = b.dataset.form; fixActive(); drawSymbolList(); drawSymbolView(); }));
  document.getElementById("sample").addEventListener("input", drawSample);
  document.getElementById("size").addEventListener("input", e => document.documentElement.style.setProperty("--combo", e.target.value + "px"));

  function renderAll() { drawParams(); drawContext(); setView(view); }
  renderAll();
})();
