"""Tone offsets (fonts/tone-offsets.json, adjusted in admin/font/tone-offsets.html): where the small tone marks of a font sit, per letter in
horizontal text and globally, per tone and per letter in vertical text.

Horizontal: the small tone mark after a pair is moved by [dx, dy] font units when a given letter stands at its corner. A tone at the right
(U+F00A0..A3) looks at the rhyme (the right half right before it), a tone at the left (U+F009C..9F) at the onset (the left half before the
joiner). Vertical (font_vertical.py): a tone is moved into its cell, `y` units inside its top or bottom edge, and `side` units out to the side
it stands on; "tones" overrides the two for a tone, "letters" moves it further per letter as in horizontal text. Single letters, stacks and the
wide font (.markw) have no offsets per letter.

fonts/tone-offsets.json:
  {style: {tone: {letter: [dx, dy]}, ..., "vertical": {"side": 140, "y": 0, "tones": {tone: {"side": .., "y": ..}}, "letters": {tone: {letter: [dx, dy]}}}}}
style as in fonts/tones.json ("kaiti", "pen", "pen-cut", "mincho", "gothic"), tone the code point after U+F0000 in hex ("A1"), letter the number
of the form (0..153, decimal, "104" = U+F0068); font units, dy up. The environment variables QATT_TONE_SIDE and QATT_TONE_Y give side and y of
a style without its own.

fea() gives the horizontal rules as a `kern` feature (horizontal text only); vertical() the values for font_vertical.py; marks() exports the
outlines of the small tone marks for the page."""
import json, os

BASE = 0xF0000
JOINER = 0x9A
RIGHT_TONES = ('A0', 'A1', 'A2', 'A3')
LEFT_TONES = ('9C', '9D', '9E', '9F')
DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts', 'tone-offsets.json')
SIDE = round(float(os.environ.get('QATT_TONE_SIDE', 140)))   # in vertical text a tone moves this far away from the middle of the column (at the side of the letters, not on them)
Y = round(float(os.environ.get('QATT_TONE_Y', 0)))           # and stays this far inside the top or bottom edge of its cell (0: its edge touches the edge of the cell)


def load(style, path=DEFAULT):
    try:
        return json.load(open(path)).get(style) or {}
    except FileNotFoundError:
        return {}


def vertical(style, path=DEFAULT):
    """the values of vertical text of `style`: {'side', 'y', 'tones': {tone: {'side', 'y'}}, 'letters': {tone: {letter: [dx, dy]}}}"""
    v = load(style, path).get('vertical') or {}
    return {'side': v.get('side', SIDE), 'y': v.get('y', Y), 'tones': v.get('tones') or {}, 'letters': v.get('letters') or {}}


def side_y(v, tone):
    """side and y of a tone (hex) in vertical text: its own values, else those of the style"""
    t = v['tones'].get(tone) or {}
    return t.get('side', v['side']), t.get('y', v['y'])


def rules(font, offsets):
    """contextual positioning rules (feature code, one per line) that move the small tone mark after the given letters: {tone: {letter: [dx, dy]}}"""
    order = set(font.getGlyphOrder())
    name = lambda n: 'u%05X' % (BASE + n)
    forms = lambda n, *sfx: [name(n) + s for s in sfx if name(n) + s in order]
    rights = sorted(g for g in order if g.endswith(('.right', '.right45', '.right55')))
    joiner = name(JOINER) + '.zw'
    out = []
    for tone, letters in sorted(offsets.items()):
        if tone not in RIGHT_TONES + LEFT_TONES or not isinstance(letters, dict): continue
        mark = name(int(tone, 16)) + '.mark'
        if mark not in order: continue
        for letter, (dx, dy) in sorted(letters.items(), key=lambda kv: int(kv[0])):
            if not (dx or dy): continue
            n = int(letter)
            if tone in RIGHT_TONES:
                ctx = forms(n, '.right', '.right45', '.right55')
                if ctx: out.append(f'    pos [{" ".join(ctx)}] {mark}\' <{dx} {dy} 0 0>;')
            else:
                ctx = forms(n, '.left', '.left45', '.left55')
                if ctx: out.append(f'    pos [{" ".join(ctx)}] {joiner} [{" ".join(rights)}] {mark}\' <{dx} {dy} 0 0>;')
    return out


def fea(font, style, path=DEFAULT):
    """the feature code of the horizontal offsets of `style` for `font` (a TTFont with the glyphs of build_font.py), '' when it has none"""
    r = rules(font, load(style, path))
    return 'feature kern {\n' + '\n'.join(r) + '\n} kern;\n' if r else ''


def marks(font, path):
    """write the outlines of the small tone marks (.mark, font units, y up; x -1000..0 from the end of the cell before), their bounds and the
    metrics the page needs to `path`"""
    from fontTools.pens.svgPathPen import SVGPathPen
    gs, glyf = font.getGlyphSet(), font['glyf']
    out = {'upm': font['head'].unitsPerEm, 'winAscent': font['OS/2'].usWinAscent, 'winDescent': font['OS/2'].usWinDescent,
           'ascent': font['hhea'].ascent, 'descent': font['hhea'].descent, 'marks': {}, 'bounds': {}}
    for tone in LEFT_TONES + RIGHT_TONES:
        n = 'u%05X.mark' % (BASE + int(tone, 16))
        if n not in gs: continue
        pen = SVGPathPen(gs, lambda v: '%g' % round(v, 1))
        gs[n].draw(pen)
        out['marks'][tone] = pen.getCommands()
        g = glyf[n]; g.recalcBounds(glyf)
        out['bounds'][tone] = [g.xMin, g.yMin, g.xMax, g.yMax]
    json.dump(out, open(path, 'w'), separators=(',', ':'))
