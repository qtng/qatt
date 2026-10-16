// Edge Function "translate": Quốc Ngữ -> Chữ Nôm. The page sends the candidate lists of its dictionaries, Gemini only chooses from them
// in the context of the sentence (see pipeline.js).
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional), TRANSLATE_DAILY_LIMIT (optional, default 10 per user and day).
// The prompts (and, if listed there, the model names) are loaded from the website, see PROMPTS_URL: they are changed in the
// git repository qtng/chunom (js/translate_prompts.json), without deploying this function. The built-in defaults are the fallback.
// Only signed-in users (no anonymous ones) may call it, the key never leaves this function.
// Every call is logged as one row of numbers in public.translate_log (time, models, tokens, counts; no text and no user), see db/translate_log.sql;
// the words for which the model gave a character of its own are also stored with the words around them (public.translate_gaps), to find the gaps of the dictionary.
import { translate, parsePrompts, DEFAULT_PROMPTS } from './pipeline.js';

const ORIGINS = ['https://qatt.org', 'https://chunom.org', 'https://v2.chunom.org'];
const MAX_CHARS = 400;
const PROMPTS_URL = Deno.env.get('PROMPTS_URL') || 'https://chunom.org/chunom/js/translate_prompts.json';
// model names, tried in turn when one is overloaded or gone: secret GEMINI_MODEL (comma separated), else the file of the website, else these
const DEFAULT_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
const ENV_MODELS = (Deno.env.get('GEMINI_MODEL') || '').split(',').map(m => m.trim()).filter(Boolean);
let MODELS = ENV_MODELS.length ? ENV_MODELS : DEFAULT_MODELS;
const LIMIT = Number(Deno.env.get('TRANSLATE_DAILY_LIMIT') || 10);
console.log('daily limit', LIMIT, Deno.env.get('TRANSLATE_DAILY_LIMIT') ? '(secret TRANSLATE_DAILY_LIMIT)' : '(default)');

// the prompts of the website, kept for 1 minute (a changed file is used soon; the query string avoids the cache of the CDN); if the file cannot be loaded or is invalid the last good version (or the defaults) stays
type Config = { at: number; prompts: typeof DEFAULT_PROMPTS; models: string[] | null; version: string };
let config: Config = { at: 0, prompts: DEFAULT_PROMPTS, models: null, version: 'built-in' };
async function loadConfig() {
  if (Date.now() - config.at < 60 * 1000) return config;
  try {
    const r = await fetch(PROMPTS_URL + '?t=' + Date.now(), { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const p = parsePrompts(await r.json());
    config = { at: Date.now(), prompts: p.prompts, models: p.models, version: p.version || 'unnamed' };
    console.log('prompts loaded, version', config.version);
  } catch (e) {
    console.error('prompts not loaded, keeping version', config.version, String(e));
    config = { ...config, at: Date.now() - 30 * 1000 };   // try again in 30 seconds
  }
  return config;
}

const cors = (req: Request) => {
  const origin = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], 'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
};

// the gateway has verified the token (verify_jwt); here only its content is read
function claims(req: Request) {
  try {
    const payload = (req.headers.get('authorization') || '').replace(/^Bearer /i, '').split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch { return null; }
}

let modelsLogged = false;
async function logModels(key: string) {   // once per instance: which models this key may use (for the log only)
  if (modelsLogged) return; modelsLogged = true;
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': key }, signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    console.log('available models:', (d.models || []).filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m: { name: string }) => m.name.replace('models/', '')).join(', '));
  } catch (e) { console.error('list models', e); }
}

// a model that answered 429 (quota) or 503 (overloaded) or 404 (gone) is skipped for a minute, so the next call does not lose time on it
const coolDown = new Map<string, number>();

// what a call of the page cost: collected over the calls of Gemini of one translation, written to translate_log
type Attempt = { model: string; status: number; ms: number; tokens_in?: number; tokens_out?: number };   // status: the HTTP status, 0 = no answer
type Meter = { tries: number; failed: number; models: string[]; tokensIn: number; tokensOut: number; geminiMs: number; attempts: Attempt[] };
const newMeter = (): Meter => ({ tries: 0, failed: 0, models: [], tokensIn: 0, tokensOut: 0, geminiMs: 0, attempts: [] });

async function callGemini(system: string, user: string, opts: { attempts?: number; meter?: Meter } = {}) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw Object.assign(new Error('no key'), { code: 'config' });
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
  let last = 'busy';
  for (let attempt = 0; attempt < (opts.attempts || 5); attempt++) {
    const live = MODELS.filter(m => (coolDown.get(m) || 0) < Date.now());
    const model = (live.length ? live : MODELS)[attempt % (live.length || MODELS.length)];
    const t0 = Date.now();
    if (opts.meter) opts.meter.tries++;
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: AbortSignal.timeout(60000), method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
    } catch (e) { console.error('gemini', model, 'no answer', Date.now() - t0, 'ms', String(e)); last = 'busy'; if (opts.meter) { opts.meter.failed++; opts.meter.attempts.push({ model, status: 0, ms: Date.now() - t0 }); } continue; }
    if (r.status === 429 || r.status >= 500 || r.status === 404) {
      if (opts.meter) { opts.meter.failed++; opts.meter.attempts.push({ model, status: r.status, ms: Date.now() - t0 }); }
      console.error('gemini', model, r.status, Date.now() - t0, 'ms', (await r.text()).slice(0, 300));
      last = r.status === 404 ? 'model' : 'busy';
      if (r.status === 429 || r.status === 503 || r.status === 404) coolDown.set(model, Date.now() + 60000);
      if (attempt === 1) await logModels(key);
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    if (!r.ok) { if (opts.meter) opts.meter.attempts.push({ model, status: r.status, ms: Date.now() - t0 }); console.error('gemini', model, r.status, (await r.text()).slice(0, 500)); throw Object.assign(new Error('model ' + r.status), { code: 'model' }); }
    const data = await r.json();
    console.log('gemini', model, r.status, Date.now() - t0, 'ms');
    if (opts.meter) {
      opts.meter.models.push(model); opts.meter.geminiMs += Date.now() - t0;
      const tin = Number(data?.usageMetadata?.promptTokenCount) || 0, tout = (Number(data?.usageMetadata?.candidatesTokenCount) || 0) + (Number(data?.usageMetadata?.thoughtsTokenCount) || 0);
      opts.meter.tokensIn += tin; opts.meter.tokensOut += tout;
      opts.meter.attempts.push({ model, status: 200, ms: Date.now() - t0, tokens_in: tin, tokens_out: tout });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return {}; }
  }
  throw Object.assign(new Error(last), { code: last });
}

// counts the use of today and returns the number of uses today (null if the counter fails)
async function hit(userId: string): Promise<number | null> {
  const base = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r = await fetch(`${base}/rest/v1/rpc/translate_hit`, { method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user: userId }) });
  if (!r.ok) return null;   // a failing counter must not block the page
  return Number(await r.json());
}

// the words with a character of the model's own (or "?"). Each is stored with its context: the words around it (`context` on each side, fewer at the start or end
// of the sentence) in Quốc Ngữ and the characters chosen for them, as arrays, and idx = the place of the word in these arrays (from 1). The page sets `context`
// in its request (MIN_CONTEXT to MAX_CONTEXT, default DEFAULT_CONTEXT; one word on each side is always stored), so the window can change without a change of the table or of this function. Also its position and the
// length of the sentence in words; n_options = how many options the page sent for the word (0: the dictionary has nothing for it). The rest of the sentence is not stored.
const MIN_CONTEXT = 1, DEFAULT_CONTEXT = 3, MAX_CONTEXT = 3;
type Gap = { word_qn: string; word_char: string; n_options: number; ctx_qn: string[]; ctx_chars: string[]; idx: number; pos: number; n_words: number; model: string | null };
// A cheap check that a word can be Quốc Ngữ at all, so that English words, names, URLs, Chinese text and typos do not fill the table of gaps. Every syllable is
// onset + vowels + ending, each part optional except the vowels: the onsets of Vietnamese (b c ch d đ g gh h k kh l m n ng ngh nh p ph q r s t th tr v x; "gi" is g + the vowel i,
// "qu" is q + the vowel u), 1 to 3 vowels (with all their tone marks), and as the only endings c ch m n ng nh p t. That also means: a vowel in every syllable, no consonant
// between two vowels, nothing but the letters of the Vietnamese alphabet (no f j w z, no digits, no other script; the tokenizer of pipeline.js already cuts the words at digits
// and special characters). It does not catch every foreign word that looks like a syllable ("you"). A gap is only stored when the word and all the words around it that are
// stored with it pass the check: a sentence of English or of mangled text ("all ò thí í fake cỏp") then leaves nothing, a Vietnamese sentence keeps its gaps.
const VOWELS = 'aăâeêioôơuưyàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ';
const SYLLABLE = new RegExp(`^(?:ngh|ng|nh|ph|th|tr|ch|kh|gh|[bcdđghklmnpqrstvx])?[${VOWELS}]{1,3}(?:ng|nh|ch|[cmnpt])?$`);
const vietnamese = (qn: string) => qn.normalize('NFC').split(' ').every(s => SYLLABLE.test(s));
function gapRows(words: { at: number; len: number; qn: string; chosen: string; own: boolean }[], spans: unknown, model: string | null, context: number): Gap[] {
  const sent = Array.isArray(spans) ? spans as { at: number; len: number; options?: unknown[] }[] : [];
  const rows: Gap[] = [];
  words.forEach((w, i) => {
    if (!w.own) return;
    const from = Math.max(0, i - context), around = words.slice(from, i + context + 1), span = sent.find(s => s && s.at === w.at && s.len === w.len);
    if (!around.every(x => vietnamese(x.qn))) return;   // the word itself is one of them
    rows.push({ word_qn: w.qn, word_char: w.chosen, n_options: span && Array.isArray(span.options) ? span.options.length : 0,
      ctx_qn: around.map(x => x.qn), ctx_chars: around.map(x => x.chosen), idx: i - from + 1, pos: i + 1, n_words: words.length, model });
  });
  return rows.slice(0, 30);
}

// one row of numbers per call, one per try of a model (translate_attempts), the gaps of the dictionary (translate_gaps); a failing log must never break the translation
// admin = the call came from an admin (app_metadata.is_admin of the token): all rows get the mark, so the statistics can leave the tests of the owner out
async function logCall(admin: boolean, row: Record<string, unknown>, attempts: Attempt[] = [], gaps: Gap[] = []) {
  await logRows('translate_log', { ...row, is_admin: admin });
  // PostgREST wants the same keys in every object of a bulk insert: the tries that failed have no tokens, so they get null
  if (attempts.length) await logRows('translate_attempts', attempts.map(a => ({ model: a.model, status: a.status, ms: a.ms, tokens_in: a.tokens_in ?? null, tokens_out: a.tokens_out ?? null, is_admin: admin })));
  if (gaps.length) await logRows('translate_gaps', gaps.map(g => ({ ...g, is_admin: admin })));
}
async function logRows(table: string, row: Record<string, unknown> | Record<string, unknown>[]) {
  try {
    const base = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const r = await fetch(`${base}/rest/v1/${table}`, { method: 'POST', signal: AbortSignal.timeout(4000),
      headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
    if (!r.ok) console.error(table, r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.error(table, String(e)); }
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const fail = (status: number, code: string) => new Response(JSON.stringify({ error: code }), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return fail(405, 'method');
  const c = claims(req);
  if (!c || !c.sub || c.is_anonymous === true || c.role !== 'authenticated') return fail(401, 'sign_in');
  const admin = String(c.app_metadata?.is_admin) === 'true';   // only to mark the log rows; an admin is treated like everybody else
  let text = '', spans: unknown = [], lang = '', context = DEFAULT_CONTEXT;
  try {
    const body = await req.json(); text = String(body.text || '').trim(); spans = body.spans; lang = String(body.lang || '');
    if (Number.isInteger(body.context)) context = Math.min(MAX_CONTEXT, Math.max(MIN_CONTEXT, body.context));   // the words around a gap that are stored, set by the page
  } catch { return fail(400, 'bad_request'); }
  if (!text) return fail(400, 'empty');
  if (text.length > MAX_CHARS) return fail(413, 'too_long');
  const used = await hit(c.sub);
  if (used !== null && used > LIMIT) return fail(429, 'limit');
  const left = used === null ? null : Math.max(0, LIMIT - used);   // shown by the page ("n requests left today")
  const cfg = await loadConfig();
  MODELS = ENV_MODELS.length ? ENV_MODELS : (cfg.models || DEFAULT_MODELS);

  // the answer is a stream of lines (JSON): progress of the steps, then the result or an error
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      const meter = newMeter(), t0 = Date.now();
      try {
        const result = await translate(text, spans, { callModel: (sys: string, usr: string) => callGemini(sys, usr, { meter }), prompts: cfg.prompts, lang, progress: (step: number) => send({ step }) });
        console.log('result', cfg.version, JSON.stringify(result.words.map((w: { qn: string; chosen: string; own: boolean }) => [w.qn, w.chosen, w.own ? 'own' : 'list'])));
        send({ result: { ...result, version: cfg.version, left, limit: LIMIT } });
        const ws = result.words as { at: number; len: number; qn: string; chosen: string; own: boolean }[];
        const answered = meter.models[meter.models.length - 1] || null;
        await logCall(admin, { status: result.fallback ? 'fallback' : 'ok', ms: Date.now() - t0, gemini_ms: meter.geminiMs, tries: meter.tries, failed_tries: meter.failed,
          model: meter.models[meter.models.length - 1] || null, lang: lang || null, syllables: result.words.reduce((n: number, w: { len: number }) => n + w.len, 0),
          words: ws.length, own_words: ws.filter(w => w.own).length, tokens_in: meter.tokensIn, tokens_out: meter.tokensOut, prompts_version: cfg.version, chars: text.length }, meter.attempts, gapRows(ws, spans, answered, context));
      } catch (e) {
        console.error('translate failed', e);
        send({ error: (e as { code?: string }).code || 'failed' });
        await logCall(admin, { status: (e as { code?: string }).code || 'failed', ms: Date.now() - t0, gemini_ms: meter.geminiMs, tries: meter.tries, failed_tries: meter.failed,
          model: meter.models[meter.models.length - 1] || null, lang: lang || null, tokens_in: meter.tokensIn, tokens_out: meter.tokensOut, prompts_version: cfg.version, chars: text.length }, meter.attempts);
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
});
