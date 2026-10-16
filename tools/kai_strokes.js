// The Kai (regular script) stroke drawing for the font build (kage_outlines.js, style "kai"): the KAGE lines of fonts/kage.json (straight 1 and
// quadratic 2 strokes) are drawn as brush strokes of varying width instead of by the KAGE engine, which only knows Mincho and Gothic.
//   horizontal: slightly bowed upwards, a press at the start (a cut slanted like the brush entering), a rounded bulge where it stops, thinner than the verticals
//   vertical:   a press at the start, round "dewdrop" end (垂露)
//   falling curve (and slanted line): a press at the start, round end, the same width throughout (no taper)
//   style "lishu" (clerical script): the horizontals are the main strokes, wavy, with a round "silkworm head" at the start and a flared "swallow tail" at the end; verticals thinner, plain and blunt;
//   falling strokes widen to a flared end
// kaiPolygons(lines, W, style = "kai") -> polygons [[x, y], ...] in the KAGE units of the input; W is the standard stroke width in these units.
"use strict";
const nums = l => l.split(":").map(Number);
const lerp = (a, b, t) => a + (b - a) * t;

function centreline(f, bow, wave) {                  // the points of a stroke, sampled, with the bow added to a horizontal
  const p = []; for (let i = 3; i + 1 < f.length; i += 2) p.push([f[i], f[i + 1]]);
  const len = Math.hypot(p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]);
  const n = Math.max(10, Math.min(40, Math.ceil(len / 2)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let x, y;
    if (f[0] === 2 && p.length === 3) { const u = 1 - t; x = u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0]; y = u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]; }
    else { x = lerp(p[0][0], p[p.length - 1][0], t); y = lerp(p[0][1], p[p.length - 1][1], t); }
    out.push([x, y - bow * 4 * t * (1 - t) - wave * Math.sin(2 * Math.PI * t), t]);
  }
  return { pts: out, len };
}
const ease = x => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

// does the point touch another stroke (a junction: no press or bulge there)?
function touches(pt, others, W) {
  for (const o of others) {
    const q = []; for (let i = 3; i + 1 < o.length; i += 2) q.push([o[i], o[i + 1]]);
    const m = o[0] === 2 && q.length === 3 ? 12 : 1;
    for (let k = 0; k < m; k++) {
      const t0 = k / m, t1 = (k + 1) / m, at = t => { const u = 1 - t; return o[0] === 2 && q.length === 3 ? [u * u * q[0][0] + 2 * u * t * q[1][0] + t * t * q[2][0], u * u * q[0][1] + 2 * u * t * q[1][1] + t * t * q[2][1]] : [lerp(q[0][0], q[q.length - 1][0], t), lerp(q[0][1], q[q.length - 1][1], t)]; };
      const a = at(t0), b = at(t1), vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * vx + (pt[1] - a[1]) * vy) / l2));
      if (Math.hypot(a[0] + t * vx - pt[0], a[1] + t * vy - pt[1]) < 1.3 * W) return true;
    }
  }
  return false;
}

function stroke(line, W, others, style) {
  const li = style === "lishu";
  const f = nums(line), p0 = [f[3], f[4]], p1 = [f[f.length - 2], f[f.length - 1]];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], ax = Math.abs(dx), ay = Math.abs(dy);
  let kind;
  if (f[0] === 1) kind = ay < ax * 0.3 ? "h" : ax < ay * 0.3 ? "v" : "d";
  else kind = f[1] === 7 ? "arc" : "fall";
  const len0 = Math.hypot(dx, dy);
  const free0 = !touches(p0, others, W), free1 = !touches(p1, others, W);
  const bow = kind === "h" && !li ? Math.min(len0 * 0.035, 2.6) : 0, wave = kind === "h" && li ? Math.min(len0 * 0.045, 3) : 0;
  const { pts, len } = centreline(f, bow, wave);
  // full width at distance d from the start
  const width = (d, t) => {
    const e = len - d, press = Math.min(3 * W, len * 0.3);
    if (li) switch (kind) {
      case "h": return 0.95 * W * (1 + (free0 ? 0.75 : 0) * ease(1 - d / press) + (free1 ? 0.95 : 0) * ease(1 - e / press));   // head and tail
      case "v": return 0.8 * W;
      case "d": case "fall": return W * (0.85 + (free1 ? 0.8 : 0) * ease(1 - e / press) + 0.15 * ease(1 - d / press));
      default: return 0.9 * W;
    }
    switch (kind) {
      case "h": return 0.82 * W * (1 + (free0 ? 0.55 : 0) * ease(1 - d / press) + (free1 ? 0.45 : 0) * ease(1 - e / press));
      case "v": return 1.08 * W * (1 + (free0 ? 0.3 : 0) * ease(1 - d / press) + (free1 ? 0.25 : 0) * ease(1 - e / press));
      case "d": return W * (1 + 0.15 * ease(1 - d / press));
      case "fall": return W * (1 + 0.3 * ease(1 - d / press) + (free1 ? 0.15 : 0) * ease(1 - e / press));
      default: return W * 0.95;                // arc
    }
  };
  const L = [], R = [], N = pts.length; let d = 0;
  for (let i = 0; i < N; i++) {
    if (i) d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const hw = width(d, pts[i][2]) / 2;
    L.push([pts[i][0] - ty * hw, pts[i][1] + tx * hw]); R.push([pts[i][0] + ty * hw, pts[i][1] - tx * hw]);
  }
  const cap = (i, dir, r, slant) => {          // the points of the end cap, from the left to the right side of the stroke
    const c = pts[i], hw = Math.hypot(L[i][0] - c[0], L[i][1] - c[1]);
    const nx = (L[i][0] - c[0]) / (hw || 1), ny = (L[i][1] - c[1]) / (hw || 1), tx = ny * dir, ty = -nx * dir;   // outward tangent
    const o = [];
    if (r) { for (let k = 1; k < 8; k++) { const a = Math.PI * k / 8; o.push([c[0] + hw * (nx * Math.cos(a) + tx * Math.sin(a)), c[1] + hw * (ny * Math.cos(a) + ty * Math.sin(a))]); } }
    else if (slant) o.push([c[0] + tx * slant * hw, c[1] + ty * slant * hw]);   // a cut slanted by moving the middle of the end outwards
    return o;
  };
  const roundEnd = free1 && !(li && kind === "v");
  if (!li && free0 && (kind === "h" || kind === "v")) {   // the brush enters at an angle: one corner of the start is drawn further out
    const T = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]], tl = Math.hypot(T[0], T[1]) || 1, o = 0.45 * Math.hypot(L[0][0] - pts[0][0], L[0][1] - pts[0][1]);
    const c = kind === "h" ? R : L; c[0] = [c[0][0] + T[0] / tl * o, c[0][1] + T[1] / tl * o];
  }
  const poly = [...L, ...cap(N - 1, 1, roundEnd, 0), ...R.slice().reverse(), ...cap(0, -1, kind === "arc" || (li && kind === "h" && free0), 0).reverse()];
  return poly;
}

function kaiPolygons(lines, W, style = "kai") { const fs = lines.map(nums); return fs.map((f, i) => stroke(lines[i], W, fs.filter((_, j) => j !== i), style)); }
module.exports = { kaiPolygons };
