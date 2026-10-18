"""Tone offsets per letter (fonts/tone-offsets.json, adjusted in admin/font/tone-offsets.html): the small tone mark after a pair is moved by
[dx, dy] font units when a given letter stands at its corner. A tone at the right (U+F00A0..A3) looks at the rhyme (the right half right before
it), a tone at the left (U+F009C..9F) at the onset (the left half before the joiner). Single letters, stacks and the wide font (.markw) keep the
global place.

fonts/tone-offsets.json: {style: {tone: {letter: [dx, dy]}}}; style as in fonts/tones.json ("kaiti", "pen", "pen-cut", "mincho", "gothic"), tone
the code point after U+F0000 in hex ("A1"), letter the number of the form (0..153, decimal, "104" = U+F0068); dy up.

fea() gives the rules as a `kern` feature (horizontal text only, so vertical text, where font_vertical.py puts the tones at the side, is not
touched); marks() exports the outlines of the small tone marks for the page."""
import json, os

BASE = 0xF0000
JOINER = 0x9A
RIGHT_TONES = ('A0', 'A1', 'A2', 'A3')
LEFT_TONES = ('9C', '9D', '9E', '9F')
DEFAULT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fonts', 'tone-offsets.json')


def load(style, path=DEFAULT):
    try:
        return json.load(open(path)).get(style) or {}
    except FileNotFoundError:
        return {}


def fea(font, style, path=DEFAULT):
    """the feature code of the offsets of `style` for `font` (a TTFont with the glyphs of build_font.py), '' when it has none"""
    offsets = load(style, path)
    order = set(font.getGlyphOrder())
    name = lambda n: 'u%05X' % (BASE + n)
    forms = lambda n, *sfx: [name(n) + s for s in sfx if name(n) + s in order]
    rights = sorted(g for g in order if g.endswith(('.right', '.right45', '.right55')))
    joiner = name(JOINER) + '.zw'
    rules = []
    for tone, letters in sorted(offsets.items()):
        mark = name(int(tone, 16)) + '.mark'
        if mark not in order or tone not in RIGHT_TONES + LEFT_TONES: continue
        for letter, (dx, dy) in sorted(letters.items(), key=lambda kv: int(kv[0])):
            if not (dx or dy): continue
            n = int(letter)
            if tone in RIGHT_TONES:
                ctx = forms(n, '.right', '.right45', '.right55')
                if ctx: rules.append(f'    pos [{" ".join(ctx)}] {mark}\' <{dx} {dy} 0 0>;')
            else:
                ctx = forms(n, '.left', '.left45', '.left55')
                if ctx: rules.append(f'    pos [{" ".join(ctx)}] {joiner} [{" ".join(rights)}] {mark}\' <{dx} {dy} 0 0>;')
    if not rules: return ''
    return 'feature kern {\n' + '\n'.join(rules) + '\n} kern;\n'


def marks(font, path):
    """write the outlines of the small tone marks (.mark, font units, y up; x -1000..0 from the end of the cell before) and the metrics the page
    needs to `path`"""
    from fontTools.pens.svgPathPen import SVGPathPen
    gs = font.getGlyphSet()
    out = {'upm': font['head'].unitsPerEm, 'winAscent': font['OS/2'].usWinAscent, 'winDescent': font['OS/2'].usWinDescent, 'marks': {}}
    for tone in LEFT_TONES + RIGHT_TONES:
        n = 'u%05X.mark' % (BASE + int(tone, 16))
        if n not in gs: continue
        pen = SVGPathPen(gs, lambda v: '%g' % round(v, 1))
        gs[n].draw(pen)
        out['marks'][tone] = pen.getCommands()
    json.dump(out, open(path, 'w'), separators=(',', ':'))
