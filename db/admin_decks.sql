-- The published decks for the admin (admin/decks.html), and making a deck an official one ("chunom.org", the badge in the catalog of the decks).
-- Only admins may call these functions: the check is made here, in the database (app_metadata.is_admin of the token, see admin_stats.sql).
--
-- admin_decks()                          every published deck: title, words, owner (profiles.username), how often it was taken over, published, official
-- admin_set_official(p_deck, p_official)  sets or removes the mark "official" of a published deck
--
-- The trigger decks_protect_official took the mark away from every request of a user (auth.role() authenticated / anon), so also from this function, whose
-- statement runs with the role of its owner but with the claims of the user. It now looks at the role that runs the statement (current_user): a user's own
-- request is still reset, a security definer function (this one) and the service role are not.

create or replace function public.decks_protect_official()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.is_official := false; else new.is_official := old.is_official; end if;
  end if;
  if not new.is_public then
    new.published_at := null;
  elsif tg_op = 'INSERT' or not old.is_public then
    new.published_at := now();
  else
    new.published_at := old.published_at;
  end if;
  return new;
end $$;

create or replace function public.admin_decks()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.published_at desc nulls last), '[]'::jsonb) into result
  from (
    select d.id,
           d.title,
           d.count as words,
           d.user_id,
           p.username,
           (select count(*) from public.deck_saves k where k.deck_id = d.id) as taken_over,
           d.is_official,
           d.published_at,
           d.updated_at
      from public.decks d
      left join public.profiles p on p.user_id = d.user_id
     where d.is_public
  ) r;
  return result;
end $$;

create or replace function public.admin_set_official(p_deck uuid, p_official boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.decks set is_official = coalesce(p_official, false) where id = p_deck and is_public;
  if not found then
    raise exception 'no published deck with this id' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.admin_decks() from public, anon;
revoke all on function public.admin_set_official(uuid, boolean) from public, anon;
grant execute on function public.admin_decks() to authenticated;
grant execute on function public.admin_set_official(uuid, boolean) to authenticated;
