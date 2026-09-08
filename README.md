# Fazil Recruitment Group — website (flat layout)

Everything lives in ONE folder, no subfolders. Upload all files to the ROOT of the GitHub repo.
Netlify: Build command EMPTY, Publish directory EMPTY (root).

## Files
    index.html        Region splash (landing)       styles.css     All site styling — colours at top
    uk.html           UK home                        region.css     Splash styling
    us.html           US placeholder                 config.js      Supabase keys + numbers  ← EDIT
    candidates.html   For Candidates                 jobs-data.js   Live jobs                ← EDIT
    jobs.html         Live jobs (filters)            main.js        Site behaviour
    job.html          Job detail (?id=)              auth.js        Login / register (Supabase)
    career-change.html                               uk-finished.jpg / uk-construction.jpg
    employers.html                                   us-finished.jpg / us-construction.jpg
    about.html  contact.html  insights.html
    login.html  register.html  account.html

## Deploy
Push to GitHub → Netlify redeploys. Make sure NO old folders (fazil-site/, css/, js/) remain in the repo — delete them.

## Backend (Supabase) — one-time setup

Project: https://quiytibohpwfonyhgsev.supabase.co  (already filled into config.js)

1. **Run the SQL.** Supabase → SQL Editor → New query → paste all of `supabase-schema.sql` → Run.
   Creates: profiles, jobs, settings, applications, job_alerts + Row Level Security + your 10 jobs.
2. **Auth settings.** Authentication → URL Configuration →
   Site URL = your live URL. Redirect URLs: add `<your-url>/login.html` and `<your-url>/account.html`.
3. **Register on the live site** (register.html) with your own email and confirm it.
4. **Make yourself admin.** SQL Editor:
   `update public.profiles set is_admin = true where email = 'you@yourdomain.com';`
5. Go to `/admin.html` — add jobs, change the homepage numbers, see applications and alerts.

### Emails from your own domain
Project Settings → Auth → SMTP Settings → enter your domain's SMTP (or Resend/Postmark).
Until then Supabase sends confirmation emails from its own address and rate-limits them.

## How data flows
- `db.js` loads jobs + numbers from Supabase on every page.
- If Supabase is unreachable it silently falls back to `jobs-data.js`, so the site never breaks.
- Everything (job count, search reels, filters, job pages, featured cards) reads from that one list.

## What each file does
    config.js          Supabase URL + publishable key (safe to publish)
    db.js              Loads jobs/settings, exposes window.FAZIL_SB
    main.js            Site behaviour (search, filters, FAQ, job rendering)
    auth.js            Register / login / apply / job alerts / account page
    admin.js           Admin page
    jobs-data.js       Offline fallback job list only
    supabase-schema.sql  Run once in Supabase

## Forms
contact-candidates.html and contact-employers.html use Netlify Forms → Netlify → Forms → Notifications.
Job alerts go to Supabase, not Netlify.

## Photos
Splash: replace uk-finished.jpg / uk-construction.jpg / us-finished.jpg / us-construction.jpg (same names).
Everything else is Unsplash with fallbacks — swap the <img src>.
