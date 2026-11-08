/* ids-render.js: draws any IDS sequence (Ideographic Description Sequence) as a balanced glyph.
   The size of every part in its role (median of real characters) and its density come from https://cdn.qatt.org/ids/ (built from the
   GlyphWiki data, glyphwiki.org, free licence); drawn with KAGE (js/kage-engine.min.js, loaded when needed).
   Generated file: do not edit (the source is kept elsewhere).
   Use: IdsRender.draw("⿰氵工").then(function (r) { element.innerHTML = r.svg; });  r.missing > 0: some part has no data. */
// IDS parsing, shared by the build (Node) and the browser library (copied to qtng/qatt js/ids-render.js).
// A node is { op, args } or { ch } (a code point as a string; `{12}` and other unknown parts are { ch: '{12}', unknown: true }).
(function (root) {
  'use strict';
  var ARITY = { '⿰': 2, '⿱': 2, '⿲': 3, '⿳': 3, '⿴': 2, '⿵': 2, '⿶': 2, '⿷': 2, '⿸': 2, '⿹': 2, '⿺': 2, '⿻': 2,
    '⿼': 2, '⿽': 2, '⿾': 1, '⿿': 1, '㇯': 2 };

  function tokens(s) {
    var out = [], chars = Array.from(s);
    for (var i = 0; i < chars.length; i++) {
      if (chars[i] === '{') { var j = chars.indexOf('}', i); if (j < 0) return null; out.push(chars.slice(i, j + 1).join('')); i = j; }
      else out.push(chars[i]);
    }
    return out;
  }
  function parse(s) {
    var t = tokens(s); if (!t) return null;
    var i = 0;
    function node() {
      var c = t[i++];
      if (c === undefined) throw 0;
      if (c === '〾') return node();   // variation indicator: draw the part as it is
      if (ARITY[c]) { var args = []; for (var n = 0; n < ARITY[c]; n++) args.push(node()); return { op: c, args: args }; }
      if (c.length > 2 || c === '？' || c === '?') return { ch: c, unknown: true };
      return { ch: c };
    }
    try { var r = node(); return i === t.length ? r : null; } catch (e) { return null; }
  }
  function str(n) { return n.ch !== undefined ? n.ch : n.op + n.args.map(str).join(''); }
  function leaves(n, out) { out = out || []; if (n.ch !== undefined) out.push(n); else n.args.forEach(function (a) { leaves(a, out); }); return out; }

  // the key of a subtree for the lookup of the character it describes: the IDS with every part replaced by its canonical code point (⺡ -> 氵)
  function key(n, canon) {
    if (n.ch !== undefined) return n.unknown ? n.ch : String.fromCodePoint(canon(n.ch.codePointAt(0)));
    return n.op + n.args.map(function (a) { return key(a, canon); }).join('');
  }
  var api = { ARITY: ARITY, parse: parse, str: str, leaves: leaves, key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IdsParse = api;
})(typeof self !== 'undefined' ? self : this);

// Layout of an IDS tree: the same code runs in the build (evaluation) and in the browser (js/ids-render.js of qtng/qatt).
// P (the data provider) gives:
//   P.char(cp)        { d, b, h, v } the glyph of the code point alone (flattened KAGE data, ink box, layers), or null
//   P.role(cp, role)  [x1, y1, x2, y2, n, glyph] the median box of the part in that role (relative to the parent's ink box), or null
//   P.glyph(name)     { d, b } a glyph used for a role, or null
//   P.pair(cp, role, bucket) [x1, y1, x2, y2, n] the median box by the partner's layers (bucket 0–3), or null
//   P.inner(cp, op)   [x1, y1, x2, y2, n] where the enclosed part sits in this enclosing part, or null
//   P.op(role)        [x1, y1, x2, y2, n] all parts of a role;  P.feat(role) [v, h] their median layers
//   P.canon(cp)       the canonical code point (⺡ -> 氵)
//   P.struct(op, role) [x1, y1, x2, y2, n] parts built with the operator op in that role, or null
//   P.idsChar(key)    the code point of the character whose IDS (canonical parts, IdsParse.key) this is, or null (a part made of parts that is a character)
//   P.variant(cp, sfx) the name of the GlyphWiki variant uXXXX-<sfx> if it exists (and P.glyph has it), or null
//   P.dens(role, own, partner) [x1, y1, x2, y2, n] all parts of a role by their own layers and the partner's (buckets of 0.5), or null
//   P.root(op, cp)    [x1, y1, x2, y2, n] the ink box of whole characters of the operator (cp: of that first part), or null
// layout(tree, P, target, opt) -> KAGE data (plain strokes) of the composition, its ink in the box target [x1, y1, x2, y2] of the 200 frame.
(function (root) {
  'use strict';
  var H_OPS = { '⿰': 1, '⿲': 1 }, V_OPS = { '⿱': 1, '⿳': 1 }, ENCL = '⿴⿵⿶⿷⿸⿹⿺⿼⿽';
  var DEF = { nMin: 1, k0: 0.25, alpha: 0.5, useRoleGlyph: true, useDensity: true, mixDensity: 0, dHV: Infinity, dIn: Infinity, dOut: Infinity, beta: 0, sMin: 0.6, useVariant: true, wVar: 0.5, densVar: false, usePair: true, nPair: 1, kPair: 1, recognise: true, recRoot: true, useStruct: true, k0s: 20, gamma: 0, vRef: 3, hRef: 3, gapOp: 0.75, gapOpV: 1, remain: 0.75, kConf: 1, pairFine: 's', kFine: 5, useDens: 1, kDens: 5, densStruct: 0 };
  var SUFFIX = { '⿰0': ['01'], '⿰1': ['02'], '⿱0': ['03'], '⿱1': ['04'], '⿳0': ['03'], '⿳2': ['04'], '⿲0': ['01'], '⿲2': ['02'] };
  '⿴⿵⿶⿷⿸⿹⿺⿼⿽'.split('').forEach(function (op) { SUFFIX[op + '0'] = ['05', '10']; });

  function keyOf(node, P) { return node.ch !== undefined && !node.unknown ? P.canon(node.ch.codePointAt(0)) : null; }

  // layers of a node: [v, h] (v: vertical strokes side by side, h: horizontal strokes stacked)
  function feat(node, P) {
    if (node.ch !== undefined) { var c = node.unknown ? null : P.char(keyOf(node, P)); return c ? [c.v, c.h] : [2, 2]; }
    if (node._f) return node._f;
    var f = node.args.map(function (a) { return feat(a, P); }), sum = function (i) { return f.reduce(function (s, x) { return s + x[i]; }, 0); },
      max = function (i) { return Math.max.apply(null, f.map(function (x) { return x[i]; })); };
    var r = H_OPS[node.op] ? [sum(0), max(1)] : V_OPS[node.op] ? [max(0), sum(1)] : [max(0), max(1)];
    node._f = r; return r;
  }

  // the box of a child in its role (relative to the parent): measured median, mixed with the median of the role by the count, and the density
  var bucket = function (x) { return x <= 1.5 ? 0 : x <= 2.5 ? 1 : x <= 3.5 ? 2 : 3; };
  // finer splits of the partner (the same as FINE of tools/stats.mjs): l = layers in steps of 0.5, s = strokes (the default: +0.0014;
  // the coverage of the ink and the partner's own size were worse, see docs/PROGRESS.md)
  function strokes(node, P) {
    if (node.ch !== undefined) { var c = node.unknown ? null : P.char(keyOf(node, P)); return c && c.n ? c.n : 5; }
    return node.args.reduce(function (s, a) { return s + strokes(a, P); }, 0);
  }
  function first(a, x) { for (var i = 0; i < a.length; i++) if (x <= a[i]) return i; return a.length; }
  var FINE = {
    l: function (node, P, lay) { return Math.min(7, Math.floor(lay * 2)); },
    s: function (node, P) { return first([3, 5, 7, 9, 11, 14, 18], strokes(node, P)); }
  };
  function est(node, role, P, o, partner, sibs) {
    var g = P.op(role) || [0, 0, 1, 1, 0], k = keyOf(node, P), m = k != null ? P.role(k, role) : null;
    if (m && partner && o.usePair && P.pair) {   // the box of this part next to partners like this one
      var pf = feat(partner, P), lay = role[0] === '⿰' ? pf[0] : pf[1], pm = P.pair(k, role, bucket(lay));
      if (pm && pm[4] >= o.nPair) { var wp = pm[4] / (pm[4] + o.kPair); m = m.slice(); for (var q = 0; q < 4; q++) m[q] = m[q] * (1 - wp) + pm[q] * wp; }
      var fb = o.pairFine && FINE[o.pairFine] ? FINE[o.pairFine](partner, P, lay) : null, fm2 = fb != null ? P.pair(k, role, o.pairFine + fb) : null;
      if (fm2 && fm2[4] >= o.nPair) { var wf = fm2[4] / (fm2[4] + o.kFine); m = m.slice(); for (var q2 = 0; q2 < 4; q2++) m[q2] = m[q2] * (1 - wf) + fm2[q2] * wf; }
    }
    var box = g.slice(0, 4), measured = m && m[4] >= o.nMin, dn = null;
    if (!measured && o.useDens && P.dens && sibs && (H_OPS[role[0]] || V_OPS[role[0]])) {   // no measurement: parts of this density next to such partners
      var ax = H_OPS[role[0]] ? 0 : 1, own = feat(node, P)[ax], pl = 0, idx = +role.slice(1);
      sibs.forEach(function (sb, j) { if (j !== idx) pl += feat(sb, P)[ax]; });
      var db = function (x) { return Math.max(0, Math.min(9, Math.floor(x * 2))); };
      dn = P.dens(role, db(own), db(pl));
      if (dn && dn[4] >= o.kDens) { var wd = dn[4] / (dn[4] + o.kDens); box = box.map(function (v, i) { return v * (1 - wd) + dn[i] * wd; }); } else dn = null;
    }
    if (!measured && node.op && o.useStruct && P.struct && (!dn || o.densStruct)) {   // a part of parts: the size of parts of its structure in this role
      var st = P.struct(node.op, role);
      if (st && st[4] >= 3) { var ws = st[4] / (st[4] + o.k0s); box = box.map(function (v, i) { return v * (1 - ws) + st[i] * ws; }); }
    }
    if (measured) {
      var w = m[4] / (m[4] + o.k0);
      box = box.map(function (v, i) { return v * (1 - w) + m[i] * w; });
    }
    var op = role[0], vg = null;
    if (!measured && k != null && o.useVariant && P.variant && SUFFIX[role]) {   // a conventional variant of GlyphWiki: its glyph, and its place in the frame as a guess
      for (var si = 0; si < SUFFIX[role].length && !vg; si++) { var nm = P.variant(k, SUFFIX[role][si]); if (nm && P.glyph(nm)) vg = nm; }
      if (vg) {
        var vb = P.glyph(vg).b, rel = [(vb[0] - 12) / 176, (vb[1] - 13) / 176, (vb[2] - 12) / 176, (vb[3] - 13) / 176];
        box = box.map(function (v, i) { return v * (1 - o.wVar) + Math.max(0, Math.min(1, rel[i])) * o.wVar; });
      }
    }
    if (o.useDensity && !dn && (!measured || o.mixDensity) && (!vg || o.densVar) && (H_OPS[op] || V_OPS[op])) {
      var fm = P.feat(role), f = feat(node, P), H = !!H_OPS[op], i = H ? 0 : 1;
      if (fm && fm[i] > 0) {
        var fac = Math.pow(Math.max(0.5, f[i]) / fm[i], o.alpha);
        if (measured) fac = Math.pow(fac, o.mixDensity);
        var a = H ? 0 : 1, c = (box[a] + box[a + 2]) / 2, half = (box[a + 2] - box[a]) / 2 * fac;
        box[a] = c - half; box[a + 2] = c + half;
      }
    }
    // how sure the size is: measured in that role (by the count), else 0 (a guess from the role, the structure, the density)
    var conf = measured ? m[4] / (m[4] + o.kConf) : 0;
    return { box: box, glyph: measured && o.useRoleGlyph ? m[5] : vg, conf: conf };
  }

  // places the children of a row (H) or a column of parts: their extents along the axis from the estimated boxes, in order, scaled to fill
  // the overlap (or gap) between neighbours: as estimated from the two boxes (end of one - start of the next), mixed by gapOp with the
  // overlap of all parts of these roles (gen): the two medians come from different partners, so their difference alone makes big gaps
  // conf: how sure each extent is; with remain the parts that fill too much or too little are changed by how unsure they are
  // (a part measured in its role keeps its median size, a part without measurements takes the rest), else all in proportion
  function row(boxes, H, gen, o, conf) {
    var a = H ? 0 : 1, n = boxes.length, ext = boxes.map(function (b) { return Math.max(0.05, b[a + 2] - b[a]); });
    var ov = [], wg = o ? (H ? o.gapOp : o.gapOpV) : 0;
    for (var i = 0; i + 1 < n; i++) {
      var v = boxes[i][a + 2] - boxes[i + 1][a];
      if (wg && gen && gen[i] && gen[i + 1]) {   // the generic overlap, in units of the extents of the generic boxes, scaled to these parts
        var ge0 = gen[i][a + 2] - gen[i][a], ge1 = gen[i + 1][a + 2] - gen[i + 1][a], gv = gen[i][a + 2] - gen[i + 1][a];
        var g = gv / Math.max(0.05, (ge0 + ge1) / 2) * (ext[i] + ext[i + 1]) / 2;
        v = v * (1 - wg) + g * wg;
      }
      ov.push(Math.min(0.5 * Math.min(ext[i], ext[i + 1]), v));
    }
    var total = ext.reduce(function (s, x) { return s + x; }, 0) - ov.reduce(function (s, x) { return s + x; }, 0);
    if (o && o.remain && conf) {
      var wt = ext.map(function (e, k) { return e * (1.02 - o.remain * conf[k]); }), sw = wt.reduce(function (s, x) { return s + x; }, 0), d = 1 - total;
      ext = ext.map(function (e, k) { return Math.max(0.4 * e, e + d * wt[k] / sw); });
      total = ext.reduce(function (s, x) { return s + x; }, 0) - ov.reduce(function (s, x) { return s + x; }, 0);
    }
    var pos = 0, out = [];
    for (var j = 0; j < n; j++) {
      var b = boxes[j].slice(), s0 = pos / total, s1 = (pos + ext[j]) / total;
      b[a] = s0; b[a + 2] = s1; out.push(b);
      pos += ext[j] - (ov[j] || 0);
    }
    return out;
  }

  function mapBox(rel, T) { var w = T[2] - T[0], h = T[3] - T[1]; return [T[0] + rel[0] * w, T[1] + rel[1] * h, T[0] + rel[2] * w, T[1] + rel[3] * h]; }

  // KAGE data moved so that the ink box src lands on dst
  function place(data, src, dst, flipX, flipY) {
    var sx = (dst[2] - dst[0]) / Math.max(1, src[2] - src[0]), sy = (dst[3] - dst[1]) / Math.max(1, src[3] - src[1]);
    return data.split('$').map(function (l) {
      var f = l.split(':');
      for (var i = 3; i + 1 < f.length; i += 2) {
        var x = dst[0] + (+f[i] - src[0]) * sx, y = dst[1] + (+f[i + 1] - src[1]) * sy;
        if (flipX) x = dst[0] + dst[2] - x;
        if (flipY) y = dst[1] + dst[3] - y;
        f[i] = Math.round(x); f[i + 1] = Math.round(y);
      }
      return f.join(':');
    }).join('$');
  }

  // a part keeps its own aspect ratio up to a distortion of D: the box is shrunk around its centre where it is too wide or too tall
  function fit(b, T, D) {
    if (!(D < Infinity)) return T;
    var a = Math.max(1, b[2] - b[0]) / Math.max(1, b[3] - b[1]), w = T[2] - T[0], h = T[3] - T[1], cx = (T[0] + T[2]) / 2, cy = (T[1] + T[3]) / 2;
    if (w / h > a * D) { w = h * a * D; return [cx - w / 2, T[1], cx + w / 2, T[3]]; }
    if (w / h < a / D) { h = w / a * D; return [T[0], cy - h / 2, T[2], cy + h / 2]; }
    return T;
  }

  function draw(node, T, P, o, glyphName, out, D) {
    if (node.ch !== undefined) {
      var g = glyphName ? P.glyph(glyphName) : null, k = keyOf(node, P);
      if (!g) g = k != null ? P.char(k) : null;
      if (!g) { out.missing = (out.missing || 0) + 1; return; }
      out.push(place(g.d, g.b, fit(g.b, T, D), out.fx, out.fy));
      return;
    }
    var op = node.op, roles = node.args.map(function (a, i) { return op + i; });
    if (op === '⿾' || op === '⿿') {   // mirrored / turned: draw the part flipped
      var ofx = out.fx, ofy = out.fy; out.fx = !ofx; if (op === '⿿') out.fy = !ofy;
      draw(node.args[0], T, P, o, null, out); out.fx = ofx; out.fy = ofy; return;
    }
    if (op === '㇯') { draw(node.args[0], T, P, o, null, out); return; }   // subtraction: the first part (approximation)
    var e = node.args.map(function (a, i) { return est(a, roles[i], P, o, (op === '⿰' || op === '⿱') ? node.args[1 - i] : null, node.args); });
    var boxes = e.map(function (x) { return x.box; });
    var gen = roles.map(function (r) { return P.op(r); });
    var conf = e.map(function (x) { return x.conf; });
    if (H_OPS[op]) boxes = row(boxes, true, gen, o, conf);
    else if (V_OPS[op]) boxes = row(boxes, false, gen, o, conf);
    else if (ENCL.indexOf(op) >= 0) {
      var ko = keyOf(node.args[0], P), inn = ko != null ? P.inner(ko, op) : null;
      if (inn && inn[4] >= o.nMin) { var w = inn[4] / (inn[4] + o.k0); boxes[1] = boxes[1].map(function (v, i) { return v * (1 - w) + inn[i] * w; }); }
      boxes[0] = [0, 0, 1, 1];
      var fm = P.feat(op + '1');
      if (o.beta && fm) {   // a simple enclosed part does not fill the space: scaled by its layers against those of the role, about the centre
        var f = feat(node.args[1], P), s = Math.pow(Math.max(0.3, f[0]) / fm[0] * Math.max(0.3, f[1]) / fm[1], o.beta / 2);
        s = Math.max(o.sMin, Math.min(1, s));
        var b = boxes[1], cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, hw = (b[2] - b[0]) / 2 * s, hh = (b[3] - b[1]) / 2 * s;
        boxes[1] = [cx - hw, cy - hh, cx + hw, cy + hh];
      }
    }
    var enc = ENCL.indexOf(op) >= 0;
    node.args.forEach(function (a, i) { draw(a, mapBox(boxes[i], T), P, o, e[i].glyph, out, enc ? (i ? o.dIn : o.dOut) : o.dHV); });
  }

  // a part of the sequence that is a character of its own (⿱宀子 = 字) is drawn as that character: its measured sizes, role glyphs and real glyph
  function recognise(node, P, isRoot, o) {
    if (node.ch !== undefined) return node;
    if (o.recognise && P.idsChar && (!isRoot || o.recRoot)) {
      var cp = P.idsChar(o.key(node, P.canon));
      if (cp != null && P.char(P.canon(cp))) return { ch: String.fromCodePoint(cp), from: node };
    }
    return { op: node.op, args: node.args.map(function (a) { return recognise(a, P, false, o); }) };
  }

  function layout(tree, P, target, opt) {
    var o = {}, k; for (k in DEF) o[k] = DEF[k]; for (k in opt || {}) o[k] = opt[k];
    o.key = (typeof IdsParse !== 'undefined' ? IdsParse : (typeof require === 'function' ? require('./ids.cjs') : null)).key;
    tree = recognise(tree, P, true, o);
    if (tree.ch !== undefined) { var c = P.char(P.canon(tree.ch.codePointAt(0))); return { data: c ? c.d : '', missing: c ? 0 : 1 }; }
    var out = []; out.fx = false; out.fy = false;
    if (!target && tree.op && P.root) {   // the ink box of characters like this one: the first part's own, else the operator's
      var k0 = keyOf(tree.args[0], P), r = (k0 != null && P.root(tree.op, k0)) || P.root(tree.op);
      if (r && o.useRoot !== false) target = r.slice(0, 4);
    }
    target = target || [12, 13, 188, 189];
    if (o.gamma && tree.op) {   // a simple character (few layers) is not as wide / tall as the frame
      var f = feat(tree, P), sx = Math.min(1, Math.pow(Math.max(0.3, f[0]) / o.vRef, o.gamma)), sy = Math.min(1, Math.pow(Math.max(0.3, f[1]) / o.hRef, o.gamma));
      var cx = (target[0] + target[2]) / 2, cy = (target[1] + target[3]) / 2, hw = (target[2] - target[0]) / 2 * sx, hh = (target[3] - target[1]) / 2 * sy;
      target = [cx - hw, cy - hh, cx + hw, cy + hh];
    }
    draw(tree, target, P, o, null, out, Infinity);
    return { data: out.join('$'), missing: out.missing || 0 };
  }

  var api = { layout: layout, DEF: DEF };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.IdsLayout = api;
})(typeof self !== 'undefined' ? self : this);

// The browser part of js/ids-render.js (qtng/qatt): loads the slices of cdn.qatt.org/ids/, lays an IDS out with IdsLayout and draws it with KAGE.
//   IdsRender.draw(ids, { size: '1.3em', title }) -> Promise<{ svg, missing }>   (missing: parts without data; the caller may show the text then)
//   IdsRender.parse(ids) -> tree or null;  IdsRender.base: the address of the data
(function (root) {
  'use strict';
  var SCRIPT = document.currentScript && document.currentScript.src;
  var QATT = SCRIPT ? new URL('../', SCRIPT).href : 'https://qatt.org/';
  var BASE = 'https://cdn.qatt.org/ids/v1/';
  var meta = null, slices = {}, kagePromise = null;

  function json(url) { return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' ' + r.status); return r.json(); }); }
  function loadMeta() { return meta || (meta = json(BASE + 'meta.json')); }
  function loadSlice(k) { return slices[k] || (slices[k] = json(BASE + k.toString(16) + '.json').catch(function () { return {}; })); }
  function loadKage() {
    if (root.Kage) return Promise.resolve();
    return kagePromise || (kagePromise = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = QATT + 'js/kage-engine.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    }));
  }

  function provider(M, data) {
    var canon = function (cp) { var c = M.canon[cp]; return c != null ? c : cp; };
    var rec = function (cp) { var s = data[cp >> 8]; return s ? s[cp] || null : null; };
    var glyphs = function (name) {
      var m = /^u([0-9a-f]{4,6})/.exec(name); if (!m) return null;
      var s = data[parseInt(m[1], 16) >> 8], g = s && s['~g'][name];
      return g ? { d: g[0], b: g[1] } : null;
    };
    return {
      char: function (cp) { return rec(cp); }, glyph: glyphs, canon: canon,
      role: function (cp, role) { var r = rec(cp); return (r && r.r && r.r[role]) || null; },
      pair: function (cp, role, b) { var r = rec(cp); return (r && r.p && r.p[role + b]) || null; },
      inner: function (cp, op) { var r = rec(cp); return (r && r.i && r.i[op]) || null; },
      root: function (op, cp) { if (cp == null) return M.root[op] || null; var r = rec(cp); return (r && r.ro && r.ro[op]) || null; },
      struct: function (op, role) { return (M.struct && M.struct[op] && M.struct[op][role]) || null; },
      idsChar: function (key) {
        var first = Array.from(key).find(function (c) { return !root.IdsParse.ARITY[c]; }); if (!first) return null;
        var s = data[first.codePointAt(0) >> 8], i = s && s['~i'];
        return i && i[key] != null ? i[key] : null;
      },
      variant: function (cp, sfx) { var r = rec(cp); return (r && r.vr && r.vr[sfx]) || null; },
      dens: function (role, a, b) { return (M.dens && M.dens[role] && M.dens[role][a + '|' + b]) || null; },
      op: function (role) { return M.ops[role] || null; }, feat: function (role) { return M.feat[role] || null; }
    };
  }

  function svgOf(kageData, size, title) {
    var k = new root.Kage(); k.kShotai = k.kMincho;
    var p = new root.Kage.Polygons();
    k.makeGlyph2(p, kageData);
    var inner = p.generateSVG().replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="black"/g, 'fill="currentColor"');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" fill="currentColor"' +
      (title ? ' role="img" aria-label="' + title.replace(/"/g, '&quot;') + '"' : '') + '>' + inner + '</svg>';
  }

  function draw(ids, opt) {
    opt = opt || {};
    var tree = root.IdsParse.parse(ids);
    if (!tree) return Promise.reject(new Error('not an IDS: ' + ids));
    return Promise.all([loadMeta(), loadKage()]).then(function (r) {
      var M = r[0], keys = {};
      root.IdsParse.leaves(tree).forEach(function (l) {
        if (l.unknown) return;
        var cp = l.ch.codePointAt(0), c = M.canon[cp]; keys[cp >> 8] = 1; if (c != null) keys[c >> 8] = 1;
      });
      var data = {};
      var loadAll = function (ks) { var list = Object.keys(ks).map(Number).filter(function (k) { return !(k in data); });
        return Promise.all(list.map(loadSlice)).then(function (got) { list.forEach(function (k, i) { data[k] = got[i]; }); }); };
      return loadAll(keys).then(function () {   // the characters that parts of parts are (⿱宀子 = 字) need their own slices too
        var P0 = provider(M, data), more = {};
        (function walk(n) {
          if (n.ch !== undefined) return;
          var cp = P0.idsChar(root.IdsParse.key(n, P0.canon));
          if (cp != null) { more[cp >> 8] = 1; var c = M.canon[cp]; if (c != null) more[c >> 8] = 1; }
          n.args.forEach(walk);
        })(tree);
        return loadAll(more);
      }).then(function () {
        var P = provider(M, data), L;
        if (tree.ch !== undefined) {   // a single character: its own glyph
          var c = tree.unknown ? null : P.char(P.canon(tree.ch.codePointAt(0)));
          L = c ? { data: c.d, missing: 0 } : { data: '', missing: 1 };
        } else L = root.IdsLayout.layout(tree, P, null, opt.layout);
        return { svg: L.data ? svgOf(L.data, opt.size || '1.3em', opt.title === undefined ? ids : opt.title) : '', missing: L.missing, data: L.data };
      });
    });
  }

  root.IdsRender = { draw: draw, parse: function (s) { return root.IdsParse.parse(s); }, base: BASE };
})(typeof self !== 'undefined' ? self : this);
