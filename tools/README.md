# Tools

## Reference font (`fonts/`)

**Licence.** The fonts and their glyph data are © 2026 qatt.org, all rights reserved (`fonts/LICENSE.txt`, also on `license.html`). `build_font.py` writes
copyright, licence, version, maker, full and PostScript name into the name table (`tools/font_names.py`); `python3 tools/font_names.py fonts/qatt-*.ttf`
gives fonts that are already built the same entries (and writes their `.woff2` again) without building them again.

**Where the fonts come from.** The letters are open paths (straight strokes and curves with one control point) in `fonts/paths.json`,
edited in `admin/font/glyph-editor.html`; it is the one source of the letters of all fonts that are built (Serif, Gothic, Pen, Pen Cut, Khai):

```
fonts/paths.json  --qatt_paths.js (KAGE lines)-->  kage_outlines.js + qatt_draw.js (strokes of the style)  --build_font.py-->  fonts/qatt-*.ttf / .woff2
fonts/glyphs.json (the list of the characters, the circles of the tones), fonts/tones.json, fonts/tone-offsets.json  ----^
```

How a stroke is drawn (its widths, its ends, the style) is code: `qatt_draw.js` (the KAGE engine for Serif and Gothic, `pen_strokes.js`,
`kaiti_strokes.js`), `brush_tones.py`, the constants of `build_font.py` and the list of `build_all.py`. The editor uses the same `qatt_paths.js`
and `qatt_draw.js`, so it shows what the build makes. Brush and Prototype (built from the paths of `qatt.js` and the brush model of the former brush
editors) are no longer built; their files stay as they are.

### The list of the characters: `extract_glyphs.js`

`fonts/glyphs.json` was made once from the rendered `unicode.html` (which draws with `qatt.js`): the 164 characters with their names and kinds, and
the paths of `qatt.js` (the build takes the circles of the tones of Serif and Gothic from it, and the Prototype font all paths). It only has to be made
again when that list or those circles change:

Needs Node.js with [Playwright](https://playwright.dev) and a Chromium. Serve the repository first:

```sh
python3 -m http.server 8790 &                      # in the root of the repository
PLAYWRIGHT_MODULE=/path/to/node_modules/playwright CHROMIUM=/path/to/chromium \
  node tools/extract_glyphs.js http://localhost:8790/unicode.html fonts/glyphs.json
```

`PLAYWRIGHT_MODULE` and `CHROMIUM` are only needed if Playwright is not installed locally or Chromium is not found by
Playwright. Only requests to the local server are allowed (no CDN), the paths do not depend on Bootstrap.

### Logo and icons: `make_logo.py`

`python3 tools/make_logo.py` draws the logo and the icons of qatt.org from the big symbol of the home page, the syllable "tân" (U+F003F U+F009A U+F003D) in QATT Khai: `img/logo.svg` (340 high on the red tile with the thin frame, the lines as bold as in the icon; used in the menu bar), `img/favicon.svg` (bigger and a little bolder, for 16 to 32 pixels) and `img/apple-touch-icon.png` (180 x 180, a full square: the phone rounds it). The outlines are shaped with HarfBuzz out of `fonts/qatt-khai.ttf` and written as paths, so the logo does not need the font. The PNG is rendered with Playwright for node (`NODE_PATH` to its `node_modules`, `--no-png` leaves it out).

### All fonts at once: `build_all.py`

`python3 tools/build_all.py` builds the 12 KAGE fonts (Brush and Prototype are no longer built) (`fonts/qatt-*.ttf` and `.woff2`, with the name table and the vertical metrics) in about a minute; `--out DIR` builds into another folder, e.g. to compare with `fonts/` first, and words select fonts (`python3 tools/build_all.py serif pen`). The list in the script is the one place that has the call of every font. The Serif and Gothic files that were in `fonts/` before 2026-10-17 could not be built again (they came from a state of the data that is not in the repository), so all fonts were built anew.

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
python3 tools/build_font.py fonts/glyphs.json fonts/qatt-prototype      # writes .ttf and .woff2 (Prototype, not built any more)
```


**Light variant.** `--light` makes all strokes thinner (`LIGHT` times the stroke widths):

```sh
python3 tools/build_font.py --light fonts/glyphs.json fonts/qatt-prototype-light   # family "QATT Prototype Light"
```

**Design constants** at the top of `build_font.py`: glyph size (`SY`, `GROW`), position (`Y0`), stroke widths
(`STROKE`, `STROKE_TONE`, `STROKE_HALF`, `STROKE_MARK`, `STROKE_UP`, `STROKE_LOW`), the share of the upper glyph of a
Tham Thư (`STACK_UP`, `STACK_UP_X`) and the extent of a joined pair (`PAIR_X0`, `PAIR_X1`).

**What the font does** (OpenType `ccmp`, in `build_font.py`):

- *A* `U+F009A` *B* (component joiner): one cell like a syllable of `qatt.js`, the joiner has no width; *A* becomes its
  onset form in the left half (`.left`, a mark of *A* moved from the rhyme form onto the onset form), *B* its rhyme form in
  the right half (`.right`).
- *A* `U+F009B` *B* (Tham Thư combiner): *A* (a single form or a joined pair) goes into the lower 55 %, *B* into the upper
  45 % of the cell; the combiner has no width.
- A tone mark after any character becomes a zero-width variant (the small form of `qatt.js`) that lies over the preceding cell.
- Standalone, the combiner is drawn as U+2FF1 (a frame with a line across, two boxes above each other) and the joiner as U+2FF0 (a frame with a line down the middle), both half a cell wide; a tone is the large form.

The code points are `U+F0000` plus the offset in the proposal (`BASE` in `build_font.py`). The offsets come from the data
in `unicode.html`.

**Check the rules without a browser** (`pip install uharfbuzz`):

```python
import uharfbuzz as hb
font = hb.Font(hb.Face(hb.Blob.from_file_path('fonts/qatt-khai.ttf')))
buf = hb.Buffer(); buf.add_str('\U000F0001\U000F009A\U000F0000'); buf.guess_segment_properties(); hb.shape(font, buf)
print([(font.glyph_to_string(i.codepoint), p.x_advance) for i, p in zip(buf.glyph_infos, buf.glyph_positions)])
# [('uF0001.left', 500), ('uF009A.zw', 0), ('uF0000.right', 500)]
```

## Character data (`unicode.html`): `update_unicode_data.py`

Refreshes the character data embedded in `unicode.html` from a checkout of
[qtng/qatt-unicode](https://github.com/qtng/qatt-unicode) (read only, `ucd/` and `tools/make_ucd.py`):

```sh
python3 tools/update_unicode_data.py PATH/TO/qatt-unicode            # unicode.html in this repository
```

If the data changes (new characters or offsets), run the font steps above again.

## The KAGE fonts

**The paths.** `fonts/paths.json`: `{format: "qatt-paths", version: 1, box: 200, forms: {id: {strokes: [item], marks: [item]}}}`, id `v2c-X` the single form
of the symbol X, `v2l-X` / `v2r-X` its own left / right form (optional); the marks 1–6 in their order; an item is `"M x y L x y"` (straight) or
`"M x y Q cx cy x y"` (a curve with one control point) in the KAGE box of 200 × 200 (y down), or `{"d": ..., "type": "1:0:2", "dock": [1, 0, 0.4]}` with a KAGE line type set
by hand and/or, for a mark (always straight), the end of a stroke it is docked to (`[index of the stroke, 0 its start / 1 its end, the place of the mark
on it, 0..1 from its start]`; without the place the editor finds it; the editor moves a docked mark along with that end, its angle stays; 132 of the 156
marks were docked from the start; the build does not use it). `"markLength": {"h", "v", "d"}`: the length of the marks, horizontal, vertical and slanted
(in the file: the mean of the marks of each kind, 44.87, 30.4, 34.23; without it 1/5 of the width of the box, 1/5 of its height and their mean). When
the editor opens, every mark gets the length of its kind (its angle stays) and a docked one the nearest place in steps of 10 %; an edited mark also gets
an angle in steps of 5°, and docks only at its ends or a step of 10 %. So the file changes only through the editor. One path per line in the file (`QattPaths.stringify`). `admin/font/glyph-editor.html` edits it: drag points, control points and whole paths,
set a type, make a straight stroke a curve and back; the draft lives in the browser (`localStorage` `qattPaths1`), "Copy JSON" gives the whole file.

**The line types.** `tools/qatt_paths.js` turns the paths into KAGE lines (`toKage`). Without a type set by hand, the type follows from the path: nearly
horizontal 1:0:2 for a mark or a stroke that ends on another stroke (a plain end) else 1:0:0 (the triangle of Mincho); a curve that is nearly vertical
2:0:0; nearly vertical 1:0:0; slanted 2:0:7 down to the left (a left sweep), 2:7:8 down to the right. These are the rules by which the first KAGE data
was made from `qatt.js`; they give the types of all 234 strokes of that data. A straight stroke of a curve type gets its control point in the middle.

**KAGE font.** With `--kage fonts/paths.json` the letters are drawn by the [KAGE engine](https://github.com/kurgm/kage-engine) (`js/kage-engine.min.js`, GPL-3.0, see
`js/kage-engine.COPYING`; `tools/kage_outlines.js` loads it in Node.js) or by the stroke drawing of the style (`tools/qatt_draw.js`); the lines are squeezed and moved first, so the half-width and stacked variants keep
their stroke widths. The tones stay stroked circles (Khai: brush tones, below) (drawn narrower than the letters, `TONE_X` in `build_font.py`, so that they have the proportions of qatt.js). `--gothic` selects the Gothic style (family "QATT Khai", `fonts/qatt-gothic`), the default is Serif (the KAGE style "mincho"):

```sh
python3 tools/build_font.py --kage fonts/paths.json fonts/glyphs.json fonts/qatt-serif     # writes fonts/qatt-serif.ttf / .woff2
```

**Pen font.** `--kage fonts/paths.json --pen` draws the same KAGE lines as strokes of a felt-tip or ballpoint pen instead of with the KAGE engine
(`tools/pen_strokes.js`, called by `kage_outlines.js`): horizontals are bowed a little and have a slanted press at the start and a round bulge where they stop,
verticals a press and a round "dewdrop" end, falling curves have a press and keep their width (no taper). Where a stroke ends on another one (a junction) it has no press or bulge.

`--weight F` sets the stroke width (F times the standard) and `--label Name` is added to the family name:

```
python3 tools/build_font.py --kage fonts/paths.json --pen --weight 0.6 --label ExtraLight fonts/glyphs.json fonts/qatt-pen-extralight
python3 tools/build_font.py --kage fonts/paths.json --pen --weight 1.0 --label Light      fonts/glyphs.json fonts/qatt-pen-light
python3 tools/build_font.py --kage fonts/paths.json --pen --weight 1.6 fonts/glyphs.json fonts/qatt-pen                       # Regular
python3 tools/build_font.py --kage fonts/paths.json --pen --weight 2.4 --label Medium     fonts/glyphs.json fonts/qatt-pen-medium
```

**Vertical text** (`tools/font_vertical.py`, in all fonts). Without vertical metrics every glyph is 1 em high in vertical text, so the two halves of a syllable lie on top of each other, the joiner takes a whole em and so does a tone mark (a syllable 3 to 4 em high and 1 em wide). `font_vertical.py` gives a built font `vhea`/`vmtx` (1 em, origin at the ascent as in horizontal text) and a `vert` rule (GPOS) that gives the pieces of a syllable their horizontal arrangement back: left half half a half-cell to the left of the column middle without moving the pen, right half half a half-cell to the right and 1 em on, joiner and combiner no advance, the upper glyph of a stack no advance and moved to the middle of the cell it follows, up by 1 em; a tone mark the same, then further into the cell in y (in horizontal text the tones hang over and under the cell, in a column that lies on the neighbours) and `TONE_SIDE` out to the side it stands on, at the edge of the letters (`side` and `y` of the style in `fonts/tone-offsets.json`, see Tone offsets; for a style without them the environment variables `QATT_TONE_SIDE`, default 140, and `QATT_TONE_Y`, default 0: how far inside the top or bottom edge of the cell the tone stays; they count for `font_vertical.py` (which reads the style from the build parameters in the name table) and for `build_font.py --vertical`, e.g. `QATT_TONE_SIDE=100 python3 tools/font_vertical.py fonts/qatt-*.ttf`; `build_font.py` writes both into the name table with the other build parameters). A syllable is then one square in a vertical field (`writing-mode: vertical-rl`; the editor has the switch "Vertical"). Horizontal text is unchanged. A vertical advance is *taken away* from the 1 em that points down, so "no advance" is `-1000`. `python3 tools/font_vertical.py fonts/qatt-*.ttf` adds it to the finished fonts (also those that are not built again, like `font_names.py`; running it twice does no harm); `build_font.py --vertical` does it for a font it builds.

**Pen Cut.** `--pen --cut` is a variant of the Pen font with flat stroke ends cut at a slant, as in Song: thin horizontals with a small flare where they stop, heavy verticals
(`style "pen-cut"` in `tools/pen_strokes.js`). The same six weights, files `fonts/qatt-pencut[-extralight|-light|-medium|-bold|-heavy]`, family `QATT Pen Cut ...`
(`python3 tools/build_font.py --kage fonts/paths.json --pen --cut --weight 1.6 fonts/glyphs.json fonts/qatt-pencut`).

**Kaiti (Khai, draft).** `--kaiti` (with `--kage`) draws the KAGE lines as brush strokes of regular script (`tools/kaiti_strokes.js`, style "kaiti" in `kage_outlines.js`, family `QATT Khai`):
horizontals rise a little and are thin with a pressed start and a bulge where they stop, verticals are pressed at the start and thinner towards a round end, left-falling strokes taper to a point,
right-falling strokes swell to a foot (the horizontal, the vertical (longer than 4 W), the left-falling stroke (longer than 3 W) and the right-falling stroke (longer than 4 W, in the KAGE data a curve of type 7) follow templates, its outline is a smooth Bezier spline: `poly.smooth` in `outlineOf`). It builds on the Pen module (`pen_strokes.js` exports its helpers) and takes `--weight` like Pen. The family is `QATT Khai`; a first draft (weight 2.15) is committed as `fonts/qatt-khai`:
`python3 tools/build_font.py --kage fonts/paths.json --kaiti --weight 2.15 fonts/glyphs.json fonts/qatt-khai`.

**Brush tones.** A style can draw its tones as brush strokes instead of the stroked circles of qatt.js: `fonts/tones.json` holds them per KAGE style (`kaiti`; `pen` (Pen) and `pen-cut` (Pen Cut, `--pen --cut`) take the same tones by naming `"kaiti"`; a style without an entry keeps the circles). `tools/brush_tones.py` draws them: the circles as a brush ring (`ring`: clockwise from the top, a pressed start, the brush at 30°), the half circles as a curved stroke that ends in a little hook (`hook`; its settings under `"hook"`). The stroke widths are drawn for `"weight"` (2.0) and follow `--weight` in proportion. Each tone (key: the code point after U+F0000 in hex) gives its shape, side, turn (`rot`, degrees anticlockwise: the upper half circles 12.5°, the lower ones 90° to their side) and two ellipses `[cx, cy, rx, ry, stroke]` in font units: the standalone glyph and the small form `.mark` over the cell before (x −1000..0). The places are absolute: `keep_inside` and `tone_x` do not move them. The small forms: circles above at y 905 (rx 65, ry 50), below at −240 and smaller (50, 38), so that they end at −286 (inside `usWinDescent` 288); the half circles larger (×1.55), above at 860 and 55 further out, below at −186 and 70 further out (halfway as small as the lower circles). Changes to the letters made for the tones are in `fonts/letter-changes.md`.

**Tone offsets.** Where the small tone marks sit, per style (as in `tones.json`; all weights share the values), in `fonts/tone-offsets.json`,
adjusted in `admin/font/tone-offsets.html` (the page copies the JSON to hand over):

```
{style: {tone: {letter: [dx, dy]},                                    # horizontal text: offsets per letter
         "vertical": {"side": 140, "y": 0,                            # vertical text: the place of the tones (font_vertical.py)
                      "tones": {tone: {"side": .., "y": ..}},          #   own values of a tone
                      "letters": {tone: {letter: [dx, dy]}}}}}        #   offsets per letter on top
```

tone is the code point after U+F0000 in hex, letter the number of the form (decimal), font units, y up. `tools/tone_offsets.py` turns the
offsets per letter into contextual positioning: a tone at the right follows the rhyme glyph right before it (`.right`, `.right45`, `.right55`),
a tone at the left the onset before the joiner (`.left…`); horizontal in the `kern` feature (horizontal text only), vertical in a second lookup
of `vert`. Single letters, stacks and the wide font (`.markw`) have no offsets per letter. Every KAGE font also gets `fonts/<name>.marks.json`
with the outlines and bounds of its small tone marks, which the page draws.

**Left and right forms.** The halves of a joined pair are made from the single form (`v2c-X` in `fonts/paths.json`). A symbol that has to look
different on the left or on the right gets its own form: `v2l-X` (left half) and/or `v2r-X` (right half), with the marks in the same
order as the single form; `admin/font/glyph-editor.html` offers them as "Left" and "Right" (without data they show the single form; a change makes
an own one); "Use the single form" removes an own form again. The stack (Tham Thư) takes its lower pair from the same left and right forms. Ong, dong,
hong and bong have a left form whose lowest horizontal stroke is sloped up to its right end.

**Bold.** `--bold` (with `--kage`) makes the strokes heavier: Gothic all strokes 1.7 times, Serif only the verticals, 1.8 times (the thick strokes of the normal Mincho are 0.85 of the engine's standard) (the thin horizontals and the triangles stay as in the normal Mincho); tones and marks get 1.5 times. The families are "QATT Khai Bold" and "QATT Mincho Bold":

```sh
python3 tools/build_font.py --kage fonts/paths.json --gothic --bold fonts/glyphs.json fonts/qatt-gothic-bold
```
# (the Bold file is no longer kept; this is how it was made)

The bold Serif font is not published any more (`--bold` without `--gothic` still builds it).

**Wide.** `--wide` (with `--kage`) makes a joined pair 1.25 cells wide (each half 625 units instead of 500), so its halves are squeezed less; a single character stays one square cell. The upper glyph of a stack over a pair and a tone after a pair are centred on the wide cell (`.upw`, `.markw`). The family is "QATT Khai Wide":

```sh
python3 tools/build_font.py --kage fonts/paths.json --gothic --wide fonts/glyphs.json fonts/qatt-gothic-wide
```

## Shared pieces of the pages

- `js/fonts.js`: the list of fonts (family, file) and the sizes. `admin/font/codetable.html` takes its `<select data-qatt-fonts>` / `<select data-qatt-sizes>`, `editor.html` the fonts and the `@font-face` rules from it.html`).
- `js/qatt-text.js`: code of `parser.js` (`parsed.qatt`, e.g. `t,c5,,5`) to text of the QATT block: onset `U+F009A` rhyme tone mark, one cell. Used by `editor.html` (typing Quốc Ngữ turns into font text when a word is finished).

## Libraries (`vendor/`)

Bootstrap 5.3.3 (CSS, JS bundle) and Bootstrap Icons 1.11.3 (CSS, fonts) are part of the repo, no CDN: `vendor/bootstrap/`, `vendor/bootstrap-icons/` (with their licenses).
Pages link them relatively (`vendor/…`, `../vendor/…` from a subfolder, `/vendor/…` in `404.html`); `js/navigation.js` finds the folder from its own address, so pages of other sites that load it get the same files.
To update: take the files from the npm packages `bootstrap` and `bootstrap-icons` (`dist/css/bootstrap.min.css`, `dist/js/bootstrap.bundle.min.js`, `font/bootstrap-icons.min.css`, `font/fonts/*`).
`vendor/supabase/` holds supabase-js 2.117.3 (UMD build `supabase.min.js`, pinned instead of the floating `@2`).

## Pictures of the build numbers: `build_images.js`

`node tools/build_images.js` (Node.js with Playwright and a Chromium, Python with the packages of `requirements.txt`, a Han font) builds QATT Pen several times with one number changed (`QATT_VS`, `QATT_VC`, `QATT_HS`, `QATT_TV`, `QATT_TH`, `QATT_TONE_SIDE`, `QATT_TONE_Y`) in a temporary folder, sets the same text in each and writes one picture per number into `admin/font/build/` (before and after, shown on `admin/font/build.html`). About a minute. The numbers and their values are the list `FIGURES` at the top of the script.
