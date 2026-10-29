/*
QATT notes: the list, the editor, the saving. Needs lang.js, parser.js, qatt-text.js, ime.js, notes-editor.js, notes-core.js, notes-db.js, notes-fonts.js.
Routes (history, so the back button of Android works): "#/" the list, "#/n/<id>" a note. A new note is written to the store at its first autosave that is not empty.
window.notesApp = { store, ready, flush() } is for the tests.
*/
(() => {
  const $ = id => document.getElementById(id);
  const parser = new VietnameseParser();
  const field = $('note-field');
  const state = { store: null, notes: [], current: null, inStore: false, dirty: false };
  const app = window.notesApp = { store: null, ready: false, flush: () => save() };
  let saveTimer = null, snackTimer = null, deleted = null, persistAsked = false;

  NotesFonts.install('/');

  // ----- settings (this device only; the app works without them) -----
  const settings = (() => {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('qattNotes')) || {}; } catch (e) { s = {}; }
    return { get: (key, fallback) => (s[key] === undefined ? fallback : s[key]), set(key, value) { s[key] = value; try { localStorage.setItem('qattNotes', JSON.stringify(s)); } catch (e) { /* storage may be blocked */ } } };
  })();

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
    if (field.value === '' && !state.inStore) return saving;   // a new note that stays empty
    note.text = field.value;
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
  const editor = NotesEditor.editor(field, { parser, onChange: () => { schedule(); showTitle(); renderKeys(); } });
  const showTitle = () => { $('editor-title').textContent = NotesCore.title(field.value); };
  field.addEventListener('input', () => { schedule(); showTitle(); renderKeys(); });

  function showEditor(note, fresh) {
    state.current = note; state.inStore = !fresh; state.dirty = false;
    field.value = note.text;
    showTitle();
    closeMenu();
    $('view-list').hidden = true;
    $('view-editor').hidden = false;
    field.scrollTop = 0;
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
    const now = Date.now(), note = { id: newId(), text: '', created: now, updated: now };
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
  const keepFocus = e => e.preventDefault();   // a click on the bar does not take the focus (and the keyboard) from the field
  variantBtns.forEach((btn, i) => { btn.addEventListener('pointerdown', keepFocus); btn.addEventListener('click', () => { const v = editor.variants()[i]; if (v) v.run(); }); });
  $('convert-key').addEventListener('pointerdown', keepFocus);
  $('convert-key').addEventListener('click', () => editor.convert());
  field.addEventListener('focus', () => { keybar.hidden = false; renderKeys(); });
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
  const MENUS = [['menu-btn', 'menu'], ['list-menu-btn', 'list-menu']];
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
    const name = `qatt-notes-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
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

  // the language (the site menu bar is not in the app): the button names the language it switches to, in that language
  const langLabel = () => { $('lang-label').textContent = Lang.current === 'vi' ? 'English' : 'Tiếng Việt'; };
  $('lang-toggle').addEventListener('click', () => { closeMenu(); Lang.set(Lang.current === 'vi' ? 'en' : 'vi'); });
  document.addEventListener('langchange', () => { langLabel(); renderList(); });
  langLabel();

  // ----- font, size, vertical, decoding -----
  const setFont = family => {
    NotesFonts.apply(family);
    settings.set('font', family);
    document.querySelectorAll('#set-font button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.font === family)));
  };
  const sample = QattText.word('ghi', parser) || '';
  for (const f of NotesFonts.list) {
    const b = document.createElement('button');
    b.type = 'button'; b.dataset.font = f.family; b.setAttribute('role', 'radio');
    const q = document.createElement('span'), label = document.createElement('span');
    q.className = 'qsample'; q.style.fontFamily = `"${f.family}", system-ui, sans-serif`; q.textContent = sample;
    label.textContent = f.label;
    b.append(q, label);
    b.addEventListener('click', () => setFont(f.family));
    $('set-font').append(b);
  }
  setFont(NotesFonts.list.some(f => f.family === settings.get('font')) ? settings.get('font') : NotesFonts.list[0].family);

  const setSize = value => {
    value = Math.min(400, Math.max(50, Number(value) || 100));
    $('set-size').value = value; $('size-label').textContent = value + '%';
    field.style.fontSize = Math.round(value * 0.363) + 'px';   // 100% is 36 pixels as in the editor of qatt.org
    settings.set('size', value);
  };
  $('set-size').addEventListener('input', () => setSize($('set-size').value));
  setSize(settings.get('size', 100));

  const setVertical = on => {
    field.classList.toggle('vertical', on);
    $('set-vertical').setAttribute('aria-checked', String(on));
    settings.set('vertical', on);
  };
  $('set-vertical').addEventListener('click', () => setVertical(!field.classList.contains('vertical')));
  setVertical(settings.get('vertical', false) === true);

  // qatt and omniglot are in parser.js; decodings.json holds only additional ones (an entry with the name of a built-in one replaces it) and is loaded at every start
  async function loadDecodings() {
    const list = new Map([['qatt', 'qatt.org'], ['omniglot', 'omniglot']]);
    try {
      const r = await fetch('/decodings.json', { cache: 'no-store' });
      if (r.ok) for (const d of VietnameseParser.loadDecodings(await r.json())) list.set(d.name, d.label);
    } catch (e) { /* offline without a stored copy: the built-in tables only */ }
    const select = $('set-decoding');
    select.textContent = '';
    for (const [name, label] of list) select.append(new Option(label, name));
    const chosen = list.has(settings.get('decoding')) ? settings.get('decoding') : 'qatt';
    select.value = chosen;
    parser.setDecoding(chosen);
  }
  $('set-decoding').addEventListener('change', () => {
    const name = $('set-decoding').value;
    settings.set('decoding', name);
    editor.setDecoding(name);
  });

  // ----- delete and undo -----
  $('menu-delete').addEventListener('click', async () => {
    const note = state.current;
    if (!note) return;
    clearTimeout(saveTimer); saveTimer = null; state.dirty = false;
    const wasStored = state.inStore, snapshot = { ...note, text: field.value };
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

  // ----- offline: the service worker (sw.js) -----
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { scope: './' }).catch(() => {}));

  // ----- start -----
  (async () => {
    await loadDecodings();
    try { state.store = await NotesDB.open(); state.notes = await state.store.all(); }
    catch (e) { state.store = NotesDB.memory(); warnUnsaved(); }
    app.store = state.store;
    app.ready = true;
    route();
  })();
})();
