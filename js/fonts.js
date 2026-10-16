/*
The QATT fonts (fonts/*.woff2) and the sizes offered by font.html and editor.html.

  <select id="font" data-qatt-fonts></select>   all fonts as options (value = CSS family), the choice sets --qfont on <html>;
                                                data-qatt-default="QATT Brush" preselects another font than the default of the list
  <select id="size" data-qatt-sizes></select>   the sizes (value = pixels of a glyph in the grid of font.html)

The script defines the @font-face rules itself and fills these selects when it runs, so load it after them.
*/
const QATT_FONTS = [
  { family: "QATT Serif",          label: "Serif",          file: "qatt-serif", default: true },
  { family: "QATT Gothic",          label: "Gothic",          file: "qatt-gothic" },
  { family: "QATT Gothic Bold",     label: "Gothic bold",     file: "qatt-gothic-bold" },
  { family: "QATT Gothic Wide",     label: "Gothic wide",     file: "qatt-gothic-wide" },
  { family: "QATT Kai",             label: "Kai (regular script)", file: "qatt-kai" },
  { family: "QATT Prototype",       label: "Prototype",       file: "qatt-prototype" },
  { family: "QATT Prototype Light", label: "Prototype light", file: "qatt-prototype-light" },
  { family: "QATT Brush",           label: "Brush-like",      file: "qatt-brush" },
];
const QATT_SIZES = [[20, "60%"], [27, "80%"], [34, "100%", true], [41, "120%"], [51, "150%"], [68, "200%"], [102, "300%"], [136, "400%"]];

(() => {
  const style = document.createElement("style");
  style.textContent = QATT_FONTS.map(f => `@font-face { font-family: "${f.family}"; src: url(fonts/${f.file}.woff2) format("woff2"), url(fonts/${f.file}.ttf) format("truetype"); }`).join("\n");
  document.head.append(style);

  const fill = (select, items) => {
    for (const [value, label, selected] of items) select.append(new Option(label, value, selected, selected));
  };
  document.querySelectorAll("select[data-qatt-fonts]").forEach(select => {
    fill(select, QATT_FONTS.map(f => [f.family, f.label, f.default]));
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
