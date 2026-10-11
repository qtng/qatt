// Editor of brush.html: lay brush strokes (js/brush.js) over the centre lines of the qatt.js paths and compare them in all combinations.
// The work is kept in localStorage and can be exported and imported as JSON.
(() => {
  const B = QattBrush;
  const SVGNS = "http://www.w3.org/2000/svg";
  const STORE = "qatt-brush-v1";
  const SHAPES = VietnameseParser.SHAPES.map(s => s === "z" ? "_" : s);
  const TABLE = VietnameseParser.DECODINGS.qatt;
  const CODAS = "UU II U I M N P C T NG NH CH".split(" ");
  const TONES = ["", "sắc", "huyền", "hỏi", "ngã", "nặng", "sắc (nhập)", "nặng (nhập)", "ngang"];
  const KINDS = ["heng", "shu", "pie", "na", "ti", "dian", "line"];
  const VIEWBOX = "-14 -28 128 136";   // the glyph box of qatt.js with room for the tone marks in the corners

  // ---- the original centre lines ----------------------------------------------------------------------------------------------
  const ORIG = {};
  new DOMParser().parseFromString(defaultSvgDefs, "image/svg+xml").querySelectorAll("path[id]").forEach(p => ORIG[p.id] = p.getAttribute("d"));
  const parsed = {};
  const original = id => parsed[id] || (parsed[id] = ORIG[id] ? B.parse(ORIG[id]) : []);

  // ---- state, history, storage --------------------------------------------------------------------------------------------------
  const fresh = () => ({ params: Object.assign({}, B.DEFAULT_PARAMS), presets: JSON.parse(JSON.stringify(B.DEFAULT_PRESETS)), paths: {} });
  let state = fresh();
  try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && s.paths) state = Object.assign(fresh(), s); } catch (e) { }
  const undo = [], redo = [];
  let pending = false;
  const begin = () => { if (!pending) { undo.push(JSON.stringify(state)); if (undo.length > 200) undo.shift(); redo.length = 0; pending = true; } };
  const end = () => { pending = false; save(); };
  let saveTimer = null;
  const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { } }, 300); };
  const restore = json => { state = Object.assign(fresh(), JSON.parse(json)); cache.clear(); save(); renderAll(); };

  // ---- strokes and outlines -----------------------------------------------------------------------------------------------------
  const centred = ([x, y]) => [1.5 * x - 66.25, y];   // the v2c- copies of qatt.js: a rhyme alone, centred in the box
  function strokesOf(id) {
    if (id.startsWith("v2c-")) return B.transform(strokesOf("v2-" + id.slice(4)), centred);
    return state.paths[id] || original(id);
  }
  const cache = new Map();
  function outlineOf(id) {
    if (!cache.has(id)) cache.set(id, B.outline(strokesOf(id), state.params, state.presets));
    return cache.get(id);
  }
  // the strokes of a path, copied into the state before the first change
  function editable(id) {
    if (!state.paths[id]) state.paths[id] = JSON.parse(JSON.stringify(original(id)));
    return state.paths[id];
  }
  function changed(id) {
    cache.delete(id); cache.delete(id.replace(/^v2-/, "v2c-"));
    schedule();
  }
  let frame = null, full = false;
  function schedule(all) {
    full = full || !!all;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (full) { cache.clear(); full = false; }
      document.querySelectorAll("path[data-id]").forEach(p => { const d = outlineOf(p.dataset.id); if (p.getAttribute("d") !== d) p.setAttribute("d", d); });
      drawCanvas();
    });
  }

  // ---- ids ---------------------------------------------------------------------------------------------------------------------
  function info(id) {
    let m;
    if ((m = id.match(/^v2-(.+)-small$/))) return { kind: "onset", shape: m[1] };
    if ((m = id.match(/^v2-(.+)-medial$/))) return { kind: "medial", shape: m[1] };
    if ((m = id.match(/^qt(\d)$/))) return { kind: "tone", tone: +m[1] || 8 };
    if ((m = id.match(/^qs(\d)$/))) return { kind: "tonealone", tone: +m[1] || 8 };
    if ((m = id.match(/^v2-([A-Z]+)$/))) return { kind: "coda", coda: m[1] };
    if ((m = id.match(/^v2-(.+?)([1-6])$/))) return { kind: "mark", shape: m[1], mark: +m[2] };
    if ((m = id.match(/^v2-(.+)$/))) return { kind: "rhyme", shape: m[1] };
    return { kind: "other" };
  }
  // ids of one glyph, as qatt.js puts them together (a rhyme alone uses the centred copies unless `fixed`)
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

  // reading of onset + rhyme shape + marking (qatt.org decoding), with the tone
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
      const tail = idx[idx.length - 1] < chars.length - 1;   // a consonant after the vowels
      at = idx.length === 1 ? idx[0] : tail || /^(oa|oe|uy|qu)/.test(chars.slice(idx[0] - 1, idx[0] + 2).join("")) ? idx[1] : idx[0];
      if (chars[idx[0] - 1] === "q" || (chars[idx[0] - 1] === "g" && chars[idx[0]] === "i" && idx.length > 1)) at = idx[1];
    }
    chars[at] = (chars[at] + mark).normalize("NFC");
    return chars.join("");
  }

  // ---- speech ------------------------------------------------------------------------------------------------------------------
  let voice = null;
  const findVoice = () => { voice = (speechSynthesis?.getVoices() || []).find(v => /^vi/i.test(v.lang)) || null; document.getElementById("speak").disabled = !voice; };
  if (window.speechSynthesis) { findVoice(); speechSynthesis.addEventListener?.("voiceschanged", findVoice); }
  function speak(text) {
    if (!voice || !text || !document.getElementById("speak").checked) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.voice = voice; u.lang = voice.lang; speechSynthesis.speak(u);
  }

  // ---- small glyph pictures ------------------------------------------------------------------------------------------------------
  const el = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  function glyph(ids, faint) {
    const svg = el("svg", { viewBox: VIEWBOX, class: "glyph" });
    for (const id of faint || []) el("path", { "data-id": id, d: outlineOf(id), class: "faint" }, svg);
    for (const id of ids) el("path", { "data-id": id, d: outlineOf(id) }, svg);
    return svg;
  }

  // ---- selection and context -----------------------------------------------------------------------------------------------------
  let group = "rhyme", sel = "v2-ng", stroke = 0;
  const ctx = { onset: "t", rhyme: "ng", mark: 2, tone: 0 };
  const GROUPS = {
    rhyme: { title: "Rhymes", ids: () => SHAPES.map(s => "v2-" + s) },
    onset: { title: "Onsets", ids: () => SHAPES.map(s => `v2-${s}-small`) },
    medial: { title: "Medials", ids: () => SHAPES.map(s => `v2-${s}-medial`) },
    mark: { title: "Marks", ids: () => SHAPES.flatMap(s => [1, 2, 3, 4, 5, 6].map(m => "v2-" + s + m)) },
    tone: { title: "Tones", ids: () => [1, 2, 3, 4, 5, 6, 7, 0].flatMap(t => ["qt" + t]).concat([1, 2, 3, 4, 5, 6, 7, 0].map(t => "qs" + t)) },
    coda: { title: "Codas", ids: () => CODAS.map(c => "v2-" + c) },
  };
  const label = id => {
    const i = info(id);
    if (i.kind === "rhyme" || i.kind === "onset" || i.kind === "medial") return i.shape === "_" ? "ʔ" : i.shape;
    if (i.kind === "mark") return (i.shape === "_" ? "ʔ" : i.shape) + i.mark;
    if (i.kind === "tone" || i.kind === "tonealone") return TONES[i.tone] + (i.kind === "tonealone" ? " (alone)" : "");
    if (i.kind === "coda") return i.coda;
    return id;
  };
  // what is drawn around a path to show it in place: the path itself plus the context
  function faintFor(id) {
    const i = info(id);
    if (i.kind === "medial") return [`v2-${i.shape}-small`];
    if (i.kind === "mark") return ["v2-" + i.shape];
    if (i.kind === "tone") return ["v2-ng"];
    return [];
  }
  function canvasIds() {
    const i = info(sel);
    let c;
    if (i.kind === "rhyme") c = { onset: ctx.onset, rhyme: i.shape, mark: ctx.mark, tone: ctx.tone };
    else if (i.kind === "onset") c = { onset: i.shape, rhyme: ctx.rhyme, mark: ctx.mark, tone: ctx.tone };
    else if (i.kind === "medial") c = { onset: i.shape, medial: true, rhyme: ctx.rhyme, mark: ctx.mark, tone: ctx.tone };
    else if (i.kind === "mark") c = { onset: ctx.onset, rhyme: i.shape, mark: i.mark, tone: ctx.tone };
    else if (i.kind === "tone") c = { onset: ctx.onset, rhyme: ctx.rhyme, mark: ctx.mark, tone: i.tone };
    else return [sel];
    const ids = compose(c, true);
    if (!ids.includes(sel)) ids.push(sel);
    return ids;
  }

  function select(id, keepStroke) {
    sel = id;
    if (!keepStroke) { stroke = 0; selPoint = null; }
    document.querySelectorAll("#list .cell").forEach(c => c.classList.toggle("active", c.dataset.sel === id));
    drawCombos(); drawCanvas(); drawStrokePanel();
  }

  // ---- left: the paths of a group ------------------------------------------------------------------------------------------------
  function drawList() {
    document.querySelectorAll("#groups button").forEach(b => b.classList.toggle("active", b.dataset.group === group));
    const list = document.getElementById("list"); list.innerHTML = "";
    list.classList.toggle("dense", group === "mark");
    for (const id of GROUPS[group].ids()) {
      if (!ORIG[id]) continue;
      const cell = document.createElement("button");
      cell.type = "button"; cell.className = "cell" + (id === sel ? " active" : "") + (state.paths[id] ? " edited" : ""); cell.dataset.sel = id; cell.title = label(id);
      cell.append(glyph([id], faintFor(id)));
      const lab = document.createElement("span"); lab.textContent = label(id); cell.append(lab);
      cell.addEventListener("click", () => select(id));
      list.append(cell);
    }
  }

  // ---- bottom: the selected path in all combinations ---------------------------------------------------------------------------
  function drawCombos() {
    const i = info(sel), box = document.getElementById("combos"); box.innerHTML = "";
    const cells = [];
    const mk = ctx.mark || 0;
    if (i.kind === "rhyme" || i.kind === "mark") {
      const m = i.kind === "mark" ? i.mark : mk;
      cells.push([compose({ rhyme: i.shape, mark: m, tone: ctx.tone }), syllable("", i.shape, m, ctx.tone) || "alone"]);
      for (const o of SHAPES) cells.push([compose({ onset: o, rhyme: i.shape, mark: m, tone: ctx.tone }), syllable(o, i.shape, m, ctx.tone)]);
      document.getElementById("combos-title").textContent = `${label(sel)} after every onset`;
    } else if (i.kind === "onset" || i.kind === "medial") {
      for (const r of SHAPES) cells.push([compose({ onset: i.shape, medial: i.kind === "medial", rhyme: r, mark: mk, tone: ctx.tone }), syllable(i.shape, r, mk, ctx.tone)]);
      document.getElementById("combos-title").textContent = `${label(sel)} before every rhyme`;
    } else if (i.kind === "tone") {
      for (const r of SHAPES) cells.push([compose({ onset: ctx.onset, rhyme: r, mark: mk, tone: i.tone }), syllable(ctx.onset, r, mk, i.tone)]);
      document.getElementById("combos-title").textContent = `${label(sel)} on every rhyme`;
    } else {
      for (const id of GROUPS[group].ids()) cells.push([[id], label(id)]);
      document.getElementById("combos-title").textContent = GROUPS[group].title;
    }
    for (const [ids, text] of cells) {
      const c = document.createElement("div"); c.className = "combo";
      c.append(glyph(ids));
      const lab = document.createElement("span"); lab.textContent = text || ids.map(label).join(" "); c.append(lab);
      c.addEventListener("click", () => speak(text));
      box.append(c);
    }
    drawSample();
  }

  // ---- sample text -----------------------------------------------------------------------------------------------------------
  const vp = new VietnameseParser();
  function sampleGlyphs(word) {
    let code = null;
    try { const r = vp.parse(word); code = r && r.qatt; } catch (e) { }
    if (!code) return null;
    const [initial, vowel, , tone] = code.split(",");
    const m = vowel.match(/^(w?)(.+?)(\d?)$/);
    const ids = compose({ onset: initial === "_" && !m[1] ? "" : initial, medial: !!m[1], rhyme: m[2], mark: +m[3] || 0, tone: +tone || 0 });
    return ids.filter(id => ORIG[id.replace(/^v2c-/, "v2-")]);
  }
  function drawSample() {
    const box = document.getElementById("sample-out"); box.innerHTML = "";
    for (const w of document.getElementById("sample").value.split(/\s+/).filter(Boolean)) {
      const ids = sampleGlyphs(w.replace(/[.,;:!?"“”()]/g, ""));
      if (ids && ids.length) { const g = glyph(ids); g.addEventListener("click", () => speak(w)); g.setAttribute("title", w); box.append(g); }
    }
  }

  // ---- the editing canvas ------------------------------------------------------------------------------------------------------
  const canvas = document.getElementById("canvas");
  let selPoint = null, drag = null, guides = [];
  const view = { orig: true, skel: true, snap: true };

  function drawCanvas() {
    canvas.innerHTML = "";
    const grid = el("g", { class: "grid" }, canvas);
    for (let v = 0; v <= 100; v += 10) { el("line", { x1: v, y1: -20, x2: v, y2: 105 }, grid); el("line", { x1: -5, y1: v, x2: 105, y2: v }, grid); }
    el("rect", { x: -9, y: -9, width: 118, height: 118, class: "box" }, grid);
    const ids = canvasIds();
    for (const id of ids) if (id !== sel) el("path", { "data-id": id, d: outlineOf(id), class: "ctx" }, canvas);
    if (view.orig) for (const id of ids) if (ORIG[id]) el("path", { d: ORIG[id], class: "orig" }, canvas);
    const strokes = strokesOf(sel);
    strokes.forEach((st, i) => {
      const p = el("path", { d: B.outline([st], state.params, state.presets), class: "stroke" + (i === stroke ? " current" : ""), "data-stroke": i }, canvas);
      p.addEventListener("pointerdown", e => startDrag(e, { stroke: i, body: true }));
    });
    if (view.skel) strokes.forEach((st, i) => el("path", { d: B.skeleton([st]), class: "skel" + (i === stroke ? " current" : "") }, canvas));
    for (const [x1, y1, x2, y2] of guides) el("line", { x1, y1, x2, y2, class: "guide" }, canvas);
    const st = strokes[stroke];
    if (!st) return;
    const handles = el("g", { class: "handles" }, canvas);
    st.s.forEach((s, j) => {
      el("line", { x1: s[0], y1: s[1], x2: s[2], y2: s[3] }, handles);
      el("line", { x1: s[6], y1: s[7], x2: s[4], y2: s[5] }, handles);
    });
    st.s.forEach((s, j) => {
      for (const k of j ? [1, 2, 3] : [0, 1, 2, 3]) {
        const x = s[2 * k], y = s[2 * k + 1], anchor = k === 0 || k === 3;
        const h = anchor ? el("circle", { cx: x, cy: y, r: 1.7 }, handles) : el("rect", { x: x - 1.3, y: y - 1.3, width: 2.6, height: 2.6 }, handles);
        h.classList.add(anchor ? "anchor" : "ctrl");
        if (selPoint && selPoint.j === j && selPoint.k === k) h.classList.add("on");
        h.addEventListener("pointerdown", e => startDrag(e, { stroke, j, k }));
      }
    });
  }

  const toSvg = e => { const p = canvas.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; return p.matrixTransform(canvas.getScreenCTM().inverse()); };
  const round = v => Math.round(v * 4) / 4;

  // the points a drag moves: [j, k] pairs of the stroke
  function movedPoints(st, j, k) {
    if (k === 1 || k === 2) return [[j, k]];
    const pts = [[j, k], [j, k === 0 ? 1 : 2]];
    if (k === 3 && st.s[j + 1]) pts.push([j + 1, 0], [j + 1, 1]);
    if (k === 0 && st.s[j - 1]) pts.push([j - 1, 3], [j - 1, 2]);
    return pts;
  }
  // anchors of the other strokes and of the context, to snap to
  function snapTargets(exceptStroke) {
    const xs = [], ys = [];
    for (const id of canvasIds()) strokesOf(id).forEach((st, i) => {
      if (id === sel && i === exceptStroke) return;
      for (const s of st.s) for (const k of [0, 3]) { xs.push(s[2 * k]); ys.push(s[2 * k + 1]); }
    });
    return { xs, ys };
  }

  function startDrag(e, what) {
    e.preventDefault(); e.stopPropagation();
    if (what.stroke !== stroke) { stroke = what.stroke; selPoint = null; drawStrokePanel(); }
    if (!what.body) selPoint = { j: what.j, k: what.k };
    begin();
    const st = editable(sel)[stroke];
    const start = toSvg(e);
    const pts = what.body ? st.s.flatMap((s, j) => [0, 1, 2, 3].map(k => [j, k])) : movedPoints(st, what.j, what.k);
    const from = pts.map(([j, k]) => [st.s[j][2 * k], st.s[j][2 * k + 1]]);
    const anchors = what.body ? st.s.flatMap((s, j) => [[j, 0], [j, 3]]).map(([j, k]) => [st.s[j][2 * k], st.s[j][2 * k + 1]]) : [from[0]];
    drag = { st, pts, from, start, anchors, targets: snapTargets(stroke) };
    canvas.setPointerCapture(e.pointerId);
    drawCanvas();
  }
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const p = toSvg(e);
    let dx = round(p.x - drag.start.x), dy = round(p.y - drag.start.y);
    guides = [];
    if (view.snap && !e.altKey) {
      let bx = null, by = null;
      for (const [ax, ay] of drag.anchors) {
        for (const tx of drag.targets.xs) { const d = tx - (ax + dx); if (Math.abs(d) < 1.5 && (bx === null || Math.abs(d) < Math.abs(bx.d))) bx = { d, x: tx }; }
        for (const ty of drag.targets.ys) { const d = ty - (ay + dy); if (Math.abs(d) < 1.5 && (by === null || Math.abs(d) < Math.abs(by.d))) by = { d, y: ty }; }
      }
      if (bx) { dx += bx.d; guides.push([bx.x, -25, bx.x, 105]); }
      if (by) { dy += by.d; guides.push([-12, by.y, 112, by.y]); }
    }
    drag.pts.forEach(([j, k], n) => { drag.st.s[j][2 * k] = drag.from[n][0] + dx; drag.st.s[j][2 * k + 1] = drag.from[n][1] + dy; });
    changed(sel);
  });
  const stopDrag = () => { if (!drag) return; drag = null; guides = []; end(); markEdited(); drawCanvas(); };
  canvas.addEventListener("pointerup", stopDrag);
  canvas.addEventListener("pointercancel", stopDrag);
  canvas.addEventListener("pointerdown", () => { selPoint = null; drawCanvas(); });
  const markEdited = () => document.querySelectorAll("#list .cell").forEach(c => c.classList.toggle("edited", !!state.paths[c.dataset.sel]));

  // arrow keys move the selected point or stroke
  document.addEventListener("keydown", e => {
    if (e.target.closest("input, select, textarea")) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); doRedo(); return; }
    const dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!dir || !strokesOf(sel)[stroke]) return;
    e.preventDefault();
    const step = e.shiftKey ? 2 : e.altKey ? 0.25 : 0.5;
    begin();
    const st = editable(sel)[stroke];
    const pts = selPoint ? movedPoints(st, selPoint.j, selPoint.k) : st.s.flatMap((s, j) => [0, 1, 2, 3].map(k => [j, k]));
    for (const [j, k] of pts) { st.s[j][2 * k] += dir[0] * step; st.s[j][2 * k + 1] += dir[1] * step; }
    end(); markEdited(); changed(sel);
  });

  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(state)); restore(undo.pop()); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(state)); restore(redo.pop()); }

  // ---- stroke panel ------------------------------------------------------------------------------------------------------------
  function drawStrokePanel() {
    const strokes = strokesOf(sel), st = strokes[stroke];
    const chips = document.getElementById("strokes"); chips.innerHTML = "";
    strokes.forEach((s, i) => {
      const b = document.createElement("button"); b.type = "button";
      b.className = "btn btn-sm " + (i === stroke ? "btn-dark" : "btn-outline-secondary");
      const kind = s.p && s.p !== "auto" ? s.p : B.classify(B.normalize(s.s));
      b.textContent = `${i + 1} · ${B.DEFAULT_PRESETS[kind].name.split(" ")[1] || kind}`;
      b.addEventListener("click", () => { stroke = i; selPoint = null; drawStrokePanel(); drawCanvas(); });
      chips.append(b);
    });
    document.getElementById("path-name").textContent = `${label(sel)} · ${sel}` + (state.paths[sel] ? " · edited" : "");
    const kindSel = document.getElementById("st-kind"), k = document.getElementById("st-k"), r = document.getElementById("st-r");
    [kindSel, k, r].forEach(x => x.disabled = !st);
    if (!st) return;
    const auto = B.classify(B.normalize(st.s));
    kindSel.options[0].textContent = `Auto (${B.DEFAULT_PRESETS[auto].name})`;
    kindSel.value = st.p || "auto";
    k.value = st.k || 1; document.getElementById("st-k-v").textContent = (+k.value).toFixed(2);
    r.checked = !!st.r;
  }
  const strokeEdit = f => { begin(); f(editable(sel)[stroke]); end(); markEdited(); changed(sel); drawStrokePanel(); };
  document.getElementById("st-kind").innerHTML = `<option value="auto">Auto</option>` + KINDS.map(k => `<option value="${k}">${B.DEFAULT_PRESETS[k].name}</option>`).join("");
  document.getElementById("st-kind").addEventListener("change", e => strokeEdit(st => st.p = e.target.value));
  document.getElementById("st-k").addEventListener("input", e => { begin(); editable(sel)[stroke].k = +e.target.value; document.getElementById("st-k-v").textContent = (+e.target.value).toFixed(2); changed(sel); });
  document.getElementById("st-k").addEventListener("change", () => { end(); markEdited(); drawStrokePanel(); });
  document.getElementById("st-r").addEventListener("change", e => strokeEdit(st => st.r = e.target.checked));
  document.getElementById("st-straight").addEventListener("click", () => strokeEdit(st => st.s.forEach(s => { s[2] = s[0] + (s[6] - s[0]) / 3; s[3] = s[1] + (s[7] - s[1]) / 3; s[4] = s[0] + (s[6] - s[0]) * 2 / 3; s[5] = s[1] + (s[7] - s[1]) * 2 / 3; })));
  document.getElementById("st-reset").addEventListener("click", () => {
    const o = original(sel)[stroke]; if (!o) return;
    strokeEdit(st => Object.assign(st, JSON.parse(JSON.stringify(o))));
  });
  document.getElementById("path-reset").addEventListener("click", () => { begin(); delete state.paths[sel]; end(); markEdited(); changed(sel); drawStrokePanel(); });

  // ---- brush settings ------------------------------------------------------------------------------------------------------------
  const PARAMS = [["weight", "Weight", 3, 12, 0.1], ["contrast", "Contrast", 0, 0.8, 0.01], ["nib", "Nib angle", -60, 60, 1], ["bow", "Bow of horizontals", 0, 1, 0.01]];
  const PRESET_FIELDS = [["w0", "Start width", 0, 1.6], ["ws", "Start press", 0, 1.6], ["sd", "Start press distance", 0, 3], ["bs", "Start press shift", -1, 1],
    ["wm", "Middle width", 0, 1.6], ["we", "End press", 0, 1.6], ["ed", "End press distance", 0, 3], ["be", "End press shift", -1, 1], ["w1", "End width", 0, 1.6],
    ["capS", "Start cap", 0, 1.5], ["capE", "End cap", 0, 1.5], ["skS", "Start cap shift", -1, 1], ["skE", "End cap shift", -1, 1]];
  function slider(box, label, value, min, max, step, onInput) {
    const row = document.createElement("label"); row.className = "slider";
    row.innerHTML = `<span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}"><output></output>`;
    const input = row.querySelector("input"), out = row.querySelector("output");
    input.value = value; out.textContent = (+value).toFixed(step < 1 ? 2 : 0);
    input.addEventListener("input", () => { begin(); onInput(+input.value); out.textContent = (+input.value).toFixed(step < 1 ? 2 : 0); schedule(true); });
    input.addEventListener("change", () => { end(); drawStrokePanel(); });
    box.append(row);
  }
  let presetKind = "heng";
  function drawSettings() {
    const pbox = document.getElementById("params"); pbox.innerHTML = "";
    for (const [key, name, min, max, step] of PARAMS) slider(pbox, name, state.params[key], min, max, step, v => state.params[key] = v);
    const psel = document.getElementById("preset");
    psel.innerHTML = KINDS.map(k => `<option value="${k}">${B.DEFAULT_PRESETS[k].name}</option>`).join(""); psel.value = presetKind;
    const box = document.getElementById("preset-fields"); box.innerHTML = "";
    const P = state.presets[presetKind] = Object.assign({}, B.DEFAULT_PRESETS[presetKind], state.presets[presetKind]);
    for (const [key, name, min, max] of PRESET_FIELDS) slider(box, name, P[key], min, max, 0.01, v => P[key] = v);
  }
  document.getElementById("preset").addEventListener("change", e => { presetKind = e.target.value; drawSettings(); });
  document.getElementById("preset-reset").addEventListener("click", () => { begin(); state.presets[presetKind] = Object.assign({}, B.DEFAULT_PRESETS[presetKind]); end(); drawSettings(); schedule(true); });
  document.getElementById("params-reset").addEventListener("click", () => { begin(); state.params = Object.assign({}, B.DEFAULT_PARAMS); end(); drawSettings(); schedule(true); });

  // ---- context ---------------------------------------------------------------------------------------------------------------
  function drawContext() {
    const opts = (list, none) => `<option value="">${none}</option>` + list.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
    const o = document.getElementById("ctx-onset"), r = document.getElementById("ctx-rhyme"), m = document.getElementById("ctx-mark"), t = document.getElementById("ctx-tone");
    o.innerHTML = opts(SHAPES.map(s => [s, s === "_" ? "ʔ" : s]), "none"); o.value = ctx.onset;
    r.innerHTML = opts(SHAPES.map(s => [s, s === "_" ? "ʔ" : s]), "none"); r.value = ctx.rhyme;
    m.innerHTML = opts([1, 2, 3, 4, 5, 6].map(v => [v, v]), "none"); m.value = ctx.mark || "";
    t.innerHTML = opts([1, 2, 3, 4, 5, 6, 7, 8].map(v => [v, TONES[v]]), "none"); t.value = ctx.tone || "";
  }
  for (const [key, num] of [["onset"], ["rhyme"], ["mark", 1], ["tone", 1]]) {
    const e = document.getElementById("ctx-" + key);
    e.addEventListener("change", () => { ctx[key] = num ? +e.value || 0 : e.value; drawCombos(); drawCanvas(); });
  }

  // ---- storage buttons -----------------------------------------------------------------------------------------------------------
  function exportJson() {
    const outlines = {};
    for (const id of Object.keys(ORIG)) {
      if (id === "square" || !/^(v2-|qt|qs)/.test(id)) continue;
      outlines[id] = outlineOf(id);
      if (id.startsWith("v2-") && ORIG["v2c-" + id.slice(3)]) outlines["v2c-" + id.slice(3)] = outlineOf("v2c-" + id.slice(3));
    }
    const data = { format: "qatt-brush", version: 1, params: state.params, presets: state.presets, paths: state.paths, outlines };
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
      if (d.format !== "qatt-brush") throw new Error("not a qatt-brush file");
      begin(); end();
      restore(JSON.stringify({ params: d.params, presets: d.presets, paths: d.paths }));
    } catch (err) { alert("Import failed: " + err.message); }
    e.target.value = "";
  });
  document.getElementById("reset-all").addEventListener("click", () => {
    if (!confirm("Discard all changes (paths, brush settings and presets)?")) return;
    begin(); end(); restore(JSON.stringify(fresh()));
  });
  document.getElementById("undo").addEventListener("click", doUndo);
  document.getElementById("redo").addEventListener("click", doRedo);
  for (const key of ["orig", "skel", "snap"]) {
    const c = document.getElementById("view-" + key); c.checked = view[key];
    c.addEventListener("change", () => { view[key] = c.checked; drawCanvas(); });
  }

  // ---- start -----------------------------------------------------------------------------------------------------------------
  document.querySelectorAll("#groups button").forEach(b => b.addEventListener("click", () => {
    group = b.dataset.group; drawList(); select(GROUPS[group].ids().find(id => ORIG[id]));
  }));
  document.getElementById("sample").addEventListener("input", drawSample);
  document.getElementById("size").addEventListener("input", e => document.documentElement.style.setProperty("--combo", e.target.value + "px"));

  function renderAll() { drawList(); drawSettings(); drawContext(); drawCombos(); drawCanvas(); drawStrokePanel(); }
  renderAll();
})();
