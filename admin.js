/* ============================================================
   FAZIL — admin
   Everything goes through DB (bottom of file): a Supabase
   implementation for the live site, and an in-memory one when
   window.FAZIL_ADMIN_DEMO is set (used by admin-PREVIEW.html).
   Access is enforced by Row Level Security: only profiles.is_admin.
   ============================================================ */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var gate = $('[data-admin]'); if (!gate) return;

  var DEMO = !!window.FAZIL_ADMIN_DEMO;
  var sb = window.FAZIL_SB;
  if (!DEMO && !sb) { gate.innerHTML = '<div class="wrap" style="padding:80px 0"><div class="empty">Supabase isn\'t configured.</div></div>'; return; }

  var STATUSES = ['submitted', 'contacted', 'interviewing', 'offered', 'placed', 'rejected'];
  var SECTORS = { UK: ['Construction & Civils', 'M&E & Building Services', 'Building Envelopes', 'Interior Fit-Out', 'Refurbishment', 'Project Controls'],
                  US: ['Construction & Civil', 'MEP & Building Services', 'Building Envelopes', 'Interior Fit-Out', 'Renovation', 'Project Controls'] };
  var noteTimer;
  function msg(t, m, sticky) { var n = $('#admin-notice'); n.className = 'notice ' + t; n.textContent = m; clearTimeout(noteTimer); if (!sticky) noteTimer = setTimeout(function () { n.className = 'notice'; }, 4000); }
  function fmt(d) { return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
  function ago(d) { var n = Math.round((Date.now() - new Date(d)) / 864e5); return n <= 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; }
  function csv(rows, name) {
    if (!rows.length) return msg('err', 'Nothing to export.');
    var keys = Object.keys(rows[0]);
    var out = [keys.join(',')].concat(rows.map(function (r) { return keys.map(function (k) { var v = r[k] == null ? '' : String(Array.isArray(r[k]) ? r[k].join('; ') : r[k]); return '"' + v.replace(/"/g, '""') + '"'; }).join(','); })).join('\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv' })); a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  }

  /* ================= tabs ================= */
  $$('[data-tab-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-tab-btn]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      $$('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== b.getAttribute('data-tab-btn'); });
      history.replaceState(null, '', '#' + b.getAttribute('data-tab-btn'));
    });
  });
  var hashTab = $('[data-tab-btn="' + (location.hash || '').slice(1) + '"]'); if (hashTab) hashTab.click();

  /* ================= overview ================= */
  var jobsCache = [], appsCache = [], alertsCache = [], candsCache = [];
  function overview() {
    var week = Date.now() - 7 * 864e5;
    var live = jobsCache.filter(function (j) { return j.published; });
    $('[data-ov-uk]').textContent = live.filter(function (j) { return (j.country || 'UK') === 'UK'; }).length;
    $('[data-ov-us]').textContent = live.filter(function (j) { return j.country === 'US'; }).length;
    $('[data-ov-apps]').textContent = appsCache.filter(function (a) { return new Date(a.created_at) > week; }).length;
    $('[data-ov-open]').textContent = appsCache.filter(function (a) { return ['submitted', 'contacted', 'interviewing', 'offered'].indexOf(a.status) > -1; }).length;
    $('[data-ov-alerts]').textContent = alertsCache.filter(function (a) { return a.active !== false; }).length;
    $('[data-ov-cands]').textContent = candsCache.length;
  }

  /* ================= JOBS ================= */
  var editing = null;
  var jf = $('#job-form');
  function fld(n) { return jf.elements.namedItem(n); }
  function buildSectorOptions(country) {
    var cur = fld('sector').value;
    fld('sector').innerHTML = SECTORS[country].map(function (s) { return '<option' + (s === cur ? ' selected' : '') + '>' + esc(s) + '</option>'; }).join('');
  }
  fld('country').addEventListener('change', function () { buildSectorOptions(fld('country').value); });

  async function loadJobs() {
    var r = await DB.listJobs();
    if (r.error) return $('[data-jobs-table]').innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    jobsCache = r.data; renderJobs();
  }
  function appsForJob(id) { return appsCache.filter(function (a) { return a.job_id === id; }).length; }
  function renderJobs() {
    var q = ($('#jobs-q').value || '').toLowerCase(), region = $('#jobs-region').value, state = $('#jobs-state').value, sort = $('#jobs-sort').value;
    var list = jobsCache.filter(function (j) {
      if (region !== 'all' && (j.country || 'UK') !== region) return false;
      if (state === 'published' && !j.published) return false;
      if (state === 'hidden' && j.published) return false;
      if (state === 'featured' && !j.featured) return false;
      if (q && (j.title + ' ' + j.city + ' ' + j.sector + ' ' + j.id).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (sort === 'old') return a.posted > b.posted ? 1 : -1;
      if (sort === 'title') return a.title.localeCompare(b.title);
      if (sort === 'apps') return appsForJob(b.id) - appsForJob(a.id);
      return a.posted < b.posted ? 1 : -1;
    });
    $('[data-jobs-count]').textContent = jobsCache.length;
    $('[data-jobs-shown]').textContent = list.length + ' of ' + jobsCache.length;
    $('[data-jobs-table]').innerHTML = list.map(function (j) {
      var n = appsForJob(j.id), c = j.country || 'UK', page = (c === 'US' ? 'us-job.html' : 'job.html') + '?id=' + encodeURIComponent(j.id);
      return '<div class="admin-row job' + (j.published ? '' : ' is-hidden') + '">' +
        '<div class="main"><b>' + esc(j.title) + ' <span class="tag ' + (c === 'US' ? 'us' : 'uk') + '">' + c + '</span>' + (j.featured ? '<span class="tag blue">Featured</span>' : '') + (j.published ? '' : '<span class="tag grey">Hidden</span>') + '</b>' +
        '<span>' + esc(j.city) + ' · ' + esc(j.sector) + ' · ' + esc(j.type) + ' · ' + esc(j.salary) + '</span>' +
        '<span class="muted">Posted ' + fmt(j.posted) + ' (' + ago(j.posted) + ') · ' + n + ' application' + (n === 1 ? '' : 's') + ' · <a href="' + page + '" target="_blank">View on site ↗</a></span></div>' +
        '<div class="acts">' +
        '<button class="btn btn-outline" data-edit="' + esc(j.id) + '">Edit</button>' +
        '<button class="btn btn-ghost" data-dup="' + esc(j.id) + '" title="Make a copy">Duplicate</button>' +
        '<button class="btn btn-ghost" data-feat="' + esc(j.id) + '">' + (j.featured ? 'Unfeature' : 'Feature') + '</button>' +
        '<button class="btn btn-ghost" data-pub="' + esc(j.id) + '">' + (j.published ? 'Hide' : 'Publish') + '</button>' +
        '<button class="btn btn-danger" data-del="' + esc(j.id) + '">Delete</button></div></div>';
    }).join('') || '<div class="empty">No jobs match. <a href="#" data-clear-jobs style="color:var(--blue);font-weight:700">Clear filters</a></div>';
  }
  ['#jobs-q', '#jobs-region', '#jobs-state', '#jobs-sort'].forEach(function (s) { $(s).addEventListener('input', renderJobs); $(s).addEventListener('change', renderJobs); });

  function fillForm(j, asCopy) {
    editing = asCopy ? null : j.id;
    jf.reset();
    fld('country').value = j.country || 'UK'; buildSectorOptions(fld('country').value);
    ['id', 'title', 'city', 'salary', 'type', 'sector', 'posted', 'summary', 'about'].forEach(function (k) { if (fld(k)) fld(k).value = j[k] || ''; });
    fld('requirements').value = (j.requirements || []).join('\n');
    fld('featured').checked = !!j.featured; fld('published').checked = asCopy ? false : j.published !== false;
    if (asCopy) { fld('id').value = j.id + '-copy'; fld('title').value = j.title + ' (copy)'; fld('posted').value = new Date().toISOString().slice(0, 10); }
    fld('id').readOnly = !asCopy; fld('id').dataset.touched = '1';
    $('#job-form-title').textContent = asCopy ? 'Add a new job (copied)' : 'Edit job';
    $('#cancel-edit').hidden = false; $('#save-add').hidden = true;
    window.scrollTo({ top: jf.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
  }
  function resetForm() {
    editing = null; jf.reset(); fld('id').readOnly = false; delete fld('id').dataset.touched;
    fld('published').checked = true; fld('posted').value = new Date().toISOString().slice(0, 10); buildSectorOptions(fld('country').value);
    $('#job-form-title').textContent = 'Add a new job'; $('#cancel-edit').hidden = true; $('#save-add').hidden = false;
  }
  resetForm();
  $('#cancel-edit').addEventListener('click', function (e) { e.preventDefault(); resetForm(); });

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-edit],[data-dup],[data-feat],[data-pub],[data-del],[data-clear-jobs]'); if (!t) return;
    if (t.hasAttribute('data-clear-jobs')) { e.preventDefault(); $('#jobs-q').value = ''; $('#jobs-region').value = 'all'; $('#jobs-state').value = 'all'; return renderJobs(); }
    var id = t.getAttribute('data-edit') || t.getAttribute('data-dup') || t.getAttribute('data-feat') || t.getAttribute('data-pub') || t.getAttribute('data-del');
    var j = jobsCache.filter(function (x) { return x.id === id; })[0]; if (!j) return;
    if (t.hasAttribute('data-edit')) return fillForm(j, false);
    if (t.hasAttribute('data-dup')) return fillForm(j, true);
    if (t.hasAttribute('data-feat')) { var r1 = await DB.updateJob(id, { featured: !j.featured }); if (r1.error) return msg('err', r1.error.message); msg('ok', j.featured ? 'Removed from featured.' : 'Marked as featured.'); return loadJobs().then(overview); }
    if (t.hasAttribute('data-pub')) { var r2 = await DB.updateJob(id, { published: !j.published }); if (r2.error) return msg('err', r2.error.message); msg('ok', j.published ? 'Hidden from the site.' : 'Published — live on the site now.'); return loadJobs().then(overview); }
    if (t.hasAttribute('data-del')) {
      var n = appsForJob(id);
      if (!confirm('Delete "' + j.title + '" permanently?' + (n ? '\n\nThis job has ' + n + ' application' + (n === 1 ? '' : 's') + ' — they will be deleted too. Consider "Hide" instead.' : ''))) return;
      var r3 = await DB.deleteJob(id); if (r3.error) return msg('err', r3.error.message);
      msg('ok', 'Job deleted.'); if (editing === id) resetForm(); return Promise.all([loadJobs(), loadApps()]).then(overview);
    }
  });

  function readForm() {
    return {
      id: fld('id').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: fld('title').value.trim(), city: fld('city').value.trim(), country: fld('country').value, salary: fld('salary').value.trim(),
      type: fld('type').value, sector: fld('sector').value, posted: fld('posted').value || new Date().toISOString().slice(0, 10),
      summary: fld('summary').value.trim(), about: fld('about').value.trim(),
      requirements: fld('requirements').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      featured: fld('featured').checked, published: fld('published').checked
    };
  }
  async function saveJob(addAnother) {
    var row = readForm();
    if (!row.title) return msg('err', 'Title is required.');
    if (!row.id) return msg('err', 'URL id is required.');
    if (!row.city) return msg('err', 'City is required.');
    if (!row.salary) return msg('err', 'Salary is required.');
    if (!editing && jobsCache.some(function (x) { return x.id === row.id; })) return msg('err', 'A job with the id "' + row.id + '" already exists — change the URL id.');
    var r = editing ? await DB.updateJob(editing, row) : await DB.insertJob(row);
    if (r.error) return msg('err', r.error.message);
    msg('ok', editing ? 'Job updated.' : (row.published ? 'Job added — live on the site now.' : 'Job saved as hidden.'));
    var keepCountry = row.country;
    resetForm(); fld('country').value = keepCountry; buildSectorOptions(keepCountry);
    if (!addAnother) window.scrollTo({ top: $('[data-jobs-table]').getBoundingClientRect().top + window.scrollY - 140, behavior: 'smooth' });
    loadJobs().then(overview);
  }
  jf.addEventListener('submit', function (e) { e.preventDefault(); saveJob(false); });
  $('#save-add').addEventListener('click', function (e) { e.preventDefault(); saveJob(true); });
  fld('title').addEventListener('input', function () { if (!editing && !fld('id').dataset.touched) fld('id').value = fld('title').value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); });
  fld('id').addEventListener('input', function () { fld('id').dataset.touched = '1'; });

  /* ================= SETTINGS ================= */
  async function loadSettings() {
    var r = await DB.getSettings(); if (r.error) return;
    r.data.forEach(function (x) { if (x.key === 'candidates_placed') $('#set-placed').value = x.value; if (x.key === 'years_experience') $('#set-years').value = x.value; });
  }
  $('#settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await DB.saveSettings([{ key: 'candidates_placed', value: $('#set-placed').value }, { key: 'years_experience', value: $('#set-years').value }]);
    msg(r.error ? 'err' : 'ok', r.error ? r.error.message : 'Numbers updated — live on the site now.');
  });

  /* ================= APPLICATIONS ================= */
  async function loadApps() {
    var r = await DB.listApps();
    if (r.error) return $('[data-apps-table]').innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    appsCache = r.data; renderApps();
  }
  function renderApps() {
    var q = ($('#apps-q').value || '').toLowerCase(), st = $('#apps-status').value, region = $('#apps-region').value;
    var list = appsCache.filter(function (a) {
      var p = a.profiles || {}, j = a.jobs || {};
      if (st !== 'all' && a.status !== st) return false;
      if (region !== 'all' && (j.country || 'UK') !== region) return false;
      if (q && ((p.full_name || '') + ' ' + (p.email || '') + ' ' + (j.title || '') + ' ' + (j.city || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    $('[data-apps-count]').textContent = appsCache.length;
    $('[data-apps-shown]').textContent = list.length + ' of ' + appsCache.length;
    $('[data-apps-table]').innerHTML = list.map(function (a) {
      var p = a.profiles || {}, j = a.jobs || {};
      return '<div class="admin-row app status-' + esc(a.status) + '">' +
        '<div class="main"><b>' + esc(p.full_name || p.email || 'Candidate') + '</b><span>' + (p.email ? '<a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' : '') + (p.phone ? ' · <a href="tel:' + esc(p.phone) + '">' + esc(p.phone) + '</a>' : '') + '</span>' +
        '<span class="muted">Applied ' + fmt(a.created_at) + ' (' + ago(a.created_at) + ')</span></div>' +
        '<div class="main"><b>' + esc(j.title || a.job_id) + ' <span class="tag ' + ((j.country || 'UK') === 'US' ? 'us' : 'uk') + '">' + esc(j.country || 'UK') + '</span></b><span>' + esc(j.city || '') + '</span>' +
        '<textarea class="note" data-note="' + esc(a.id) + '" placeholder="Notes (e.g. called 10 Oct, interview Thursday)">' + esc(a.notes || '') + '</textarea></div>' +
        '<div class="acts col"><select class="status" data-status="' + esc(a.id) + '">' + STATUSES.map(function (s) { return '<option' + (s === a.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select>' +
        '<button class="btn btn-ghost" data-app-del="' + esc(a.id) + '">Remove</button></div></div>';
    }).join('') || '<div class="empty">No applications match.</div>';
  }
  ['#apps-q', '#apps-status', '#apps-region'].forEach(function (s) { $(s).addEventListener('input', renderApps); $(s).addEventListener('change', renderApps); });
  document.addEventListener('change', async function (e) {
    var s = e.target.closest('[data-status]'); if (!s) return;
    var r = await DB.updateApp(s.getAttribute('data-status'), { status: s.value });
    if (r.error) return msg('err', r.error.message);
    var a = appsCache.filter(function (x) { return x.id === s.getAttribute('data-status'); })[0]; if (a) a.status = s.value;
    s.closest('.admin-row').className = 'admin-row app status-' + s.value; msg('ok', 'Status updated.'); overview();
  });
  var noteTimers = {};
  document.addEventListener('input', function (e) {
    var n = e.target.closest('[data-note]'); if (!n) return;
    var id = n.getAttribute('data-note'); clearTimeout(noteTimers[id]);
    noteTimers[id] = setTimeout(async function () { var r = await DB.updateApp(id, { notes: n.value }); if (r.error) msg('err', r.error.message); else { n.classList.add('saved'); setTimeout(function () { n.classList.remove('saved'); }, 1200); } }, 700);
  });
  document.addEventListener('click', async function (e) {
    var d = e.target.closest('[data-app-del]'); if (!d) return;
    if (!confirm('Remove this application?')) return;
    var r = await DB.deleteApp(d.getAttribute('data-app-del')); if (r.error) return msg('err', r.error.message);
    msg('ok', 'Application removed.'); loadApps().then(function () { renderJobs(); overview(); });
  });
  $('#apps-export').addEventListener('click', function () {
    csv(appsCache.map(function (a) { var p = a.profiles || {}, j = a.jobs || {}; return { name: p.full_name, email: p.email, phone: p.phone, job: j.title, city: j.city, country: j.country || 'UK', status: a.status, notes: a.notes, applied: fmt(a.created_at) }; }), 'fazil-applications');
  });

  /* ================= JOB ALERTS ================= */
  async function loadAlerts() {
    var r = await DB.listAlerts();
    if (r.error) return $('[data-alerts-table]').innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    alertsCache = r.data; renderAlerts();
  }
  function renderAlerts() {
    var q = ($('#alerts-q').value || '').toLowerCase();
    var list = alertsCache.filter(function (x) { return !q || (x.email + ' ' + (x.roles || []).join(' ') + ' ' + (x.cities || []).join(' ')).toLowerCase().indexOf(q) > -1; });
    $('[data-alerts-count]').textContent = alertsCache.length;
    $('[data-alerts-table]').innerHTML = list.map(function (x) {
      return '<div class="admin-row' + (x.active === false ? ' is-hidden' : '') + '"><div class="main"><b><a href="mailto:' + esc(x.email) + '">' + esc(x.email) + '</a>' + (x.active === false ? '<span class="tag grey">Paused</span>' : '') + '</b><span>' + esc(x.frequency) + ' · created ' + fmt(x.created_at) + '</span></div>' +
        '<div class="main"><span><b style="display:inline">Roles:</b> ' + esc((x.roles || []).join(', ') || 'All roles') + '</span><span><b style="display:inline">Cities:</b> ' + esc((x.cities || []).join(', ') || 'All cities') + '</span></div>' +
        '<div class="acts"><button class="btn btn-ghost" data-alert-toggle="' + esc(x.id) + '">' + (x.active === false ? 'Resume' : 'Pause') + '</button><button class="btn btn-danger" data-alert-del="' + esc(x.id) + '">Delete</button></div></div>';
    }).join('') || '<div class="empty">No job alerts yet.</div>';
  }
  $('#alerts-q').addEventListener('input', renderAlerts);
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-alert-toggle],[data-alert-del]'); if (!t) return;
    var id = t.getAttribute('data-alert-toggle') || t.getAttribute('data-alert-del');
    var x = alertsCache.filter(function (a) { return a.id === id; })[0]; if (!x) return;
    if (t.hasAttribute('data-alert-toggle')) { var r = await DB.updateAlert(id, { active: x.active === false }); if (r.error) return msg('err', r.error.message); msg('ok', x.active === false ? 'Alert resumed.' : 'Alert paused.'); return loadAlerts().then(overview); }
    if (!confirm('Delete the alert for ' + x.email + '?')) return;
    var r2 = await DB.deleteAlert(id); if (r2.error) return msg('err', r2.error.message); msg('ok', 'Alert deleted.'); loadAlerts().then(overview);
  });
  $('#alerts-export').addEventListener('click', function () { csv(alertsCache.map(function (x) { return { email: x.email, roles: x.roles, cities: x.cities, frequency: x.frequency, active: x.active !== false, created: fmt(x.created_at) }; }), 'fazil-job-alerts'); });

  /* ================= CANDIDATES ================= */
  async function loadCandidates() {
    var r = await DB.listProfiles();
    if (r.error) return $('[data-cands-table]').innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    candsCache = r.data.filter(function (p) { return !p.is_admin; }); renderCands();
  }
  function renderCands() {
    var q = ($('#cands-q').value || '').toLowerCase();
    var list = candsCache.filter(function (p) { return !q || ((p.full_name || '') + ' ' + (p.email || '') + ' ' + (p.phone || '')).toLowerCase().indexOf(q) > -1; });
    $('[data-cands-count]').textContent = candsCache.length;
    $('[data-cands-table]').innerHTML = list.map(function (p) {
      var apps = appsCache.filter(function (a) { return a.user_id === p.id; });
      return '<div class="admin-row"><div class="main"><b>' + esc(p.full_name || '—') + '</b><span><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + '</a>' + (p.phone ? ' · ' + esc(p.phone) : '') + '</span><span class="muted">Registered ' + fmt(p.created_at) + '</span></div>' +
        '<div class="main"><span>' + apps.length + ' application' + (apps.length === 1 ? '' : 's') + (apps.length ? ': ' + apps.map(function (a) { return esc((a.jobs || {}).title || a.job_id) + ' (' + a.status + ')'; }).join(', ') : '') + '</span></div><div></div></div>';
    }).join('') || '<div class="empty">No registered candidates yet.</div>';
  }
  $('#cands-q').addEventListener('input', renderCands);
  $('#cands-export').addEventListener('click', function () { csv(candsCache.map(function (p) { return { name: p.full_name, email: p.email, phone: p.phone, registered: fmt(p.created_at), applications: appsCache.filter(function (a) { return a.user_id === p.id; }).length }; }), 'fazil-candidates'); });

  /* ================= DATA LAYER ================= */
  var DB = DEMO ? demoDB() : {
    listJobs: function () { return sb.from('jobs').select('*').order('posted', { ascending: false }); },
    insertJob: function (row) { return sb.from('jobs').insert(row); },
    updateJob: function (id, patch) { return sb.from('jobs').update(patch).eq('id', id); },
    deleteJob: function (id) { return sb.from('jobs').delete().eq('id', id); },
    getSettings: function () { return sb.from('settings').select('*'); },
    saveSettings: function (rows) { return sb.from('settings').upsert(rows); },
    listApps: function () { return sb.from('applications').select('*, jobs(title, city, country), profiles(full_name, email, phone)').order('created_at', { ascending: false }); },
    updateApp: function (id, patch) { return sb.from('applications').update(patch).eq('id', id); },
    deleteApp: function (id) { return sb.from('applications').delete().eq('id', id); },
    listAlerts: function () { return sb.from('job_alerts').select('*').order('created_at', { ascending: false }); },
    updateAlert: function (id, patch) { return sb.from('job_alerts').update(patch).eq('id', id); },
    deleteAlert: function (id) { return sb.from('job_alerts').delete().eq('id', id); },
    listProfiles: function () { return sb.from('profiles').select('*').order('created_at', { ascending: false }); }
  };

  function demoDB() {
    var jobs = (window.FAZIL_JOBS_FALLBACK || []).map(function (j) { return Object.assign({ published: true }, j); });
    var settings = [{ key: 'candidates_placed', value: '500' }, { key: 'years_experience', value: '3' }];
    var profiles = [
      { id: 'u1', full_name: 'Tom Whitfield', email: 'tom.w@example.com', phone: '+44 7700 900123', created_at: '2026-10-01' },
      { id: 'u2', full_name: 'Priya Sharma', email: 'priya@example.com', phone: '', created_at: '2026-10-03' },
      { id: 'u3', full_name: 'Marcus Lee', email: 'marcus.lee@example.com', phone: '+1 917 555 0100', created_at: '2026-09-28' },
      { id: 'u4', full_name: 'Amara Osei', email: 'amara@example.com', phone: '+44 7700 900456', created_at: '2026-10-08' }
    ];
    var apps = [
      { id: 'a1', user_id: 'u1', job_id: 'spm-london', status: 'submitted', notes: '', created_at: '2026-10-08' },
      { id: 'a2', user_id: 'u2', job_id: 'me-cm-manchester', status: 'contacted', notes: 'Called 9 Oct — available from November.', created_at: '2026-10-07' },
      { id: 'a3', user_id: 'u3', job_id: 'mep-pm-dallas', status: 'interviewing', notes: 'Client interview Thu 16 Oct, 2pm CT.', created_at: '2026-10-05' },
      { id: 'a4', user_id: 'u1', job_id: 'site-eng-london', status: 'rejected', notes: 'Too junior for this one.', created_at: '2026-09-30' },
      { id: 'a5', user_id: 'u4', job_id: 'fitout-pm-london', status: 'placed', notes: 'Started 6 Oct.', created_at: '2026-09-15' }
    ];
    var alerts = [
      { id: 'l1', email: 'jane@example.com', roles: ['Site Engineer', 'Planner / Scheduler'], cities: ['London', 'Leeds'], frequency: 'immediate', active: true, created_at: '2026-10-09' },
      { id: 'l2', email: 'omar@example.com', roles: [], cities: ['Dallas'], frequency: 'weekly', active: true, created_at: '2026-10-06' },
      { id: 'l3', email: 'old@example.com', roles: ['Estimator'], cities: [], frequency: 'daily', active: false, created_at: '2026-09-02' }
    ];
    var ok = function (data) { return Promise.resolve({ data: data, error: null }); };
    var join = function () { return apps.map(function (a) { var j = jobs.filter(function (x) { return x.id === a.job_id; })[0] || {}; return Object.assign({}, a, { jobs: { title: j.title, city: j.city, country: j.country }, profiles: profiles.filter(function (p) { return p.id === a.user_id; })[0] }); }); };
    return {
      listJobs: function () { return ok(jobs.slice().sort(function (a, b) { return a.posted < b.posted ? 1 : -1; })); },
      insertJob: function (row) { jobs.unshift(row); return ok(null); },
      updateJob: function (id, patch) { var j = jobs.filter(function (x) { return x.id === id; })[0]; if (j) Object.assign(j, patch); return ok(null); },
      deleteJob: function (id) { jobs = jobs.filter(function (x) { return x.id !== id; }); apps = apps.filter(function (a) { return a.job_id !== id; }); return ok(null); },
      getSettings: function () { return ok(settings); },
      saveSettings: function (rows) { settings = rows; return ok(null); },
      listApps: function () { return ok(join()); },
      updateApp: function (id, patch) { var a = apps.filter(function (x) { return x.id === id; })[0]; if (a) Object.assign(a, patch); return ok(null); },
      deleteApp: function (id) { apps = apps.filter(function (x) { return x.id !== id; }); return ok(null); },
      listAlerts: function () { return ok(alerts.slice()); },
      updateAlert: function (id, patch) { var a = alerts.filter(function (x) { return x.id === id; })[0]; if (a) Object.assign(a, patch); return ok(null); },
      deleteAlert: function (id) { alerts = alerts.filter(function (x) { return x.id !== id; }); return ok(null); },
      listProfiles: function () { return ok(profiles.slice()); }
    };
  }

  /* ================= boot ================= */
  (async function () {
    if (DEMO) { $('[data-admin-name]').textContent = 'Daniel (preview)'; gate.classList.add('ready'); msg('info', 'PREVIEW — nothing you do here is saved. The live admin reads and writes Supabase.', true); }
    else {
      var s = await sb.auth.getSession();
      if (!s.data.session) { location.href = 'login.html?next=admin.html'; return; }
      var p = await sb.from('profiles').select('is_admin, full_name').eq('id', s.data.session.user.id).maybeSingle();
      if (!p.data || !p.data.is_admin) {
        gate.innerHTML = '<div class="wrap" style="padding:100px 0"><div class="empty"><b>Admins only.</b><br><br>This account doesn\'t have admin access. Run this in Supabase → SQL Editor:<br><br><code style="font-size:12px">update public.profiles set is_admin = true where email = \'' + esc(s.data.session.user.email) + '\';</code><br><br><a href="uk.html" style="color:var(--blue);font-weight:700">Back to the site</a></div></div>';
        return;
      }
      $('[data-admin-name]').textContent = p.data.full_name || s.data.session.user.email;
      gate.classList.add('ready');
    }
    $('#logout').addEventListener('click', async function (e) { e.preventDefault(); if (!DEMO) await sb.auth.signOut(); location.href = 'uk.html'; });
    buildSectorOptions('UK');
    await Promise.all([loadJobs(), loadSettings(), loadApps(), loadAlerts(), loadCandidates()]);
    overview();
  })();

})();
