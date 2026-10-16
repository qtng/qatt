-- Counter of the visits (run once in the SQL Editor of Supabase): one row per day, site and kind, only numbers (no cookie, no id, no address).
-- js/navigation.js (on every page of both sites) calls count_visit() when somebody uses the page (scrolls, taps, types), not for bots.
--   visitors = browsers that came on that day (once per browser and day), visits = a new visit of a browser (more than 30 minutes since the last).
--   kind: 'account' = signed in with Google or e-mail, 'anonymous' = everybody else (also the first visit without a session).
-- Anybody may call count_visit(); it counts at most 200 per minute for the whole site, so the numbers can not be inflated by hand by more than that.
-- Only admins read the numbers, through admin_visits(). Admins are not counted (the script does not send them).

create table if not exists public.visits_daily (
  day date not null,
  site text not null check (site in ('qatt.org', 'chunom.org')),
  kind text not null check (kind in ('account', 'anonymous')),
  visitors integer not null default 0,
  visits integer not null default 0,
  primary key (day, site, kind)
);
alter table public.visits_daily enable row level security;
revoke all on public.visits_daily from anon, authenticated;

-- counts of the last minutes, for the limit of count_visit()
create table if not exists public.visits_limit (
  minute timestamptz primary key,
  n integer not null default 0
);
alter table public.visits_limit enable row level security;
revoke all on public.visits_limit from anon, authenticated;

create or replace function public.count_visit(p_site text, p_kind text, p_new_visitor boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  calls integer;
begin
  if p_site not in ('qatt.org', 'chunom.org') or p_kind not in ('account', 'anonymous') then return; end if;
  -- at most 200 counts per minute for the whole site: the function is public, so a script can not inflate the numbers by more than that
  insert into public.visits_limit as l (minute, n) values (date_trunc('minute', now()), 1)
  on conflict (minute) do update set n = l.n + 1
  returning l.n into calls;
  if calls = 1 then delete from public.visits_limit where minute < now() - interval '1 hour'; end if;
  if calls > 200 then return; end if;
  insert into public.visits_daily as v (day, site, kind, visitors, visits)
  values ((now() at time zone 'utc')::date, p_site, p_kind, case when p_new_visitor then 1 else 0 end, 1)
  on conflict (day, site, kind) do update
    set visitors = v.visitors + case when p_new_visitor then 1 else 0 end, visits = v.visits + 1;
end;
$$;
revoke all on function public.count_visit(text, text, boolean) from public;
grant execute on function public.count_visit(text, text, boolean) to anon, authenticated;

-- the rows of the last p_days days for the statistics page (admins only)
create or replace function public.admin_visits(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(v) order by v.day desc, v.site, v.kind), '[]'::jsonb)
          from public.visits_daily v where v.day > (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 14), 400)));
end;
$$;
revoke all on function public.admin_visits(integer) from public, anon;
grant execute on function public.admin_visits(integer) to authenticated;
