# Changes to the letter forms

Changes made to the letters of `fonts/kage.json` for one font (or for the tones), to be applied later to `js/qatt.js` and the other fonts.
Newest first. Coordinates are KAGE units (the 200 × 200 box of `kage.json`; 12 units are about 40 font units).

## Room for the small tone mark (Khai tones, 2026-10)

The small tone mark of the brush tones (Khai) sits over the upper right corner of the cell before it. Six forms have a stroke up there
that the circle touched. Their mark was moved **12 units down** (both ends of the stroke, y + 12; x unchanged):

| Form | Glyph | Mark (index in `marks`) | Before | After |
|---|---|---|---|---|
| 48 TRONG MARKED-6 | `v2c-tr` | 5, vertical | `1:0:0:130.6:22.8:130.6:53.2` | `1:0:0:130.6:34.8:130.6:65.2` |
| 104 XONG MARKED-6 | `v2c-x` | 5, vertical | `1:0:0:139.2:19:139.2:49.4` | `1:0:0:139.2:31:139.2:61.4` |
| 111 KHONG MARKED-6 | `v2c-kh` | 5, vertical | `1:0:0:133.5:19:133.5:49.4` | `1:0:0:133.5:31:133.5:61.4` |
| 132 MONG MARKED-6 | `v2c-m` | 5, vertical | `1:0:0:130.6:19:130.6:49.4` | `1:0:0:130.6:31:130.6:61.4` |
| 139 BONG MARKED-6 | `v2c-b` | 5, slanted | `2:7:8:87.1:18.9:107.8:28.5:128.5:38.1` | `2:7:8:87.1:30.9:107.8:40.5:128.5:50.1` |
| 145 VONG MARKED-5 | `v2c-v` | 4, slanted | `2:7:8:124.6:18.1:144.9:28.5:165.2:38.9` | `2:7:8:124.6:30.1:144.9:40.5:165.2:50.9` |

Not changed: the left form `v2l-b` (its own copy of the mark of 139; no tone sits over a left half).
Still to do: the same in `js/qatt.js` (the SVG shapes) and a look at the other fonts once they get the brush tones.
