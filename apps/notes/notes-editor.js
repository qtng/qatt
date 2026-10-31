/*
The editing logic of QATT notes (apps/notes/): QATT in a text area, independent of the editor of the website (js/qatt-writer.js), so the app can grow on its own.
Needs the global VietnameseParser (js/parser.js), QattText (js/qatt-text.js) and, for Telex, VietIme (ime.js).

  const ed = NotesEditor.editor(textarea, { parser, onChange })
    Telex is always on; a word becomes QATT characters at a space or any other character that is no letter (and at Enter); the cells stay whole (the cursor never sits
    inside one, Backspace and Delete remove a whole cell, joiners that join nothing go).
    onChange        called after a change the field did not report itself (a variant, Convert, a new decoding)
    ed.variants()   the three slots [marked1, neutral, tham]: { id, view, en, vi, run() } or undefined (not possible at the cursor now)
    ed.candidates() the Chữ Nôm candidates of the Quốc Ngữ word before the cursor (dictionaries of ime.js): [{ glyph, reading, definition, run() }], [] without a word
    ed.nomReady     a promise, resolved when the dictionaries are loaded
    ed.convert()    QATT characters with a reading become Quốc Ngữ, else every Quốc Ngữ word becomes QATT
    ed.setDecoding(name)  every cell is read with the old decoding and written with the new one
  NotesEditor.convertText(text, parser)  the same Convert for a string
*/
const NotesEditor = (() => {
  const NOT_LETTER = /[^\p{Script=Latin}\p{M}]/u, WORD_END = /[\p{Script=Latin}\p{M}]+$/u;   // Han characters are letters too, but no Quốc Ngữ
  const LETTER = c => c >= 0xF0000 && c <= 0xF0099, JOINER = 0xF009A, COMBINER = 0xF009B, NEUTRAL = 0xF009C;   // a cell is what the font draws as one square: a letter of the block, a joiner or combiner with another letter, and the tone marks after it
  const WINDOW = 64;

  // The form with marking stroke 1 (code point + 1 of an unmarked letter) has no reading of its own; it is written as the reading of the unmarked form, in capitals, and read back the same way:
  // a word of two letters or more in capitals whose lowercase is one unmarked letter (a syllable that ends in ông, with or without a tone) becomes that letter + 1.
  const UNMARKED_CELL = /^([\u{F0000}-\u{F0099}])([\u{F009C}-\u{F00A3}]*)$/u;
  const wordToQatt = (w, parser) => {
    if (w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase()) {
      const m = UNMARKED_CELL.exec(QattText.word(w.toLowerCase(), parser) || '');
      if (m && (m[1].codePointAt(0) - 0xF0000) % 7 === 0) return String.fromCodePoint(m[1].codePointAt(0) + 1) + m[2];
    }
    return QattText.word(w, parser);
  };
  // the reading of a cell, "?" if there is none; the form with marking stroke 1 alone (+ tone marks) reads as its unmarked form in capitals
  const cellReading = (cell, parser) => {
    const r = QattText.reading(cell, parser), m = r === '?' && UNMARKED_CELL.exec(cell);
    if (!m || (m[1].codePointAt(0) - 0xF0000) % 7 !== 1) return r;
    const plain = QattText.reading(String.fromCodePoint(m[1].codePointAt(0) - 1) + m[2], parser);
    return plain === '?' ? plain : plain.toUpperCase();
  };

  // The behaviour of QATT in a text field (every field of the editor of the app): the word before the cursor becomes QATT characters, the cells stay whole (the cursor does not
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
      const text = m && wordToQatt(m[0], parser);
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
        return;   // a range is not changed: setting it again would close the copy/cut toolbar of the phone while the handles are dragged (copy and cut give whole cells, see below)
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


    // copy and cut give whole cells (the selection may end inside one)
    const wholeCells = () => {
      const a = typer.selectionStart, b = typer.selectionEnd;
      return a === b ? null : { start: cellAt(typer.value, a)?.start ?? a, end: cellAt(typer.value, b)?.end ?? b };
    };
    typer.addEventListener('copy', e => {
      const r = wholeCells();
      if (!r || !e.clipboardData) return;
      e.clipboardData.setData('text/plain', typer.value.slice(r.start, r.end));
      e.preventDefault();
    });
    typer.addEventListener('cut', e => {
      const r = !typer.readOnly && wholeCells();
      if (!r || !e.clipboardData) return;
      e.clipboardData.setData('text/plain', typer.value.slice(r.start, r.end));
      e.preventDefault();
      typer.setSelectionRange(r.start, r.end);
      document.execCommand('delete');   // as a deletion by the user: events, undo
    });

    document.addEventListener('selectionchange', snap);
    return { convertBefore, tidy };
  }

  // The variants of the characters before the cursor (Tham Thư, Marked 1, Neutral tone): returns a function that gives the three slots in the order marked1, neutral, tham
  // (undefined = not possible now).  o.on() whether QATT is on, o.refresh() called after a variant was applied.
  function makeVariants(typer, o) {
    const utf16 = c => c > 0xFFFF ? 2 : 1;
    const variants = () => {
      if (!o.on() || typer.selectionStart !== typer.selectionEnd) return [];
      const at = typer.selectionStart, before = Array.from(typer.value.slice(0, at), ch => ch.codePointAt(0)), after = typer.value.codePointAt(at);
      if (after === JOINER || after === COMBINER) return [];   // the cursor is inside a cell
      let j = before.length - 1;
      while (j >= 0 && before[j] >= 0xF009C && before[j] <= 0xF00A3) j--;
      const pos = i => before.slice(0, i).reduce((n, c) => n + utf16(c), 0);   // the position of before[i] in the text
      const edit = (from, length, text, caret) => {
        typer.setRangeText(text, from, from + length, 'preserve');
        typer.focus({ preventScroll: true });   // the cursor stays in the field (the dropdown does not keep the focus)
        typer.setSelectionRange(caret, caret);
        o.refresh();
      };
      const list = [], str = (...cps) => String.fromCodePoint(...cps);   // `view`: the characters as they will stand, shown on the button
      // the cell that ends at index k: a letter, or a pair (letter + joiner + letter) with the letter before the joiner
      const cellEnding = k => before.slice(before[k - 1] === JOINER && k >= 2 && LETTER(before[k - 2]) ? k - 2 : k, k + 1);
      const tones = before.slice(j + 1);   // the tone marks between the letter and the cursor stand in the preview too
      if (j >= 1 && LETTER(before[j]) && (before[j] - 0xF0000) % 7 !== 1 && LETTER(before[j - 1]) && before[j - 2] !== COMBINER)   // not when the second letter is the form with stroke 1
        list.push({ id: 'tham', en: 'Tham Thư', vi: 'Tham Thư', view: str(...cellEnding(j - 1), COMBINER, before[j], ...tones), run: () => edit(pos(j), 0, str(COMBINER), at + 2) });   // before the second letter
      if (j >= 0 && LETTER(before[j]) && (before[j] - 0xF0000) % 7 === 0 && before[j - 1] !== JOINER && before[j - 1] !== COMBINER)   // it stands alone: not the second part of a pair or of a stack
        list.push({ id: 'marked1', en: 'Marked 1', vi: 'Dạng đánh dấu 1', view: str(before[j] + 1, ...tones), run: () => edit(pos(j), 2, str(before[j] + 1), at) });
      if (j === before.length - 1 && j >= 0 && LETTER(before[j]))
        list.push({ id: 'neutral', en: 'Neutral tone', vi: 'Thanh ngang', view: str(...cellEnding(j), NEUTRAL), run: () => edit(at, 0, str(NEUTRAL), at + 2) });
      return list;
    };
    // three small buttons with a place of their own each (marked 1, neutral tone, Tham Thư): a middot and off, or a preview of the result (a click does it; the mouse does not take the focus from the field)
    const SLOTS = ['marked1', 'neutral', 'tham'];
    return () => { const list = variants(); return SLOTS.map(id => list.find(v => v.id === id)); };
  }

  // Convert: with QATT characters that have a reading in the text they become Quốc Ngữ, else every Quốc Ngữ word becomes QATT; both with the decoding of the parser
  // Tham Thư is treated apart, as if the combiner were not there: the two parts of a stack are read one by one and the combiner becomes the IDS character for "above and below"
  // (U+2FF1) between their readings; the other way round such an IDS character between two QATT cells becomes the combiner again
  function convertText(text, parser) {
    const IDS_STACK = '\u2FF1', COMBINER_CHAR = String.fromCodePoint(COMBINER), NEUTRAL_CHAR = String.fromCodePoint(NEUTRAL);
    // the QATT characters of a text read as Quốc Ngữ (after the decoding chosen): every cell by its reading, separated by spaces; other text as it is
    const readAsQuocNgu = text => text.split(COMBINER_CHAR).map(piece => {
      let out = '', afterCell = false;
      for (const [part] of piece.matchAll(QattText.CELL_ANY)) {
        const read = /^[\u{F0000}-\u{F0099}]/u.test(part) ? cellReading(part, parser) : '?';
        const isCell = read !== '?';   // a cell without a reading (the form with marking stroke 1) stays as it is, like any other character
        if (isCell) out += (afterCell ? ' ' : '') + read + (part.endsWith(NEUTRAL_CHAR) ? NEUTRAL_CHAR : '');   // the mark of the neutral tone stays behind the word
        else out += (afterCell && /[\p{L}\p{N}]/u.test(part) ? ' ' : '') + part;
        afterCell = isCell;
      }
      return out;
    }).join(IDS_STACK);
    // every Quốc Ngữ word becomes QATT; an IDS stack character right behind and before QATT characters becomes the combiner
    const toQatt = text => text.replace(/[\p{Script=Latin}\p{M}]+/gu, w => wordToQatt(w, parser) ?? w)
      .replace(/(?<=[\u{F0000}-\u{F00A3}])\u2FF1(?=[\u{F0000}-\u{F0099}])/gu, COMBINER_CHAR);
    // Convert: with QATT characters that have a reading in the field they become Quốc Ngữ, else every Quốc Ngữ word becomes QATT; both with the decoding chosen
    // (the parts of a stack are cells of their own; a cell without a reading, such as the form with marking stroke 1, does not count: it stays as it is, and the field can still be converted back)
    const readable = text => text.split(COMBINER_CHAR).some(piece => QattText.cells(piece).some(c => cellReading(c.cell, parser) !== '?'));
    return readable(text) ? readAsQuocNgu(text) : toQatt(text);
  }


  // The editor of an app (apps/notes/): QATT in a text area without any editor around it. Telex always on (ime.js), a word becomes QATT at a space or other character that is no letter,
  // the cells stay whole. The app draws its own buttons.
  //   opts.parser    the VietnameseParser (decoding)
  //   opts.onChange  called after a change the field did not report itself (a variant, Convert, a new decoding)
  //   variants()     the three slots [marked1, neutral, tham]: { id, view, en, vi, run() } or undefined (not possible at the cursor now)
  //   convert()      Convert as the button of the editor; setDecoding(name) writes every cell again after the decoding `name`
  function editor(field, opts) {
    const { parser } = opts, changed = () => opts.onChange && opts.onChange();
    const ime = typeof VietIme !== 'undefined' ? new VietIme(field, { telex: true, candidates: false, returnSelect: false, spaceSelect: false }) : null;
    wire(field, { parser, on: () => true, refresh: () => {}, converted: () => ime && ime.hide(), convertOn: 'any' });
    const slots = makeVariants(field, { on: () => true, refresh: changed });
    // the Chữ Nôm candidates of the word before the cursor; while a phone keyboard composes, the word is still raw Telex
    const nomReady = ime ? VietIme.load() : Promise.resolve();
    let composing = false;
    field.addEventListener('compositionstart', () => { composing = true; });
    field.addEventListener('compositionend', () => { composing = false; });
    const candidates = () => {
      const at = field.selectionStart, next = field.value.charAt(at);
      if (!ime || at !== field.selectionEnd || (next && !NOT_LETTER.test(next))) return [];   // not in the middle of a word
      const m = WORD_END.exec(field.value.slice(0, at));
      if (!m) return [];
      const start = at - m[0].length, word = composing ? VietIme.telex(m[0]) : m[0];
      return VietIme.lookup(word).map(c => ({ ...c, run: () => {   // the glyph takes the place of the word, as typed text (events, the app's undo)
        field.focus({ preventScroll: true });
        field.setSelectionRange(start, at);
        if (!document.execCommand('insertText', false, c.glyph)) {
          field.setRangeText(c.glyph, start, at, 'end');
          field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: c.glyph }));
        }
      } }));
    };
    return {
      field,
      variants: slots,
      candidates,
      nomReady,
      convert() { field.value = convertText(field.value, parser); changed(); },
      setDecoding(name) {
        field.value = QattText.recode(field.value, parser, new VietnameseParser(name, parser.extra));
        parser.setDecoding(name);
        if (ime) ime.hide();
        changed();
      },
    };
  }
  return { editor, convertText };
})();
