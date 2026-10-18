"""Tones drawn as brush strokes, for a style that has them in fonts/tones.json (Khai): the circles as a brush ring (ring), the half circles as a curved
stroke that ends in a little hook (hook). Font units, y up; both give a pathops.Path. build_font.py takes them instead of the stroked circles of qatt.js.

fonts/tones.json: per style (the KAGE style of build_font.py, e.g. "kaiti") the weight the stroke widths are for, the settings of the two shapes ("ring", "hook") and per tone (the code point
after U+F0000 in hex, "A1" = U+F00A1) its shape, side (1 right, -1 left), rot (turned, degrees anticlockwise) and the ellipse of the standalone glyph ("glyph") and
of the small form over the cell before (".mark"): [cx, cy, rx, ry, stroke width]. A style without an entry keeps the circles of qatt.js."""
import json, math, pathops


def load(path, style, weight=None):
    """the tones of `style`: {code point: (standalone path, mark path)}, or {} when the style has none; their stroke widths are drawn for the weight
    "weight" of the style and follow `weight` (--weight of build_font.py) in proportion"""
    try:
        data = json.load(open(path)).get(style)
    except FileNotFoundError:
        return {}
    if not data: return {}
    k = weight / data['weight'] if weight and data.get('weight') else 1
    out = {}
    for hexcode, t in data['tones'].items():
        draw = (lambda e: ring(*e, **data['ring'])) if t['shape'] == 'ring' else (lambda e: hook(*e, t['side'], rot=t.get('rot', 0), **data['hook']))
        out[0xF0000 + int(hexcode, 16)] = (draw(t['glyph'][:4] + [t['glyph'][4] * k]), draw(t['mark'][:4] + [t['mark'][4] * k]))
    return out


def _polygon(points):
    p = pathops.Path(); p.moveTo(*points[0])
    for q in points[1:]: p.lineTo(*q)
    p.close()
    return p


def ring(cx, cy, rx, ry, w, start=90, turn=380, press=1.5, press_len=0.12, tail=0.15, thin=0.55, side=1.25, axis=30, samples=200):
    """A ring drawn clockwise on the screen from `start` (degrees, 90 = the top) round `turn` degrees (a little more than once: start and end overlap);
    the brush lies at the angle `axis`, so a stroke along it is thin, one across it thick; a pressed start, the end runs out to a point"""
    pts = []
    ax, ay = math.cos(math.radians(axis)), math.sin(math.radians(axis))
    for i in range(samples + 1):
        s = i / samples
        a = math.radians(start - turn * s)               # decreasing angle with y up = clockwise on the screen
        x, y = cx + rx * math.cos(a), cy + ry * math.sin(a)
        dx, dy = rx * math.sin(a), -ry * math.cos(a); L = math.hypot(dx, dy); dx, dy = dx / L, dy / L
        wv = thin + (side - thin) * (dx * ay - dy * ax) ** 2
        if s < press_len: wv *= 1 + (press - 1) * (1 - s / press_len) ** 2
        if s > 1 - tail: wv *= max(0.05, (1 - s) / tail) ** 0.8
        pts.append((x, y, -dy, dx, wv * w / 2))
    p = _polygon([(x + nx * h, y + ny * h) for x, y, nx, ny, h in pts] + [(x - nx * h, y - ny * h) for x, y, nx, ny, h in pts][::-1])
    x, y, _, _, h = pts[0]   # the start: the brush is set down, a round blob (no square cut)
    blob = _polygon([(x + h * math.cos(2 * math.pi * i / 48), y + h * math.sin(2 * math.pi * i / 48)) for i in range(48)])
    return pathops.op(p, blob, pathops.PathOp.UNION, fix_winding=True)


def hook(cx, cy, rx, ry, w, side, turn=140, open_=0, curl=0.86, curl_from=0.45, square=3, press=1.6,
         smoothw=(0.35, 0.4, 1.25), samples=400, smooth=120, rot=0):
    """A half ring as a curved brush stroke: side 1 bulges to the right ')', -1 to the left '('. It starts at the top (`open_` degrees further on the
    open side), runs round `turn` degrees, and from `curl_from` on its radius shrinks to `curl` times, so the end curls in like a hook; `square` > 2 makes
    the bend more of a corner (a superellipse). The width: the press of the start eases into the body (smoothw: [end of the start, start of the end,
    width of the body]) and the body runs out to a point; the start is a half circle in the outline itself. `rot`: turned about the centre, degrees
    anticlockwise"""
    pts = []
    start, e = 90 + side * open_, 2 / square
    for i in range(samples + 1):
        s = i / samples
        a = math.radians(start - side * turn * s)           # right: clockwise on the screen, left: anticlockwise
        k = 1 if s < curl_from else 1 - (1 - curl) * ((s - curl_from) / (1 - curl_from)) ** 1.5
        c_, s_ = math.cos(a), math.sin(a)
        pts.append([cx + rx * k * math.copysign(abs(c_) ** e, c_), cy + ry * k * math.copysign(abs(s_) ** e, s_)])
    if rot:
        cr, sr = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts = [[cx + (x - cx) * cr - (y - cy) * sr, cy + (x - cx) * sr + (y - cy) * cr] for x, y in pts]
    out = []
    for i, (x, y) in enumerate(pts):
        s = i / samples
        q0, q1 = pts[max(0, i - 1)], pts[min(samples, i + 1)]
        dx, dy = q1[0] - q0[0], q1[1] - q0[1]; L = math.hypot(dx, dy) or 1; dx, dy = dx / L, dy / L   # along the line; the width goes across it
        e1 = 0.5 - 0.5 * math.cos(math.pi * min(1, s / smoothw[0]))                                  # 0 -> 1 over the start
        e2 = 0.5 + 0.5 * math.cos(math.pi * max(0, min(1, (s - smoothw[1]) / (1 - smoothw[1]))))   # 1 -> 0 over the end
        out.append((x, y, -dy, dx, (press + (smoothw[2] - press) * e1) * max(0.002, e2) ** 0.7 * w / 2))
    edges = [[[x + nx * h, y + ny * h] for x, y, nx, ny, h in out], [[x - nx * h, y - ny * h] for x, y, nx, ny, h in out]]
    for edge in edges:   # smooth both edges (dents where the bend of the line and the width change meet); the ends stay
        for _ in range(smooth):
            c = [q[:] for q in edge]
            for k in range(1, len(edge) - 1): edge[k] = [(c[k - 1][0] + 2 * c[k][0] + c[k + 1][0]) / 4, (c[k - 1][1] + 2 * c[k][1] + c[k + 1][1]) / 4]
    x, y, nx, ny, h = out[0]; tx, ty = -ny, nx   # the start as a half circle, backwards along the stroke
    cap = [(x + h * (nx * math.cos(q) + tx * math.sin(q)), y + h * (ny * math.cos(q) + ty * math.sin(q))) for q in [math.pi * k / 24 for k in range(1, 24)]]
    p = _polygon([tuple(q) for q in edges[0]] + [tuple(q) for q in edges[1]][::-1] + cap[::-1])
    p.simplify(fix_winding=True)
    return p
