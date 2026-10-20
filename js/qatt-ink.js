/*
QATT handwriting recognition (a draft): strokes drawn in the square of a cell -> the most likely QATT cells.

  const ink = QattInk.create();               // templates from the stroke data of js/qatt.js (defaultSvgDefs), so load qatt.js first
  ink.recognize(strokes, 5)                   // strokes: [[{x, y}, …], …] in the coordinates of a cell (viewBox -12.5 -12.5 125 125 of qatt.js)
                                              // -> [{ text, code, score, strokes }] best first; text is for the QATT fonts (QattText), strokes the template
  QattInk.FRAME                               // { x, y, size } of that coordinate system

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

    // exact distances of point clouds (for the refinement of the best candidates)
    const nearest = (a, b) => { let sum = 0; for (const p of a) { let best = Infinity; for (const q of b) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < best) best = d; } sum += Math.sqrt(best); } return sum / a.length; };
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

    const recognize = (drawn, count = 5) => {
      drawn = drawn.filter(s => s.length);
      const all = resample(drawn).flat();
      if (!all.length) return [];
      const penalty = c => 1.5 * Math.abs(c - drawn.length);   // a little for each stroke too many or too few
      const strokeCount = r => r.parts.reduce((c, p) => c + p.strokes.length, 0);
      const pointsOf = r => r.parts.flatMap(p => p.points);

      // 1. the best candidates in the fixed frame, 2. the same with the drawing aligned to the best of them (a drawing off the place or the size),
      // 3. all of them once more with the drawing aligned to each one
      const first = shortlist(all, penalty);
      const moved = all.map(align(all.filter((p, k) => k % 3 === 0), pointsOf(first[0])));
      const seen = new Set(first.map(r => r.code));
      const list = first.concat(shortlist(moved, penalty).filter(r => !seen.has(r.code)));
      const few = all.filter((p, k) => k % 3 === 0);
      return list.map(r => {
        const tpl = pointsOf(r).filter((p, k) => k % 2 === 0);
        const fit = few.map(align(few, tpl));
        const exact = nearest(fit, tpl) + nearest(tpl, fit) + penalty(strokeCount(r));
        return { text: r.text, code: r.code, score: exact, strokes: r.parts.flatMap(p => p.strokes) };
      }).sort((a, b) => a.score - b.score).slice(0, count);
    };

    // the SHORTLIST best cells for the points of a drawing in the fixed frame
    const SHORTLIST = 40, PAIRS = 60;
    const shortlist = (pts, penalty) => {
      const own = field(pts);
      const few = pts.filter((p, k) => k % 2 === 0);   // every second point is enough for the distances drawing -> template
      const n = few.length;

      // per part: for every drawn point its distance to the part (dTo), and the sum of the distances of the part's points to the drawing (back)
      const measure = p => {
        if (!p) return null;
        const f = fieldOf(p), dTo = new Float32Array(n);
        for (let k = 0; k < n; k++) dTo[k] = lookup(f, few[k]);
        let back = 0;
        for (const q of p.points) back += lookup(own, q);
        return { dTo, back, len: p.points.length, count: p.strokes.length };
      };
      const mAlone = alone.map(ms => ms.map(measure));
      const mOnset = onset.map(measure);
      const mRhyme = rhyme.map(ms => ms.map(measure));
      const mTone = tone.map(measure);

      // the score of a set of parts: mean distance drawn -> template + mean distance template -> drawn, and the penalty of the number of strokes
      const score = parts => {
        let to = 0;
        for (let k = 0; k < n; k++) {
          let best = Infinity;
          for (const p of parts) if (p.dTo[k] < best) best = p.dTo[k];
          to += best;
        }
        let back = 0, len = 0, count = 0;
        for (const p of parts) { back += p.back; len += p.len; count += p.count; }
        return to / n + back / len + penalty(count);
      };

      const results = [];
      const keep = r => {
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
        const tp = t ? [mTone[t]] : [];
        const toneText = t ? chr(TONES[t]) : "";
        SHAPES.forEach((s, i) => {
          // a letter alone (the plain shape, or its marked form: the shape and the marking stroke)
          for (let m = 0; m <= 6; m++) {
            if (!mAlone[i][0] || (m && !mAlone[i][m])) continue;
            const parts = m ? [mAlone[i][0], mAlone[i][m], ...tp] : [mAlone[i][0], ...tp];
            keep({ score: score(parts), text: chr(7 * i + m) + toneText, code: s + (m || "") + (t ? " " + t : ""),
                   parts: (m ? [alone[i][0], alone[i][m]] : [alone[i][0]]).concat(t ? [tone[t]] : []) });
          }
        });
        // joined cells: first onset, rhyme and tone without the marking stroke, then the marking strokes for the best of these pairs only
        SHAPES.forEach((s, i) => {
          if (!mOnset[i]) return;
          SHAPES.forEach((r, j) => { if (mRhyme[j][0]) pairs.push({ i, j, t, tp, toneText, score: score([mOnset[i], mRhyme[j][0], ...tp]) }); });
        });
      }
      pairs.sort((a, b) => a.score - b.score).slice(0, PAIRS).forEach(({ i, j, t, tp, toneText }) => {
        for (let m = 0; m <= 6; m++) {
          if (m && !mRhyme[j][m]) continue;
          keep({ score: score([mOnset[i], mRhyme[j][0], ...(m ? [mRhyme[j][m]] : []), ...tp]),
                 text: chr(7 * i) + chr(JOINER - BASE) + chr(7 * j + m) + toneText, code: SHAPES[i] + "+" + SHAPES[j] + (m || "") + (t ? " " + t : ""),
                 parts: [onset[i], rhyme[j][0], ...(m ? [rhyme[j][m]] : []), ...(t ? [tone[t]] : [])] });
        }
      });
      return results;
    };
    return { recognize };
  };

  return { create, FRAME, strokesOf };
})();
if (typeof module !== "undefined") module.exports = QattInk;
