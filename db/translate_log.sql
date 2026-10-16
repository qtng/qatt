-- Log of the translator (run once in the SQL Editor of Supabase): one row of numbers per call of the Edge Function "translate".
-- No text of the sentence, no user: only how long it took, which model answered, how many words came from the list of the page or were the
-- model's own, the tokens (the cost) and the result (ok, fallback = the model's answer was unusable, or the error code).
-- The function writes with the service key; the table can be read only through admin_translate() (admins only).

create table if not exists public.translate_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  status text not null,          -- ok, fallback, or an error code (busy, model, limit, empty, bad_request, ...)
  ms integer,                    -- the whole call
  gemini_ms integer,             -- of it in the calls of Gemini that answered
  tries integer,                 -- calls of Gemini including the failed ones
  failed_tries integer,
  model text,                    -- the model that gave the answer
  lang text,                     -- language of the free translation ('' = none)
  chars integer,                 -- length of the sentence
  syllables integer,
  words integer,
  own_words integer,             -- words where the model gave its own character (not from the list)
  tokens_in integer,
  tokens_out integer,
  prompts_version text
);
create index if not exists translate_log_at on public.translate_log (at);
alter table public.translate_log enable row level security;
revoke all on public.translate_log from anon, authenticated;
grant insert on public.translate_log to service_role;   -- the function writes with the service key (it only inserts)

-- numbers of the last p_days days for the statistics page (admins only, as admin_stats())
create or replace function public.admin_translate(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 14), 90));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    'daily', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day desc), '[]'::jsonb) from (
      select (at at time zone 'utc')::date as day, count(*) as calls,
        count(*) filter (where status = 'ok') as ok,
        count(*) filter (where status = 'fallback') as fallback,
        count(*) filter (where status not in ('ok', 'fallback')) as errors,
        round(avg(ms) filter (where status in ('ok', 'fallback'))) as avg_ms,
        round((percentile_cont(0.95) within group (order by ms) filter (where status in ('ok', 'fallback')))::numeric) as p95_ms,
        coalesce(sum(failed_tries), 0) as failed_tries,
        coalesce(sum(words), 0) as words, coalesce(sum(own_words), 0) as own_words,
        coalesce(sum(tokens_in), 0) as tokens_in, coalesce(sum(tokens_out), 0) as tokens_out
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x),
    'by_model', (select coalesce(jsonb_agg(to_jsonb(x) order by x.calls desc), '[]'::jsonb) from (
      select coalesce(model, '-') as model, count(*) as calls, round(avg(gemini_ms)) as avg_gemini_ms
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x),
    'by_lang', (select coalesce(jsonb_agg(to_jsonb(x) order by x.calls desc), '[]'::jsonb) from (
      select coalesce(nullif(lang, ''), '-') as lang, count(*) as calls
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x),
    'by_status', (select coalesce(jsonb_agg(to_jsonb(x) order by x.calls desc), '[]'::jsonb) from (
      select status, count(*) as calls
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x)
  );
end;
$$;
revoke all on function public.admin_translate(integer) from public, anon;
grant execute on function public.admin_translate(integer) to authenticated;

-- One row per try of a model of Gemini (a call of the page can need several: a model that is overloaded or over its quota is followed by the next).
-- status = the HTTP status of the answer (200 ok, 429 quota, 503 overloaded, 404 model unknown, ...), 0 = no answer at all (time out, network).
create table if not exists public.translate_attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  model text not null,
  status integer not null,
  ms integer,
  tokens_in integer,
  tokens_out integer
);
create index if not exists translate_attempts_at on public.translate_attempts (at);
alter table public.translate_attempts enable row level security;
revoke all on public.translate_attempts from anon, authenticated;
grant insert on public.translate_attempts to service_role;

-- the evaluation of the models of the last p_days days (admin/models.html; admins only)
create or replace function public.admin_models(p_days integer default 7)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 7), 90));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    -- every try of a model: how often it worked, was over its quota, was overloaded, and how long a working try took
    'tries', (select coalesce(jsonb_agg(to_jsonb(x) order by x.tries desc), '[]'::jsonb) from (
      select model, count(*) as tries,
        count(*) filter (where status = 200) as ok,
        count(*) filter (where status = 429) as quota,
        count(*) filter (where status = 503) as overloaded,
        count(*) filter (where status not in (200, 429, 503)) as other,
        round(avg(ms) filter (where status = 200)) as avg_ms,
        round((percentile_cont(0.5) within group (order by ms) filter (where status = 200))::numeric) as p50_ms,
        round((percentile_cont(0.95) within group (order by ms) filter (where status = 200))::numeric) as p95_ms,
        round(avg(tokens_in) filter (where status = 200)) as avg_tokens_in,
        round(avg(tokens_out) filter (where status = 200)) as avg_tokens_out,
        max(at) as last_at
      from public.translate_attempts where at > now() - make_interval(days => d) group by model) x),
    -- the calls that this model answered: the quality (own characters, fallback) and the time of the whole call
    'answers', (select coalesce(jsonb_agg(to_jsonb(x) order by x.calls desc), '[]'::jsonb) from (
      select coalesce(model, '-') as model, count(*) as calls,
        count(*) filter (where status = 'fallback') as fallback,
        coalesce(sum(words), 0) as words, coalesce(sum(own_words), 0) as own_words,
        round(avg(ms)) as avg_call_ms
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x),
    -- per day and model
    'daily', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.model), '[]'::jsonb) from (
      select (at at time zone 'utc')::date as day, model, count(*) as tries,
        count(*) filter (where status = 200) as ok,
        round(avg(ms) filter (where status = 200)) as avg_ms
      from public.translate_attempts where at > now() - make_interval(days => d) group by 1, 2) x)
  );
end;
$$;
revoke all on function public.admin_models(integer) from public, anon;
grant execute on function public.admin_models(integer) to authenticated;

-- Gaps of the dictionary: every word for which the model gave a character of its own (or "?" = it knew none), because the list of the page had no
-- suitable option. The context is stored as arrays: the words around the gap (3 on each side if the page sends nothing, fewer at the start or end of the sentence; the window is
-- set by the translator page in its request as "context", 1 to 5: 5 if the user helps to improve the model, else 1; so it can change without a change of the table or of the function) in Quốc Ngữ and the characters chosen for them, and idx = the
-- place of the gap word in the arrays, from 1: ctx_qn[idx] is the word. Only these words, not the sentence.
create table if not exists public.translate_gaps (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  word_qn text not null,          -- the word (one or more syllables), as sent by the page, lower case
  word_char text not null,        -- the character(s) the model chose, "?" if it knew none
  n_options integer,              -- how many options the page had for this word (0 = the dictionary has nothing for it)
  ctx_qn text[],                  -- the words around, e.g. {tôi, ở, "cao nguyên", rộng}
  ctx_chars text[],               -- the characters chosen for them, the same order
  idx integer,                    -- the place of the gap word in ctx_qn and ctx_chars (from 1)
  pos integer,                    -- the number of the word in the sentence, 1 = first
  n_words integer,                -- the number of words of the sentence
  model text
);
-- (The live table was made in two earlier versions and still has the unused, empty columns context_qn, context_chars, prev_qn, prev_char, next_qn, next_char;
--  they can be dropped: alter table public.translate_gaps drop column context_qn, drop column context_chars, drop column prev_qn, drop column prev_char, drop column next_qn, drop column next_char;)
create index if not exists translate_gaps_at on public.translate_gaps (at);
create index if not exists translate_gaps_word on public.translate_gaps (word_qn);
alter table public.translate_gaps enable row level security;
revoke all on public.translate_gaps from anon, authenticated;
grant insert on public.translate_gaps to service_role;

-- the gaps of the last p_days days: per word how often and which characters the model chose, and the newest rows
create or replace function public.admin_gaps(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    'rows', (select count(*) from public.translate_gaps where at > now() - make_interval(days => d)),
    'words', (select count(distinct word_qn) from public.translate_gaps where at > now() - make_interval(days => d)),
    'nothing_in_dictionary', (select count(*) from public.translate_gaps where at > now() - make_interval(days => d) and n_options = 0),
    'top', (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.last_at desc), '[]'::jsonb) from (
      select g.word_qn, count(*) as n, max(g.n_options) as n_options, max(g.at) as last_at,
        (select jsonb_agg(jsonb_build_object('c', c.word_char, 'n', c.n) order by c.n desc)
           from (select word_char, count(*) as n from public.translate_gaps g2
                 where g2.word_qn = g.word_qn and g2.at > now() - make_interval(days => d) group by word_char) c) as chars
      from public.translate_gaps g where g.at > now() - make_interval(days => d)
      group by g.word_qn order by count(*) desc, max(g.at) desc limit 200) x),
    'recent', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select at, word_qn, word_char, n_options, ctx_qn, ctx_chars, idx, pos, n_words, model
      from public.translate_gaps where at > now() - make_interval(days => d) order by at desc limit 50) x)
  );
end;
$$;
revoke all on function public.admin_gaps(integer) from public, anon;
grant execute on function public.admin_gaps(integer) to authenticated;

-- the contexts of one word, each combination with how often (for the SQL editor; admins only)
create or replace function public.admin_gap_contexts(p_word text, p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.last_at desc), '[]'::jsonb) from (
    select word_char, ctx_qn, ctx_chars, idx, count(*) as n, max(at) as last_at, max(n_options) as n_options
    from public.translate_gaps where word_qn = p_word and at > now() - make_interval(days => d)
    group by word_char, ctx_qn, ctx_chars, idx order by count(*) desc, max(at) desc limit 100) x);
end;
$$;
revoke all on function public.admin_gap_contexts(text, integer) from public, anon;
grant execute on function public.admin_gap_contexts(text, integer) to authenticated;

-- the languages of the free translation: per language and per day, and the results per language and model
create or replace function public.admin_languages(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    'by_lang', (select coalesce(jsonb_agg(to_jsonb(x) order by x.calls desc), '[]'::jsonb) from (
      select coalesce(nullif(lang, ''), '-') as lang, count(*) as calls,
        count(*) filter (where status = 'ok') as ok,
        count(*) filter (where status = 'fallback') as fallback,
        count(*) filter (where status not in ('ok', 'fallback')) as errors,
        round(avg(ms) filter (where status in ('ok', 'fallback'))) as avg_ms,
        coalesce(sum(words), 0) as words, coalesce(sum(own_words), 0) as own_words
      from public.translate_log where at > now() - make_interval(days => d) group by 1) x),
    'by_lang_model', (select coalesce(jsonb_agg(to_jsonb(x) order by x.lang, x.calls desc), '[]'::jsonb) from (
      select coalesce(nullif(lang, ''), '-') as lang, coalesce(model, '-') as model, count(*) as calls,
        count(*) filter (where status not in ('ok', 'fallback')) as errors,
        count(*) filter (where status = 'fallback') as fallback,
        round(avg(ms)) as avg_ms
      from public.translate_log where at > now() - make_interval(days => d) group by 1, 2) x),
    'daily', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.lang), '[]'::jsonb) from (
      select (at at time zone 'utc')::date as day, coalesce(nullif(lang, ''), '-') as lang, count(*) as calls
      from public.translate_log where at > now() - make_interval(days => d) group by 1, 2) x)
  );
end;
$$;
revoke all on function public.admin_languages(integer) from public, anon;
grant execute on function public.admin_languages(integer) to authenticated;

-- all gap rows of the last p_days days (at most 5000, newest first) for the CSV download of admin/translator.html
create or replace function public.admin_gap_export(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d integer := greatest(1, least(coalesce(p_days, 30), 365));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
    select at, word_qn, word_char, n_options, ctx_qn, ctx_chars, idx, pos, n_words, model
    from public.translate_gaps where at > now() - make_interval(days => d) order by at desc limit 5000) x);
end;
$$;
revoke all on function public.admin_gap_export(integer) from public, anon;
grant execute on function public.admin_gap_export(integer) to authenticated;
