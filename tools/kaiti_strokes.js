// The Kaiti stroke drawing (regular script written with a brush) for the font build (kage_outlines.js, style "kaiti"): the KAGE lines of fonts/kage.json
// (straight 1 and quadratic 2 strokes) are drawn as brush strokes of varying width, as in a Kaiti typeface, instead of by the KAGE engine.
//   horizontal (橫):  rises a little to the right, thin, a pressed triangle at the start, a bulge (頓) where it stops
//   vertical (豎):    a pressed round start, thinner towards the end, which is a round dewdrop (垂露)
//   left falling (撇): heavy at the start, tapering to a sharp point
//   right falling (捺, 點): thin at the start, swelling to a flat foot (the dot a drop)
//   arc (hook, turn): the same width throughout, round ends
// kaitiPolygons(lines, W) -> polygons [[x, y], ...] in the KAGE units of the input; W is the standard stroke width in these units.
"use strict";
const { nums, centreline, ease, touches } = require("./pen_strokes.js");

// The horizontal stroke, taken from a Kaiti glyph (the lower right stroke of 2693E.svg in chunom-assets glyph-composer/new, measured at W = 90 units):
// a wedge with a straight top edge that rises 0.125 per unit of length and an almost flat bottom edge. At the left a pointed start whose belly hangs below the line,
// at the right a rounded bulge that falls back to the tip. The ends keep their size in units of W whatever the length; the middle stretches.
// Offsets are in W (positive downwards), measured from the line between the two tips; d is the distance from the left tip, e from the right tip, both in W.
const RISE = 0.125, BASE = 0.2;
const BELLY = [[0, -0.167], [0.022, -0.08], [0.056, -0.021], [0.111, 0.052], [0.222, 0.164], [0.389, 0.301], [0.556, 0.415], [0.778, 0.529], [1, 0.603], [1.33, 0.63], [1.78, 0.56], [2.22, 0.47], [2.67, 0.38], [3.11, 0.31], [4.4, 0.13], [5.8, 0.02], [7, 0]];   // bottom edge near the start, above BASE
const STARTTOP = [[0, 0.043], [0.022, -0.021], [0.056, -0.047], [0.111, -0.067], [0.222, -0.078], [0.389, -0.073], [0.556, -0.069], [0.778, -0.064], [1, -0.059], [1.33, -0.053], [2.22, -0.033], [3.1, -0.01], [4, 0]];   // the top edge near the start, against the rising line (the rounded corner)
const TIPDROP = [[0, 1.38], [0.006, 1.363], [0.022, 1.301], [0.044, 1.247], [0.089, 1.166], [0.144, 1.084], [0.222, 0.988], [0.333, 0.878], [0.5, 0.737], [0.667, 0.611], [0.889, 0.46], [1.111, 0.331], [1.48, 0.16], [2.0, 0.04], [2.4, 0]];   // the top edge falls from the rising line to the right tip
const FOOT = [[0, -0.142], [0.022, -0.091], [0.044, -0.053], [0.089, -0.006], [0.144, 0.03], [0.222, 0.064], [0.333, 0.091], [0.5, 0.11], [0.667, 0.107], [0.889, 0.089], [1.111, 0.072], [1.5, 0.04], [2.2, 0]];   // the bottom edge near the right tip, above BASE
const table = (t, x) => { if (x <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (x <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return t[t.length - 1][1]; };
function horizontal(p0, p1, W) {
  const [a, b] = p0[0] <= p1[0] ? [p0, p1] : [p1, p0];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len, L = len / W, N = Math.max(60, Math.ceil(L * 8));
  const at = (u, o) => [a[0] + tx * u - ty * o * W, a[1] + ty * u + tx * o * W];
  const ts = [], vs = [];
  for (let i = 0; i <= N; i++) {
    const d = L * (1 - Math.cos(Math.PI * i / N)) / 2, e = L - d;   // the points crowd at both ends, where the outline turns quickly
    const k = Math.max(0, 1 - e / 2.4), shift = RISE * (L - 11.26) * k * k * (3 - 2 * k);   // the tip keeps its place relative to the right end whatever the length: the template is 11.26 W long
    const t = -0.01 - RISE * d + table(STARTTOP, d) + table(TIPDROP, e) + shift, v = BASE + table(BELLY, d) + table(FOOT, e);
    ts.push(t); vs.push(v);
  }
  const soften = a => { for (let r = 0; r < 3; r++) { const c = a.slice(); for (let i = 1; i < N; i++) a[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4; } };   // the tables are piecewise linear: smooth the kinks of the edges (the end points stay)
  soften(ts); soften(vs);
  const pts = i => { const u = L * (1 - Math.cos(Math.PI * i / N)) / 2 * W; return [at(u, ts[i]), at(u, vs[i])]; };
  const poly = [...ts.keys()].map(i => pts(i)[0]).concat([...vs.keys()].reverse().map(i => pts(i)[1]));
  poly.smooth = true;   // outlineOf joins the points with Bezier curves (Catmull-Rom) instead of straight lines
  return poly;
}

// The vertical stroke (垂露, the dewdrop), taken from 5DDD.svg (川) of the old glyph composer, measured at W = 90 units like the horizontal:
// the head and the body from the long right stroke, the end from the shorter middle one (its widths scaled by 1.075 to the long one), which is rounder.
// Rows [position, left edge, right edge], the edges in W from the centre line of the body (positive to the right).
// HEAD: d from the top tip in W (0 to 3); BODY: the share of the middle (0 to 1), which stretches with the length; TAIL, TAIL2: e from the bottom tip in W (0 to 3.5);
// TAIL2 (the short stroke) is used near the tip and blends into TAIL (the long stroke) towards the body.
const V_HEAD = [[0, -1.261, -1.119], [0.006, -1.288, -1.091], [0.026, -1.385, -0.991], [0.058, -1.48, -0.89], [0.102, -1.574, -0.788], [0.159, -1.666, -0.685], [0.228, -1.754, -0.578], [0.309, -1.8, -0.438], [0.402, -1.809, -0.279], [0.506, -1.784, -0.103], [0.62, -1.74, 0.087], [0.744, -1.681, 0.29], [0.879, -1.611, 0.501], [1.022, -1.53, 0.713], [1.174, -1.442, 0.916], [1.333, -1.356, 1.062], [1.5, -1.272, 1.087], [1.673, -1.192, 1.074], [1.852, -1.119, 1.025], [2.036, -1.053, 0.938], [2.224, -0.997, 0.887], [2.415, -0.951, 0.852], [2.608, -0.919, 0.823], [2.804, -0.9, 0.797], [3, -0.888, 0.775]];
const V_BODY = [[0, -0.888, 0.775], [0.063, -0.839, 0.709], [0.125, -0.794, 0.667], [0.188, -0.752, 0.64], [0.25, -0.715, 0.622], [0.313, -0.683, 0.612], [0.375, -0.656, 0.608], [0.438, -0.634, 0.609], [0.5, -0.62, 0.615], [0.563, -0.613, 0.623], [0.625, -0.615, 0.635], [0.688, -0.628, 0.649], [0.75, -0.654, 0.665], [0.813, -0.696, 0.684], [0.875, -0.76, 0.704], [0.938, -0.852, 0.726], [1, -0.989, 0.75]];
const V_TAIL = [[0, -0.089, -0.017], [0.007, -0.108, 0.001], [0.03, -0.163, 0.055], [0.067, -0.217, 0.108], [0.119, -0.282, 0.167], [0.186, -0.361, 0.247], [0.266, -0.438, 0.327], [0.361, -0.493, 0.402], [0.469, -0.554, 0.472], [0.59, -0.621, 0.536], [0.723, -0.692, 0.593], [0.869, -0.765, 0.643], [1.025, -0.84, 0.685], [1.192, -0.913, 0.72], [1.369, -0.981, 0.748], [1.556, -1.04, 0.769], [1.75, -1.083, 0.783], [1.952, -1.105, 0.791], [2.161, -1.147, 0.792], [2.375, -1.175, 0.786], [2.594, -1.186, 0.779], [2.817, -1.174, 0.772], [3.043, -1.136, 0.764], [3.271, -1.067, 0.757], [3.5, -0.989, 0.75]];
const V_TAIL2 = [[0, -0.114, -0.029], [0.007, -0.136, -0.008], [0.03, -0.201, 0.054], [0.067, -0.267, 0.116], [0.119, -0.334, 0.176], [0.186, -0.398, 0.234], [0.266, -0.468, 0.297], [0.361, -0.544, 0.364], [0.469, -0.623, 0.434], [0.59, -0.704, 0.504], [0.723, -0.782, 0.572], [0.869, -0.856, 0.636], [1.025, -0.923, 0.696], [1.192, -0.98, 0.75], [1.369, -1.026, 0.797], [1.556, -1.057, 0.836], [1.75, -1.074, 0.867], [1.952, -1.074, 0.89], [2.161, -1.056, 0.905], [2.375, -1.02, 0.911], [2.594, -0.978, 0.909], [2.817, -0.944, 0.9], [3.043, -0.911, 0.881], [3.271, -0.878, 0.862], [3.5, -0.846, 0.846]];
const V_H = 3, V_T = 3.5, V_SCALE = [0.6, 0.65];   // the widths of the vertical template times V_SCALE (the template is heavier than the one of the horizontal): 0.6 up to 7 W long, 0.65 from 10 W
const rows = (t, x) => { if (x <= t[0][0]) return t[0].slice(1); for (let i = 1; i < t.length; i++) if (x <= t[i][0]) { const f = (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]); return [1, 2].map(j => t[i - 1][j] + (t[i][j] - t[i - 1][j]) * f); } return t[t.length - 1].slice(1); };
function vertical(p0, p1, W, free0, free1) {
  const [a, b] = p0[1] <= p1[1] ? [p0, p1] : [p1, p0];   // from the top to the bottom
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len, L = len / W;
  const g = Math.min(1, L / (V_H + V_T + 0.5));            // a short stroke: the body first, then head and end are squeezed along the stroke, never across
  const k = V_SCALE[0] + (V_SCALE[1] - V_SCALE[0]) * Math.max(0, Math.min(1, (L - 7) / 3));
  const at = (u, x) => [a[0] + tx * u + ty * x * k * W, a[1] + ty * u - tx * x * k * W];
  const row = [];                                          // [distance from the top in W, left, right]
  if (free0) for (const [d] of V_HEAD) row.push([d * g, ...rows(V_HEAD, d)]);
  else row.push([-0.4, ...V_BODY[0].slice(1)], [V_H * g, ...V_BODY[0].slice(1)]);   // it starts on another stroke: no head, the body reaches a little into that stroke
  const mid = L - (V_H + V_T) * g, m = Math.min(1, mid / 12.6), B0 = V_BODY[0], B1 = V_BODY[V_BODY.length - 1];   // 12.6 W: the body of the template
  for (const [s] of V_BODY) if (s > 0 && s < 1) {          // a short body has no waist: the template blends into the straight line from its start to its end
    const t = rows(V_BODY, s);
    row.push([V_H * g + s * mid, ...[1, 2].map(j => B0[j] + (B1[j] - B0[j]) * s + (t[j - 1] - (B0[j] + (B1[j] - B0[j]) * s)) * m)]);
  }
  if (!free1) row.push([L - V_T * g, ...V_BODY[V_BODY.length - 1].slice(1)], [L - 0.1, ...V_BODY[V_BODY.length - 1].slice(1)]);   // it ends on another stroke: no dewdrop, the end stays inside that stroke (the bottom edge of a horizontal is only 0.2 W below its line)
  else for (const [e] of V_TAIL.slice().reverse()) {
    const k = Math.max(0, Math.min(1, (V_T - e) / 0.8)), w = k * k * (3 - 2 * k);   // 0 where the end meets the body, 1 from 2.7 W to the tip (the dent of the long stroke stays out)
    const l = rows(V_TAIL, e), r = rows(V_TAIL2, e);
    row.push([L - e * g, l[0] + (r[0] - l[0]) * w, l[1] + (r[1] - l[1]) * w]);
  }
  for (let pass = 0; pass < 8; pass++) {                // smooth the edges where the end joins the body (the two templates meet there); head and tip stay as measured
    const c = row.map(q => q.slice());
    for (let i = 1; i < row.length - 1; i++) if (row[i][0] > 1.6 * g && L - row[i][0] > 1.2 * g) for (const j of [1, 2]) row[i][j] = (c[i - 1][j] + 2 * c[i][j] + c[i + 1][j]) / 4;
  }
  const poly = row.map(([d, l]) => at(d * W, l)).concat(row.slice().reverse().map(([d, , r]) => at(d * W, r)));
  poly.smooth = true;
  poly.straight = [!free1 && row.length - 1, !free0 && poly.length - 1].filter(i => i !== false);   // an end on another stroke is cut straight (a curve would bulge out of that stroke)
  return poly;
}

function stroke(line, W, others) {
  const f = nums(line), p0 = [f[3], f[4]], p1 = [f[f.length - 2], f[f.length - 1]];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], ax = Math.abs(dx), ay = Math.abs(dy);
  if (!Number.isFinite(dx + dy) || Math.hypot(dx, dy) < 1e-6) return [];   // a stroke without length (the squeezing of a pair can collapse one)
  let kind;
  if (f[0] === 1) kind = ay < ax * 0.3 ? "h" : ax < ay * 0.3 ? "v" : dx < 0 ? "pie" : "na";
  else kind = f[1] === 7 ? "arc" : dx < 0 ? "pie" : "na";
  if (kind === "h") return horizontal(p0, p1, W);
  if (kind === "v" && Math.hypot(dx, dy) >= 4 * W) {
    let [top, bottom] = p0[1] <= p1[1] ? [p0, p1] : [p1, p0];
    const free0 = !touches(top, others, W), free1 = !touches(bottom, others, W);
    if (!free1) for (const o of others) {                // it ends on a horizontal: end on its line (the data may reach past it, and the Kaiti horizontal is thin below its line)
      if (o[0] !== 1) continue;
      const q0 = [o[3], o[4]], q1 = [o[o.length - 2], o[o.length - 1]];
      if (Math.abs(q1[1] - q0[1]) > 0.3 * Math.abs(q1[0] - q0[0]) || (bottom[0] - q0[0]) * (bottom[0] - q1[0]) > 0) continue;
      const y = q0[1] + (q1[1] - q0[1]) * (bottom[0] - q0[0]) / (q1[0] - q0[0]);
      if (Math.abs(y - bottom[1]) < 1.3 * W) bottom = [bottom[0], Math.min(bottom[1], y)];
    }
    return vertical(top, bottom, W, free0, free1);
  }   // a very short one (a tick of a mark) keeps the simple form
  const free0 = !touches(p0, others, W), free1 = !touches(p1, others, W);
  const rise = kind === "h" ? Math.min(Math.hypot(dx, dy) * 0.05, 3) : 0;
  const { pts: pts0, len } = centreline(f, 0);
  const sgn = dx >= 0 ? 1 : -1;
  const pts = pts0.map(p => [p[0], p[1] - rise * sgn * (p[2] - 0.5) * 2 / 2 - 0, p[2]]);   // the right end of a horizontal is higher than the left
  const width = (d, t) => {
    const e = len - d, q = Math.min(2.2 * W, len * 0.3);
    switch (kind) {
      case "h": return 0.5 * W * (1 + (free0 ? 1.0 : 0) * ease(1 - d / (0.8 * q)) + (free1 ? 1.5 : 0) * Math.pow(ease(1 - e / q), 1.4));
      case "v": return W * (1.25 - 0.4 * t + (free0 ? 0.25 : 0) * ease(1 - d / q) + (free1 ? 0.2 : 0) * ease(1 - e / q));
      case "pie": return W * (free1 ? 1.2 * (1 - 0.92 * Math.pow(t, 0.8)) + 0.08 : 1.1 - 0.4 * t);
      case "na": return W * (free0 ? 0.45 : 0.9) * (1 + (free1 ? 2.2 : 0.4) * Math.pow(t, 1.6)) * (1 + (free1 ? 0 : 0));
      default: return 0.9 * W;                 // arc
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
  const cap = (i, dir, round) => {             // the points of the end cap, from the left to the right side of the stroke
    const c = pts[i], hw = Math.hypot(L[i][0] - c[0], L[i][1] - c[1]), o = [];
    if (!round || hw < 0.3) return o;
    const nx = (L[i][0] - c[0]) / hw, ny = (L[i][1] - c[1]) / hw, tx = ny * dir, ty = -nx * dir;   // outward tangent
    for (let k = 1; k < 8; k++) { const a = Math.PI * k / 8; o.push([c[0] + hw * (nx * Math.cos(a) + tx * Math.sin(a)), c[1] + hw * (ny * Math.cos(a) + ty * Math.sin(a))]); }
    return o;
  };
  if (free0 && kind === "h") {                 // the brush enters at an angle: the lower corner of the start sticks out
    const T = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]], tl = Math.hypot(T[0], T[1]) || 1, o = 0.5 * Math.hypot(L[0][0] - pts[0][0], L[0][1] - pts[0][1]);
    const c = sgn > 0 ? R : L; c[0] = [c[0][0] + T[0] / tl * o, c[0][1] + T[1] / tl * o];
  }
  const roundEnd = kind === "v" || kind === "arc" || (kind === "h" && free1) || (kind === "na" && free1);
  const roundStart = kind === "v" || kind === "arc" || kind === "pie";
  return [...L, ...cap(N - 1, 1, roundEnd), ...R.slice().reverse(), ...cap(0, -1, roundStart).reverse()];
}

function kaitiPolygons(lines, W) { const fs = lines.map(nums); return fs.map((f, i) => { try { const r = stroke(lines[i], W, fs.filter((_, j) => j !== i)); if (r.some(q => !Number.isFinite(q[0] + q[1]))) throw new Error("NaN"); return r; } catch (e) { throw new Error(lines[i] + ": " + e.message); } }).filter(poly => poly.length); }
module.exports = { kaitiPolygons };
