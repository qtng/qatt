"""The name table of the QATT fonts: family and style, copyright, licence, version, maker, full and PostScript name.

build_font.py takes names(family) for its name table. Fonts that are already built are given the same entries without being built again
(the KAGE fonts Serif and Gothic were built with an older state of the build and would change):

  python3 tools/font_names.py fonts/qatt-*.ttf     # writes each .ttf and its .woff2 again
"""
import sys

YEAR = 2026
COPYRIGHT = f'Copyright © {YEAR} qatt.org. All rights reserved.'
LICENSE = ('Not free software and not open source. You may use this font to read, write and print text in the QATT script. '
           'Modifying it, using it or its glyph data as the basis of other fonts or works, and redistributing it '
           'are not allowed without written permission of qatt.org. See https://qatt.org/fonts/LICENSE.txt')
LICENSE_URL = 'https://qatt.org/fonts/LICENSE.txt'
VERSION = 'Version 1.000'


def names(family, style='Regular'):
    """The entries of the name table (keys of fontTools' FontBuilder.setupNameTable)."""
    ps = family.replace(' ', '') + '-' + style.replace(' ', '')
    return {
        'copyright': COPYRIGHT,
        'familyName': family,
        'styleName': style,
        'uniqueFontIdentifier': f'qatt.org: {family} {style}: {YEAR}',
        'fullName': family if style == 'Regular' else f'{family} {style}',
        'version': VERSION,
        'psName': ps,
        'manufacturer': 'qatt.org',
        'vendorURL': 'https://qatt.org',
        'licenseDescription': LICENSE,
        'licenseInfoURL': LICENSE_URL,
    }


NAME_IDS = {'copyright': 0, 'familyName': 1, 'styleName': 2, 'uniqueFontIdentifier': 3, 'fullName': 4, 'version': 5, 'psName': 6,
            'manufacturer': 8, 'vendorURL': 11, 'licenseDescription': 13, 'licenseInfoURL': 14}


def apply(font):
    """Write the entries into a loaded TTFont (family and style are taken from it)."""
    table = font['name']
    family, style = table.getDebugName(1), table.getDebugName(2) or 'Regular'
    for key, value in names(family, style).items():
        table.setName(value, NAME_IDS[key], 3, 1, 0x409)   # Windows, Unicode BMP, English (US)
        table.setName(value, NAME_IDS[key], 1, 0, 0)       # Macintosh, Roman, English
    return family


if __name__ == '__main__':
    from fontTools.ttLib import TTFont
    for path in sys.argv[1:]:
        font = TTFont(path)
        family = apply(font)
        font.save(path)
        font.flavor = 'woff2'
        font.save(path[:-4] + '.woff2')
        print(path, family)
