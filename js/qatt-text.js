/*
QATT code -> text for the QATT fonts (code points from U+F0000, see unicode.html and font.html)

  QattText.syllable("t,c5,,5")   // code of VietnameseParser.parse(...).qatt -> onset U+F009B rhyme tone, one cell
  QattText.syllable("v,v2,,0", true) // code of VietnameseParser.parse(...).tham (Tham Thư) -> onset U+F009A rhyme tone
  QattText.word("tự", parser)    // Quốc Ngữ word -> text, or null if there is no glyph for it
  QattText.convert(text, parser) // every Quốc Ngữ word in a text, the rest stays as it is
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
  // stack (Tham Thư): the onset below, the rhyme above (U+F009A instead of the joiner)
  const syllable = (code, stack) => {
    const [onset, rhyme, , tone] = code.split(",");
    const m = /^(_|[a-z]+?)([1-6]?)$/.exec(rhyme || "");
    if (!m) return null;
    const on = letter(onset || "_"), rh = letter(m[1], +m[2]);
    if (!on || !rh) return null;
    const t = TONES[+tone || 0];
    return on + chr((stack ? COMBINER : JOINER) - BASE) + rh + (t ? chr(t) : "");
  };

  const word = (w, parser) => {
    const parsed = parser.parse(w);
    if (!parsed) return null;
    return parsed.qatt ? syllable(parsed.qatt) : parsed.tham ? syllable(parsed.tham, true) : null;
  };

  const WORD = /[\p{L}\p{M}]+/gu;
  const convert = (text, parser) => text.replace(WORD, w => word(w, parser) ?? w);

  return { syllable, word, convert, WORD };
})();
if (typeof module !== "undefined") module.exports = QattText;
