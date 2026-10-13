// Editor of brush2.html. Each of the 66 symbols (22 shapes as rhyme, onset and centred form) is three strokes between two end
// points, plus its marks (six for the rhyme and the centred form, the medial for the onset form). Per stroke: the position of
// its end points, its bend, the kind of its two ends and the gradient of its width. The brush itself (weight, flat ends, pointed
// ends, kihitsu) is the same for all strokes. Everything is kept in localStorage and can be exported and imported as JSON.
(() => {
  const B = QattBrush, B2 = QattBrush2;
  const SVGNS = "http://www.w3.org/2000/svg";
  const STORE = "qatt-brush2-v1";
  const SHAPES = VietnameseParser.SHAPES.map(s => s === "z" ? "_" : s);
  const TABLE = VietnameseParser.DECODINGS.qatt;
  const TONES = ["", "sắc", "huyền", "hỏi", "ngã", "nặng", "sắc (nhập)", "nặng (nhập)", "ngang"];
  const VIEWBOX = "-14 -28 128 136";   // the glyph box of qatt.js with room for the tone marks in the corners
  const clone = o => JSON.parse(JSON.stringify(o));

  // start: the symbols of the last export of brush.html (font/brush.json) are converted, this is the base of the model
  const ORIG = {};
  new DOMParser().parseFromString(defaultSvgDefs, "image/svg+xml").querySelectorAll("path[id]").forEach(p => ORIG[p.id] = p.getAttribute("d"));
  fetch("font/brush.json").then(r => r.ok ? r.json() : null).catch(() => null).then(base => start(base));

  function start(base) {
  const M = QattBrush2Model(B, B2, SHAPES, ORIG, base), target = M.target, centred = M.centred;

  // ---- state, history, storage --------------------------------------------------------------------------------------------------
  const fresh = () => ({ params: clone(B2.DEFAULT_PARAMS), sym: {} });
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.params && s.sym) state = Object.assign(fresh(), s); } catch (e) { }
  const undo = [], redo = [];
  let pending = false, saveTimer = null;
  const begin = () => { if (!pending) { undo.push(JSON.stringify(state)); if (undo.length > 200) undo.shift(); redo.length = 0; pending = true; } };
  const end = () => { pending = false; save(); };
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }, 300); };
  const restore = json => { state = Object.assign(fresh(), JSON.parse(json)); save(); renderAll(); };
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(state)); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(state)); restore(redo.pop()); }

  // ---- symbols and outlines ----------------------------------------------------------------------------------------------------
  const symbolOf = id => M.symbolOf(state, id);
  function editableSymbol(id) {
    if (!state.sym[id]) { state.sym[id] = clone(symbolOf(id)); delete state.sym[id].derived; }
    return state.sym[id];
  }
  const strokesOf = id => M.strokesOf(state, id);
  const itemD = it => B2.outline(M.placed([it]), state.params);
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
      drawCanvas();
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
  // mode: what a drag anywhere on the canvas moves ("all", "a" the start point, "b" the end point, "bend"), null = no editing
  let form = "rhyme", shape = "ng", active = { type: "stroke", i: 0 }, mode = null, markOpacity = 0.3;
  const ctx = { onset: "t", rhyme: "ng", mark: 2, tone: 0 };
  const FORMS = { rhyme: { title: "Rhyme forms", id: s => "v2-" + s }, onset: { title: "Onset forms", id: s => `v2-${s}-small` }, centred: { title: "Centred forms", id: s => "v2c-" + s } };
  const symId = () => FORMS[form].id(shape);
  const markLabel = i => form === "onset" ? "Medial" : String(i + 1);
  const isActive = (type, i) => active && active.type === type && active.i === i;
  const activeMark = () => active && active.type === "mark" ? active.i : null;
  const activeItem = sym => active && (active.type === "mark" ? sym.marks : sym.strokes)[active.i];
  function fixActive() { if (active && !activeItem(symbolOf(symId()))) active = null; }

  function selectSymbol(s) { shape = s; fixActive(); drawSymbolList(); drawSymbolView(); }

  // ---- symbols: list ------------------------------------------------------------------------------------------------------------
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

  // ---- symbols: canvas ---------------------------------------------------------------------------------------------------------
  const canvas = document.getElementById("canvas");
  let drag = null, guides = [];
  const viewOpt = { orig: false, snap: true };

  function contextIds() {
    if (form === "rhyme") return compose({ onset: ctx.onset, rhyme: shape, tone: ctx.tone }, true).filter(id => id !== symId());
    if (form === "onset") return compose({ onset: shape, rhyme: ctx.rhyme, mark: ctx.mark, tone: ctx.tone }, true).filter(id => id !== symId());
    return [];
  }
  const markIds = (id, n) => { const t = id.match(/^(v2c?)-(.+?)(-small)?$/); return t[3] ? `v2-${t[2]}-medial` : `${t[1]}-${t[2]}${n + 1}`; };
  function drawCanvas() {
    canvas.innerHTML = "";
    canvas.classList.toggle("editing", !!(mode && active));
    const grid = el("g", { class: "grid" }, canvas);
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: -20, x2: v, y2: 105 }, grid); el("line", { x1: -5, y1: v, x2: 105, y2: v }, grid); }
    el("rect", { x: -9, y: -9, width: 118, height: 118, class: "box" }, grid);
    const id = symId(), sym = symbolOf(id), ctxIds = contextIds();
    for (const c of ctxIds) el("path", { "data-id": c, d: outlineOf(c), class: "ctx" }, canvas);
    if (viewOpt.orig) for (const c of [id, ...sym.marks.map((m, i) => markIds(id, i))].concat(ctxIds)) {
      const o = c.startsWith("v2c-") ? B.skeleton(B.transform(M.original("v2-" + c.slice(4)), centred)) : ORIG[c];
      if (o) el("path", { d: o, class: "orig" }, canvas);
    }
    sym.marks.forEach((m, i) => {
      if (!m) return;
      const p = el("path", { d: itemD(m), class: "mark" + (isActive("mark", i) ? " current" : "") }, canvas);
      if (!isActive("mark", i)) p.style.opacity = markOpacity;
    });
    sym.strokes.forEach((s, i) => el("path", { d: itemD(s), class: "stroke" + (isActive("stroke", i) ? " current" : "") }, canvas));
    for (const [x1, y1, x2, y2] of guides) el("line", { x1, y1, x2, y2, class: "guide" }, canvas);
    const it = activeItem(sym);
    if (!it) return;
    const h = el("g", { class: "handles" }, canvas), c = B2.curve(it.a, it.b, it.bend), mid = [0.125 * c[0] + 0.375 * c[2] + 0.375 * c[4] + 0.125 * c[6], 0.125 * c[1] + 0.375 * c[3] + 0.375 * c[5] + 0.125 * c[7]];
    el("line", { x1: it.a[0], y1: it.a[1], x2: it.b[0], y2: it.b[1] }, h);
    for (const end of ["a", "b"]) el("circle", { cx: it[end][0], cy: it[end][1], r: 1.9, class: (end === "a" ? "start" : "") + (mode === end || mode === "all" ? " on" : "") }, h);
    el("rect", { x: mid[0] - 1.5, y: mid[1] - 1.5, width: 3, height: 3, class: "ctrl" + (mode === "bend" ? " on" : "") }, h);
  }

  const toSvg = (svg, e) => { const p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(svg.getScreenCTM().inverse()); };
  const round = v => Math.round(v * 4) / 4;
  function snapTargets(skip) {
    const xs = [], ys = [];
    const add = p => { xs.push(p[0]); ys.push(p[1]); };
    const sym = symbolOf(symId());
    sym.strokes.forEach(it => { if (it !== skip) { add(it.a); add(it.b); } });
    for (const c of contextIds()) for (const st of strokesOf(c)) { const l = st.s && st.s.length ? st.s[st.s.length - 1] : null; add(l ? [st.s[0][0], st.s[0][1]] : [st.c[0], st.c[1]]); add(l ? [l[6], l[7]] : [st.c[6], st.c[7]]); }
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
    if (mode === "bend") canvas.dispatchEvent(new PointerEvent("pointermove", { clientX: e.clientX, clientY: e.clientY }));
  });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = toSvg(canvas, e);
    if (drag.end === "bend") {   // the arc goes through the pointer: its offset from the chord, in units of the chord
      const dx = drag.b[0] - drag.a[0], dy = drag.b[1] - drag.a[1], L = Math.hypot(dx, dy) || 1;
      drag.it.bend = Math.max(-0.5, Math.min(0.5, Math.round(((p.x - drag.a[0]) * dy - (p.y - drag.a[1]) * dx) / L / L * 200) / 200));
      changed(); return;
    }
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
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || !mode || mode === "bend" || !active || !activeItem(symbolOf(symId()))) return;
    e.preventDefault();
    const step = e.shiftKey ? 2 : e.altKey ? 0.25 : 0.5;
    begin();
    const it = activeItem(editableSymbol(symId()));
    for (const k of mode === "all" ? ["a", "b"] : [mode]) it[k] = [it[k][0] + dir[0] * step, it[k][1] + dir[1] * step];
    end(); markEdited(); changed();
  });

  // ---- symbols: what to edit ---------------------------------------------------------------------------------------------------
  function button(box, text, on, title, onClick) {
    const b = document.createElement("button"); b.type = "button";
    b.className = "btn btn-sm " + (on ? "btn-dark" : "btn-outline-secondary"); b.textContent = text; if (title) b.title = title;
    b.addEventListener("click", onClick); box.append(b);
  }
  function slider(box, label, value, min, max, step, onInput, fmt) {
    const row = document.createElement("label"); row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector("input"), out = row.querySelector("output"), show = v => fmt ? fmt(+v) : (+v).toFixed(step < 0.01 ? 3 : step < 1 ? 2 : 0);
    input.value = value; out.textContent = show(value);
    input.addEventListener("input", () => { begin(); onInput(+input.value); out.textContent = show(input.value); changed(); });
    input.addEventListener("change", () => end());
    box.append(row);
    return row;
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
    for (const [k, text, title] of [["all", "Move all", "A drag moves the whole stroke"], ["a", "Start point", "A drag moves only the start point"], ["b", "End point", "A drag moves only the end point"], ["bend", "Bend", "A drag bends the stroke: it goes through the pointer"]])
      button(md, text, mode === k, title, () => { mode = mode === k ? null : k; drawItems(); drawCanvas(); });
    const it = activeItem(sym), box = document.getElementById("item-controls");
    box.hidden = !it; box.innerHTML = "";
    if (it) {
      const kind = (label, key) => {
        const row = document.createElement("label"); row.className = "slider kind";
        row.innerHTML = `<span>${label}</span><select class="form-select form-select-sm">${Object.entries(B2.KINDS).map(([k, t]) => `<option value="${k}">${t}</option>`).join("")}</select><output></output>`;
        const sel = row.querySelector("select"); sel.value = it[key] || "flat";
        sel.addEventListener("change", () => { begin(); activeItem(editableSymbol(symId()))[key] = sel.value; end(); markEdited(); changed(); drawItems(); });
        box.append(row);
      };
      kind("Start", "s"); kind("End", "e");
      const edit = () => activeItem(editableSymbol(symId()));
      slider(box, "Bend", it.bend || 0, -0.3, 0.3, 0.005, v => edit().bend = v, v => v.toFixed(3));
      const sameWidth = (it.s === "point") === (it.e === "point");
      if (!sameWidth) slider(box, "Gradient", it.g || 0, -1, 1, 0.01, v => edit().g = v, v => v < -0.005 ? "full " + (-v).toFixed(2) : v > 0.005 ? "slim " + v.toFixed(2) : "linear").classList.add("gradient");
      const tr = document.createElement("div"); tr.className = "d-flex gap-2";
      for (const [t, d, title] of [["⟲", -5, "Turn 5° to the left"], ["⟳", 5, "Turn 5° to the right"]]) button(tr, t, false, title, () => rotate(d));
      box.append(tr);
    }
    document.getElementById("sym-reset").textContent = form === "centred" ? "Follow the rhyme form" : "Reset symbol";
    document.getElementById("sym-reset").disabled = !state.sym[id];
  }
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


  // ---- brush settings, context, storage -----------------------------------------------------------------------------------------
  const PARAM_FIELDS = [["weight", "Weight", 3, 12, 0.1], ["flatWidth", "Flat end: width", 0.3, 1.6, 0.01], ["flatAngle", "Flat end: angle", -60, 60, 1],
    ["pointRadius", "Pointed end: radius", 0, 0.3, 0.005], ["kihitsuSize", "Kihitsu: size", 0.5, 3, 0.01], ["kihitsuAngle", "Kihitsu: angle", -60, 60, 1]];
  function drawParams() {
    const box = document.getElementById("params"); box.innerHTML = "";
    for (const [k, name, min, max, step] of PARAM_FIELDS) slider(box, name, state.params[k], min, max, step, v => state.params[k] = v);
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
    // every symbol is written out, so the export does not depend on the base of the model
    const sym = {};
    for (const f of Object.keys(FORMS)) for (const s of SHAPES) { const id = FORMS[f].id(s), y = clone(symbolOf(id)); delete y.derived; sym[id] = y; }
    const data = { format: "qatt-brush", version: 3, params: state.params, sym, outlines };
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
      if (d.format !== "qatt-brush" || d.version !== 3) throw new Error("not a qatt-brush file of version 3 (export of this page)");
      begin(); end(); restore(JSON.stringify({ params: Object.assign(fresh().params, d.params), sym: d.sym }));
    } catch (err) { alert("Import failed: " + err.message); }
    e.target.value = "";
  });
  document.getElementById("reset-all").addEventListener("click", () => {
    if (!confirm("Discard all changes (symbols and brush settings)?")) return;
    begin(); end(); restore(JSON.stringify(fresh()));
  });
  document.getElementById("undo").addEventListener("click", doUndo);
  document.getElementById("redo").addEventListener("click", doRedo);
  for (const key of ["orig", "snap"]) {
    const c = document.getElementById("view-" + key); c.checked = viewOpt[key];
    c.addEventListener("change", () => { viewOpt[key] = c.checked; drawCanvas(); });
  }

  // ---- start ------------------------------------------------------------------------------------------------------------------
  document.querySelectorAll("#forms button").forEach(b => b.addEventListener("click", () => { form = b.dataset.form; fixActive(); drawSymbolList(); drawSymbolView(); }));
  document.getElementById("sample").addEventListener("input", drawSample);
  document.getElementById("size").addEventListener("input", e => document.documentElement.style.setProperty("--combo", e.target.value + "px"));

  function renderAll() { cache.clear(); drawParams(); drawContext(); drawSymbolList(); drawSymbolView(); }
  renderAll();
  }
})();
