/* ============================================================
   FAZIL — admin (jobs, settings, applications, alerts)
   Access is enforced by RLS: only profiles.is_admin = true can write.
   ============================================================ */
(function () {
  var sb = window.FAZIL_SB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var gate = $('[data-admin]');
  if (!gate) return;
  if (!sb) { gate.innerHTML = '<div class="wrap" style="padding:80px 0"><div class="empty">Supabase isn\'t configured.</div></div>'; return; }

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); };
  var msg = function (t, m) { var n = $('#admin-notice'); if (n) { n.className = 'notice ' + t; n.textContent = m; setTimeout(function () { n.className = 'notice'; }, 4000); } };

  (async function () {
    var s = await sb.auth.getSession();
    if (!s.data.session) { location.href = 'login.html?next=admin.html'; return; }
    var p = await sb.from('profiles').select('is_admin, full_name').eq('id', s.data.session.user.id).maybeSingle();
    if (!p.data || !p.data.is_admin) {
      gate.innerHTML = '<div class="wrap" style="padding:100px 0"><div class="empty"><b>Admins only.</b><br><br>This account doesn\'t have admin access. Run this in Supabase → SQL Editor:<br><br><code style="font-size:12px">update public.profiles set is_admin = true where email = \'' + esc(s.data.session.user.email) + '\';</code><br><br><a href="uk.html" style="color:var(--blue);font-weight:700">Back to the site</a></div></div>';
      return;
    }
    $('[data-admin-name]').textContent = p.data.full_name || s.data.session.user.email;
    gate.classList.add('ready');
    $('#logout').addEventListener('click', async function (e) { e.preventDefault(); await sb.auth.signOut(); location.href = 'uk.html'; });
    loadJobs(); loadSettings(); loadApps(); loadAlerts();
  })();

  /* ---------- tabs ---------- */
  $$('[data-tab-btn]').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('[data-tab-btn]').forEach(function (x) { x.classList.toggle('sel', x === b); });
      $$('[data-pane]').forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== b.getAttribute('data-tab-btn'); });
    });
  });

  /* ---------- JOBS ---------- */
  var editing = null;
  async function loadJobs() {
    var r = await sb.from('jobs').select('*').order('posted', { ascending: false });
    var box = $('[data-jobs-table]');
    if (r.error) return box.innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    $('[data-jobs-count]').textContent = r.data.length;
    box.innerHTML = r.data.map(function (j) {
      return '<div class="admin-row"><div><b>' + esc(j.title) + '</b><span>' + esc(j.city) + ' · ' + esc(j.sector) + ' · ' + esc(j.salary) + '</span></div>' +
        '<div class="pillset">' + (j.featured ? '<span class="tag blue">Featured</span>' : '') + (j.published ? '' : '<span class="tag">Hidden</span>') + '</div>' +
        '<div class="acts"><button class="btn btn-outline" data-edit="' + esc(j.id) + '">Edit</button><button class="btn btn-danger" data-del="' + esc(j.id) + '">Delete</button></div></div>';
    }).join('') || '<div class="empty">No jobs yet. Add your first one above.</div>';
  }

  document.addEventListener('click', async function (e) {
    var ed = e.target.closest('[data-edit]'), dl = e.target.closest('[data-del]');
    if (ed) {
      var r = await sb.from('jobs').select('*').eq('id', ed.getAttribute('data-edit')).single();
      if (r.data) {
        editing = r.data.id;
        var f = $('#job-form');
        ['id', 'title', 'city', 'salary', 'type', 'sector', 'posted', 'summary', 'about'].forEach(function (k) { if (f[k]) f[k].value = r.data[k] || ''; });
        f.requirements.value = (r.data.requirements || []).join('\n');
        f.featured.checked = !!r.data.featured; f.published.checked = !!r.data.published;
        f.id.readOnly = true;
        $('#job-form-title').textContent = 'Edit job';
        $('#cancel-edit').hidden = false;
        window.scrollTo({ top: f.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
      }
    }
    if (dl) {
      if (!confirm('Delete this job permanently?')) return;
      var d = await sb.from('jobs').delete().eq('id', dl.getAttribute('data-del'));
      msg(d.error ? 'err' : 'ok', d.error ? d.error.message : 'Job deleted.');
      loadJobs();
    }
  });

  $('#cancel-edit').addEventListener('click', function (e) { e.preventDefault(); resetForm(); });
  function resetForm() {
    editing = null; $('#job-form').reset(); $('#job-form').id.readOnly = false;
    $('#job-form').published.checked = true;
    $('#job-form-title').textContent = 'Add a new job'; $('#cancel-edit').hidden = true;
  }

  $('#job-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var f = e.target;
    var row = {
      id: f.id.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      title: f.title.value.trim(), city: f.city.value.trim(), salary: f.salary.value.trim(),
      type: f.type.value, sector: f.sector.value, posted: f.posted.value || new Date().toISOString().slice(0, 10),
      summary: f.summary.value.trim(), about: f.about.value.trim(),
      requirements: f.requirements.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean),
      featured: f.featured.checked, published: f.published.checked
    };
    if (!row.id || !row.title) return msg('err', 'ID and title are required.');
    var r = editing ? await sb.from('jobs').update(row).eq('id', editing) : await sb.from('jobs').insert(row);
    if (r.error) return msg('err', r.error.message);
    msg('ok', editing ? 'Job updated.' : 'Job added.');
    resetForm(); loadJobs();
  });

  // auto-slug from title
  $('#job-form').title.addEventListener('input', function () {
    var f = $('#job-form');
    if (!editing && !f.id.dataset.touched) f.id.value = f.title.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  });
  $('#job-form').id.addEventListener('input', function () { this.dataset.touched = '1'; });

  /* ---------- SETTINGS ---------- */
  async function loadSettings() {
    var r = await sb.from('settings').select('*');
    if (r.data) r.data.forEach(function (x) {
      if (x.key === 'candidates_placed') $('#set-placed').value = x.value;
      if (x.key === 'years_experience') $('#set-years').value = x.value;
    });
  }
  $('#settings-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await sb.from('settings').upsert([
      { key: 'candidates_placed', value: $('#set-placed').value },
      { key: 'years_experience', value: $('#set-years').value }
    ]);
    msg(r.error ? 'err' : 'ok', r.error ? r.error.message : 'Numbers updated — live on the site now.');
  });

  /* ---------- APPLICATIONS ---------- */
  async function loadApps() {
    var r = await sb.from('applications').select('*, jobs(title, city), profiles(full_name, email, phone)').order('created_at', { ascending: false });
    var box = $('[data-apps-table]');
    if (r.error) return box.innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    $('[data-apps-count]').textContent = r.data.length;
    box.innerHTML = r.data.map(function (a) {
      var p = a.profiles || {}, j = a.jobs || {};
      return '<div class="admin-row"><div><b>' + esc(p.full_name || p.email || 'Candidate') + '</b><span>' + esc(p.email || '') + (p.phone ? ' · ' + esc(p.phone) : '') + '</span></div>' +
        '<div><b>' + esc(j.title || a.job_id) + '</b><span>' + esc(j.city || '') + '</span></div>' +
        '<div class="acts"><span class="tag">' + esc(a.status) + '</span><span class="tag">' + new Date(a.created_at).toLocaleDateString() + '</span></div></div>';
    }).join('') || '<div class="empty">No applications yet.</div>';
  }

  /* ---------- ALERTS ---------- */
  async function loadAlerts() {
    var r = await sb.from('job_alerts').select('*').order('created_at', { ascending: false });
    var box = $('[data-alerts-table]');
    if (r.error) return box.innerHTML = '<div class="empty">' + esc(r.error.message) + '</div>';
    $('[data-alerts-count]').textContent = r.data.length;
    box.innerHTML = r.data.map(function (x) {
      return '<div class="admin-row"><div><b>' + esc(x.email) + '</b><span>' + esc(x.frequency) + ' · ' + new Date(x.created_at).toLocaleDateString() + '</span></div>' +
        '<div><span>' + esc((x.roles || []).join(', ') || 'All roles') + '</span><span>' + esc((x.cities || []).join(', ') || 'All cities') + '</span></div><div></div></div>';
    }).join('') || '<div class="empty">No job alerts yet.</div>';
  }
})();
