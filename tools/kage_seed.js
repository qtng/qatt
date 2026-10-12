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
// another stroke (1:0:2); a vertical is 1:0:0; a stroke running down to the left is a left sweep (2:0:7); one running to the right
// (down or up) is 2:7:8, thin at the start and heavy at the end; one running up to the left is turned round into a down-right one.
const touches = (p, others) => others.some(o => {           // does p lie on the segment o.a -> o.b (within 3 units)?
  const dx = o.b[0] - o.a[0], dy = o.b[1] - o.a[1], l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - o.a[0]) * dx + (p[1] - o.a[1]) * dy) / l2));
  return Math.hypot(o.a[0] + t * dx - p[0], o.a[1] + t * dy - p[1]) < 3;
});
function line(it, lib, others) {
  let a = it.a, b = it.b;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.abs(dy) <= 0.3 * Math.abs(dx)) return "1:0:" + (touches(b, others.filter(o => o !== it)) ? 2 : 0) + ":" + pt(a) + ":" + pt(b);
  if (it.lib === "shu-slight") return curve("2:0:0", a, b, (lib["shu-slight"].h1 + lib["shu-slight"].h2) / 2);
  if (Math.abs(dx) <= 0.3 * Math.abs(dy)) return "1:0:0:" + pt(a) + ":" + pt(b);
  if (dx < 0 && dy < 0) [a, b] = [b, a];
  return curve(dx < 0 ? "2:0:7" : "2:7:8", a, b, 0);
}
const lib = M.DEF.lib, sym = {};
for (const s of SHAPES) for (const id of ["v2-" + s, `v2-${s}-small`, "v2c-" + s]) {
  const sy = M.symbolOf({ sym: {} }, id);
  sym[id] = { strokes: sy.strokes.map(it => line(it, lib, sy.strokes)), marks: sy.marks.map(it => it ? line(it, lib, sy.strokes) : null) };
}
fs.writeFileSync(out, JSON.stringify({ format: "qatt-kage", version: 1, scale: S, sym }, null, 1).replace(/\n\s+("[^"\n]*"|null),?(?=\n)/g, m => m.trim() ? " " + m.trim() : m));
console.log("wrote", out, Object.keys(sym).length, "symbols");
