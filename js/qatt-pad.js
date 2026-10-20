/*
A writing pad for QATT cells (handwriting.html, handwriting-data.html): a canvas in the coordinates of a cell of js/qatt.js (QattInk.FRAME).

  const pad = QattPad.mount(canvas, { onStroke })   // pointer events (finger, pen, mouse); onStroke(strokes) after every stroke
  pad.strokes()            // [[{ x, y, t }, ...], ...]: x, y in the coordinates of a cell, t in ms since the first touch of this drawing
  pad.undo()               // takes the last stroke back
  pad.clear()
  pad.setGuide(strokes)    // a template drawn faintly behind the strokes (strokes of QattInk results), [] or null for none
  pad.redraw()
The canvas needs a size from the page (CSS, a square); touch-action: none is set here.
*/
const QattPad = (() => {
  const F = QattInk.FRAME;

  const mount = (canvas, { onStroke } = {}) => {
    const ctx = canvas.getContext("2d");
    let strokes = [], current = null, guide = null, scale = 1, t0 = 0;
    canvas.style.touchAction = "none";

    const toCell = e => {
      const r = canvas.getBoundingClientRect();
      return { x: F.x + (e.clientX - r.left) / r.width * F.size, y: F.y + (e.clientY - r.top) / r.height * F.size, t: Math.round(performance.now() - t0) };
    };
    const line = (s, color, width) => {
      ctx.strokeStyle = color; ctx.lineWidth = width * scale; ctx.lineCap = ctx.lineJoin = "round";
      ctx.beginPath();
      s.forEach((p, k) => { const x = (p.x - F.x) * scale, y = (p.y - F.y) * scale; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      if (s.length === 1) ctx.lineTo((s[0].x - F.x) * scale + .1, (s[0].y - F.y) * scale);
      ctx.stroke();
    };
    const redraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setLineDash([4 * scale / 3, 4 * scale / 3]);   // the square of the cell and the middle between onset and rhyme
      line([{ x: -9, y: -9 }, { x: 109, y: -9 }, { x: 109, y: 109 }, { x: -9, y: 109 }, { x: -9, y: -9 }], "#e4d9c0", .5);
      line([{ x: 51, y: -9 }, { x: 51, y: 109 }], "#efe6d2", .5);
      ctx.setLineDash([]);
      if (guide) guide.forEach(s => line(s, "rgba(168, 54, 42, .18)", 4));
      strokes.forEach(s => line(s, "#2b2118", 2.2));
      if (current) line(current, "#2b2118", 2.2);
    };
    const resize = () => {
      const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      canvas.width = r.width * dpr; canvas.height = r.height * dpr;
      scale = canvas.width / F.size;
      redraw();
    };

    canvas.addEventListener("pointerdown", e => {
      canvas.setPointerCapture(e.pointerId);
      if (!strokes.length) t0 = performance.now();
      current = [toCell(e)];
      redraw();
    });
    canvas.addEventListener("pointermove", e => {
      if (!current) return;
      (e.getCoalescedEvents ? e.getCoalescedEvents() : [e]).forEach(c => current.push(toCell(c)));
      redraw();
    });
    const up = () => {
      if (!current) return;
      strokes.push(current); current = null;
      redraw();
      if (onStroke) onStroke(strokes);
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    window.addEventListener("resize", resize);
    resize();

    return {
      strokes: () => strokes,
      undo() { strokes.pop(); redraw(); if (onStroke) onStroke(strokes); },
      clear() { strokes = []; current = null; redraw(); if (onStroke) onStroke(strokes); },
      setGuide(g) { guide = g; redraw(); },
      redraw,
    };
  };

  return { mount };
})();
if (typeof module !== "undefined") module.exports = QattPad;
