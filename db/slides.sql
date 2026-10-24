-- The table slides (admin/admin-slides.html, reader.html): who may do what.
-- Rows are read by everybody (the reader shows only is_public = true; the drafts are not secret).
-- The author of a row (user_id) may change and delete it.

create policy "Public read access" on public.slides for select to public using (true);
create policy "Auth insert access" on public.slides for insert to authenticated with check (auth.uid() = user_id);
create policy "Auth update access" on public.slides for update to authenticated using (auth.uid() = user_id);
create policy "Auth delete access" on public.slides for delete to authenticated using (auth.uid() = user_id);   -- was missing: without it a delete removes nothing and gives no error
