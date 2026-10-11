-- Progress and score of the practice, kept on the server (run once in the SQL Editor of Supabase).
-- The practice writes only through the two functions below; a user can read only the own rows of the table.
-- Points: 1st correct answer of a word 10, 2nd 15, 3rd 25, 4th 200, after that 20; a wrong answer costs 1 (the score stays at 0 or more).

create table if not exists public.practice_progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 200),
  correct integer not null default 0 check (correct >= 0),
  wrong integer not null default 0 check (wrong >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.practice_progress enable row level security;

-- reading only: nobody writes to the table directly, whatever the default privileges of the project are
revoke all on public.practice_progress from anon, authenticated;
grant select on public.practice_progress to authenticated;

drop policy if exists "Progress read own" on public.practice_progress;
create policy "Progress read own" on public.practice_progress for select to authenticated
  using ((select auth.uid()) = user_id);

-- one answer of the signed-in user: counts it and changes the score; gives { correct, wrong, score }
create or replace function public.practice_answer(p_key text, p_correct boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prev integer;
  points integer;
  row_progress public.practice_progress;
  new_score integer;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if p_key is null or char_length(p_key) not between 1 and 200 then
    raise exception 'invalid key';
  end if;

  insert into public.practice_progress (user_id, key) values (uid, p_key) on conflict do nothing;
  select correct into prev from public.practice_progress where user_id = uid and key = p_key for update;

  if p_correct then
    points := case prev when 0 then 10 when 1 then 15 when 2 then 25 when 3 then 200 else 20 end;
    update public.practice_progress set correct = correct + 1, updated_at = now()
      where user_id = uid and key = p_key returning * into row_progress;
    update public.profiles set score = coalesce(score, 0) + points, updated_at = now()
      where user_id = uid returning score into new_score;
  else
    update public.practice_progress set wrong = wrong + 1, updated_at = now()
      where user_id = uid and key = p_key returning * into row_progress;
    update public.profiles set score = greatest(0, coalesce(score, 0) - 1), updated_at = now()
      where user_id = uid returning score into new_score;
  end if;

  return jsonb_build_object('correct', row_progress.correct, 'wrong', row_progress.wrong, 'score', new_score);
end;
$$;

-- once per account: takes over the progress that was kept in the browser ({ "_score": 120, "word": { "c": 2, "w": 1 }, ... });
-- does nothing if the account has progress already; the score becomes the higher one of the profile and the browser
create or replace function public.practice_import(p_stats jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  local_score integer;
begin
  if uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign in required' using errcode = '28000';
  end if;
  if p_stats is null or jsonb_typeof(p_stats) <> 'object' then
    return jsonb_build_object('imported', false);
  end if;
  if exists (select 1 from public.practice_progress where user_id = uid) then
    return jsonb_build_object('imported', false);
  end if;

  insert into public.practice_progress (user_id, key, correct, wrong)
    select uid, e.key,
           least(greatest(coalesce((e.value ->> 'c')::integer, 0), 0), 1000),
           least(greatest(coalesce((e.value ->> 'w')::integer, 0), 0), 1000)
      from jsonb_each(p_stats) as e
     where e.key <> '_score' and jsonb_typeof(e.value) = 'object' and char_length(e.key) between 1 and 200
     limit 3000
  on conflict do nothing;

  local_score := least(greatest(coalesce((p_stats ->> '_score')::integer, 0), 0), 1000000);
  update public.profiles set score = greatest(coalesce(score, 0), local_score), updated_at = now() where user_id = uid;

  return jsonb_build_object('imported', true);
end;
$$;

revoke all on function public.practice_answer(text, boolean) from public, anon;
revoke all on function public.practice_import(jsonb) from public, anon;
grant execute on function public.practice_answer(text, boolean) to authenticated;
grant execute on function public.practice_import(jsonb) to authenticated;
