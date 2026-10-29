/*
The storage of the notes app (apps/notes/): IndexedDB "qatt-notes", store "notes" (key id). A note is { id, text, created, updated }.

  NotesDB.open()    Promise of a store; rejects with an Error when IndexedDB is missing or fails
  NotesDB.memory()  a store with the same interface that keeps the notes in memory only (when open() fails)
  store.all()       Promise of all notes, `updated` descending
  store.put(note)   store.putMany(notes)   store.remove(id)
*/
const NotesDB = (() => {
  const byUpdated = (a, b) => b.updated - a.updated;
  const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error || new Error("IndexedDB request failed")); });
  const done = tx => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction failed"));
  });

  function open() {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open("qatt-notes", 1); } catch (e) { reject(e instanceof Error ? e : new Error("IndexedDB is not available")); return; }
      req.onupgradeneeded = () => req.result.createObjectStore("notes", { keyPath: "id" });
      req.onerror = () => reject(req.error || new Error("IndexedDB failed"));
      req.onsuccess = () => {
        const db = req.result;
        const write = fn => { const tx = db.transaction("notes", "readwrite"); fn(tx.objectStore("notes")); return done(tx); };
        resolve({
          all: async () => (await request(db.transaction("notes").objectStore("notes").getAll())).sort(byUpdated),
          put: note => write(s => s.put(note)),
          putMany: notes => write(s => notes.forEach(n => s.put(n))),
          remove: id => write(s => s.delete(id)),
        });
      };
    });
  }

  function memory() {
    const map = new Map();
    return {
      all: async () => Array.from(map.values(), n => ({ ...n })).sort(byUpdated),
      put: async note => { map.set(note.id, { ...note }); },
      putMany: async notes => { notes.forEach(n => map.set(n.id, { ...n })); },
      remove: async id => { map.delete(id); },
    };
  }

  return { open, memory };
})();
