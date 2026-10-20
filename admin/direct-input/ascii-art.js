// QATT text -> ASCII art (prototype). Every QATT cell (a letter of U+F0000..U+F0099 alone or joined with the joiner, with its tone marks) becomes a block
// of COLS x ROWS characters drawn from the glyph of the font itself (so every cell and tone that the font has is covered, with no table to keep);
// Tham Thư cells (with the combiner U+F009B), lone joiners and tone marks, and all other characters stay as they are.
//
//   await QattAscii.convert(text, { font: "QATT Pen Medium", cols: 22, rows: 12 })   -> string (lines of text); rows default to the height that keeps the cell square
//
// Text without a QATT cell comes back as it is. In a line with cells, a run of other characters stands in the middle row of the blocks.
const QattAscii = (() => {
  const COMBINER = 0xF009B;
  // the ink of a cell lies in x -10..100 and y -100..+20 (baseline 0) of a 100 px em, see the measure of the glyphs
  const X0 = -10, W = 110, Y0 = -100, H = 120, SUPER = 4;
  const RAMP = [[.5, '#'], [.32, '+'], [.16, ':'], [.04, '.']];   // coverage of a character box (after scaling: strokes are thin) -> character

  let ctx = null;
  const glyphBlock = (cell, font, cols, rows) => {
    const sx = cols * SUPER, sy = rows * SUPER;
    if (!ctx) ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    ctx.canvas.width = sx; ctx.canvas.height = sy;
    ctx.clearRect(0, 0, sx, sy);
    ctx.font = `100px "${font}"`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.setTransform(sx / W, 0, 0, sy / H, -X0 * sx / W, -Y0 * sy / H);
    ctx.fillText(cell, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const a = ctx.getImageData(0, 0, sx, sy).data;
    const lines = [];
    for (let r = 0; r < rows; r++) {
      let line = '';
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        for (let y = 0; y < SUPER; y++) for (let x = 0; x < SUPER; x++) sum += a[((r * SUPER + y) * sx + c * SUPER + x) * 4 + 3];
        const cov = Math.min(1, sum / (255 * SUPER * SUPER) * 2);   // thin strokes: a box half full counts as full
        line += (RAMP.find(([t]) => cov >= t) || [0, ' '])[1];
      }
      lines.push(line);
    }
    return lines;
  };

  const convert = async (text, { font = 'QATT Pen Medium', cols = 22, rows = Math.round(cols * H / W / 2) } = {}) => {
    const cells = new Set(QattText.cells(text).map(c => c.cell));
    if (!cells.size) return text;
    await document.fonts.load(`100px "${font}"`, '\u{F0000}');
    const blocks = new Map();
    for (const cell of cells) if (!Array.from(cell).some(ch => ch.codePointAt(0) === COMBINER)) blocks.set(cell, glyphBlock(cell, font, cols, rows));

    const mid = rows >> 1;
    return text.split('\n').map(line => {
      const parts = [];   // { block } or { text }
      let last = 0;
      for (const m of line.matchAll(QattText.CELL)) {
        const block = blocks.get(m[0]);
        if (!block) continue;                                   // Tham Thư: stays text
        if (m.index > last) parts.push({ text: line.slice(last, m.index) });
        parts.push({ block });
        last = m.index + m[0].length;
      }
      if (!parts.length) return line;
      if (last < line.length) parts.push({ text: line.slice(last) });
      const out = [];
      for (let r = 0; r < rows; r++) out.push(parts.map(p => p.block ? p.block[r] : (r === mid ? p.text : ' '.repeat(Array.from(p.text).length))).join(' ').replace(/\s+$/, ''));
      return out.join('\n');
    }).join('\n\n');
  };

  return { convert };
})();
