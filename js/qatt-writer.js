/*
The writer: a text field in which Quốc Ngữ becomes Quốc Âm Tân Tự (QATT) and/or Chữ Nôm. One editor for both sites: qatt.org/editor.html and chunom.org/chunom/writer.html
(the pages load it from https://qatt.org/js/qatt-writer.js). The pages only give the header and the texts around the card.

  <div id="writer" class="card-box writer"></div>
  QattWriter.mount(document.getElementById('writer'), { switch: 'qatt', storage: 'chunom_writer_' })

  switch  'qatt'  the Chunom writer: Chữ Nôm candidates are always on, the switch "Quốc Âm Tân Tự" turns QATT on and off (off at the start)
          'nom'   the QATT editor: QATT is always on, the switch "Chữ Nôm" turns the candidate list on and off (off at the start)
  storage the prefix of the keys in localStorage (the size and the switch are kept)

  QattWriter.attach(textarea)   QATT in a single text field (admin/admin-slides.html): Telex always on, Enter converts the word before the cursor, no bar, no switches

Needs (loaded before) js/parser.js, js/qatt-text.js, js/fonts.js (the fonts of the list) and, for Telex and the Nôm candidates, ime.js of the Chunom site (VietIme). The page
may put an element with the class `qatt-only` anywhere: it is shown while QATT is on (the class `qatt-on` on <body>).
*/
const QattWriter = (() => {
  const CSS = `
    .writer { padding: 0; overflow: hidden; }
    .writer-pad { padding: .25rem; }
    #field { display: block; width: 100%; min-height: 11.4rem; padding: .75rem .9rem; font-size: 1.5rem; line-height: 1.5; border: none; outline: none; background: transparent;
      color: var(--ink); resize: none; font-family: var(--qfont), system-ui, sans-serif; }
    #field.vertical { writing-mode: vertical-rl; height: 24rem; min-height: 0; resize: horizontal; overflow: auto; }   /* vertical, lines from right to left */
    .writer-bar { display: flex; flex-direction: column; align-items: center; gap: 1.3rem; padding: .7rem .6rem; border-top: 1px solid var(--line);
      background: color-mix(in srgb, currentColor 3%, transparent); }   /* a tint of the text colour: light on a light theme, dark on a dark one */
    @media (min-width: 768px) { .writer-bar { flex-direction: row; justify-content: space-between; } .opts { order: 1; } .bar-buttons { order: 2; } }   /* wide: the switches on the left, the buttons on the right */
    .writer-bar .btn { font-size: .85rem; padding: .25rem .8rem; }
    /* the QATT toolbar above the card, centred: everything about QATT (reading, font, convert); it is there while QATT is on (the space stays, so the card does not move),
       it never wraps, the dropdowns give way */
    .qatt-bar { display: flex; flex-wrap: nowrap; justify-content: center; align-items: center; margin: 0 0 .6rem; min-height: 1.9rem; font-size: .78rem; }
    body:not(.qatt-on) .qatt-bar .group { visibility: hidden; }
    .qatt-bar .group { display: flex; flex: 0 1 auto; align-items: center; gap: .4rem; white-space: nowrap; min-width: 0; }
    .qatt-bar select { flex: 0 1 auto; font-size: .78rem; padding-top: .1rem; padding-bottom: .1rem; min-width: 4.2rem; text-overflow: ellipsis; }
    .qatt-bar .btn { flex: none; font-size: .78rem; padding: .1rem .6rem; }
    #tham-btn { line-height: 1.3; }
    #tham-btn .icon { font-style: normal; font-size: .95rem; }   /* the character is only an icon: not slanted like the text of a button in some themes */
    #tham-btn .wide { display: none; font-size: .78rem; }   /* the name too, on a big screen */
    @media (min-width: 768px) { #tham-btn .wide { display: inline; } }
    /* the buttons of the toolbar are the same in every theme: square with a little rounding (some themes give buttons slanted corners or cut edges) */
    html .qatt-bar .btn, html[data-theme] .qatt-bar .btn { border-radius: .35rem !important; clip-path: none !important; }
    /* the size, in the card above the field */
    .size-bar { display: flex; justify-content: center; padding: .5rem .6rem 0; font-size: .78rem; }
    .size-bar label { display: flex; align-items: center; gap: .3rem; white-space: nowrap; margin: 0; flex: 1 1 8rem; max-width: 15rem; }
    .size-bar input[type=range] { flex: 1 1 auto; width: 0; min-width: 4rem; accent-color: var(--accent); }
    @media (max-width: 419.98px) { #convert-btn .lbl { display: none; } }   /* on a very narrow screen the button is only its symbol */
    #size-label { min-width: 2.6em; color: var(--muted); }
    .qatt-only { display: none; }
    .qatt-on .qatt-only { display: inline-block; }
    .qatt-on li.qatt-only { display: list-item; }
    .bar-buttons, .opts { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: .5rem; }
    .opts { gap: .2rem 1.5rem; }
    .opts .form-check { margin: 0; }
    @media (max-width: 575.98px) {   /* on a phone the switches are a little tighter, and in one row from 360 px on */
      .opts { gap: .2rem .8rem; }
      .opts .form-check { white-space: nowrap; font-size: .85rem; padding-left: 2.2em; }
      .opts .form-check-input { margin-left: -2.2em; }
    }
    @media (min-width: 360px) and (max-width: 575.98px) { .opts { flex-wrap: nowrap; } }
    .opts .form-check-input:checked { background-color: var(--accent); border-color: var(--accent); }
    .status { padding: 0 .9rem .7rem; text-align: center; font-size: .9rem; color: var(--muted); }
    .status b { color: var(--ink); font-weight: 600; }
    /* floating candidate list: ime.js draws it under the caret, the page only sets its colours */
    :root { --vietime-color: var(--ink); --vietime-border: 1px solid var(--line); --vietime-active: rgba(168, 54, 42, .10); --vietime-ring: rgba(168, 54, 42, .45); --vietime-remainder: var(--accent); }
    .vietime { box-shadow: 0 .6rem 1.6rem rgba(60, 40, 20, .22); }
    @media (max-width: 575.98px) { #field { min-height: 14rem; } }
    @media (min-width: 576px) { #field { min-height: 21.6rem; font-size: 1.7rem; } }   /* twice as high on a wide screen */`;

  // the toolbar stands above the card, centred, so that the card is always the same
  const BAR = `
      <div class="group">
        <select id="decoding" autocomplete="off" class="form-select form-select-sm w-auto" aria-label="Reading of the rhyme table" title="Reading of the rhyme table"></select>
        <select id="font" autocomplete="off" class="form-select form-select-sm w-auto" aria-label="Font"></select>
        <button type="button" class="btn btn-quiet" id="convert-btn" title="If the field has QATT characters, convert them to Quốc Ngữ; else convert every Quốc Ngữ word to QATT"><i class="bi bi-arrow-repeat"></i> <span class="lbl" data-vi="Chuyển QATT">Convert QATT</span></button>
        <button type="button" class="btn btn-quiet" id="tham-btn" disabled title="Tham Thư: stack the two characters before the cursor (puts the combiner between them)" data-vi-title="Tham Thư: xếp chồng hai ký tự trước con trỏ (chèn dấu ghép vào giữa)"><span class="icon">品</span><span class="wide"> Tham Thư</span></button>
      </div>
`;

  const HTML = `
    <div class="size-bar">
      <label><input type="range" id="size" min="50" max="400" step="10" value="100" autocomplete="off" aria-label="Size"><span id="size-label">100%</span></label>
    </div>
    <div class="writer-pad">
      <textarea id="field" lang="vi" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="Text" placeholder="Type here…" data-vi-placeholder="Gõ ở đây…"></textarea>
    </div>
    <div class="writer-bar">
      <div class="bar-buttons">
        <button type="button" class="btn btn-quiet qatt-only" id="example-btn"><i class="bi bi-magic"></i> <span data-vi="Ví dụ">Example</span></button>
        <button type="button" class="btn btn-quiet" id="clear-btn"><i class="bi bi-x-lg"></i> <span data-vi="Xóa">Clear</span></button>
        <button type="button" class="btn btn-quiet" id="copy-btn"><span data-vi="Sao chép">Copy</span></button>
      </div>
      <div class="opts">
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="mode-select" autocomplete="off">
          <label class="form-check-label" for="mode-select" id="mode-label"></label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="telex-select" autocomplete="off" checked>
          <label class="form-check-label" for="telex-select">Telex</label>
        </div>
        <div class="form-check form-switch">
          <input class="form-check-input" type="checkbox" role="switch" id="vertical-select" autocomplete="off">
          <label class="form-check-label" for="vertical-select" data-vi="Dọc">Vertical</label>
        </div>
      </div>
    </div>
    <div id="status" class="status mt-4"></div>`;

  const NOT_LETTER = /[^\p{Script=Latin}\p{M}]/u, WORD_END = /[\p{Script=Latin}\p{M}]+$/u;   // Han characters are letters too, but no Quốc Ngữ
  const LETTER = c => c >= 0xF0000 && c <= 0xF0099, JOINER = 0xF009A, COMBINER = 0xF009B;   // a cell is what the font draws as one square: a letter of the block, a joiner or combiner with another letter, and the tone marks after it
  const WINDOW = 64;

  // The behaviour of QATT in a text field (the editor and every field of `attach`): the word before the cursor becomes QATT characters, the cells stay whole (the cursor does not
  // go inside one, Backspace and Delete remove a whole cell, joiners that join nothing go).
  //   o.parser     the VietnameseParser (decoding)
  //   o.on()       whether QATT is on now
  //   o.refresh()  called after every change
  //   o.converted() called when a word became QATT (the editor hides its Nôm candidates)
  //   o.convertOn  'any' (the default): a space, any other character that is no letter, and Enter convert the word before it; 'enter': Enter only
  function wire(typer, o) {
    const { parser } = o;
    // the word that ends right before `end` becomes QATT characters (if there are any)
    const convertBefore = end => {
      const m = WORD_END.exec(typer.value.slice(0, end));
      const text = m && QattText.word(m[0], parser);
      if (!text) return false;
      const start = end - m[0].length, caret = typer.selectionStart;
      typer.setRangeText(text, start, end, 'end');
      const at = caret + text.length - m[0].length;
      typer.setSelectionRange(at, at);
      return true;
    };

    // ----- keeping the cells whole -----
    // the cell that ends after the position ('before'), starts before it ('after') or contains it (no `which`): {start, end}
    const cellAt = (text, pos, which) => {
      const from = Math.max(0, pos - WINDOW), part = text.slice(from, pos + WINDOW);
      for (const m of part.matchAll(QattText.CELL_ANY)) {
        const start = from + m.index, end = start + m[0].length;
        if (which === 'before' ? (start < pos && pos <= end) : which === 'after' ? (start <= pos && pos < end) : (start < pos && pos < end)) return { start, end };
      }
      return null;
    };
    // removes the joiners and combiners that join nothing: a joiner needs a letter that is still an onset before it and a letter after it, a combiner a letter on both sides
    const tidy = () => {
      const text = typer.value, caret = typer.selectionStart, end = typer.selectionEnd;
      const cps = Array.from(text, ch => ch.codePointAt(0));
      let out = '', open = false, prev = 0, i = 0, dropBeforeStart = 0, dropBeforeEnd = 0;
      cps.forEach((c, k) => {
        const next = cps[k + 1], len = c > 0xFFFF ? 2 : 1;
        let keep = true;
        if (LETTER(c)) open = prev !== JOINER && prev !== COMBINER;
        else if (c === JOINER) { keep = open && LETTER(next); open = false; }
        else if (c === COMBINER) { keep = LETTER(prev) && LETTER(next); open = false; }
        else open = false;
        if (keep) { out += String.fromCodePoint(c); prev = c; }
        else { if (i < caret) dropBeforeStart += len; if (i < end) dropBeforeEnd += len; }
        i += len;
      });
      if (out === text) return;
      typer.value = out;
      typer.setSelectionRange(caret - dropBeforeStart, end - dropBeforeEnd);
    };

    // the text as it was before the last edit, to repair a deletion that cut a cell in two (keyboards that bypass the Backspace handler below)
    let before = '';
    typer.addEventListener('beforeinput', () => { before = typer.value; });
    const repairDeletion = () => {
      const fixed = QattText.repairDeletion(before, typer.value, typer.selectionStart);
      if (!fixed) return;
      typer.value = fixed.value;
      typer.setSelectionRange(fixed.caret, fixed.caret);
    };

    // Backspace and Delete remove a whole cell
    typer.addEventListener('beforeinput', e => {
      if (!o.on() || e.isComposing || (e.inputType !== 'deleteContentBackward' && e.inputType !== 'deleteContentForward')) return;
      const pos = typer.selectionStart;
      if (pos !== typer.selectionEnd) return;
      const cell = cellAt(typer.value, pos, e.inputType === 'deleteContentBackward' ? 'before' : 'after');
      if (!cell || typer.value.codePointAt(cell.start) < 0xF0000) return;   // other text: as usual
      e.preventDefault();
      typer.setRangeText('', cell.start, cell.end, 'end');
      typer.setSelectionRange(cell.start, cell.start);
      tidy();
      o.refresh();
    });

    // the cursor (and the ends of a selection) never sit inside a cell: it jumps to the end of the cell when it moved forward, else to its start
    let lastPos = 0;
    const snap = () => {
      if (!o.on() || document.activeElement !== typer) return;
      let a = typer.selectionStart, b = typer.selectionEnd;
      if (a === b) {
        const cell = cellAt(typer.value, a);
        if (cell) a = b = a > lastPos ? cell.end : cell.start;
      } else {
        a = cellAt(typer.value, a)?.start ?? a;
        b = cellAt(typer.value, b)?.end ?? b;
      }
      if (a !== typer.selectionStart || b !== typer.selectionEnd) typer.setSelectionRange(a, b, typer.selectionDirection);
      lastPos = typer.selectionStart;
    };

    // The character just typed ends the word before it. Space and Enter are swallowed when the word was converted (the cells are squares,
    // there is no space between them); any other character stays.
    const flush = (length, swallow) => {
      const pos = typer.selectionStart;
      if (pos !== typer.selectionEnd || pos < length) return;
      if (!NOT_LETTER.test(typer.value.slice(pos - length, pos)) || !convertBefore(pos - length)) return;
      o.converted();   // the word is QATT now: no Nôm candidates
      if (!swallow) return;
      const at = typer.selectionStart;
      typer.setRangeText('', at - length, at, 'end');
    };
    typer.addEventListener('input', e => {
      if (!o.on()) return;
      repairDeletion();
      if (!e.isComposing && (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph')) flush(1, true);
      else if (o.convertOn !== 'enter' && !e.isComposing && e.inputType === 'insertText' && e.data && NOT_LETTER.test(e.data)) flush(e.data.length, /^\s+$/.test(e.data));
      if (!e.isComposing) tidy();
      o.refresh();
    });
    // keyboards that compose whole words (Android): the space comes with the end of the composition
    typer.addEventListener('compositionend', e => setTimeout(() => {
      if (!o.on()) return;
      if (o.convertOn !== 'enter' && e.data && NOT_LETTER.test(e.data.slice(-1))) flush(1, /\s/.test(e.data.slice(-1)));
      tidy();
      o.refresh();
    }, 0));


    document.addEventListener('selectionchange', snap);
    return { convertBefore, tidy };
  }

  function mount(root, options = {}) {
    const mode = options.switch === 'nom' ? 'nom' : 'qatt';
    const prefix = options.storage || 'qatt_writer_';
    if (!document.getElementById('qatt-writer-style')) {
      const style = document.createElement('style'); style.id = 'qatt-writer-style'; style.textContent = CSS; document.head.append(style);
    }
    const wrap = document.createElement('div'), bar = document.createElement('div');
    bar.className = 'qatt-bar'; bar.innerHTML = BAR;
    root.before(wrap); wrap.append(bar, root);
    root.innerHTML = HTML;
    const $ = id => wrap.querySelector('#' + id);
    const typer = $('field'), status = $('status');
    const store = {
      get(key, fallback) { try { const v = localStorage.getItem(prefix + key); return v === null ? fallback : v; } catch { return fallback; } },
      set(key, value) { try { localStorage.setItem(prefix + key, value); } catch { /* storage may be blocked */ } }
    };

    const parser = typeof VietnameseParser !== 'undefined' ? new VietnameseParser() : null;
    const haveQatt = !!parser && typeof QattText !== 'undefined', haveIme = typeof VietIme !== 'undefined';
    // the switch: QATT (Chunom site) or Chữ Nôm (qatt.org); the other part is always on
    const modeBox = $('mode-select');
    $('mode-label').innerHTML = mode === 'qatt' ? 'Quốc Âm Tân Tự' : 'Chữ Nôm';
    if (mode === 'qatt' ? !haveQatt : !haveIme) modeBox.closest('.form-check').hidden = true;
    if (!haveIme) $('telex-select').closest('.form-check').hidden = true;
    let qatt = false, nom = false;   // what is on now
    const apply = () => {
      if (mode === 'qatt') { qatt = haveQatt && modeBox.checked; nom = haveIme; }
      else { qatt = haveQatt; nom = haveIme && modeBox.checked; }
    };

    // Enter picks the first Nôm character; Space does too, except with QATT on, where it converts
    const imeOptions = () => ({ telex: $('telex-select').checked, candidates: nom, returnSelect: nom, spaceSelect: nom && !qatt });
    const ime = haveIme ? new VietIme(typer, imeOptions()) : null;
    $('telex-select').addEventListener('change', () => ime && ime.update(imeOptions()));

    // ---------- QATT ----------
    // the fonts of the list of qatt.org (js/fonts.js defines their @font-face rules; admins also get the fonts marked admin)
    const admin = () => typeof isAdmin === 'function' && isAdmin();
    const FONTS = typeof QATT_FONTS !== 'undefined' ? QATT_FONTS.filter(f => !f.admin || admin()).map(f => [f.family, f.label]) : [];
    const DEFAULT_FONT = 'QATT Pen Medium';
    const decoding = $('decoding'), font = $('font'), size = $('size');
    for (const [name, label] of [['qatt', 'qatt.org'], ['omniglot', 'omniglot']]) decoding.append(new Option(label, name, name === 'qatt', name === 'qatt'));
    for (const [family, label] of FONTS) font.append(new Option(label, family, family === DEFAULT_FONT, family === DEFAULT_FONT));
    const heading = (select, label, vi) => { const value = select.value, g = document.createElement('optgroup'); g.label = label; g.setAttribute('data-vi-label', vi); g.append(...select.options); select.append(g); select.value = value; };
    heading(decoding, 'Choose QATT decoding', 'Lựa chọn cách giải mã');
    heading(font, 'Choose QATT font', 'Lựa chọn phông chữ');


    // QATT characters are in the private use area: the field needs a QATT font in front of the Nôm fonts, also with QATT off (existing QATT characters keep their look)
    function applyFont() {
      document.documentElement.style.setProperty('--qfont', `"${font.value}"`);
      if (ime) ime.update({ fontList: [font.value] });
      typer.style.fontSize = Math.round(size.value * 0.363) + 'px';   // 100% is 36 pixels
      $('size-label').textContent = size.value + '%';
    }
    // a new decoding: every QATT cell is read with the old decoding and written with the new one, other text stays as it is
    decoding.addEventListener('change', () => {
      typer.value = QattText.recode(typer.value, parser, new VietnameseParser(decoding.value));
      parser.setDecoding(decoding.value);
      if (ime) ime.hide();
      refresh();
    });
    font.addEventListener('change', applyFont);   // the font is not stored: every visit starts with Pen
    size.addEventListener('input', () => { store.set('size', size.value); applyFont(); });
    $('vertical-select').addEventListener('change', () => { typer.classList.toggle('vertical', $('vertical-select').checked); typer.focus(); });

    function setState() {
      apply();
      document.body.classList.toggle('qatt-on', qatt);
      status.innerHTML = qatt && nom ? '<b>Space</b> converts QATT, <b>Enter</b> picks first Hán Nôm'
        : nom ? '<b>Space</b> and <b>Enter</b> pick first Hán Nôm'
        : qatt ? '<b>Space</b> and <b>Enter</b> convert QATT'
        : '';
      if (ime) { ime.update(imeOptions()); if (!nom) ime.hide(); }
      applyFont();
      refresh();
    }
    modeBox.addEventListener('change', () => { store.set('on', modeBox.checked); setState(); });   // kept only when somebody chose it

    wire(typer, { parser, on: () => qatt, refresh: () => refresh(), converted: () => ime && ime.hide(), convertOn: 'any' });

    // what depends on the text and the cursor: the Tham Thư button
    function refresh() { showTham(); }
    // Tham Thư (stack): the button is on when the cursor stands behind two letters of QATT (U+F0000..U+F0099) whose second is a single letter (a letter after a joiner is the
    // rhyme of a pair, so it does not count); the tone marks of the second one may stand between it and the cursor. The first can be a single letter or the end of a pair,
    // but not the upper part of a stack. A click puts the combiner U+F009B between the two letters, the cursor stays behind the same characters.
    const tham = $('tham-btn');
    const thamAt = () => {
      if (!qatt || typer.selectionStart !== typer.selectionEnd) return null;
      const before = Array.from(typer.value.slice(0, typer.selectionStart), ch => ch.codePointAt(0)), after = typer.value.codePointAt(typer.selectionStart);
      if (after === JOINER || after === COMBINER) return null;   // the cursor is inside a cell
      let j = before.length - 1;
      while (j >= 0 && before[j] >= 0xF009C && before[j] <= 0xF00A3) j--;
      if (j < 1 || !LETTER(before[j]) || !LETTER(before[j - 1]) || before[j - 2] === COMBINER) return null;
      return before.slice(0, j).reduce((n, c) => n + (c > 0xFFFF ? 2 : 1), 0);   // where the combiner goes: before the second letter
    };
    const showTham = () => { tham.disabled = thamAt() === null; };
    tham.addEventListener('click', () => {
      const at = thamAt();
      if (at === null) return;
      const caret = typer.selectionStart;
      typer.setRangeText(String.fromCodePoint(COMBINER), at, at, 'preserve');
      typer.focus({ preventScroll: true });   // the cursor stays in the field (the button does not keep the focus)
      typer.setSelectionRange(caret + 2, caret + 2);   // behind the same characters
      refresh();
    });
    document.addEventListener('selectionchange', () => { if (document.activeElement === typer) refresh(); });

    // Tham Thư is treated apart, as if the combiner were not there: the two parts of a stack are read one by one and the combiner becomes the IDS character for "above and below"
    // (U+2FF1) between their readings; the other way round such an IDS character between two QATT cells becomes the combiner again
    const IDS_STACK = '\u2FF1', COMBINER_CHAR = String.fromCodePoint(COMBINER);
    // the QATT characters of a text read as Quốc Ngữ (after the decoding chosen): every cell by its reading, separated by spaces; other text as it is
    const readAsQuocNgu = text => text.split(COMBINER_CHAR).map(piece => {
      let out = '', afterCell = false;
      for (const [part] of piece.matchAll(QattText.CELL_ANY)) {
        const isCell = /^[\u{F0000}-\u{F0099}]/u.test(part);
        if (isCell) out += (afterCell ? ' ' : '') + QattText.reading(part, parser);
        else out += (afterCell && /[\p{L}\p{N}]/u.test(part) ? ' ' : '') + part;
        afterCell = isCell;
      }
      return out;
    }).join(IDS_STACK);
    // every Quốc Ngữ word becomes QATT; an IDS stack character right behind and before QATT characters becomes the combiner
    const toQatt = text => text.replace(/[\p{Script=Latin}\p{M}]+/gu, w => QattText.word(w, parser) ?? w)
      .replace(/(?<=[\u{F0000}-\u{F00A3}])\u2FF1(?=[\u{F0000}-\u{F0099}])/gu, COMBINER_CHAR);
    // Convert: with QATT characters in the field they become Quốc Ngữ, else every Quốc Ngữ word becomes QATT; both with the decoding chosen
    $('convert-btn').addEventListener('click', () => {   // no focus: the keyboard of a phone stays closed
      typer.value = QattText.cells(typer.value).length ? readAsQuocNgu(typer.value) : toQatt(typer.value);
      refresh();
    });
    $('example-btn').addEventListener('click', () => { typer.value = QattText.convert('Quốc âm tân tự là tiếng Việt', parser).replace(/\s+/g, ''); refresh(); });   // without the spaces

    // ---------- buttons ----------
    const copyBtn = $('copy-btn');
    copyBtn.addEventListener('click', async () => {
      const label = copyBtn.innerHTML;
      try { await navigator.clipboard.writeText(typer.value); }
      catch { typer.select(); document.execCommand('copy'); }
      copyBtn.textContent = 'Copied';
      setTimeout(() => { copyBtn.innerHTML = label; }, 1400);
    });
    $('clear-btn').addEventListener('click', () => {
      typer.value = '';
      typer.dispatchEvent(new Event('input', { bubbles: true }));
      typer.focus();
    });

    font.value = DEFAULT_FONT;
    size.value = store.get('size', '100');
    modeBox.checked = store.get('on', 'false') === 'true';   // off at the start, on both sites (QATT on the Chunom site, Chữ Nôm on qatt.org)
    setState();
    return { field: typer };
  }
  // QATT in any text field, without the editor around it: Telex is always on, Enter turns the word before the cursor into QATT characters (a space stays a space), the
  // cells stay whole. The field gets a font for the QATT characters. Needs the same scripts as mount() (ime.js of the Chunom site for Telex).
  //   QattWriter.attach(document.querySelector('textarea'))
  function attach(field, options = {}) {
    if (!field || typeof VietnameseParser === 'undefined' || typeof QattText === 'undefined') return null;
    const parser = new VietnameseParser();
    const ime = typeof VietIme !== 'undefined' ? new VietIme(field, { telex: true, candidates: false, returnSelect: false, spaceSelect: false }) : null;
    field.style.fontFamily = 'system-ui, "QATT Pen Medium", sans-serif';   // the QATT font after the text font (before a generic family, or it is never used)
    wire(field, { parser, on: () => true, refresh: () => {}, converted: () => ime && ime.hide(), convertOn: options.convertOn || 'enter' });
    return { field };
  }
  return { mount, attach };
})();
