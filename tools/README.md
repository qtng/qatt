# Tools

## Reference font (`font/`)

The font is built from the strokes that `qatt.js` draws, in two steps. Both outputs are checked in, so the font only has
to be rebuilt when `qatt.js`, the character data or the font design changes.

```
unicode.html + qatt.js  --extract_glyphs.js-->  font/glyphs.json  --build_font.py-->  font/qatt-prototype.ttf / .woff2
```

### 1. Extract the glyph paths: `extract_glyphs.js`

Reads the stroke paths of all 164 characters from the rendered `unicode.html` (which draws them with `qatt.js`), including
the smaller combining form of the tone marks, and writes `font/glyphs.json`.

Needs Node.js with [Playwright](https://playwright.dev) and a Chromium. Serve the repository first:

```sh
python3 -m http.server 8790 &                      # in the root of the repository
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM=/path/to/chromium \
  node tools/extract_glyphs.js http://localhost:8790/unicode.html font/glyphs.json
```

`PLAYWRIGHT_MODULE` and `CHROMIUM` are only needed if Playwright is not installed locally or Chromium is not found by
Playwright. Only requests to the local server are allowed (no CDN), the paths do not depend on Bootstrap.

### 2. Build the font: `build_font.py`

Turns the (open) stroke paths into outlines (round caps and joins, `skia-pathops`), fits them into the monospace cell and
writes TrueType and WOFF2 with the OpenType rules for the combining characters.

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install -r tools/requirements.txt
python3 tools/build_font.py font/glyphs.json font/qatt-prototype      # writes .ttf and .woff2
```

Then raise the cache version of the font files in `font.html` (`?v=…`).

**Light variant.** `--light` makes all strokes thinner (`LIGHT` times the stroke widths):

```sh
python3 tools/build_font.py --light font/glyphs.json font/qatt-prototype-light   # family "QATT Prototype Light"
```

**Brush variant.** With the export of `brush.html` (`font/brush.json`) as a third argument, the glyphs get its brush
instead of stroked centre lines. `tools/brush_outlines.js` (Node.js, uses `js/brush.js` and `js/brush-model.js` like the
editor) lays the brush on the centre lines after they are squeezed and moved into place, so the half-width and stacked
variants keep their stroke widths; the stroke width constants only scale the brush weight per variant:

```sh
python3 tools/build_font.py font/glyphs.json font/qatt-brush font/brush.json     # writes font/qatt-brush.ttf / .woff2
```

**Design constants** at the top of `build_font.py`: glyph size (`SY`, `GROW`), position (`Y0`), stroke widths
(`STROKE`, `STROKE_TONE`, `STROKE_HALF`, `STROKE_MARK`, `STROKE_UP`, `STROKE_LOW`), the share of the upper glyph of a
Tham Thư (`STACK_UP`, `STACK_UP_X`) and the extent of a joined pair (`PAIR_X0`, `PAIR_X1`).

**What the font does** (OpenType `ccmp`, in `build_font.py`):

- *A* `U+F009B` *B* (component joiner): one cell like a syllable of `qatt.js`, the joiner has no width; *A* becomes its
  onset form in the left half (`.left`, a mark of *A* moved from the rhyme form onto the onset form), *B* its rhyme form in
  the right half (`.right`).
- *A* `U+F009A` *B* (Tham Thư combiner): *A* (a single form or a joined pair) goes into the lower 55 %, *B* into the upper
  45 % of the cell; the combiner has no width.
- A tone mark after any character becomes a zero-width variant (the small form of `qatt.js`) that lies over the preceding cell.
- Standalone, the combiner and the joiner are a small square, a tone is the large form.

The code points are `U+F0000` plus the offset in the proposal (`BASE` in `build_font.py`). The offsets come from the data
in `unicode.html`.

**Check the rules without a browser** (`pip install uharfbuzz`):

```python
import uharfbuzz as hb
font = hb.Font(hb.Face(hb.Blob.from_file_path('font/qatt-prototype.ttf')))
buf = hb.Buffer(); buf.add_str('\U000F0016\U000F009B\U000F0000'); buf.guess_segment_properties(); hb.shape(font, buf)
print([(font.glyph_to_string(i.codepoint), p.x_advance) for i, p in zip(buf.glyph_infos, buf.glyph_positions)])
# [('uF0016.left', 500), ('uF009B.zw', 0), ('uF0000.right', 500)]
```

## Character data (`unicode.html`): `update_unicode_data.py`

Refreshes the character data embedded in `unicode.html` from a checkout of
[qtng/qatt-unicode](https://github.com/qtng/qatt-unicode) (read only, `ucd/` and `tools/make_ucd.py`):

```sh
python3 tools/update_unicode_data.py PATH/TO/qatt-unicode            # unicode.html in this repository
```

If the data changes (new characters or offsets), run the font steps above again.

## KAGE prototype

`font-editor.html` draws the QATT symbols with the [KAGE engine](https://github.com/kurgm/kage-engine) (`js/kage-engine.min.js`, GPL-3.0, see `js/kage-engine.COPYING`)
next to the brush outlines. `font/kage.json` holds the KAGE data (one line per stroke and mark); `node tools/kage_seed.js --force` regenerates it from the
standard stroke library of the brush editor (this overwrites hand edits). Edits in `font-editor.html` live in the browser (`localStorage` `qatt-kage-v1`) and can be exported as JSON.

**KAGE font.** With `--kage font/kage.json` the letters are drawn by the KAGE engine (`tools/kage_outlines.js` loads
`js/kage-engine.min.js` in Node.js) from the KAGE data refined in `font-editor.html`; the lines are squeezed and moved first, so the half-width and stacked variants keep
their stroke widths. The tones stay stroked circles. `--gothic` selects the Gothic style (family "QATT Gothic", `font/qatt-gothic`), the default is Mincho:

```sh
python3 tools/build_font.py --kage font/kage.json font/glyphs.json font/qatt-mincho     # writes font/qatt-mincho.ttf / .woff2
```

**Left and right forms.** The halves of a joined pair are made from the single form (`v2c-X` in `font/kage.json`). A symbol that has to look
different on the left or on the right gets its own form: `v2l-X` (left half) and/or `v2r-X` (right half) in `kage.json`, with the marks in the same
order as the single form; `font-editor.html` offers them as "Left (optional)" and "Right (optional)" (without data they show the single form; edit it to make
one); "Use the single form" removes an own form again (also one that `kage.json` ships). The stack (Tham Thư) takes its lower pair from the same left and right forms. `kage_seed.js` starts ong, dong, hong and bong with a left form whose lowest horizontal stroke is sloped up to its right end.

**Gothic heavy.** `--heavy` (with `--kage --gothic`) draws strokes 1.7 times as heavy as the standard Gothic (the glyph editor slider allows up to 2.4 times, which closes the gaps of dense glyphs; tones and marks get 1.5 times) and names the family "QATT Gothic Heavy":

```sh
python3 tools/build_font.py --kage font/kage.json --gothic --heavy font/glyphs.json font/qatt-gothic-heavy
```
