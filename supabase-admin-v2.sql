-- ============================================================
--  Admin v2 — run once in Supabase → SQL Editor
--  Adds notes on applications and lets admins see all profiles.
-- ============================================================
alter table public.applications add column if not exists notes text;
alter table public.applications add column if not exists updated_at timestamptz not null default now();

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications for each row execute function public.touch_updated_at();

-- status values the admin uses
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in ('submitted','contacted','interviewing','offered','placed','rejected'));

-- admins can read every profile (candidates tab)
drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
grant select, update, delete on public.profiles to authenticated;
