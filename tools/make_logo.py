"""The logo and the icons of qatt.org: the syllable "tân" (the big symbol of the home page, U+F003F U+F009B U+F003D) in QATT Khai, light on the red tile.

  python3 tools/make_logo.py        # writes img/logo.svg, img/favicon.svg and img/apple-touch-icon.png (Playwright for node renders the PNG)

The outlines come out of fonts/qatt-khai.ttf (shaped with HarfBuzz, so the two halves of the pair stand as in the font), as paths: the logo does not need the font.
"""
import json, os, sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = os.path.join(ROOT, 'fonts', 'qatt-khai.ttf')
TEXT = '\U000F003F\U000F009B\U000F003D'      # tân
RED, CREAM = '#a8362a', '#f7efdc'
TILE = 512


def outline():
    """(path data in svg units with the origin at the middle of the ink, width, height)"""
    font = TTFont(FONT); gs = font.getGlyphSet(); order = font.getGlyphOrder()
    hbf = hb.Font(hb.Face(hb.Blob.from_file_path(FONT)))
    buf = hb.Buffer(); buf.add_str(TEXT); buf.direction = 'ltr'; buf.script = 'Zzzz'; hb.shape(hbf, buf, {})
    pieces, x = [], 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        pieces.append((order[info.codepoint], x + pos.x_offset)); x += pos.x_advance
    bp = BoundsPen(gs)
    for name, dx in pieces: gs[name].draw(TransformPen(bp, (1, 0, 0, 1, dx, 0)))
    x0, y0, x1, y1 = bp.bounds
    sp = SVGPathPen(gs, ntos=lambda v: ('%.1f' % v).rstrip('0').rstrip('.'))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for name, dx in pieces: gs[name].draw(TransformPen(sp, (1, 0, 0, -1, dx - cx, cy)))   # y up -> y down, the middle of the ink at 0 0
    return sp.getCommands(), x1 - x0, y1 - y0


def svg(d, w, h, scale_height, thicken=0, ring=False):
    s = scale_height / h
    body = f'<path d="{d}" fill="{CREAM}" stroke="{CREAM}" stroke-width="{thicken / s:.1f}" stroke-linejoin="round" transform="translate({TILE / 2} {TILE / 2}) scale({s:.4f})"/>'
    frame = f'<rect x="28" y="28" width="456" height="456" rx="72" fill="none" stroke="{CREAM}" stroke-opacity=".55" stroke-width="6"/>' if ring else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {TILE} {TILE}" role="img" aria-label="Qatt.org">'
            f'<rect width="{TILE}" height="{TILE}" rx="96" fill="{RED}"/>{frame}{body}</svg>\n')


if __name__ == '__main__':
    d, w, h = outline()
    out = lambda name, text: open(os.path.join(ROOT, 'img', name), 'w').write(text)
    out('logo.svg', svg(d, w, h, 340, thicken=4, ring=True))          # the logo: the symbol 340 high on the tile, with the thin frame
    out('favicon.svg', svg(d, w, h, 372, thicken=4))                 # the icon: bigger and a little bolder, for 16 to 32 pixels
    if '--no-png' not in sys.argv:   # the PNG of the home screen icon: the icon rendered by Chromium (Playwright for node: NODE_PATH may point to its node_modules)
        import subprocess
        icon = os.path.join(ROOT, 'img', 'favicon.svg'); png = os.path.join(ROOT, 'img', 'apple-touch-icon.png')
        html = '<style>body{margin:0}svg{display:block}</style>' + open(icon).read().replace('<svg ', '<svg width="180" height="180" ').replace('rx="96"', 'rx="0"')   # the home screen icon is a full square: the phone rounds it
        js = ("const { chromium } = require('playwright'); (async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 180, height: 180 } });"
              "await p.setContent(%s); await p.screenshot({ path: %s }); await b.close(); })();") % (json.dumps(html), json.dumps(png))
        subprocess.run(['node', '-e', js], check=True)
    print('ok', round(w), round(h))
