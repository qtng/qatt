/*
The fonts of the notes app (apps/notes/): the list of the website (QATT_FONTS of js/fonts.js, which also writes the @font-face rules and knows isAdmin()): admins see all fonts, everybody else
only those the website shows them. The order is that of the app (Pen medium, Khai, Serif, Gothic, Gothic wide), the other fonts follow in the order of the website.
VERSION is FONT_VERSION of js/fonts.js (raise it there and here when the fonts are built again).

  NotesFonts.list             [{ family, label, file }] in the order of the menu
  NotesFonts.defaultFamily    the font of a new note: Gothic wide, for those who do not see it the default of the website
  NotesFonts.build(fonts, admin)   the same for a given list of fonts (the website's list) and admin flag
  NotesFonts.apply(family)    sets --qfont on <html>
*/
const NotesFonts = (() => {
  const VERSION = 6;
  const FIRST = ["QATT Pen Medium", "QATT Khai", "QATT Serif", "QATT Gothic", "QATT Gothic Wide"];
  const build = (fonts, admin) => {
    const shown = fonts.filter(f => !f.admin || admin);
    const rank = f => { const i = FIRST.indexOf(f.family); return i < 0 ? FIRST.length : i; };
    const list = shown.map((f, i) => ({ f, i })).sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i).map(({ f }) => ({ family: f.family, label: f.label, file: f.file }));
    const wide = list.find(f => f.family === "QATT Gothic Wide");
    const site = shown.find(f => f.default) || list[0];
    return { list, defaultFamily: (wide || site || { family: FIRST[0] }).family };
  };
  const built = build(typeof QATT_FONTS !== "undefined" ? QATT_FONTS : [], typeof isAdmin === "function" && isAdmin());
  const apply = family => document.documentElement.style.setProperty("--qfont", `"${family}"`);
  return { list: built.list, defaultFamily: built.defaultFamily, VERSION, build, apply };
})();
