/*
QATT code -> text for the QATT fonts (code points from U+F0000, see unicode.html and font.html)

  QattText.syllable("t,c5,,5")   // code of VietnameseParser.parse(...).qatt -> onset U+F009B rhyme tone, one cell
  QattText.syllable("v,,,0")     // no rhyme (Hợp Thư ông): the shape alone
  QattText.syllable("v2,v,,0")   // code of VietnameseParser.parse(...).hop (Hợp Thư): marked shape U+F009B plain shape
  QattText.word("tự", parser)    // Quốc Ngữ word -> text, or null if there is no glyph for it
  QattText.cells(text)           // the cells of QATT text: [{ cell, index }] (QattText.CELL is the pattern, CELL_ANY also matches every other character)
  QattText.decode(cell)          // a cell as { onset, rhyme, tone, hop } (the reverse of syllable)
  QattText.reading(cell, parser) // the Quốc Ngữ reading of a cell after the decoding of the parser ("?" if there is none)
  QattText.readings(text)        // { cell: reading } for all cells of a text
  QattText.convert(text, parser) // every Quốc Ngữ word in a text, the rest stays as it is
  QattText.repairDeletion(before, after, caret) // a deletion that cut a cell in two (a keyboard that deletes one character) becomes the deletion of the whole cell: { value, caret } or null
  QattText.recode(text, from, to) // every cell by its reading after the decoding of parser `from` written again after the decoding of parser `to`; all other text stays
*/
const QattText = (() => {
  const BASE = 0xF0000, JOINER = BASE + 155, COMBINER = BASE + 154;
  const SHAPES = "_ ng h g c l tr d n t th nh ch dz x kh s r m b v ph".split(" ");   // U+F0000 to U+F0015; with marking stroke n (1..6): U+F0016 + 6 * shape + n - 1
  const TONES = [null, 160, 157, 158, 159, 161, 162, 163, 156];                      // tone 1..8 -> offset of the tone mark
  const chr = o => String.fromCodePoint(BASE + o);

  const letter = (shape, mark) => {
    const i = SHAPES.indexOf(shape);
    return i < 0 ? null : chr(mark ? 22 + 6 * i + mark - 1 : i);
  };

  // "onset,rhyme,,tone", e.g. "t,c5,,5": the rhyme is a shape and a marking stroke (none: the plain shape)
  const split = part => {
    const m = /^(_|[a-z]+?)([1-6]?)$/.exec(part || "_");
    return m && letter(m[1], +m[2]);
  };
  // the onset may carry a marking stroke too (Hợp Thư: "v2,v,,0")
  const syllable = code => {
    const [onset, rhyme, , tone] = code.split(",");
    const on = split(onset), rh = rhyme === "" ? "" : split(rhyme);   // no rhyme: the shape alone (Hợp Thư ông)
    if (!on || rh === null) return null;
    const t = TONES[+tone || 0];
    // onset and rhyme of the same shape (mô = m + m2): the marked shape alone is the whole syllable (also the shape without strokes: _ + _2)
    const sameShape = rhyme && /^\D+[2-6]$/.test(rhyme) && !/\d/.test(onset) && rhyme.replace(/\d$/, "") === onset;
    if (sameShape) return rh + (t ? chr(t) : "");
    return on + (rh ? chr(JOINER - BASE) + rh : "") + (t ? chr(t) : "");
  };

  const word = (w, parser) => {
    const parsed = parser.parse(w);
    if (!parsed) return null;
    const code = parsed.qatt || parsed.hop;
    return code ? syllable(code) : null;
  };

  // the cells of QATT text: a letter of the block, joined or stacked letters, the tone marks after them (what the font draws as one square)
  const CELL = /[\u{F0000}-\u{F0099}](?:[\u{F009A}\u{F009B}][\u{F0000}-\u{F0099}])*[\u{F009C}-\u{F00A3}]*/gu;

  // every character is part of some cell: the cells above, a lone joiner, combiner or tone mark, any other character on its own (cursor and Backspace of the writer)
  const CELL_ANY = new RegExp(CELL.source + "|[\\u{F009A}-\\u{F00A3}]+|[^]", "gu");

  // the cells of QATT text in the order they occur: [{ cell, index }]
  const cells = text => Array.from(text.matchAll(CELL), m => ({ cell: m[0], index: m.index }));

  // A cell of QATT text as the parts of the syllable (the reverse of syllable): { onset, rhyme, tone, hop } or null (a cell that is no syllable,
  // e.g. a stack with the combiner). onset: shape of the onset, rhyme: code of the rhyme glyph ("" none), hop: "ong" "ung" "uông" for Hợp Thư.
  const decode = cell => {
    const cps = Array.from(cell, c => c.codePointAt(0) - BASE);
    const glyph = o => {
      if (o < 22) return { shape: SHAPES[o], mark: 0 };
      if (o < 154) return { shape: SHAPES[Math.floor((o - 22) / 6)], mark: (o - 22) % 6 + 1 };
      return null;
    };
    const first = glyph(cps[0]);
    if (!first) return null;
    let i = 1, second = null, joined = false;
    if (cps[1] === JOINER - BASE) { second = glyph(cps[2]); if (!second) return null; joined = true; i = 3; }
    else if (cps[1] === COMBINER - BASE) return null;
    let tone = 0;
    for (; i < cps.length; i++) { const t = TONES.indexOf(cps[i]); if (t < 0) return null; tone = t; }
    const code = g => g.shape + (g.mark || "");
    if (!joined) return first.mark ? { onset: first.shape, rhyme: code(first), tone } : { onset: first.shape, rhyme: "", tone };   // m2 alone is m + m2, a plain shape alone is ông
    if (first.mark && !second.mark && first.shape === second.shape) return { onset: first.shape, rhyme: "", tone, hop: { 2: "ong", 3: "ung", 4: "uông" }[first.mark] };
    if (first.mark) return null;
    return { onset: first.shape, rhyme: code(second), tone };
  };

  // The Quốc Ngữ reading of a cell with the tables of the parser's decoding (parser.toQuocNgu), "?" if there is none.
  const reading = (cell, parser) => {
    const parts = parser && decode(cell);
    return (parts && parser.toQuocNgu(parts)) || "?";
  };

  // the readings of all cells of a text: { cell: reading } (every cell once)
  const readings = (text, parser) => Object.fromEntries(cells(text).map(c => [c.cell, reading(c.cell, parser)]));

  const WORD = /[\p{L}\p{M}]+/gu;
  const convert = (text, parser) => text.replace(WORD, w => word(w, parser) ?? w);

  // every cell is read after one decoding and written again after another one: only the QATT cells change (a cell without a reading or a glyph in `to` stays)
  const recode = (text, from, to) => text.replace(CELL, cell => {
    const read = reading(cell, from);
    return (read !== "?" && word(read, to)) || cell;
  });

  // The text before and after an edit that only deleted characters, the caret after it (where the deleted part was): when the deletion cut into a cell,
  // the whole cell goes (the writers do this for Backspace and Delete themselves, this catches keyboards that bypass them).
  const repairDeletion = (before, after, caret) => {
    const length = before.length - after.length;
    if (length <= 0 || caret < 0 || caret + length > before.length || before.slice(0, caret) + before.slice(caret + length) !== after) return null;
    let start = caret, end = caret + length;
    for (const m of before.matchAll(CELL_ANY)) {
      const a = m.index, z = a + m[0].length;
      if (a < caret && caret < z) start = a;
      if (a < caret + length && caret + length < z) end = z;
    }
    return start === caret && end === caret + length ? null : { value: before.slice(0, start) + before.slice(end), caret: start };
  };

  return { syllable, word, convert, recode, repairDeletion, cells, decode, reading, readings, WORD, CELL, CELL_ANY };
})();
if (typeof module !== "undefined") module.exports = QattText;
