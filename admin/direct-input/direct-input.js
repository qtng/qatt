// Direct QATT input (prototype): keys -> shapes, marking strokes and tones, no Quốc Ngữ in between.
// A cell is { on, rh, tone }: on / rh = shape + marking stroke ("c", "m2"), written by QattText.syllable("on,rh,,tone").
(() => {
  // the map, by key position (event.code); rows as in symbols.html
  const MAP = {
    shapes: [
      ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI'],
      ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK'],
      ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN'],
    ],
    names: [
      ['l', '_', 'ng', 'h', 'g', 'c', 'tr', 'd'],
      ['n', 't', 'th', 'nh', 'ch', 'dz', 'x', 'kh'],
      ['s', 'r', 'm', 'b', 'v', 'ph'],
    ],
    marks: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'],                                                     // marking stroke 1..6
    tones: ['Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'BracketLeft', 'BracketRight'],                        // tone 1..8
  };
  const KEYNAME = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']' };
  const label = c => KEYNAME[c] || c.replace(/^(Key|Digit)/, '');

  const $ = id => document.getElementById(id);
  const field = $('field'), live = $('live');
  const parser = new VietnameseParser();

  const render = c => QattText.syllable(`${c.on},${c.rh || ''},,${c.tone || 0}`);
  let cell = null;   // the cell being typed: { start, end, on, rh, tone } (start / end: its place in the field)

  const put = () => {
    const s = render(cell) ?? '';
    field.setRangeText(s, cell.start, cell.end, 'end');
    cell.end = cell.start + s.length;
    status();
  };
  const status = () => {
    if (!cell) { live.textContent = ''; return; }
    const text = render(cell), read = text && QattText.reading(text, parser);
    live.innerHTML = '';
    const g = document.createElement('span'); g.className = 'q'; g.style.fontSize = '2rem'; g.textContent = text || '';
    live.append(g, document.createTextNode(read && read !== '?' ? '  →  ' + read : '  →  ?  (no reading in this decoding)'));
  };
  const fresh = () => ({ start: field.selectionEnd, end: field.selectionEnd, on: '', rh: '', tone: 0 });

  const last = () => (cell.rh ? 'rh' : 'on');
  const press = code => {
    const shape = MAP.shapes.flatMap((row, i) => row.map((c, j) => [c, MAP.names[i][j]])).find(x => x[0] === code);
    const mark = MAP.marks.indexOf(code) + 1, tone = MAP.tones.indexOf(code) + 1;
    if (shape) {
      if (!cell || cell.rh) cell = fresh();               // after two shapes the next one starts a new cell
      if (cell.on) cell.rh = shape[1]; else cell.on = shape[1];
      put();
    } else if (mark) {
      if (!cell || !cell.on) return;
      const k = last();
      cell[k] = cell[k].replace(/\d$/, '') + mark;
      put();
    } else if (tone) {
      if (!cell || !cell.on) return;
      cell.tone = tone;
      put();
    } else if (code === 'Space') {
      cell = null; status();
    } else if (code === 'Backspace') {
      back();
    } else return false;
    return true;
  };

  // Backspace: the last part of the cell being typed (tone, mark, shape), else the whole cell before the caret
  const back = () => {
    if (cell) {
      if (cell.tone) cell.tone = 0;
      else {
        const k = last();
        if (/\d$/.test(cell[k])) cell[k] = cell[k].replace(/\d$/, '');
        else cell[k] = '';
      }
      if (!cell.on) { field.setRangeText('', cell.start, cell.end, 'end'); cell = null; status(); return; }
      put();
      return;
    }
    const pos = field.selectionStart;
    let from = -1, to = -1;
    for (const m of field.value.matchAll(QattText.CELL_ANY)) if (m.index < pos && pos <= m.index + m[0].length) { from = m.index; to = m.index + m[0].length; }
    if (from < 0) return;
    field.setRangeText('', from, Math.min(to, pos), 'end');
    field.setSelectionRange(from, from);
  };

  field.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (e.code === 'Enter') { cell = null; status(); return; }   // a new line: as usual
    if (/^(Arrow|Home|End|Page|Tab|Escape|Delete)/.test(e.code)) { cell = null; status(); return; }
    if (press(e.code)) e.preventDefault();
    else if (e.key.length === 1) e.preventDefault();             // other letters: nothing (only the map writes)
  });
  field.addEventListener('mousedown', () => { cell = null; status(); });
  field.addEventListener('beforeinput', e => { if (e.inputType !== 'insertText' && !e.inputType.startsWith('delete') && e.inputType !== 'insertLineBreak') { cell = null; } });

  // the keys on the screen
  const kb = $('kb');
  const add = (row, code, glyphCode, cls, small) => {
    const b = document.createElement('div');
    b.className = 'key ' + (cls || ''); b.dataset.code = code;
    b.innerHTML = `<span class="k"></span><span class="g"></span><small></small>`;
    b.querySelector('.k').textContent = label(code);
    b.querySelector('.g').textContent = glyphCode;
    b.querySelector('small').textContent = small || '';
    b.addEventListener('pointerdown', e => e.preventDefault());   // no focus change: the keyboard of a phone neither opens nor jumps
    b.addEventListener('click', () => press(code));
    row.append(b);
  };
  MAP.shapes.forEach((codes, i) => {
    const row = document.createElement('div'); row.className = 'row shift' + i;
    codes.forEach((c, j) => add(row, c, QattText.syllable(`${MAP.names[i][j]},,,0`) || '', 'shape', MAP.names[i][j]));
    kb.append(row);
  });
  const mrow = document.createElement('div'); mrow.className = 'row';
  MAP.marks.forEach((c, i) => add(mrow, c, QattText.syllable(`m${i + 1},,,0`) || '', 'mark', 'stroke ' + (i + 1)));
  MAP.tones.forEach((c, i) => add(mrow, c, QattText.syllable(`_,,,${i + 1}`) || '', 'tone', 'tone ' + (i + 1)));
  kb.append(mrow);
  addEventListener('keydown', e => { const k = kb.querySelector(`[data-code="${e.code}"]`); if (k) { k.classList.add('hit'); setTimeout(() => k.classList.remove('hit'), 120); } });

  $('decoding').addEventListener('change', e => {
    field.value = QattText.recode(field.value, parser, new VietnameseParser(e.target.value));
    parser.setDecoding(e.target.value);
    cell = null; status();
  });
  $('ascii').addEventListener('click', async () => {
    const art = $('art');
    art.textContent = await QattAscii.convert(field.value, { cols: +$('asciiSize').value, font: document.documentElement.style.getPropertyValue('--qfont').replace(/"/g, '') || 'QATT Pen Medium' });
    art.hidden = false;
  });
  $('asciiSize').addEventListener('change', () => $('ascii').click());
  $('clear').addEventListener('click', () => { field.value = ''; cell = null; status(); });
  $('copy').addEventListener('click', () => navigator.clipboard && navigator.clipboard.writeText(field.value));
})();
