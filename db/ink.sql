-- Handwriting samples of QATT cells (handwriting-data.html), the data to measure and train the recognition of handwriting.html (run once in the SQL Editor of Supabase).
-- One row is one cell written by hand: `target` is the cell that was asked for (the code of js/qatt-ink.js, e.g. "t+nh5 3": onset t, rhyme nh with marking stroke 5, tone 3;
-- "kh2": the letter kh with marking stroke 2 alone), `strokes` the drawing: [[[x, y, t], ...], ...] in the coordinates of a cell (viewBox -12.5 -12.5 125 125 of js/qatt.js),
-- t in milliseconds since the first touch, one array per stroke in the order they were written.
-- Only admins write (for now) and only through ink_submit(); nobody reads the table directly, admin_ink() gives the numbers, the rows are read in the SQL Editor.

create table if not exists public.ink_samples (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  target text not null check (char_length(target) between 1 and 40),
  strokes jsonb not null check (jsonb_typeof(strokes) = 'array' and jsonb_array_length(strokes) between 1 and 16),
  device text check (device in ('phone', 'desktop')),
  created_at timestamptz not null default now()
);
create index if not exists ink_samples_target on public.ink_samples (target);

alter table public.ink_samples enable row level security;
revoke all on public.ink_samples from anon, authenticated;

create or replace function public.ink_submit(p_target text, p_strokes jsonb, p_device text default null)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id bigint;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  if p_target is null or p_strokes is null or length(p_strokes::text) > 60000 then
    raise exception 'invalid sample';
  end if;
  insert into public.ink_samples (user_id, target, strokes, device)
    values (auth.uid(), p_target, p_strokes, p_device)
    returning id into new_id;
  return new_id;
end;
$$;

-- takes back the last sample of the caller (a slip of the pen), at most 10 minutes old; gives its id, or null when there is none
create or replace function public.ink_undo()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  gone bigint;
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  delete from public.ink_samples
    where id = (select max(id) from public.ink_samples where user_id = auth.uid() and created_at > now() - interval '10 minutes')
    returning id into gone;
  return gone;
end;
$$;

-- { total, mine, targets: { "<target>": count } } for the admin page that collects the samples
create or replace function public.admin_ink()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false) is not true then
    raise exception 'not an admin' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.ink_samples),
    'mine', (select count(*) from public.ink_samples where user_id = auth.uid()),
    'targets', coalesce((select jsonb_object_agg(target, n) from (select target, count(*) as n from public.ink_samples group by target) t), '{}'::jsonb));
end;
$$;

revoke all on function public.ink_submit(text, jsonb, text) from public, anon;
revoke all on function public.ink_undo() from public, anon;
revoke all on function public.admin_ink() from public, anon;
grant execute on function public.ink_submit(text, jsonb, text) to authenticated;
grant execute on function public.ink_undo() to authenticated;
grant execute on function public.admin_ink() to authenticated;
