-- ============================================================
--  FAZIL — guest applications + CV storage
--  Paste into Supabase -> SQL Editor -> Run. Safe to re-run.
--  Run AFTER supabase-schema.sql and supabase-admin-v2.sql.
-- ============================================================

-- ------------------------------------------------------------
-- 1. APPLICATIONS: allow guests, attach a CV
-- ------------------------------------------------------------
alter table public.applications alter column user_id drop not null;
alter table public.applications
  add column if not exists guest_name  text,
  add column if not exists guest_email text,
  add column if not exists guest_phone text,
  add column if not exists cv_path     text,
  add column if not exists cv_name     text,
  add column if not exists message     text;

-- anyone may create an application: signed-in users as themselves,
-- guests with user_id = null and an email
drop policy if exists "create own applications" on public.applications;
create policy "create own applications" on public.applications for insert
  with check ((auth.uid() = user_id) or (user_id is null and guest_email is not null and cv_path is not null));
grant insert on public.applications to anon;

-- signed-in users may update their own application (used to swap the CV)
drop policy if exists "users update own application" on public.applications;
create policy "users update own application" on public.applications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ...but only admins may change status / notes / which job
create or replace function public.guard_application_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (
       new.status  is distinct from old.status  or
       new.notes   is distinct from old.notes   or
       new.job_id  is distinct from old.job_id  or
       new.user_id is distinct from old.user_id) then
    raise exception 'Only an admin can change that.';
  end if;
  return new;
end $$;
drop trigger if exists guard_application_update on public.applications;
create trigger guard_application_update before update on public.applications
  for each row execute function public.guard_application_update();

-- ------------------------------------------------------------
-- 2. CVS: one row per uploaded file; one is "current"
-- ------------------------------------------------------------
create table if not exists public.cvs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  path        text not null,
  filename    text not null,
  size_bytes  integer,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists cvs_user_idx on public.cvs (user_id, created_at desc);
alter table public.cvs enable row level security;

drop policy if exists "own cvs"        on public.cvs;
drop policy if exists "admins read cvs" on public.cvs;
create policy "own cvs"         on public.cvs for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "admins read cvs" on public.cvs for select using (public.is_admin());
grant select, insert, update, delete on public.cvs to authenticated;

-- ------------------------------------------------------------
-- 3. STORAGE: private bucket "cvs"
--    Signed-in users upload to  <their user id>/...
--    Guests upload to           guest/...
--    Only the owner and admins can read or delete.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cvs', 'cvs', false, 10485760,
        array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "cvs: upload own folder"   on storage.objects;
drop policy if exists "cvs: guest upload"        on storage.objects;
drop policy if exists "cvs: read own or admin"   on storage.objects;
drop policy if exists "cvs: delete own or admin" on storage.objects;
drop policy if exists "cvs: update own"          on storage.objects;

create policy "cvs: upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "cvs: guest upload" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'cvs' and (storage.foldername(name))[1] = 'guest');
create policy "cvs: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "cvs: delete own or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'cvs' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "cvs: update own" on storage.objects for update to authenticated
  using (bucket_id = 'cvs' and (storage.foldername(name))[1] = auth.uid()::text);
