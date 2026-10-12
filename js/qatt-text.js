/*
QATT code -> text for the QATT fonts (code points from U+F0000, see unicode.html and font.html)

  QattText.syllable("t,c5,,5")   // code of VietnameseParser.parse(...).qatt -> onset U+F009B rhyme tone, one cell
  QattText.syllable("v,,,0")     // no rhyme (Hợp Thư ông): the shape alone
  QattText.syllable("v2,v,,0")   // code of VietnameseParser.parse(...).hop (Hợp Thư): marked shape U+F009B plain shape
  QattText.word("tự", parser)    // Quốc Ngữ word -> text, or null if there is no glyph for it
  QattText.convert(text, parser) // every Quốc Ngữ word in a text, the rest stays as it is
*/
const QattText = (() => {
  const BASE = 0xF0000, JOINER = BASE + 155;
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
    return on + (rh ? chr(JOINER - BASE) + rh : "") + (t ? chr(t) : "");
  };

  const word = (w, parser) => {
    const parsed = parser.parse(w);
    if (!parsed) return null;
    const code = parsed.qatt || parsed.hop;
    return code ? syllable(code) : null;
  };

  const WORD = /[\p{L}\p{M}]+/gu;
  const convert = (text, parser) => text.replace(WORD, w => word(w, parser) ?? w);

  return { syllable, word, convert, WORD };
})();
if (typeof module !== "undefined") module.exports = QattText;
