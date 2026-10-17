-- Score and speed of the game Spell it! (spell.html), kept on the server for signed-in users (run once in the SQL Editor of Supabase).
-- Everybody can play; only signed-in users (not anonymous ones) are written here and ranked. The game writes only through the functions below;
-- a user can read only the own rows of the tables, the leaderboard comes from spell_leaderboard().
--
-- spell_scores: the score of the user (one row per user): +10 a right choice, -2 a wrong one, a bonus for a solved word, ... (calculated in the page).
-- spell_speed:  the speed of the user per decoding (the reading of the rhyme table decides which symbols a word has): per kind of symbol (onset, rhyme, tone)
--               v the slow exponentially smoothed time in seconds (the one that is ranked), f the fast one, n how many times went in, m how many milestones were reached.

create table if not exists public.spell_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  score integer not null default 0 check (score >= 0),
  words integer not null default 0 check (words >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.spell_speed (
  user_id uuid not null references auth.users (id) on delete cascade,
  decoding text not null check (decoding in ('qatt', 'omniglot')),
  onset_v real not null default 0 check (onset_v between 0 and 10),
  onset_f real not null default 0 check (onset_f between 0 and 10),
  onset_n integer not null default 0 check (onset_n >= 0),
  onset_m smallint not null default 0 check (onset_m between 0 and 10),
  rhyme_v real not null default 0 check (rhyme_v between 0 and 10),
  rhyme_f real not null default 0 check (rhyme_f between 0 and 10),
  rhyme_n integer not null default 0 check (rhyme_n >= 0),
  rhyme_m smallint not null default 0 check (rhyme_m between 0 and 10),
  tone_v real not null default 0 check (tone_v between 0 and 10),
  tone_f real not null default 0 check (tone_f between 0 and 10),
  tone_n integer not null default 0 check (tone_n >= 0),
  tone_m smallint not null default 0 check (tone_m between 0 and 10),
  device text check (device in ('phone', 'desktop')),
  updated_at timestamptz not null default now(),
  primary key (user_id, decoding)
);

-- spell_daily: who played on which UTC day and how many words (written by spell_submit; read through admin_spell() by admins only)
create table if not exists public.spell_daily (
  day date not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  words integer not null default 0,
  primary key (day, user_id)
);
alter table public.spell_daily enable row level security;
revoke all on public.spell_daily from anon, authenticated;

alter table public.spell_scores enable row level security;
alter table public.spell_speed enable row level security;

-- reading only: nobody writes to the tables directly, whatever the default privileges of the project are
revoke all on public.spell_scores from anon, authenticated;
revoke all on public.spell_speed from anon, authenticated;
grant select on public.spell_scores to authenticated;
grant select on public.spell_speed to authenticated;

drop policy if exists "Spell score read own" on public.spell_scores;
create policy "Spell score read own" on public.spell_scores for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists "Spell speed read own" on public.spell_speed;
create policy "Spell speed read own" on public.spell_speed for select to authenticated
  using ((select auth.uid()) = user_id);

-- reads one kind of a speed object of the page: { v, f, n, m } with the limits of the table
create or replace function public.spell_kind(p_speed jsonb, p_kind text, out v real, out f real, out n integer, out m smallint)
language sql
immutable
set search_path = public
as $$
  select
    least(greatest(coalesce((p_speed -> p_kind ->> 'v')::real, 0), 0), 10),
    least(greatest(coalesce((p_speed -> p_kind ->> 'f')::real, 0), 0), 10),
    least(greatest(coalesce((p_speed -> p_kind ->> 'n')::integer, 0), 0), 1000000),
    least(greatest(coalesce((p_speed -> p_kind ->> 'm')::smallint, 0), 0), 10);
$$;

-- writes the speed of one decoding ({ onset: { v, f, n, m }, rhyme: ..., tone: ... }) for a user
create or replace function public.spell_write_speed(p_uid uuid, p_decoding text, p_speed jsonb, p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o record; r record; t record;
begin
  if p_decoding not in ('qatt', 'omniglot') or p_speed is null or jsonb_typeof(p_speed) <> 'object' then
    return;
  end if;
  select * into o from public.spell_kind(p_speed, 'onset');
  select * into r from public.spell_kind(p_speed, 'rhyme');
  select * into t from public.spell_kind(p_speed, 'tone');
  insert into public.spell_speed (user_id, decoding, onset_v, onset_f, onset_n, onset_m, rhyme_v, rhyme_f, rhyme_n, rhyme_m,
                                  tone_v, tone_f, tone_n, tone_m, device, updated_at)
  values (p_uid, p_decoding, o.v, o.f, o.n, o.m, r.v, r.f, r.n, r.m, t.v, t.f, t.n, t.m,
          case when p_device in ('phone', 'desktop') then p_device end, now())
  on conflict (user_id, decoding) do update set
    onset_v = excluded.onset_v, onset_f = excluded.onset_f, onset_n = excluded.onset_n, onset_m = excluded.onset_m,
    rhyme_v = excluded.rhyme_v, rhyme_f = excluded.rhyme_f, rhyme_n = excluded.rhyme_n, rhyme_m = excluded.rhyme_m,
    tone_v = excluded.tone_v, tone_f = excluded.tone_f, tone_n = excluded.tone_n, tone_m = excluded.tone_m,
    device = excluded.device, updated_at = now();
end;
$$;

-- a solved or left word of the signed-in user: the points of the word (p_delta, between -200 and 400: what a word can give at most) are added to the score
-- (it stays at 0 or more), the speed of the decoding in use is replaced by the one of the page; gives { score, words }.
-- At most one call a second (the page needs longer for a word; time of the clock, not of the transaction).
create or replace function public.spell_submit(p_delta integer, p_decoding text, p_speed jsonb, p_device text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  last_at timestamptz;
  row_score public.spell_scores;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if p_delta is null or p_delta not between -200 and 400 then
    raise exception 'invalid points';
  end if;

  insert into public.spell_scores (user_id, updated_at) values (uid, clock_timestamp() - interval '2 seconds') on conflict do nothing;
  select updated_at into last_at from public.spell_scores where user_id = uid for update;
  if last_at > clock_timestamp() - interval '1 second' and p_delta <> 0 then
    raise exception 'too fast' using errcode = '54000';
  end if;

  update public.spell_scores set score = greatest(0, score + p_delta), words = words + 1, updated_at = clock_timestamp()
    where user_id = uid returning * into row_score;
  perform public.spell_write_speed(uid, p_decoding, p_speed, p_device);
  insert into public.spell_daily as d (day, user_id, words) values ((now() at time zone 'utc')::date, uid, 1)
    on conflict (day, user_id) do update set words = d.words + 1;

  return jsonb_build_object('score', row_score.score, 'words', row_score.words);
end;
$$;

-- once per account: takes over what the browser has ({ score, speed: { qatt: { onset, rhyme, tone }, omniglot: ... } });
-- does nothing if the account has a score row already; the score is limited to 100000
create or replace function public.spell_import(p_score integer, p_speed jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  d text;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if exists (select 1 from public.spell_scores where user_id = uid) then
    return jsonb_build_object('imported', false);
  end if;
  insert into public.spell_scores (user_id, score, updated_at)
    values (uid, least(greatest(coalesce(p_score, 0), 0), 100000), clock_timestamp() - interval '2 seconds');   -- a first word may follow at once
  if p_speed is not null and jsonb_typeof(p_speed) = 'object' then
    foreach d in array array['qatt', 'omniglot'] loop
      perform public.spell_write_speed(uid, d, p_speed -> d, null);
    end loop;
  end if;
  return jsonb_build_object('imported', true);
end;
$$;

-- the leaderboard of the score: the best p_limit users that have a name (profiles.username), with their speed of a decoding (the slow values, ranked from
-- 5 times of a kind on; NULL before) and the rank of the user that asks
create or replace function public.spell_leaderboard(p_decoding text default 'qatt', p_limit integer default 20)
returns table (rank bigint, username text, score integer, onset_v real, rhyme_v real, tone_v real, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select dense_rank() over (order by s.score desc) as rank, p.username, s.score, s.user_id,
           case when v.onset_n >= 5 then v.onset_v end as onset_v,
           case when v.rhyme_n >= 5 then v.rhyme_v end as rhyme_v,
           case when v.tone_n >= 5 then v.tone_v end as tone_v
      from public.spell_scores s
      join public.profiles p on p.user_id = s.user_id and coalesce(p.username, '') <> ''
      left join public.spell_speed v on v.user_id = s.user_id and v.decoding = p_decoding
     where s.score > 0
  )
  select r.rank, r.username, r.score, r.onset_v, r.rhyme_v, r.tone_v, r.user_id = (select auth.uid()) as is_me
    from ranked r
   where r.rank <= least(greatest(p_limit, 1), 100) or r.user_id = (select auth.uid())
   order by r.rank, r.username;
$$;

revoke all on function public.spell_kind(jsonb, text) from public, anon, authenticated;
revoke all on function public.spell_write_speed(uuid, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.spell_submit(integer, text, jsonb, text) from public, anon;
revoke all on function public.spell_import(integer, jsonb) from public, anon;
revoke all on function public.spell_leaderboard(text, integer) from public;
grant execute on function public.spell_submit(integer, text, jsonb, text) to authenticated;
grant execute on function public.spell_import(integer, jsonb) to authenticated;
grant execute on function public.spell_leaderboard(text, integer) to anon, authenticated;

-- numbers of the game for the statistics page (admins only): the last p_days days (players and solved words per day), the totals
create or replace function public.admin_spell(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer := greatest(1, least(coalesce(p_days, 14), 400));
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', jsonb_build_object(
      'players', (select count(*) from public.spell_scores where words > 0),
      'words', (select coalesce(sum(words), 0) from public.spell_scores),
      'players_10_words', (select count(*) from public.spell_scores where words >= 10),
      'players_100_words', (select count(*) from public.spell_scores where words >= 100)),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.day,
        'players', (select count(*) from public.spell_daily where day = g.day),
        'words', (select coalesce(sum(words), 0) from public.spell_daily where day = g.day)
      ) order by g.day desc), '[]'::jsonb)
      from (select ((now() at time zone 'utc')::date - i) as day from generate_series(0, n - 1) i) g));
end;
$$;
revoke all on function public.admin_spell(integer) from public, anon;
grant execute on function public.admin_spell(integer) to authenticated;
