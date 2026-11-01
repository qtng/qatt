/*
The QATT fonts (fonts/*.woff2) and the sizes offered by the code table (admin/view.html?f=fonts&p=admin/codetable.html) and editor.html.

  <select id="font" data-qatt-fonts></select>   all fonts as options (value = CSS family), the choice sets --qfont on <html>;
                                                data-qatt-default="QATT Brush" preselects another font than the default of the list
                                                (the fonts marked admin: true are only offered to admins, see isAdmin below)
  <select id="size" data-qatt-sizes></select>   the sizes (value = pixels of a glyph in the grid of the code table (admin/view.html?f=fonts&p=admin/codetable.html))

The script defines the @font-face rules itself and fills these selects when it runs, so load it after them (or with defer).
The font files are found next to the script (../fonts/), so other sites can load it too (the Writer of chunom.org: https://qatt.org/js/fonts.js).
*/
const QATT_FONTS = [
  { family: "QATT Serif",          label: "Serif",          file: "qatt-serif" },
  { family: "QATT Gothic",           label: "Gothic",              file: "qatt-gothic" },
  { family: "QATT Gothic Wide",      label: "Gothic wide",         file: "qatt-gothic-wide" },
  { family: "QATT Pen ExtraLight",   label: "Qatt.org Pen extra light",     file: "qatt-pen-extralight", admin: true },
  { family: "QATT Pen Light",        label: "Qatt.org Pen light",           file: "qatt-pen-light", admin: true },
  { family: "QATT Hannom Pen",       label: "QATT Hannom Pen",              file: "qatt-pen", cjk: true, latin: "hannom-pen-latin", default: true },   // Pen is the subset of Hannom Pen for the QATT letters (U+F0000..F00A3, a small file, the same strokes); the CJK and Nôm characters come from the big file (QATT_CJK_URL), loaded only when one of them is shown
  { family: "QATT Pen Medium",       label: "Qatt.org Pen medium",          file: "qatt-pen-medium" },
  { family: "QATT Pen Wide",         label: "Qatt.org Pen wide",            file: "qatt-pen-wide", admin: true },
  { family: "QATT Pen Cut ExtraLight", label: "Qatt.org Pen cut extra light", file: "qatt-pencut-extralight", admin: true },
  { family: "QATT Pen Cut Light",    label: "Qatt.org Pen cut light",       file: "qatt-pencut-light", admin: true },
  { family: "QATT Pen Cut",          label: "Qatt.org Pen cut",             file: "qatt-pencut", admin: true },
  { family: "QATT Pen Cut Medium",   label: "Qatt.org Pen cut medium",      file: "qatt-pencut-medium", admin: true },
  { family: "QATT Hat Gao",          label: "Hạt Gạo",             file: "qatt-hat-gao" },
  { family: "QATT Snip",             label: "Snip",                file: "qatt-snip" },
  { family: "QATT Manh",             label: "Mảnh",                file: "qatt-manh" },
  { family: "QATT Metro",            label: "Metro",               file: "qatt-metro" },
  { family: "QATT N7K",              label: "N7K",                 file: "qatt-n7k" },
  { family: "QATT Phong Thao",       label: "Phong Thảo",          file: "qatt-phong-thao" },
  { family: "QATT Khai",             label: "Khai (draft)",        file: "qatt-khai", admin: true },
  { family: "QATT Khai Wide",        label: "Khai wide (draft)",   file: "qatt-khai-wide", admin: true },
  { family: "QATT Khai v2",          label: "Khai v2 (draft)",     file: "v2-qatt-khai", admin: true },
  { family: "QATT Prototype Light",  label: "Prototype light",     file: "qatt-prototype-light", admin: true },
  { family: "QATT Brush",            label: "Brush-like",          file: "qatt-brush", admin: true },
];
// Hannom Pen: CJK ideographs, kana, Zhuyin, Hangul compatibility jamo, fullwidth forms and CJK punctuation (the same ranges as chunom-assets/fonts/fonts.css); 9.8 MB, from the Chunom site
const QATT_CJK_URL = "https://chunom.org/chunom-assets/fonts/hannom-pen.woff2";
const QATT_CJK_RANGE = "U+2E80-2FDF, U+2FF0-303F, U+3040-30FF, U+3100-312F, U+3130-318F, U+31A0-31FF, U+3400-4DBF, U+4E00-9FFF, U+F900-FAFF, U+FF00-FFEF, U+16FF0-16FF1, U+20000-3FFFF";
const QATT_RANGE = "U+F0000-F00A3";
// latin: a file with the Latin of the font (ASCII, Latin-1, Quốc Ngữ; Hannom Pen: 28 KB), as a family of its own "<family> Latin", so that only a page that asks for it shows
// Latin in that font (the text field of Qatt.org Notes: qattFieldFont); everywhere else Latin stays in the fonts after it
const qattFieldFont = family => { const f = QATT_FONTS.find(x => x.family === family); return f && f.latin ? `"${family} Latin", "${family}"` : `"${family}"`; };
const QATT_SIZES = [[20, "60%"], [27, "80%"], [34, "100%", true], [41, "120%"], [51, "150%"], [68, "200%"], [102, "300%"], [136, "400%"]];

// an admin: the session of this browser has app_metadata.is_admin (as the palette button of navigation.js); nothing else counts (localStorage.qv_off only keeps a browser out of the
// visit counter). Only what is offered: the font files are public, so this is no protection of them.
const isAdmin = () => {
  try {
    const u = (JSON.parse(localStorage.getItem("sb-kfgqhhmdzboszpwsqkxt-auth-token")) || {}).user;
    return !!(u && u.app_metadata && u.app_metadata.is_admin === true);
  } catch (e) { return false; }
};

// the fonts this visitor may use (all for an admin, else those not marked admin: true); other scripts (apps/notes/) use this list instead of their own
const qattFontsShown = () => QATT_FONTS.filter(f => !f.admin || isAdmin());

const QATT_FONT_DIR = new URL("../fonts/", document.currentScript ? document.currentScript.src : location.href).href;   // the folder fonts/ of qatt.org

(() => {
  const FONTS = qattFontsShown();
  const style = document.createElement("style");
  const face = (family, file, range = "") => `@font-face { font-family: "${family}"; src: url(${QATT_FONT_DIR}${file}.woff2) format("woff2"), url(${QATT_FONT_DIR}${file}.ttf) format("truetype");${range ? ` unicode-range: ${range};` : ""} }`;
  style.textContent = FONTS.map(f => f.cjk
    ? face(f.family, f.file, QATT_RANGE) + `\n@font-face { font-family: "${f.family}"; src: url(${QATT_CJK_URL}) format("woff2"); unicode-range: ${QATT_CJK_RANGE}; }`
    : face(f.family, f.file)).concat(FONTS.filter(f => f.latin).map(f => `@font-face { font-family: "${f.family} Latin"; src: url(${QATT_FONT_DIR}${f.latin}.woff2) format("woff2"); }`))
    .concat(face("QATT Pen", "qatt-pen")).join("\n");   // "QATT Pen" stays as a name of the subset for pages that need only the QATT letters
  document.head.append(style);

  const fill = (select, items) => {
    for (const [value, label, selected] of items) select.append(new Option(label, value, selected, selected));
  };
  document.querySelectorAll("select[data-qatt-fonts]").forEach(select => {
    fill(select, FONTS.map(f => [f.family, f.label, f.default]));
    const group = document.createElement("optgroup");   // a heading inside the dropdown
    group.label = "Choose font";
    group.setAttribute("data-vi-label", "Lựa chọn phông chữ");   // see Lang in navigation.js
    group.append(...select.options);
    select.append(group);
    select.value = select.dataset.qattDefault || QATT_FONTS.find(f => f.default).family;   // moving the options has lost the selection
    const apply = () => document.documentElement.style.setProperty("--qfont", `"${select.value}"`);
    apply();
    select.addEventListener("change", apply);
  });
  document.querySelectorAll("select[data-qatt-sizes]").forEach(select => {
    fill(select, QATT_SIZES);
    const group = document.createElement("optgroup");
    group.label = "Choose size";
    group.setAttribute("data-vi-label", "Lựa chọn cỡ chữ");
    group.append(...select.options);
    select.append(group);
    select.value = QATT_SIZES.find(z => z[2])[0];   // moving the options has lost the selection
  });
})();
