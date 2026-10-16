-- Statistics for the admin (run once in the SQL Editor of Supabase). Only the users in the table "admins" may call admin_stats().
-- The check is done here in the database, not in the page: whoever calls the function without being in the table gets an error.
--
-- Make a user an admin (their id is in Authentication -> Users):
--   insert into public.admins (user_id) values ('<user id>');

create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.admins enable row level security;
-- no policy and no privileges: the API can neither read nor change the table (only the functions below read it)
revoke all on public.admins from anon, authenticated;

-- the translator counter also knows the time of the last use (older rows have none)
alter table public.translate_usage add column if not exists updated_at timestamptz;

create or replace function public.translate_hit(p_user uuid)
returns integer
language sql
security definer
set search_path to ''
as $$
  insert into public.translate_usage (user_id, day, n, updated_at) values (p_user, current_date, 1, now())
  on conflict (user_id, day) do update set n = public.translate_usage.n + 1, updated_at = now()
  returning n;
$$;

-- numbers for the last p_hours hours (1 to 2160) and for the last 14 days; people, not clicks
create or replace function public.admin_stats(p_hours integer default 4)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hours integer := greatest(1, least(coalesce(p_hours, 4), 2160));
  w interval;
  result jsonb;
begin
  if uid is null or not exists (select 1 from public.admins where user_id = uid) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  w := make_interval(hours => hours);

  select jsonb_build_object(
    'at', now(),
    'hours', hours,
    'window', jsonb_build_object(
      'new_anonymous',          (select count(*) from auth.users where created_at > now() - w and coalesce(is_anonymous, false)),
      'new_with_account',       (select count(*) from auth.users where created_at > now() - w and not coalesce(is_anonymous, false)),
      'signed_in_with_account', (select count(*) from auth.users where last_sign_in_at > now() - w and not coalesce(is_anonymous, false)),
      'changed_a_deck',         (select count(distinct user_id) from public.decks where updated_at > now() - w),
      'took_over_a_deck',       (select count(distinct user_id) from public.deck_saves where created_at > now() - w),
      'practised',              (select count(distinct user_id) from public.practice_progress where updated_at > now() - w),
      'translated',             (select count(distinct user_id) from public.translate_usage where updated_at > now() - w)
    ),
    'total', jsonb_build_object(
      'with_account', (select count(*) from auth.users where not coalesce(is_anonymous, false)),
      'anonymous',    (select count(*) from auth.users where coalesce(is_anonymous, false)),
      'decks',        (select count(*) from public.decks),
      'public_decks', (select count(*) from public.decks where is_public),
      'practising',   (select count(distinct user_id) from public.practice_progress)
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'new_anonymous',    (select count(*) from auth.users where created_at::date = d.day and coalesce(is_anonymous, false)),
        'new_with_account', (select count(*) from auth.users where created_at::date = d.day and not coalesce(is_anonymous, false)),
        'translate_users',  (select count(*) from public.translate_usage where day = d.day),
        'translate_calls',  (select coalesce(sum(n), 0) from public.translate_usage where day = d.day)
      ) order by d.day desc), '[]'::jsonb)
      from (select (current_date - g)::date as day from generate_series(0, 13) g) d
    )
  ) into result;
  return result;
end;
$$;

revoke all on function public.admin_stats(integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;
