-- One row per day with the numbers of the site (run once in the SQL Editor of Supabase). Many numbers of the other tables can not be looked
-- up later (the last sign-in and the last practice of a user are overwritten), so a job writes them at the end of every UTC day.
-- "of the day" = what happened on that UTC day; the totals = the state at the time of the snapshot (the difference of two days is the change).
-- The table can be read only through admin_stats() (see admin_stats.sql); nobody else sees it.

create table if not exists public.stats_daily (
  day date primary key,
  taken_at timestamptz not null default now(),
  -- of the day
  new_anonymous integer, new_accounts integer, signed_in_accounts integer,
  practised_users integer, decks_changed_users integer, deck_takeovers integer, decks_published integer,
  translate_users integer, translate_calls integer, translate_at_limit integer,
  readings_new integer,
  -- totals
  accounts_total integer, anonymous_total integer,
  practising_users integer, users_10_words integer, users_100_words integer,
  answers_correct bigint, answers_wrong bigint, words_known integer,
  decks_total integer, public_decks integer, deck_words bigint, deck_owners integer, deck_saves integer,
  score_total bigint, profiles_total integer, readings_total integer, slides_total integer
);
alter table public.stats_daily enable row level security;
revoke all on public.stats_daily from anon, authenticated;

-- writes (or renews) the row of a UTC day; the job calls it at 23:55 UTC for the day that is ending
create or replace function public.take_stats_snapshot(p_day date default (now() at time zone 'utc')::date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t0 timestamptz := p_day::timestamp at time zone 'utc';
  t1 timestamptz := (p_day + 1)::timestamp at time zone 'utc';
begin
  insert into public.stats_daily as s (
    day, taken_at,
    new_anonymous, new_accounts, signed_in_accounts, practised_users, decks_changed_users, deck_takeovers, decks_published,
    translate_users, translate_calls, translate_at_limit, readings_new,
    accounts_total, anonymous_total, practising_users, users_10_words, users_100_words, answers_correct, answers_wrong, words_known,
    decks_total, public_decks, deck_words, deck_owners, deck_saves, score_total, profiles_total, readings_total, slides_total)
  select
    p_day, now(),
    (select count(*) from auth.users where created_at >= t0 and created_at < t1 and coalesce(is_anonymous, false)),
    (select count(*) from auth.users where created_at >= t0 and created_at < t1 and not coalesce(is_anonymous, false)),
    (select count(*) from auth.users where last_sign_in_at >= t0 and last_sign_in_at < t1 and not coalesce(is_anonymous, false)),
    (select count(distinct user_id) from public.practice_progress where updated_at >= t0 and updated_at < t1),
    (select count(distinct user_id) from public.decks where updated_at >= t0 and updated_at < t1),
    (select count(*) from public.deck_saves where created_at >= t0 and created_at < t1),
    (select count(*) from public.decks where published_at >= t0 and published_at < t1),
    (select count(*) from public.translate_usage where day = p_day),
    (select coalesce(sum(n), 0) from public.translate_usage where day = p_day),
    (select count(*) from public.translate_usage where day = p_day and n >= 40),
    (select count(*) from public.readings where created_at >= t0 and created_at < t1 and not coalesce(deleted, false)),
    (select count(*) from auth.users where not coalesce(is_anonymous, false)),
    (select count(*) from auth.users where coalesce(is_anonymous, false)),
    (select count(distinct user_id) from public.practice_progress),
    (select count(*) from (select user_id from public.practice_progress where correct >= 4 group by user_id having count(*) >= 10) x),
    (select count(*) from (select user_id from public.practice_progress where correct >= 4 group by user_id having count(*) >= 100) x),
    (select coalesce(sum(correct), 0) from public.practice_progress),
    (select coalesce(sum(wrong), 0) from public.practice_progress),
    (select count(*) from public.practice_progress where correct >= 4),
    (select count(*) from public.decks),
    (select count(*) from public.decks where is_public),
    (select coalesce(sum(count), 0) from public.decks),
    (select count(distinct user_id) from public.decks),
    (select count(*) from public.deck_saves),
    (select coalesce(sum(score), 0) from public.profiles),
    (select count(*) from public.profiles),
    (select count(*) from public.readings where not coalesce(deleted, false)),
    (select count(*) from public.slides)
  on conflict (day) do update set
    taken_at = excluded.taken_at,
    new_anonymous = excluded.new_anonymous, new_accounts = excluded.new_accounts, signed_in_accounts = excluded.signed_in_accounts,
    practised_users = excluded.practised_users, decks_changed_users = excluded.decks_changed_users, deck_takeovers = excluded.deck_takeovers,
    decks_published = excluded.decks_published, translate_users = excluded.translate_users, translate_calls = excluded.translate_calls,
    translate_at_limit = excluded.translate_at_limit, readings_new = excluded.readings_new,
    accounts_total = excluded.accounts_total, anonymous_total = excluded.anonymous_total, practising_users = excluded.practising_users,
    users_10_words = excluded.users_10_words, users_100_words = excluded.users_100_words, answers_correct = excluded.answers_correct,
    answers_wrong = excluded.answers_wrong, words_known = excluded.words_known, decks_total = excluded.decks_total,
    public_decks = excluded.public_decks, deck_words = excluded.deck_words, deck_owners = excluded.deck_owners, deck_saves = excluded.deck_saves,
    score_total = excluded.score_total, profiles_total = excluded.profiles_total, readings_total = excluded.readings_total, slides_total = excluded.slides_total;
end;
$$;
revoke all on function public.take_stats_snapshot(date) from public, anon, authenticated;

-- every day at 23:55 UTC (pg_cron runs in UTC)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('stats-daily', '55 23 * * *', $$select public.take_stats_snapshot()$$);

-- the rows of the last p_days days for the statistics page (admins only, as admin_stats())
create or replace function public.admin_history(p_days integer default 60)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(h) order by h.day desc), '[]'::jsonb)
          from (select * from public.stats_daily order by day desc limit greatest(1, least(coalesce(p_days, 60), 400)) + 1) h);
end;
$$;
revoke all on function public.admin_history(integer) from public, anon;
grant execute on function public.admin_history(integer) to authenticated;
