/*
The logic of the notes app (apps/notes2/) that needs no browser: titles, search text, export and import. Needs the global QattText (js/qatt-text.js) for the cells of QATT text.
A note is { id, text, created, updated } (milliseconds) and may have format: { font, size, align, decoding, bold, italic } (only what differs from the defaults) and style: the css of its style (background, color, text-shadow) as base64 (a string of at most 50000 characters, else it is dropped).

  NotesCore.title(text)                       first line with a character that is no space, trimmed, at most 80 code points ("" if none)
  NotesCore.preview(text)                     the text after the title line on one line, at most 120 code points
  NotesCore.fold(s)                           lowercase without accents, đ as d: what the search compares
  NotesCore.readingText(text, cellReading)    the text with every QATT cell written as its reading (cellReading(cell) -> string, "?" if none)
  NotesCore.matches(text, query, cellReading) whether the folded query is in the text or in its readings (an empty query matches)
  NotesCore.exportJSON(notes)                 the file { version: 1, notes }
  NotesCore.parseImport(json)                 { ok: true, notes } or { ok: false, error }; nothing partial: one bad note refuses the file
  NotesCore.merge(existing, incoming)         by id, the larger `updated` wins (equal: the existing one stays), sorted by `updated` descending: { notes, added, updated }
*/
const NotesCore = (() => {
  // the format of a note ({ font, size, align, decoding, bold, italic }): only valid values are kept
  const cleanFormat = f => {
    if (!f || typeof f !== "object") return null;
    const out = {};
    if (typeof f.font === "string" && f.font.length <= 60) out.font = f.font;
    if (Number.isFinite(f.size)) out.size = Math.min(400, Math.max(50, f.size));
    if (["left", "center", "vertical-center", "vertical"].includes(f.align)) out.align = f.align;
    if (typeof f.decoding === "string" && /^[a-z][a-z0-9_-]*$/.test(f.decoding) && f.decoding.length <= 40) out.decoding = f.decoding;
    if (typeof f.bold === "boolean") out.bold = f.bold;
    if (typeof f.italic === "boolean") out.italic = f.italic;
    return Object.keys(out).length ? out : null;
  };
  const cut = (s, n) => Array.from(s).slice(0, n).join("");
  const lines = text => text.split(/\r?\n/);
  const titleIndex = text => lines(text).findIndex(l => /\S/.test(l));

  const title = text => {
    const i = titleIndex(text);
    return i < 0 ? "" : cut(lines(text)[i].trim(), 80);
  };
  const preview = text => {
    const i = titleIndex(text);
    return i < 0 ? "" : cut(lines(text).slice(i + 1).map(l => l.trim()).filter(Boolean).join(" "), 120);
  };

  const fold = s => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");

  const readingText = (text, cellReading) => text.replace(QattText.CELL, cell => {
    const r = cellReading(cell);
    return r && r !== "?" ? ` ${r} ` : cell;
  });
  const matches = (text, query, cellReading) => {
    const q = fold(query).trim();
    return !q || fold(text).includes(q) || fold(readingText(text, cellReading)).includes(q);
  };

  const exportJSON = notes => JSON.stringify({ version: 1, notes });

  const validNote = n => n && typeof n === "object" && typeof n.id === "string" && n.id !== "" && typeof n.text === "string"
    && Number.isFinite(n.created) && Number.isFinite(n.updated);
  const parseImport = json => {
    let data;
    try { data = JSON.parse(json); } catch (e) { return { ok: false, error: "Not a notes file" }; }
    if (!data || data.version !== 1 || !Array.isArray(data.notes)) return { ok: false, error: "Not a notes file" };
    if (!data.notes.every(validNote)) return { ok: false, error: "The file has an invalid note" };
    return { ok: true, notes: data.notes.map(n => ({ id: n.id, text: n.text, created: n.created, updated: n.updated, ...(typeof n.style === "string" && n.style.length <= 50000 ? { style: n.style } : {}), ...(cleanFormat(n.format) ? { format: cleanFormat(n.format) } : {}) })) };
  };

  const merge = (existing, incoming) => {
    const byId = new Map(existing.map(n => [n.id, { ...n }]));
    const known = new Set(byId.keys());
    let added = 0, updated = 0;
    for (const n of incoming) {
      const old = byId.get(n.id);
      if (!old) { byId.set(n.id, { ...n }); added++; continue; }
      if (n.updated > old.updated) { byId.set(n.id, { ...n }); if (known.has(n.id)) updated++; }
    }
    return { notes: Array.from(byId.values()).sort((a, b) => b.updated - a.updated), added, updated };
  };

  return { title, preview, fold, readingText, matches, exportJSON, parseImport, merge };
})();
if (typeof module !== "undefined") module.exports = NotesCore;
