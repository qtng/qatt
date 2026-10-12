#!/usr/bin/env python3
"""Build a monospace web font from the QATT stroke glyphs (font/glyphs.json, made from the rendered qatt.js glyphs by extract_glyphs.js).
Standalone, the two format characters (combiner, joiner) are drawn as a small square.

Component joiner: "A joiner B" (A, B any Can/Chi form) is shown as one square cell like a syllable of qatt.js: A in the
left half in its onset form (v2-X-small), B in the right half in its rhyme form (v2-X); a mark of A is moved from the
rhyme form onto the onset form (an OpenType ccmp rule swaps both for half-width variants and the joiner for an empty
zero-width glyph). Hop Thu = a marked form on the left and the unmarked one on the right."""
import json, os, re, subprocess, sys, tempfile
import pathops
from fontTools.svgLib.path import parse_path
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.fontBuilder import FontBuilder

# --light: thinner strokes (LIGHT times the stroke widths), family "QATT Prototype Light"
LIGHT = 0.6
light = '--light' in sys.argv
if light: sys.argv.remove('--light')
KAGE = KAGE_STYLE = None      # --kage font/kage.json [--gothic]: the letters drawn by the KAGE engine (tools/kage_outlines.js), Mincho or Gothic
if '--kage' in sys.argv:
    i = sys.argv.index('--kage'); KAGE = sys.argv[i + 1]; del sys.argv[i:i + 2]
    KAGE_STYLE = 'gothic' if '--gothic' in sys.argv else 'mincho'
    if '--gothic' in sys.argv: sys.argv.remove('--gothic')
SRC, OUT = sys.argv[1], sys.argv[2]
BASE = 0xF0000
UPM = 1000
SY = 12.6                      # font units per svg unit (vertical): a typical glyph is about as tall as a capital letter
SX = SY * (13 / 15) / (120 / 125)  # the page stretches the 120x125 viewBox to 13:15
X0, Y0 = 500 - 49.27 * SX, 958  # svg (0,0) -> font: glyph content centred in the advance, bottoms of the lower glyphs near the baseline
STROKE, STROKE_TONE, STROKE_HALF, STROKE_MARK = 58, 43, 58, 30   # font units (glyph, standalone tone, joiner half, combining tone)
ADV = 1000
PAIR_X0, PAIR_X1 = 5, 104      # svg x extent of the onset forms (left) and rhyme forms (right) of a joined pair
CENTRED_X0, CENTRED_X1 = 19.25, 82.25   # svg x extent of the single (centred) forms
PAIR_K = (CENTRED_X1 - CENTRED_X0) / (PAIR_X1 - PAIR_X0)   # horizontal squeeze of a pair: as wide as a single form
JOINER = 155                   # offset of the component joiner
COMBINER = 154                 # offset of the Tham Thu combiner
STACK_UP, STACK_TOP, STACK_BOTTOM = 0.45, 19, 94   # share of the height for the glyph above; svg y of the top and bottom edge of the area (a bit lower than a single glyph)
STACK_UP_X = 0.88                                  # the upper glyph is a bit narrower than the lower one
STROKE_UP, STROKE_LOW = 46, 46                    # strokes of the squeezed upper and lower glyph
BRUSH_WEIGHT = 0.8             # the brush font: weight of the brush.html export times this
if light:
    STROKE, STROKE_TONE, STROKE_HALF, STROKE_MARK, STROKE_UP, STROKE_LOW = (round(w * LIGHT) for w in (STROKE, STROKE_TONE, STROKE_HALF, STROKE_MARK, STROKE_UP, STROKE_LOW))
    BRUSH_WEIGHT *= LIGHT
GROW, GROW_Y = 1.18, 60        # the Can/Chi glyphs are enlarged by GROW around the point (middle, svg y = GROW_Y); tones keep their size and corner positions

data = json.load(open(SRC))  # font/glyphs.json
BRUSH = sys.argv[3] if len(sys.argv) > 3 else None
JOBS, RESULTS = {}, {}         # brush outlines: requested on a first run over the glyphs, made by brush_outlines.js, used on the second

# the qatt.js paths: id -> path data, and path data -> ids (glyphs.json holds the data; a few marks of different shapes share it)
_src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', 'qatt.js')).read()
PATHS, IDS = {}, {}
for m in re.finditer(r'<path id="([^"]+)"[^>]*?\sd="([^"]+)"', _src[_src.index('const defaultSvgDefs'):_src.index('const defaultQattEncoding')]):
    PATHS[m.group(1)] = m.group(2)
    IDS.setdefault(m.group(2), []).append(m.group(1))

def letter_ids(g, form):
    """paths of a Can/Chi glyph: form "single" (centred), "left" (onset form, the mark moved onto it) or "right" (rhyme form)"""
    shape, mark = re.match(r',(.+?)(\d?)$', g['q']).groups()
    if form == 'single': return ('v2c-' + shape,) + (('v2c-%s%s' % (shape, mark),) if mark else ())
    if form == 'left': return ('v2-%s-small' % shape,) + (('v2-%s%s@onset' % (shape, mark),) if mark else ())
    return ('v2-' + shape,) + (('v2-%s%s' % (shape, mark),) if mark else ())

def onset_map(shape):
    """moves a mark of the rhyme form of `shape` onto its onset form: the box of the one onto the box of the other, (sx, sy, tx, ty)"""
    def box(i):
        pen = BoundsPen(None); parse_path(PATHS[i], pen); return pen.bounds
    (a0, b0, a1, b1), (c0, d0, c1, d1) = box('v2-' + shape), box('v2-%s-small' % shape)
    sx, sy = (c1 - c0) / (a1 - a0), (d1 - d0) / (b1 - b0)
    return sx, sy, c0 - a0 * sx, d0 - b0 * sy

def outline(ids, width, k=1.0, centre=500, grow=1.0, v=1.0, anchor=None, cx=49.27):
    """Stroke the paths (qatt.js ids) into one outline; k squeezes horizontally, centre is the x the svg x `cx` goes to,
    grow enlarges the drawing around its middle, v squeezes vertically around the svg y `anchor`."""
    out = pathops.Path()
    kx = SX * k * grow
    f = Y0 - GROW_Y * SY * (1 - grow)
    if anchor is not None:       # the point `anchor` stays where it is, the rest is squeezed towards it
        f = (Y0 - (GROW_Y + (anchor - GROW_Y) * grow) * SY) + anchor * SY * grow * v
    matrix = (kx, 0, 0, -SY * grow * v, centre - cx * kx, f)
    if BRUSH or (KAGE and not ids[0].startswith('q')):   # the tones keep their stroked circles in the KAGE font
        # the squeeze and the move are done on the centre lines (in svg units), then the brush is laid on them and the
        # outline is only scaled evenly, so the stroke widths stay; the weight follows the stroke width of the variant
        ids, u = tuple(ids), SY * grow
        key = (ids, round(kx / u, 6), round(SY * grow * v / u, 6), round(matrix[4] / u, 6), round(-f / u, 6),
               round(width / STROKE if KAGE else BRUSH_WEIGHT * width / (STROKE_TONE if ids[0].startswith('q') else STROKE), 6))
        if key not in RESULTS:
            JOBS[key] = {'ids': list(ids), 'm': list(key[1:5]), 'w': key[5]}
            return out
        p = pathops.Path()
        parse_path(RESULTS[key], TransformPen(p.getPen(), (u, 0, 0, -u, 0, 0)))
        p.draw(out.getPen())
    else:
        for i in ids:
            m = matrix
            if i.endswith('@onset'):   # a mark moved from the rhyme form onto the onset form
                i = i[:-6]; sx, sy, tx, ty = onset_map(re.sub(r'^v2-|\d$', '', i))
                m = (matrix[0] * sx, 0, 0, matrix[3] * sy, matrix[0] * tx + matrix[4], matrix[3] * ty + matrix[5])
            p = pathops.Path()
            parse_path(PATHS[i], TransformPen(p.getPen(), m))
            p.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
            p.convertConicsToQuads(0.1)
            p.draw(out.getPen())
    out.simplify(fix_winding=True)
    return out

def make_glyphs():
    global glyphs, cmap, order, adv, halves, tones
    glyphs, cmap, order, adv, halves, tones = {}, {}, ['.notdef'], {}, [], []
    one = lambda ds: tuple(IDS[d][0] for d in ds)   # the tone paths (their data is unique)

    def add(name, path, advance=None):
        pen = TTGlyphPen(None)
        path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyphs[name] = pen.glyph(); order.append(name)
        if advance is not None: adv[name] = advance
    glyphs['.notdef'] = TTGlyphPen(None).glyph()
    for g in data:
        o, tone, letter = g['o'], g['t'] == 'tone', g['t'] in ('unmarked', 'marked', 'chi')
        ids = letter_ids(g, 'single') if letter else one(g['d']) if tone else ()
        pen = TTGlyphPen(None)
        if g['t'] in ('combiner', 'joiner'):   # format characters: a small centred square as placeholder
            x0, y0, x1, y1 = 400, 240, 600, 440
            pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
        else:
            path = outline(ids, STROKE_TONE if tone else STROKE, grow=1.0 if tone else GROW)
            path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        name = 'u%05X' % (BASE + o)
        glyphs[name] = pen.glyph(); cmap[BASE + o] = name; order.append(name)
        if letter:
            # component joiner: the onset form in the left half (.left), the rhyme form in the right half (.right), placed as in a
            # syllable of qatt.js; each is half a cell wide, so the right one is drawn half a cell to the left of its origin
            pair = (PAIR_X0 + PAIR_X1) / 2
            add(name + '.left', outline(letter_ids(g, 'left'), STROKE_HALF, PAIR_K, 500, GROW, cx=pair), ADV // 2)
            add(name + '.right', outline(letter_ids(g, 'right'), STROKE_HALF, PAIR_K, 0, GROW, cx=pair), ADV // 2)
            halves.append(name)
            # Tham Thu: the glyph squeezed into the upper 45 % (.up) or the lower 55 % (.low, and .leftlow, .rightlow for a joined pair)
            add(name + '.up', outline(ids, STROKE_UP, STACK_UP_X, -500, GROW, STACK_UP, STACK_TOP), 0)   # zero width: lies over the cell to its left
            add(name + '.low', outline(ids, STROKE_LOW, 1.0, 500, GROW, 1 - STACK_UP, STACK_BOTTOM))
            add(name + '.leftlow', outline(letter_ids(g, 'left'), STROKE_LOW, PAIR_K, 500, GROW, 1 - STACK_UP, STACK_BOTTOM, pair), ADV // 2)
            add(name + '.rightlow', outline(letter_ids(g, 'right'), STROKE_LOW, PAIR_K, 0, GROW, 1 - STACK_UP, STACK_BOTTOM, pair), ADV // 2)
        if tone:                                    # zero-width variant that lies over the cell to its left, in the smaller size qatt.js uses on a cluster
            pen = TTGlyphPen(None)
            outline(one(g['dm']), STROKE_MARK, 1.0, -500).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
            glyphs[name + '.mark'] = pen.glyph(); adv[name + '.mark'] = 0; order.append(name + '.mark')
            tones.append(name)

make_glyphs()
if BRUSH or KAGE:   # the outlines requested by the first run, then the glyphs again with them
    with tempfile.TemporaryDirectory() as tmp:
        jobs, out = os.path.join(tmp, 'jobs.json'), os.path.join(tmp, 'out.json')
        json.dump(list(JOBS.values()), open(jobs, 'w'))
        here = os.path.dirname(os.path.abspath(__file__))
        subprocess.run(['node', os.path.join(here, 'kage_outlines.js'), KAGE, jobs, out, KAGE_STYLE] if KAGE else ['node', os.path.join(here, 'brush_outlines.js'), BRUSH, jobs, out], check=True)
        RESULTS.update(zip(JOBS.keys(), json.load(open(out))))
    make_glyphs()
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
fb.setupNameTable({'familyName': ('QATT ' + KAGE_STYLE.capitalize() if KAGE else 'QATT Brush' if BRUSH else 'QATT Prototype') + (' Light' if light else ''), 'styleName': 'Regular'})
fb.setupOS2(sTypoAscender=880, sTypoDescender=-120, usWinAscent=880, usWinDescent=120)
fb.setupPost(isFixedPitch=1)
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString
addOpenTypeFeaturesFromString(fb.font, f'''
@FULL = [{' '.join(halves)}];
@LEFT = [{' '.join(n + '.left' for n in halves)}];
@RIGHT = [{' '.join(n + '.right' for n in halves)}];
@UP = [{' '.join(n + '.up' for n in halves)}];
@LOW = [{' '.join(n + '.low' for n in halves)}];
@LEFTLOW = [{' '.join(n + '.leftlow' for n in halves)}];
@RIGHTLOW = [{' '.join(n + '.rightlow' for n in halves)}];
@TONE = [{' '.join(tones)}];
@TONE_MARK = [{' '.join(n + '.mark' for n in tones)}];
@BEFORE_TONE = [@FULL @LEFT @RIGHT @UP @TONE_MARK {cname} {cname}.zw {jname} {jname}.zw];
lookup LEFT {{ sub @FULL by @LEFT; }} LEFT;
lookup RIGHT {{ sub @FULL by @RIGHT; }} RIGHT;
lookup JOINER_ZW {{ sub {jname} by {jname}.zw; }} JOINER_ZW;
lookup UPPER {{ sub @FULL by @UP; }} UPPER;
lookup LOWER {{ sub @FULL by @LOW; }} LOWER;
lookup LEFT_LOWER {{ sub @LEFT by @LEFTLOW; }} LEFT_LOWER;
lookup RIGHT_LOWER {{ sub @RIGHT by @RIGHTLOW; }} RIGHT_LOWER;
lookup COMBINER_ZW {{ sub {cname} by {cname}.zw; }} COMBINER_ZW;
lookup TONE_MARK {{ sub @TONE by @TONE_MARK; }} TONE_MARK;
lookup JOIN {{ sub @FULL' lookup LEFT {jname}' lookup JOINER_ZW @FULL' lookup RIGHT; }} JOIN;
lookup STACK {{
    sub @LEFT' lookup LEFT_LOWER {jname}.zw @RIGHT {cname} @FULL;
    sub [@LEFT @LEFTLOW] {jname}.zw @RIGHT' lookup RIGHT_LOWER {cname} @FULL;
    sub @LEFTLOW {jname}.zw @RIGHTLOW {cname}' lookup COMBINER_ZW @FULL' lookup UPPER;
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
