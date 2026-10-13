/*
QATT brush 2 model: the symbols of brush2.html and the strokes of every qatt.js path. Used by brush2.html (js/brush2-editor.js)
and by the font build (tools/brush_outlines.js), in the browser and in node.

const M = QattBrush2Model(QattBrush, QattBrush2, shapes, paths, base);   // shapes: the 22 shape codes ("_" for z), paths: qatt.js path id -> d
M.outline(state, "v2-ng")       // filled outline of a path for a state {params, sym} (an export of brush2.html)

A symbol (rhyme form v2-X, onset form v2-X-small, centred form v2c-X) is three strokes plus its marks (v2-X1..6, v2c-X1..6;
the medial v2-X-medial for the onset form). Each stroke is {a, b, bend, s, e, g} (see brush2.js). Symbols the state does not
hold come from base, an export of brush.html (version 2: the strokes of the stroke library are converted) or of brush2.html
(version 3), or from the original paths. A centred form the state does not hold follows its rhyme form.
Tones and codas use the automatic brush of QattBrush on the original paths.
*/
function QattBrush2Model(B, B2, SHAPES, ORIG, base) {
  base = base || {};
  const old = (typeof QattBrushModel !== "undefined" ? QattBrushModel : require("./brush-model.js"))(B, SHAPES, ORIG);
  const oldState = { params: {}, lib: base.lib || old.DEF.lib, sym: base.version === 3 ? {} : base.sym || {} };
  const r3 = v => Math.round(v * 1000) / 1000;

  // kinds of ends and gradient of the strokes of the old library
  const ENDS = { heng: ["kihitsu", "flat", 0], shu: ["kihitsu", "flat", 0], "shu-slight": ["kihitsu", "point", -0.3], na: ["point", "flat", -0.3] };
  function convert(it) {
    if (!it) return null;
    const e = oldState.lib[it.lib] || {}, [s, en, g] = ENDS[it.lib] || ["flat", "flat", 0];
    return { a: it.a.slice(), b: it.b.slice(), bend: r3(0.375 * ((e.h1 || 0) + (e.h2 || 0))), s, e: en, g };
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  const defaults = {};
  function fromBase(id) {
    if (!defaults[id]) {
      if (base.version === 3 && base.sym && base.sym[id]) defaults[id] = clone(base.sym[id]);
      else { const o = old.symbolOf(oldState, id); defaults[id] = { strokes: o.strokes.map(convert), marks: o.marks.map(convert) }; }
    }
    return defaults[id];
  }

  const centred = old.centred, original = old.original, target = old.target;
  const hasBase = id => base.sym && base.sym[id];
  const moveItem = (it, f) => it && Object.assign({}, it, { a: f(it.a), b: f(it.b) });
  function symbolOf(state, id) {
    if (state.sym[id]) return state.sym[id];
    if (id.startsWith("v2c-") && !hasBase(id)) {
      const r = symbolOf(state, "v2-" + id.slice(4));
      return { strokes: r.strokes.map(it => moveItem(it, centred)), marks: r.marks.map(it => moveItem(it, centred)), derived: true };
    }
    return fromBase(id);
  }
  // the strokes of a list of items
  const placed = items => items.filter(Boolean).map(B2.stroke);
  // the centre lines of a path: the strokes of the symbols, the original paths for tones and codas
  function strokesOf(state, id) {
    const t = target(id);
    if (t) { const s = symbolOf(state, t.sym); return placed(t.mark === undefined ? s.strokes : [s.marks[t.mark]]); }
    return id.startsWith("v2c-") ? B.transform(original("v2-" + id.slice(4)), centred) : original(id);
  }
  // filled outline of a path; f moves the centre lines first (so a squeezed glyph keeps its stroke widths), factor scales the weight
  function outline(state, id, f, factor) {
    const t = target(id), k = (factor || 1) * (!t && /^q[ts]/.test(id) ? 0.7 : 1);
    let strokes = strokesOf(state, id);
    if (t) {
      if (f) strokes = B2.transform(strokes, f);
      return B2.outline(strokes, Object.assign({}, state.params, { weight: (state.params.weight || B2.DEFAULT_PARAMS.weight) * k }));
    }
    if (f) strokes = B.transform(strokes, f);
    return B.outline(strokes, { weight: (state.params.weight || B2.DEFAULT_PARAMS.weight) * k });
  }
  return { symbolOf, target, original, centred, placed, strokesOf, outline };
}

if (typeof module !== "undefined") module.exports = QattBrush2Model;
