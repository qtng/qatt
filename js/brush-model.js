/*
QATT brush model: the symbols of brush.html and the strokes of every qatt.js path. Used by brush.html (js/brush-editor.js)
and by the font build (tools/brush_outlines.js), in the browser and in node.

const M = QattBrushModel(QattBrush, shapes, paths);   // shapes: the 22 shape codes ("_" for z), paths: qatt.js path id -> d
M.outline(state, "v2-ng")                              // filled outline of a path for a state {params, lib, sym} (an export of brush.html)

A symbol (rhyme form v2-X, onset form v2-X-small, centred form v2c-X) is three library strokes between two end points plus its
marks (v2-X1..6, v2c-X1..6; the medial v2-X-medial for the onset form). Symbols the state does not hold come from the
original paths (DEF.sym, the strokes mapped to the nearest stroke of the standard library DEF.lib); a centred form the state
does not hold follows its rhyme form. Tones and codas use the automatic brush of QattBrush on the original paths.
*/
function QattBrushModel(B, SHAPES, ORIG) {
  const parsed = {};
  const original = id => parsed[id] || (parsed[id] = ORIG[id] ? B.parse(ORIG[id]) : []);
  const centred = ([x, y]) => [1.5 * x - 66.25, y];   // the v2c- copies of qatt.js: a rhyme alone, centred in the box

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

  const moveItem = (it, f) => it && Object.assign({}, it, { a: f(it.a), b: f(it.b) });
  function symbolOf(state, id) {
    if (state.sym[id]) return state.sym[id];
    if (id.startsWith("v2c-")) { const r = symbolOf(state, "v2-" + id.slice(4)); return { strokes: r.strokes.map(it => moveItem(it, centred)), marks: r.marks.map(it => moveItem(it, centred)), derived: true }; }
    return DEF.sym[id];
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
  const placed = (state, items) => items.filter(Boolean).map(it => B.place(it.a, it.b, state.lib[it.lib] || state.lib.mark || DEF.lib.mark, state.lib[it.lib] ? it.lib : "mark"));
  // the centre lines of a path: placed library strokes for the symbols, the original paths for tones and codas
  function strokesOf(state, id) {
    const t = target(id);
    if (t) { const s = symbolOf(state, t.sym); return placed(state, t.mark === undefined ? s.strokes : [s.marks[t.mark]]); }
    if (id.startsWith("v2c-")) return B.transform(original("v2-" + id.slice(4)), centred);
    return original(id);
  }
  // filled outline of a path; f moves the centre lines first (so a squeezed glyph keeps its stroke widths), factor scales the weight
  function outline(state, id, f, factor) {
    let strokes = strokesOf(state, id);
    if (f) strokes = B.transform(strokes, f);
    const t = target(id), k = (factor || 1) * (!t && /^q[ts]/.test(id) ? 0.7 : 1);
    const params = Object.assign({}, B.DEFAULT_PARAMS, state.params, { weight: state.params.weight * k });
    return t ? B.outline(strokes, params, state.lib) : B.outline(strokes, params);
  }
  return { DEF, original, centred, symbolOf, target, placed, strokesOf, outline };
}

if (typeof module !== "undefined") module.exports = QattBrushModel;
