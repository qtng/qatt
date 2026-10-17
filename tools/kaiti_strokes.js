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

// The left-falling stroke (撇): the outline of a template as points (s, n), s the distance along its own centre line (a quadratic from the middle of the head
// to the tail tip) and n the distance from it (positive on the right hand side seen in the direction of writing), both in W (measured at W = 90).
// The points are laid on the centre line of the KAGE stroke, so the curve comes from the data and only the widths from the template. The drift of the true middle
// of the template from its quadratic (a cubic fitted to the middles, without its straight part) is taken out of n, else the stroke would wave like a long S.
// P_TEMPLATES.A: the left stroke of 川 (5DDD.svg of the old glyph composer), long and steep; .B: the steep right stroke of 722B.svg (glyph-composer/new).
const P_TEMPLATES = {
  A: { len: 14.999, pts: [-0.711, 1.49, -0.767, 1.518, -0.822, 1.541, -0.878, 1.56, -0.933, 1.574, -0.978, 1.586, -1.022, 1.594, -1.067, 1.596, -1.111, 1.596, -1.144, 1.591, -1.189, 1.581, -1.222, 1.569, -1.244, 1.553, -1.278, 1.532, -1.3, 1.507, -1.322, 1.478, -1.344, 1.445, -1.356, 1.41, -1.367, 1.369, -1.378, 1.325, -1.389, 1.277, -1.389, 1.232, -1.389, 1.183, -1.389, 1.13, -1.378, 1.074, -1.367, 1.014, -1.356, 0.95, -1.333, 0.884, -1.311, 0.812, -1.289, 0.737, -1.256, 0.659, -1.222, 0.578, -1.178, 0.493, -1.144, 0.403, -1.089, 0.312, -1.044, 0.215, -0.989, 0.115, -0.933, 0.012, -0.878, -0.096, -0.811, -0.207, -0.744, -0.321, -0.722, -0.361, -0.7, -0.398, -0.667, -0.431, -0.644, -0.463, -0.622, -0.493, -0.589, -0.52, -0.567, -0.545, -0.533, -0.567, -0.511, -0.588, -0.478, -0.606, -0.444, -0.621, -0.411, -0.633, -0.378, -0.644, -0.344, -0.653, -0.3, -0.657, -0.267, -0.661, -0.233, -0.663, -0.189, -0.661, -0.144, -0.657, -0.111, -0.652, -0.1, -0.649, -0.078, -0.644, -0.056, -0.639, -0.033, -0.631, -0.011, -0.623, 0.024, -0.613, 0.056, -0.602, 0.096, -0.588, 0.136, -0.574, 0.184, -0.557, 0.232, -0.541, 0.288, -0.522, 0.343, -0.503, 0.399, -0.482, 0.471, -0.459, 0.534, -0.437, 0.613, -0.411, 0.684, -0.388, 0.771, -0.36, 0.85, -0.333, 0.858, -0.331, 0.858, -0.33, 0.865, -0.328, 0.865, -0.327, 0.865, -0.326, 0.873, -0.324, 0.873, -0.323, 0.881, -0.321, 0.881, -0.321, 0.881, -0.32, 0.889, -0.318, 0.889, -0.318, 0.897, -0.316, 0.897, -0.316, 0.905, -0.314, 0.905, -0.314, 0.905, -0.314, 0.913, -0.312, 0.913, -0.312, 0.92, -0.311, 1.226, -0.267, 1.529, -0.228, 1.823, -0.193, 2.115, -0.161, 2.405, -0.133, 2.686, -0.108, 2.958, -0.088, 3.229, -0.073, 3.492, -0.06, 3.745, -0.052, 3.998, -0.047, 4.25, -0.046, 4.486, -0.046, 4.722, -0.05, 4.949, -0.057, 5.176, -0.065, 5.396, -0.074, 5.607, -0.086, 5.811, -0.099, 6.015, -0.113, 6.334, -0.145, 6.646, -0.178, 6.95, -0.213, 7.254, -0.246, 7.55, -0.279, 7.847, -0.312, 8.136, -0.343, 8.419, -0.374, 8.701, -0.403, 8.985, -0.431, 9.261, -0.457, 9.531, -0.481, 9.801, -0.503, 10.072, -0.522, 10.344, -0.54, 10.609, -0.554, 10.875, -0.565, 11.142, -0.575, 11.403, -0.581, 11.665, -0.585, 11.793, -0.584, 11.92, -0.582, 12.041, -0.581, 12.169, -0.579, 12.29, -0.576, 12.412, -0.574, 12.533, -0.571, 12.648, -0.566, 12.77, -0.563, 12.885, -0.558, 13.007, -0.553, 13.123, -0.547, 13.238, -0.541, 13.354, -0.533, 13.47, -0.526, 13.579, -0.517, 13.696, -0.508, 13.805, -0.498, 13.914, -0.486, 14.024, -0.475, 14.087, -0.469, 14.142, -0.462, 14.197, -0.453, 14.252, -0.447, 14.299, -0.437, 14.355, -0.43, 14.402, -0.42, 14.45, -0.411, 14.489, -0.4, 14.529, -0.389, 14.576, -0.38, 14.608, -0.367, 14.648, -0.355, 14.68, -0.342, 14.72, -0.329, 14.751, -0.315, 14.775, -0.3, 14.807, -0.285, 14.831, -0.268, 14.855, -0.252, 14.879, -0.238, 14.895, -0.222, 14.919, -0.208, 14.935, -0.193, 14.951, -0.179, 14.959, -0.163, 14.975, -0.149, 14.983, -0.134, 14.991, -0.118, 14.991, -0.102, 14.999, -0.087, 14.999, -0.072, 14.999, -0.056, 14.999, -0.041, 14.991, -0.025, 14.983, -0.009, 14.975, 0.006, 14.967, 0.023, 14.951, 0.039, 14.935, 0.056, 14.919, 0.063, 14.895, 0.072, 14.871, 0.081, 14.847, 0.089, 14.823, 0.097, 14.791, 0.106, 14.767, 0.114, 14.736, 0.121, 14.704, 0.13, 14.664, 0.14, 14.632, 0.148, 14.592, 0.156, 14.553, 0.165, 14.513, 0.173, 14.473, 0.18, 14.426, 0.189, 14.386, 0.196, 14.339, 0.205, 14.291, 0.212, 14.236, 0.22, 13.961, 0.262, 13.688, 0.301, 13.416, 0.338, 13.153, 0.372, 12.892, 0.404, 12.64, 0.434, 12.389, 0.463, 12.147, 0.489, 11.905, 0.515, 11.672, 0.54, 11.44, 0.564, 11.217, 0.587, 10.994, 0.611, 10.779, 0.635, 10.565, 0.66, 10.351, 0.686, 10.145, 0.711, 9.947, 0.738, 9.75, 0.767, 9.553, 0.797, 9.377, 0.828, 9.203, 0.858, 9.028, 0.886, 8.854, 0.912, 8.687, 0.937, 8.513, 0.96, 8.346, 0.982, 8.18, 1.003, 8.02, 1.022, 7.861, 1.04, 7.695, 1.057, 7.536, 1.073, 7.384, 1.089, 7.225, 1.103, 7.073, 1.117, 6.921, 1.13, 6.776, 1.144, 6.624, 1.156, 6.479, 1.167, 6.334, 1.18, 5.797, 1.262, 5.272, 1.323, 4.759, 1.364, 4.272, 1.39, 3.797, 1.401, 3.342, 1.402, 2.913, 1.396, 2.504, 1.384, 2.115, 1.369, 1.746, 1.354, 1.397, 1.34, 1.077, 1.331, 0.771, 1.324, 0.486, 1.324, 0.224, 1.329, -0.011, 1.341, -0.211, 1.365, -0.4, 1.396, -0.567, 1.438, -0.711, 1.49] },
  B: { len: 10.112, pts: [0.258, -0.961, 0.278, -0.978, 0.299, -0.993, 0.32, -1.007, 0.345, -1.022, 0.366, -1.034, 0.386, -1.045, 0.407, -1.057, 0.433, -1.067, 0.453, -1.075, 0.474, -1.084, 0.5, -1.091, 0.52, -1.098, 0.546, -1.103, 0.566, -1.107, 0.592, -1.112, 0.618, -1.115, 0.643, -1.117, 0.664, -1.118, 0.689, -1.118, 0.715, -1.118, 0.741, -1.116, 0.766, -1.114, 0.792, -1.111, 0.817, -1.106, 0.843, -1.102, 0.874, -1.096, 0.899, -1.089, 0.925, -1.082, 0.955, -1.074, 0.981, -1.064, 1.017, -1.053, 1.047, -1.041, 1.078, -1.03, 1.114, -1.02, 1.144, -1.008, 1.18, -0.997, 1.211, -0.986, 1.246, -0.975, 1.277, -0.964, 1.307, -0.954, 1.343, -0.943, 1.374, -0.932, 1.409, -0.921, 1.44, -0.911, 1.475, -0.9, 1.506, -0.889, 1.541, -0.879, 1.577, -0.869, 1.607, -0.858, 1.643, -0.849, 1.673, -0.841, 1.709, -0.836, 1.739, -0.83, 1.775, -0.824, 1.805, -0.819, 1.841, -0.814, 1.871, -0.81, 1.907, -0.806, 1.942, -0.803, 1.978, -0.8, 2.008, -0.798, 2.043, -0.797, 2.079, -0.795, 2.114, -0.794, 2.145, -0.793, 2.18, -0.793, 2.215, -0.793, 2.251, -0.794, 2.286, -0.796, 2.322, -0.798, 2.357, -0.8, 2.392, -0.802, 2.428, -0.806, 2.463, -0.81, 2.498, -0.813, 2.533, -0.818, 2.569, -0.822, 2.604, -0.828, 2.639, -0.833, 2.675, -0.84, 3.072, -0.808, 3.459, -0.778, 3.835, -0.752, 4.206, -0.729, 4.561, -0.707, 4.906, -0.688, 5.241, -0.671, 5.566, -0.656, 5.882, -0.643, 6.182, -0.629, 6.478, -0.618, 6.759, -0.607, 7.025, -0.595, 7.287, -0.584, 7.533, -0.572, 7.771, -0.56, 7.998, -0.546, 8.211, -0.531, 8.413, -0.514, 8.606, -0.495, 8.79, -0.474, 8.963, -0.45, 9.126, -0.424, 9.274, -0.394, 9.418, -0.362, 9.546, -0.325, 9.664, -0.285, 9.777, -0.242, 9.875, -0.195, 9.963, -0.143, 9.978, -0.133, 9.994, -0.124, 10.004, -0.115, 10.019, -0.105, 10.03, -0.096, 10.045, -0.086, 10.055, -0.077, 10.061, -0.068, 10.071, -0.058, 10.081, -0.049, 10.086, -0.04, 10.092, -0.031, 10.097, -0.021, 10.102, -0.011, 10.107, -0.002, 10.107, 0.007, 10.112, 0.016, 10.112, 0.026, 10.112, 0.035, 10.112, 0.044, 10.112, 0.054, 10.107, 0.063, 10.107, 0.073, 10.102, 0.082, 10.097, 0.091, 10.092, 0.1, 10.086, 0.109, 10.076, 0.119, 10.066, 0.129, 10.061, 0.137, 10.055, 0.14, 10.05, 0.142, 10.05, 0.144, 10.045, 0.147, 10.04, 0.149, 10.04, 0.152, 10.035, 0.154, 10.03, 0.156, 10.03, 0.158, 10.025, 0.16, 10.019, 0.163, 10.019, 0.165, 10.014, 0.168, 10.009, 0.17, 10.009, 0.172, 10.004, 0.174, 9.999, 0.176, 9.999, 0.179, 9.994, 0.181, 9.988, 0.183, 9.978, 0.189, 9.963, 0.193, 9.952, 0.197, 9.937, 0.201, 9.921, 0.206, 9.911, 0.209, 9.896, 0.214, 9.88, 0.217, 9.865, 0.221, 9.849, 0.225, 9.829, 0.228, 9.813, 0.231, 9.798, 0.234, 9.777, 0.238, 9.762, 0.24, 9.741, 0.243, 9.721, 0.246, 9.705, 0.248, 9.685, 0.251, 9.664, 0.254, 9.644, 0.255, 9.623, 0.257, 9.602, 0.26, 9.582, 0.261, 9.556, 0.263, 9.536, 0.264, 9.51, 0.265, 9.49, 0.267, 9.464, 0.268, 9.443, 0.268, 8.937, 0.318, 8.444, 0.358, 7.963, 0.392, 7.498, 0.419, 7.04, 0.442, 6.603, 0.461, 6.172, 0.477, 5.761, 0.49, 5.361, 0.502, 4.976, 0.513, 4.606, 0.526, 4.251, 0.538, 3.91, 0.553, 3.584, 0.57, 3.268, 0.589, 2.972, 0.612, 2.685, 0.64, 2.412, 0.67, 2.15, 0.704, 1.907, 0.741, 1.673, 0.782, 1.455, 0.826, 1.246, 0.876, 1.052, 0.93, 0.874, 0.989, 0.705, 1.055, 0.546, 1.127, 0.402, 1.205, 0.273, 1.289, 0.15, 1.38, 0.119, 1.406, 0.083, 1.432, 0.052, 1.455, 0.015, 1.476, -0.011, 1.495, -0.044, 1.513, -0.078, 1.528, -0.1, 1.541, -0.133, 1.553, -0.156, 1.562, -0.178, 1.57, -0.211, 1.576, -0.233, 1.58, -0.256, 1.583, -0.278, 1.582, -0.3, 1.58, -0.322, 1.577, -0.344, 1.572, -0.367, 1.565, -0.389, 1.556, -0.4, 1.544, -0.422, 1.531, -0.444, 1.516, -0.456, 1.5, -0.478, 1.482, -0.489, 1.461, -0.511, 1.439, -0.522, 1.414, -0.533, 1.388, -0.544, 1.36, -0.556, 1.313, -0.567, 1.266, -0.578, 1.218, -0.578, 1.169, -0.578, 1.119, -0.589, 1.069, -0.589, 1.018, -0.589, 0.966, -0.578, 0.914, -0.578, 0.861, -0.567, 0.806, -0.567, 0.752, -0.556, 0.697, -0.544, 0.641, -0.533, 0.584, -0.522, 0.527, -0.5, 0.468, -0.489, 0.41, -0.467, 0.35, -0.444, 0.289, -0.422, 0.228, -0.4, 0.167, -0.378, 0.104, -0.356, 0.042, -0.322, -0.022, -0.3, -0.087, -0.267, -0.153, -0.233, -0.218, -0.2, -0.285, -0.167, -0.352, -0.144, -0.382, -0.133, -0.411, -0.122, -0.44, -0.1, -0.468, -0.089, -0.495, -0.067, -0.522, -0.056, -0.548, -0.044, -0.572, -0.022, -0.598, -0.011, -0.622, 0.005, -0.645, 0.015, -0.667, 0.031, -0.689, 0.046, -0.71, 0.057, -0.731, 0.072, -0.751, 0.088, -0.771, 0.103, -0.789, 0.114, -0.807, 0.129, -0.824, 0.139, -0.841, 0.155, -0.857, 0.17, -0.873, 0.181, -0.888, 0.196, -0.901, 0.206, -0.914, 0.222, -0.927, 0.232, -0.94, 0.248, -0.951, 0.258, -0.961] },
};
const P_USE = "A", P_SCALE = 0.65, P_HEAD = 2.5;   // which template, its widths times P_SCALE, the head (the first P_HEAD W) keeps its size, the rest stretches
function falling(f, W) {
  const tpl = P_TEMPLATES[P_USE], c = [];               // the centre line of the stroke: points with their distance from the start
  const p = []; for (let i = 3; i + 1 < f.length; i += 2) p.push([f[i], f[i + 1]]);
  for (let i = 0, S = 0; i <= 200; i++) {
    const t = i / 200, u = 1 - t;
    const q = f[0] === 2 && p.length === 3 ? [u * u * p[0][0] + 2 * u * t * p[1][0] + t * t * p[2][0], u * u * p[0][1] + 2 * u * t * p[1][1] + t * t * p[2][1]] : [p[0][0] + (p[p.length - 1][0] - p[0][0]) * t, p[0][1] + (p[p.length - 1][1] - p[0][1]) * t];
    if (i) S += Math.hypot(q[0] - c[i - 1][0], q[1] - c[i - 1][1]);
    c.push([q[0], q[1], S]);
  }
  const L = c[200][2] / W, g = Math.min(1, L / (P_HEAD + 2));   // a short stroke: the head is squeezed too
  const along = s => {                                   // the point and the direction of the centre line at the distance s (W), straight on beyond both ends
    const S = s * W, i = S <= 0 ? 0 : S >= c[200][2] ? 199 : c.findIndex(q => q[2] >= S) - 1;
    const j = Math.max(0, i), a = c[j], b = c[j + 1], l = b[2] - a[2] || 1, k = (S - a[2]) / l;
    const tx = (b[0] - a[0]) / l, ty = (b[1] - a[1]) / l;
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, tx, ty];
  };
  const H = P_HEAD * g, map = s => s <= P_HEAD ? s * g : H + (s - P_HEAD) * (L - H) / (tpl.len - P_HEAD);   // template distance -> distance on this stroke
  const poly = [];
  for (let i = 0; i < tpl.pts.length; i += 2) {
    const s = tpl.pts[i], n = tpl.pts[i + 1] * P_SCALE, [x, y, tx, ty] = along(map(s));
    poly.push([x - ty * n * W, y + tx * n * W]);
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
