/*
QATT brush: turns the centre lines of the qatt.js paths into filled brush strokes (Kaiti style).

const strokes = QattBrush.parse("M60 22 h38 M70 22 c0 20 0 30 -6 50");  // centre lines, one entry per stroke
const d = QattBrush.outline(strokes);                                    // closed outline (fill, nonzero), SVG path data

A stroke is {s: [[x0,y0, x1,y1, x2,y2, x3,y3], ...], p: preset ("auto" or a key of PRESETS), k: width factor, r: reversed,
d: directed}: a chain of cubic segments without corners (parse splits a path at its corners, every piece becomes a stroke of
its own). The brush follows the writing direction (left to right, top to bottom; a directed stroke keeps its own direction);
the width along the stroke comes from a preset.

A stroke of a library is placed between two points: place(a, b, entry) bends it by the entry's h1 and h2 (offsets of the
control points at a third and two thirds of the chord, in units of its length, to the left of the writing direction).
Works in the browser and in node.
*/
const QattBrush = (() => {
  const DEFAULT_PARAMS = { weight: 7, contrast: 0.2, nib: 0, bow: 0.3 };

  // Width profile of a stroke, in units of the weight: width at the start (w0), at the start press (ws, distance sd from the
  // start, shifted to the left of the writing direction by bs, -1..1), in the middle (wm), at the end press (we, ed, be) and at
  // the end (w1); roundness of the start and end caps (capS, capE: 0 = flat, 1 = half circle) and their shift to the left (skS, skE).
  const DEFAULT_PRESETS = {
    heng: { name: "Horizontal 橫", w0: 0.85, ws: 1.0, sd: 0.9, bs: -0.1, wm: 0.72, we: 1.08, ed: 1.1, be: -0.25, w1: 0.9, capS: 0.7, capE: 0.9, skS: 0.5, skE: -0.4 },
    shu: { name: "Vertical 豎", w0: 0.95, ws: 1.1, sd: 0.9, bs: 0.1, wm: 1.0, we: 1.0, ed: 1.0, be: 0, w1: 0.95, capS: 0.7, capE: 0.9, skS: 0.4, skE: 0 },
    pie: { name: "Left-falling 撇", w0: 0.95, ws: 1.1, sd: 0.9, bs: 0, wm: 0.85, we: 0.25, ed: 1.5, be: 0, w1: 0.04, capS: 0.7, capE: 0, skS: 0.4, skE: 0 },
    na: { name: "Right-falling 捺", w0: 0.3, ws: 0.45, sd: 1.0, bs: 0, wm: 0.8, we: 1.3, ed: 1.4, be: -0.2, w1: 0.1, capS: 0.6, capE: 0.2, skS: 0, skE: 0 },
    ti: { name: "Rising 提", w0: 1.0, ws: 1.1, sd: 0.8, bs: 0, wm: 0.7, we: 0.3, ed: 1.2, be: 0, w1: 0.04, capS: 0.7, capE: 0, skS: -0.3, skE: 0 },
    dian: { name: "Dot 點", w0: 0.35, ws: 0.7, sd: 0.6, bs: 0, wm: 1.05, we: 1.15, ed: 0.8, be: 0, w1: 1.0, capS: 0.4, capE: 1.0, skS: 0.3, skE: 0 },
    line: { name: "Line", w0: 0.85, ws: 0.85, sd: 1, bs: 0, wm: 0.85, we: 0.85, ed: 1, be: 0, w1: 0.85, capS: 1, capE: 1, skS: 0, skE: 0 },
  };

  // ---- parsing -------------------------------------------------------------------------------------------------------------

  const line = (x0, y0, x1, y1) => [x0, y0, x0 + (x1 - x0) / 3, y0 + (y1 - y0) / 3, x0 + (x1 - x0) * 2 / 3, y0 + (y1 - y0) * 2 / 3, x1, y1];

  // elliptical arc (SVG endpoint notation) -> cubic segments
  function arc(x0, y0, rx, ry, phi, large, sweep, x1, y1) {
    if (!rx || !ry) return [line(x0, y0, x1, y1)];
    rx = Math.abs(rx); ry = Math.abs(ry);
    const cp = Math.cos(phi * Math.PI / 180), sp = Math.sin(phi * Math.PI / 180);
    const dx = (x0 - x1) / 2, dy = (y0 - y1) / 2;
    const x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    const lam = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
    const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    let co = Math.sqrt(Math.max(0, num / den));
    if (large === sweep) co = -co;
    const cxp = co * rx * y1p / ry, cyp = -co * ry * x1p / rx;
    const cx = cp * cxp - sp * cyp + (x0 + x1) / 2, cy = sp * cxp + cp * cyp + (y0 + y1) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI;
    if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.ceil(Math.abs(dt) / (Math.PI / 2)), h = dt / n, k = 4 / 3 * Math.tan(h / 4);
    const pt = t => [cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp];
    const dv = t => [-rx * Math.sin(t) * cp - ry * Math.cos(t) * sp, -rx * Math.sin(t) * sp + ry * Math.cos(t) * cp];
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = t1 + i * h, b = a + h, [ax, ay] = pt(a), [bx, by] = pt(b), [adx, ady] = dv(a), [bdx, bdy] = dv(b);
      out.push([ax, ay, ax + k * adx, ay + k * ady, bx - k * bdx, by - k * bdy, bx, by]);
    }
    return out;
  }

  // SVG path data -> list of chains (one per subpath) of cubic segments
  function chains(d) {
    const tok = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
    const res = [];
    let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, cur = [], lc = null, lq = null;
    const num = () => parseFloat(tok[i++]);
    const flush = () => { if (cur.length) res.push(cur); cur = []; };
    const ARGS = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
    while (i < tok.length) {
      if (/[a-z]/i.test(tok[i])) cmd = tok[i++];
      else if (!cmd) { i++; continue; }
      const c = cmd.toLowerCase(), rel = cmd !== cmd.toUpperCase() ? 1 : 0;
      if (i + ARGS[c] > tok.length) break;
      let q = null, cc = null;
      if (c === "m") {
        flush(); x = num() + rel * x; y = num() + rel * y; sx = x; sy = y;
        cmd = rel ? "l" : "L";   // further pairs are lines
      } else if (c === "l" || c === "h" || c === "v" || c === "t") {
        let nx = x, ny = y;
        if (c === "h") nx = num() + rel * x;
        else if (c === "v") ny = num() + rel * y;
        else { nx = num() + rel * x; ny = num() + rel * y; }
        if (c === "t") {
          const [qx, qy] = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
          cur.push([x, y, x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), nx + 2 / 3 * (qx - nx), ny + 2 / 3 * (qy - ny), nx, ny]); q = [qx, qy];
        } else cur.push(line(x, y, nx, ny));
        x = nx; y = ny;
      } else if (c === "c" || c === "s") {
        let x1, y1;
        if (c === "s") [x1, y1] = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
        else { x1 = num() + rel * x; y1 = num() + rel * y; }
        const x2 = num() + rel * x, y2 = num() + rel * y, nx = num() + rel * x, ny = num() + rel * y;
        cur.push([x, y, x1, y1, x2, y2, nx, ny]); cc = [x2, y2]; x = nx; y = ny;
      } else if (c === "q") {
        const qx = num() + rel * x, qy = num() + rel * y, nx = num() + rel * x, ny = num() + rel * y;
        cur.push([x, y, x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y), nx + 2 / 3 * (qx - nx), ny + 2 / 3 * (qy - ny), nx, ny]); q = [qx, qy]; x = nx; y = ny;
      } else if (c === "a") {
        const rx = num(), ry = num(), phi = num(), large = num(), sweep = num(), nx = num() + rel * x, ny = num() + rel * y;
        cur.push(...arc(x, y, rx, ry, phi, large, sweep, nx, ny)); x = nx; y = ny;
      } else if (c === "z") {
        if (x !== sx || y !== sy) cur.push(line(x, y, sx, sy));
        flush(); x = sx; y = sy;
      }
      lc = cc; lq = q;
    }
    flush();
    return res;
  }

  const startTan = s => { for (const [x, y] of [[s[2], s[3]], [s[4], s[5]], [s[6], s[7]]]) { const dx = x - s[0], dy = y - s[1]; if (Math.hypot(dx, dy) > 1e-6) return [dx, dy]; } return [1, 0]; };
  const endTan = s => { for (const [x, y] of [[s[4], s[5]], [s[2], s[3]], [s[0], s[1]]]) { const dx = s[6] - x, dy = s[7] - y; if (Math.hypot(dx, dy) > 1e-6) return [dx, dy]; } return [1, 0]; };
  const angleBetween = (a, b) => Math.abs(Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]));

  // SVG path data -> strokes; chains are split at corners (> 35°), pieces shorter than 3 units are dropped
  function parse(d) {
    const out = [];
    for (const ch of chains(d)) {
      let piece = [];
      ch.forEach((seg, j) => {
        if (j && angleBetween(endTan(ch[j - 1]), startTan(seg)) > 35 * Math.PI / 180) { out.push(piece); piece = []; }
        piece.push(seg);
      });
      out.push(piece);
    }
    return out.filter(p => length(p) >= 3).map(s => ({ s, p: "auto", k: 1, r: false }));
  }

  // ---- geometry --------------------------------------------------------------------------------------------------------------

  const bez = (s, t) => { const u = 1 - t; return [u * u * u * s[0] + 3 * u * u * t * s[2] + 3 * u * t * t * s[4] + t * t * t * s[6], u * u * u * s[1] + 3 * u * u * t * s[3] + 3 * u * t * t * s[5] + t * t * t * s[7]]; };
  const der = (s, t) => { const u = 1 - t; return [3 * u * u * (s[2] - s[0]) + 6 * u * t * (s[4] - s[2]) + 3 * t * t * (s[6] - s[4]), 3 * u * u * (s[3] - s[1]) + 6 * u * t * (s[5] - s[3]) + 3 * t * t * (s[7] - s[5])]; };
  function segLength(s) { let l = 0, p = bez(s, 0); for (let i = 1; i <= 16; i++) { const q = bez(s, i / 16); l += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; } return l; }
  const length = segs => segs.reduce((a, s) => a + segLength(s), 0);
  const reverse = segs => segs.slice().reverse().map(s => [s[6], s[7], s[4], s[5], s[2], s[3], s[0], s[1]]);

  // writing direction: left to right, top to bottom (rising strokes stay rising); loops keep their direction
  function normalize(segs) {
    const a = segs[0], b = segs[segs.length - 1], dx = b[6] - a[0], dy = b[7] - a[1];
    if (Math.hypot(dx, dy) < 0.3 * length(segs)) return segs;
    if ((dx < 0 && dy <= 0.27 * -dx) || (dy < 0 && -dy > 3.7 * Math.abs(dx))) return reverse(segs);
    return segs;
  }

  function classify(segs) {
    const L = length(segs), a = segs[0], b = segs[segs.length - 1], dx = b[6] - a[0], dy = b[7] - a[1];
    if (Math.hypot(dx, dy) < 0.3 * L) return "line";
    if (L < 18) return "dian";
    const t = Math.atan2(dy, dx) * 180 / Math.PI;
    if (t < -15) return "ti";
    if (t < 30) return "heng";
    if (t < 70) return "na";
    if (t < 110) return "shu";
    return "pie";
  }

  // values at sorted positions xs -> monotone cubic interpolation (Fritsch-Carlson)
  function interpolator(xs, ys) {
    const n = xs.length;
    if (n === 1) return () => ys[0];
    const d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
      const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
      if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return x => {
      if (x <= xs[0]) return ys[0];
      if (x >= xs[n - 1]) return ys[n - 1];
      let i = 0; while (x > xs[i + 1]) i++;
      const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    };
  }

  // one stroke -> closed polygon [[x, y], ...]
  function strokePolygon(stroke, params, presets) {
    params = Object.assign({}, DEFAULT_PARAMS, params);
    let segs = stroke.d ? stroke.s.map(s => s.slice()) : normalize(stroke.s.map(s => s.slice()));
    if (stroke.r) segs = reverse(segs);
    const kind = stroke.p && stroke.p !== "auto" ? stroke.p : classify(segs);
    const P = Object.assign({}, DEFAULT_PRESETS.line, (presets || DEFAULT_PRESETS)[kind] || DEFAULT_PRESETS[kind]);
    const W = params.weight * (stroke.k || 1);

    // a straight horizontal stroke bows a little upwards
    if (kind === "heng" && segs.length === 1 && params.bow && !stroke.d) {
      const s = segs[0], dx = s[6] - s[0], dy = s[7] - s[1], L = Math.hypot(dx, dy);
      const off = (x, y) => Math.abs((x - s[0]) * dy - (y - s[1]) * dx) / L;
      if (off(s[2], s[3]) < 0.01 && off(s[4], s[5]) < 0.01) {
        const nx = dy / L, ny = -dx / L, b = params.bow * L * 0.06;
        segs = [[s[0], s[1], s[2] + nx * b, s[3] + ny * b, s[4] + nx * b, s[5] + ny * b, s[6], s[7]]];
      }
    }

    // samples along the centre line: point, unit tangent, arc length
    const pts = [];
    let acc = 0;
    segs.forEach((s, j) => {
      const n = Math.max(6, Math.ceil(segLength(s) / 1.2));
      for (let i = j ? 1 : 0; i <= n; i++) {
        const t = i / n, p = bez(s, t);
        let [tx, ty] = der(s, Math.min(Math.max(t, 1e-4), 1 - 1e-4));
        const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
        if (pts.length) { const q = pts[pts.length - 1]; acc += Math.hypot(p[0] - q.x, p[1] - q.y); }
        pts.push({ x: p[0], y: p[1], tx, ty, s: acc });
      }
    });
    const L = acc || 1;

    // width profile along the arc length
    let sd = P.sd * W, ed = P.ed * W;
    if (sd + ed > 0.8 * L) { const f = 0.8 * L / (sd + ed); sd *= f; ed *= f; }
    const keys = [[0, P.w0, 0], [sd, P.ws, P.bs]];
    if (L / 2 > sd + 0.05 * L && L / 2 < L - ed - 0.05 * L) keys.push([L / 2, P.wm, 0]);
    keys.push([L - ed, P.we, P.be], [L, P.w1, 0]);
    const xs = [], ws = [], bs = [];
    for (const [x, w, b] of keys) if (!xs.length || x > xs[xs.length - 1] + 1e-6) { xs.push(x); ws.push(w); bs.push(b); }
    const width = interpolator(xs, ws), bias = interpolator(xs, bs);
    const nib = params.nib * Math.PI / 180;
    const side = p => {
      const w = Math.max(0, W * width(p.s) * (1 - params.contrast + params.contrast * Math.abs(Math.sin(Math.atan2(p.ty, p.tx) - nib))));
      const b = Math.max(-1, Math.min(1, bias(p.s)));
      return [w * (1 + b) / 2, w * (1 - b) / 2];   // to the left and to the right of the writing direction
    };

    const left = [], right = [];
    for (const p of pts) {
      const [a, b] = side(p), nx = p.ty, ny = -p.tx;
      left.push([p.x + nx * a, p.y + ny * a]); right.push([p.x - nx * b, p.y - ny * b]);
    }
    const cap = (p, a, b, round, skew, forward) => {
      const out = [], len = round * (a + b) / 2, K = 10, nx = p.ty, ny = -p.tx, dir = forward ? 1 : -1;
      for (let k = 1; k < K; k++) {
        const phi = Math.PI * k / K, c = Math.cos(phi), s = Math.sin(phi);
        const lat = forward ? c * (phi < Math.PI / 2 ? a : b) : -c * (phi < Math.PI / 2 ? b : a);
        out.push([p.x + nx * (lat + skew * s * len) + dir * p.tx * s * len, p.y + ny * (lat + skew * s * len) + dir * p.ty * s * len]);
      }
      return out;
    };
    const first = pts[0], last = pts[pts.length - 1], [fa, fb] = side(first), [la, lb] = side(last);
    const poly = [...left, ...cap(last, la, lb, P.capE, P.skE, true), ...right.reverse(), ...cap(first, fa, fb, P.capS, P.skS, false)];

    // all outlines turn the same way, so overlapping strokes add up under the nonzero rule
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; area += x0 * y1 - x1 * y0; }
    return area < 0 ? poly.reverse() : poly;
  }

  const r2 = v => Math.round(v * 100) / 100;
  const polyToD = poly => "M" + poly.map(([x, y]) => r2(x) + " " + r2(y)).join("L") + "Z";

  // strokes -> SVG path data of the filled outline
  function outline(strokes, params, presets) {
    return strokes.map(s => polyToD(strokePolygon(s, params, presets))).join("");
  }

  // centre lines of the strokes as SVG path data
  function skeleton(strokes) {
    return strokes.map(st => st.s.map((s, j) => (j ? "" : `M${r2(s[0])} ${r2(s[1])}`) + `C${s.slice(2).map(r2).join(" ")}`).join("")).join("");
  }

  // copy of the strokes with every point moved by f([x, y]) -> [x, y]
  function transform(strokes, f) {
    return strokes.map(st => Object.assign({}, st, { s: st.s.map(s => [0, 2, 4, 6].flatMap(i => f([s[i], s[i + 1]]))) }));
  }

  // a point of the chain at the share f of its arc length
  function pointAt(segs, f) {
    const total = length(segs);
    let want = f * total;
    for (const s of segs) {
      const l = segLength(s);
      if (want <= l || s === segs[segs.length - 1]) return bez(s, Math.min(1, want / (l || 1)));
      want -= l;
    }
  }
  // chain -> {a, b, h1, h2}: its end points and the bend of one cubic through it (h1, h2 as in place)
  function fit(segs) {
    const a = [segs[0][0], segs[0][1]], z = segs[segs.length - 1], b = [z[6], z[7]];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
    const off = f => { const p = pointAt(segs, f); return ((p[0] - a[0]) * nx + (p[1] - a[1]) * ny) / L; };
    const o1 = off(1 / 3), o2 = off(2 / 3);
    return { a, b, h1: 3 * o1 - 1.5 * o2, h2: 3 * o2 - 1.5 * o1 };
  }
  // stroke of the library entry `kind` from a to b
  function place(a, b, entry, kind) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = dy / L, ny = -dx / L;
    const h1 = (entry.h1 || 0) * L, h2 = (entry.h2 || 0) * L;
    return { s: [[a[0], a[1], a[0] + dx / 3 + nx * h1, a[1] + dy / 3 + ny * h1, a[0] + dx * 2 / 3 + nx * h2, a[1] + dy * 2 / 3 + ny * h2, b[0], b[1]]], p: kind, k: 1, d: true };
  }

  return { DEFAULT_PARAMS, fit, place, DEFAULT_PRESETS, parse, outline, skeleton, transform, classify, normalize, length, strokePolygon };
})();

if (typeof module !== "undefined") module.exports = QattBrush;
