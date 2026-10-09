-- ============================================================
--  US example jobs — run once in Supabase → SQL Editor
--  (the jobs table already has a `country` column; UK rows default to 'UK')
-- ============================================================
update public.jobs set country = 'UK' where country is null;

insert into public.jobs (id,title,city,country,salary,type,sector,featured,posted,summary,about,requirements) values
('superintendent-nyc','Construction Superintendent','New York','US','$120,000–$145,000','Permanent','Construction & Civil',true,'2026-09-04',
 'Run day-to-day field operations on a 40-story residential tower in Manhattan.',
 'A top-ENR general contractor needs a Superintendent to own schedule, safety and subcontractor coordination on a high-rise residential project in Midtown.',
 ARRAY['10+ years'' field experience on high-rise or large commercial','OSHA 30, NYC SST card','Procore / Primavera P6']),
('mep-pm-dallas','MEP Project Manager','Dallas','US','$110,000–$130,000','Permanent','MEP & Building Services',true,'2026-09-03',
 'Lead MEP packages on a data center campus in the DFW metro.',
 'Mission-critical contractor seeking an MEP PM to manage design coordination, procurement and installation across multiple data halls.',
 ARRAY['7+ years'' MEP project management','Data center or critical-environment experience','Strong commercial awareness (AIA contracts)']),
('estimator-chicago','Senior Estimator','Chicago','US','$105,000–$125,000','Permanent','Project Controls',false,'2026-09-01',
 'Hard-bid and GMP estimating for a Midwest general contractor.',
 'Prepare conceptual through GMP estimates on commercial, healthcare and higher-education projects up to $150m.',
 ARRAY['GC estimating experience','On-Screen Takeoff / Bluebeam','Strong Midwest subcontractor network']),
('scheduler-houston','Project Scheduler','Houston','US','$95,000–$115,000','Contract','Project Controls',false,'2026-08-30',
 'P6 scheduler for a petrochemical expansion program. 12-month contract.',
 'Own the integrated master schedule, look-aheads and earned-value reporting on a major industrial program.',
 ARRAY['Advanced Primavera P6','Industrial / energy experience','Earned-value reporting']),
('ti-pm-austin','Tenant Improvement Project Manager','Austin','US','$95,000–$110,000','Permanent','Interior Fit-Out',false,'2026-08-28',
 'Office and lab TI projects, $2m–$20m, for a growing interiors contractor.',
 'Manage tenant-improvement builds from pre-construction to turnover for tech and life-science clients across Austin.',
 ARRAY['5+ years'' TI or interiors PM experience','Occupied-building work','Excellent client-facing skills']),
('facade-super-boston','Façade Superintendent','Boston','US','$115,000–$135,000','Contract','Building Envelopes',false,'2026-08-26',
 'Unitized curtain wall package on a 30-story mixed-use tower.',
 'Manage the envelope package on a downtown Boston tower, including subcontractor coordination and QA/QC sign-off.',
 ARRAY['Curtain wall / rainscreen experience','OSHA 30','Swing-stage and hoisting experience']),
('renovation-pm-nyc','Renovation Project Manager','New York','US','$100,000–$120,000','Permanent','Renovation',false,'2026-08-24',
 'Occupied-building renovations for institutional and healthcare clients.',
 'Project Manager for phased renovation work in live hospital and university environments across the five boroughs.',
 ARRAY['Occupied / live-environment experience','ICRA / infection-control awareness','NYC DOB filing experience']),
('civil-pe-dallas','Civil Project Engineer','Dallas','US','$80,000–$95,000','Permanent','Construction & Civil',false,'2026-08-22',
 'Highway and sitework packages for a Texas heavy-civil contractor.',
 'Support the PM across submittals, RFIs, quantities and subcontractor coordination on TxDOT and private sitework projects.',
 ARRAY['BS Civil Engineering','2+ years'' heavy-civil experience','EIT preferred'])
on conflict (id) do nothing;
