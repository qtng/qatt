-- One-time change of the live database (run in the SQL Editor of Supabase; the same as the changes in translate_log.sql):
-- the calls of admins are marked (is_admin) and the statistics can leave them out or show only them (parameter p_who: 'all', 'users', 'admins').
-- Run it BEFORE the page admin/translator.html and the function "translate" with the mark are online.
alter table public.translate_log add column if not exists is_admin boolean not null default false;
alter table public.translate_attempts add column if not exists is_admin boolean not null default false;
alter table public.translate_gaps add column if not exists is_admin boolean not null default false;

-- The functions got the parameter p_who: the old versions (without it) must go, or the call by name would be ambiguous.
drop function if exists public.admin_gaps(integer);
drop function if exists public.admin_gap_contexts(text, integer);
drop function if exists public.admin_gap_export(integer);
drop function if exists public.admin_languages(integer);

-- Which calls the statistics count (the parameter p_who of the admin functions below): 'all' (default), 'users' (leave the admins out: their own tests),
-- 'admins' (only them). The mark is_admin is set by the function "translate" from app_metadata.is_admin of the token of the call.
create or replace function public.admin_who_ok(p_who text, p_is_admin boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$ select case p_who when 'users' then not p_is_admin when 'admins' then p_is_admin else true end $$;
revoke all on function public.admin_who_ok(text, boolean) from public, anon, authenticated;


create or replace function public.admin_gaps(p_days integer default 30, p_who text default 'all')
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
    'rows', (select count(*) from public.translate_gaps where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin)),
    'words', (select count(distinct word_qn) from public.translate_gaps where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin)),
    'nothing_in_dictionary', (select count(*) from public.translate_gaps where at > now() - make_interval(days => d) and n_options = 0 and public.admin_who_ok(p_who, is_admin)),
    'top', (select coalesce(jsonb_agg(to_jsonb(x) order by x.n desc, x.last_at desc), '[]'::jsonb) from (
      select g.word_qn, count(*) as n, max(g.n_options) as n_options, max(g.at) as last_at,
        (select jsonb_agg(jsonb_build_object('c', c.word_char, 'n', c.n) order by c.n desc)
           from (select word_char, count(*) as n from public.translate_gaps g2
                 where g2.word_qn = g.word_qn and g2.at > now() - make_interval(days => d) and public.admin_who_ok(p_who, g2.is_admin) group by word_char) c) as chars
      from public.translate_gaps g where g.at > now() - make_interval(days => d) and public.admin_who_ok(p_who, g.is_admin)
      group by g.word_qn order by count(*) desc, max(g.at) desc limit 200) x),
    'recent', (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb) from (
      select at, word_qn, word_char, n_options, ctx_qn, ctx_chars, idx, pos, n_words, model, is_admin
      from public.translate_gaps where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin) order by at desc limit 50) x)
  );
end;
$$;
revoke all on function public.admin_gaps(integer, text) from public, anon;
grant execute on function public.admin_gaps(integer, text) to authenticated;

create or replace function public.admin_gap_contexts(p_word text, p_days integer default 30, p_who text default 'all')
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
    from public.translate_gaps where word_qn = p_word and at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin)
    group by word_char, ctx_qn, ctx_chars, idx order by count(*) desc, max(at) desc limit 100) x);
end;
$$;
revoke all on function public.admin_gap_contexts(text, integer, text) from public, anon;
grant execute on function public.admin_gap_contexts(text, integer, text) to authenticated;

create or replace function public.admin_languages(p_days integer default 30, p_who text default 'all')
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
      from public.translate_log where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin) group by 1) x),
    'by_lang_model', (select coalesce(jsonb_agg(to_jsonb(x) order by x.lang, x.calls desc), '[]'::jsonb) from (
      select coalesce(nullif(lang, ''), '-') as lang, coalesce(model, '-') as model, count(*) as calls,
        count(*) filter (where status not in ('ok', 'fallback')) as errors,
        count(*) filter (where status = 'fallback') as fallback,
        round(avg(ms)) as avg_ms
      from public.translate_log where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin) group by 1, 2) x),
    'daily', (select coalesce(jsonb_agg(to_jsonb(x) order by x.day, x.lang), '[]'::jsonb) from (
      select (at at time zone 'utc')::date as day, coalesce(nullif(lang, ''), '-') as lang, count(*) as calls
      from public.translate_log where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin) group by 1, 2) x)
  );
end;
$$;
revoke all on function public.admin_languages(integer, text) from public, anon;
grant execute on function public.admin_languages(integer, text) to authenticated;

create or replace function public.admin_gap_export(p_days integer default 30, p_who text default 'all')
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
    select at, word_qn, word_char, n_options, ctx_qn, ctx_chars, idx, pos, n_words, model, is_admin
    from public.translate_gaps where at > now() - make_interval(days => d) and public.admin_who_ok(p_who, is_admin) order by at desc limit 5000) x);
end;
$$;
revoke all on function public.admin_gap_export(integer, text) from public, anon;
grant execute on function public.admin_gap_export(integer, text) to authenticated;
