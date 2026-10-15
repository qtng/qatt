// Edge Function "translate": Quốc Ngữ -> Chữ Nôm with Gemini in three automatic steps (see pipeline.js).
// Secrets: GEMINI_API_KEY (required), GEMINI_MODEL (optional), TRANSLATE_DAILY_LIMIT (optional, default 40 per user and day).
// Only signed-in users (no anonymous ones) may call it, the key never leaves this function.
import { translate, parseDict } from './pipeline.js';

const ORIGINS = ['https://qatt.org', 'https://v2.chunom.org', 'https://chunom.org'];
const MAX_CHARS = 400;
const DICT_URL = Deno.env.get('DICT_URL') || 'https://v2.chunom.org/chunom/dict.csv';
// GEMINI_MODEL may hold several names separated by commas: they are tried in turn when one is overloaded or gone
const MODELS = (Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash,gemini-3.1-flash-lite,gemini-3.8-flash').split(',').map(m => m.trim()).filter(Boolean);
const LIMIT = Number(Deno.env.get('TRANSLATE_DAILY_LIMIT') || 40);

let dictCache: Map<string, string[]> | null = null;
async function dictionary() {
  if (dictCache) return dictCache;
  const t0 = Date.now();
  try { dictCache = parseDict(await (await fetch(DICT_URL, { signal: AbortSignal.timeout(8000) })).text()); } catch (e) { console.error('dictionary', e); dictCache = new Map(); }
  console.log('dictionary', dictCache.size, 'readings,', Date.now() - t0, 'ms');
  return dictCache;
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

async function callGemini(system: string, user: string) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw Object.assign(new Error('no key'), { code: 'config' });
  const body = JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } });
  let last = 'busy';
  for (let attempt = 0; attempt < 5; attempt++) {
    const model = MODELS[attempt % MODELS.length];
    const t0 = Date.now();
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: AbortSignal.timeout(40000), method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body });
    } catch (e) { console.error('gemini', model, 'no answer', Date.now() - t0, 'ms', String(e)); last = 'busy'; continue; }
    if (r.status === 429 || r.status >= 500 || r.status === 404) {
      console.error('gemini', model, r.status, Date.now() - t0, 'ms', (await r.text()).slice(0, 300));
      last = r.status === 404 ? 'model' : 'busy';
      if (attempt === 1) await logModels(key);
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
      continue;
    }
    if (!r.ok) { console.error('gemini', model, r.status, (await r.text()).slice(0, 500)); throw Object.assign(new Error('model ' + r.status), { code: 'model' }); }
    const data = await r.json();
    console.log('gemini', model, r.status, Date.now() - t0, 'ms');
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || '';
    try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { return {}; }
  }
  throw Object.assign(new Error(last), { code: last });
}

// counts the use of today; false when the limit is reached
async function allowed(userId: string) {
  const base = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const r = await fetch(`${base}/rest/v1/rpc/translate_hit`, { method: 'POST',
    headers: { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_user: userId }) });
  if (!r.ok) return true;   // a failing counter must not block the page
  return Number(await r.json()) <= LIMIT;
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  const fail = (status: number, code: string) => new Response(JSON.stringify({ error: code }), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (req.method !== 'POST') return fail(405, 'method');
  const c = claims(req);
  if (!c || !c.sub || c.is_anonymous === true || c.role !== 'authenticated') return fail(401, 'sign_in');
  let text = '';
  try { text = String((await req.json()).text || '').trim(); } catch { return fail(400, 'bad_request'); }
  if (!text) return fail(400, 'empty');
  if (text.length > MAX_CHARS) return fail(413, 'too_long');
  if (!(await allowed(c.sub))) return fail(429, 'limit');

  // the answer is a stream of lines (JSON): progress of the steps, then the result or an error
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      try {
        const result = await translate(text, { callModel: callGemini, dict: await dictionary(), progress: (step: number) => send({ step }) });
        send({ result });
      } catch (e) {
        console.error('translate failed', e);
        send({ error: (e as { code?: string }).code || 'failed' });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { ...headers, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
});
