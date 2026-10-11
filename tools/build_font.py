#!/usr/bin/env python3
"""Build a monospace web font from the QATT stroke glyphs (glyphs.json from extract.js)."""
import json, sys
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.fontBuilder import FontBuilder

SRC, OUT = sys.argv[1], sys.argv[2]
BASE = 0xF0000
UPM = 1000
SY = 8.5                       # font units per svg unit (vertical)
SX = SY * (13 / 15) / (120 / 125)  # the page stretches the 120x125 viewBox to 13:15
X0, Y0 = 500 - 50 * SX, 870    # svg (0,0) -> font; the 0..100 box is centred in the advance
STROKE, STROKE_TONE = 48, 36   # font units
ADV = 1000

data = json.load(open(SRC))['res']

def outline(defs, width):
    out = pathops.Path()
    for d in defs:
        p = pathops.Path()
        parse_path(d, TransformPen(p.getPen(), (SX, 0, 0, -SY, X0, Y0)))
        p.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
        p.convertConicsToQuads(0.1)
        p.draw(out.getPen())
    out.simplify(fix_winding=True)
    return out

glyphs, cmap, order = {}, {}, ['.notdef']
glyphs['.notdef'] = TTGlyphPen(None).glyph()
for k in sorted(data, key=int):
    g, o = data[k], int(k)
    defs = [df['d'] for u, df in zip(g['uses'], g['defs']) if u != 'square']
    tone = g['t'] == 'tone'
    path = outline(defs, STROKE_TONE if tone else STROKE)
    pen = TTGlyphPen(None)
    path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    name = 'u%05X' % (BASE + o)
    glyphs[name] = pen.glyph(); cmap[BASE + o] = name; order.append(name)

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({n: (ADV, 0) for n in order})
fb.setupHorizontalHeader(ascent=880, descent=-120)
fb.setupNameTable({'familyName': 'QATT Prototype', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, usWinAscent=880, usWinDescent=120)
fb.setupPost(isFixedPitch=1)
fb.save(OUT + '.ttf')
from fontTools.ttLib import TTFont
f = TTFont(OUT + '.ttf'); f.flavor = 'woff2'; f.save(OUT + '.woff2')
print(len(order) - 1, 'glyphs')
