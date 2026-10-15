// Quốc Ngữ -> Chữ Nôm in three automatic steps (the protocol of chunom/translate-chatbot.html), each checked by code:
//   1. candidates for every syllable/word   2. one choice per unit   3. back-reading of the result, one repair round
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
    '{{note}}',
    'Units: {{units}}',
    'Answer: {"choices": [{"id": 1, "char": "..."}]}',
  ],
  step2repair: 'These units failed the back-reading check. Choose a different candidate (or "?") for exactly these units: {{bad}}',
  step3: [
    'STEP 3, back-reading check. You see only Chữ Nôm characters, no original text. Ignore anything you may have thought before.',
    'Read each unit in Quốc Ngữ based on the characters alone. Do not guess to force a match; write "?" if a reading is unclear. A unit with several characters has several syllables.',
    'Units: {{units}}',
    'Answer: {"readings": [{"id": 1, "reading": "..."}]}',
  ],
};
// what every prompt must contain, else the file is rejected
const NEEDS = { step1: ['text', 'syllables'], hintsLine: ['hints'], step1retry: ['error'], step2: ['text', 'units'], step2repair: ['bad'], step3: ['units'] };
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

function step2Prompt(P, text, units, note) {
  return render(P, 'step2', { text: JSON.stringify(text), note: note || '',
    units: JSON.stringify(units.map(u => ({ id: u.id, qn: u.qn, candidates: u.candidates.map(c => ({ char: c.char, reading: c.reading, type: c.type, meaning: (c.source === 'dictionary' ? c.gloss : c.reason) || undefined })) }))) });
}

function step3Prompt(P, chars) {
  return render(P, 'step3', { units: JSON.stringify(chars) });
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

const sameReading = (read, unit) => norm(read).replace(/\s+/g, ' ') === unit.qn;
// the model and the dictionary of the site name the same character for this reading: two sources agree
const agrees = u => u.chosen !== '?' && u.dict.some(e => e.han === u.chosen);
const CHECK_UNTIL = 80000;   // ms after the start: later than this the optional step 3 is skipped

// state of a word: sure (model and dictionary agree, or the back-reading matches), differs (the dictionary lists other characters for this
// reading), uncertain (no character, or read back differently), unchecked (step 3 did not run)
function stateOf(u) {
  if (u.chosen === '?') return { state: 'uncertain', why: 'nochar' };
  if (agrees(u)) return { state: 'sure', why: 'dictionary' };
  if (u.dict.length) return { state: 'differs', why: 'differs' };
  if (u.ok === true) return { state: 'sure', why: 'backreading' };
  if (u.ok === false) return { state: 'uncertain', why: 'readas' };
  return { state: 'unchecked', why: 'none' };
}

export async function translate(text, { callModel, dict = new Map(), progress = () => {}, prompts = DEFAULT_PROMPTS }) {
  const started = Date.now();
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

  // ---- step 3 (optional): read back the characters that the dictionary does not confirm (only the characters, no text), compare with the
  // units, repair once. It only rates the result; when it fails or takes too long the text is returned without these ratings.
  const toCheck = () => units.filter(u => u.chosen !== '?' && !agrees(u));
  let checked = false;
  if (!toCheck().length) checked = true;   // nothing left to check
  else if (Date.now() - started < CHECK_UNTIL) {
    progress(3);
    const readBack = async () => {
      const todo = toCheck();
      if (!todo.length) return;
      const raw = await callModel(SYSTEM, step3Prompt(prompts, todo.map(u => ({ id: u.id, chars: u.chosen }))), { attempts: 2 });
      const got = new Map(asArray(raw && raw.readings).map(r => [Number(r && r.id), String(r && r.reading || '')]));
      for (const u of todo) { u.read = got.get(u.id) || '?'; u.ok = sameReading(u.read, u); }
    };
    try {
      await readBack();
      const bad = toCheck().filter(u => !u.ok);
      if (bad.length && Date.now() - started < CHECK_UNTIL) {
        const note = render(prompts, 'step2repair', { bad: JSON.stringify(bad.map(u => ({ id: u.id, expected: u.qn, read_as: u.read, rejected: u.chosen }))) });
        const before = new Map(bad.map(u => [u.id, u.chosen]));
        const raw = await callModel(SYSTEM, step2Prompt(prompts, text.trim(), bad, note), { attempts: 2 });
        const given = new Map(asArray(raw && raw.choices).map(c => [Number(c && c.id), c && c.char]));
        for (const u of bad) {
          const c = given.get(u.id);
          const next = c === '?' ? '?' : (u.candidates.find(x => x.char === c && x.char !== before.get(u.id)) || {}).char;
          if (next) { u.chosen = next; delete u.ok; delete u.read; }
        }
        await readBack();
      }
      checked = true;
    } catch (e) {
      console.error('step 3 skipped', e && e.message);
      for (const u of units) { delete u.read; delete u.ok; }
    }
  }

  // ---- result: the text with its punctuation, the units with their state
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
    checked,   // false: step 3 was skipped or failed, the words it should rate are "unchecked"
  };
}
