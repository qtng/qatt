-- Counter of the page views (run once in the SQL Editor of Supabase, after visits.sql): one row per day, site, page, language, device and region,
-- only numbers (no cookie, no id, no address with parameters, no IP). js/navigation.js (on every page of both sites) calls count_view() when somebody
-- uses a page (first tap, key or wheel of that page), not for bots and not for admins.
--   page: the path without parameters and without #, e.g. '/chunom/shelf/25/' ('/index.html' and 'index.html' of a folder are written as the folder);
--   lang: the language of the page ('en', 'vi', else 'other'); device: 'phone' (under 768 px), 'tablet' (under 1200 px), 'desktop';
--   region: a rough one from the time zone of the browser: vietnam, asia, europe, americas, africa, oceania, other.
-- Anybody may call count_view(); it counts at most 400 per minute for the whole site, and at most 3000 different rows per day and site (more are
-- written as the page '/other'), so the table can not be filled by hand. Only admins read the numbers, through admin_views().

create table if not exists public.page_views_daily (
  day date not null,
  site text not null check (site in ('qatt.org', 'chunom.org')),
  page text not null,
  lang text not null check (lang in ('en', 'vi', 'other')),
  device text not null check (device in ('phone', 'tablet', 'desktop')),
  region text not null check (region in ('vietnam', 'asia', 'europe', 'americas', 'africa', 'oceania', 'other')),
  views integer not null default 0,
  primary key (day, site, page, lang, device, region)
);
alter table public.page_views_daily enable row level security;
revoke all on public.page_views_daily from anon, authenticated;

create table if not exists public.views_limit (
  minute timestamptz primary key,
  n integer not null default 0
);
alter table public.views_limit enable row level security;
revoke all on public.views_limit from anon, authenticated;

create or replace function public.count_view(p_site text, p_page text, p_lang text, p_device text, p_region text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  calls integer;
  today date := (now() at time zone 'utc')::date;
  v_page text := p_page;
begin
  if p_site not in ('qatt.org', 'chunom.org') or p_lang not in ('en', 'vi', 'other') or p_device not in ('phone', 'tablet', 'desktop')
     or p_region not in ('vietnam', 'asia', 'europe', 'americas', 'africa', 'oceania', 'other')
     or v_page is null or v_page !~ '^/[A-Za-z0-9_./-]{0,100}$' then return; end if;
  insert into public.views_limit as l (minute, n) values (date_trunc('minute', now()), 1)
  on conflict (minute) do update set n = l.n + 1
  returning l.n into calls;
  if calls = 1 then delete from public.views_limit where minute < now() - interval '1 hour'; end if;
  if calls > 400 then return; end if;
  -- an unknown page when the day has many rows already: counted as '/other'
  if not exists (select 1 from public.page_views_daily where day = today and site = p_site and page = p_page)
     and (select count(*) from public.page_views_daily where day = today and site = p_site) >= 3000 then
    v_page := '/other';
  end if;
  insert into public.page_views_daily as v (day, site, page, lang, device, region, views)
  values (today, p_site, v_page, p_lang, p_device, p_region, 1)
  on conflict (day, site, page, lang, device, region) do update set views = v.views + 1;
end;
$$;
revoke all on function public.count_view(text, text, text, text, text) from public;
grant execute on function public.count_view(text, text, text, text, text) to anon, authenticated;

-- the rows of the last p_days days for the statistics page (admins only)
create or replace function public.admin_views(p_days integer default 14)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(v) order by v.day desc, v.site, v.views desc), '[]'::jsonb)
          from public.page_views_daily v where v.day > (now() at time zone 'utc')::date - greatest(1, least(coalesce(p_days, 14), 90)));
end;
$$;
revoke all on function public.admin_views(integer) from public, anon;
grant execute on function public.admin_views(integer) to authenticated;
