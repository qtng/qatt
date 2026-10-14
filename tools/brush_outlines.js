// Brush outlines for the font build (build_font.py): the centre lines of the qatt.js paths are moved first and then
// get the brush of an export of brush.html or brush2.html, so a squeezed glyph keeps its stroke widths.
// Usage: node tools/brush_outlines.js fonts/brush.json jobs.json out.json
//   jobs.json: [{ids: [qatt.js path ids], m: [sx, sy, tx, ty] (x -> sx*x + tx, y -> sy*y + ty, svg units), w: weight factor}]
//              an id "v2-X3@onset" is the mark v2-X3 of the rhyme form moved onto the onset form (the box of v2-X onto v2-X-small)
//   out.json:  [SVG path data of the filled outline of each job]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const B = require(path.join(root, "js/brush.js"));
const B2 = require(path.join(root, "js/brush2.js"));
const QattBrushModel = require(path.join(root, "js/brush-model.js"));
const QattBrush2Model = require(path.join(root, "js/brush2-model.js"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/parser.js"), "utf8") + ";this.SHAPES = VietnameseParser.SHAPES;", ctx);
const src = fs.readFileSync(path.join(root, "js/qatt.js"), "utf8");
const defs = src.slice(src.indexOf("const defaultSvgDefs"), src.indexOf("const defaultQattEncoding"));
const ORIG = {};
for (const m of defs.matchAll(/<path id="([^"]+)"[^>]*?\sd="([^"]+)"/g)) ORIG[m[1]] = m[2];

const [brushFile, jobsFile, outFile] = process.argv.slice(2);
const exp = JSON.parse(fs.readFileSync(brushFile, "utf8"));
// an export of brush.html (version 2) or of brush2.html (version 3)
const state = { params: exp.params, lib: exp.lib, sym: exp.sym || {} };
const SHAPES = [...ctx.SHAPES].map(s => s === "z" ? "_" : s);
const M = exp.version === 3 ? QattBrush2Model(B, B2, SHAPES, ORIG, exp) : QattBrushModel(B, SHAPES, ORIG);
// box of the centre lines (end and control points) of a path
function box(id) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const st of M.strokesOf(state, id)) for (const s of st.c ? [st.c] : st.s) for (let i = 0; i < 8; i += 2) {
    b[0] = Math.min(b[0], s[i]); b[1] = Math.min(b[1], s[i + 1]); b[2] = Math.max(b[2], s[i]); b[3] = Math.max(b[3], s[i + 1]);
  }
  return b;
}
function onsetMap(shape) {
  const [a0, b0, a1, b1] = box("v2-" + shape), [c0, d0, c1, d1] = box(`v2-${shape}-small`);
  const sx = (c1 - c0) / (a1 - a0), sy = (d1 - d0) / (b1 - b0);
  return ([x, y]) => [c0 + (x - a0) * sx, d0 + (y - b0) * sy];
}
const out = JSON.parse(fs.readFileSync(jobsFile, "utf8")).map(({ ids, m, w }) => ids.map(id => {
  const f = ([x, y]) => [m[0] * x + m[2], m[1] * y + m[3]];
  if (!id.endsWith("@onset")) return M.outline(state, id, f, w);
  const base = id.slice(0, -6), g = onsetMap(base.replace(/^v2-|\d$/g, ""));
  return M.outline(state, base, p => f(g(p)), w);
}).join(""));
fs.writeFileSync(outFile, JSON.stringify(out));
