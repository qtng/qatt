/*
Experiment (apps/notes2/): a contenteditable="plaintext-only" element that looks like a <textarea> to notes-editor.js and ime.js
(value, selectionStart/End, setSelectionRange, setRangeText, readOnly), so the same editing logic could drive it.

  CeAdapter.wrap(div)   the element itself, with these members added (a Proxy: everything else is the element's own)
*/
const CeAdapter = (() => {
  const textNodes = root => { const out = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) out.push(n); return out; };
  const offsetOf = (root, node, offset) => {
    if (!root.contains(node)) return 0;
    const r = document.createRange(); r.selectNodeContents(root); r.setEnd(node, offset);
    return r.toString().length;
  };
  const place = (root, offset) => {
    let left = offset;
    for (const n of textNodes(root)) { if (left <= n.length) return [n, left]; left -= n.length; }
    return [root, root.childNodes.length];
  };
  const wrap = el => {
    el.setAttribute('contenteditable', 'plaintext-only');
    const sel = () => document.getSelection();
    const self = {
      get value() { return el.textContent; },
      set value(v) { el.textContent = v; },
      get selectionStart() { const s = sel(); return s.rangeCount ? Math.min(offsetOf(el, s.anchorNode, s.anchorOffset), offsetOf(el, s.focusNode, s.focusOffset)) : 0; },
      get selectionEnd() { const s = sel(); return s.rangeCount ? Math.max(offsetOf(el, s.anchorNode, s.anchorOffset), offsetOf(el, s.focusNode, s.focusOffset)) : 0; },
      get selectionDirection() { return 'none'; },
      setSelectionRange(a, b) {
        const [n1, o1] = place(el, a), [n2, o2] = place(el, b);
        const r = document.createRange(); r.setStart(n1, o1); r.setEnd(n2, o2);
        const s = sel(); s.removeAllRanges(); s.addRange(r);
      },
      setRangeText(text, start, end, mode = 'preserve') {
        const v = el.textContent, a = start ?? self.selectionStart, b = end ?? self.selectionEnd;
        const keepStart = self.selectionStart, keepEnd = self.selectionEnd;
        el.textContent = v.slice(0, a) + text + v.slice(b);
        const at = a + text.length;
        if (mode === 'end') self.setSelectionRange(at, at);
        else if (mode === 'start') self.setSelectionRange(a, a);
        else if (mode === 'select') self.setSelectionRange(a, at);
        else { const shift = p => (p >= b ? p + text.length - (b - a) : p > a ? a : p); self.setSelectionRange(shift(keepStart), shift(keepEnd)); }
      },
      get element() { return el; },
      get readOnly() { return el.getAttribute('contenteditable') === 'false'; },
      set readOnly(on) { el.setAttribute('contenteditable', on ? 'false' : 'plaintext-only'); },
    };
    return new Proxy(el, {
      get(target, prop) {
        if (prop in self) return self[prop];
        const v = Reflect.get(target, prop, target);
        return typeof v === 'function' ? v.bind(target) : v;
      },
      set(target, prop, value) { if (prop in self) { self[prop] = value; return true; } return Reflect.set(target, prop, value, target); },
    });
  };
  return { wrap };
})();
