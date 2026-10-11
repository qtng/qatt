#!/usr/bin/env python3
"""Refresh the character data embedded in unicode.html from the QATT Unicode proposal repository.

Usage: python3 tools/update_unicode_data.py PATH/TO/qatt-unicode [unicode.html]

Reads ucd/UnicodeData-draft.txt, ucd/NamesList-draft.txt, ucd/Properties-draft.txt and tools/make_ucd.py
(readings and Nôm annotations of the 22 Cán) of a checkout of https://github.com/qtng/qatt-unicode and
replaces the JSON in <script type="application/json" id="qatt-data"> of unicode.html. The commit of the checkout
is stored in the data and shown on the page.
"""
import ast, json, re, subprocess, sys
from pathlib import Path

REPO = sys.argv[1]
PAGE = Path(sys.argv[2] if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / 'unicode.html')
base = 0xF0000
# --- UnicodeData-draft
chars = {}
for line in open(f'{REPO}/ucd/UnicodeData-draft.txt', encoding='utf-8'):
    if line.startswith('#') or not line.strip(): continue
    f = line.rstrip('\n').split(';')
    off = int(f[0], 16) - base
    chars[off] = dict(o=off, n=f[1], gc=f[2], ccc=int(f[3]), bidi=f[4], notes=[])
# --- NamesList-draft: annotations
cur = None
for line in open(f'{REPO}/ucd/NamesList-draft.txt', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line or line.startswith('#') or line.startswith('@'): continue
    if not line.startswith('\t'):
        cp, name = line.split('\t'); cur = int(cp, 16) - base; assert chars[cur]['n'] == name, (cp, name)
    else:
        kind, text = line.strip()[0], line.strip()[2:]
        chars[cur]['notes'].append([kind, text])
# --- Properties-draft ranges
props = {'Grapheme_Cluster_Break': 'gcb', 'Indic_Conjunct_Break': 'incb', 'Line_Break': 'lb', 'East_Asian_Width': 'eaw', 'Vertical_Orientation': 'vo'}
cur = None
for line in open(f'{REPO}/ucd/Properties-draft.txt', encoding='utf-8'):
    m = re.match(r'# Property: (\w+)', line)
    if m: cur = props.get(m.group(1)); continue
    m = re.match(r'([0-9A-F]+)(?:\.\.([0-9A-F]+))? ; (\S+)', line)
    if m and cur:
        a = int(m.group(1), 16) - base; b = int(m.group(2), 16) - base if m.group(2) else a
        for o in range(a, b + 1): chars[o][cur] = m.group(3)
# --- Cán table from make_ucd.py
src = open(f'{REPO}/tools/make_ucd.py', encoding='utf-8').read()
def tup(name): return ast.literal_eval(re.search(name + r' = (\(.*?\))\n', src, re.S).group(1))
nom, reading = tup('NOM_ANNOTATIONS'), tup('READINGS')
names = [chars[i]['n'].replace('QUOC AM TAN TU ', '').replace(' UNMARKED', '') for i in range(22)]
can = [dict(no=i + 1, nom=nom[i], reading=reading[i], name=names[i]) for i in range(22)]
# --- classify
for o, c in chars.items():
    c['n'] = c['n'].replace('QUOC AM TAN TU ', '')
    if o < 22: c['t'], c['b'] = 'unmarked', o
    elif o < 154:
        c['b'], c['m'] = (o - 22) // 6, (o - 22) % 6 + 1
        c['t'] = 'marked' if c['m'] == 1 else 'chi'
    elif o == 154: c['t'] = 'combiner'
    elif o == 155: c['t'] = 'joiner'
    else: c['t'] = 'tone'
commit = subprocess.check_output(['git', '-C', REPO, 'rev-parse', '--short', 'HEAD'], text=True).strip()
out = dict(source=dict(repo='qtng/qatt-unicode', commit=commit, base=base, size=176, block='Quoc Am Tan Tu', script='Quoc_Am_Tan_Tu'),
           can=can, chars=[chars[o] for o in sorted(chars)])
assert len(out['chars']) == 164 and sum(1 for c in out['chars'] if c['t'] in ('unmarked', 'marked', 'chi')) == 154
data = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
assert '</script' not in data
html = PAGE.read_text(encoding='utf-8')
new, n = re.subn(r'(<script type="application/json" id="qatt-data">).*?(</script>)', lambda m: m.group(1) + data + m.group(2), html, count=1, flags=re.S)
assert n == 1, 'data block not found in ' + str(PAGE)
PAGE.write_text(new, encoding='utf-8')
print(f"{PAGE}: {len(out['chars'])} characters, {len(can)} Cán, qatt-unicode commit {commit}")
