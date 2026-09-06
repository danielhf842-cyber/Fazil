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

## Switch on accounts (Supabase)
1. Supabase → Project Settings → API → copy Project URL + anon key into config.js
2. Authentication → URL Configuration → Site URL = your domain; add /login.html and /account.html to Redirect URLs
3. Project Settings → Auth → SMTP → your custom-domain SMTP so emails send from your address
4. Push config.js

## Forms
contact.html and the job-alert form use Netlify Forms → Netlify → Forms → Notifications → add your email.

## Photos
Splash: replace the four jpgs (same names). Everything else is Unsplash with fallbacks — swap the <img src>.
