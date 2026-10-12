// Seeds font/kage.json: the symbols of QATT in KAGE data (https://glyphwiki.org/wiki/GlyphWiki:KAGE データ仕様), one list of KAGE
// lines for the strokes and one per mark, for the single form (v2c-X) of every symbol; the halves of a joined pair and of a stack are made from it.
// The seed is made from the standard stroke library of js/brush-model.js; refine the lines by hand afterwards (kage.html shows them).
// Usage: node tools/kage_seed.js [font/kage.json] [--force]   (an existing file is only replaced with --force)
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
// another stroke, or is a mark itself (1:0:2); one that ends on a mark gets 1:0:2 only while that mark is drawn (kage.html, tools/kage_outlines.js); a vertical is 1:0:0; a stroke running down to the left is a left sweep (2:0:7); one running to the right
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
const TOL = 12, NEAR = 6, AXIS = 2, MID_TOL = 3.5;   // MID_TOL: how far from the middle of the box a stroke may be to count as the middle one
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
  // T and +: the strokes crossing a middle vertical stroke are centred on it (a horizontal one is centred on x, its end marks go with it), and
  // the free-ended verticals crossing a middle horizontal stroke are centred on it in y. Marks that touch an end of a moved stroke move along.
  const horiz = it => it.a[1] === it.b[1], vert = it => it.a[0] === it.b[0];
  const onSeg = (p, o, d) => { const q = nearest(p, o); return Math.hypot(q[0] - p[0], q[1] - p[1]) <= d; };
  const carry = (it, axis, delta) => {                      // move the marks that touch an old end of it, by delta along axis
    const ends = [[...it.a], [...it.b]];
    for (const m of mk.filter(Boolean)) if (ends.some(e => onSeg(e, m, 2.2))) { m.a[axis] += delta; m.b[axis] += delta; }
  };
  const note = (what, it, d) => { if (process.env.KAGE_DEBUG) console.log(id0, what, Math.round(d * 100) / 100); };
  for (const M of st.filter(it => vert(it) && it.a[0] === cx)) {
    const y0 = Math.min(M.a[1], M.b[1]), y1 = Math.max(M.a[1], M.b[1]);
    for (const H of st.filter(it => it !== M && horiz(it))) {
      const x0 = Math.min(H.a[0], H.b[0]), x1 = Math.max(H.a[0], H.b[0]);
      if (cx < x0 - 0.5 || cx > x1 + 0.5 || H.a[1] < y0 - 0.5 || H.a[1] > y1 + 0.5) continue;
      const d = cx - (x0 + x1) / 2;
      if (Math.abs(d) > 0.01) { note("crossbar centred on the vertical by", H, d); carry(H, 0, d); H.a[0] += d; H.b[0] += d; }
    }
  }
  for (const M of st.filter(it => horiz(it) && it.a[1] === cy)) {
    const x0 = Math.min(M.a[0], M.b[0]), x1 = Math.max(M.a[0], M.b[0]);
    for (const V of st.filter(it => it !== M && vert(it))) {
      const y0 = Math.min(V.a[1], V.b[1]), y1 = Math.max(V.a[1], V.b[1]);
      if (V.a[0] < x0 - 0.5 || V.a[0] > x1 + 0.5 || cy < y0 - 0.5 || cy > y1 + 0.5) continue;
      const capped = st.some(H => H !== M && horiz(H) && [y0, y1].some(y => Math.abs(H.a[1] - y) < 0.5) && V.a[0] >= Math.min(H.a[0], H.b[0]) - 0.5 && V.a[0] <= Math.max(H.a[0], H.b[0]) + 0.5);
      const d = cy - (y0 + y1) / 2;
      if (capped || Math.abs(d) <= 0.01) continue;
      note("vertical centred on the horizontal by", V, d); carry(V, 1, d); V.a[1] += d; V.b[1] += d;
    }
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
  // A mark sits on the free end of a stroke like the bar of a T: the end nearest to the middle of the mark (within TOL, and the mark roughly
  // perpendicular to the line from that end to its middle) becomes the middle of the mark, and the mark turns perpendicular to the stroke
  // there. A mark with no such end stays as it is.
  const ends = [];
  for (const it of st) for (const k of ["a", "b"]) {
    const e = it[k], o = it[k === "a" ? "b" : "a"], l = Math.hypot(e[0] - o[0], e[1] - o[1]) || 1;
    if (st.some(x => x !== it && Math.hypot(...[0, 1].map(i => nearest(e, x)[i] - e[i])) < 1.2)) continue;   // a junction, not a free end
    ends.push({ p: e, t: [(e[0] - o[0]) / l, (e[1] - o[1]) / l] });
  }
  for (const m of mk.filter(Boolean)) {
    const mid = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2], vx = m.b[0] - m.a[0], vy = m.b[1] - m.a[1], L = Math.hypot(vx, vy) || 1;
    const n = [-vy / L, vx / L];
    let best = null;
    for (const e of ends) {
      const dx = e.p[0] - mid[0], dy = e.p[1] - mid[1], d = Math.hypot(dx, dy);
      // the middle of the mark lies near the end (NEAR units) or in front of it (within 35 degrees of the stroke's direction) and the mark is at most 45 degrees off a T
      let p = [-e.t[1], e.t[0]];
      if (p[0] * vx + p[1] * vy < 0) p = [-p[0], -p[1]];
      if (d > TOL || (d > NEAR && -(dx * e.t[0] + dy * e.t[1]) / d < Math.cos(35 * Math.PI / 180))) continue;
      if (Math.abs(p[0] * vx + p[1] * vy) / L < Math.SQRT1_2) continue;
      if (!best || d < best.d) best = { d, e };
    }
    if (!best) {
      if (process.env.KAGE_DEBUG) { const c = ends.map(e => ({ d: Math.hypot(e.p[0] - mid[0], e.p[1] - mid[1]), e })).sort((x, y) => x.d - y.d)[0]; console.log(id0, "mark unmatched", mid.map(v => Math.round(v * 10) / 10), "nearest end", c && c.e.p.map(v => Math.round(v * 10) / 10), c && Math.round(c.d * 10) / 10); }
      continue;
    }
    let p = [-best.e.t[1], best.e.t[0]];
    if (p[0] * vx + p[1] * vy < 0) p = [-p[0], -p[1]];
    if (process.env.KAGE_DEBUG) console.log(id0, "mark on end", best.e.p.map(v => Math.round(v * 10) / 10), "dist", Math.round(best.d * 10) / 10, "turned", Math.round(Math.abs(Math.atan2(p[0] * vy - p[1] * vx, p[0] * vx + p[1] * vy)) * 180 / Math.PI));
    m.a = [best.e.p[0] - p[0] * L / 2, best.e.p[1] - p[1] * L / 2];
    m.b = [best.e.p[0] + p[0] * L / 2, best.e.p[1] + p[1] * L / 2];
  }
  return { strokes: st, marks: mk, log };
}

const lib = M.DEF.lib, sym = {};
let moved = 0;
for (const s of SHAPES) for (const id of ["v2c-" + s]) {
  const sy = exact(M.symbolOf({ sym: {} }, id).strokes, M.symbolOf({ sym: {} }, id).marks, id);
  moved += sy.log.length;
  sym[id] = { strokes: sy.strokes.map(it => line(it, lib, sy.strokes)), marks: sy.marks.map(it => it ? line(it, lib, sy.strokes, true) : null) };
}
// Optional left forms (v2l-X) and right forms (v2r-X): the shape is made from the single form (v2c-X) by default; a symbol listed here gets its own
// left form, a starting point to refine in kage.html. The lowest horizontal stroke of ong, dong, hong and bong is sloped up to its right end (and the
// marks on that end move with it) so that it does not run into the next component.
const LEFT_SLANT = ["_", "d", "h", "b"], SLANT = 5.7;      // kage units
const nums = l => l.split(":").map(Number), join = f => f.slice(0, 3).join(":") + ":" + f.slice(3).map(v => Math.round(v * 10) / 10).join(":");
for (const sh of LEFT_SLANT) {
  const src = sym["v2c-" + sh], strokes = src.strokes.slice(), marks = src.marks.slice();
  let low = -1, y = -Infinity;
  strokes.forEach((l, i) => { const f = nums(l); if (f[0] === 1 && f.length === 7 && Math.abs(f[6] - f[4]) <= 0.3 * Math.abs(f[5] - f[3]) && Math.max(f[4], f[6]) > y) { y = Math.max(f[4], f[6]); low = i; } });
  if (low < 0) continue;
  const f = nums(strokes[low]), right = f[3] > f[5] ? 0 : 1;      // the end with the larger x
  const ex = f[3 + 2 * right], ey = f[4 + 2 * right];
  f[4 + 2 * right] -= SLANT; strokes[low] = join(f);
  marks.forEach((m, i) => {                                      // a mark whose middle lies on that end goes up with it
    if (!m) return; const g = nums(m); if (g.length !== 7 || Math.hypot((g[3] + g[5]) / 2 - ex, (g[4] + g[6]) / 2 - ey) > 1.5) return;
    g[4] -= SLANT; g[6] -= SLANT; marks[i] = join(g);
  });
  sym["v2l-" + sh] = { strokes, marks };
}
fs.writeFileSync(out, JSON.stringify({ format: "qatt-kage", version: 1, scale: S, sym }, null, 1).replace(/\n\s+("[^"\n]*"|null),?(?=\n)/g, m => m.trim() ? " " + m.trim() : m));
console.log("wrote", out, Object.keys(sym).length, "symbols;", moved, "ends moved onto other strokes");
