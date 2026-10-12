// KAGE outlines for the font build (build_font.py --kage): the KAGE lines of the symbols in font/kage.json (made and refined with kage.html)
// are moved first (the squeezes of the half-width and stacked variants), then the KAGE engine (js/kage-engine.min.js) draws the strokes
// with widths that follow the weight of the variant, so a squeezed glyph keeps its stroke widths. The engine is GPL-3.0 (js/kage-engine.COPYING).
// Usage: node tools/kage_outlines.js font/kage.json jobs.json out.json [mincho|gothic]
//   jobs.json: [{ids: [qatt.js path ids], m: [sx, sy, tx, ty] (x -> sx*x + tx, y -> sy*y + ty, svg units), w: weight factor (1 = the standard stroke)}]
//              an id "v2-X3@onset" is the mark v2-X3 of the rhyme form moved onto the onset form (the box of v2-X onto v2-X-small)
//   out.json:  [SVG path data (svg units) of the filled outline of each job]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/parser.js"), "utf8") + ";this.SHAPES = VietnameseParser.SHAPES;", ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/kage-engine.min.js"), "utf8") + ";this.Kage = Kage;", ctx);
const Kage = ctx.Kage;
const SHAPES = [...ctx.SHAPES].map(s => s === "z" ? "_" : s);

const [kageFile, jobsFile, outFile, style = "mincho"] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(kageFile, "utf8")), S = data.scale || 1.9, SYM = data.sym;
const num = l => l.split(":").map(Number);
const ptsOf = l => { const f = num(l); return Array.from({ length: (f.length - 3) / 2 }, (_, i) => [f[3 + 2 * i], f[4 + 2 * i]]); };
const withPts = (l, pts) => num(l).slice(0, 3).join(":") + ":" + pts.map(p => p[0] + ":" + p[1]).join(":");

// qatt.js path id -> {sym, mark}: the KAGE symbol it belongs to and the index of the mark (undefined: the strokes)
function target(id) {
  let m;
  if ((m = id.match(/^(v2c?)-(.+)-medial$/)) && SHAPES.includes(m[2])) return { sym: `${m[1]}-${m[2]}-small`.replace("v2c-", "v2-"), mark: 0 };
  if ((m = id.match(/^(v2)-(.+)-small$/)) && SHAPES.includes(m[2])) return { sym: id };
  if ((m = id.match(/^(v2c?)-(.+?)([1-6])$/)) && SHAPES.includes(m[2])) return { sym: `${m[1]}-${m[2]}`, mark: +m[3] - 1 };
  if ((m = id.match(/^(v2c?)-(.+)$/)) && SHAPES.includes(m[2])) return { sym: id };
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
// a horizontal stroke that ends on a mark (the bar of a T) gets a plain end instead of the triangle while that mark is drawn
const plainEnds = (strokes, marks) => strokes.map(l => {
  const f = l.split(":").map(Number);
  if (f[0] !== 1 || f[2] !== 0 || f.length !== 7 || f[4] !== f[6]) return l;
  const hit = marks.some(m => { const g = m.split(":").map(Number), n = g.length; if (g[0] !== 1 || n !== 7) return false;
    const dx = g[5] - g[3], dy = g[6] - g[4], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((f[5] - g[3]) * dx + (f[6] - g[4]) * dy) / l2));
    return Math.hypot(g[3] + t * dx - f[5], g[4] + t * dy - f[6]) < 1.5; });
  return hit ? "1:" + f[1] + ":2:" + f.slice(3).join(":") : l;
});
function linesOf(id) {
  const onset = id.endsWith("@onset"), base = onset ? id.slice(0, -6) : id, t = target(base), sy = SYM[t.sym];
  if (!sy) throw new Error("no KAGE symbol " + t.sym);
  const ls = t.mark === undefined ? sy.strokes : [sy.marks[t.mark]].filter(Boolean);
  if (!onset) return ls;
  const g = onsetMap(t.sym.replace(/^v2c?-/, ""));
  return ls.map(l => withPts(l, ptsOf(l).map(g)));
}

const out = JSON.parse(fs.readFileSync(jobsFile, "utf8")).map(({ ids, m, w }) => {
  // move the lines: kage units -> svg units -> the matrix -> kage units again (so the widths below keep their meaning)
  const f = ([x, y]) => { const X = m[0] * (x / S) + m[2], Y = m[1] * (y / S) + m[3]; return [X * S, Y * S]; };
  const all = ids.map(id => ({ mark: target(id.replace(/@onset$/, "")).mark !== undefined, ls: linesOf(id) }));
  const strokes = all.filter(x => !x.mark).flatMap(x => x.ls), marks = all.filter(x => x.mark).flatMap(x => x.ls);
  const lines = plainEnds(strokes, marks).concat(marks).map(l => withPts(l, ptsOf(l).map(f).map(p => p.map(v => Math.round(v * 1000) / 1000))));
  const k = new Kage();
  k.kShotai = style === "gothic" ? k.kGothic : k.kMincho;
  const F = k.kFont;
  if (style === "gothic") F.kWidth *= w * 0.76;   // the glyphs are drawn GROW (1.18) times larger afterwards, so this is a stroke of about the prototype width
  else { F.kMinWidthY *= w * 1.2; F.kMinWidthT *= w * 0.75; F.kWidth *= w * 0.75; F.kMinWidthU = 5 * w; }   // kMinWidthU: the triangles at the open ends of the horizontals
  k.kBuhin.push("g", lines.join("$"));
  const polys = new Kage.Polygons(); k.makeGlyph(polys, "g");
  let d = "";
  for (const poly of polys.array) {
    const p = poly.array.map(q => [q.x / S, q.y / S]);
    let area = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (area < 0) p.reverse();                  // one orientation for all polygons, so the nonzero fill unites them
    d += "M" + p.map(q => q[0].toFixed(3) + " " + q[1].toFixed(3)).join("L") + "Z";
  }
  return d;
});
fs.writeFileSync(outFile, JSON.stringify(out));
