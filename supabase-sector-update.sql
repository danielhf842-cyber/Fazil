-- Rename the "Project Controls" sector to "Engineering & Design"
-- Paste into Supabase -> SQL Editor -> Run. Safe to re-run.
update public.jobs set sector = 'Engineering & Design' where sector = 'Project Controls';
update public.jobs set title = 'Structural Design Engineer' where id = 'planner-leeds';
update public.jobs set title = 'BIM Coordinator'            where id = 'estimator-glasgow';
update public.jobs set title = 'Civil Design Engineer'      where id = 'estimator-chicago';
update public.jobs set title = 'MEP Design Engineer'        where id = 'scheduler-houston';
