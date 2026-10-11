#!/usr/bin/env python3
"""Build a monospace web font from the QATT stroke glyphs (font/glyphs.json, made from the rendered qatt.js glyphs by extract_glyphs.js).
The two format characters (combiner, joiner) only get a small square as placeholder."""
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
SY = 12.6                      # font units per svg unit (vertical): a typical glyph is about as tall as a capital letter
SX = SY * (13 / 15) / (120 / 125)  # the page stretches the 120x125 viewBox to 13:15
X0, Y0 = 500 - 49.27 * SX, 958  # svg (0,0) -> font: glyph content centred in the advance, bottoms of the lower glyphs near the baseline
STROKE, STROKE_TONE = 72, 54   # font units
ADV = 1000

data = json.load(open(SRC))  # font/glyphs.json

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
for g in data:
    o, defs = g['o'], g['d']
    tone = g['t'] == 'tone'
    pen = TTGlyphPen(None)
    if g['t'] in ('combiner', 'joiner'):   # format characters: a small centred square as placeholder
        x0, y0, x1, y1 = 400, 240, 600, 440
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    else:
        path = outline(defs, STROKE_TONE if tone else STROKE)
        path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    name = 'u%05X' % (BASE + o)
    glyphs[name] = pen.glyph(); cmap[BASE + o] = name; order.append(name)

fb = FontBuilder(UPM, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyphs)
# left side bearing must equal xMin, else FreeType (Android, Linux) shifts the glyph
def lsb(n):
    gl = glyphs[n]
    if not gl.numberOfContours: return 0
    gl.recalcBounds(None)
    return gl.xMin
fb.setupHorizontalMetrics({n: (ADV, lsb(n)) for n in order})
fb.setupHorizontalHeader(ascent=880, descent=-120)
fb.setupNameTable({'familyName': 'QATT Prototype', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, usWinAscent=880, usWinDescent=120)
fb.setupPost(isFixedPitch=1)
fb.save(OUT + '.ttf')
from fontTools.ttLib import TTFont
f = TTFont(OUT + '.ttf'); f.flavor = 'woff2'; f.save(OUT + '.woff2')
print(len(order) - 1, 'glyphs')
