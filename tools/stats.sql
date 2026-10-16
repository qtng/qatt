-- Usage of the sites in the last N hours: sign-ups, translator, decks, practice.
-- Run it in the Supabase dashboard (project ChunomApp) -> SQL Editor; change the interval in the first line.
-- Counts people, not clicks. Anonymous accounts are created for every visitor that opens a page with a login, so "anonymous" is
-- the number of visitors and "with account" the number of people who signed in with Google or e-mail.
with p as (select interval '4 hours' as w)
select
  now()                                                                                                    as at,
  (select w from p)                                                                                        as time_window,
  -- sign-ups
  (select count(*) from auth.users, p where created_at > now() - w)                                        as new_accounts_total,
  (select count(*) from auth.users, p where created_at > now() - w and is_anonymous)                      as new_anonymous,
  (select count(*) from auth.users, p where created_at > now() - w and not is_anonymous)                  as new_with_account,
  (select count(*) from auth.users, p where last_sign_in_at > now() - w and not is_anonymous)             as signed_in_with_account,
  -- decks and practice
  (select count(distinct user_id) from public.decks, p where updated_at > now() - w)                      as users_who_changed_a_deck,
  (select count(distinct user_id) from public.deck_saves, p where created_at > now() - w)                 as users_who_took_over_a_public_deck,
  (select count(distinct user_id) from public.practice_progress, p where updated_at > now() - w)          as users_who_practised,
  -- translator: the counter has the day only (UTC), so this is "since 00:00 UTC today", not the window
  (select count(*) from public.translate_usage where day = current_date)                                   as translate_users_today_utc,
  (select coalesce(sum(n), 0) from public.translate_usage where day = current_date)                        as translate_calls_today_utc;

-- The translator in the window, by time (the function logs every finished translation; the log has no user):
--   Dashboard -> Logs -> Edge Functions -> translate, search for "result", or in the Logs Explorer:
--   select timestamp, event_message from function_logs where event_message like 'result%' order by timestamp desc
-- Page views of the deck lists are not counted anywhere; "used decks" here means created/changed, took over, or practised.
