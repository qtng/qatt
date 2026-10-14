/*
QATT brush 2 model: the symbols of brush2.html and the strokes of every qatt.js path. Used by brush2.html (js/brush2-editor.js)
and by the font build (tools/brush_outlines.js), in the browser and in node.

const M = QattBrush2Model(QattBrush, QattBrush2, shapes, paths, base);   // shapes: the 22 shape codes ("_" for z), paths: qatt.js path id -> d
M.outline(state, "v2-ng")       // filled outline of a path for a state {params, lib, sym} (an export of brush2.html)

The stroke library holds named forms: {name, bend, s, e, g} (bend, kind of the start and of the end, gradient; see brush2.js).
A symbol (rhyme form v2-X, onset form v2-X-small, centred form v2c-X) is three library strokes between two end points
{lib, a, b} plus its marks (v2-X1..6, v2c-X1..6; the medial v2-X-medial for the onset form). Symbols the state does not hold
come from base, an export of brush.html (version 2: its library is converted) or of brush2.html (version 3), or from the
original paths. A centred form the state does not hold follows its rhyme form.
Tones and codas use the automatic brush of QattBrush on the original paths.
*/
function QattBrush2Model(B, B2, SHAPES, ORIG, base) {
  base = base || {};
  const old = (typeof QattBrushModel !== "undefined" ? QattBrushModel : require("./brush-model.js"))(B, SHAPES, ORIG);
  const clone = o => JSON.parse(JSON.stringify(o));
  const r3 = v => Math.round(v * 1000) / 1000;
  const v3 = base.version === 3;

  // kinds of ends and gradient of the strokes of the library of brush.html
  const ENDS = { heng: ["kihitsu", "flat", 0], shu: ["kihitsu", "flat", 0], "shu-slight": ["kihitsu", "point", -0.3], na: ["point", "flat", -0.3], mark: ["flat", "flat", 0] };
  const convert = e => { const [s, en, g] = ENDS[e.key] || ["flat", "flat", 0]; return { name: e.name, bend: r3(0.375 * ((e.h1 || 0) + (e.h2 || 0))), s, e: en, g }; };
  const oldLib = (!v3 && base.lib) || old.DEF.lib;
  const lib = {};
  if (v3 && base.lib) for (const k of Object.keys(base.lib)) lib[k] = clone(base.lib[k]);
  else for (const k of Object.keys(oldLib)) lib[k] = convert(Object.assign({ key: k }, oldLib[k]));
  for (const k of Object.keys(old.DEF.lib)) if (!lib[k]) lib[k] = convert(Object.assign({ key: k }, old.DEF.lib[k]));
  const DEF = { lib, sym: old.DEF.sym };

  const oldState = { params: {}, lib: old.DEF.lib, sym: base.sym || {} };
  const hasBase = id => base.sym && base.sym[id];
  const centred = old.centred, original = old.original, target = old.target;
  const moveItem = (it, f) => it && Object.assign({}, it, { a: f(it.a), b: f(it.b) });
  function symbolOf(state, id) {
    if (state.sym[id]) return state.sym[id];
    if (id.startsWith("v2c-") && !hasBase(id)) {
      const r = symbolOf(state, "v2-" + id.slice(4));
      return { strokes: r.strokes.map(it => moveItem(it, centred)), marks: r.marks.map(it => moveItem(it, centred)), derived: true };
    }
    return old.symbolOf(oldState, id);
  }
  // the strokes of a list of items {lib, a, b}
  const placed = (state, items) => items.filter(Boolean).map(it => {
    const e = state.lib[it.lib] || state.lib.mark || DEF.lib.mark || {};
    return B2.stroke({ a: it.a, b: it.b, bend: e.bend, s: e.s, e: e.e, g: e.g });
  });
  // the centre lines of a path: the placed library strokes for the symbols, the original paths for tones and codas
  function strokesOf(state, id) {
    const t = target(id);
    if (t) { const s = symbolOf(state, t.sym); return placed(state, t.mark === undefined ? s.strokes : [s.marks[t.mark]]); }
    return id.startsWith("v2c-") ? B.transform(original("v2-" + id.slice(4)), centred) : original(id);
  }
  // filled outline of a path; f moves the centre lines first (so a squeezed glyph keeps its stroke widths), factor scales the weight
  function outline(state, id, f, factor) {
    const t = target(id), k = (factor || 1) * (!t && /^q[ts]/.test(id) ? 0.7 : 1), weight = (state.params.weight || B2.DEFAULT_PARAMS.weight) * k;
    let strokes = strokesOf(state, id);
    if (t) return B2.outline(f ? B2.transform(strokes, f) : strokes, Object.assign({}, state.params, { weight }));
    return B.outline(f ? B.transform(strokes, f) : strokes, { weight });
  }
  return { DEF, symbolOf, target, original, centred, placed, strokesOf, outline };
}

if (typeof module !== "undefined") module.exports = QattBrush2Model;
