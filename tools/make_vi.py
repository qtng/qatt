#!/usr/bin/env python3
"""Writes vi.html, the Vietnamese copy of index.html (for visitors from a search in Vietnamese): same page, same scripts,
lang="vi" with data-page-lang="vi" (shown in vi when nobody chose a language), the texts of the tags with data-vi written into the
HTML (a crawler sees them without JavaScript), own title, description, canonical and hreflang. Run after every change of index.html."""
import re, html, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
s = (root / 'index.html').read_text(encoding='utf-8')
s = s.replace('<html lang="en">', '<html lang="vi" data-page-lang="vi">', 1)

# tags with data-vi and no tags inside: the English text becomes the Vietnamese one
def tag(m):
    return m.group(1) + html.escape(html.unescape(m.group(2)), quote=False) + m.group(3)
s = re.sub(r'(<([a-z0-9]+)\b[^>]*\bdata-vi="([^"]*)"[^>]*>)([^<]*)(</\2>)',
           lambda m: m.group(1) + html.escape(html.unescape(m.group(3)), quote=False) + m.group(5), s)

head = '''  <title>Quốc Âm Tân Tự – chữ viết tiếng Việt từ thập niên 1840 | Qatt.org</title>
  <meta name="description" content="Quốc Âm Tân Tự (QATT) là lối chữ viết tiếng Việt ra đời thập niên 1840 dưới triều Thiệu Trị, gồm 22 hình cơ bản. Bảng chữ, gõ chữ, phông chữ, Unicode và trò chơi Đánh vần!">
  <link rel="canonical" href="https://qatt.org/vi.html">
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/svg+xml" href="/img/favicon.svg">
  <link rel="icon" type="image/png" sizes="192x192" href="/img/favicon-192.png">
  <link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
  <link rel="alternate" hreflang="en" href="https://qatt.org/">
  <link rel="alternate" hreflang="vi" href="https://qatt.org/vi.html">
  <link rel="alternate" hreflang="x-default" href="https://qatt.org/">
  <meta property="og:locale" content="vi_VN">
  <meta property="og:title" content="Quốc Âm Tân Tự – chữ viết tiếng Việt từ thập niên 1840">
  <meta property="og:description" content="Lối chữ viết tiếng Việt gồm 22 hình cơ bản: bảng chữ, gõ chữ, phông chữ, Unicode.">
  <meta property="og:url" content="https://qatt.org/vi.html">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Qatt.org">
  <meta property="og:image" content="https://qatt.org/qatt.png">
'''
a = s.index('  <title>'); b = s.index('  <script type="application/ld+json">')
s = s[:a] + head + s[b:]
s = s.replace('"url":"https://qatt.org/"', '"url":"https://qatt.org/vi.html","inLanguage":"vi"', 1) if False else s
(root / 'vi.html').write_text(s, encoding='utf-8')
