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
SY = float(os.environ.get('QATT_SY', 10.6))   # font units per svg unit (vertical): the glyph body (about 820 high, with GROW) lies inside the em square (-120 to 880)
SX = SY * float(os.environ.get('QATT_SXF', 1.2))   # in x: SY times this factor, so that the glyph body is square (the shapes of qatt.js are a little taller than wide)
X0, Y0 = 500 - 49.27 * SX, float(os.environ.get('QATT_Y0', 866))  # svg (0,0) -> font: glyph content centred in the advance, bottoms of the lower glyphs near the baseline
STROKE, STROKE_TONE, STROKE_HALF, STROKE_MARK = 58, 43, 58, 30   # font units (glyph, standalone tone, joiner half, combining tone)
ADV = 1000
PAIR_X0, PAIR_X1 = 5, 104      # svg x extent of the onset forms (left) and rhyme forms (right) of a joined pair
CENTRED_X0, CENTRED_X1 = 19.25, 82.25   # svg x extent of the single (centred) forms
PAIR_K = (CENTRED_X1 - CENTRED_X0) / (PAIR_X1 - PAIR_X0)   # horizontal squeeze of a pair: as wide as a single form
PAIR_GROW = 1.18               # size of a pair (the Can/Chi forms are GROW)
PAIR_M, PAIR_G = float(os.environ.get('QATT_PAIR_M', 100)), float(os.environ.get('QATT_PAIR_G', 80))       # KAGE fonts: margin of a joined pair to the cell edge and gap between its two halves (font units)
PAIR_T = 1000 - 2 * PAIR_M - PAIR_G   # what the two halves share
SPLITS = (45, 50, 55)          # KAGE fonts: share of the left half in per cent; the halves are fitted into these boxes by KAGE
PAIR_K = float(os.environ.get('PAIR_K', PAIR_K)); PAIR_GROW = float(os.environ.get('PAIR_GROW', PAIR_GROW))
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

def outline(ids, width, k=1.0, centre=500, grow=1.0, v=1.0, anchor=None, cx=49.27, fit=None, ink=False):
    """Stroke the paths (qatt.js ids) into one outline; k squeezes horizontally, centre is the x the svg x `cx` goes to,
    grow enlarges the drawing around its middle, v squeezes vertically around the svg y `anchor`. KAGE fonts only: fit=(left, right)
    in font units fits the outline into that box (the strokes are scaled and moved in x, the stroke widths stay); ink=True answers the
    width of the outline in font units (None until the first run has asked for it)."""
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
        if fit: key += (round(fit[0] / u, 4), round(fit[1] / u, 4))
        if ink: key += ('ink',)
        if key not in RESULTS:
            JOBS[key] = {'ids': list(ids), 'm': list(key[1:5]), 'w': key[5]}
            if fit: JOBS[key]['fit'] = [key[6], key[7]]
            if ink: JOBS[key]['ink'] = True
            return None if ink else out
        if ink: return (RESULTS[key][1] - RESULTS[key][0]) * u
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

TONE_MARGIN = 14               # a tone mark stays this far (font units) inside its cell

def keep_inside(path, lo, hi, margin=TONE_MARGIN):
    """Shift a glyph sideways, if need be, so that it lies inside [lo + margin, hi - margin]; the corner tones of qatt.js hang a little out of the cell."""
    x0, _, x1, _ = path.bounds
    d = lo + margin - x0 if x0 < lo + margin else hi - margin - x1 if x1 > hi - margin else 0
    if not d: return path
    out = pathops.Path()
    path.draw(TransformPen(out.getPen(), (1, 0, 0, 1, d, 0)))
    return out

def make_glyphs():
    global glyphs, cmap, order, adv, halves, tones, master_w
    glyphs, cmap, order, adv, halves, tones, master_w = {}, {}, ['.notdef'], {}, [], [], {}
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
            if tone: path = keep_inside(path, 0, ADV)
            path.draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        name = 'u%05X' % (BASE + o)
        glyphs[name] = pen.glyph(); cmap[BASE + o] = name; order.append(name)
        if letter:
            # component joiner: the onset form in the left half (.left), the rhyme form in the right half (.right), placed as in a
            # syllable of qatt.js; each is half a cell wide, so the right one is drawn half a cell to the left of its origin
            pair = (PAIR_X0 + PAIR_X1) / 2
            if KAGE:
                # the halves are made from the single form (or from the left / right form of the symbol if kage.json has one): KAGE draws it fitted into a box of the left or right half of the cell, in
                # three splits (left half 45, 50 or 55 % of what the halves share); the font picks the split by the widths of both letters
                mids = letter_ids(g, 'single')
                master_w[name] = outline(mids, STROKE, grow=GROW, ink=True)
                lids, rids = (tuple(re.sub(r'^v2c-', pre, i) for i in mids) for pre in ('v2l-', 'v2r-'))   # the left and right form of a symbol, if it has one (else the single form)
                for sp in SPLITS:
                    wl = PAIR_T * sp / 100; sfx = '' if sp == 50 else str(sp)
                    add(name + '.left' + sfx, outline(lids, STROKE_HALF, grow=GROW, fit=(PAIR_M, PAIR_M + wl)), ADV // 2)
                    add(name + '.right' + sfx, outline(rids, STROKE_HALF, grow=GROW, fit=(500 - PAIR_M - (PAIR_T - wl), 500 - PAIR_M)), ADV // 2)
            else:
                add(name + '.left', outline(letter_ids(g, 'left'), STROKE_HALF, PAIR_K, 500, PAIR_GROW, cx=pair), ADV // 2)
                add(name + '.right', outline(letter_ids(g, 'right'), STROKE_HALF, PAIR_K, 0, PAIR_GROW, cx=pair), ADV // 2)
            halves.append(name)
            # Tham Thu: the glyph squeezed into the upper 45 % (.up) or the lower 55 % (.low, and .leftlow, .rightlow for a joined pair)
            add(name + '.up', outline(ids, STROKE_UP, STACK_UP_X, -500, GROW, STACK_UP, STACK_TOP), 0)   # zero width: lies over the cell to its left
            add(name + '.low', outline(ids, STROKE_LOW, 1.0, 500, GROW, 1 - STACK_UP, STACK_BOTTOM))
            if KAGE:   # the halves of the lower pair come from the left and right form like the halves of a pair, squeezed in y only
                half = PAIR_T / 2
                add(name + '.leftlow', outline(lids, STROKE_LOW, grow=GROW, v=1 - STACK_UP, anchor=STACK_BOTTOM, fit=(PAIR_M, PAIR_M + half)), ADV // 2)
                add(name + '.rightlow', outline(rids, STROKE_LOW, grow=GROW, v=1 - STACK_UP, anchor=STACK_BOTTOM, fit=(500 - PAIR_M - half, 500 - PAIR_M)), ADV // 2)
            else:
                add(name + '.leftlow', outline(letter_ids(g, 'left'), STROKE_LOW, PAIR_K, 500, GROW, 1 - STACK_UP, STACK_BOTTOM, pair), ADV // 2)
                add(name + '.rightlow', outline(letter_ids(g, 'right'), STROKE_LOW, PAIR_K, 0, GROW, 1 - STACK_UP, STACK_BOTTOM, pair), ADV // 2)
        if tone:                                    # zero-width variant that lies over the cell to its left, in the smaller size qatt.js uses on a cluster
            pen = TTGlyphPen(None)
            keep_inside(outline(one(g['dm']), STROKE_MARK, 1.0, -500), -ADV, 0).draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
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
# KAGE fonts: the letters in three classes by the width of their single form (thirds); a narrow letter on the left of a wide one gets a
# smaller left half (split 45) and the other way round (55), all other pairs 50/50
ws = sorted(w for w in master_w.values() if w) if KAGE else []
if ws:
    t1, t2 = ws[len(ws) // 3], ws[2 * len(ws) // 3]
    wcls = {n: 'N' if master_w[n] < t1 else 'W' if master_w[n] >= t2 else 'M' for n in halves}
    print('width classes: narrow < %d <= mid < %d <= wide (font units); counts' % (t1, t2), {c: sum(1 for v in wcls.values() if v == c) for c in 'NMW'})
cls = lambda c: ' '.join(n for n in halves if wcls[n] == c) if ws else ''
LA, RA, LL, RL, join_first = '@LEFT', '@RIGHT', '@LEFTLOW', '@RIGHTLOW', ''
kage_fea = ''
if ws:
    LA, RA, LL, RL = '@LEFT @LEFT45 @LEFT55', '@RIGHT @RIGHT45 @RIGHT55', '@LEFTLOW @LEFTLOW @LEFTLOW', '@RIGHTLOW @RIGHTLOW @RIGHTLOW'
    join_first = f"sub @FULL_N' lookup LEFT45 {jname}' lookup JOINER_ZW @FULL_W' lookup RIGHT45; sub @FULL_W' lookup LEFT55 {jname}' lookup JOINER_ZW @FULL_N' lookup RIGHT55;"
    kage_fea = f'''
@FULL_N = [{cls('N')}];
@FULL_W = [{cls('W')}];
@LEFT45 = [{' '.join(n + '.left45' for n in halves)}];
@RIGHT45 = [{' '.join(n + '.right45' for n in halves)}];
@LEFT55 = [{' '.join(n + '.left55' for n in halves)}];
@RIGHT55 = [{' '.join(n + '.right55' for n in halves)}];
lookup LEFT45 {{ sub @FULL by @LEFT45; }} LEFT45;
lookup RIGHT45 {{ sub @FULL by @RIGHT45; }} RIGHT45;
lookup LEFT55 {{ sub @FULL by @LEFT55; }} LEFT55;
lookup RIGHT55 {{ sub @FULL by @RIGHT55; }} RIGHT55;
'''
addOpenTypeFeaturesFromString(fb.font, f'''
@FULL = [{' '.join(halves)}];
@LEFT = [{' '.join(n + '.left' for n in halves)}];
@RIGHT = [{' '.join(n + '.right' for n in halves)}];{kage_fea}
@UP = [{' '.join(n + '.up' for n in halves)}];
@LOW = [{' '.join(n + '.low' for n in halves)}];
@LEFTLOW = [{' '.join(n + '.leftlow' for n in halves)}];
@RIGHTLOW = [{' '.join(n + '.rightlow' for n in halves)}];
@TONE = [{' '.join(tones)}];
@TONE_MARK = [{' '.join(n + '.mark' for n in tones)}];
@BEFORE_TONE = [@FULL {LA} {RA} @UP @TONE_MARK {cname} {cname}.zw {jname} {jname}.zw];
lookup LEFT {{ sub @FULL by @LEFT; }} LEFT;
lookup RIGHT {{ sub @FULL by @RIGHT; }} RIGHT;
lookup JOINER_ZW {{ sub {jname} by {jname}.zw; }} JOINER_ZW;
lookup UPPER {{ sub @FULL by @UP; }} UPPER;
lookup LOWER {{ sub @FULL by @LOW; }} LOWER;
lookup LEFT_LOWER {{ sub [{LA}] by [{LL}]; }} LEFT_LOWER;
lookup RIGHT_LOWER {{ sub [{RA}] by [{RL}]; }} RIGHT_LOWER;
lookup COMBINER_ZW {{ sub {cname} by {cname}.zw; }} COMBINER_ZW;
lookup TONE_MARK {{ sub @TONE by @TONE_MARK; }} TONE_MARK;
lookup JOIN {{ {join_first} sub @FULL' lookup LEFT {jname}' lookup JOINER_ZW @FULL' lookup RIGHT; }} JOIN;
lookup STACK {{
    sub [{LA}]' lookup LEFT_LOWER {jname}.zw [{RA}] {cname} @FULL;
    sub [{LA} @LEFTLOW] {jname}.zw [{RA}]' lookup RIGHT_LOWER {cname} @FULL;
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
