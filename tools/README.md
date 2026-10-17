# Tools

## Reference font (`fonts/`)

**Licence.** The fonts and their glyph data are © 2026 qatt.org, all rights reserved (`fonts/LICENSE.txt`, also on `license.html`). `build_font.py` writes
copyright, licence, version, maker, full and PostScript name into the name table (`tools/font_names.py`); `python3 tools/font_names.py fonts/qatt-*.ttf`
gives fonts that are already built the same entries (and writes their `.woff2` again) without building them again.

The font is built from the strokes that `qatt.js` draws, in two steps. Both outputs are checked in, so the font only has
to be rebuilt when `qatt.js`, the character data or the font design changes.

```
unicode.html + qatt.js  --extract_glyphs.js-->  fonts/glyphs.json  --build_font.py-->  fonts/qatt-prototype.ttf / .woff2
```

### 1. Extract the glyph paths: `extract_glyphs.js`

Reads the stroke paths of all 164 characters from the rendered `unicode.html` (which draws them with `qatt.js`), including
the smaller combining form of the tone marks, and writes `fonts/glyphs.json`.

Needs Node.js with [Playwright](https://playwright.dev) and a Chromium. Serve the repository first:

```sh
python3 -m http.server 8790 &                      # in the root of the repository
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM=/path/to/chromium \
  node tools/extract_glyphs.js http://localhost:8790/unicode.html fonts/glyphs.json
```

`PLAYWRIGHT_MODULE` and `CHROMIUM` are only needed if Playwright is not installed locally or Chromium is not found by
Playwright. Only requests to the local server are allowed (no CDN), the paths do not depend on Bootstrap.

### Logo and icons: `make_logo.py`

`python3 tools/make_logo.py` draws the logo and the icons of qatt.org from the big symbol of the home page, the syllable "tân" (U+F003F U+F009B U+F003D) in QATT Khai: `img/logo.svg` (340 high on the red tile with the thin frame, the lines as bold as in the icon; used in the menu bar), `img/favicon.svg` (bigger and a little bolder, for 16 to 32 pixels) and `img/apple-touch-icon.png` (180 x 180, a full square: the phone rounds it). The outlines are shaped with HarfBuzz out of `fonts/qatt-khai.ttf` and written as paths, so the logo does not need the font. The PNG is rendered with Playwright for node (`NODE_PATH` to its `node_modules`, `--no-png` leaves it out).

### All fonts at once: `build_all.py`

`python3 tools/build_all.py` builds all 14 fonts (`fonts/qatt-*.ttf` and `.woff2`, with the name table and the vertical metrics) in about a minute; `--out DIR` builds into another folder, e.g. to compare with `fonts/` first, and words select fonts (`python3 tools/build_all.py serif pen`). The list in the script is the one place that has the call of every font. The Serif and Gothic files that were in `fonts/` before 2026-10-17 could not be built again (they came from a state of the data that is not in the repository), so all fonts were built anew.

### Size and baseline of the letters (compared with Han characters)

The letters of qatt.js alone fill y 70..740 of the 1000 em, common Han characters (WenQuanYi Zen Hei, Nom Na Tong, a Noto CJK has the ICF box -78..838) y -100..800. So `build_font.py` stretches all letters in y by `VS` = 1.4 around the font y `VC` = 577 before they are stroked (the stroke widths stay; the tones are not stretched, but moved in y only, by `TV` = 0.5 (`QATT_TV`) times what the stretch would move their middle (the upper ones up, the lower ones down; 1 moves them all the way, 0 not at all); in x they move away from the middle of their cell by `TH` (`QATT_TH`, now 0: no move) times the widening of the letters (`HS`), after the tones were kept `TONE_MARGIN` inside their cell; a negative `TH` moves them in (−0.5 about 60 units for a corner tone), a positive one out of the cell; environment variables `QATT_VS`, `QATT_VC` for tests): a cell is as high as a Han character and lies on the same baseline (check: the letters of a font next to 國音新字學喃 at one font size, top and bottom of the ink line up). `QATT_VS=1` gives the old, smaller size. The width is fitted the same way: a Han character is about 860 wide, a joined pair was 800 and a single letter only about 600. The single forms (and the stack) are stretched in x by `HS` = 1.3 (`QATT_HS`) around the middle of the cell, the margin of a pair to the cell edge `PAIR_M` is 60 instead of 100 (`QATT_PM`; the wide font keeps 100, its pairs are 1.25 cells wide). Brush and Prototype (not KAGE) get the same `HS` for their single forms; their pairs are drawn wider by the factor `QATT_PW` = 1.36 on `PAIR_K` (a pair of qatt.js is 63 units wide; as wide as a Han character it would be about 86).

### The build parameters are in the font

`build_font.py` writes them into the name table, name ID 10 (description), e.g. `Built 2026-10-17 with tools/build_font.py of the repository qtng/qatt, commit 4b054e7: style pen, weight 1.6, light 0, wide 1.0, VS 1.4, VC 577.0, HS 1.3, PAIR_M 60.0, PAIR_K 0.6364, TV 0.5, TH -0.5, SY 10.0, SX 10.0` (`+changes` after the commit: the tools had uncommitted changes when it was built). Read it with `python3 -c "from fontTools.ttLib import TTFont; print(TTFont('fonts/qatt-pen.ttf')['name'].getDebugName(10))"`. With the commit and these values the font can be built again (`build_all.py` has the call of each font; the parameters of the sizes are the defaults of `build_font.py` or `QATT_*` environment variables).

### 2. Build the font: `build_font.py`

Turns the (open) stroke paths into outlines (round caps and joins, `skia-pathops`), fits them into the monospace cell and
writes TrueType and WOFF2 with the OpenType rules for the combining characters.

```sh
python3 -m venv .venv && . .venv/bin/activate
pip install -r tools/requirements.txt
python3 tools/build_font.py fonts/glyphs.json fonts/qatt-prototype      # writes .ttf and .woff2
```


**Light variant.** `--light` makes all strokes thinner (`LIGHT` times the stroke widths):

```sh
python3 tools/build_font.py --light fonts/glyphs.json fonts/qatt-prototype-light   # family "QATT Prototype Light"
```

**Brush variant.** With the export of `admin/font/brush.html` (`fonts/brush.json`) as a third argument, the glyphs get its brush
instead of stroked centre lines; an export of `admin/font/brush2.html` (version 3, `js/brush2.js` and `js/brush2-model.js`) works the same way.
`tools/brush_outlines.js` (Node.js, uses `js/brush.js` and `js/brush-model.js` like the editor) lays the brush on the centre lines after they are squeezed and moved into place, so the half-width and stacked
variants keep their stroke widths; the stroke width constants only scale the brush weight per variant:

```sh
python3 tools/build_font.py fonts/glyphs.json fonts/qatt-brush fonts/brush.json     # writes fonts/qatt-brush.ttf / .woff2
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
- Standalone, the combiner is drawn as U+2FF1 (a frame with a line across, two boxes above each other) and the joiner as U+2FF0 (a frame with a line down the middle), both half a cell wide; a tone is the large form.

The code points are `U+F0000` plus the offset in the proposal (`BASE` in `build_font.py`). The offsets come from the data
in `unicode.html`.

**Check the rules without a browser** (`pip install uharfbuzz`):

```python
import uharfbuzz as hb
font = hb.Font(hb.Face(hb.Blob.from_file_path('fonts/qatt-khai.ttf')))
buf = hb.Buffer(); buf.add_str('\U000F0001\U000F009B\U000F0000'); buf.guess_segment_properties(); hb.shape(font, buf)
print([(font.glyph_to_string(i.codepoint), p.x_advance) for i, p in zip(buf.glyph_infos, buf.glyph_positions)])
# [('uF0001.left', 500), ('uF009B.zw', 0), ('uF0000.right', 500)]
```

## Character data (`unicode.html`): `update_unicode_data.py`

Refreshes the character data embedded in `unicode.html` from a checkout of
[qtng/qatt-unicode](https://github.com/qtng/qatt-unicode) (read only, `ucd/` and `tools/make_ucd.py`):

```sh
python3 tools/update_unicode_data.py PATH/TO/qatt-unicode            # unicode.html in this repository
```

If the data changes (new characters or offsets), run the font steps above again.

## KAGE prototype

`admin/font/font-editor.html` draws the QATT symbols with the [KAGE engine](https://github.com/kurgm/kage-engine) (`js/kage-engine.min.js`, GPL-3.0, see `js/kage-engine.COPYING`)
next to the brush outlines. `fonts/kage.json` holds the KAGE data (one line per stroke and mark); `node tools/kage_seed.js --force` regenerates it from the
standard stroke library of the brush editor (this overwrites hand edits). Edits in `admin/font/font-editor.html` live in the browser (`localStorage` `qatt-kage-v1`) and can be exported as JSON.

**KAGE font.** With `--kage fonts/kage.json` the letters are drawn by the KAGE engine (`tools/kage_outlines.js` loads
`js/kage-engine.min.js` in Node.js) from the KAGE data refined in `admin/font/font-editor.html`; the lines are squeezed and moved first, so the half-width and stacked variants keep
their stroke widths. The tones stay stroked circles (drawn narrower than the letters, `TONE_X` in `build_font.py`, so that they have the proportions of qatt.js). `--gothic` selects the Gothic style (family "QATT Khai", `fonts/qatt-gothic`), the default is Serif (the KAGE style "mincho"):

```sh
python3 tools/build_font.py --kage fonts/kage.json fonts/glyphs.json fonts/qatt-serif     # writes fonts/qatt-serif.ttf / .woff2
```

**Pen font.** `--kage fonts/kage.json --pen` draws the same KAGE lines as strokes of a felt-tip or ballpoint pen instead of with the KAGE engine
(`tools/pen_strokes.js`, called by `kage_outlines.js`): horizontals are bowed a little and have a slanted press at the start and a round bulge where they stop,
verticals a press and a round "dewdrop" end, falling curves have a press and keep their width (no taper). Where a stroke ends on another one (a junction) it has no press or bulge.

`--weight F` sets the stroke width (F times the standard) and `--label Name` is added to the family name:

```
python3 tools/build_font.py --kage fonts/kage.json --pen --weight 0.6 --label ExtraLight fonts/glyphs.json fonts/qatt-pen-extralight
python3 tools/build_font.py --kage fonts/kage.json --pen --weight 1.0 --label Light      fonts/glyphs.json fonts/qatt-pen-light
python3 tools/build_font.py --kage fonts/kage.json --pen --weight 1.6 fonts/glyphs.json fonts/qatt-pen                       # Regular
python3 tools/build_font.py --kage fonts/kage.json --pen --weight 2.4 --label Medium     fonts/glyphs.json fonts/qatt-pen-medium
```

**Vertical text** (`tools/font_vertical.py`, in all fonts). Without vertical metrics every glyph is 1 em high in vertical text, so the two halves of a syllable lie on top of each other, the joiner takes a whole em and so does a tone mark (a syllable 3 to 4 em high and 1 em wide). `font_vertical.py` gives a built font `vhea`/`vmtx` (1 em, origin at the ascent as in horizontal text) and a `vert` rule (GPOS) that gives the pieces of a syllable their horizontal arrangement back: left half half a half-cell to the left of the column middle without moving the pen, right half half a half-cell to the right and 1 em on, joiner and combiner no advance, the upper glyph of a stack no advance and moved to the middle of the cell it follows, up by 1 em; a tone mark the same, then further into the cell in y (in horizontal text the tones hang over and under the cell, in a column that lies on the neighbours) and `TONE_SIDE` out to the side it stands on, at the edge of the letters (environment variables `QATT_TONE_SIDE`, default 140, and `QATT_TONE_Y`, default 0: how far inside the top or bottom edge of the cell the tone stays; they count for `font_vertical.py` and for `build_font.py --vertical`, e.g. `QATT_TONE_SIDE=100 python3 tools/font_vertical.py fonts/qatt-*.ttf`; `build_font.py` writes both into the name table with the other build parameters). A syllable is then one square in a vertical field (`writing-mode: vertical-rl`; the editor has the switch "Vertical"). Horizontal text is unchanged. A vertical advance is *taken away* from the 1 em that points down, so "no advance" is `-1000`. `python3 tools/font_vertical.py fonts/qatt-*.ttf` adds it to the finished fonts (also those that are not built again, like `font_names.py`; running it twice does no harm); `build_font.py --vertical` does it for a font it builds.

**Pen Cut.** `--pen --cut` is a variant of the Pen font with flat stroke ends cut at a slant, as in Song: thin horizontals with a small flare where they stop, heavy verticals
(`style "pen-cut"` in `tools/pen_strokes.js`). The same six weights, files `fonts/qatt-pencut[-extralight|-light|-medium|-bold|-heavy]`, family `QATT Pen Cut ...`
(`python3 tools/build_font.py --kage fonts/kage.json --pen --cut --weight 1.6 fonts/glyphs.json fonts/qatt-pencut`).

**Kaiti (Khai, draft).** `--kaiti` (with `--kage`) draws the KAGE lines as brush strokes of regular script (`tools/kaiti_strokes.js`, style "kaiti" in `kage_outlines.js`, family `QATT Khai`):
horizontals rise a little and are thin with a pressed start and a bulge where they stop, verticals are pressed at the start and thinner towards a round end, left-falling strokes taper to a point,
right-falling strokes swell to a foot (the horizontal, the vertical (longer than 4 W), the left-falling stroke (longer than 3 W) and the right-falling stroke (longer than 4 W, in the KAGE data a curve of type 7) follow templates, its outline is a smooth Bezier spline: `poly.smooth` in `outlineOf`). It builds on the Pen module (`pen_strokes.js` exports its helpers) and takes `--weight` like Pen. The family is `QATT Khai`; a first draft (weight 2.0) is committed as `fonts/qatt-khai`:
`python3 tools/build_font.py --kage fonts/kage.json --kaiti --weight 2.0 fonts/glyphs.json fonts/qatt-khai`.

**Left and right forms.** The halves of a joined pair are made from the single form (`v2c-X` in `fonts/kage.json`). A symbol that has to look
different on the left or on the right gets its own form: `v2l-X` (left half) and/or `v2r-X` (right half) in `kage.json`, with the marks in the same
order as the single form; `admin/font/font-editor.html` offers them as "Left (optional)" and "Right (optional)" (without data they show the single form; edit it to make
one); "Use the single form" removes an own form again (also one that `kage.json` ships). The stack (Tham Thư) takes its lower pair from the same left and right forms. `kage_seed.js` starts ong, dong, hong and bong with a left form whose lowest horizontal stroke is sloped up to its right end.

**Bold.** `--bold` (with `--kage`) makes the strokes heavier: Gothic all strokes 1.7 times (the glyph editor slider allows up to 2.4 times, which closes the gaps of dense glyphs), Serif only the verticals, 1.8 times (the thick strokes of the normal Mincho are 0.85 of the engine's standard) (the thin horizontals and the triangles stay as in the normal Mincho); tones and marks get 1.5 times. The families are "QATT Khai Bold" and "QATT Mincho Bold":

```sh
python3 tools/build_font.py --kage fonts/kage.json --gothic --bold fonts/glyphs.json fonts/qatt-gothic-bold
```
# (the Bold file is no longer kept; this is how it was made)

The bold Serif font is not published any more (`--bold` without `--gothic` still builds it).

**Wide.** `--wide` (with `--kage`) makes a joined pair 1.25 cells wide (each half 625 units instead of 500), so its halves are squeezed less; a single character stays one square cell. The upper glyph of a stack over a pair and a tone after a pair are centred on the wide cell (`.upw`, `.markw`). The family is "QATT Khai Wide":

```sh
python3 tools/build_font.py --kage fonts/kage.json --gothic --wide fonts/glyphs.json fonts/qatt-gothic-wide
```

## Shared pieces of the pages

- `js/fonts.js`: the list of fonts (family, file) and the sizes. `admin/font/codetable.html` takes its `<select data-qatt-fonts>` / `<select data-qatt-sizes>`, `editor.html` the fonts and the `@font-face` rules from it.html`).
- `js/qatt-text.js`: code of `parser.js` (`parsed.qatt`, e.g. `t,c5,,5`) to text of the QATT block: onset `U+F009B` rhyme tone mark, one cell. Used by `editor.html` (typing Quốc Ngữ turns into font text when a word is finished).

## Libraries (`vendor/`)

Bootstrap 5.3.3 (CSS, JS bundle) and Bootstrap Icons 1.11.3 (CSS, fonts) are part of the repo, no CDN: `vendor/bootstrap/`, `vendor/bootstrap-icons/` (with their licenses).
Pages link them relatively (`vendor/…`, `../vendor/…` from a subfolder, `/vendor/…` in `404.html`); `js/navigation.js` finds the folder from its own address, so pages of other sites that load it get the same files.
To update: take the files from the npm packages `bootstrap` and `bootstrap-icons` (`dist/css/bootstrap.min.css`, `dist/js/bootstrap.bundle.min.js`, `font/bootstrap-icons.min.css`, `font/fonts/*`).
`vendor/supabase/` holds supabase-js 2.117.3 (UMD build `supabase.min.js`, pinned instead of the floating `@2`).

## Pictures of the build numbers: `build_images.js`

`node tools/build_images.js` (Node.js with Playwright and a Chromium, Python with the packages of `requirements.txt`, a Han font) builds QATT Pen several times with one number changed (`QATT_VS`, `QATT_VC`, `QATT_HS`, `QATT_TV`, `QATT_TH`, `QATT_TONE_SIDE`, `QATT_TONE_Y`) in a temporary folder, sets the same text in each and writes one picture per number into `admin/font/build/` (before and after, shown on `admin/font/build.html`). About a minute. The numbers and their values are the list `FIGURES` at the top of the script.
