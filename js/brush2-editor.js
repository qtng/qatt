// Editor of brush2.html. Two views:
// - Symbols: each of the 66 symbols (22 shapes as rhyme, onset and centred form) is three strokes from the library between
//   two end points, plus its marks (six for the rhyme and the centred form, the medial for the onset form).
// - Stroke library: named strokes (bend, kind of the two ends and gradient of the width) used by the symbols; the brush
//   (weight, flat ends, pointed ends, kihitsu) is the same for all of them.
// Everything is kept in localStorage and can be exported and imported as JSON (the export also holds the finished outlines).
(() => {
  const B = QattBrush, B2 = QattBrush2;
  const SVGNS = "http://www.w3.org/2000/svg";
  const STORE = "qatt-brush2-v2";
  const SHAPES = VietnameseParser.SHAPES.map(s => s === "z" ? "_" : s);
  const TABLE = VietnameseParser.DECODINGS.qatt;
  const TONES = ["", "sắc", "huyền", "hỏi", "ngã", "nặng", "sắc (nhập)", "nặng (nhập)", "ngang"];
  const VIEWBOX = "0 0 100 100";   // the cell of a glyph in the font: the em box of Noto Sans CJK, 100 x 100 svg units -> 1000 x 1000 font units (10 per unit)
  const ICF_T = 4.2, ICF_H = 91.6;   // the ICF box of Noto Sans CJK: top and height in svg units
  const clone = o => JSON.parse(JSON.stringify(o));
  // older states: mirrored kihitsu was a flag, the angle of a form was an absolute value instead of an offset
  const PLACE = { x: -1.1, y: 7.9, s: 95.3 };   // global placement of the drawing in the cell: offset x, y (svg units) and scale (%); 0..100 -> the ICF box of Noto Sans CJK
  const migrate = st => {
    st.place = Object.assign({}, PLACE, st.place);
    if ((st.place.x === 4.2 && st.place.y === 4.2 && st.place.s === 91.6) || (st.place.x === -1.7 && st.place.y === -3 && st.place.s === 103.4) || (st.place.x === 0.4 && st.place.y === 6.1 && st.place.s === 99.3)) st.place = Object.assign({}, PLACE);   // earlier defaults
    for (const k of ["h", "v"]) { const g = (st.guides = st.guides || {})[k] || []; while (g.length < 6) g.push(null); g.length = 6; st.guides[k] = g; }
    if (st.offsets) return st;
    for (const e of Object.values(st.lib || {})) {
      for (const [k, own, inv] of [["s", "sa", "si"], ["e", "ea", "ei"]]) {
        if (e[k] === "kihitsu-inv") e[k] = "kihitsu";
        delete e[inv];
        if (typeof e[own] === "number") { const d = e[own] - ((st.params || {}).kihitsuAngle ?? 20); if (d) e[own] = d; else delete e[own]; }
      }
    }
    st.offsets = true;
    return st;
  };

  // ---- the model: original paths, default library and symbols (js/brush-model.js) ----------------------------------------------
  const ORIG = {};
  new DOMParser().parseFromString(defaultSvgDefs, "image/svg+xml").querySelectorAll("path[id]").forEach(p => ORIG[p.id] = p.getAttribute("d"));
  fetch("/fonts/brush.json").then(r => r.ok ? r.json() : null).catch(() => null).then(base => start(base));

  function start(base) {
  const M = QattBrush2Model(B, B2, SHAPES, ORIG, base), DEF = M.DEF, original = M.original, centred = M.centred, target = M.target;

  // ---- state, history, storage --------------------------------------------------------------------------------------------------
  const fresh = () => ({ params: clone(B2.DEFAULT_PARAMS), lib: clone(DEF.lib), sym: {}, offsets: true, place: clone(PLACE), guides: { h: Array(6).fill(null), v: Array(6).fill(null) } });
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.lib && s.sym) state = migrate(Object.assign(fresh(), s)); } catch (e) { }
  const undo = [], redo = [];
  let pending = false, saveTimer = null;
  const begin = () => { if (!pending) { undo.push(JSON.stringify(state)); if (undo.length > 200) undo.shift(); redo.length = 0; pending = true; } };
  const end = () => { pending = false; save(); };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }, 300); };
  const restore = json => { state = migrate(Object.assign(fresh(), JSON.parse(json))); if (!state.lib[libSel]) libSel = Object.keys(state.lib)[0]; save(); renderAll(); };
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(state)); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(state)); restore(redo.pop()); }

  // ---- symbols and outlines ----------------------------------------------------------------------------------------------------
  const symbolOf = id => M.symbolOf(state, id);
  function editableSymbol(id) {
    if (!state.sym[id]) { state.sym[id] = clone(symbolOf(id)); delete state.sym[id].derived; }
    return state.sym[id];
  }
  const placed = items => M.placed(state, items);
  const itemD = it => B2.outline(placed([it]), state.params);
  const strokesOf = id => M.strokesOf(state, id);
  const cache = new Map();
  function outlineOf(id) {
    if (!cache.has(id)) cache.set(id, M.outline(state, id));
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
  const placeTransform = () => `translate(${state.place.x} ${state.place.y}) scale(${state.place.s / 100})`;
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function glyph(ids, faint) {
    const svg = el("svg", { viewBox: VIEWBOX, class: "glyph" });
    const g = el("g", { transform: placeTransform() }, svg);
    for (const id of faint || []) el("path", { "data-id": id, d: outlineOf(id), class: "faint" }, g);
    for (const id of ids) el("path", { "data-id": id, d: outlineOf(id) }, g);
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
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: 0, x2: v, y2: 100 }, grid); el("line", { x1: 0, y1: v, x2: 100, y2: v }, grid); }
    el("rect", { x: 4.2, y: 4.2, width: 91.6, height: 91.6, class: "box" }, grid);   // ICF box of Noto Sans CJK (font x 42..958, y -78..838)
    el("rect", { x: 0, y: 0, width: 100, height: 100, class: "window" }, grid);   // the font cell (VIEWBOX)
    // Noto Sans CJK, measured over all unified ideographs of Noto Sans JP: dense glyphs (font x 34..966, y -80..842) and the outermost overshoot (x 13..987, y -96..855)
    const fx = u => u / 10, fy = u => (880 - u) / 10;
    el("rect", { x: fx(34), y: fy(842), width: (966 - 34) / 10, height: (842 + 80) / 10, class: "noto" }, grid);
    el("rect", { x: fx(13), y: fy(855), width: (987 - 13) / 10, height: (855 + 96) / 10, class: "noto limit" }, grid);
    el("line", { x1: 0, y1: 88, x2: 100, y2: 88, class: "base" }, grid);   // romn baseline (font y 0); the ideographic baseline (-120) is the lower edge of the cell
    const content = el("g", { class: "content", transform: placeTransform() }, canvas);   // everything that is drawn, edited and exported lies in this placement
    el("rect", { x: 0, y: 0, width: 100, height: 100, class: "letterwin" }, content);   // the old 0..100 window of the letters of qatt.js
    for (const y of state.guides.h) if (y !== null) el("line", { x1: -15, y1: y, x2: 115, y2: y, class: "gline" }, content);
    for (const x of state.guides.v) if (x !== null) el("line", { x1: x, y1: -30, x2: x, y2: 115, class: "gline" }, content);
    const id = symId(), sym = symbolOf(id), ctxIds = contextIds();
    for (const c of ctxIds) el("path", { "data-id": c, d: outlineOf(c), class: "ctx" }, content);
    if (viewOpt.orig) for (const c of [id, ...sym.marks.map((m, i) => markIds(id, i))].concat(ctxIds)) {
      const o = c.startsWith("v2c-") ? B.skeleton(B.transform(original("v2-" + c.slice(4)), centred)) : ORIG[c];
      if (o) el("path", { d: o, class: "orig" }, content);
    }
    sym.marks.forEach((m, i) => {
      if (!m) return;
      const p = el("path", { d: itemD(m), class: "mark" + (isActive("mark", i) ? " current" : "") }, content);
      if (!isActive("mark", i)) p.style.opacity = markOpacity;
    });
    sym.strokes.forEach((s, i) => el("path", { d: itemD(s), class: "stroke" + (isActive("stroke", i) ? " current" : "") }, content));
    for (const [x1, y1, x2, y2] of guides) el("line", { x1, y1, x2, y2, class: "guide" }, content);
    const it = activeItem(sym);
    if (!it) return;
    const h = el("g", { class: "handles" }, content);
    el("line", { x1: it.a[0], y1: it.a[1], x2: it.b[0], y2: it.b[1] }, h);
    for (const end of ["a", "b"]) el("circle", { cx: it[end][0], cy: it[end][1], r: 1.9, class: (end === "a" ? "start" : "") + (mode === end || mode === "all" ? " on" : "") }, h);
  }

  const toSvg = (node, e) => { const p = (node.ownerSVGElement || node).createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(node.getScreenCTM().inverse()); };
  const canvasPoint = e => toSvg(canvas.querySelector(".content") || canvas, e);   // in the coordinates of the drawing (inside the placement)
  const round = v => Math.round(v * 4) / 4;
  function snapTargets(skip) {
    const xs = [], ys = [];
    const add = p => { xs.push(p[0]); ys.push(p[1]); };
    for (const x of state.guides.v) if (x !== null) xs.push(x);
    for (const y of state.guides.h) if (y !== null) ys.push(y);
    const sym = symbolOf(symId());
    sym.strokes.forEach(it => { if (it !== skip) { add(it.a); add(it.b); } });
    for (const c of contextIds()) for (const st of strokesOf(c)) { const s0 = st.c || st.s[0], s1 = st.c || st.s[st.s.length - 1]; add([s0[0], s0[1]]); add([s1[6], s1[7]]); }
    return { xs, ys };
  }
  // a drag anywhere on the canvas moves the active stroke or mark as the mode says
  canvas.addEventListener("pointerdown", e => {
    if (!mode || !active || !activeItem(symbolOf(symId()))) return;
    e.preventDefault();
    begin();
    const it = activeItem(editableSymbol(symId()));
    drag = { it, end: mode === "all" ? null : mode, a: it.a.slice(), b: it.b.slice(), start: canvasPoint(e), targets: snapTargets(it), mark: active.type === "mark" };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = canvasPoint(e);
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
  // one line of glyphs above the canvas, no labels: the symbol with every onset, rhyme or mark, to check the strokes
  function drawCombos() {
    const box = document.getElementById("combos"); box.innerHTML = "";
    const cells = [], m = activeMark() !== null ? activeMark() + 1 : ctx.mark || 0;
    if (form === "rhyme") {
      cells.push(compose({ rhyme: shape, mark: m, tone: ctx.tone }));
      for (const o of SHAPES) cells.push(compose({ onset: o, rhyme: shape, mark: m, tone: ctx.tone }));
    } else if (form === "onset") {
      const medial = activeMark() !== null;
      for (const r of SHAPES) cells.push(compose({ onset: shape, medial, rhyme: r, mark: ctx.mark, tone: ctx.tone }));
    } else for (const s of SHAPES) cells.push(compose({ rhyme: s, mark: m }));
    for (const ids of cells) box.append(glyph(ids));
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
    return B2.outline(placed([{ lib: key, a, b }]), state.params);
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
  let libDrag = null, libRef = null, handleOpacity = 0.5;
  function drawLibCanvas() {
    libCanvas.innerHTML = "";
    const e = state.lib[libSel]; if (!e) return;
    const grid = el("g", { class: "grid" }, libCanvas);
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: -10, x2: v, y2: 100 }, grid); el("line", { x1: 0, y1: v - 10, x2: 100, y2: v - 10 }, grid); }
    if (!libRef) { const [dx, dy] = libChord(libSel), L = Math.hypot(dx, dy) || 1, f = 60 / L; libRef = { a: [50 - dx * f / 2, 40 - dy * f / 2], b: [50 + dx * f / 2, 40 + dy * f / 2] }; }
    const st = placed([{ lib: libSel, a: libRef.a, b: libRef.b }]);
    el("path", { d: B2.outline(st, state.params), class: "stroke" }, libCanvas);
    const c = st[0].c, lines = el("g", { class: "handles" }, libCanvas);
    lines.style.opacity = handleOpacity;
    el("line", { x1: c[0], y1: c[1], x2: c[6], y2: c[7], class: "chord" }, lines);
    el("path", { d: B2.skeleton(st), class: "skel" }, lines);
    const h = el("g", { class: "handles" }, libCanvas);
    h.style.opacity = handleOpacity;
    const mid = [0.125 * c[0] + 0.375 * c[2] + 0.375 * c[4] + 0.125 * c[6], 0.125 * c[1] + 0.375 * c[3] + 0.375 * c[5] + 0.125 * c[7]];
    const r = el("rect", { x: mid[0] - 1.6, y: mid[1] - 1.6, width: 3.2, height: 3.2, class: "ctrl" }, h);
    r.addEventListener("pointerdown", ev => { ev.preventDefault(); begin(); libDrag = { k: "bend" }; libCanvas.setPointerCapture(ev.pointerId); });
    for (const k of ["a", "b"]) {
      const o = el("circle", { cx: libRef[k][0], cy: libRef[k][1], r: 2, class: k === "a" ? "start" : "" }, h);
      o.addEventListener("pointerdown", ev => { ev.preventDefault(); libDrag = { end: k }; libCanvas.setPointerCapture(ev.pointerId); });
    }
  }
  document.getElementById("handle-opacity").addEventListener("input", e => { handleOpacity = +e.target.value; drawLibCanvas(); });
  libCanvas.addEventListener("pointermove", ev => {
    if (!libDrag) return;
    const p = toSvg(libCanvas, ev);
    if (libDrag.end) { libRef[libDrag.end] = [p.x, p.y]; drawLibCanvas(); return; }
    // bend: the distance of the handle from the chord, in units of its length, to the left of the writing direction
    const { a, b } = libRef, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    state.lib[libSel].bend = Math.max(-0.5, Math.min(0.5, Math.round(((p.x - a[0]) * dy / L - (p.y - a[1]) * dx / L) / L * 200) / 200));
    changed(); drawLibFields();
  });
  const stopLibDrag = () => { if (!libDrag) return; if (libDrag.k) end(); libDrag = null; };
  libCanvas.addEventListener("pointerup", stopLibDrag);
  libCanvas.addEventListener("pointercancel", stopLibDrag);

  function slider(box, label, value, min, max, step, onInput, fmt) {
    const row = document.createElement("label"); row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector("input"), out = row.querySelector("output"), show = v => fmt ? fmt(+v) : (+v).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0);
    input.value = value; out.textContent = show(value);
    input.addEventListener("input", () => { begin(); onInput(+input.value); out.textContent = show(input.value); changed(); });
    input.addEventListener("change", () => end());
    box.append(row);
  }
  const kindSelect = (box, label, e, key) => {
    const row = document.createElement("label"); row.className = "slider kind";
    row.innerHTML = `<span>${label}</span><select class="form-select form-select-sm">${Object.entries(B2.KINDS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><output></output>`;
    const sel = row.querySelector("select"); sel.value = e[key] || "flat";
    sel.addEventListener("change", () => { begin(); e[key] = sel.value; end(); drawLibFields(); changed(); });
    box.append(row);
  };
  function drawLibFields() {
    const e = state.lib[libSel], box = document.getElementById("lib-fields"); box.innerHTML = "";
    kindSelect(box, "Start", e, "s"); kindSelect(box, "End", e, "e");
    slider(box, "Bend", e.bend || 0, -0.3, 0.3, 0.005, v => e.bend = v, v => v.toFixed(3));
    // kihitsu angle of one end: an offset added to the global angle of the brush
    for (const [key, own, label] of [["s", "sa", "Start angle offset"], ["e", "ea", "End angle offset"]])
      if (/^kihitsu/.test(e[key])) slider(box, label, e[own] || 0, -45, 45, 1, v => { if (v) e[own] = v; else delete e[own]; }, v => (v > 0 ? "+" : "") + v + "°");
    if ((e.s === "point") !== (e.e === "point"))
      slider(box, "Gradient", e.g || 0, -1, 1, 0.01, v => e.g = v, v => v < -0.005 ? "full " + (-v).toFixed(2) : v > 0.005 ? "slim " + v.toFixed(2) : "linear");
  }
  // every symbol that holds the stroke, as glyphs without labels (a click opens the symbol)
  function drawLibUses() {
    const box = document.getElementById("lib-uses"); box.innerHTML = "";
    const seen = new Set();
    for (const [id, i] of usages(libSel)) {
      const mark = typeof i === "string", t = mark ? markIds(id, +i.slice(1)) : id;
      if (seen.has(t)) continue;
      seen.add(t);
      const s = id.match(/^v2c?-(.+?)(-small)?$/)[1], g = glyph(mark ? [t] : [id], mark ? [id] : []);
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", "Open this symbol");
      g.addEventListener("click", () => { form = id.startsWith("v2c-") ? "centred" : id.endsWith("-small") ? "onset" : "rhyme"; shape = s; active = mark ? { type: "mark", i: +i.slice(1) } : { type: "stroke", i }; setView("symbols"); });
      box.append(g);
    }
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
  const PARAM_FIELDS = [["weight", "Weight", 3, 12, 0.1], ["flatWidth", "Flat end: width", 0.3, 1.6, 0.01], ["flatAngle", "Flat end: angle", -60, 60, 1],
    ["pointRadius", "Pointed end: radius", 0, 0.3, 0.005], ["kihitsuSize", "Kihitsu: size", 0.5, 3, 0.01], ["kihitsuAngle", "Kihitsu: angle", -60, 60, 1]];
  // the placement that puts the ink of a syllable (the onset forms on the left, the rhyme forms on the right, both as drawn) into the ICF box, centred, as large as it can be
  function fitPlace() {
    const tmp = el("svg", { width: 0, height: 0, style: "position:absolute" }, document.body), path = el("path", {}, tmp);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const f of [FORMS.onset, FORMS.rhyme]) for (const sh of SHAPES) {
      path.setAttribute("d", outlineOf(f.id(sh)));
      const b = path.getBBox(); if (!b.height) continue;
      x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.width); y1 = Math.max(y1, b.y + b.height);
    }
    tmp.remove();
    if (!(x1 > x0 && y1 > y0)) return null;
    const sc = Math.min(ICF_H / (x1 - x0), ICF_H / (y1 - y0)), r = v => Math.round(v * 10) / 10, mid = ICF_T + ICF_H / 2;
    return { x: r(mid - sc * (x0 + x1) / 2), y: r(mid - sc * (y0 + y1) / 2), s: r(sc * 100) };
  }
  function drawParams() {
    const box = document.getElementById("params"); box.innerHTML = "";
    for (const [k, name, min, max, step] of PARAM_FIELDS) slider(box, name, state.params[k], min, max, step, v => state.params[k] = v);
    // guides: positions are typed in; empty = off; the canvas and the snapping use them
    for (const [k, name] of [["h", "Horizontal guides (y)"], ["v", "Vertical guides (x)"]]) {
      const row = document.createElement("div"); row.className = "guide-row";
      row.innerHTML = `<span>${name}</span><div>${[0, 1, 2, 3, 4, 5].map(i => `<input type="number" step="0.25" class="form-control form-control-sm" aria-label="${name} ${i + 1}">`).join("")}</div>`;
      row.querySelectorAll("input").forEach((inp, i) => {
        if (state.guides[k][i] !== null) inp.value = state.guides[k][i];
        inp.addEventListener("input", () => { begin(); state.guides[k][i] = inp.value === "" || isNaN(+inp.value) ? null : +inp.value; drawCanvas(); });
        inp.addEventListener("change", () => end());
      });
      box.append(row);
    }
    // placement: offset and scale of the whole drawing in the cell (the letters of qatt.js lie in 0..100, the ICF box is 4.2..95.8)
    const prow = document.createElement("div"); prow.className = "guide-row";
    prow.innerHTML = `<span>Placement of the drawing: offset x, offset y (svg units), scale (%)</span><div>${[["x", 0.1], ["y", 0.1], ["s", 0.1]].map(([k, st]) => `<input type="number" step="${st}" class="form-control form-control-sm" aria-label="Placement ${k}" value="${state.place[k]}">`).join("")}</div>`;
    prow.querySelectorAll("input").forEach((inp, i) => {
      const k = "xys"[i];
      inp.addEventListener("input", () => { if (inp.value === "" || isNaN(+inp.value) || (k === "s" && +inp.value <= 0)) return; begin(); state.place[k] = +inp.value; setView(view); });
      inp.addEventListener("change", () => end());
    });
    const reset = document.createElement("button"); reset.type = "button"; reset.className = "btn btn-link btn-sm p-0"; reset.textContent = "Reset placement";
    reset.addEventListener("click", () => { begin(); state.place = clone(PLACE); end(); renderAll(); });
    const fit = document.createElement("button"); fit.type = "button"; fit.className = "btn btn-outline-secondary btn-sm mt-2 me-2"; fit.textContent = "Fit to ICF box";
    fit.title = "Measures the ink of a syllable (all onset forms and all rhyme forms side by side) and scales and moves the drawing so that it is centred in the ICF box and touches its edges";
    fit.addEventListener("click", () => { const f = fitPlace(); if (!f) return; begin(); state.place = f; end(); renderAll(); });
    box.append(prow, fit, reset);
  }
  document.getElementById("params-reset").addEventListener("click", () => { begin(); state.params = fresh().params; state.guides = fresh().guides; end(); drawParams(); changed(); });
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
    const data = { format: "qatt-brush", version: 3, params: state.params, guides: state.guides, place: state.place, lib: state.lib, sym: state.sym, outlines };
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
      if (d.format !== "qatt-brush" || d.version !== 3) throw new Error("not an export of brush2.html (version 3)");
      begin(); end(); restore(JSON.stringify({ params: Object.assign(fresh().params, d.params), guides: d.guides || fresh().guides, place: d.place, offsets: true, lib: d.lib, sym: d.sym }));
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

  // size of the comparison glyphs: four next to each other on a phone
  const cmp = document.querySelectorAll(".cmp-size");
  const setSize = v => { document.documentElement.style.setProperty("--cg", v + "px"); cmp.forEach(c => c.value = v); };
  cmp.forEach(c => c.addEventListener("input", () => setSize(+c.value)));
  setSize(innerWidth < 576 ? Math.floor((innerWidth - 60) / 2) : 80);

  function renderAll() { drawParams(); drawContext(); setView(view); }
  renderAll();
  }
})();
