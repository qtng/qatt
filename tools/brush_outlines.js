// Brush outlines for the font build (build_font.py): the centre lines of the qatt.js paths are moved first and then
// get the brush of an export of brush.html, so a squeezed glyph keeps its stroke widths.
// Usage: node tools/brush_outlines.js font/brush.json jobs.json out.json
//   jobs.json: [{ids: [qatt.js path ids], m: [sx, sy, tx, ty] (x -> sx*x + tx, y -> sy*y + ty, svg units), w: weight factor}]
//   out.json:  [SVG path data of the filled outline of each job]
const fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.join(__dirname, "..");
const B = require(path.join(root, "js/brush.js"));
const QattBrushModel = require(path.join(root, "js/brush-model.js"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "js/parser.js"), "utf8") + ";this.SHAPES = VietnameseParser.SHAPES;", ctx);
const src = fs.readFileSync(path.join(root, "js/qatt.js"), "utf8");
const defs = src.slice(src.indexOf("const defaultSvgDefs"), src.indexOf("const defaultQattEncoding"));
const ORIG = {};
for (const m of defs.matchAll(/<path id="([^"]+)"[^>]*?\sd="([^"]+)"/g)) ORIG[m[1]] = m[2];

const [brushFile, jobsFile, outFile] = process.argv.slice(2);
const exp = JSON.parse(fs.readFileSync(brushFile, "utf8"));
const state = { params: exp.params, lib: exp.lib, sym: exp.sym || {} };
const M = QattBrushModel(B, [...ctx.SHAPES].map(s => s === "z" ? "_" : s), ORIG);
const out = JSON.parse(fs.readFileSync(jobsFile, "utf8")).map(({ ids, m, w }) =>
  ids.map(id => M.outline(state, id, ([x, y]) => [m[0] * x + m[2], m[1] * y + m[3]], w)).join(""));
fs.writeFileSync(outFile, JSON.stringify(out));
