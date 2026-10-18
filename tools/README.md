# Tools

The tool of this repository. The font build and everything that belongs to it moved to the private repository `qtng/chunom-private` (feature `fonts`).

## Character data (`unicode.html`): `update_unicode_data.py`

Refreshes the character data embedded in `unicode.html` from a checkout of
[qtng/qatt-unicode](https://github.com/qtng/qatt-unicode) (read only, `ucd/` and `tools/make_ucd.py`):

```sh
python3 tools/update_unicode_data.py PATH/TO/qatt-unicode            # unicode.html in this repository
```

If the data changes (new characters or offsets), the fonts are built again (private repository `qtng/chunom-private`, feature `fonts`).
