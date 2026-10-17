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
// The points are laid on the centre line of the KAGE stroke, so the curve comes from the data and only the widths from the template.
// P_TEMPLATES.A: the left stroke of 川 (5DDD.svg of the old glyph composer), long and steep; .B: the steep right stroke of 722B.svg (glyph-composer/new).
const P_TEMPLATES = {
  A: { len: 14.999, pts: [-0.711, 1.894, -0.767, 1.929, -0.822, 1.959, -0.878, 1.985, -0.933, 2.006, -0.978, 2.024, -1.022, 2.037, -1.067, 2.045, -1.111, 2.05, -1.144, 2.05, -1.189, 2.045, -1.222, 2.037, -1.244, 2.024, -1.278, 2.007, -1.3, 1.985, -1.322, 1.959, -1.344, 1.929, -1.356, 1.895, -1.367, 1.856, -1.378, 1.813, -1.389, 1.766, -1.389, 1.721, -1.389, 1.672, -1.389, 1.619, -1.378, 1.562, -1.367, 1.501, -1.356, 1.435, -1.333, 1.366, -1.311, 1.292, -1.289, 1.214, -1.256, 1.132, -1.222, 1.046, -1.178, 0.956, -1.144, 0.862, -1.089, 0.764, -1.044, 0.661, -0.989, 0.554, -0.933, 0.444, -0.878, 0.329, -0.811, 0.21, -0.744, 0.087, -0.722, 0.045, -0.7, 0.005, -0.667, -0.032, -0.644, -0.067, -0.622, -0.1, -0.589, -0.131, -0.567, -0.159, -0.533, -0.185, -0.511, -0.209, -0.478, -0.231, -0.444, -0.25, -0.411, -0.267, -0.378, -0.282, -0.344, -0.295, -0.3, -0.305, -0.267, -0.313, -0.233, -0.319, -0.189, -0.323, -0.144, -0.324, -0.111, -0.323, -0.1, -0.322, -0.078, -0.32, -0.056, -0.317, -0.033, -0.312, -0.011, -0.307, 0.024, -0.301, 0.056, -0.294, 0.096, -0.285, 0.136, -0.276, 0.184, -0.266, 0.232, -0.256, 0.288, -0.244, 0.343, -0.232, 0.399, -0.218, 0.471, -0.204, 0.534, -0.19, 0.613, -0.174, 0.684, -0.159, 0.771, -0.142, 0.85, -0.125, 0.858, -0.124, 0.858, -0.123, 0.865, -0.122, 0.865, -0.121, 0.865, -0.12, 0.873, -0.119, 0.873, -0.118, 0.881, -0.117, 0.881, -0.117, 0.881, -0.116, 0.889, -0.115, 0.889, -0.115, 0.897, -0.114, 0.897, -0.114, 0.905, -0.113, 0.905, -0.113, 0.905, -0.113, 0.913, -0.112, 0.913, -0.112, 0.92, -0.112, 1.226, -0.107, 1.529, -0.106, 1.823, -0.108, 2.115, -0.113, 2.405, -0.121, 2.686, -0.131, 2.958, -0.144, 3.229, -0.16, 3.492, -0.177, 3.745, -0.196, 3.998, -0.217, 4.25, -0.24, 4.486, -0.263, 4.722, -0.288, 4.949, -0.314, 5.176, -0.34, 5.396, -0.366, 5.607, -0.393, 5.811, -0.42, 6.015, -0.447, 6.334, -0.498, 6.646, -0.547, 6.95, -0.595, 7.254, -0.64, 7.55, -0.683, 7.847, -0.723, 8.136, -0.76, 8.419, -0.794, 8.701, -0.825, 8.985, -0.853, 9.261, -0.877, 9.531, -0.897, 9.801, -0.913, 10.072, -0.925, 10.344, -0.933, 10.609, -0.936, 10.875, -0.935, 11.142, -0.93, 11.403, -0.92, 11.665, -0.905, 11.793, -0.895, 11.92, -0.883, 12.041, -0.872, 12.169, -0.859, 12.29, -0.846, 12.412, -0.832, 12.533, -0.818, 12.648, -0.802, 12.77, -0.786, 12.885, -0.769, 13.007, -0.751, 13.123, -0.732, 13.238, -0.712, 13.354, -0.691, 13.47, -0.669, 13.579, -0.647, 13.696, -0.623, 13.805, -0.598, 13.914, -0.572, 14.024, -0.545, 14.087, -0.53, 14.142, -0.515, 14.197, -0.499, 14.252, -0.484, 14.299, -0.468, 14.355, -0.452, 14.402, -0.435, 14.45, -0.419, 14.489, -0.402, 14.529, -0.385, 14.576, -0.368, 14.608, -0.35, 14.648, -0.332, 14.68, -0.314, 14.72, -0.295, 14.751, -0.276, 14.775, -0.257, 14.807, -0.237, 14.831, -0.217, 14.855, -0.197, 14.879, -0.179, 14.895, -0.161, 14.919, -0.143, 14.935, -0.126, 14.951, -0.109, 14.959, -0.092, 14.975, -0.075, 14.983, -0.059, 14.991, -0.042, 14.991, -0.026, 14.999, -0.01, 14.999, 0.005, 14.999, 0.021, 14.999, 0.036, 14.991, 0.051, 14.983, 0.066, 14.975, 0.08, 14.967, 0.095, 14.951, 0.109, 14.935, 0.123, 14.919, 0.128, 14.895, 0.133, 14.871, 0.138, 14.847, 0.143, 14.823, 0.147, 14.791, 0.151, 14.767, 0.155, 14.736, 0.158, 14.704, 0.162, 14.664, 0.165, 14.632, 0.168, 14.592, 0.17, 14.553, 0.173, 14.513, 0.175, 14.473, 0.176, 14.426, 0.178, 14.386, 0.179, 14.339, 0.18, 14.291, 0.18, 14.236, 0.18, 13.961, 0.183, 13.688, 0.185, 13.416, 0.188, 13.153, 0.191, 12.892, 0.194, 12.64, 0.198, 12.389, 0.202, 12.147, 0.207, 11.905, 0.213, 11.672, 0.22, 11.44, 0.228, 11.217, 0.237, 10.994, 0.248, 10.779, 0.261, 10.565, 0.276, 10.351, 0.293, 10.145, 0.311, 9.947, 0.332, 9.75, 0.356, 9.553, 0.382, 9.377, 0.41, 9.203, 0.438, 9.028, 0.464, 8.854, 0.49, 8.687, 0.515, 8.513, 0.539, 8.346, 0.562, 8.18, 0.585, 8.02, 0.607, 7.861, 0.628, 7.695, 0.649, 7.536, 0.67, 7.384, 0.69, 7.225, 0.71, 7.073, 0.73, 6.921, 0.749, 6.776, 0.769, 6.624, 0.788, 6.479, 0.807, 6.334, 0.827, 5.797, 0.942, 5.272, 1.04, 4.759, 1.123, 4.272, 1.193, 3.797, 1.252, 3.342, 1.302, 2.913, 1.345, 2.504, 1.383, 2.115, 1.417, 1.746, 1.449, 1.397, 1.479, 1.077, 1.51, 0.771, 1.542, 0.486, 1.577, 0.224, 1.615, -0.011, 1.657, -0.211, 1.706, -0.4, 1.761, -0.567, 1.824, -0.711, 1.894] },
  B: { len: 10.112, pts: [0.258, -1.101, 0.278, -1.116, 0.299, -1.13, 0.32, -1.143, 0.345, -1.156, 0.366, -1.167, 0.386, -1.177, 0.407, -1.187, 0.433, -1.196, 0.453, -1.203, 0.474, -1.21, 0.5, -1.216, 0.52, -1.221, 0.546, -1.225, 0.566, -1.228, 0.592, -1.231, 0.618, -1.232, 0.643, -1.233, 0.664, -1.232, 0.689, -1.231, 0.715, -1.229, 0.741, -1.226, 0.766, -1.222, 0.792, -1.217, 0.817, -1.211, 0.843, -1.205, 0.874, -1.197, 0.899, -1.189, 0.925, -1.18, 0.955, -1.17, 0.981, -1.159, 1.017, -1.145, 1.047, -1.132, 1.078, -1.119, 1.114, -1.106, 1.144, -1.092, 1.18, -1.079, 1.211, -1.066, 1.246, -1.053, 1.277, -1.04, 1.307, -1.028, 1.343, -1.015, 1.374, -1.002, 1.409, -0.989, 1.44, -0.977, 1.475, -0.964, 1.506, -0.951, 1.541, -0.939, 1.577, -0.927, 1.607, -0.914, 1.643, -0.902, 1.673, -0.893, 1.709, -0.885, 1.739, -0.877, 1.775, -0.869, 1.805, -0.862, 1.841, -0.855, 1.871, -0.849, 1.907, -0.843, 1.942, -0.838, 1.978, -0.833, 2.008, -0.829, 2.043, -0.825, 2.079, -0.821, 2.114, -0.818, 2.145, -0.815, 2.18, -0.813, 2.215, -0.811, 2.251, -0.81, 2.286, -0.809, 2.322, -0.809, 2.357, -0.809, 2.392, -0.809, 2.428, -0.81, 2.463, -0.812, 2.498, -0.813, 2.533, -0.816, 2.569, -0.818, 2.604, -0.822, 2.639, -0.825, 2.675, -0.829, 3.072, -0.776, 3.459, -0.73, 3.835, -0.69, 4.206, -0.657, 4.561, -0.628, 4.906, -0.605, 5.241, -0.585, 5.566, -0.57, 5.882, -0.557, 6.182, -0.546, 6.478, -0.538, 6.759, -0.531, 7.025, -0.524, 7.287, -0.518, 7.533, -0.512, 7.771, -0.506, 7.998, -0.498, 8.211, -0.489, 8.413, -0.478, 8.606, -0.465, 8.79, -0.45, 8.963, -0.432, 9.126, -0.411, 9.274, -0.386, 9.418, -0.359, 9.546, -0.327, 9.664, -0.291, 9.777, -0.252, 9.875, -0.208, 9.963, -0.159, 9.978, -0.15, 9.994, -0.141, 10.004, -0.132, 10.019, -0.123, 10.03, -0.114, 10.045, -0.105, 10.055, -0.096, 10.061, -0.087, 10.071, -0.078, 10.081, -0.069, 10.086, -0.06, 10.092, -0.051, 10.097, -0.042, 10.102, -0.032, 10.107, -0.023, 10.107, -0.014, 10.112, -0.005, 10.112, 0.005, 10.112, 0.014, 10.112, 0.023, 10.112, 0.033, 10.107, 0.042, 10.107, 0.052, 10.102, 0.061, 10.097, 0.07, 10.092, 0.08, 10.086, 0.089, 10.076, 0.099, 10.066, 0.109, 10.061, 0.118, 10.055, 0.121, 10.05, 0.123, 10.05, 0.125, 10.045, 0.128, 10.04, 0.13, 10.04, 0.133, 10.035, 0.135, 10.03, 0.138, 10.03, 0.14, 10.025, 0.142, 10.019, 0.145, 10.019, 0.147, 10.014, 0.15, 10.009, 0.152, 10.009, 0.154, 10.004, 0.157, 9.999, 0.159, 9.999, 0.162, 9.994, 0.164, 9.988, 0.166, 9.978, 0.172, 9.963, 0.177, 9.952, 0.181, 9.937, 0.186, 9.921, 0.191, 9.911, 0.195, 9.896, 0.2, 9.88, 0.204, 9.865, 0.208, 9.849, 0.213, 9.829, 0.217, 9.813, 0.22, 9.798, 0.224, 9.777, 0.228, 9.762, 0.231, 9.741, 0.235, 9.721, 0.238, 9.705, 0.241, 9.685, 0.245, 9.664, 0.248, 9.644, 0.25, 9.623, 0.253, 9.602, 0.256, 9.582, 0.258, 9.556, 0.261, 9.536, 0.263, 9.51, 0.265, 9.49, 0.267, 9.464, 0.269, 9.443, 0.27, 8.937, 0.337, 8.444, 0.393, 7.963, 0.441, 7.498, 0.48, 7.04, 0.513, 6.603, 0.539, 6.172, 0.56, 5.761, 0.576, 5.361, 0.588, 4.976, 0.597, 4.606, 0.605, 4.251, 0.611, 3.91, 0.617, 3.584, 0.623, 3.268, 0.63, 2.972, 0.639, 2.685, 0.651, 2.412, 0.665, 2.15, 0.682, 1.907, 0.704, 1.673, 0.73, 1.455, 0.761, 1.246, 0.798, 1.052, 0.84, 0.874, 0.888, 0.705, 0.943, 0.546, 1.005, 0.402, 1.074, 0.273, 1.15, 0.15, 1.234, 0.119, 1.258, 0.083, 1.281, 0.052, 1.302, 0.015, 1.321, -0.011, 1.339, -0.044, 1.354, -0.078, 1.367, -0.1, 1.379, -0.133, 1.389, -0.156, 1.397, -0.178, 1.403, -0.211, 1.407, -0.233, 1.41, -0.256, 1.411, -0.278, 1.409, -0.3, 1.406, -0.322, 1.401, -0.344, 1.395, -0.367, 1.386, -0.389, 1.376, -0.4, 1.363, -0.422, 1.349, -0.444, 1.333, -0.456, 1.316, -0.478, 1.296, -0.489, 1.275, -0.511, 1.251, -0.522, 1.226, -0.533, 1.199, -0.544, 1.17, -0.556, 1.123, -0.567, 1.075, -0.578, 1.026, -0.578, 0.977, -0.578, 0.927, -0.589, 0.877, -0.589, 0.826, -0.589, 0.774, -0.578, 0.722, -0.578, 0.669, -0.567, 0.615, -0.567, 0.561, -0.556, 0.507, -0.544, 0.451, -0.533, 0.395, -0.522, 0.339, -0.5, 0.281, -0.489, 0.224, -0.467, 0.165, -0.444, 0.106, -0.422, 0.046, -0.4, -0.014, -0.378, -0.075, -0.356, -0.136, -0.322, -0.198, -0.3, -0.261, -0.267, -0.325, -0.233, -0.388, -0.2, -0.453, -0.167, -0.518, -0.144, -0.547, -0.133, -0.575, -0.122, -0.603, -0.1, -0.63, -0.089, -0.656, -0.067, -0.682, -0.056, -0.707, -0.044, -0.731, -0.022, -0.755, -0.011, -0.778, 0.005, -0.8, 0.015, -0.822, 0.031, -0.843, 0.046, -0.863, 0.057, -0.883, 0.072, -0.902, 0.088, -0.921, 0.103, -0.938, 0.114, -0.956, 0.129, -0.972, 0.139, -0.988, 0.155, -1.003, 0.17, -1.018, 0.181, -1.032, 0.196, -1.045, 0.206, -1.057, 0.222, -1.069, 0.232, -1.081, 0.248, -1.091, 0.258, -1.101] },
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
