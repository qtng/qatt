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
function horizontal(p0, p1, W, free0, free1) {
  const [a, b] = p0[0] <= p1[0] ? [p0, p1] : [p1, p0], freeA = p0[0] <= p1[0] ? free0 : free1;   // freeA: the left end is open (not on another stroke)
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, ty = (b[1] - a[1]) / len, L = len / W, N = Math.max(60, Math.ceil(L * 8));
  const at = (u, o) => [a[0] + tx * u - ty * o * W, a[1] + ty * u + tx * o * W];
  const ts = [], vs = [];
  for (let i = 0; i <= N; i++) {
    const d = L * (1 - Math.cos(Math.PI * i / N)) / 2, e = L - d;   // the points crowd at both ends, where the outline turns quickly
    const k = Math.max(0, 1 - e / 2.4), shift = RISE * (L - 11.26) * k * k * (3 - 2 * k);   // the tip keeps its place relative to the right end whatever the length: the template is 11.26 W long
    const t = -0.01 - RISE * d + (freeA ? table(STARTTOP, d) : 0) + table(TIPDROP, e) + shift;
    const v = BASE + (freeA ? table(BELLY, d) : Math.max(0, 0.6 - RISE * d)) + table(FOOT, e);   // on another stroke: no pointed start and belly, a band of 0.8 W until the wedge is that thick
    ts.push(t); vs.push(v);
  }
  const soften = a => { for (let r = 0; r < 3; r++) { const c = a.slice(); for (let i = 1; i < N; i++) a[i] = (c[i - 1] + 2 * c[i] + c[i + 1]) / 4; } };   // the tables are piecewise linear: smooth the kinks of the edges (the end points stay)
  soften(ts); soften(vs);
  const pts = i => { const u = L * (1 - Math.cos(Math.PI * i / N)) / 2 * W; return [at(u, ts[i]), at(u, vs[i])]; };
  const poly = [...ts.keys()].map(i => pts(i)[0]).concat([...vs.keys()].reverse().map(i => pts(i)[1]));
  poly.smooth = true;   // outlineOf joins the points with Bezier curves (Catmull-Rom) instead of straight lines
  if (!freeA) poly.straight = [poly.length - 1];   // the start on another stroke is cut straight
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

// The left-falling stroke (撇): the head of the vertical (V_HEAD, the same widths), then the body of the left stroke of 川 (5DDD.svg of the old glyph composer),
// which tapers to the tip. P_WIDTH: [s, width] of that body in W (measured at W = 90), s along the template stroke from its head (3 W) to its tip (15 W).
// The body is laid symmetric on the centre line of the KAGE stroke (so its curve comes from the data), its widths scaled to meet the head; its middle moves
// from the middle of the head to the line towards the tip.
const P_BEND = [[0, 0], [0.025, 0.038], [0.05, 0.075], [0.075, 0.113], [0.1, 0.151], [0.125, 0.188], [0.15, 0.226], [0.175, 0.263], [0.2, 0.301], [0.225, 0.337], [0.25, 0.401], [0.275, 0.47], [0.3, 0.536], [0.325, 0.6], [0.35, 0.661], [0.375, 0.719], [0.4, 0.776], [0.425, 0.827], [0.45, 0.87], [0.475, 0.904], [0.5, 0.934], [0.525, 0.957], [0.55, 0.976], [0.575, 0.989], [0.6, 0.997], [0.625, 1], [0.65, 0.995], [0.675, 0.982], [0.7, 0.961], [0.725, 0.93], [0.75, 0.892], [0.775, 0.845], [0.8, 0.79], [0.825, 0.727], [0.85, 0.656], [0.875, 0.577], [0.9, 0.489], [0.925, 0.392], [0.95, 0.285], [0.975, 0.16], [1, 0]];   // [share of the chord, bend]: the middle line of the template off its chord, 1 at most
const P_TIP = [[2.17, 1.013], [1.844, 0.96], [1.519, 0.898], [1.193, 0.825], [0.868, 0.739], [0.651, 0.697], [0.434, 0.558], [0.325, 0.484], [0.217, 0.426], [0.108, 0.29], [0.05, 0.195], [0.02, 0.121], [0, 0.0]];   // [W from the tip, width]: the rounded tip of the template, measured across its middle line, the last 0.65 W narrowed a little (up to 30 %, a smaller round end)
const P_WIDTH = [[3, 1.484], [3.5, 1.462], [4, 1.448], [4.5, 1.44], [5, 1.429], [5.5, 1.409], [6, 1.375], [6.5, 1.358], [7, 1.357], [7.5, 1.357], [8, 1.357], [8.5, 1.357], [9, 1.343], [9.5, 1.309], [10, 1.26], [10.5, 1.24], [11, 1.21], [11.5, 1.149], [12, 1.099], [12.5, 1.039], [13, 0.967], [13.5, 0.871], [13.9, 0.748], [14, 0.737], [14.1, 0.013], [14.2, 0.013], [14.3, 0.013], [14.4, 0.013], [14.5, 0.013], [14.6, 0.013], [14.7, 0.013], [14.8, 0.013], [14.9, 0.013], [15, 0]];
function falling(f, W) {
  const p = [], c = []; for (let i = 3; i + 1 < f.length; i += 2) p.push([f[i], f[i + 1]]);
  // the centre line: the chord of the stroke, bent like the template (P_BEND: straight on at first, the curve from about a third on), so much that it starts
  // in the direction of the KAGE curve (a straight KAGE line gets a slight bend, 0.06 of its length)
  const A = p[0], Z = p[p.length - 1], len = Math.hypot(Z[0] - A[0], Z[1] - A[1]), ux = (Z[0] - A[0]) / len, uy = (Z[1] - A[1]) / len;
  let sag = -0.06 * len;
  if (f[0] === 2 && p.length === 3) {                     // as much bend as makes the stroke start in the direction of the KAGE curve (P_BEND rises 1.52 per share at the start)
    const sx = p[1][0] - A[0], sy = p[1][1] - A[1], along = sx * ux + sy * uy, across = sx * -uy + sy * ux;
    if (along > 0) sag = across / along / 1.52 * len;
  }
  const bend = u => { for (let i = 1; i < P_BEND.length; i++) if (u <= P_BEND[i][0]) { const q = P_BEND[i - 1], r = P_BEND[i]; return q[1] + (r[1] - q[1]) * (u - q[0]) / (r[0] - q[0]); } return 0; };
  for (let i = 0, S = 0; i <= 200; i++) {
    const u = i / 200, o = bend(u) * sag, q = [A[0] + (Z[0] - A[0]) * u - uy * o, A[1] + (Z[1] - A[1]) * u + ux * o];
    if (i) S += Math.hypot(q[0] - c[i - 1][0], q[1] - c[i - 1][1]);
    c.push([q[0], q[1], S]);
  }
  const L = c[200][2] / W, g = Math.min(1, L / (V_H + 2));   // a short stroke: the head is squeezed along the stroke
  const at = (d, x) => {                                 // the point x W to the right of the centre line at d W from the start (straight on before the start)
    const S = d * W, i = S <= 0 ? 0 : S >= c[200][2] ? 199 : Math.max(0, c.findIndex(q => q[2] >= S) - 1);
    const a = c[i], b = c[i + 1], l = b[2] - a[2] || 1, k = (S - a[2]) / l, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return [a[0] + (b[0] - a[0]) * k + ty * x * W, a[1] + (b[1] - a[1]) * k - tx * x * W];
  };
  const kV = V_SCALE[0] + (V_SCALE[1] - V_SCALE[0]) * Math.max(0, Math.min(1, (L - 7) / 3));   // the widths of a vertical of this length
  const row = [];
  for (const [d] of V_HEAD) row.push([d * g, ...rows(V_HEAD, d).map(x => x * kV)]);
  const [hl, hr] = rows(V_HEAD, V_H).map(x => x * kV), hc = (hl + hr) / 2, fw = (hr - hl) / P_WIDTH[0][1], s0 = P_WIDTH[0][0], s1 = P_WIDTH[P_WIDTH.length - 1][0];
  const tip = P_TIP[0][0];                                 // the last 2.17 W: the rounded tip of the template
  const body = P_WIDTH.filter(([s]) => s > s0 && s < s1 - tip).concat(P_TIP.map(([e, w]) => [s1 - e, w]));
  for (const [s, w] of body) {
    const k = (s - s0) / (s1 - s0), d = V_H * g + k * (L - V_H * g), m = hc * (1 - k);
    row.push([d, m - w * fw / 2, m + w * fw / 2]);
  }
  for (let pass = 0; pass < 6; pass++) {                // smooth the edges where the body meets the head; the head and the tip stay
    const q = row.map(r => r.slice());
    for (let i = 1; i < row.length - 1; i++) if (row[i][0] > 1.6 * g && L - row[i][0] > 0.4) for (const j of [1, 2]) row[i][j] = (q[i - 1][j] + 2 * q[i][j] + q[i + 1][j]) / 4;
  }
  const poly = row.map(([d, l]) => at(d, l)).concat(row.slice().reverse().map(([d, , r]) => at(d, r)));
  poly.smooth = true;
  return poly;
}

// The right-falling stroke (捺): the upper right stroke of 分 (a raster image, traced; W = 45 pixels, the thickness of its horizontal), thin at the start,
// widening to a flat foot that runs out to the right. NA_BEND: [share of the chord, bend in lengths of the chord] of its middle line; NA_PTS: the outline as
// pairs (share of the middle line from the start, distance from it in W, positive on the right hand side seen in the direction of writing).
// The centre line of the stroke is its chord, bent like the template; the outline is laid on it, the widths times NA_SCALE.
const NA_BEND = [[0.0, 0.0], [0.04, -0.0155], [0.05, -0.0152], [0.06, -0.0148], [0.07, -0.0143], [0.08, -0.0136], [0.09, -0.0128], [0.1, -0.0117], [0.11, -0.0101], [0.12, -0.0082], [0.13, -0.0059], [0.14, -0.0033], [0.15, -0.0005], [0.16, 0.0026], [0.17, 0.0059], [0.18, 0.0093], [0.19, 0.0129], [0.2, 0.0165], [0.21, 0.0203], [0.22, 0.0241], [0.23, 0.0279], [0.24, 0.0318], [0.25, 0.0356], [0.26, 0.0395], [0.27, 0.0434], [0.28, 0.0472], [0.29, 0.051], [0.3, 0.0548], [0.31, 0.0585], [0.32, 0.0622], [0.33, 0.0659], [0.34, 0.0695], [0.35, 0.0731], [0.36, 0.0766], [0.37, 0.0801], [0.38, 0.0836], [0.39, 0.087], [0.4, 0.0903], [0.41, 0.0936], [0.42, 0.0968], [0.43, 0.1], [0.44, 0.1031], [0.45, 0.1061], [0.46, 0.109], [0.47, 0.1119], [0.48, 0.1146], [0.49, 0.1173], [0.5, 0.1198], [0.51, 0.1223], [0.52, 0.1246], [0.53, 0.1268], [0.54, 0.1289], [0.55, 0.1309], [0.56, 0.1327], [0.57, 0.1344], [0.58, 0.136], [0.59, 0.1374], [0.6, 0.1386], [0.61, 0.1397], [0.62, 0.1407], [0.63, 0.1414], [0.64, 0.142], [0.65, 0.1424], [0.66, 0.1426], [0.67, 0.1427], [0.68, 0.1425], [0.69, 0.1421], [0.7, 0.1415], [0.71, 0.1406], [0.72, 0.1394], [0.73, 0.1379], [0.74, 0.136], [0.75, 0.1337], [0.76, 0.131], [0.77, 0.1279], [0.78, 0.1244], [0.79, 0.1205], [0.8, 0.1162], [0.81, 0.1116], [0.82, 0.1067], [0.83, 0.1016], [0.84, 0.0963], [0.85, 0.0908], [0.86, 0.0853], [0.87, 0.0797], [0.88, 0.074], [0.89, 0.0682], [0.9, 0.0624], [0.91, 0.0566], [0.92, 0.0507], [0.93, 0.0478], [0.94, 0.0449], [0.95, 0.0419], [0.96, 0.039], [0.97, 0.036], [1.0, 0.0]];
const NA_PTS = [-0.0042, -0.197, 0.0018, -0.234, 0.0081, -0.263, 0.0144, -0.286, 0.0209, -0.305, 0.0274, -0.32, 0.034, -0.332, 0.0402, -0.339, 0.0402, -0.343, 0.0434, -0.386, 0.0496, -0.414, 0.0565, -0.438, 0.0631, -0.459, 0.0702, -0.474, 0.0778, -0.484, 0.0858, -0.488, 0.093, -0.488, 0.0999, -0.485, 0.1071, -0.48, 0.1155, -0.472, 0.1228, -0.465, 0.1301, -0.457, 0.1374, -0.448, 0.1448, -0.442, 0.1528, -0.436, 0.1603, -0.433, 0.1679, -0.431, 0.1757, -0.43, 0.1838, -0.431, 0.1916, -0.432, 0.1995, -0.435, 0.2075, -0.438, 0.2155, -0.441, 0.2237, -0.445, 0.2318, -0.45, 0.2399, -0.454, 0.2481, -0.459, 0.2563, -0.465, 0.2646, -0.47, 0.2728, -0.476, 0.2812, -0.482, 0.2896, -0.488, 0.298, -0.494, 0.3064, -0.5, 0.3149, -0.507, 0.3233, -0.513, 0.3318, -0.519, 0.3403, -0.525, 0.3489, -0.531, 0.3575, -0.537, 0.3661, -0.543, 0.3747, -0.549, 0.3833, -0.556, 0.392, -0.563, 0.4009, -0.57, 0.4098, -0.577, 0.4187, -0.584, 0.4278, -0.592, 0.4369, -0.6, 0.4462, -0.61, 0.4556, -0.619, 0.4651, -0.629, 0.4747, -0.638, 0.4844, -0.649, 0.494, -0.66, 0.5035, -0.671, 0.5129, -0.683, 0.5223, -0.694, 0.5316, -0.706, 0.5408, -0.719, 0.5491, -0.733, 0.5582, -0.745, 0.5671, -0.758, 0.5761, -0.771, 0.585, -0.784, 0.5938, -0.798, 0.6027, -0.81, 0.6114, -0.823, 0.6201, -0.837, 0.6288, -0.85, 0.6375, -0.863, 0.6462, -0.875, 0.6549, -0.887, 0.6638, -0.898, 0.6711, -0.908, 0.68, -0.916, 0.6891, -0.922, 0.6985, -0.926, 0.7081, -0.928, 0.7179, -0.927, 0.7305, -0.922, 0.7402, -0.914, 0.7474, -0.903, 0.7569, -0.89, 0.7662, -0.875, 0.7752, -0.858, 0.7839, -0.838, 0.7923, -0.818, 0.8003, -0.796, 0.8072, -0.774, 0.8148, -0.751, 0.8223, -0.728, 0.8291, -0.704, 0.8363, -0.681, 0.8434, -0.659, 0.8502, -0.635, 0.8572, -0.612, 0.8641, -0.588, 0.8709, -0.565, 0.8778, -0.542, 0.8845, -0.52, 0.8914, -0.497, 0.8982, -0.475, 0.9049, -0.453, 0.9072, -0.431, 0.9107, -0.435, 0.9176, -0.438, 0.9245, -0.44, 0.9314, -0.441, 0.9384, -0.443, 0.9453, -0.445, 0.9712, -0.401, 0.9769, -0.349, 0.9827, -0.297, 0.9884, -0.241, 0.9937, -0.177, 0.9976, -0.112, 0.9997, -0.053, 1.0, 0.0, 0.9986, 0.044, 0.9956, 0.079, 0.9909, 0.102, 0.9847, 0.11, 0.978, 0.106, 0.9713, 0.097, 0.9647, 0.085, 0.9582, 0.073, 0.9548, 0.083, 0.9488, 0.121, 0.9428, 0.157, 0.9368, 0.196, 0.9307, 0.233, 0.9248, 0.271, 0.9187, 0.308, 0.9128, 0.346, 0.8999, 0.371, 0.8934, 0.387, 0.8869, 0.404, 0.8805, 0.421, 0.8741, 0.438, 0.8676, 0.455, 0.8613, 0.472, 0.8548, 0.49, 0.8485, 0.507, 0.8422, 0.524, 0.8357, 0.542, 0.8295, 0.559, 0.8231, 0.578, 0.8171, 0.597, 0.8106, 0.614, 0.8048, 0.634, 0.7993, 0.655, 0.7929, 0.675, 0.7877, 0.696, 0.7813, 0.719, 0.7764, 0.742, 0.77, 0.766, 0.7654, 0.791, 0.7591, 0.814, 0.7548, 0.841, 0.7487, 0.868, 0.7446, 0.893, 0.7388, 0.914, 0.7343, 0.935, 0.7291, 0.951, 0.7238, 0.966, 0.7195, 0.974, 0.7127, 0.978, 0.7081, 0.979, 0.7007, 0.977, 0.6955, 0.973, 0.6899, 0.968, 0.6819, 0.959, 0.6756, 0.949, 0.6689, 0.937, 0.662, 0.925, 0.6534, 0.912, 0.646, 0.898, 0.6384, 0.884, 0.6308, 0.869, 0.6233, 0.854, 0.6158, 0.84, 0.6072, 0.824, 0.5996, 0.81, 0.5921, 0.795, 0.5847, 0.78, 0.5772, 0.767, 0.5687, 0.754, 0.5608, 0.741, 0.5531, 0.729, 0.5454, 0.717, 0.5377, 0.705, 0.53, 0.693, 0.5217, 0.683, 0.514, 0.673, 0.5064, 0.662, 0.4987, 0.653, 0.491, 0.644, 0.4829, 0.635, 0.4753, 0.626, 0.4676, 0.618, 0.4599, 0.611, 0.4523, 0.603, 0.4443, 0.595, 0.4366, 0.588, 0.429, 0.58, 0.4213, 0.573, 0.4137, 0.566, 0.4058, 0.56, 0.3981, 0.553, 0.3904, 0.548, 0.3827, 0.542, 0.3749, 0.536, 0.3672, 0.531, 0.3595, 0.525, 0.3519, 0.519, 0.3442, 0.514, 0.3364, 0.508, 0.3288, 0.503, 0.3212, 0.497, 0.3136, 0.491, 0.3058, 0.486, 0.2982, 0.48, 0.2906, 0.475, 0.2831, 0.469, 0.2754, 0.464, 0.2678, 0.458, 0.2601, 0.453, 0.2525, 0.448, 0.2448, 0.442, 0.2372, 0.437, 0.2294, 0.432, 0.2216, 0.428, 0.2138, 0.424, 0.206, 0.42, 0.198, 0.418, 0.1898, 0.417, 0.1815, 0.417, 0.173, 0.417, 0.1647, 0.419, 0.156, 0.42, 0.1469, 0.423, 0.1375, 0.427, 0.1279, 0.43, 0.118, 0.433, 0.1079, 0.433, 0.0976, 0.43, 0.0863, 0.425, 0.0769, 0.419, 0.0677, 0.413, 0.0586, 0.408, 0.0502, 0.405, 0.0299, 0.38, 0.0224, 0.339, 0.0149, 0.302, 0.0075, 0.266, 0.0004, 0.23, -0.006, 0.187, -0.0111, 0.136, -0.0145, 0.081, -0.016, 0.023, -0.0157, -0.036, -0.0134, -0.094, -0.0095, -0.149];
const NA_SCALE = 0.75;
function rightFalling(f, W) {
  const p = []; for (let i = 3; i + 1 < f.length; i += 2) p.push([f[i], f[i + 1]]);
  const A = p[0], Z = p[p.length - 1], len = Math.hypot(Z[0] - A[0], Z[1] - A[1]), ux = (Z[0] - A[0]) / len, uy = (Z[1] - A[1]) / len;
  const bend = u => { for (let i = 1; i < NA_BEND.length; i++) if (u <= NA_BEND[i][0]) { const q = NA_BEND[i - 1], r = NA_BEND[i]; return q[1] + (r[1] - q[1]) * (u - q[0]) / (r[0] - q[0]); } return 0; };
  const c = [];
  for (let i = 0, S = 0; i <= 200; i++) {
    const u = i / 200, o = bend(u) * len, q = [A[0] + (Z[0] - A[0]) * u - uy * o, A[1] + (Z[1] - A[1]) * u + ux * o];
    if (i) S += Math.hypot(q[0] - c[i - 1][0], q[1] - c[i - 1][1]);
    c.push([q[0], q[1], S]);
  }
  const T = c[200][2], poly = [];
  for (let k = 0; k < NA_PTS.length; k += 2) {
    const S = NA_PTS[k] * T, i = S <= 0 ? 0 : S >= T ? 199 : Math.max(0, c.findIndex(q => q[2] >= S) - 1);
    const a = c[i], b = c[i + 1], l = b[2] - a[2] || 1, h = (S - a[2]) / l, tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l, n = NA_PTS[k + 1] * NA_SCALE * W;
    poly.push([a[0] + (b[0] - a[0]) * h - ty * n, a[1] + (b[1] - a[1]) * h + tx * n]);
  }
  poly.smooth = true;
  return poly;
}

function stroke(line, W, others) {
  const f = nums(line), p0 = [f[3], f[4]], p1 = [f[f.length - 2], f[f.length - 1]];
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], ax = Math.abs(dx), ay = Math.abs(dy);
  if (!Number.isFinite(dx + dy) || Math.hypot(dx, dy) < 1e-6) return [];   // a stroke without length (the squeezing of a pair can collapse one)
  let kind;
  if (f[0] === 1) kind = ay < ax * 0.3 ? "h" : ax < ay * 0.3 ? "v" : dx < 0 ? "pie" : "na";
  else kind = f[1] === 7 ? "arc" : dx < 0 ? "pie" : "na";
  if (kind === "h") return horizontal(p0, p1, W, !touches(p0, others, W), !touches(p1, others, W));
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
  if (kind === "pie" && Math.hypot(dx, dy) >= 3 * W) return falling(f, W);
  if ((kind === "na" || kind === "arc") && dx > 0 && dy > 0 && Math.hypot(dx, dy) >= 4 * W) return rightFalling(f, W);   // the KAGE data draws it as a curve of type 7 (as its dots)
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
