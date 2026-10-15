// Prototype 2: Quốc Ngữ -> Chữ Nôm. The page builds the candidate lists from its dictionaries (the characters listed for the readings of the
// syllables and of compounds) and sends them; the model only chooses, in the context of the whole sentence, from these lists
// (so the reading of a chosen character is right by construction). Only where a span has no suitable option it may name a character of its own.
// The model is only called through `callModel(system, user)` -> parsed JSON, so the logic runs (and is tested) without Gemini.

const HAN = /^\p{Script=Han}+$/u;
const norm = s => String(s || '').normalize('NFC').toLowerCase().trim();

export const MAX_SPAN = 4, MAX_OPTIONS = 15, MAX_OPTIONS_TOTAL = 2500;

export function tokenize(text) {
  const tokens = [];
  for (const m of String(text).matchAll(/[\p{L}\p{M}]+|\s+|[^\p{L}\p{M}\s]+/gu)) {
    tokens.push({ type: /^[\p{L}\p{M}]/u.test(m[0]) ? 'syl' : 'other', text: m[0] });
  }
  return tokens;
}

// ---- prompts: a list of lines, {{name}} is replaced, lines that stay empty are dropped (same scheme as the function `translate`)
export const DEFAULT_PROMPTS = {
  system: [
    'You choose Chữ Nôm characters for Vietnamese (Quốc Ngữ) text. Answer with JSON only, exactly in the requested shape, no comments.',
  ],
  main: [
    'The sentence: {{text}}',
    'Its syllables as [index, syllable]: {{syllables}}',
    'For spans of syllables (at = index of the first syllable, len = number of syllables) the dictionaries list Chữ Nôm options, all with the correct reading, most usual first, with a short meaning where known. Options: {{spans}}',
    'Task: cover the syllables from the first to the last with consecutive words (a word is one span: at and len; every syllable belongs to exactly one word, in order, none missing, none twice). Use a compound span (len > 1) where the compound is the word meant in this sentence, else single syllables.',
    'For each word choose the option that fits its meaning in the context of the whole sentence (word class, sense, the other words). Use only the options listed for exactly that span.',
    'If a span has no suitable option you may give a character of your own if you know a reliable one: set "own": true. Never invent characters; if you know none, write "?" and "own": true.',
    'Besides the chosen option give up to two more options of the same span that would fit next best, best first ("alt"); leave "alt" out for a character of your own.',
    'Answer: {"words": [{"at": 0, "len": 1, "char": "...", "alt": ["...", "..."], "own": false}]}',
  ],
  retry: 'Your previous answer was rejected: {{error}}. Follow the rules exactly.',
};
const NEEDS = { main: ['text', 'syllables', 'spans'], retry: ['error'] };
const joined = v => (Array.isArray(v) ? v.join('\n') : v);

// the file of the website ({"version", "models", "prompts"}); returns {prompts, models, version} or throws
export function parsePrompts(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('not an object');
  const prompts = { ...DEFAULT_PROMPTS };
  for (const [key, value] of Object.entries(raw.prompts || {})) {
    if (!(key in DEFAULT_PROMPTS)) continue;
    const ok = typeof value === 'string' || (Array.isArray(value) && value.length && value.every(x => typeof x === 'string'));
    if (!ok) throw new Error(`prompt "${key}" must be a text or a list of lines`);
    for (const name of NEEDS[key] || []) if (!joined(value).includes(`{{${name}}}`)) throw new Error(`prompt "${key}" lacks {{${name}}}`);
    prompts[key] = value;
  }
  let models = null;
  if (raw.models !== undefined) {
    if (!Array.isArray(raw.models) || !raw.models.length || raw.models.length > 6 || !raw.models.every(m => /^[a-z0-9][a-z0-9.\-]{1,60}$/.test(m))) throw new Error('"models" must be 1 to 6 model names');
    models = raw.models;
  }
  return { prompts, models, version: String(raw.version || '') };
}
const render = (P, key, vars = {}) => joined(P[key]).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined ? '' : vars[k])).split('\n').filter(l => l.trim()).join('\n');

// ---- the lists of the page: [{at, len, options: [{c: "字", m: "meaning"}]}]; checked and cleaned, throws {code: 'bad_request'}
export function cleanSpans(raw, syllableCount) {
  const bad = () => Object.assign(new Error('bad spans'), { code: 'bad_request' });
  if (!Array.isArray(raw) || raw.length > 1200) throw bad();
  const seen = new Set(), spans = [];
  let total = 0;
  for (const s of raw) {
    if (!s || !Number.isInteger(s.at) || !Number.isInteger(s.len) || s.len < 1 || s.len > MAX_SPAN || s.at < 0 || s.at + s.len > syllableCount) throw bad();
    const key = s.at + '+' + s.len;
    if (seen.has(key) || !Array.isArray(s.options)) throw bad();
    seen.add(key);
    const options = [], chars = new Set();
    for (const o of s.options.slice(0, MAX_OPTIONS)) {
      if (!o || typeof o.c !== 'string' || !HAN.test(o.c) || o.c.length > 16 || chars.has(o.c)) continue;
      chars.add(o.c);
      options.push({ c: o.c, m: String(o.m || '').slice(0, 80) });
    }
    total += options.length;
    if (options.length) spans.push({ at: s.at, len: s.len, options });
  }
  if (total > MAX_OPTIONS_TOTAL) throw bad();
  return spans;
}

// the answer must cover the syllables exactly with consecutive words; returns the words or an error text
function checkWords(raw, syllables, spans) {
  const list = Array.isArray(raw && raw.words) ? raw.words : null;
  if (!list || !list.length) return { error: 'no "words" list' };
  const byKey = new Map(spans.map(s => [s.at + '+' + s.len, s]));
  const words = [];
  let pos = 0;
  for (const w of list.slice().sort((a, b) => Number(a && a.at) - Number(b && b.at))) {
    if (!w || w.at !== pos || !Number.isInteger(w.len) || w.len < 1 || pos + w.len > syllables.length) return { error: `the words must follow each other without gap or overlap: expected a word at ${pos}, got ${JSON.stringify(w)}` };
    const span = byKey.get(w.at + '+' + w.len) || null;
    if (w.len > 1 && !span && !(typeof w.char === 'string' && w.own === true)) return { error: `there is no span at ${w.at} with len ${w.len}` };
    const char = typeof w.char === 'string' ? w.char.trim() : '';
    words.push({ at: w.at, len: w.len, char, own: w.own === true, span, alt: Array.isArray(w.alt) ? w.alt.filter(x => typeof x === 'string') : [] });
    pos += w.len;
  }
  if (pos !== syllables.length) return { error: `the words cover ${pos} of ${syllables.length} syllables` };
  return { words };
}

export async function translate2(text, rawSpans, { callModel, progress = () => {}, prompts = DEFAULT_PROMPTS }) {
  const tokens = tokenize(text);
  const syl = tokens.filter(t => t.type === 'syl').map(t => t.text);
  if (!syl.length) throw Object.assign(new Error('no text'), { code: 'empty' });
  const syllables = syl.map(norm);
  const spans = cleanSpans(rawSpans, syllables.length);
  const SYSTEM = render(prompts, 'system');
  const user = render(prompts, 'main', {
    text: JSON.stringify(text.trim()),
    syllables: JSON.stringify(syl.map((s, i) => [i, s])),
    spans: JSON.stringify(spans.map(s => ({ at: s.at, len: s.len, qn: syllables.slice(s.at, s.at + s.len).join(' '), options: s.options.map(o => (o.m ? { char: o.c, meaning: o.m } : { char: o.c })) }))),
  });

  progress(1);
  let step = checkWords(await callModel(SYSTEM, user), syllables, spans);
  if (step.error) step = checkWords(await callModel(SYSTEM, user + '\n' + render(prompts, 'retry', { error: step.error })), syllables, spans);
  let words = step.words;
  if (!words) {   // the model did not manage it: single syllables, the first option of each
    const bySingle = new Map(spans.filter(s => s.len === 1).map(s => [s.at, s]));
    words = syllables.map((_, at) => { const s = bySingle.get(at); return { at, len: 1, char: s ? s.options[0].c : '?', own: !s, span: s || null, fallback: true }; });
  }

  // the result: the words with their options; a character that is not in the options of its span counts as the model's own
  const parts = [];
  const byFirst = new Map(words.map((w, id) => [w.at, id + 1]));
  let k = 0;
  for (const t of tokens) {
    if (t.type === 'other') { if (/\S/.test(t.text)) parts.push({ text: t.text.trim() }); continue; }
    if (byFirst.has(k)) parts.push({ word: byFirst.get(k) });
    k++;
  }
  return {
    qn: text.trim(),
    parts,
    fallback: !step.words,
    words: words.map((w, i) => {
      const options = w.span ? w.span.options : [];
      const chosen = w.char && w.char !== '?' && HAN.test(w.char) ? w.char : '?';
      const own = chosen === '?' || w.own || !options.some(o => o.c === chosen);
      // the other options are known to the page (it sent them); only the model's next best ones are returned, best first
      const alt = own ? [] : (w.alt || []).filter((c, j, a) => c !== chosen && options.some(o => o.c === c) && a.indexOf(c) === j).slice(0, 2);
      return { id: i + 1, at: w.at, len: w.len, qn: syllables.slice(w.at, w.at + w.len).join(' '), chosen, own, alt };
    }),
  };
}
