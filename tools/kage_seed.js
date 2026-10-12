// Seeds font/kage.json: the symbols of QATT in KAGE data (https://glyphwiki.org/wiki/GlyphWiki:KAGE データ仕様), one list of KAGE
// lines for the strokes and one per mark, for the rhyme form (v2-X), the onset form (v2-X-small) and the centred form (v2c-X).
// The seed is made from the standard stroke library of js/brush-model.js; refine the lines by hand afterwards (kage.html shows them).
// Usage: node tools/kage_seed.js [font/kage.json]   (an existing file is only replaced with --force)
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const B = require(path.join(root, "js/brush.js")), Q = require(path.join(root, "js/brush-model.js"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/parser.js"), "utf8") + ";this.SHAPES = VietnameseParser.SHAPES;", ctx);
const src = fs.readFileSync(path.join(root, "js/qatt.js"), "utf8");
const defs = src.slice(src.indexOf("const defaultSvgDefs"), src.indexOf("const defaultQattEncoding"));
const ORIG = {};
for (const m of defs.matchAll(/<path id="([^"]+)"[^>]*?\sd="([^"]+)"/g)) ORIG[m[1]] = m[2];
const SHAPES = [...ctx.SHAPES].map(s => s === "z" ? "_" : s);
const M = Q(B, SHAPES, ORIG);
const out = process.argv.slice(2).find(a => !a.startsWith("--")) || path.join(root, "font/kage.json");
if (fs.existsSync(out) && !process.argv.includes("--force")) { console.error(out + " exists (use --force)"); process.exit(1); }

const S = 1.9;                                   // qatt.js units -> KAGE box of 200
const r = v => Math.round(v * S * 10) / 10;
const pt = p => r(p[0]) + ":" + r(p[1]);
const curve = (head, a, b, h) => {               // quadratic through a, control point, b; h = bulge to the left of a -> b in chord lengths
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return head + ":" + pt(a) + ":" + pt([(a[0] + b[0]) / 2 + dy * h, (a[1] + b[1]) / 2 - dx * h]) + ":" + pt(b);
};
// Mincho conventions found by trial (see the notes in tools/README.md): a horizontal ends in the triangle (1:0:0) unless it ends on
// another stroke or is a mark (1:0:2); a vertical is 1:0:0; a stroke running down to the left is a left sweep (2:0:7); one running to the right
// (down or up) is 2:7:8, thin at the start and heavy at the end; one running up to the left is turned round into a down-right one.
const touches = (p, others) => others.some(o => {           // does p lie on the segment o.a -> o.b (within 3 units)?
  const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - o.a[0]) * dx + (p[1] - o.a[1]) * dy) / l2));
  return Math.hypot(o.a[0] + t * dx - p[0], o.a[1] + t * dy - p[1]) < 3;
});
function line(it, lib, others, isMark) {
  let a = it.a, b = it.b;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.abs(dy) <= 0.3 * Math.abs(dx)) return "1:0:" + (isMark || touches(b, others.filter(o => o !== it)) ? 2 : 0) + ":" + pt(a) + ":" + pt(b);
  if (it.lib === "shu-slight") return curve("2:0:0", a, b, (lib["shu-slight"].h1 + lib["shu-slight"].h2) / 2);
  if (Math.abs(dx) <= 0.3 * Math.abs(dy)) return "1:0:0:" + pt(a) + ":" + pt(b);
  if (dx < 0 && dy < 0) [a, b] = [b, a];
  return curve(dx < 0 ? "2:0:7" : "2:7:8", a, b, 0);
}
// The paths of qatt.js are not exact: a stroke may end a little beside or short of another one, because a heavy pen hides that. KAGE
// draws thin strokes, so the ends are put right first: nearly horizontal and vertical strokes become exact, and an end that falls short of
// another stroke by up to TOL units moves onto it (along its own direction, so its angle is kept). Overshoots stay: overhangs are design.
const TOL = 12, MARK_TOL = 5, AXIS = 2, MID_TOL = 3.5;   // MID_TOL: how far from the middle of the box a stroke may be to count as the middle one
const nearest = (p, o) => {
  const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - o.a[0]) * dx + (p[1] - o.a[1]) * dy) / l2));
  return [o.a[0] + t * dx, o.a[1] + t * dy];
};
function exact(strokes, marks, id0) {
  const cp = it => it && { lib: it.lib, a: [...it.a], b: [...it.b] };
  const st = strokes.map(cp), mk = marks.map(cp), log = [];
  for (const it of [...st, ...mk.filter(Boolean)]) {
    if (Math.abs(it.b[1] - it.a[1]) <= AXIS) it.a[1] = it.b[1] = (it.a[1] + it.b[1]) / 2;
    if (Math.abs(it.b[0] - it.a[0]) <= AXIS) it.a[0] = it.b[0] = (it.a[0] + it.b[0]) / 2;
  }
  // an end moves along its own stroke (its direction stays) to where that line meets another stroke, when that is within TOL
  // a vertical stroke near the middle of the glyph box goes exactly to the middle, and so does a horizontal one
  const [cx, cy] = id0.endsWith("-small") ? [27, 48] : id0.startsWith("v2c-") ? [49.25, 48] : [77, 48];
  for (const it of st) {
    if (it.a[0] === it.b[0] && Math.abs(it.a[0] - cx) <= MID_TOL && it.a[0] !== cx) { if (process.env.KAGE_DEBUG) console.log(id0, "vertical to the middle", it.a[0], "->", cx); it.a[0] = it.b[0] = cx; }
    if (it.a[1] === it.b[1] && Math.abs(it.a[1] - cy) <= MID_TOL && it.a[1] !== cy) { if (process.env.KAGE_DEBUG) console.log(id0, "horizontal to the middle", it.a[1], "->", cy); it.a[1] = it.b[1] = cy; }
  }
  // l (three verticals) and z (three horizontals): the two outer strokes are equally far from the middle one (the mean of both distances)
  const shape = id0.replace(/^v2c?-/, "").replace(/-small$/, "");
  if (shape === "l" || shape === "_") {
    const ax = shape === "l" ? 0 : 1, [o1, m, o2] = st, mid = it => (it.a[ax] + it.b[ax]) / 2, d = (mid(m) - mid(o1) + mid(o2) - mid(m)) / 2;
    for (const [it, to] of [[o1, mid(m) - d], [o2, mid(m) + d]]) { const sh = to - mid(it); it.a[ax] += sh; it.b[ax] += sh; }
  }
  const snap = (it, k, others, tol) => {
    const p = it[k], q = it[k === "a" ? "b" : "a"], dx = p[0] - q[0], dy = p[1] - q[1];
    let best = null;
    for (const o of others) {
      if (o === it) continue;
      const ox = o.b[0] - o.a[0], oy = o.b[1] - o.a[1], den = dx * oy - dy * ox, ol = Math.hypot(ox, oy) || 1;
      if (Math.abs(den) < 0.2 * Math.hypot(dx, dy) * ol) continue;           // nearly parallel
      const wx = o.a[0] - q[0], wy = o.a[1] - q[1];
      const t = (wx * oy - wy * ox) / den, u = (wx * dy - wy * dx) / den;     // q + t d = o.a + u (o.b - o.a)
      if (u < -tol / ol || u > 1 + tol / ol || t < 1) continue;       // only a gap is closed; an end that overshoots stays (an overhang is part of the design)
      const X = [q[0] + t * dx, q[1] + t * dy], d = Math.hypot(X[0] - p[0], X[1] - p[1]);
      if (d <= tol && (!best || d < best.d)) best = { d, X };
    }
    if (best && best.d > 0.05) { log.push(best.d); if (process.env.KAGE_DEBUG) console.log(id0, k, "moved", Math.round(best.d * 10) / 10, it[k].map(Math.round), "->", best.X.map(Math.round)); it[k] = best.X; }
  };
  for (const it of st) { snap(it, "a", st, TOL); snap(it, "b", st, TOL); }
  for (const it of mk.filter(Boolean)) { snap(it, "a", st, MARK_TOL); snap(it, "b", st, MARK_TOL); }
  return { strokes: st, marks: mk, log };
}

const lib = M.DEF.lib, sym = {};
let moved = 0;
for (const s of SHAPES) for (const id of ["v2-" + s, `v2-${s}-small`, "v2c-" + s]) {
  const sy = exact(M.symbolOf({ sym: {} }, id).strokes, M.symbolOf({ sym: {} }, id).marks, id);
  moved += sy.log.length;
  sym[id] = { strokes: sy.strokes.map(it => line(it, lib, sy.strokes)), marks: sy.marks.map(it => it ? line(it, lib, sy.strokes, true) : null) };
}
fs.writeFileSync(out, JSON.stringify({ format: "qatt-kage", version: 1, scale: S, sym }, null, 1).replace(/\n\s+("[^"\n]*"|null),?(?=\n)/g, m => m.trim() ? " " + m.trim() : m));
console.log("wrote", out, Object.keys(sym).length, "symbols;", moved, "ends moved onto other strokes");
