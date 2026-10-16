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
-- suitable option. With the word before and after (Quốc Ngữ and the characters chosen for the three), "-" where there is none.
-- Only these words are stored, not the sentence; the context is at most one word on each side.
create table if not exists public.translate_gaps (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  word_qn text not null,          -- the word (one or more syllables), as sent by the page, lower case
  word_char text not null,        -- the character(s) the model chose, "?" if it knew none
  n_options integer,              -- how many options the page had for this word (0 = the dictionary has nothing for it)
  context_qn text not null,       -- "before | word | after"
  context_chars text not null,    -- the characters chosen for the same three words
  model text
);
create index if not exists translate_gaps_at on public.translate_gaps (at);
alter table public.translate_gaps enable row level security;
revoke all on public.translate_gaps from anon, authenticated;
grant insert on public.translate_gaps to service_role;

-- the gaps of the last p_days days: the words with the most gaps, and the newest rows
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
    'top', (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.last_at desc), '[]'::jsonb) from (
      select word_qn, word_char, count(*) as n, max(n_options) as n_options, max(at) as last_at,
        (array_agg(context_qn order by at desc))[1] as example_qn, (array_agg(context_chars order by at desc))[1] as example_chars
      from public.translate_gaps where at > now() - make_interval(days => d) group by word_qn, word_char order by count(*) desc, max(at) desc limit 200) x),
    'recent', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select at, word_qn, word_char, n_options, context_qn, context_chars, model
      from public.translate_gaps where at > now() - make_interval(days => d) order by at desc limit 50) x)
  );
end;
$$;
revoke all on function public.admin_gaps(integer) from public, anon;
grant execute on function public.admin_gaps(integer) to authenticated;

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
