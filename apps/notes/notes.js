/*
QATT notes: the list, the editor, the saving. Needs js/navigation.js (Lang only, window.QATT_APP), parser.js, qatt-text.js, ime.js, qatt-writer.js, notes-core.js, notes-db.js, notes-fonts.js.
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
  NotesFonts.apply(NotesFonts.list[0].family);

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
    for (const note of state.notes) {
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
  const editor = QattWriter.editor(field, { parser, onChange: () => { schedule(); showTitle(); } });
  const showTitle = () => { $('editor-title').textContent = NotesCore.title(field.value); };
  field.addEventListener('input', () => { schedule(); showTitle(); });

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

  // ----- menu -----
  function closeMenu() { $('menu').hidden = true; $('menu-btn').setAttribute('aria-expanded', 'false'); }
  $('menu-btn').addEventListener('click', e => {
    e.stopPropagation();
    const open = $('menu').hidden;
    $('menu').hidden = !open;
    $('menu-btn').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => { if (!e.target.closest('#menu')) closeMenu(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

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

  // ----- start -----
  (async () => {
    try { state.store = await NotesDB.open(); state.notes = await state.store.all(); }
    catch (e) { state.store = NotesDB.memory(); warnUnsaved(); }
    app.store = state.store;
    app.ready = true;
    route();
  })();
})();
