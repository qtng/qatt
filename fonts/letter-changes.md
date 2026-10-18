# Changes to the letter forms

Changes made to the letters of `fonts/kage.json` for one font (or for the tones), to be applied later to `js/qatt.js` and the other fonts.
Newest first. Coordinates are KAGE units (the 200 × 200 box of `kage.json`; 12 units are about 40 font units).

## Room for the small tone mark (Khai tones, 2026-10)

The small tone mark of the brush tones (Khai) sits over the upper right corner of the cell before it. Some forms have a stroke up there
that the circle touches. The vertical mark of four forms was moved **2 units down** (both ends, y + 2; x unchanged); it still rises above
the horizontal stroke (a first try with 12 units was too much). A light touch is accepted.

| Form | Glyph | Mark (index in `marks`) | Before | After |
|---|---|---|---|---|
| 48 TRONG MARKED-6 | `v2c-tr` | 5, vertical | `1:0:0:130.6:22.8:130.6:53.2` | `1:0:0:130.6:24.8:130.6:55.2` |
| 104 XONG MARKED-6 | `v2c-x` | 5, vertical | `1:0:0:139.2:19:139.2:49.4` | `1:0:0:139.2:21:139.2:51.4` |
| 111 KHONG MARKED-6 | `v2c-kh` | 5, vertical | `1:0:0:133.5:19:133.5:49.4` | `1:0:0:133.5:21:133.5:51.4` |
| 132 MONG MARKED-6 | `v2c-m` | 5, vertical | `1:0:0:130.6:19:130.6:49.4` | `1:0:0:130.6:21:130.6:51.4` |

The small tone mark at the upper left (U+F009F) sits over the upper left corner; there the vertical mark of three forms was moved
**3 units down** (both ends, y + 3; x unchanged):

| Form | Glyph | Mark (index in `marks`) | Before | After |
|---|---|---|---|---|
| 99 XONG MARKED-1 | `v2c-x` | 0, vertical | `1:0:0:48:19:48:49.4` | `1:0:0:48:22:48:52.4` |
| 106 KHONG MARKED-1 | `v2c-kh` | 0, vertical | `1:0:0:48:19:48:49.4` | `1:0:0:48:22:48:52.4` |
| 127 MONG MARKED-1 | `v2c-m` | 0, vertical | `1:0:0:45.1:19:45.1:49.4` | `1:0:0:45.1:22:45.1:52.4` |

Open: the small strokes falling to the right at the top of 139 BONG MARKED-6 (`v2c-b`, mark 5) and 145 VONG MARKED-5 (`v2c-v`, mark 4)
also touch the circle (139 also the one at the upper left); they are unchanged and will be looked at separately.
Applied to the other sources too (fonts v5): `js/qatt.js` (the paths `v2-` and `v2c-` of these marks; 2 KAGE units = 1.05, 3 = 1.58 qatt.js units,
scale 1.9), `fonts/brush.json` (the marks in `sym` and the finished `outlines`) and `fonts/glyphs.json` (extracted again), so Prototype and Brush
have them as well.
