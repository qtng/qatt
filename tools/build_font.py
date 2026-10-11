#!/usr/bin/env python3
"""Build a monospace web font from the QATT stroke glyphs (font/glyphs.json, made from the rendered qatt.js glyphs by extract_glyphs.js).
The two format characters (combiner, joiner) only get a small square as placeholder.

Component joiner: "A joiner B" (A, B any Can/Chi form) is shown as one square cell, A squeezed into the
left half and B into the right half (an OpenType ccmp rule swaps both for half-width variants and the joiner
for an empty zero-width glyph). Hop Thu = a marked form on the left and the unmarked one on the right."""
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
STROKE, STROKE_TONE, STROKE_HALF, STROKE_MARK = 72, 54, 72, 38   # font units (glyph, standalone tone, joiner half, combining tone)
ADV = 1000
HALF_X = 0.5                   # horizontal squeeze of the half-width variants (the joiner halves)
JOINER = 155                   # offset of the component joiner
COMBINER = 154                 # offset of the Tham Thu combiner
STACK_UP, STACK_TOP, STACK_BOTTOM = 0.45, 14, 94   # share of the height for the glyph above; svg y of the top and bottom edge of the area (a bit lower than a single glyph)
STACK_UP_X = 0.88                                  # the upper glyph is a bit narrower than the lower one
STROKE_UP, STROKE_LOW = 58, 58                    # strokes of the squeezed upper and lower glyph
GROW, GROW_Y = 1.18, 60        # the Can/Chi glyphs are enlarged by GROW around the point (middle, svg y = GROW_Y); tones keep their size and corner positions

data = json.load(open(SRC))  # font/glyphs.json

def outline(defs, width, k=1.0, centre=500, grow=1.0, v=1.0, anchor=None):
    """Stroke the paths into one outline; k squeezes horizontally, centre is the x of the middle of the glyph,
    grow enlarges the drawing around its middle, v squeezes vertically around the svg y `anchor`."""
    out = pathops.Path()
    kx = SX * k * grow
    f = Y0 - GROW_Y * SY * (1 - grow)
    if anchor is not None:       # the point `anchor` stays where it is, the rest is squeezed towards it
        f = (Y0 - (GROW_Y + (anchor - GROW_Y) * grow) * SY) + anchor * SY * grow * v
    matrix = (kx, 0, 0, -SY * grow * v, centre - 49.27 * kx, f)
    for d in defs:
        p = pathops.Path()
        parse_path(d, TransformPen(p.getPen(), matrix))
        p.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
        p.convertConicsToQuads(0.1)
        p.draw(out.getPen())
    out.simplify(fix_winding=True)
    return out

glyphs, cmap, order, adv, halves, tones = {}, {}, ['.notdef'], {}, [], []

def add(name, path, advance=None):
    pen = TTGlyphPen(None)
    path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    glyphs[name] = pen.glyph(); order.append(name)
    if advance is not None: adv[name] = advance
glyphs['.notdef'] = TTGlyphPen(None).glyph()
for g in data:
    o, defs = g['o'], g['d']
    tone = g['t'] == 'tone'
    pen = TTGlyphPen(None)
    if g['t'] in ('combiner', 'joiner'):   # format characters: a small centred square as placeholder
        x0, y0, x1, y1 = 400, 240, 600, 440
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
    else:
        path = outline(defs, STROKE_TONE if tone else STROKE, grow=1.0 if tone else GROW)
        path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
    name = 'u%05X' % (BASE + o)
    glyphs[name] = pen.glyph(); cmap[BASE + o] = name; order.append(name)
    if g['t'] in ('unmarked', 'marked', 'chi'):   # half-width variant for the component joiner
        pen = TTGlyphPen(None)
        outline(defs, STROKE_HALF, HALF_X, 250, GROW).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyphs[name + '.half'] = pen.glyph(); adv[name + '.half'] = ADV // 2; order.append(name + '.half')
        halves.append(name)
        # Tham Thu: the glyph squeezed into the upper 45 % (.up) or the lower 55 % (.low, and .halflow for a joined pair)
        add(name + '.up', outline(defs, STROKE_UP, STACK_UP_X, -500, GROW, STACK_UP, STACK_TOP), 0)   # zero width: lies over the cell to its left
        add(name + '.low', outline(defs, STROKE_LOW, 1.0, 500, GROW, 1 - STACK_UP, STACK_BOTTOM))
        add(name + '.halflow', outline(defs, STROKE_LOW, HALF_X, 250, GROW, 1 - STACK_UP, STACK_BOTTOM), ADV // 2)
    if tone:                                    # zero-width variant that lies over the cell to its left, in the smaller size qatt.js uses on a cluster
        pen = TTGlyphPen(None)
        outline(g['dm'], STROKE_MARK, 1.0, -500).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyphs[name + '.mark'] = pen.glyph(); adv[name + '.mark'] = 0; order.append(name + '.mark')
        tones.append(name)
jname = 'u%05X' % (BASE + JOINER)
cname = 'u%05X' % (BASE + COMBINER)
glyphs[cname + '.zw'] = TTGlyphPen(None).glyph(); adv[cname + '.zw'] = 0; order.append(cname + '.zw')
glyphs[jname + '.zw'] = TTGlyphPen(None).glyph(); adv[jname + '.zw'] = 0; order.append(jname + '.zw')

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
fb.setupHorizontalMetrics({n: (adv.get(n, ADV), lsb(n)) for n in order})
fb.setupHorizontalHeader(ascent=880, descent=-120)
fb.setupNameTable({'familyName': 'QATT Prototype', 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, usWinAscent=880, usWinDescent=120)
fb.setupPost(isFixedPitch=1)
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
addOpenTypeFeaturesFromString(fb.font, f'''
@FULL = [{' '.join(halves)}];
@HALF = [{' '.join(n + '.half' for n in halves)}];
@UP = [{' '.join(n + '.up' for n in halves)}];
@LOW = [{' '.join(n + '.low' for n in halves)}];
@HALFLOW = [{' '.join(n + '.halflow' for n in halves)}];
@TONE = [{' '.join(tones)}];
@TONE_MARK = [{' '.join(n + '.mark' for n in tones)}];
@BEFORE_TONE = [@FULL @HALF @UP @TONE_MARK {cname} {cname}.zw {jname} {jname}.zw];
lookup HALF {{ sub @FULL by @HALF; }} HALF;
lookup JOINER_ZW {{ sub {jname} by {jname}.zw; }} JOINER_ZW;
lookup UPPER {{ sub @FULL by @UP; }} UPPER;
lookup LOWER {{ sub @FULL by @LOW; }} LOWER;
lookup HALF_LOWER {{ sub @HALF by @HALFLOW; }} HALF_LOWER;
lookup COMBINER_ZW {{ sub {cname} by {cname}.zw; }} COMBINER_ZW;
lookup TONE_MARK {{ sub @TONE by @TONE_MARK; }} TONE_MARK;
lookup JOIN {{ sub @FULL' lookup HALF {jname}' lookup JOINER_ZW @FULL' lookup HALF; }} JOIN;
lookup STACK {{
    sub @HALF' lookup HALF_LOWER {jname}.zw @HALF {cname} @FULL;
    sub [@HALF @HALFLOW] {jname}.zw @HALF' lookup HALF_LOWER {cname} @FULL;
    sub @HALFLOW {jname}.zw @HALFLOW {cname}' lookup COMBINER_ZW @FULL' lookup UPPER;
    sub @FULL' lookup LOWER {cname}' lookup COMBINER_ZW @FULL' lookup UPPER;
}} STACK;
lookup TONE_AFTER {{ sub @BEFORE_TONE @TONE' lookup TONE_MARK; }} TONE_AFTER;
feature ccmp {{
    lookup JOIN;
    lookup STACK;
    lookup TONE_AFTER;
}} ccmp;
''')


fb.save(OUT + '.ttf')
from fontTools.ttLib import TTFont
f = TTFont(OUT + '.ttf'); f.flavor = 'woff2'; f.save(OUT + '.woff2')
print(len(order) - 1, 'glyphs')
