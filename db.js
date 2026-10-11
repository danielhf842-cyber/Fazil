/* ============================================================
   FAZIL — data layer
   Loads jobs + settings from Supabase, falls back to jobs-data.js
   Exposes: window.FAZIL_SB   (supabase client or null)
            window.FAZIL_READY (promise, resolves when data is loaded)
   ============================================================ */
(function () {
  var CFG = window.FAZIL_CONFIG || {};
  var ok = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  window.FAZIL_SB = ok ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;

  function fallback() {
    window.FAZIL_JOBS = window.FAZIL_JOBS_FALLBACK || [];
    return Promise.resolve();
  }

  window.FAZIL_READY = (function () {
    if (!ok) return fallback();
    var sb = window.FAZIL_SB;
    return Promise.all([
      sb.from('jobs').select('*').eq('published', true).order('featured', { ascending: false }).order('posted', { ascending: false }),
      sb.from('settings').select('*')
    ]).then(function (res) {
      var jobs = res[0], set = res[1];
      if (jobs.error || !jobs.data || !jobs.data.length) return fallback();
      window.FAZIL_JOBS = jobs.data.map(function (j) {
        return {
          id: j.id, title: j.title, city: j.city, country: j.country || 'UK', salary: j.salary, type: j.type,
          sector: j.sector, featured: !!j.featured, posted: j.posted,
          summary: j.summary || '', about: j.about || '',
          requirements: j.requirements || []
        };
      });
      if (set.data) set.data.forEach(function (r) {
        if (r.key === 'years_experience') CFG.yearsExperience = r.value;
      });
    }).catch(fallback);
  })();
})();
