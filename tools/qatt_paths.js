// The letters of QATT as open paths (fonts/paths.json, edited in admin/font/glyph-editor.html) and their KAGE lines for the font build
// (kage_outlines.js). Used in Node.js (require) and in the browser (window.QattPaths), so the build and the editor draw the same.
//
// fonts/paths.json: {format: "qatt-paths", version: 1, box: 200, forms: {id: {strokes: [item], marks: [item | null] (the marks 1..6)}}}
//   id: v2c-X the single form of the symbol X, v2l-X / v2r-X its own left / right form for the halves of a pair (optional)
//   item: "M x y L x y" (a straight stroke) or "M x y Q cx cy x y" (a curve with one control point), in the KAGE box of 200 x 200 (y down);
//         or {d: "...", type: "1:0:2"} with a KAGE line type set by hand (the first three numbers of a KAGE line: kind, start, end)
// Without a type set by hand, the type follows from the path (the rules of tools/kage_seed.js, which made the first KAGE data from qatt.js):
//   nearly horizontal: 1:0:2 for a mark or a stroke that ends on another stroke (a plain end), else 1:0:0 (the triangle of Mincho)
//   a curve that is nearly vertical: 2:0:0; nearly vertical: 1:0:0; slanted: 2:0:7 down to the left (a left sweep), 2:7:8 down to the right
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.QattPaths = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const TOUCH = 5.7;   // an end this near another stroke ends on it (3 units of qatt.js)

  // "M x y L x y" / "M x y Q cx cy x y" -> [[x, y], ...] (2 or 3 points)
  function points(d) {
    const n = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) || []).map(Number);
    if (!/^\s*M/i.test(d) || !(n.length === 4 || n.length === 6)) throw new Error("not a line or a curve: " + d);
    return n.length === 4 ? [[n[0], n[1]], [n[2], n[3]]] : [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]]];
  }
  const fmt = v => String(Math.round(v * 100) / 100);
  function path(pts) {
    const p = pts.map(q => fmt(q[0]) + " " + fmt(q[1]));
    return pts.length === 2 ? `M${p[0]} L${p[1]}` : `M${p[0]} Q${p[1]} ${p[2]}`;
  }
  const dOf = it => typeof it === "string" ? it : it.d;
  const typeOf = it => typeof it === "string" ? null : it.type || null;

  function onSegment(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2));
    return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]) < TOUCH;
  }
  // the KAGE type a path gets without a type set by hand; others: the strokes of the form (their ends), isMark: a mark
  function autoType(pts, isMark, others) {
    const a = pts[0], b = pts[pts.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], curve = pts.length === 3;
    if (Math.abs(dy) <= 0.3 * Math.abs(dx)) {
      if (curve) return "2:0:0";
      return "1:0:" + (isMark || others.some(o => o !== pts && onSegment(b, o[0], o[o.length - 1])) ? 2 : 0);
    }
    if (curve && !isMark && Math.abs(dx) <= 0.7 * Math.abs(dy)) return "2:0:0";
    if (Math.abs(dx) <= 0.3 * Math.abs(dy)) return curve ? "2:0:0" : "1:0:0";
    return dx < 0 ? "2:0:7" : "2:7:8";
  }
  // one item -> a KAGE line ("kind:start:end:x:y:...")
  function kageLine(it, isMark, others) {
    let pts = points(dOf(it));
    const type = typeOf(it) || autoType(pts, isMark, others);
    const kind = +type.split(":")[0];
    if (kind === 1 && pts.length === 3) pts = [pts[0], pts[2]];                                          // a straight KAGE stroke has no control point
    if (kind !== 1 && pts.length === 2) pts = [pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pts[1]];   // a curve needs one: a straight one
    return type + ":" + pts.map(q => q[0] + ":" + q[1]).join(":");
  }
  // a form {strokes, marks} -> {strokes: [KAGE line], marks: [KAGE line | null]}
  function kageForm(f) {
    const others = (f.strokes || []).map(it => points(dOf(it)));
    return {
      strokes: (f.strokes || []).map((it, i) => kageLine(it, false, others.filter((_, j) => j !== i))),
      marks: (f.marks || []).map(it => it ? kageLine(it, true, others) : null),
    };
  }
  // fonts/paths.json -> the KAGE data of kage_outlines.js ({format: "qatt-kage", version, scale, sym})
  function toKage(data) {
    if (!data || data.format !== "qatt-paths") throw new Error("not a qatt-paths file");
    const sym = {};
    for (const [id, f] of Object.entries(data.forms)) sym[id] = kageForm(f);
    return { format: "qatt-kage", version: 1, scale: 1.9, sym };
  }
  // a KAGE line -> an item (the path; with its type only where the rules would give another one)
  function fromKageLine(line, isMark, otherLines) {
    const f = line.split(":").map(Number), type = f.slice(0, 3).join(":");
    const pts = []; for (let i = 3; i + 1 < f.length; i += 2) pts.push([f[i], f[i + 1]]);
    const d = (pts.length === 2 ? `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}` : `M${pts[0][0]} ${pts[0][1]} Q${pts[1][0]} ${pts[1][1]} ${pts[2][0]} ${pts[2][1]}`);
    const others = otherLines.map(l => { const g = l.split(":").map(Number), q = []; for (let i = 3; i + 1 < g.length; i += 2) q.push([g[i], g[i + 1]]); return q; });
    return autoType(points(d), isMark, others) === type ? d : { d, type };
  }
  // the text of fonts/paths.json: one path per line, so that a change shows as a change of that line
  function stringify(data) {
    const items = a => "[\n    " + a.map(it => JSON.stringify(it)).join(",\n    ") + "\n   ]";
    return "{\n \"format\": \"qatt-paths\", \"version\": 1, \"box\": 200,\n \"forms\": {\n" +
      Object.entries(data.forms).map(([id, f]) => `  ${JSON.stringify(id)}: {\n   "strokes": ${items(f.strokes || [])},\n   "marks": ${items(f.marks || [])}\n  }`).join(",\n") +
      "\n }\n}\n";
  }
  return { points, path, autoType, kageLine, kageForm, toKage, fromKageLine, stringify, TOUCH };
});
