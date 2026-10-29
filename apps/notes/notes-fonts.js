/*
The five fonts of the notes app (apps/notes/): the files are in fonts/ of qatt.org. js/fonts.js offers Gothic and Gothic wide only to admins, so the app keeps its own list.
VERSION is FONT_VERSION of js/fonts.js (raise it there and here when the fonts are built again).

  NotesFonts.list             [{ family, label, file }] in the order of the menu
  NotesFonts.defaultFamily    the font of a new installation (Gothic wide)
  NotesFonts.install(base)    writes the @font-face rules (base: the root of the site, "/")
  NotesFonts.apply(family)    sets --qfont on <html>
*/
const NotesFonts = (() => {
  const VERSION = 6;
  const list = [
    { family: "QATT Pen Medium", label: "Pen medium", file: "qatt-pen-medium" },
    { family: "QATT Khai", label: "Khai", file: "qatt-khai" },
    { family: "QATT Serif", label: "Serif", file: "qatt-serif" },
    { family: "QATT Gothic", label: "Gothic", file: "qatt-gothic" },
    { family: "QATT Gothic Wide", label: "Gothic wide", file: "qatt-gothic-wide" },
  ];
  const defaultFamily = "QATT Gothic Wide";
  const install = base => {
    const style = document.createElement("style");
    style.textContent = list.map(f => `@font-face { font-family: "${f.family}"; src: url(${base}fonts/${f.file}.woff2?v=${VERSION}) format("woff2"), url(${base}fonts/${f.file}.ttf?v=${VERSION}) format("truetype"); }`).join("\n");
    document.head.append(style);
  };
  const apply = family => document.documentElement.style.setProperty("--qfont", `"${family}"`);
  return { list, defaultFamily, VERSION, install, apply };
})();
