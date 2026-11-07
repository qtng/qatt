/*
PA text <-> Quốc Ngữ (see the specification in index.html). The syllable is split by VietnameseParser (js/parser.js), the rest is the table of PA.

  PaText.word("thuyền", parser, { stacked: true, ngang: false })   // Quốc Ngữ word -> PA text, or null if there is no PA for it
  PaText.read(text, parser)                                         // every PA syllable in a text -> Quốc Ngữ, the rest stays as it is
  PaText.convert(text, parser, opts)                                // every Quốc Ngữ word in a text -> PA, the rest stays as it is
  PaText.CELL, PaText.CELL_ANY                                      // the cells (what the font draws as one square) for the cursor and Backspace
  PaText.restack(text, parser, opts)                                // the same text with every syllable stacked or not

Needs js/parser.js (VietnameseParser). The code points are those of the specification (U+F00B0 joiner, U+F00B1 combiner, onsets from U+F00B2, ...).
*/
const PaText = (() => {
  const J = 0xF00B0, K = 0xF00B1, A0 = 0xF00B2, N0 = 0xF00C9, C0 = 0xF00DF, T0 = 0xF00E9;
  const ONSETS = 'Z B C CH DD D PH G GI H KH L M N NG NH R S T TH TR V X'.split(' ');
  const NUCLEI = 'A OW AW AA EE E I IEE OO O U UOO UW UWOW OA UOW OAW UAA UEE OE UY UYEE'.split(' ');
  const CODAS = 'U I M N NG NH P T C CH'.split(' ');
  const chr = c => String.fromCodePoint(c);

  // spelling of the onset (Quốc Ngữ -> PA name) and, the other way, the shape name that VietnameseParser.toQuocNgu takes
  const ONSET = { b: 'B', c: 'C', k: 'C', q: 'C', ch: 'CH', d: 'D', 'đ': 'DD', g: 'G', gh: 'G', gi: 'GI', h: 'H', kh: 'KH', l: 'L', m: 'M', n: 'N', ng: 'NG', ngh: 'NG',
    nh: 'NH', ph: 'PH', r: 'R', s: 'S', t: 'T', th: 'TH', tr: 'TR', v: 'V', x: 'X', f: 'PH', j: 'TR', w: 'V', z: 'D', '': 'Z' };
  const SHAPE = { Z: '_', B: 'b', C: 'c', CH: 'ch', DD: 'd', D: 'dz', PH: 'ph', G: 'g', GI: 'gi', H: 'h', KH: 'kh', L: 'l', M: 'm', N: 'n', NG: 'ng', NH: 'nh', R: 'r', S: 's', T: 't', TH: 'th', TR: 'tr', V: 'v', X: 'x' };
  // nucleus spellings (the glide and the vowel without the tone mark)
  const NUC = { a: 'A', 'ơ': 'OW', 'ă': 'AW', 'â': 'AA', 'ê': 'EE', e: 'E', i: 'I', y: 'I', 'iê': 'IEE', ia: 'IEE', 'yê': 'IEE', ya: 'IEE', 'ô': 'OO', o: 'O', u: 'U', 'uô': 'UOO', ua: 'UOO',
    'ư': 'UW', 'ươ': 'UWOW', 'ưa': 'UWOW', oa: 'OA', 'uơ': 'UOW', 'oă': 'OAW', 'uâ': 'UAA', 'uê': 'UEE', oe: 'OE', uy: 'UY', 'uyê': 'UYEE', uya: 'UYEE' };
  const QU = { 'ô': 'UAA', a: 'OA', 'ơ': 'UOW', 'ă': 'OAW', 'â': 'UAA', e: 'OE', 'ê': 'UEE', i: 'UY', y: 'UY', 'yê': 'UYEE', 'iê': 'UYEE', ya: 'UYEE', ia: 'UYEE' };
  const CODA = { m: 'M', n: 'N', ng: 'NG', nh: 'NH', p: 'P', t: 'T', c: 'C', ch: 'CH', i: 'I', y: 'I', o: 'U', u: 'U' };
  const TONE = { sac: 1, huyen: 2, hoi: 3, nga: 4, nang: 5 };
  const SPELL = { A: 'a', OW: 'ơ', AW: 'ă', AA: 'â', EE: 'ê', E: 'e', I: 'i', IEE: 'iê', OO: 'ô', O: 'o', U: 'u', UOO: 'uô', UW: 'ư', UWOW: 'ươ', OA: 'oa', UOW: 'uơ', OAW: 'oă', UAA: 'uâ', UEE: 'uê', OE: 'oe', UY: 'uy', UYEE: 'uyê' };
  const CODA_SPELL = { M: 'm', N: 'n', NG: 'ng', NH: 'nh', P: 'p', T: 't', C: 'c', CH: 'ch' };
  const noTone = s => s.normalize('NFD').replace(/[̣̀́̃̉]/g, '').normalize('NFC');

  const encode = (s, stacked, ngang) => {
    let out = chr(A0 + ONSETS.indexOf(s.onset)) + chr(J) + chr(N0 + NUCLEI.indexOf(s.nucleus));
    const tone = s.tone || (ngang ? 6 : 0);
    if (stacked && (s.coda || tone)) out += chr(K);
    if (s.coda) out += chr(C0 + CODAS.indexOf(s.coda));
    if (tone) out += chr(T0 + tone - 1);
    return out;
  };

  const word = (w, parser, opt = {}) => {
    const p = parser.parse(w);
    if (!p) return null;
    const onset = ONSET[p.onset];
    if (!onset) return null;
    const vowel = noTone(p.vowel), glide = p.glide || '';
    const nucleus = p.onset === 'q' && glide === 'u' ? QU[vowel] : NUC[glide + vowel];
    const coda = p.coda ? CODA[p.coda] : null;
    if (!nucleus || (p.coda && !coda)) return null;
    return encode({ onset, nucleus, coda, tone: TONE[p.tone] || 0 }, opt.stacked !== false, !!opt.ngang);
  };

  // a syllable of PA text: the stem, then a coda (with or without the combiner), a tone alone, or the combiner and a tone alone
  const SYL = /([\u{F00B2}-\u{F00C8}])\u{F00B0}([\u{F00C9}-\u{F00DE}])(?:\u{F00B1}?([\u{F00DF}-\u{F00E8}])([\u{F00E9}-\u{F00EE}])?|\u{F00B1}?([\u{F00E9}-\u{F00EE}]))?/gu;
  const readMatch = (m, parser) => {
    const on = ONSETS[m[1].codePointAt(0) - A0], nu = NUCLEI[m[2].codePointAt(0) - N0];
    const co = m[3] ? CODAS[m[3].codePointAt(0) - C0] : null;
    const t = m[4] || m[5];
    const tone = t ? t.codePointAt(0) - T0 + 1 : 0;
    let rhyme = SPELL[nu];
    if (co === 'U') rhyme = (nu === 'A' || nu === 'E' || nu === 'OA' || nu === 'OE') ? rhyme + 'o' : rhyme + 'u';
    else if (co === 'I') rhyme += (nu === 'AW' || nu === 'AA') ? 'y' : 'i';
    else if (co) {
      if (nu === 'AW' && (co === 'NH' || co === 'CH')) rhyme = 'a';   // the short a before nh, ch is written a
      rhyme += CODA_SPELL[co];
    }
    if ((co === 'U' || co === 'I') && nu === 'AW') rhyme = 'a' + rhyme.slice(1);   // ay, au: the short a is written a
    if (on === 'Z' && nu === 'IEE') rhyme = 'yê' + rhyme.slice(2);   // yêu, yên: no onset
    let s = parser.toQuocNgu({ onset: SHAPE[on], rhyme: 'x', hop: rhyme, tone: tone === 6 ? 0 : tone });
    if (s && on === 'GI') s = s.replace(/^gi(?=[iíìỉĩị])/, 'g');
    return s;
  };
  // PA cells stand without spaces between them (and no space is typed between a cell and the letters next to it), so a reading gets a space where it touches
  // another syllable or a letter
  const read = (text, parser) => {
    let last = -1;
    return text.replace(SYL, (...a) => {
      const m = a.slice(0, 6), at = a[a.length - 2], str = a[a.length - 1];
      const r = readMatch(m, parser) ?? m[0];
      const end = at + m[0].length;
      const out = (at === last || (at > 0 && /\p{L}/u.test(str[at - 1])) ? ' ' : '') + r + (/^\p{L}/u.test(str.slice(end)) ? ' ' : '');
      last = end;
      return out;
    });
  };
  const convert = (text, parser, opt) => text.replace(/[\p{Script=Latin}\p{M}]+/gu, w => word(w, parser, opt) ?? w).replace(/([\u{F00B2}-\u{F00EE}]) (?=[\u{F00B2}-\u{F00EE}])/gu, '$1');
  const restack = (text, parser, opt) => convert(read(text, parser), parser, opt);

  // the cells: a stem alone, with a tone mark, or stacked with a coda (and a tone); a nucleus, a coda with its tone, a tone: each alone
  const CELL = /[\u{F00B2}-\u{F00C8}](?:\u{F00B0}[\u{F00C9}-\u{F00DE}](?:\u{F00B1}(?:[\u{F00DF}-\u{F00E8}][\u{F00E9}-\u{F00EE}]?|[\u{F00E9}-\u{F00EE}])|[\u{F00E9}-\u{F00EE}])?)?|[\u{F00C9}-\u{F00DE}]|[\u{F00DF}-\u{F00E8}][\u{F00E9}-\u{F00EE}]?|[\u{F00E9}-\u{F00EE}]/gu;
  const CELL_ANY = new RegExp(CELL.source + '|[\\u{F00B0}\\u{F00B1}]|[^]', 'gu');
  return { word, read, convert, restack, CELL, CELL_ANY, SYL, J, K, A0 };
})();
if (typeof module !== 'undefined') module.exports = PaText;
