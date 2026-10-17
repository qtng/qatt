-- The list of accounts for the admin (admin/users.html). Only admins may call admin_users(); the check is made here, in the database
-- (app_metadata.is_admin of the token, see admin_stats.sql). Gives { total, rows: [...] }, newest first, at most p_limit rows (1 to 5000).
--
-- Per account: the e-mail, the name (profiles.username), how it signs in (provider), anonymous or not, created and last sign-in, and what it did:
-- Spell it! (score, words), decks (own, taken over), practice (words, answers), translator (calls). site says where the account is known from, as far
-- as the use shows: qatt.org (Spell it!), chunom.org (decks, practice, translator), both, or none (nothing used yet).

create or replace function public.admin_users(p_limit integer default 1000)
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

  select jsonb_build_object(
    'total', (select count(*) from auth.users),
    'rows', coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
  ) into result
  from (
    select u.id as user_id,
           u.email,
           p.username,
           coalesce(u.raw_app_meta_data ->> 'provider', 'anonymous') as provider,
           coalesce(u.is_anonymous, false) as is_anonymous,
           coalesce((u.raw_app_meta_data ->> 'is_admin')::boolean, false) as is_admin,
           u.created_at,
           u.last_sign_in_at,
           coalesce(s.score, 0) as spell_score,
           coalesce(s.words, 0) as spell_words,
           (select count(*) from public.decks d where d.user_id = u.id) as decks,
           (select count(*) from public.deck_saves k where k.user_id = u.id) as deck_saves,
           (select count(*) from public.practice_progress g where g.user_id = u.id) as practice_words,
           (select coalesce(sum(g.correct + g.wrong), 0) from public.practice_progress g where g.user_id = u.id) as practice_answers,
           (select coalesce(sum(t.n), 0) from public.translate_usage t where t.user_id = u.id) as translate_calls,
           case
             when s.user_id is not null
                  and (exists (select 1 from public.decks d where d.user_id = u.id)
                       or exists (select 1 from public.deck_saves k where k.user_id = u.id)
                       or exists (select 1 from public.practice_progress g where g.user_id = u.id)
                       or exists (select 1 from public.translate_usage t where t.user_id = u.id)) then 'both'
             when s.user_id is not null then 'qatt.org'
             when exists (select 1 from public.decks d where d.user_id = u.id)
                  or exists (select 1 from public.deck_saves k where k.user_id = u.id)
                  or exists (select 1 from public.practice_progress g where g.user_id = u.id)
                  or exists (select 1 from public.translate_usage t where t.user_id = u.id) then 'chunom.org'
             else 'none'
           end as site
      from auth.users u
      left join public.profiles p on p.user_id = u.id
      left join public.spell_scores s on s.user_id = u.id
     order by u.created_at desc
     limit least(greatest(coalesce(p_limit, 1000), 1), 5000)
  ) r;
  return result;
end;
$$;

revoke all on function public.admin_users(integer) from public, anon;
grant execute on function public.admin_users(integer) to authenticated;
