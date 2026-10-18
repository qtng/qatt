// KAGE outlines for the font build (build_font.py --kage): the KAGE lines of the symbols, made by qatt_paths.js from the open paths of fonts/paths.json
// (edited in glyph-editor.html; a file of KAGE lines, format qatt-kage, works too), are moved first (the squeezes of the half-width and stacked variants), then the KAGE engine (js/kage-engine.min.js) draws the strokes
// with widths that follow the weight of the variant, so a squeezed glyph keeps its stroke widths. The engine is GPL-3.0 (js/kage-engine.COPYING).
// Usage: node tools/kage_outlines.js fonts/paths.json jobs.json out.json [mincho|gothic|pen|pen-cut|kaiti] [bold factor]
//   jobs.json: [{ids: [qatt.js path ids], m: [sx, sy, tx, ty] (x -> sx*x + tx, y -> sy*y + ty, svg units), w: weight factor (1 = the standard stroke),
//                fit: [left, right] (optional: sx and tx are then found so that the outline spans exactly this), ink: true (optional: answer [left, right] of the outline)}]
//              an id "v2-X3@onset" is the mark v2-X3 of the rhyme form moved onto the onset form (the box of v2-X onto v2-X-small)
//   out.json:  [SVG path data (svg units) of the filled outline of each job, or [left, right] for an ink job]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/parser.js"), "utf8") + ";this.SHAPES = VietnameseParser.SHAPES;", ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/kage-engine.min.js"), "utf8") + ";this.Kage = Kage;", ctx);
const Kage = ctx.Kage, { penPolygons } = require("./pen_strokes.js"), { kaitiPolygons } = require("./kaiti_strokes.js");
const SHAPES = [...ctx.SHAPES].map(s => s === "z" ? "_" : s);

const [kageFile, jobsFile, outFile, style = "mincho", boldArg = "1"] = process.argv.slice(2);
const bold = +boldArg || 1;                  // build_font.py --bold: 1.7 for Gothic (the stroke), 1.8 for Mincho (the verticals; the thin horizontals stay)
const raw = JSON.parse(fs.readFileSync(kageFile, "utf8"));
const data = raw.format === "qatt-paths" ? require("./qatt_paths.js").toKage(raw) : raw, S = data.scale || 1.9, SYM = data.sym;
const { draw: drawLines, plainEnds, ptsOf, withPts } = require("./qatt_draw.js")({ Kage, penPolygons, kaitiPolygons, S });   // the drawing, shared with the glyph editor
const draw = (job, m) => drawLines(job, m, style, bold);

// qatt.js path id (or v2l-X / v2r-X, the left and right form of a symbol) -> {sym, mark}: the KAGE symbol it belongs to and the index of the mark (undefined: the strokes)
function target(id) {
  let m;
  if ((m = id.match(/^(v2c?)-(.+)-medial$/)) && SHAPES.includes(m[2])) return { sym: `${m[1]}-${m[2]}-small`.replace("v2c-", "v2-"), mark: 0 };
  if ((m = id.match(/^(v2)-(.+)-small$/)) && SHAPES.includes(m[2])) return { sym: id };
  if ((m = id.match(/^(v2[clr]?)-(.+?)([1-6])$/)) && SHAPES.includes(m[2])) return { sym: `${m[1]}-${m[2]}`, mark: +m[3] - 1 };
  if ((m = id.match(/^(v2[clr]?)-(.+)$/)) && SHAPES.includes(m[2])) return { sym: id };
  throw new Error("no KAGE data for " + id);
}
// the box of the strokes of a symbol (its end and control points)
function box(sym) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const l of SYM[sym].strokes) for (const [x, y] of ptsOf(l)) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); }
  return b;
}
function onsetMap(shape) {                       // the box of the rhyme form onto the box of the onset form
  const [a0, b0, a1, b1] = box("v2-" + shape), [c0, d0, c1, d1] = box(`v2-${shape}-small`);
  const sx = (c1 - c0) / (a1 - a0), sy = (d1 - d0) / (b1 - b0);
  return ([x, y]) => [c0 + (x - a0) * sx, d0 + (y - b0) * sy];
}
function linesOf(id) {
  const onset = id.endsWith("@onset"), base = onset ? id.slice(0, -6) : id, t = target(base);
  const sy = SYM[t.sym] || SYM[t.sym.replace(/^v2[lr]-/, "v2c-")];   // v2l-X / v2r-X (left / right form): only a symbol with its own form has one, the others use the single form
  if (!sy) throw new Error("no KAGE symbol " + t.sym);
  const ls = t.mark === undefined ? sy.strokes : [sy.marks[t.mark]].filter(Boolean);
  if (!onset) return ls;
  const g = onsetMap(t.sym.replace(/^v2c?-/, ""));
  return ls.map(l => withPts(l, ptsOf(l).map(g)));
}

const out = JSON.parse(fs.readFileSync(jobsFile, "utf8")).map(({ ids, m, w, fit, ink }) => {
  const all = ids.map(id => ({ mark: target(id.replace(/@onset$/, "")).mark !== undefined, ls: linesOf(id) }));
  const strokes = all.filter(x => !x.mark).flatMap(x => x.ls), marks = all.filter(x => x.mark).flatMap(x => x.ls);
  const job = { lines: plainEnds(strokes, marks).concat(marks), w };
  let r = draw(job, m);
  if (ink) return r.ink;                       // only the extent of the outline
  if (fit) {                                   // scale and move the lines in x until the outline (with the widths of the strokes) spans fit = [left, right]
    const xs = job.lines.flatMap(l => ptsOf(l).map(p => p[0] / S)), span = Math.max(...xs) - Math.min(...xs);
    m = m.slice();
    for (let i = 0; i < 3; i++) {
      const extra = (r.ink[1] - r.ink[0]) - span * m[0];     // what the widths of the strokes add
      m[0] = Math.max(0.05, (fit[1] - fit[0] - extra) / span);
      r = draw(job, m); m[2] += fit[0] - r.ink[0]; r = draw(job, m);
    }
  }
  return r.d;
});
fs.writeFileSync(outFile, JSON.stringify(out));
