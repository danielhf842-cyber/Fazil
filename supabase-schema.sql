-- ============================================================
--  FAZIL RECRUITMENT GROUP — Supabase schema
--  Paste this whole file into Supabase → SQL Editor → Run.
--  Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES  (one row per registered user)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  email       text,
  phone       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever someone registers
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is the current user an admin?  (security definer avoids RLS recursion)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ------------------------------------------------------------
-- 2. JOBS
-- ------------------------------------------------------------
create table if not exists public.jobs (
  id            text primary key,
  title         text not null,
  city          text not null,
  country       text not null default 'UK',
  salary        text not null,
  type          text not null default 'Permanent',
  sector        text not null,
  featured      boolean not null default false,
  published     boolean not null default true,
  posted        date not null default current_date,
  summary       text,
  about         text,
  requirements  text[] not null default '{}',
  created_at    timestamptz not null default now()
);
create index if not exists jobs_published_idx on public.jobs (published, posted desc);

-- ------------------------------------------------------------
-- 3. SETTINGS  (homepage numbers etc.)
-- ------------------------------------------------------------
create table if not exists public.settings (
  key   text primary key,
  value text not null
);
insert into public.settings (key, value) values
  ('candidates_placed', '500'),
  ('years_experience',  '3')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- 4. APPLICATIONS
-- ------------------------------------------------------------
create table if not exists public.applications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  job_id      text not null references public.jobs(id) on delete cascade,
  message     text,
  status      text not null default 'submitted',
  created_at  timestamptz not null default now(),
  unique (user_id, job_id)
);
create index if not exists applications_user_idx on public.applications (user_id, created_at desc);

-- ------------------------------------------------------------
-- 5. JOB ALERTS
-- ------------------------------------------------------------
create table if not exists public.job_alerts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  email       text not null,
  roles       text[] not null default '{}',
  cities      text[] not null default '{}',
  frequency   text not null default 'immediate',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists job_alerts_email_idx on public.job_alerts (email);

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.jobs         enable row level security;
alter table public.settings     enable row level security;
alter table public.applications enable row level security;
alter table public.job_alerts   enable row level security;

-- ---- profiles ----------------------------------------------
drop policy if exists "read own profile"    on public.profiles;
drop policy if exists "update own profile"  on public.profiles;
drop policy if exists "admins read all"     on public.profiles;
create policy "read own profile"   on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ---- jobs: anyone may read PUBLISHED jobs; only admins write
drop policy if exists "public read published jobs" on public.jobs;
drop policy if exists "admins manage jobs"         on public.jobs;
create policy "public read published jobs" on public.jobs for select using (published = true or public.is_admin());
create policy "admins manage jobs"         on public.jobs for all    using (public.is_admin()) with check (public.is_admin());

-- ---- settings: anyone may read; only admins write
drop policy if exists "public read settings"   on public.settings;
drop policy if exists "admins manage settings" on public.settings;
create policy "public read settings"   on public.settings for select using (true);
create policy "admins manage settings" on public.settings for all    using (public.is_admin()) with check (public.is_admin());

-- ---- applications: users see/create their own; admins see all
drop policy if exists "read own applications"    on public.applications;
drop policy if exists "create own applications"  on public.applications;
drop policy if exists "admins manage applications" on public.applications;
create policy "read own applications"     on public.applications for select using (auth.uid() = user_id or public.is_admin());
create policy "create own applications"   on public.applications for insert with check (auth.uid() = user_id);
create policy "delete own applications"   on public.applications for delete using (auth.uid() = user_id or public.is_admin());
create policy "admins update applications" on public.applications for update using (public.is_admin()) with check (public.is_admin());

-- ---- job alerts: anyone may sign up; only owner/admin may read
drop policy if exists "anyone can create an alert" on public.job_alerts;
drop policy if exists "read own alerts"            on public.job_alerts;
create policy "anyone can create an alert" on public.job_alerts for insert with check (true);
create policy "read own alerts"   on public.job_alerts for select using (public.is_admin() or (user_id is not null and auth.uid() = user_id));
create policy "admins manage alerts" on public.job_alerts for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================
--  GRANTS  ("Automatically expose new tables" is OFF, so do it here)
-- ============================================================
grant usage on schema public to anon, authenticated;
grant select                         on public.jobs        to anon, authenticated;
grant select                         on public.settings    to anon, authenticated;
grant insert                         on public.job_alerts  to anon, authenticated;
grant select, insert, update, delete on public.jobs        to authenticated;
grant select, insert, update, delete on public.settings    to authenticated;
grant select, insert, update, delete on public.applications to authenticated;
grant select, insert, update, delete on public.job_alerts  to authenticated;
grant select, update                 on public.profiles    to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- ============================================================
--  SEED: the 10 jobs currently hardcoded in jobs-data.js
-- ============================================================
insert into public.jobs (id,title,city,salary,type,sector,featured,posted,summary,about,requirements) values
('spm-london','Senior Project Manager','London','£75,000–£95,000','Permanent','Construction & Civils',true,'2026-09-01',
 'Lead large-scale civil engineering and construction projects across London and the South East.',
 'We are seeking an experienced Senior Project Manager to oversee large-scale civil engineering and construction projects across London and the South East. You will lead multidisciplinary teams, manage budgets exceeding £50m, and ensure delivery to programme, budget and quality.',
 ARRAY['10+ years'' experience on major civils or infrastructure projects','MRICS / MCIOB or equivalent','Working knowledge of NEC3/4 contracts','SMSTS, CSCS (black card)']),
('me-cm-manchester','M&E Contracts Manager','Manchester','£65,000–£80,000','Permanent','M&E & Building Services',true,'2026-09-02',
 'Run multiple M&E packages for a Tier 1 building-services contractor across the North West.',
 'Our client, a leading M&E contractor, needs a Contracts Manager to take commercial and delivery ownership of 3–4 concurrent projects in commercial, healthcare and education.',
 ARRAY['Electrical or mechanical bias with 8+ years'' experience','Strong commercial awareness (JCT/NEC)','Experience managing site teams of 20+']),
('fitout-pm-london','Interior Fit-Out Project Manager','London','£60,000–£75,000','Permanent','Interior Fit-Out',false,'2026-08-28',
 'Cat A and Cat B commercial fit-out projects in Central London, £2m–£15m.',
 'Join an award-winning fit-out specialist delivering workplace projects for blue-chip tenants. You''ll own programme, quality and client relationship from pre-con to handover.',
 ARRAY['5+ years'' fit-out PM experience','Occupied-building and out-of-hours working experience','Excellent client-facing skills']),
('site-eng-london','Site Engineer','London','£45,000–£55,000','Contract','Construction & Civils',false,'2026-09-03',
 'Setting-out and QA on a major rail infrastructure package. 12-month contract.',
 '12-month contract for a Site Engineer on a live rail infrastructure project. Setting out, QA records, ITPs and liaison with subcontractors.',
 ARRAY['Degree in Civil Engineering','Experience with Leica / Trimble equipment','PTS ticket desirable']),
('me-eng-london','M&E Project Engineer','London','£55,000–£65,000','Permanent','M&E & Building Services',false,'2026-08-30',
 'Coordinate M&E design and installation on a data-centre programme.',
 'Support the Project Manager across design coordination, procurement and site installation on a mission-critical data-centre project.',
 ARRAY['HNC/Degree in Building Services','Revit/BIM 360 familiarity','Data-centre or critical-environment experience']),
('refurb-sm-manchester','Refurbishment Site Manager','Manchester','£50,000–£60,000','Contract','Refurbishment',false,'2026-08-26',
 'Live-environment residential refurbishment, 9-month contract.',
 'Site Manager for an occupied residential refurbishment scheme (400 units). Resident liaison, H&S and programme are key.',
 ARRAY['SMSTS, First Aid, CSCS','Experience in occupied/live environments','Strong resident-liaison skills']),
('ssm-facade-birmingham','Senior Site Manager — Façade','Birmingham','£55,000–£70,000','Contract','Building Envelopes',false,'2026-08-25',
 'Unitised curtain-wall and cladding package on a 30-storey residential tower.',
 'Manage the façade package on a high-rise residential project in Birmingham city centre, including subcontractor coordination and quality sign-off.',
 ARRAY['Curtain wall / rainscreen experience','IPAF, SMSTS','Building Safety Act awareness']),
('qs-civils-bristol','Quantity Surveyor — Civils','Bristol','£45,000–£58,000','Permanent','Construction & Civils',false,'2026-08-22',
 'Highways and groundworks packages for a regional civils contractor.',
 'Project QS on a portfolio of highways and groundworks projects in the South West. CVRs, valuations, subcontract management.',
 ARRAY['3+ years'' QS experience in civils','NEC3/4 knowledge','Degree in Quantity Surveying']),
('planner-leeds','Planner / Scheduler','Leeds','£50,000–£62,000','Contract','Project Controls',false,'2026-08-20',
 'Primavera P6 planner for a £120m mixed-use scheme.',
 'Own the master programme, short-term look-aheads and progress reporting on a major mixed-use development.',
 ARRAY['Advanced Primavera P6','Experience on £50m+ projects','Earned-value reporting']),
('estimator-glasgow','Estimator','Glasgow','£48,000–£60,000','Permanent','Project Controls',false,'2026-08-18',
 'Pre-construction estimating for a Scottish main contractor.',
 'Prepare first-principles estimates and tender submissions across commercial and public-sector projects up to £40m.',
 ARRAY['Main-contractor estimating experience','Conquest / CostX','Good subcontractor network in Scotland'])
on conflict (id) do nothing;

-- ============================================================
--  LAST STEP — make yourself an admin
--  Register on the site first, then run this with your email:
--
--    update public.profiles set is_admin = true
--    where email = 'you@yourdomain.com';
-- ============================================================
