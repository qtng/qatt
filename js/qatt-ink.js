/*
QATT handwriting recognition (a draft): strokes drawn in the square of a cell -> the most likely QATT cells.

  const ink = QattInk.create();               // templates from the stroke data of js/qatt.js (defaultSvgDefs), so load qatt.js first
  ink.recognize(strokes, 5)                   // strokes: [[{x, y}, …], …] in the coordinates of a cell (viewBox -12.5 -12.5 125 125 of qatt.js)
                                              // -> [{ text, code, score, strokes }] best first; text is for the QATT fonts (QattText), strokes the template
  QattInk.FRAME                               // { x, y, size } of that coordinate system
  QattInk.SHAPES                              // the 22 shapes in the order of the code points
  QattInk.text("t+nh5 3")                     // the text of a cell for the QATT fonts from its code (the code of a result), null if it is none

What it knows (no Tham Thư): a letter alone (the 22 shapes of QattText, with or without one of the 6 marking strokes, the centred
forms v2c-…) and a joined cell (the small onset v2-<shape>-small on the left, the rhyme v2-<shape> with its marking stroke on the right),
both with or without one of the 8 tone marks (qt…). The drawing is compared with every combination as point clouds in the fixed frame
(chamfer distance both ways: drawn points to the nearest template point and back), so the order and the direction of the strokes do not
matter, but the place does: write into the square. The parts are measured once and combined, so all about 30,000 cells take a few ms.
*/
const QattInk = (() => {
  const FRAME = { x: -12.5, y: -12.5, size: 125 };
  const SHAPES = "_ ng h g c l tr d n t th nh ch dz x kh s r m b v ph".split(" ");   // as in QattText
  const BASE = 0xF0000, JOINER = BASE + 154;
  const TONES = [null, 160, 157, 158, 159, 161, 162, 163, 156];                      // tone 1..8 -> offset of the tone mark (QattText)
  const STEP = 2;   // spacing of the points, in units of the cell

  // the subpaths of an SVG path (M m L l H h V v C c Z, what qatt.js uses for letters and tones) as polylines with points every STEP
  const strokesOf = d => {
    const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [];
    const strokes = [];
    let cmd = "", x = 0, y = 0, sx = 0, sy = 0, cur = null, i = 0;
    const num = () => parseFloat(tokens[i++]);
    const line = (nx, ny) => {
      if (!cur) cur = [{ x, y }];
      const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / STEP));
      for (let k = 1; k <= n; k++) cur.push({ x: x + (nx - x) * k / n, y: y + (ny - y) * k / n });
      x = nx; y = ny;
    };
    const cubic = (x1, y1, x2, y2, nx, ny) => {
      if (!cur) cur = [{ x, y }];
      const len = Math.hypot(x1 - x, y1 - y) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(nx - x2, ny - y2);
      const n = Math.max(2, Math.ceil(len / STEP)), x0 = x, y0 = y;
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        cur.push({ x: u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * nx,
                   y: u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ny });
      }
      x = nx; y = ny;
    };
    const end = () => { if (cur && cur.length > 1) strokes.push(cur); cur = null; };
    while (i < tokens.length) {
      if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
      const rel = cmd === cmd.toLowerCase();
      const ox = rel ? x : 0, oy = rel ? y : 0;
      switch (cmd.toUpperCase()) {
        case "M": end(); x = ox + num(); y = oy + num(); sx = x; sy = y; cmd = rel ? "l" : "L"; break;   // further pairs are lines
        case "L": { const nx = ox + num(), ny = oy + num(); line(nx, ny); break; }
        case "H": line((rel ? x : 0) + num(), y); break;
        case "V": line(x, (rel ? y : 0) + num()); break;
        case "C": { const a = num(), b = num(), c = num(), e = num(), f = num(), g = num(); cubic(ox + a, oy + b, ox + c, oy + e, ox + f, oy + g); break; }
        case "Z": line(sx, sy); cmd = ""; break;
        default: i++;   // not used by the letters and tones of qatt.js
      }
    }
    end();
    return strokes;
  };

  // drawn strokes: the same spacing as the templates
  const resample = strokes => strokes.map(s => {
    const out = [s[0]];
    let prev = s[0], carry = 0;
    for (let k = 1; k < s.length; k++) {
      const p = s[k];
      let d = Math.hypot(p.x - prev.x, p.y - prev.y);
      while (carry + d >= STEP) {
        const t = (STEP - carry) / d;
        prev = { x: prev.x + (p.x - prev.x) * t, y: prev.y + (p.y - prev.y) * t };
        out.push(prev);
        d = Math.hypot(p.x - prev.x, p.y - prev.y);
        carry = 0;
      }
      carry += d;
      prev = p;
    }
    if (out.length === 1) out.push(s[s.length - 1]);   // a dot
    return out;
  });

  const create = () => {
    const doc = new DOMParser().parseFromString(defaultSvgDefs, "image/svg+xml");
    const path = id => { const el = doc.getElementById(id); return el ? strokesOf(el.getAttribute("d")) : null; };
    const part = strokes => strokes && { strokes, points: strokes.flat() };

    // the parts: alone[s][m] = a letter alone (m = 0 plain, 1..6 its marking stroke only), onset[s], rhyme[s][m], tone[t] (1..8)
    const alone = SHAPES.map(s => [part(path("v2c-" + s)), ...[1, 2, 3, 4, 5, 6].map(m => part(path("v2c-" + s + m)))]);
    const onset = SHAPES.map(s => part(path("v2-" + s + "-small")));
    const rhyme = SHAPES.map(s => [part(path("v2-" + s)), ...[1, 2, 3, 4, 5, 6].map(m => part(path("v2-" + s + m)))]);
    const tone = [null, ...[1, 2, 3, 4, 5, 6, 7, 8].map(t => part(path("qt" + (t === 8 ? 0 : t))))];

    // a distance field of a cloud of points: GRID x GRID cells over the frame, the distance of every cell centre to the nearest point
    const GRID = 63, CELL = FRAME.size / GRID;
    const field = points => {
      const f = new Float32Array(GRID * GRID);
      for (let gy = 0; gy < GRID; gy++) for (let gx = 0; gx < GRID; gx++) {
        const x = FRAME.x + (gx + .5) * CELL, y = FRAME.y + (gy + .5) * CELL;
        let best = Infinity;
        for (const q of points) { const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < best) best = d; }
        f[gy * GRID + gx] = Math.sqrt(best);
      }
      return f;
    };
    const lookup = (f, p) => {   // outside the frame: the distance at the edge plus the way to it
      const gx = (p.x - FRAME.x) / CELL - .5, gy = (p.y - FRAME.y) / CELL - .5;
      const cx = Math.min(GRID - 1, Math.max(0, Math.round(gx))), cy = Math.min(GRID - 1, Math.max(0, Math.round(gy)));
      return f[cy * GRID + cx] + Math.hypot(gx - cx, gy - cy) * CELL * (Math.abs(gx - cx) > .5 || Math.abs(gy - cy) > .5 ? 1 : 0);
    };
    const fieldOf = p => p.field || (p.field = field(p.points));   // made when first needed

    // the drawing moved and scaled onto the template (no rotation): a few rounds of nearest pairs and a least-squares fit, within limits
    const align = (pts, tpl) => {
      let s = 1, tx = 0, ty = 0;
      for (let round = 0; round < 5; round++) {
        const cur = pts.map(p => ({ x: p.x * s + tx, y: p.y * s + ty }));
        const pairs = [];
        cur.forEach((p, k) => { let best = Infinity, bq = null; for (const q of tpl) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < best) { best = d; bq = q; } } pairs.push([pts[k], bq]); });
        tpl.forEach(q => { let best = Infinity, bk = 0; cur.forEach((p, k) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < best) { best = d; bk = k; } }); pairs.push([pts[bk], q]); });
        let px = 0, py = 0, qx = 0, qy = 0;
        for (const [p, q] of pairs) { px += p.x; py += p.y; qx += q.x; qy += q.y; }
        px /= pairs.length; py /= pairs.length; qx /= pairs.length; qy /= pairs.length;
        let num = 0, den = 0;
        for (const [p, q] of pairs) { num += (p.x - px) * (q.x - qx) + (p.y - py) * (q.y - qy); den += (p.x - px) ** 2 + (p.y - py) ** 2; }
        s = Math.min(1.35, Math.max(.75, den ? num / den : 1));
        tx = Math.min(18, Math.max(-18, qx - s * px)); ty = Math.min(18, Math.max(-18, qy - s * py));
        // the limits hold for the move of the centre, not of the origin
        const mx = px * s + tx - px, my = py * s + ty - py;
        tx -= mx - Math.min(18, Math.max(-18, mx)); ty -= my - Math.min(18, Math.max(-18, my));
      }
      return p => ({ x: p.x * s + tx, y: p.y * s + ty });
    };

    // the kind of a stroke: its length, its direction (0..180°, from the first to the last point, so the direction of writing does not matter)
    // and whether it is round (a tone mark: short and bent, the ends near each other; open: how far apart the ends are, a half circle against a whole one)
    const kind = s => {
      let len = 0;
      for (let k = 1; k < s.length; k++) len += Math.hypot(s[k].x - s[k - 1].x, s[k].y - s[k - 1].y);
      const dx = s[s.length - 1].x - s[0].x, dy = s[s.length - 1].y - s[0].y, chord = Math.hypot(dx, dy);
      return { len: Math.max(len, 1), ang: (Math.atan2(dy, dx) * 180 / Math.PI + 180) % 180, round: len < 60 && chord < .75 * len, open: chord / Math.max(len, 1) };
    };
    [...alone.flat(), ...onset, ...rhyme.flat(), ...tone].forEach(p => { if (p) p.kinds = p.strokes.map(kind); });
    // how badly two strokes fit as a pair (0 the same kind, 1 nothing alike): round or not, the direction (45° off counts fully), the length (2.5 times counts half)
    const MISS = 1;   // a stroke without a partner
    const cost = (d, t) => {
      if (d.round !== t.round) return MISS;
      const l = Math.min(1, Math.abs(Math.log(d.len / t.len)) / Math.log(2.5));
      if (d.round) return Math.min(MISS, 2 * Math.abs(d.open - t.open) + .5 * l);
      const a = Math.abs(d.ang - t.ang);
      return Math.min(MISS, Math.min(a, 180 - a) / 45 + .5 * l);
    };
    // the best pairing of the drawn strokes with those of the template (each at most once): the sum of the costs, MISS for every stroke left over
    const pairing = (ds, ts) => {
      const m = ts.length, size = 1 << m;
      let dp = new Float32Array(size).fill(Infinity);
      dp[0] = 0;
      for (const d of ds) {
        const next = new Float32Array(size).fill(Infinity);
        const c = ts.map(t => cost(d, t));
        for (let mask = 0; mask < size; mask++) {
          const v = dp[mask];
          if (v === Infinity) continue;
          if (v + MISS < next[mask]) next[mask] = v + MISS;
          for (let j = 0; j < m; j++) if (!(mask & 1 << j) && v + c[j] < next[mask | 1 << j]) next[mask | 1 << j] = v + c[j];
        }
        dp = next;
      }
      let best = Infinity;
      for (let mask = 0; mask < size; mask++) {
        let left = 0;
        for (let j = 0; j < m; j++) if (!(mask & 1 << j)) left++;
        best = Math.min(best, dp[mask] + MISS * left);
      }
      return best;
    };

    const sumNearest = (a, b) => { let sum = 0; for (const p of a) { let best = Infinity; for (const q of b) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < best) best = d; } sum += Math.sqrt(best); } return sum; };
    const KIND_WEIGHT = 2;   // the pairing of the strokes against the distances of the points

    // A tone mark is always the last stroke: a candidate with a tone compares the tone mark with the last stroke only, its other parts with the strokes before it.
    const recognize = (drawn, count = 5) => {
      drawn = drawn.filter(s => s.length);
      if (!drawn.length) return [];
      const strokes = resample(drawn);
      // the kinds of the drawn strokes from a smoothed copy (a shaky hand makes a stroke longer than it is)
      const smooth = st => st.map((p, k) => { const w = st.slice(Math.max(0, k - 2), k + 3); return { x: w.reduce((a, q) => a + q.x, 0) / w.length, y: w.reduce((a, q) => a + q.y, 0) / w.length }; });
      const kinds = strokes.map(st => kind(smooth(st)));
      const all = strokes.flat();
      const pointsOf = parts => parts.flatMap(p => p.points);

      // 1. the best candidates in the fixed frame, 2. the same with the drawing aligned to the best of them (a drawing off the place or the size),
      // 3. all of them once more with the drawing aligned to each one, now also with the pairing of the kinds of the strokes
      const first = shortlist(strokes);
      const move = align(all.filter((p, k) => k % 3 === 0), pointsOf(first[0].parts.concat(first[0].tone || [])));
      const seen = new Set(first.map(r => r.code));
      const list = first.concat(shortlist(strokes.map(s => s.map(move))).filter(r => !seen.has(r.code)));
      const thin = s => s.filter((p, k) => k % 3 === 0 || k === s.length - 1);
      const few = strokes.map(thin);
      return list.map(r => {
        const body = pointsOf(r.parts).filter((p, k) => k % 2 === 0), tpl = r.tone ? body.concat(r.tone.points) : body;
        const fit = align(few.flat(), tpl);
        const moved = few.map(s => s.map(fit));
        let to, back, kindCost;
        if (r.tone) {
          const bodyDrawn = moved.slice(0, -1).flat(), last = moved[moved.length - 1];
          to = (sumNearest(bodyDrawn, body) + sumNearest(last, r.tone.points)) / (bodyDrawn.length + last.length);
          back = (sumNearest(body, bodyDrawn) + sumNearest(r.tone.points, last)) / (body.length + r.tone.points.length);
          kindCost = pairing(kinds.slice(0, -1), r.parts.flatMap(p => p.kinds)) + cost(kinds[kinds.length - 1], r.tone.kinds[0]);
        } else {
          const d = moved.flat();
          to = sumNearest(d, body) / d.length;
          back = sumNearest(body, d) / body.length;
          kindCost = pairing(kinds, r.parts.flatMap(p => p.kinds));
        }
        return { text: r.text, code: r.code, score: to + back + KIND_WEIGHT * kindCost, kindCost,
                 strokes: r.parts.concat(r.tone || []).flatMap(p => p.strokes) };
      }).sort((a, b) => a.score - b.score).slice(0, count);
    };

    // the SHORTLIST best cells for the strokes of a drawing in the fixed frame
    const SHORTLIST = 40, PAIRS = 60;
    const shortlist = strokes => {
      const total = strokes.length;
      const penalty = c => 1.5 * Math.abs(c - total);   // a little for each stroke too many or too few
      const half = pts => pts.filter((p, k) => k % 2 === 0);   // every second point is enough for the distances drawing -> template
      // the whole drawing; and the drawing without its last stroke (body) and that stroke alone (last), for the candidates with a tone
      const sets = [strokes.flat(), total > 1 ? strokes.slice(0, -1).flat() : null, total > 1 ? strokes[total - 1] : null]
        .map(pts => pts && { own: field(pts), few: half(pts) });
      const [whole, bodySet, lastSet] = sets;

      // per part and set of points: for every drawn point its distance to the part (dTo), and the sum of the distances of the part's points to the drawing (back)
      const measure = set => p => {
        if (!p || !set) return null;
        const f = fieldOf(p), n = set.few.length, dTo = new Float32Array(n);
        for (let k = 0; k < n; k++) dTo[k] = lookup(f, set.few[k]);
        let back = 0;
        for (const q of p.points) back += lookup(set.own, q);
        return { dTo, back, len: p.points.length, count: p.strokes.length };
      };
      const both = p => ({ w: measure(whole)(p), b: measure(bodySet)(p) });
      const mAlone = alone.map(ms => ms.map(both));
      const mOnset = onset.map(both);
      const mRhyme = rhyme.map(ms => ms.map(both));
      const mTone = tone.map(measure(lastSet));   // a tone mark is only compared with the last stroke

      // the score of a set of parts (and a tone mark): mean distance drawn -> template + mean distance template -> drawn, and the penalty of the number of strokes
      const score = (parts, tm) => {
        const ms = parts.map(p => tm ? p.b : p.w);
        if (ms.some(m => !m)) return Infinity;
        const n = ms[0].dTo.length;
        let to = 0;
        for (let k = 0; k < n; k++) {
          let best = Infinity;
          for (const m of ms) if (m.dTo[k] < best) best = m.dTo[k];
          to += best;
        }
        let back = 0, len = 0, count = 0, points = n;
        for (const m of ms.concat(tm || [])) { back += m.back; len += m.len; count += m.count; }
        if (tm) { for (let k = 0; k < tm.dTo.length; k++) to += tm.dTo[k]; points += tm.dTo.length; }
        return to / points + back / len + penalty(count);
      };

      const results = [];
      const keep = r => {
        if (r.score === Infinity) return;
        if (results.length < SHORTLIST || r.score < results[results.length - 1].score) {
          results.push(r);
          results.sort((a, b) => a.score - b.score);
          if (results.length > SHORTLIST) results.pop();
        }
      };
      const chr = o => String.fromCodePoint(BASE + o);
      const pairs = [];
      for (let t = 0; t <= 8; t++) {
        if (t && !mTone[t]) continue;
        const tm = t ? mTone[t] : null;
        const toneText = t ? chr(TONES[t]) : "", toneCode = t ? " " + t : "", tonePart = t ? tone[t] : null;
        SHAPES.forEach((s, i) => {
          // a letter alone (the plain shape, or its marked form: the shape and the marking stroke)
          for (let m = 0; m <= 6; m++) {
            if (!alone[i][0] || (m && !alone[i][m])) continue;
            keep({ score: score(m ? [mAlone[i][0], mAlone[i][m]] : [mAlone[i][0]], tm), text: chr(7 * i + m) + toneText, code: s + (m || "") + toneCode,
                   parts: m ? [alone[i][0], alone[i][m]] : [alone[i][0]], tone: tonePart });
          }
        });
        // joined cells: first onset, rhyme and tone without the marking stroke, then the marking strokes for the best of these pairs only
        SHAPES.forEach((s, i) => {
          if (!onset[i]) return;
          SHAPES.forEach((r, j) => { if (rhyme[j][0]) pairs.push({ i, j, t, tm, toneText, toneCode, tonePart, score: score([mOnset[i], mRhyme[j][0]], tm) }); });
        });
      }
      pairs.sort((a, b) => a.score - b.score).slice(0, PAIRS).forEach(({ i, j, tm, toneText, toneCode, tonePart }) => {
        for (let m = 0; m <= 6; m++) {
          if (m && !rhyme[j][m]) continue;
          keep({ score: score([mOnset[i], mRhyme[j][0], ...(m ? [mRhyme[j][m]] : [])], tm),
                 text: chr(7 * i) + chr(JOINER - BASE) + chr(7 * j + m) + toneText, code: SHAPES[i] + "+" + SHAPES[j] + (m || "") + toneCode,
                 parts: [onset[i], rhyme[j][0], ...(m ? [rhyme[j][m]] : [])], tone: tonePart });
        }
      });
      return results;
    };
    return { recognize };
  };

  // the text of a cell for the QATT fonts from its code ("t+nh5 3", "kh2"), the reverse of the code of a result of recognize(); null if the code is none
  const text = code => {
    const m = /^([a-z_]+)(?:\+([a-z_]+))?([1-6])?(?: ([1-8]))?$/.exec(code || "");
    if (!m) return null;
    const i = SHAPES.indexOf(m[1]), j = m[2] === undefined ? -1 : SHAPES.indexOf(m[2]), mark = +(m[3] || 0), tone = +(m[4] || 0);
    if (i < 0 || (m[2] !== undefined && j < 0)) return null;
    const chr = o => String.fromCodePoint(BASE + o), t = tone ? chr(TONES[tone]) : "";
    return m[2] === undefined ? chr(7 * i + mark) + t : chr(7 * i) + chr(JOINER - BASE) + chr(7 * j + mark) + t;
  };

  return { create, FRAME, strokesOf, SHAPES, text };
})();
if (typeof module !== "undefined") module.exports = QattInk;
