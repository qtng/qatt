/*
QATT notes: the list, the editor, the saving. Needs lang.js, parser.js, qatt-text.js, fonts.js, ime.js, notes-editor.js, notes-core.js, notes-db.js.
Routes (history, so the back button of Android works): "#/" the list, "#/n/<id>" a note. A new note is written to the store at its first autosave that is not empty.
window.notesApp = { store, ready, flush(), ed } is for the tests.
*/
(() => {
  const $ = id => document.getElementById(id);
  const extraDecodings = {};   // the tables of decodings.json by name, filled at the start (loadDecodings)
  const parser = new VietnameseParser('qatt', extraDecodings);
  const field = $('note-field'), ed = CeAdapter.wrap(field);   // field: the element, ed: the same as a text field with formats
  const state = { store: null, notes: [], current: null, inStore: false, dirty: false };
  const app = window.notesApp = { store: null, ready: false, parser, flush: () => save(), get ed() { return ed; } };
  let saveTimer = null, snackTimer = null, deleted = null, persistAsked = false;


  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2));

  // ----- snackbar -----
  const hideSnack = () => { clearTimeout(snackTimer); $('snackbar').hidden = true; deleted = null; };
  const snack = (en, vi, { undo = false, sticky = false } = {}) => {
    clearTimeout(snackTimer);
    $('snackbar-text').textContent = Lang.t(en, vi);
    $('undo').hidden = !undo;
    $('snackbar').hidden = false;
    if (!sticky) snackTimer = setTimeout(hideSnack, 5000);
  };
  const warnUnsaved = () => snack('Notes cannot be saved on this device', 'Không thể lưu ghi chú trên thiết bị này', { sticky: true });

  // ----- list -----
  const when = ms => {
    const d = new Date(ms), now = new Date(), locale = Lang.current === 'vi' ? 'vi-VN' : undefined;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString(locale, d.getFullYear() === now.getFullYear() ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
  };
  function renderList() {
    const list = $('notes');
    list.textContent = '';
    state.notes.sort((a, b) => b.updated - a.updated);
    const query = $('search').value, cellReading = cell => QattText.reading(cell, parser);
    const shown = state.notes.filter(n => NotesCore.matches(n.text, query, cellReading));
    for (const note of shown) {
      const li = document.createElement('li'), row = document.createElement('button');
      row.type = 'button'; row.className = 'note-row'; row.dataset.id = note.id;
      const look = styleOf(note);   // each note is drawn in its own style
      row.style.background = look.bg; row.style.color = look.ink; row.style.textShadow = look.shadow;
      const title = document.createElement('span'), title_ = NotesCore.title(note.text);
      title.className = 'note-title';
      if (title_) title.textContent = title_;
      else { title.setAttribute('data-vi', 'Không có tiêu đề'); title.textContent = 'Untitled'; }
      const preview = document.createElement('span'), date = document.createElement('span');
      preview.className = 'note-preview'; preview.textContent = NotesCore.preview(note.text);
      date.className = 'note-date'; date.textContent = when(note.updated);
      row.append(title, preview, date);
      li.append(row);
      list.append(li);
    }
    $('empty').hidden = state.notes.length > 0;
    $('no-results').hidden = state.notes.length === 0 || shown.length > 0;
  }

  // ----- saving -----
  const askPersist = () => {
    if (persistAsked || !navigator.storage || !navigator.storage.persist) return;
    persistAsked = true;
    navigator.storage.persist().catch(() => {});
  };
  function schedule() {
    state.dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 400);
  }
  let saving = Promise.resolve();
  function save() {
    clearTimeout(saveTimer); saveTimer = null;
    const note = state.current;
    if (!note || !state.dirty) return saving;
    state.dirty = false;
    if (ed.value === '' && !state.inStore) return saving;   // a new note that stays empty
    note.text = ed.value;
    const runs = ed.runs;
    if (runs.length) note.runs = runs; else delete note.runs;
    note.updated = Date.now();
    const copy = { ...note };
    saving = saving.then(async () => {
      try {
        await state.store.put(copy);
        state.inStore = true;
        const i = state.notes.findIndex(n => n.id === copy.id);
        if (i < 0) state.notes.push(copy); else state.notes[i] = copy;
        askPersist();
      } catch (e) { warnUnsaved(); }
    });
    return saving;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', () => { save(); });

  // ----- editor -----
  const editor = NotesEditor.editor(ed, { parser, onChange: () => { schedule(); showTitle(); renderKeys(); remember(false); } });
  const showTitle = () => { $('editor-title').textContent = NotesCore.title(ed.value); };
  field.addEventListener('input', () => { schedule(); showTitle(); renderKeys(); remember(true); });

  // undo and redo: the field changes by script (Telex, variants, Convert), which the browser does not undo, so the app keeps its own steps (the text and the cursor); typing within half a second is one step
  const undoLog = { steps: [], at: 0, time: 0 };
  const cursor = () => ({ text: ed.value, runs: ed.runs, start: ed.selectionStart, end: ed.selectionEnd });
  function buttons() { $('undo-btn').disabled = undoLog.at <= 0; $('redo-btn').disabled = undoLog.at >= undoLog.steps.length - 1; }
  function resetHistory() { undoLog.steps = [cursor()]; undoLog.at = 0; undoLog.time = 0; buttons(); }
  function remember(typing) {
    const last = undoLog.steps[undoLog.at];
    if (last && last.text === ed.value && JSON.stringify(last.runs) === JSON.stringify(ed.runs)) { if (typing) last.start = ed.selectionStart, last.end = ed.selectionEnd; return; }
    const now = Date.now();
    undoLog.steps.length = undoLog.at + 1;
    if (typing && undoLog.time && now - undoLog.time < 500 && undoLog.at > 0) undoLog.steps[undoLog.at] = cursor();
    else { undoLog.steps.push(cursor()); undoLog.at = undoLog.steps.length - 1; if (undoLog.steps.length > 300) { undoLog.steps.shift(); undoLog.at--; } }
    undoLog.time = typing ? now : 0;
    buttons();
  }
  function goto(i) {
    if (i < 0 || i >= undoLog.steps.length) return;
    undoLog.at = i; undoLog.time = 0;
    const s = undoLog.steps[i];
    ed.setModel(s.text, s.runs); ed.setSelectionRange(s.start, s.end);
    schedule(); showTitle(); renderKeys(); buttons();
  }
  for (const [id, step] of [['undo-btn', -1], ['redo-btn', 1]]) {
    $(id).addEventListener('pointerdown', e => e.preventDefault());   // the keyboard stays
    $(id).addEventListener('click', () => goto(undoLog.at + step));
  }

  // reading mode (an existing note opens read-only, no keyboard) and editing mode (a new note, the pencil of the bar, a double tap in the text); the check mark leads back to reading
  function setEditing(on) {
    ed.readOnly = !on;
    if (on) field.removeAttribute('inputmode'); else field.setAttribute('inputmode', 'none');
    const icon = $('edit-btn').querySelector('i');
    icon.className = on ? 'bi bi-check-lg' : 'bi bi-pencil';
    $('edit-btn').setAttribute('aria-pressed', String(on));
    $('edit-btn').setAttribute('aria-label', on ? Lang.t('Done', 'Xong') : Lang.t('Edit', 'Chỉnh sửa'));
    $('convert').hidden = !on;
    if (!on) { keybar.hidden = true; if (document.activeElement === field) field.blur(); }
    else if (document.activeElement === field) { keybar.hidden = false; renderKeys(); }   // the field kept the focus from the tap in the reading view
  }
  // the field was not editable and had inputmode none when the tap began: focus it again after the change so the phone shows the cursor and the keyboard, and put the cursor back after the double tap has selected its word
  function focusEditing(at) {
    field.focus();
    for (const wait of [0, 60, 200]) setTimeout(() => {
      if (ed.readOnly) return;
      if (document.activeElement !== field) field.focus();
      if (at != null) ed.setSelectionRange(at, at);
    }, wait);
  }
  $('edit-btn').addEventListener('click', () => { const on = ed.readOnly; setEditing(on); if (on) focusEditing(); else save(); });
  let lastTap = { t: 0, x: 0, y: 0 };
  field.addEventListener('pointerup', e => {   // a double tap in the reading view starts editing (the event dblclick is not sent on every phone)
    if (!ed.readOnly) return;
    if (e.timeStamp - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { lastTap.t = 0; const at = ed.selectionStart; setEditing(true); focusEditing(at); }   // the double tap selected a word: the cursor goes to its start, nothing is replaced by the next key
    else lastTap = { t: e.timeStamp, x: e.clientX, y: e.clientY };
  });
  document.addEventListener('langchange', () => setEditing(!ed.readOnly));

  function showEditor(note, fresh) {
    state.current = note; state.inStore = !fresh; state.dirty = false;
    ed.setModel(note.text, note.runs);
    resetHistory();
    showTitle();
    closeMenu();
    $('view-list').hidden = true;
    $('view-editor').hidden = false;
    field.scrollTop = 0;
    applyStyle(note);
    applyFormat(note);
    setEditing(fresh);
    if (fresh) field.focus();
  }
  async function showList() {
    await save();
    state.current = null;
    closeMenu();
    $('view-editor').hidden = true;
    $('view-list').hidden = false;
    renderList();
  }
  async function route() {
    const m = /^#\/n\/(.+)$/.exec(location.hash);
    if (!m) return showList();
    const id = decodeURIComponent(m[1]);
    if (state.current && state.current.id === id) return;
    await save();
    const note = state.notes.find(n => n.id === id);
    if (!note) { history.replaceState(null, '', '#/'); return showList(); }
    showEditor({ ...note }, false);
  }
  window.addEventListener('popstate', route);

  const go = hash => { history.pushState({ fromList: true }, '', hash); return route(); };
  $('new-note').addEventListener('click', () => {
    const now = Date.now(), note = { id: newId(), text: '', created: now, updated: now, format: { size: 150 }, style: NotesStyles.encode(NotesStyles.css(state.notes.length === 0 ? styleById('neon-glow') : NotesStyles.random())) };   // the first note is Neon night, later ones get a random style
    history.pushState({ fromList: true }, '', '#/n/' + encodeURIComponent(note.id));
    $('view-list').hidden = true;
    showEditor(note, true);
  });
  $('notes').addEventListener('click', e => {
    const row = e.target.closest('.note-row');
    if (row) go('#/n/' + encodeURIComponent(row.dataset.id));
  });
  $('back').addEventListener('click', () => {
    if (history.state && history.state.fromList) history.back();
    else { history.replaceState(null, '', '#/'); route(); }
  });

  // ----- key bar: the variants of the characters before the cursor and Convert; it sits above the keyboard (the editor view is cut at the top of the keyboard) -----
  const keybar = $('keybar'), variantBtns = Array.from(document.querySelectorAll('#keybar .variant'));
  let shownKeys = null;
  function renderKeys() {
    showFormat();
    const slots = editor.variants(), key = slots.map(v => (v ? v.id + v.view : '')).join();
    if (key === shownKeys) return;
    shownKeys = key;
    variantBtns.forEach((btn, i) => {
      const v = slots[i];
      btn.disabled = !v;
      btn.textContent = v ? v.view : '·';
      btn.title = v ? Lang.t(v.en, v.vi) : '';
    });
  }
  // bold, italic and size of the selected text (or of the text typed next); the changes are steps of the undo list too
  const showFormat = () => {
    const f = ed.formatState();
    $('sel-bold').setAttribute('aria-pressed', String(f.b === 1));
    $('sel-italic').setAttribute('aria-pressed', String(f.i === 1));
  };
  const stepSize = dir => {
    const now = ed.formatState().z || 100, sizes = CeAdapter.SIZES;
    const next = dir > 0 ? sizes.find(z => z > now) : [...sizes].reverse().find(z => z < now);
    if (next) changeFormat('z', next === 100 ? 0 : next);
  };
  const changeFormat = (kind, value) => { ed.format(kind, value); schedule(); remember(false); showFormat(); };
  $('sel-bold').addEventListener('click', () => changeFormat('b', ed.formatState().b === 1 ? 0 : 1));
  $('sel-italic').addEventListener('click', () => changeFormat('i', ed.formatState().i === 1 ? 0 : 1));
  $('sel-smaller').addEventListener('click', () => stepSize(-1));
  $('sel-larger').addEventListener('click', () => stepSize(1));
  const keepFocus = e => e.preventDefault();   // a click on the bar does not take the focus (and the keyboard) from the field
  ['sel-bold', 'sel-italic', 'sel-smaller', 'sel-larger'].forEach(id => $(id).addEventListener('pointerdown', keepFocus));
  variantBtns.forEach((btn, i) => { btn.addEventListener('pointerdown', keepFocus); btn.addEventListener('click', () => { const v = editor.variants()[i]; if (v) v.run(); }); });
  field.addEventListener('focus', () => { if (ed.readOnly) return; keybar.hidden = false; renderKeys(); });
  field.addEventListener('blur', () => { keybar.hidden = true; });
  document.addEventListener('selectionchange', () => { if (document.activeElement === field) renderKeys(); });
  document.addEventListener('langchange', () => { shownKeys = null; renderKeys(); });
  const vv = window.visualViewport;
  function fitKeyboard() {   // the keyboard covers the lower part of the screen: the editor view ends above it
    const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
    $('view-editor').style.bottom = inset + 'px';
  }
  if (vv) { vv.addEventListener('resize', fitKeyboard); vv.addEventListener('scroll', fitKeyboard); }

  // ----- menu -----
  const MENUS = [['menu-btn', 'menu'], ['list-menu-btn', 'list-menu'], ['style-btn', 'style-menu']];
  function closeMenu() { for (const [button, menu] of MENUS) { $(menu).hidden = true; $(button).setAttribute('aria-expanded', 'false'); } }
  for (const [button, menu] of MENUS) $(button).addEventListener('click', e => {
    e.stopPropagation();
    const open = $(menu).hidden;
    closeMenu();
    $(menu).hidden = !open;
    $(button).setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => { if (!e.target.closest('.menu')) closeMenu(); });
  $('convert').addEventListener('click', () => { editor.convert(); closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // ----- search, export, import -----
  let searchTimer = null;
  $('search').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 150); });
  $('search-toggle').addEventListener('click', () => {
    const open = $('search-bar').hidden;
    $('search-bar').hidden = !open;
    if (open) $('search').focus(); else { $('search').value = ''; renderList(); }
  });
  const ERRORS_VI = { 'Not a notes file': 'Không phải tệp ghi chú', 'The file has an invalid note': 'Tệp có ghi chú không hợp lệ' };
  $('export').addEventListener('click', async () => {
    closeMenu();
    await save();
    const d = new Date(), pad = n => String(n).padStart(2, '0');
    const name = `qatt-notes2-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
    const file = new File([NotesCore.exportJSON(state.notes)], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file); a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  });
  $('import').addEventListener('click', () => { closeMenu(); $('import-file').value = ''; $('import-file').click(); });
  $('import-file').addEventListener('change', async () => {
    const file = $('import-file').files[0];
    if (!file) return;
    const parsed = NotesCore.parseImport(await file.text());
    if (!parsed.ok) { snack(parsed.error, ERRORS_VI[parsed.error] || parsed.error); return; }
    const merged = NotesCore.merge(state.notes, parsed.notes);
    try { await state.store.putMany(merged.notes); } catch (e) { warnUnsaved(); return; }
    state.notes = merged.notes;
    renderList();
    snack(`Imported ${merged.added}, updated ${merged.updated}`, `Đã nhập ${merged.added}, cập nhật ${merged.updated}`);
  });

  // the language (the site menu bar is not in the app): EN | VI in the bar of the list, the current one is lit
  const langLabel = () => document.querySelectorAll('#lang-switch button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === Lang.current)));
  document.querySelectorAll('#lang-switch button').forEach(b => b.addEventListener('click', () => Lang.set(b.dataset.lang)));
  document.addEventListener('langchange', () => { langLabel(); renderList(); });
  langLabel();

  // ----- font, style, size, alignment, decoding -----
  // the format (font, size, alignment, decoding, bold, italic) belongs to the note: note.format holds what differs from the defaults; user = chosen in the menu (stored in the note), else only shown
  const FONTS = qattFontsShown();   // js/fonts.js decides which fonts this visitor has, and its default is the default here
  const FORMAT_DEFAULTS = { font: (FONTS.find(f => f.default) || FONTS[0]).family, size: 100, align: 'left', decoding: 'qatt', bold: false, italic: false };
  const formatOf = note => ({ ...FORMAT_DEFAULTS, ...(note && note.format && typeof note.format === 'object' ? note.format : {}) });
  const keepFormat = (key, value) => { const note = state.current; if (!note) return; note.format = { ...(note.format || {}), [key]: value }; schedule(); };
  const setFont = (family, user) => {
    if (!FONTS.some(f => f.family === family)) family = FORMAT_DEFAULTS.font;
    document.documentElement.style.setProperty('--qfont', `"${family}"`);
    if (user) keepFormat('font', family);
    document.querySelectorAll('#set-font button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.font === family)));
  };
  const pickFont = family => { setFont(family, true); closeMenu(); };
  const sampleText = () => ['quốc', 'âm', 'tân', 'tự'].map(w => QattText.word(w, parser) || '').join('');   // the sample of fonts and styles, written with the decoding chosen
  const refreshSamples = () => { const text = sampleText(); document.querySelectorAll('.qsample, .style-sample').forEach(e => { e.textContent = text; }); };
  for (const f of FONTS) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.font = f.family; b.setAttribute('role', 'radio');
    const q = document.createElement('span'), label = document.createElement('span');
    q.className = 'qsample'; q.style.fontFamily = `"${f.family}", system-ui, sans-serif`;
    label.textContent = f.label;
    b.append(q, label);
    b.addEventListener('click', () => pickFont(f.family));
    $('set-font').append(b);
  }
  setFont(FORMAT_DEFAULTS.font);

  // the style of a note is stored in the note as css (base64), not as a name; a note without a (valid) style has the default one
  const styleById = id => NotesStyles.list.find(s => s.id === id) || NotesStyles.list.find(s => s.id === NotesStyles.defaultId);
  function styleOf(note) {
    return NotesStyles.parse(NotesStyles.decode(note.style || '')) || NotesStyles.parse(NotesStyles.css(styleById(NotesStyles.defaultId)));
  }
  function applyStyle(note) {
    NotesStyles.apply(styleOf(note));
    const current = NotesStyles.decode(note.style || '') || NotesStyles.css(styleById(NotesStyles.defaultId));
    document.querySelectorAll('#set-style button').forEach(b => b.setAttribute('aria-checked', String(NotesStyles.css(styleById(b.dataset.style)) === current)));
  }
  const setStyle = id => {
    const note = state.current;
    if (!note) return;
    note.style = NotesStyles.encode(NotesStyles.css(styleById(id)));
    applyStyle(note);
    schedule();
    closeMenu();
  };
  for (const s of NotesStyles.list) {
    const b = document.createElement('button'), box = document.createElement('span'), label = document.createElement('span');
    b.type = 'button'; b.dataset.style = s.id; b.setAttribute('role', 'radio');
    box.className = 'style-sample';
    box.style.background = s.bg; box.style.color = s.ink; box.style.textShadow = s.shadow;
    label.textContent = s.en; label.setAttribute('data-vi', s.vi);
    b.append(box, label);
    b.addEventListener('click', () => setStyle(s.id));
    $('set-style').append(b);
  }

  const setSize = (value, user) => {
    value = Math.min(400, Math.max(50, Number(value) || 100));
    $('set-size').value = value; $('size-label').textContent = value + '%';
    field.style.fontSize = Math.round(value * 0.363) + 'px';   // 100% is 36 pixels as in the editor of qatt.org
    if (user) keepFormat('size', value);
  };
  $('set-size').addEventListener('input', () => setSize($('set-size').value, true));

  // left, centred, vertical centred or vertical (vertical lines from right to left): one choice of four
  const setAlign = (value, user) => {
    if (!['left', 'center', 'vertical-center', 'vertical'].includes(value)) value = 'left';
    field.classList.toggle('vertical', value.startsWith('vertical'));
    field.classList.toggle('align-center', value === 'center' || value === 'vertical-center');
    document.querySelectorAll('#set-align button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.align === value)));
    if (user) keepFormat('align', value);
  };
  document.querySelectorAll('#set-align button').forEach(b => b.addEventListener('click', () => { setAlign(b.dataset.align, true); closeMenu(); }));

  const emphasis = {};
  // bold and italic (the browser slants and thickens the strokes of the font; kept on this device like the font)
  for (const [key, id] of [['bold', 'set-bold'], ['italic', 'set-italic']]) {
    const set = (on, user) => { field.classList.toggle(key, on); $(id).setAttribute('aria-pressed', String(on)); if (user) keepFormat(key, on); };
    $(id).addEventListener('click', () => { set(!field.classList.contains(key), true); closeMenu(); });
    emphasis[key] = set;
  }

  function applyFormat(note) {
    const f = formatOf(note);
    setFont(f.font); setSize(f.size); setAlign(f.align);
    emphasis.bold(f.bold === true); emphasis.italic(f.italic === true);
    useDecoding(f.decoding);
  }

  // qatt and omniglot are in parser.js; decodings.json holds additional ones (an entry with the name of a built-in one replaces it in the app) and is loaded at every start
  const validDecoding = d => d && typeof d.name === 'string' && /^[a-z][a-z0-9_-]*$/.test(d.name) && Array.isArray(d.table)
    && d.table.length === VietnameseParser.SHAPES.length && d.table.every(row => Array.isArray(row) && row.every(r => typeof r === 'string'));
  async function loadDecodings() {
    const list = new Map([['qatt', 'qatt.org'], ['omniglot', 'omniglot']]);
    try {
      const r = await fetch('/decodings.json', { cache: 'no-store' });
      const data = r.ok ? await r.json() : [];
      for (const d of Array.isArray(data) ? data : []) {
        if (!validDecoding(d)) continue;   // an invalid entry is skipped, the others stay
        extraDecodings[d.name] = d.table;
        list.set(d.name, typeof d.label === 'string' && d.label ? d.label : d.name);
      }
    } catch (e) { /* offline without a stored copy: the built-in tables only */ }
    const select = $('set-decoding');
    select.textContent = '';
    for (const [name, label] of list) select.append(new Option(label, name));
    useDecoding(formatOf(state.current).decoding);
  }
  function useDecoding(name) {   // the reading of the note: only the tables change, the text stays as it is
    const select = $('set-decoding');
    if (!Array.from(select.options).some(o => o.value === name)) name = 'qatt';
    select.value = name;
    parser.setDecoding(name);
    refreshSamples();
  }
  $('set-decoding').addEventListener('change', () => {
    const name = $('set-decoding').value;
    keepFormat('decoding', name);
    editor.setDecoding(name);
    refreshSamples();
    closeMenu();
  });

  // ----- delete and undo -----
  $('menu-delete').addEventListener('click', async () => {
    const note = state.current;
    if (!note) return;
    clearTimeout(saveTimer); saveTimer = null; state.dirty = false;
    const wasStored = state.inStore, snapshot = { ...note, text: ed.value };
    state.current = null;
    closeMenu();
    await saving;   // a save that is already running ends before the note is removed
    if (wasStored) {
      try { await state.store.remove(note.id); } catch (e) { warnUnsaved(); }
      state.notes = state.notes.filter(n => n.id !== note.id);
    }
    if (snapshot.text !== '' || wasStored) { snack('Deleted', 'Đã xóa', { undo: true }); deleted = snapshot; }
    if (history.state && history.state.fromList) history.back(); else { history.replaceState(null, '', '#/'); route(); }
  });
  $('undo').addEventListener('click', async () => {
    const note = deleted;
    if (!note) return;
    hideSnack();
    try { await state.store.put(note); } catch (e) { warnUnsaved(); }
    state.notes.push(note);
    renderList();
  });

  document.addEventListener('gesturestart', e => e.preventDefault());   // Safari ignores user-scalable=no

  // ----- offline: the service worker (sw.js) -----
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));

  // ----- start -----
  (async () => {
    await loadDecodings();
    try { state.store = await NotesDB.open(); state.notes = await state.store.all(); }
    catch (e) { state.store = NotesDB.memory(); warnUnsaved(); }
    app.store = state.store;
    await route();
    if (state.notes.length === 0 && !state.current) $('new-note').click();   // nothing written yet: straight to the editor
    app.ready = true;
  })();
})();
