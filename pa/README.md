# PA script (side project)

`index.html` is the page https://qatt.org/pa/ (not in the menu): a guide to the PA script, built from the archived old page of `qtng/pages` (`docs/pa/`, `docs/pa-editor/`), and below it the specification. The two chart images are linked from `chunom.org/pages/pa/`. English; the headings have `data-vi`.

The specification covers the grammar (stem = onset + nucleus, extension = coda + tone | tone), the 61 characters and their names (`PA ONSET B`, `PA VOWEL AW`, …) in `U+F00B0..U+F00EE`, directly behind the QATT range, the own joiner and combiner (`U+F00B0`, `U+F00B1`), the stacked cell, the reading of Quốc Ngữ and the conversion from the earlier font `pa.ttf`. The PA font is a file of its own; only the code points are kept compatible with QATT, so a font for both could be built later.

`test.html` (noindex) is a test page for the draft font: it converts typed Quốc Ngữ to PA, stacked or not. The font (`fonts/pa.woff2` in `qtng/cdn`, only the woff2 while it changes) is not used on `index.html` yet (the glyphs of the tables are not drawn). The font build is in the private repository `qtng/chunom-private`.
