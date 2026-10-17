"""Vertical text for the QATT fonts: vertical metrics and a `vert` rule, so that a syllable is one square in vertical text.

Without vertical metrics every glyph is 1 em high in vertical text, so the two halves of a syllable lie on top of each other, the joiner takes a whole em and so
does a tone mark (a syllable 3 to 4 em high and 1 em wide). Here the font gets `vhea`/`vmtx` (1 em, the origin of a glyph at the ascent as in horizontal text) and a
`vert` rule (GPOS) that gives the pieces of a syllable their horizontal arrangement back, so that the syllable is one cell of 1 em x 1 em:
  left half (.left, .left45, .left55, .leftlow)   half a half-cell to the left of the middle (the middle of the glyph is already on the middle of the column), no advance
  right half (.right ...)                           half a half-cell to the right, the pen moves on by the 1 em of the cell
  joiner and combiner (.zw)                         no advance
  the upper glyph of a stack (.up, .upw; zero width, lying over the cell to its left in horizontal text)
                                                    moved to the middle of that cell (half its width to the right) and up by 1 em, no advance
  tone marks (.mark, .markw)                        the same move back into the cell, then (tone_offset) inside it in y (the tones of horizontal text hang over and under the
                                                    cell, which in a column lies on the neighbours) and TONE_SIDE out to the side they stand on, at the edge of the letters
A vertical advance is *taken away* from the 1 em that points down, so "no advance" is -1000. Horizontal text is not changed.

  python3 tools/font_vertical.py fonts/qatt-*.ttf     # changes each .ttf and writes its .woff2 again; running it twice does no harm
"""
import sys
from fontTools.ttLib import TTFont, newTable
from fontTools.feaLib.builder import addOpenTypeFeaturesFromString

EM, ASCENT = 1000, 880   # the em and the ascent of the fonts (hhea)


TONE_SIDE = 140   # in vertical text a tone moves this far away from the middle of the column, so that it hangs at the side of the letters (not on them)


def tone_offset(g, glyf, centre):
    """Offset of a tone mark in vertical text, on top of the move back into the cell: the horizontal text puts the tones over and under the cell (y 832..1013 and
    -308..-83), which in a column lies on the neighbours, so they go down or up into the cell (its top is ASCENT, its bottom ASCENT - EM) and out to the side they stand on."""
    g.recalcBounds(glyf)
    mid_x = (g.xMin + g.xMax) / 2 + centre          # middle of the tone in the column (0 is the middle of the column)
    dx = TONE_SIDE if mid_x > 0 else -TONE_SIDE
    top, bottom = ASCENT, ASCENT - EM
    dy = top - g.yMax if g.yMin > ASCENT / 2 else bottom - g.yMin
    return dx, dy


def apply(font):
    """Add the vertical metrics and the vert rule to a loaded TTFont (an old GPOS, vhea and vmtx are replaced: the fonts have no other positioning)."""
    for tag in ('GPOS', 'vhea', 'vmtx'):
        if tag in font: del font[tag]
    order = font.getGlyphOrder()
    glyf, hmtx = font['glyf'], font['hmtx']
    ends = lambda *suffixes: [n for n in order if any(n.endswith(s) for s in suffixes)]
    half = hmtx['uF0000.left'][0]                    # advance of a half; a pair is two of them (1 em, or 1.25 em in the wide font)
    lefts = ends('.left', '.left45', '.left55', '.leftlow')
    rights = ends('.right', '.right45', '.right55', '.rightlow')
    zero = ends('.zw')
    over = ends('.up')                              # over the cell to the left: its middle is half an em away (over a pair: half the pair)
    over_wide = ends('.upw')
    fea = 'feature vert {\n'
    fea += f'    pos [{" ".join(lefts)}] <{-half // 2} 0 0 {-EM}>;\n'
    fea += f'    pos [{" ".join(rights)}] <{half // 2} 0 0 0>;\n'
    fea += f'    pos [{" ".join(zero)}] <0 0 0 {-EM}>;\n'
    fea += f'    pos [{" ".join(over)}] <{EM // 2} {EM} 0 {-EM}>;\n'
    for names, centre in ((ends('.mark'), EM // 2), (ends('.markw'), half)):   # a tone: back into the cell (up by 1 em) and, in vertical text, inside it and at the side
        for n in names:
            dx, dy = tone_offset(glyf[n], glyf, centre)
            fea += f'    pos {n} <{centre + dx} {EM + dy} 0 {-EM}>;\n'
    fea += '} vert;\n'
    addOpenTypeFeaturesFromString(font, fea, tables=['GPOS'])
    # vertical metrics: every glyph 1 em high, its top (the vertical origin) at the ascent like the horizontal drawing
    def tsb(name):
        g = glyf[name]
        if not g.numberOfContours: return 0
        g.recalcBounds(glyf)
        return ASCENT - g.yMax
    font['vhea'] = vhea = newTable('vhea')
    vhea.tableVersion = 0x00011000
    vhea.ascent, vhea.descent, vhea.lineGap = EM // 2, -EM // 2, 0
    vhea.advanceHeightMax = EM; vhea.minTopSideBearing = vhea.minBottomSideBearing = 0; vhea.yMaxExtent = EM
    vhea.caretSlopeRise, vhea.caretSlopeRun, vhea.caretOffset = 0, 1, 0
    vhea.reserved0 = vhea.reserved1 = vhea.reserved2 = vhea.reserved3 = vhea.reserved4 = 0
    vhea.metricDataFormat = 0
    vhea.numberOfVMetrics = len(order)
    font['vmtx'] = vmtx = newTable('vmtx')
    vmtx.metrics = {n: (EM, tsb(n)) for n in order}


if __name__ == '__main__':
    for path in sys.argv[1:]:
        font = TTFont(path)
        apply(font)
        font.save(path)
        font.flavor = 'woff2'
        font.save(path[:-4] + '.woff2')
        print(path)
