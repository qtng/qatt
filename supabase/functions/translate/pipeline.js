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

// the dictionary of the site (dict.csv: reading, characters, gloss, ...) as a map reading -> [characters]
export function parseDict(csv) {
  const map = new Map();
  for (const line of String(csv).split('\n')) {
    const m = /^"((?:[^"]|"")*)","((?:[^"]|"")*)"/.exec(line);
    if (!m) continue;
    const key = norm(m[1].replace(/""/g, '"')), han = m[2].replace(/""/g, '"');
    if (!key || !han) continue;
    if (!map.has(key)) map.set(key, []);
    if (!map.get(key).includes(han)) map.get(key).push(han);
  }
  return map;
}

const SYSTEM = `You transcribe Vietnamese (Quốc Ngữ) into Chữ Nôm. Answer with JSON only, exactly in the requested shape, no comments.
Rules: never invent characters; if you do not know a reliable character, write none. Only Chữ Nôm / Han characters, no Chinese rewording: every unit stands for exactly the syllables given, in the same order, nothing added, nothing left out. For purely Vietnamese words (pronouns, particles, function words) never use a Sino-Vietnamese character with a different reading, e.g. never 我 for "tôi" (that is read "ngã"). The reading of a candidate must match the syllable.`;

function step1Prompt(syllables, hints) {
  return `STEP 1. Do not transcribe yet, only prepare candidates.
Syllables of the text (in order): ${JSON.stringify(syllables)}
Group them into words where appropriate (a unit has one or more consecutive syllables; every syllable belongs to exactly one unit, none missing, none added). Give each unit a sequential id starting at 1.
For each unit give 2 to 4 candidates sorted by confidence. Prefer phono-semantic characters if available and confidence is sufficient.
Each candidate: {"char": "...", "codepoint": "U+...", "reading": "Quốc Ngữ reading", "type": "Sino-Vietnamese" | "purely Nôm" | "phono-semantic", "reason": "at most 10 words"}.
${hints.length ? 'Dictionary entries of this site that may help (reading: characters): ' + JSON.stringify(hints) + '\n' : ''}Answer: {"units": [{"id": 1, "qn": "the syllables of the unit separated by a space", "candidates": [ ... ]}]}`;
}

function step2Prompt(units, note) {
  return `STEP 2. Choose exactly one candidate per unit, only from its list; if none fits, use "?".
Make sure the choices are coherent in context (word class, meaning, identical words spelled identically).
${note ? note + '\n' : ''}Units: ${JSON.stringify(units.map(u => ({ id: u.id, qn: u.qn, candidates: u.candidates.map(c => ({ char: c.char, reading: c.reading, type: c.type })) })))}
Answer: {"choices": [{"id": 1, "char": "..."}]}`;
}

function step3Prompt(chars) {
  return `STEP 3, back-reading check. You see only Chữ Nôm characters, no original text. Ignore anything you may have thought before.
Read each unit in Quốc Ngữ based on the characters alone. Do not guess to force a match; write "?" if a reading is unclear. A unit with several characters has several syllables.
Units: ${JSON.stringify(chars)}
Answer: {"readings": [{"id": 1, "reading": "..."}]}`;
}

const asArray = x => (Array.isArray(x) ? x : []);

// the units of step 1 must cover the syllables exactly; returns the clean units or an error text
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
    const seen = new Set();
    const candidates = asArray(u.candidates).filter(c => c && HAN.test(String(c.char)) && !seen.has(c.char) && seen.add(c.char)).slice(0, 4)
      .map(c => ({ char: c.char, reading: String(c.reading || ''), type: String(c.type || ''), reason: String(c.reason || ''), inDict: (dict.get(norm(syl.join(' '))) || []).includes(c.char) }));
    // the dictionary of the site is authoritative: its characters for this reading are always candidates, and come first
    const key = norm(syl.join(' ')), known = (dict.get(key) || []).slice(0, 3);
    for (const han of known) if (!candidates.some(c => c.char === han)) candidates.push({ char: han, reading: syl.join(' '), type: 'dictionary', reason: '', inDict: true });
    candidates.sort((a, b) => Number(b.inDict) - Number(a.inDict));
    units.push({ id: units.length + 1, qn: key, syllables: syl, candidates: candidates.slice(0, 6) });
  }
  if (pos !== syllables.length) return { error: `the units cover ${pos} of ${syllables.length} syllables` };
  return { units };
}

// a choice must come from the list of the unit, else the first candidate of the dictionary or of the list, else "?"
function applyChoices(units, raw) {
  const given = new Map(asArray(raw && raw.choices).map(c => [Number(c && c.id), c && c.char]));
  for (const u of units) {
    const c = given.get(u.id);
    if (c === '?') { u.chosen = '?'; continue; }
    const found = u.candidates.find(x => x.char === c);
    if (found) { u.chosen = found.char; continue; }
    const fallback = u.candidates.find(x => x.inDict) || u.candidates[0];
    u.chosen = fallback ? fallback.char : '?';
    if (c !== undefined && fallback) u.corrected = true;   // the model chose something outside the list
  }
}

const sameReading = (read, unit) => norm(read).replace(/\s+/g, ' ') === unit.qn;

export async function translate(text, { callModel, dict = new Map(), progress = () => {} }) {
  const tokens = tokenize(text);
  const syllables = tokens.filter(t => t.type === 'syl').map(t => t.text);
  if (!syllables.length) throw Object.assign(new Error('no text'), { code: 'empty' });
  const hints = [...new Set(syllables.map(norm))].filter(s => dict.has(s)).slice(0, 80).map(s => [s, dict.get(s).slice(0, 4).join(' ')]);

  // ---- step 1
  progress(1);
  let step = checkUnits(await callModel(SYSTEM, step1Prompt(syllables, hints)), syllables, dict);
  if (step.error) {   // one more try with the error named
    step = checkUnits(await callModel(SYSTEM, step1Prompt(syllables, hints) + `\nYour previous answer was rejected: ${step.error}. Follow the syllable list exactly.`), syllables, dict);
    if (step.error) throw Object.assign(new Error(step.error), { code: 'step1' });
  }
  const units = step.units;

  // ---- step 2
  progress(2);
  applyChoices(units, await callModel(SYSTEM, step2Prompt(units)));

  // ---- step 3: read back what was chosen (only the characters), compare with the units, repair once
  progress(3);
  const readBack = async () => {
    const todo = units.filter(u => u.chosen !== '?');
    const raw = await callModel(SYSTEM, step3Prompt(todo.map(u => ({ id: u.id, chars: u.chosen }))));
    const got = new Map(asArray(raw && raw.readings).map(r => [Number(r && r.id), String(r && r.reading || '')]));
    for (const u of todo) { u.read = got.get(u.id) || '?'; u.ok = sameReading(u.read, u); }
  };
  await readBack();
  const bad = units.filter(u => u.chosen !== '?' && !u.ok);
  if (bad.length) {
    const note = 'These units failed the back-reading check. Choose a different candidate (or "?") for exactly these units: ' + JSON.stringify(bad.map(u => ({ id: u.id, expected: u.qn, read_as: u.read, rejected: u.chosen })));
    const before = new Map(bad.map(u => [u.id, u.chosen]));
    const raw = await callModel(SYSTEM, step2Prompt(bad, note));
    const given = new Map(asArray(raw && raw.choices).map(c => [Number(c && c.id), c && c.char]));
    for (const u of bad) {
      const c = given.get(u.id);
      const next = c === '?' ? '?' : (u.candidates.find(x => x.char === c && x.char !== before.get(u.id)) || {}).char;
      if (next) u.chosen = next;
    }
    await readBack();
  }

  // ---- result: the text with its punctuation, the units with their state
  const out = [];
  let k = 0;   // index of the syllable
  const byFirst = new Map(), byLast = new Map();
  let p = 0;
  for (const u of units) { byFirst.set(p, u); p += u.syllables.length; byLast.set(p - 1, u); }
  const shown = u => u.chosen === '?' ? `[${u.qn}]` : u.chosen;
  for (const t of tokens) {
    if (t.type === 'other') { if (/\S/.test(t.text)) out.push(t.text.trim()); continue; }
    if (byFirst.has(k)) out.push(shown(byFirst.get(k)));
    k++;
  }
  const uncertain = units.filter(u => u.chosen === '?' || !u.ok).map(u => u.id);
  return {
    nom: out.join('').replace(/\s+/g, ''),
    qn: text.trim(),
    units: units.map(u => ({ id: u.id, qn: u.qn, chosen: u.chosen, read: u.read || '', ok: u.chosen !== '?' && u.ok, candidates: u.candidates })),
    uncertain,
  };
}
