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

**Design constants** at the top of `build_font.py`: glyph size (`SY`, `GROW`), position (`Y0`), stroke widths
(`STROKE`, `STROKE_TONE`, `STROKE_HALF`, `STROKE_MARK`, `STROKE_UP`, `STROKE_LOW`), the share of the upper glyph of a
Tham Thư (`STACK_UP`, `STACK_UP_X`) and the squeeze of the joiner halves (`HALF_X`).

**What the font does** (OpenType `ccmp`, in `build_font.py`):

- *A* `U+F009B` *B* (component joiner): both become half-width variants, the joiner has no width; one cell, *A* left, *B* right.
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
# [('uF0016.half', 500), ('uF009B.zw', 0), ('uF0000.half', 500)]
```

## Character data (`unicode.html`): `update_unicode_data.py`

Refreshes the character data embedded in `unicode.html` from a checkout of
[qtng/qatt-unicode](https://github.com/qtng/qatt-unicode) (read only, `ucd/` and `tools/make_ucd.py`):

```sh
python3 tools/update_unicode_data.py PATH/TO/qatt-unicode            # unicode.html in this repository
```

If the data changes (new characters or offsets), run the font steps above again.
