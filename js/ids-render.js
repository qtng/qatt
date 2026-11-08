/* ids-render.js: draws any IDS sequence (Ideographic Description Sequence) as a balanced glyph.
   The layout comes from a web service of qatt.org; the glyphs are those of GlyphWiki (glyphwiki.org, free licence); drawn with KAGE
   (js/kage-engine.min.js, loaded when needed).
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

// The browser part of js/ids-render.js (qtng/qatt): asks the Edge Function ids_render for the layout of an IDS sequence (plain KAGE strokes;
// the method and the measurements stay on the server) and draws it with KAGE (js/kage-engine.min.js of qatt.org, loaded when needed).
//   IdsRender.draw(ids, { size: '1.3em', title, mix, wholeChar, onlyGlyphWiki }) -> Promise<{ svg, missing, data, fromGlyphWiki }>
//     missing: parts that nobody has (the caller may show the text then); fromGlyphWiki: parts read from GlyphWiki by the server
//   IdsRender.svg(data, size, title) -> the SVG of KAGE data (e.g. computed in advance, as the Bookshelf does);  IdsRender.parse(ids) -> tree or null
(function (root) {
  'use strict';
  var SCRIPT = document.currentScript && document.currentScript.src;
  var QATT = SCRIPT ? new URL('../', SCRIPT).href : 'https://qatt.org/';
  var FN = 'https://kfgqhhmdzboszpwsqkxt.supabase.co/functions/v1/ids_render';
  var asked = {}, kagePromise = null;
  function loadKage() {
    if (root.Kage) return Promise.resolve();
    return kagePromise || (kagePromise = new Promise(function (ok, fail) {
      var s = document.createElement('script'); s.src = QATT + 'js/kage-engine.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s);
    }));
  }
  function svgOf(kageData, size, title) {
    var k = new root.Kage(); k.kShotai = k.kMincho;
    var p = new root.Kage.Polygons();
    k.makeGlyph2(p, kageData);
    var inner = p.generateSVG().replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="black"/g, 'fill="currentColor"');
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" fill="currentColor"' +
      (title ? ' role="img" aria-label="' + title.replace(/"/g, '&quot;') + '"' : '') + '>' + inner + '</svg>';
  }
  function ask(ids, opt) {
    var q = '?ids=' + encodeURIComponent(ids);
    if (opt.mix != null) q += '&mix=' + opt.mix;   // options of the test page admin/ids.html
    if (opt.wholeChar === false) q += '&root=0';
    if (opt.onlyGlyphWiki) q += '&gw=only';
    return asked[q] || (asked[q] = fetch(FN + q).then(function (r) {
      return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || String(r.status)); return j; });
    }).catch(function (e) { delete asked[q]; throw e; }));
  }
  function draw(ids, opt) {
    opt = opt || {};
    if (!root.IdsParse.parse(ids)) return Promise.reject(new Error('not an IDS: ' + ids));
    return Promise.all([ask(ids, opt), loadKage()]).then(function (r) {
      var j = r[0], title = opt.title === undefined ? ids : opt.title;
      return { svg: j.data ? svgOf(j.data, opt.size || '1.3em', title) : '', missing: j.missing, data: j.data, fromGlyphWiki: j.fromGlyphWiki || 0 };
    });
  }
  root.IdsRender = {
    draw: draw, parse: function (s) { return root.IdsParse.parse(s); }, endpoint: FN,
    svg: function (data, size, title) { return svgOf(data, size || '1.3em', title); }
  };
})(typeof self !== 'undefined' ? self : this);
