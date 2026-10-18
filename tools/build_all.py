"""Builds all QATT fonts that are still built (the KAGE fonts) from fonts/glyphs.json and fonts/paths.json, with the vertical metrics (--vertical) and the name table.

  python3 tools/build_all.py                 # writes fonts/qatt-*.ttf and .woff2
  python3 tools/build_all.py --out /some/dir # builds into another folder (to compare with fonts/ first)
  python3 tools/build_all.py serif pen       # only the fonts whose file name contains one of the words

Every font is one call of build_font.py (the commands are in the README, one per font); this list is the one place that has all of them, so that every font
can be built again at any time. A font that is built here must be in js/fonts.js (and the other way round).
"""
import os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
KAGE = ['--kage', 'fonts/paths.json']
FONTS = {   # file name: arguments of build_font.py before the data files
    'qatt-serif': KAGE,
    'qatt-gothic': KAGE + ['--gothic'],
    'qatt-gothic-wide': KAGE + ['--gothic', '--wide'],
    'qatt-pen-extralight': KAGE + ['--pen', '--weight', '0.6', '--label', 'ExtraLight'],
    'qatt-pen-light': KAGE + ['--pen', '--weight', '1.0', '--label', 'Light'],
    'qatt-pen': KAGE + ['--pen', '--weight', '1.6'],
    'qatt-pen-medium': KAGE + ['--pen', '--weight', '2.4', '--label', 'Medium'],
    'qatt-pencut-extralight': KAGE + ['--pen', '--cut', '--weight', '0.6', '--label', 'ExtraLight'],
    'qatt-pencut-light': KAGE + ['--pen', '--cut', '--weight', '1.0', '--label', 'Light'],
    'qatt-pencut': KAGE + ['--pen', '--cut', '--weight', '1.6'],
    'qatt-pencut-medium': KAGE + ['--pen', '--cut', '--weight', '2.4', '--label', 'Medium'],
    'qatt-khai': KAGE + ['--kaiti', '--weight', '2.15'],
}


def build(name, out):
    args = ['python3', os.path.join(HERE, 'build_font.py'), '--vertical'] + FONTS[name] + ['fonts/glyphs.json', os.path.join(out, name)]
    r = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    print(('ok     ' if r.returncode == 0 else 'FAILED ') + name, flush=True)
    if r.returncode: print(r.stdout[-800:], r.stderr[-1500:])
    return r.returncode


if __name__ == '__main__':
    argv = sys.argv[1:]
    out = os.path.join(ROOT, 'fonts')
    if '--out' in argv:
        i = argv.index('--out'); out = os.path.abspath(argv[i + 1]); del argv[i:i + 2]
    os.makedirs(out, exist_ok=True)
    names = [n for n in FONTS if not argv or any(a in n for a in argv)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        codes = list(pool.map(lambda n: build(n, out), names))
    sys.exit(1 if any(codes) else 0)
