// Quốc Ngữ -> Chữ Nôm: two steps of the model (the protocol of chunom/translate-chatbot.html), then the check by code:
//   1. candidates for every syllable/word   2. one choice per unit   3. (no model) does every character read as its syllable, according to
//   the dictionaries of the site (dict.csv, js/base_chars.json, js/generated_chars.json)? A choice that does not is replaced by a candidate that does
// The model is only called through `callModel(system, user)` -> parsed JSON, so the logic runs (and is tested) without Gemini.

const HAN = /^\p{Script=Han}+$/u;
const norm = s => String(s || '').normalize('NFC').toLowerCase().trim();

// the text as syllables ("syl") and everything between them ("other": punctuation, digits, spaces)
export function tokenize(text) {
  const tokens = [];
  for (const m of String(text).matchAll(/[\p{L}\p{M}]+|\s+|[^\p{L}\p{M}\s]+/gu)) {
    tokens.push({ type: /^[\p{L}\p{M}]/u.test(m[0]) ? 'syl' : 'other', text: m[0] });
  }
  return tokens;
}

// the dictionary of the site (dict.csv: reading, characters, gloss, ...) as a map reading -> [{han, gloss}]
export function parseDict(csv) {
  const map = new Map();
  for (const line of String(csv).split('\n')) {
    const m = /^"((?:[^"]|"")*)","((?:[^"]|"")*)"(?:,"((?:[^"]|"")*)")?/.exec(line);
    if (!m) continue;
    const key = norm(m[1].replace(/""/g, '"')), han = m[2].replace(/""/g, '"'), gloss = (m[3] || '').replace(/""/g, '"');
    if (!key || !han) continue;
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).some(e => e.han === han)) map.get(key).push({ han, gloss });
  }
  return map;
}

// ---- prompts. A prompt is a list of lines (joined with a line break); {{name}} is replaced by a value and lines that stay
// empty are dropped. These defaults are used when the file of the website (chunom/js/translate_prompts.json) cannot be loaded.
export const DEFAULT_PROMPTS = {
  system: [
    'You transcribe Vietnamese (Quốc Ngữ) into Chữ Nôm. Answer with JSON only, exactly in the requested shape, no comments.',
    'Rules: never invent characters; if you do not know a reliable character, write none. Only Chữ Nôm / Han characters, no Chinese rewording: every unit stands for exactly the syllables given, in the same order, nothing added, nothing left out. For purely Vietnamese words (pronouns, particles, function words) never use a Sino-Vietnamese character with a different reading, e.g. never 我 for "tôi" (that is read "ngã"). The reading of a candidate must match the syllable.',
  ],
  step1: [
    'STEP 1. Do not transcribe yet, only prepare candidates.',
    'The whole sentence (for context): {{text}}',
    'Syllables of the text (in order): {{syllables}}',
    'Group them into words where appropriate (a unit has one or more consecutive syllables; every syllable belongs to exactly one unit, none missing, none added). Give each unit a sequential id starting at 1.',
    'For each unit give 2 to 4 candidates sorted by confidence. Choose candidates that fit the meaning of the unit in this sentence (word class, sense in context); where a word is ambiguous, include a second reading. Prefer phono-semantic characters if available and confidence is sufficient.',
    'Each candidate: {"char": "...", "codepoint": "U+...", "reading": "Quốc Ngữ reading", "type": "Sino-Vietnamese" | "purely Nôm" | "phono-semantic", "reason": "at most 10 words"}.',
    '{{hintsLine}}',
    'Answer: {"units": [{"id": 1, "qn": "the syllables of the unit separated by a space", "candidates": [ ... ]}]}',
  ],
  // the dictionary entries of the words, as a hint for the model (the line {{hintsLine}} of step1; without it the answers were clearly worse)
  hintsLine: 'Dictionary entries of this site that may help (reading: characters with meaning; use them when the meaning fits the sentence): {{hints}}',
  step1retry: 'Your previous answer was rejected: {{error}}. Follow the syllable list exactly.',
  step2: [
    'STEP 2. Choose exactly one candidate per unit, only from its list; if none fits, use "?".',
    'The whole sentence: {{text}}',
    'Make sure the choices are coherent in context (word class, meaning, identical words spelled identically); use the meaning given with a candidate.',
    'Units: {{units}}',
    'Answer: {"choices": [{"id": 1, "char": "..."}]}',
  ],
};
// what every prompt must contain, else the file is rejected
const NEEDS = { step1: ['text', 'syllables'], hintsLine: ['hints'], step1retry: ['error'], step2: ['text', 'units'] };
const joined = v => (Array.isArray(v) ? v.join('\n') : v);

// the file of the website: {"version": "...", "models": ["..."], "prompts": {...}}; returns {prompts, models, version} or throws
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

const render = (P, key, vars = {}) => joined(P[key]).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] === undefined ? '' : vars[k]))
  .split('\n').filter(l => l.trim()).join('\n');

function step1Prompt(P, text, syllables, hints) {
  return render(P, 'step1', { text: JSON.stringify(text), syllables: JSON.stringify(syllables),
    hintsLine: hints.length ? render(P, 'hintsLine', { hints: JSON.stringify(hints) }) : '' });
}

function step2Prompt(P, text, units) {
  return render(P, 'step2', { text: JSON.stringify(text),
    units: JSON.stringify(units.map(u => ({ id: u.id, qn: u.qn, candidates: u.candidates.map(c => ({ char: c.char, reading: c.reading, type: c.type, meaning: (c.source === 'dictionary' ? c.gloss : c.reason) || undefined })) }))) });
}

const asArray = x => (Array.isArray(x) ? x : []);

// the units of step 1 must cover the syllables exactly; returns the clean units or an error text.
// The candidates are those of the model. The dictionary of the site is only kept next to them (`dict`, to compare with the choice);
// it supplies candidates only for a unit for which the model proposed none.
function checkUnits(raw, syllables, dict) {
  const units = [];
  let pos = 0;
  for (const u of asArray(raw && raw.units)) {
    const syl = String(u && u.qn || '').split(/\s+/).filter(Boolean).map(norm);
    if (!syl.length) return { error: 'a unit without syllables' };
    for (const s of syl) {
      if (s !== norm(syllables[pos])) return { error: `unit ${u.id} ("${u.qn}") does not match the syllable "${syllables[pos] || '(end of text)'}" at position ${pos + 1}` };
      pos++;
    }
    const key = norm(syl.join(' ')), entries = (dict.get(key) || []).slice(0, 6);
    const seen = new Set();
    const candidates = asArray(u.candidates).filter(c => c && HAN.test(String(c.char)) && !seen.has(c.char) && seen.add(c.char)).slice(0, 4)
      .map(c => ({ char: c.char, reading: String(c.reading || ''), type: String(c.type || ''), reason: String(c.reason || ''), source: 'model', inDict: false, gloss: '' }));
    for (const c of candidates) { const e = entries.find(e => e.han === c.char); if (e) { c.inDict = true; c.gloss = e.gloss; } }
    if (!candidates.length) for (const e of entries.slice(0, 3)) candidates.push({ char: e.han, reading: key, type: 'dictionary', reason: '', source: 'dictionary', inDict: true, gloss: e.gloss });
    units.push({ id: units.length + 1, qn: key, syllables: syl, candidates, dict: entries });
  }
  if (pos !== syllables.length) return { error: `the units cover ${pos} of ${syllables.length} syllables` };
  return { units };
}

// a choice must come from the list of the unit, else its first candidate, else "?"
function applyChoices(units, raw) {
  const given = new Map(asArray(raw && raw.choices).map(c => [Number(c && c.id), c && c.char]));
  for (const u of units) {
    const c = given.get(u.id);
    if (c === '?') { u.chosen = '?'; continue; }
    const found = u.candidates.find(x => x.char === c);
    u.chosen = found ? found.char : (u.candidates[0] ? u.candidates[0].char : '?');
    if (c !== undefined && !found && u.candidates[0]) u.corrected = true;   // the model chose something outside the list
  }
}

// ---- the check of the pronunciation: which readings do the dictionaries of the site list for a character?
// files: the parsed JSON files of js/ime.js ({dict: "reading:glyph,glyph|..."}), dict: the Map of parseDict. Returns {chars, words}:
// chars: character -> set of syllables it is listed with (a word with as many characters as syllables gives one syllable per character),
// words: "reading|glyphs" of all entries (also words with other numbers of characters)
export function buildReadings(files, dict) {
  const chars = new Map(), words = new Set();
  const add = (reading, glyph) => {
    if (!reading || !glyph) return;
    words.add(reading + '|' + glyph);
    const syl = reading.split(' '), cs = [...glyph];
    if (syl.length !== cs.length) return;
    cs.forEach((c, i) => { if (!chars.has(c)) chars.set(c, new Set()); chars.get(c).add(syl[i]); });
  };
  for (const f of files) {
    for (const entry of String(f && f.dict || '').replace(/[\r\n]/g, '').split('|')) {
      const sep = entry.indexOf(':', 1);
      if (sep < 0) continue;
      const key = entry.slice(0, sep);
      if (!/^[\p{L}\p{M}]+$/u.test(key)) continue;   // symbols such as "-_ideographicHyphen"
      const reading = norm(key.replace(/(\p{Lu})/gu, ' $1'));
      for (const glyph of entry.slice(sep + 1).split(',')) add(reading, glyph.trim());
    }
  }
  for (const [reading, entries] of dict) for (const e of entries) add(reading, e.han);
  return { chars, words };
}

// does the chosen text read as the syllables of the unit? {ok: true}, {ok: false, read: "the readings listed for the characters"} or {ok: undefined} (not decidable)
function verify(u, R, glyphs = u.chosen) {
  const cs = [...glyphs];
  if (R.words.has(u.qn + '|' + glyphs)) return { ok: true };
  if (cs.length !== u.syllables.length) return { ok: undefined };   // another number of characters than syllables: only a listed word can be confirmed
  const bad = []; let unknown = false;
  cs.forEach((c, i) => {
    const set = R.chars.get(c);
    if (!set) unknown = true;
    else if (!set.has(u.syllables[i])) bad.push([...set].slice(0, 3).join(', '));
  });
  if (bad.length) return { ok: false, read: bad.join(' / ') };
  return { ok: unknown ? undefined : true };
}

// the model and the dictionary of the site name the same character for this reading: two sources agree
const agrees = u => u.chosen !== '?' && u.dict.some(e => e.han === u.chosen);

// state of a word: sure (model and dictionary agree, or the dictionaries list the reading), differs (dict.csv lists other characters for this
// reading), uncertain (no character, or the character does not read like that), unchecked (not decidable)
function stateOf(u) {
  if (u.chosen === '?') return { state: 'uncertain', why: 'nochar' };
  if (u.ok === false) return { state: 'uncertain', why: 'readas' };
  if (agrees(u)) return { state: 'sure', why: 'dictionary' };
  if (u.dict.length) return { state: 'differs', why: 'differs' };
  if (u.ok === true) return { state: 'sure', why: 'dictionaries' };
  return { state: 'unchecked', why: 'unknown' };
}

// the result: the text with its punctuation, the units with their state. checked: the readings could be checked
function assemble(text, tokens, units, checked) {
  const out = [];
  let k = 0;   // index of the syllable
  const byFirst = new Map();
  let p = 0;
  for (const u of units) { byFirst.set(p, u); p += u.syllables.length; }
  const shown = u => u.chosen === '?' ? `[${u.qn}]` : u.chosen;
  for (const t of tokens) {
    if (t.type === 'other') { if (/\S/.test(t.text)) out.push(t.text.trim()); continue; }
    if (byFirst.has(k)) out.push(shown(byFirst.get(k)));
    k++;
  }
  const states = units.map(stateOf);
  const uncertain = units.filter((u, i) => states[i].state === 'uncertain' || states[i].state === 'differs').map(u => u.id);
  return {
    nom: out.join('').replace(/\s+/g, ''),
    qn: text.trim(),
    units: units.map((u, i) => ({
      id: u.id, qn: u.qn, chosen: u.chosen, read: u.read || '',
      state: states[i].state, why: states[i].why,
      ok: states[i].state === 'sure' ? true : states[i].state === 'uncertain' ? false : null,   // for older pages
      dict: u.dict,
      candidates: u.candidates.map(c => ({ char: c.char, reading: c.reading, type: c.type, inDict: c.inDict, meaning: c.gloss || c.reason || '' })),
    })),
    uncertain,
    checked,   // false: the dictionaries of the readings were not available, nothing could be checked
  };
}

export async function translate(text, { callModel, dict = new Map(), readings = null, progress = () => {}, prompts = DEFAULT_PROMPTS }) {
  const SYSTEM = render(prompts, 'system');
  const tokens = tokenize(text);
  const syllables = tokens.filter(t => t.type === 'syl').map(t => t.text);
  if (!syllables.length) throw Object.assign(new Error('no text'), { code: 'empty' });
  const hints = [...new Set(syllables.map(norm))].filter(s => dict.has(s)).slice(0, 80).map(s => [s, dict.get(s).slice(0, 4).map(e => e.han + (e.gloss ? ' = ' + e.gloss.slice(0, 40) : '')).join('; ')]);

  // ---- step 1
  progress(1);
  let step = checkUnits(await callModel(SYSTEM, step1Prompt(prompts, text.trim(), syllables, hints)), syllables, dict);
  if (step.error) {   // one more try with the error named
    step = checkUnits(await callModel(SYSTEM, step1Prompt(prompts, text.trim(), syllables, hints) + '\n' + render(prompts, 'step1retry', { error: step.error })), syllables, dict);
    if (step.error) throw Object.assign(new Error(step.error), { code: 'step1' });
  }
  const units = step.units;

  // ---- step 2
  progress(2);
  applyChoices(units, await callModel(SYSTEM, step2Prompt(prompts, text.trim(), units)));

  // ---- the check by code: does every chosen text read as its syllables? A choice that does not is replaced by the first candidate that does
  if (readings) {
    for (const u of units) {
      if (u.chosen === '?') continue;
      let v = verify(u, readings);
      if (v.ok === false) {
        const other = u.candidates.find(c => c.char !== u.chosen && verify(u, readings, c.char).ok === true);
        if (other) { u.replaced = u.chosen; u.chosen = other.char; v = { ok: true }; }
      }
      u.ok = v.ok; if (v.read) u.read = v.read;
    }
  }

  return assemble(text, tokens, units, !!readings);
}
