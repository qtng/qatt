/*
QATT brush 2: brush strokes with a simple model. A stroke is an arc between two end points; it has a kind of end at the start
and at the end, and a gradient for the way its width changes from one end to the other.

const strokes = [QattBrush2.stroke({ a: [20, 30], b: [80, 30], bend: 0.03, s: "kihitsu", e: "flat", g: 0 })];
const d = QattBrush2.outline(strokes, params);      // closed outline (fill, nonzero), SVG path data

Item (what an editor stores): a, b end points, bend (the offset of the middle of the arc from the chord, in units of the chord,
positive to the left of the writing direction), s and e the kind of the start and the end, g the gradient (-1..1).
Kinds of ends: "flat" (cut straight), "point" (a round tip), "kihitsu" (a pressed head, then cut straight).
Params (all widths in units of weight): weight, flatWidth and flatAngle (width and angle of the cut of flat ends),
pointRadius (radius of a pointed end), kihitsuSize and kihitsuAngle (width of the head and angle of its cut; the angle counts from the nearest axis of the page, a
form can override it per end with sa and ea).

Width: the two ends have a width (flat and kihitsu: flatWidth, point: twice the radius); from the thin to the thick end it
follows w = thin + (thick - thin) * t^p with t from 0 at the thin end to 1 at the thick end and p = 2^(3g): g = 0 is linear,
g > 0 keeps the stroke slim for longer, g < 0 makes it full soon. A kihitsu end adds a head of the width kihitsuSize.
Works in the browser and in node.
*/
const QattBrush2 = (() => {
  const DEFAULT_PARAMS = { weight: 7, flatWidth: 1, flatAngle: 0, pointRadius: 0.06, kihitsuSize: 1.5, kihitsuAngle: 20 };
  const KINDS = { flat: "Flat", point: "Pointed", kihitsu: "Kihitsu" };

  const bez = (c, t) => { const u = 1 - t; return [u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6], u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7]]; };
  const der = (c, t) => { const u = 1 - t; return [3 * u * u * (c[2] - c[0]) + 6 * u * t * (c[4] - c[2]) + 3 * t * t * (c[6] - c[4]), 3 * u * u * (c[3] - c[1]) + 6 * u * t * (c[5] - c[3]) + 3 * t * t * (c[7] - c[5])]; };
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // the centre line: a cubic between a and b whose middle is bend * chord away from the chord
  function curve(a, b, bend) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, h = (bend || 0) / 0.75 * L, nx = dy / L, ny = -dx / L;
    return [a[0], a[1], a[0] + dx / 3 + nx * h, a[1] + dy / 3 + ny * h, a[0] + dx * 2 / 3 + nx * h, a[1] + dy * 2 / 3 + ny * h, b[0], b[1]];
  }
  const stroke = it => ({ c: curve(it.a, it.b, it.bend), s: it.s || "flat", e: it.e || "flat", g: it.g || 0, sa: it.sa, ea: it.ea });
  const transform = (strokes, f) => strokes.map(st => Object.assign({}, st, { c: [0, 2, 4, 6].flatMap(i => f([st.c[i], st.c[i + 1]])) }));

  // the part of the polyline in front of the plane through c with outward normal u (the rest is cut off)
  function trim(poly, c, u) {
    const f = p => (p[0] - c[0]) * u[0] + (p[1] - c[1]) * u[1];
    for (let i = 0; i < poly.length; i++) {
      if (f(poly[i]) <= 0) continue;
      if (!i) return [poly[0]];
      const a = poly[i - 1], b = poly[i], fa = f(a), fb = f(b), k = fa / (fa - fb);
      return poly.slice(0, i).concat([[a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]]);
    }
    return poly;
  }

  // one stroke -> closed polygon [[x, y], ...] (null if it is too short)
  function polygon(st, params) {
    params = Object.assign({}, DEFAULT_PARAMS, params);
    const W = params.weight, Fw = params.flatWidth * W, Pw = 2 * params.pointRadius * W, Kh = Math.max(params.kihitsuSize * W, Fw), c = st.c;
    const N = 48;
    let L = 0, prev = bez(c, 0);
    for (let i = 1; i <= N; i++) { const q = bez(c, i / N); L += Math.hypot(q[0] - prev[0], q[1] - prev[1]); prev = q; }
    if (L < 0.5) return null;

    // width along the arc length
    const base = k => k === "point" ? Pw : Fw, wa = base(st.s), wb = base(st.e), p = Math.pow(2, 3 * (st.g || 0));
    const lo = Math.min(wa, wb), hi = Math.max(wa, wb), Hl = Math.min(Kh * 0.8, 0.4 * L);
    const bump = d => { const x = clamp((d - 0.35 * Hl) / (0.65 * Hl), 0, 1); return 1 - x * x * (3 - 2 * x); };
    const width = s => {
      s = clamp(s, 0, L);
      let w = wa === wb ? wa : lo + (hi - lo) * Math.pow(wa < wb ? s / L : 1 - s / L, p);
      if (st.s === "kihitsu") w += Math.max(0, Kh - w) * bump(s);
      if (st.e === "kihitsu") w += Math.max(0, Kh - w) * bump(L - s);
      return w;
    };
    // angles of the cuts: a kihitsu has the global angle (or the one of the form) whatever the direction of the stroke
    const angle = (k, own) => clamp(k === "kihitsu" ? (typeof own === "number" ? own : params.kihitsuAngle) : params.flatAngle, -70, 70) * Math.PI / 180;
    const aS = angle(st.s, st.sa), aE = angle(st.e, st.ea);

    // samples along the centre line: point, unit tangent, arc length
    const n = Math.max(8, Math.ceil(L / 1.2)), pts = [];
    let acc = 0;
    for (let i = 0; i <= n; i++) {
      const t = i / n, q = bez(c, t);
      let [tx, ty] = der(c, clamp(t, 1e-4, 1 - 1e-4));
      const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      if (pts.length) { const o = pts[pts.length - 1]; acc += Math.hypot(q[0] - o.x, q[1] - o.y); }
      pts.push({ x: q[0], y: q[1], tx, ty, s: acc });
    }
    const first = pts[0], last = pts[pts.length - 1];
    // a straight cut is slanted: the centre line runs on a little beyond the end, the outline is cut at the slanted line.
    // The cut of a kihitsu is measured from the nearest axis of the page (a stroke that is turned a little keeps its cut);
    // the cut of a flat end from the direction of the stroke.
    const cdx = c[6] - c[0], cdy = c[7] - c[1];
    const axis = Math.hypot(cdx, cdy) < 1e-6 ? null : Math.abs(cdx) >= Math.abs(cdy) ? [Math.sign(cdx), 0] : [0, Math.sign(cdy)];
    const cutPlane = (k, q, dir, a) => {   // outward normal of the cut at q, the same slant at both ends
      const frame = (t, n) => [dir * (t[0] * Math.cos(a) - n[0] * Math.sin(a)), dir * (t[1] * Math.cos(a) - n[1] * Math.sin(a))];
      const own = frame([q.tx, q.ty], [q.ty, -q.tx]);
      if (k !== "kihitsu" || !axis) return own;
      const u = frame(axis, [axis[1], -axis[0]]);
      return u[0] * q.tx * dir + u[1] * q.ty * dir > 0.25 ? u : own;
    };
    const uS = st.s === "point" ? null : cutPlane(st.s, first, -1, aS), uE = st.e === "point" ? null : cutPlane(st.e, last, 1, aE);
    const ext = (u, from, dir) => {
      if (!u) return [];
      const cs = Math.max(0.25, Math.abs(u[0] * from.tx + u[1] * from.ty)), m = Math.min(40, Math.sqrt(1 - cs * cs) / cs * Math.max(Fw, Kh) / 2 + 2), out = [];
      for (let j = 1; j * 1.2 <= m + 1.2; j++) out.push({ x: from.x + dir * from.tx * j * 1.2, y: from.y + dir * from.ty * j * 1.2, tx: from.tx, ty: from.ty, s: from.s + dir * j * 1.2 });
      return out;
    };
    const all = [...ext(uS, first, -1).reverse(), ...pts, ...ext(uE, last, 1)];
    let left = all.map(q => { const w = width(q.s) / 2; return [q.x + q.ty * w, q.y - q.tx * w]; });
    let right = all.map(q => { const w = width(q.s) / 2; return [q.x - q.ty * w, q.y + q.tx * w]; });

    if (uE) { const at = [last.x, last.y]; left = trim(left, at, uE); right = trim(right, at, uE); }
    if (uS) { const at = [first.x, first.y]; left = trim(left.reverse(), at, uS).reverse(); right = trim(right.reverse(), at, uS).reverse(); }

    const K = 10, endCap = [], startCap = [];
    if (st.e === "point") {
      const r = width(L) / 2;
      for (let k = 1; k < K; k++) { const f = Math.PI * k / K; endCap.push([last.x + last.ty * r * Math.cos(f) + last.tx * r * Math.sin(f), last.y - last.tx * r * Math.cos(f) + last.ty * r * Math.sin(f)]); }
    }
    if (st.s === "point") {
      const r = width(0) / 2;
      for (let k = 1; k < K; k++) { const f = Math.PI * k / K; startCap.push([first.x - first.ty * r * Math.cos(f) - first.tx * r * Math.sin(f), first.y + first.tx * r * Math.cos(f) - first.ty * r * Math.sin(f)]); }
    }
    const poly = [...left, ...endCap, ...right.reverse(), ...startCap];

    // all outlines turn the same way, so overlapping strokes add up under the nonzero rule
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; area += x0 * y1 - x1 * y0; }
    return area < 0 ? poly.reverse() : poly;
  }

  const r2 = v => Math.round(v * 100) / 100;
  const polyToD = poly => "M" + poly.map(([x, y]) => r2(x) + " " + r2(y)).join("L") + "Z";
  const outline = (strokes, params) => strokes.map(st => { const p = polygon(st, params); return p ? polyToD(p) : ""; }).join("");
  const skeleton = strokes => strokes.map(st => `M${r2(st.c[0])} ${r2(st.c[1])}C${st.c.slice(2).map(r2).join(" ")}`).join("");

  return { DEFAULT_PARAMS, KINDS, curve, stroke, transform, polygon, outline, skeleton };
})();

if (typeof module !== "undefined") module.exports = QattBrush2;
