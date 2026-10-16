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
