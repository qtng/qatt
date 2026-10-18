// Drawing of KAGE lines for the font build (kage_outlines.js) and the glyph editor (admin/font/glyph-editor.html): the KAGE engine (Serif =
// mincho, Gothic) or the stroke drawings of pen_strokes.js (Pen, Pen Cut) and kaiti_strokes.js (Khai); one module, so the editor shows what
// the build makes. Node.js: require("./qatt_draw.js")({Kage, penPolygons, kaitiPolygons}); browser: QattDraw({...}).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.QattDraw = factory;
})(typeof self !== "undefined" ? self : this, function ({ Kage, penPolygons, kaitiPolygons, S = 1.9 }) {
const num = l => l.split(":").map(Number);
const ptsOf = l => { const f = num(l); return Array.from({ length: (f.length - 3) / 2 }, (_, i) => [f[3 + 2 * i], f[4 + 2 * i]]); };
const withPts = (l, pts) => num(l).slice(0, 3).join(":") + ":" + pts.map(p => p[0] + ":" + p[1]).join(":");
// a horizontal stroke that ends on a mark (the bar of a T) gets a plain end instead of the triangle while that mark is drawn
const plainEnds = (strokes, marks) => strokes.map(l => {
  const f = l.split(":").map(Number);
  if (f[0] !== 1 || f[2] !== 0 || f.length !== 7 || f[4] !== f[6]) return l;
  const hit = marks.some(m => { const g = m.split(":").map(Number), n = g.length; if (g[0] !== 1 || n !== 7) return false;
    const dx = g[5] - g[3], dy = g[6] - g[4], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((f[5] - g[3]) * dx + (f[6] - g[4]) * dy) / l2));
    return Math.hypot(g[3] + t * dx - f[5], g[4] + t * dy - f[6]) < 1.5; });
  return hit ? "1:" + f[1] + ":2:" + f.slice(3).join(":") : l;
});
// draw the lines of a job with the matrix m: {d: SVG path data (svg units), ink: [left, right] of the outline}
function draw({ lines, w }, m, style = "mincho", bold = 1) {
  const f = ([x, y]) => { const X = m[0] * (x / S) + m[2], Y = m[1] * (y / S) + m[3]; return [X * S, Y * S]; };
  const moved = lines.map(l => withPts(l, ptsOf(l).map(f).map(p => p.map(v => Math.round(v * 1000) / 1000))));
  if (style === "pen" || style === "pen-cut") return outlineOf(penPolygons(moved, 5 * Math.max(w, 0.8) * 0.76 * bold * 1.15, style === "pen-cut"));
  if (style === "kaiti") return outlineOf(kaitiPolygons(moved, 5 * Math.max(w, 0.8) * 0.76 * bold * 1.15));
  const k = new Kage();
  k.kShotai = style === "gothic" ? k.kGothic : k.kMincho;
  const F = k.kFont;
  if (style === "gothic") F.kWidth *= w * 0.76 * bold;   // the glyphs are drawn GROW (1.18) times larger afterwards, so this is a stroke of about the prototype width
  else { F.kMinWidthY *= w * 0.75; F.kMinWidthT *= w * 0.85 * bold; F.kWidth *= w * 0.85 * bold; F.kMinWidthU = 3.5 * w; }   // kMinWidthU: the triangles at the open ends of the horizontals
  k.kBuhin.push("g", moved.join("$"));
  const polys = new Kage.Polygons(); k.makeGlyph(polys, "g");
  return outlineOf(polys.array.map(poly => poly.array.map(q => [q.x, q.y])));
}
// SVG path data and the extent in x of polygons given in KAGE units
function outlineOf(polygons) {
  let d = "", a = Infinity, b = -Infinity;
  for (const poly of polygons) {
    const p = poly.map(q => [q[0] / S, q[1] / S]);
    let area = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; area += u[0] * v[1] - v[0] * u[1]; a = Math.min(a, u[0]); b = Math.max(b, u[0]); }
    const flip = area < 0; if (flip) p.reverse();                  // one orientation for all polygons, so the nonzero fill unites them
    const f = q => q[0].toFixed(3) + " " + q[1].toFixed(3);
    if (poly.smooth) {                         // a closed Catmull-Rom spline through the points, as cubic Bezier curves
      if (!poly.straight) {                    // tiny steps (crowded at the tips) make the boolean operations of the build fail: the outline is sampled anew in even steps of about 0.12
        const m = p.length, cum = [0];
        for (let i = 1; i <= m; i++) cum.push(cum[i - 1] + Math.hypot(p[i % m][0] - p[i - 1][0], p[i % m][1] - p[i - 1][1]));
        const k = Math.max(16, Math.min(m, Math.round(cum[m] / 0.12))), out = [];
        for (let j = 0, i = 0; j < k; j++) {
          const at = cum[m] * j / k; while (cum[i + 1] < at) i++;
          const f = (at - cum[i]) / (cum[i + 1] - cum[i] || 1), a = p[i], b = p[(i + 1) % m];
          out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        }
        p.splice(0, m, ...out);
      }
      const n = p.length, P = i => p[(i + n) % n];
      d += "M" + f(p[0]);
      const straight = new Set((poly.straight || []).map(i => flip ? (2 * n - 2 - i) % n : i));   // segments i -> i + 1 drawn as lines
      for (let i = 0; i < n; i++) { const a = P(i - 1), b = P(i), c = P(i + 1), e = P(i + 2); d += straight.has(i) ? "L" + f(c) : "C" + f([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6]) + " " + f([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6]) + " " + f(c); }
      d += "Z";
    } else d += "M" + p.map(f).join("L") + "Z";
  }
  return { d, ink: [a, b] };
}

return { draw, outlineOf, plainEnds, ptsOf, withPts };
});
