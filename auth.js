/* ============================================================
   FAZIL — authentication (Supabase Auth)
   Paste your project URL + anon key in config.js
   ============================================================ */
(function () {
  var CFG = window.FAZIL_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var note = $('#notice');
  function say(type, msg) { if (!note) return; note.className = 'notice ' + type; note.textContent = msg; }
  var sb = window.FAZIL_SB || null;
  var ready = !!sb;
  if (!ready) say('info', 'Accounts aren\'t switched on yet — add your Supabase URL and anon key to config.js.');

  var next = new URLSearchParams(location.search).get('next') || 'account.html';
  function go(url) { location.href = url; }

  /* ---- password strength meter ---- */
  var pw = $('#password'), meter = $('#pw-meter i');
  if (pw && meter) pw.addEventListener('input', function () {
    var v = pw.value, s = 0;
    if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++; if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
    meter.style.width = (s * 25) + '%'; meter.style.background = s < 2 ? '#e05252' : s < 4 ? '#e8a93a' : '#22a35c';
  });

  /* ---- REGISTER ---- */
  var reg = $('#register-form');
  if (reg) reg.addEventListener('submit', async function (e) {
    e.preventDefault();
    var name = $('#name').value.trim(), email = $('#email').value.trim(), p1 = $('#password').value, p2 = $('#password2').value;
    if (p1.length < 8) return say('err', 'Password must be at least 8 characters.');
    if (p1 !== p2) return say('err', 'Passwords don\'t match.');
    if (!$('#terms').checked) return say('err', 'Please accept the terms to continue.');
    if (!ready) return say('err', 'Accounts aren\'t configured yet.');
    var btn = reg.querySelector('button[type=submit]'); btn.disabled = true;
    var r = await sb.auth.signUp({ email: email, password: p1, options: { data: { full_name: name, role: 'candidate' }, emailRedirectTo: location.origin + '/login.html' } });
    btn.disabled = false;
    if (r.error) return say('err', r.error.message);
    if (r.data.session) return go(next);
    say('ok', 'Almost there — check ' + email + ' for a confirmation link, then sign in.');
    reg.reset();
  });

  /* ---- LOGIN ---- */
  var login = $('#login-form');
  if (login) login.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!ready) return say('err', 'Accounts aren\'t configured yet.');
    var btn = login.querySelector('button[type=submit]'); btn.disabled = true;
    var r = await sb.auth.signInWithPassword({ email: $('#email').value.trim(), password: $('#password').value });
    btn.disabled = false;
    if (r.error) return say('err', r.error.message === 'Invalid login credentials' ? 'Wrong email or password.' : r.error.message);
    go(next);
  });

  /* ---- "continue as guest" link on the login page ---- */
  var gl = $('[data-guest-link]');
  if (gl && /^job\.html\?id=/.test(next)) gl.href = next + '&guest=1';

  /* ---- FORGOT ---- */
  var forgot = $('#forgot');
  if (forgot) forgot.addEventListener('click', async function (e) {
    e.preventDefault();
    var email = ($('#email') || {}).value; if (!email) return say('err', 'Enter your email first, then click "Forgot password".');
    if (!ready) return say('err', 'Accounts aren\'t configured yet.');
    var r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/account.html' });
    say(r.error ? 'err' : 'ok', r.error ? r.error.message : 'Password reset email sent to ' + email + '.');
  });

  /* ---- ACCOUNT ---- */
  var acct = $('[data-account]');
  if (acct) (async function () {
    if (!ready) return;
    var s = await sb.auth.getSession();
    if (!s.data.session) return go('login.html?next=account.html');
    var u = s.data.session.user;
    var nm = $('[data-user-name]'); if (nm) nm.textContent = (u.user_metadata && u.user_metadata.full_name) || u.email;
    var em = $('[data-user-email]'); if (em) em.textContent = u.email;
    var out = $('#logout'); if (out) out.addEventListener('click', async function (e) { e.preventDefault(); await sb.auth.signOut(); go('uk.html'); });

    // admin link
    var prof = await sb.from('profiles').select('is_admin').eq('id', u.id).maybeSingle();
    if (prof.data && prof.data.is_admin) {
      var nav = $('.account-nav');
      if (nav) nav.insertAdjacentHTML('beforeend', '<a href="admin.html" style="color:var(--blue)">Admin</a>');
    }

    // ---- CV panel ----
    var cvbox = $('[data-cv]');
    async function renderCvs() {
      if (!cvbox) return;
      var cvs = await myCvs();
      var cur = cvs.filter(function (c) { return c.is_current; })[0];
      var old = cvs.filter(function (c) { return !c.is_current; });
      cvbox.innerHTML =
        (cur ? '<div class="cv-current"><div><span class="cv-tag">Current CV</span><b>' + esc(cur.filename) + '</b><small>Uploaded ' + fmtDate(cur.created_at) + (cur.size_bytes ? ' &middot; ' + Math.round(cur.size_bytes / 1024) + ' KB' : '') + '</small></div><div class="cv-acts"><button class="btn btn-outline" data-cv-open="' + esc(cur.path) + '">Open</button></div></div>'
             : '<p>No CV on file yet. Upload one once and every application after that is one click.</p>') +
        '<form class="cv-upload" data-cv-upload><div class="field file"><label>' + (cur ? 'Replace with a new CV' : 'Upload your CV') + ' (PDF or Word, max 10 MB)</label><input type="file" name="cvfile" accept=".pdf,.doc,.docx" required></div><button class="btn btn-blue" type="submit">' + (cur ? 'Upload new CV &rarr;' : 'Save CV &rarr;') + '</button>' + (cur ? '<p class="apply-hint">Your current CV is kept below, so you can switch back if you upload the wrong file.</p>' : '') + '</form>' +
        (old.length ? '<div class="cv-old"><h3>Previous versions</h3>' + old.map(function (c) { return '<div class="cv-row"><div><b>' + esc(c.filename) + '</b><small>' + fmtDate(c.created_at) + '</small></div><div class="cv-acts"><button class="btn btn-ghost" data-cv-open="' + esc(c.path) + '">Open</button><button class="btn btn-ghost" data-cv-use="' + esc(c.id) + '">Make current</button><button class="btn btn-ghost" data-cv-del="' + esc(c.id) + '" data-path="' + esc(c.path) + '">Delete</button></div></div>'; }).join('') + '</div>' : '');
    }
    await renderCvs();
    document.addEventListener('submit', async function (e) {
      var f = e.target.closest('[data-cv-upload]'); if (!f) return;
      e.preventDefault();
      var file = f.elements.namedItem('cvfile').files[0]; var err = checkFile(file); if (err) return say('err', err);
      var b = f.querySelector('button'); b.disabled = true; b.textContent = 'Uploading…';
      try { await saveNewCv(u.id, file); say('ok', 'CV saved. It will be used for your next application.'); await renderCvs(); await renderApps(); }
      catch (ex) { say('err', ex.message); b.disabled = false; b.innerHTML = 'Upload new CV &rarr;'; }
    });
    document.addEventListener('click', async function (e) {
      var o = e.target.closest('[data-cv-open]'); if (o) { e.preventDefault(); return openCv(o.getAttribute('data-cv-open')); }
      var use = e.target.closest('[data-cv-use]');
      if (use) {
        e.preventDefault();
        await sb.from('cvs').update({ is_current: false }).eq('user_id', u.id).eq('is_current', true);
        var r = await sb.from('cvs').update({ is_current: true }).eq('id', use.getAttribute('data-cv-use'));
        if (r.error) return say('err', r.error.message);
        say('ok', 'That CV is now your current one.'); return renderCvs();
      }
      var del = e.target.closest('[data-cv-del]');
      if (del) {
        e.preventDefault();
        if (!confirm('Delete this CV? Applications you already sent with it keep their copy.')) return;
        await sb.storage.from('cvs').remove([del.getAttribute('data-path')]);
        var r2 = await sb.from('cvs').delete().eq('id', del.getAttribute('data-cv-del'));
        if (r2.error) return say('err', r2.error.message);
        return renderCvs();
      }
      var ch = e.target.closest('[data-app-cv]');
      if (ch) {
        e.preventDefault();
        var cvs = await myCvs(); if (!cvs.length) return say('err', 'Upload a CV first, then attach it to the application.');
        var row = ch.closest('.app-row'); var sel = row.querySelector('[data-cv-select]');
        if (sel) { sel.hidden = !sel.hidden; return; }
        row.insertAdjacentHTML('beforeend', '<div class="cv-select" data-cv-select><label>Attach a different CV</label><select>' + cvs.map(function (c) { return '<option value="' + esc(c.id) + '">' + esc(c.filename) + ' (' + fmtDate(c.created_at) + ')</option>'; }).join('') + '</select><button class="btn btn-blue" data-app-cv-save="' + esc(ch.getAttribute('data-app-cv')) + '">Save</button></div>');
        return;
      }
      var sv = e.target.closest('[data-app-cv-save]');
      if (sv) {
        e.preventDefault();
        var sel2 = sv.closest('[data-cv-select]').querySelector('select');
        var c = (await myCvs()).filter(function (x) { return x.id === sel2.value; })[0]; if (!c) return;
        var r3 = await sb.from('applications').update({ cv_path: c.path, cv_name: c.filename }).eq('id', sv.getAttribute('data-app-cv-save'));
        if (r3.error) return say('err', r3.error.message);
        say('ok', 'CV on that application updated.'); return renderApps();
      }
    });

    // ---- applications ----
    var box = $('[data-applications]');
    async function renderApps() {
      if (!box) return;
      var r = await sb.from('applications').select('id, job_id, status, created_at, cv_name, cv_path, jobs(title, city, salary, sector)').order('created_at', { ascending: false });
      if (r.error || !r.data || !r.data.length) {
        box.innerHTML = '<p>You haven\'t applied for anything yet. <a href="jobs.html" style="color:var(--blue);font-weight:700">Browse live roles</a> &mdash; when you apply, a sector specialist calls you within one working day.</p>';
        return;
      }
      box.innerHTML = r.data.map(function (a) {
        var j = a.jobs || {};
        return '<div class="app-row"><div class="app-main"><a href="job.html?id=' + esc(a.job_id) + '"><span class="sector">' + esc(j.sector || '') + '</span><h3>' + esc(j.title || a.job_id) + '</h3></a><div class="row">' + esc(j.city || '') + ' &middot; <b>' + esc(j.salary || '') + '</b></div><div class="app-meta"><span>Applied ' + fmtDate(a.created_at) + '</span><span class="status">' + esc(a.status) + '</span></div></div>' +
          '<div class="app-cv">' + (a.cv_name ? '<span>CV sent: <b>' + esc(a.cv_name) + '</b></span>' : '<span>No CV attached</span>') + '<div class="cv-acts">' + (a.cv_path ? '<button class="btn btn-ghost" data-cv-open="' + esc(a.cv_path) + '">Open</button>' : '') + '<button class="btn btn-ghost" data-app-cv="' + esc(a.id) + '">Change CV</button></div></div></div>';
      }).join('');
    }
    await renderApps();

    // alerts
    var ab = $('[data-my-alerts]');
    if (ab) {
      var al = await sb.from('job_alerts').select('*').order('created_at', { ascending: false });
      ab.innerHTML = (al.data && al.data.length)
        ? al.data.map(function (x) { return '<div class="row-line"><b>' + ((x.roles || []).join(', ') || 'All roles') + '</b><span>' + ((x.cities || []).join(', ') || 'All cities') + ' · ' + x.frequency + '</span></div>'; }).join('')
        : '<p>No job alerts yet. <a href="job-alerts.html" style="color:var(--blue);font-weight:700">Create one</a> and we\'ll email you matching roles.</p>';
    }
  })();

  /* ============================================================
     CV helpers (Supabase Storage bucket "cvs", table "cvs")
     ============================================================ */
  var CV_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  var CV_MAX = 10 * 1024 * 1024;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function safeName(n) { return n.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80); }
  function checkFile(f) {
    if (!f) return 'Please attach your CV (PDF or Word).';
    var okType = CV_TYPES.indexOf(f.type) > -1 || /\.(pdf|docx?)$/i.test(f.name);
    if (!okType) return 'CVs must be a PDF or Word document.';
    if (f.size > CV_MAX) return 'That file is over 10 MB. Please upload a smaller version.';
    return null;
  }
  async function uploadCv(folder, file) {
    var path = folder + '/' + Date.now() + '-' + safeName(file.name);
    var r = await sb.storage.from('cvs').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
    if (r.error) throw new Error(r.error.message);
    return path;
  }
  async function myCvs() {
    var r = await sb.from('cvs').select('*').order('created_at', { ascending: false });
    return r.data || [];
  }
  async function saveNewCv(uid, file) {
    var path = await uploadCv(uid, file);
    await sb.from('cvs').update({ is_current: false }).eq('user_id', uid).eq('is_current', true);
    var r = await sb.from('cvs').insert({ user_id: uid, path: path, filename: file.name, size_bytes: file.size, is_current: true }).select().single();
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }
  async function openCv(path) {
    var r = await sb.storage.from('cvs').createSignedUrl(path, 120);
    if (r.error) return alert(r.error.message);
    window.open(r.data.signedUrl, '_blank');
  }
  function fmtDate(d) { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }

  /* ---- APPLY (job detail page) ---- */
  async function buildApplyPanel(panel, jobId, forceGuest) {
    var s = await sb.auth.getSession();
    var u = s.data.session && s.data.session.user;
    var here = encodeURIComponent('job.html?id=' + jobId);
    if (u && !forceGuest) {
      var cvs = await myCvs();
      var cur = cvs.filter(function (c) { return c.is_current; })[0] || cvs[0];
      panel.innerHTML =
        '<form class="apply-form" data-apply-form="' + esc(jobId) + '">' +
        '<p class="apply-as">Applying as <b>' + esc((u.user_metadata && u.user_metadata.full_name) || u.email) + '</b></p>' +
        (cvs.length
          ? '<div class="cv-pick"><span class="cv-head">Your CV</span>' + cvs.map(function (c) { return '<label class="cv-opt"><input type="radio" name="cv" value="' + esc(c.id) + '"' + (cur && c.id === cur.id ? ' checked' : '') + '><span>' + esc(c.filename) + '<small>' + fmtDate(c.created_at) + (c.is_current ? ' &middot; current' : '') + '</small></span></label>'; }).join('') +
            '<label class="cv-opt"><input type="radio" name="cv" value="new"><span>Upload a different CV</span></label></div>' +
            '<div class="field file" data-newcv hidden><label>New CV (PDF or Word, max 10 MB)</label><input type="file" name="cvfile" accept=".pdf,.doc,.docx"></div>'
          : '<div class="field file"><label>Your CV (PDF or Word, max 10 MB)</label><input type="file" name="cvfile" accept=".pdf,.doc,.docx" required></div><p class="apply-hint">We\'ll save it to your account so next time it\'s one click.</p>') +
        '<div class="field"><label>Message (optional)</label><textarea name="message" rows="3" placeholder="Anything the consultant should know &mdash; notice period, availability, day rate&hellip;"></textarea></div>' +
        '<button type="submit" class="btn btn-blue btn-lg">Send application &rarr;</button>' +
        '</form>';
      panel.querySelectorAll('input[name=cv]').forEach(function (r) { r.addEventListener('change', function () { var nf = panel.querySelector('[data-newcv]'); if (nf) { nf.hidden = r.value !== 'new'; var inp = nf.querySelector('input'); if (inp) inp.required = r.value === 'new'; } }); });
    } else {
      panel.innerHTML =
        '<form class="apply-form" data-apply-form="' + esc(jobId) + '" data-guest>' +
        (u ? '' : '<div class="apply-choice"><a href="login.html?next=' + here + '" class="btn btn-outline">Sign in to apply</a><span>or apply as a guest below</span></div>') +
        '<div class="field"><label>Full name</label><input name="name" required autocomplete="name"></div>' +
        '<div class="field"><label>Email</label><input type="email" name="email" required autocomplete="email"></div>' +
        '<div class="field"><label>Phone</label><input type="tel" name="phone" required autocomplete="tel"></div>' +
        '<div class="field file"><label>Your CV (PDF or Word, max 10 MB)</label><input type="file" name="cvfile" accept=".pdf,.doc,.docx" required></div>' +
        '<div class="field"><label>Message (optional)</label><textarea name="message" rows="3" placeholder="Anything the consultant should know&hellip;"></textarea></div>' +
        '<p class="apply-hint">By applying you agree to our <a href="privacy.html#candidates" target="_blank">candidate privacy notice</a>.</p>' +
        '<button type="submit" class="btn btn-blue btn-lg">Send application &rarr;</button>' +
        '</form>';
    }
  }
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-apply]');
    if (!btn) return;
    e.preventDefault();
    if (!ready) return alert('Applications are not switched on yet.');
    var jobId = btn.getAttribute('data-apply');
    var panel = document.querySelector('[data-apply-panel="' + jobId + '"]');
    if (!panel) return;
    if (!panel.hidden) { panel.hidden = true; return; }
    panel.hidden = false; panel.innerHTML = '<p class="apply-hint">Loading&hellip;</p>';
    await buildApplyPanel(panel, jobId, false);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
  // arriving from the login page with "continue as guest"
  if (ready && /[?&]guest=1/.test(location.search)) (window.FAZIL_READY || Promise.resolve()).then(function () {
    var btn = document.querySelector('[data-apply]'); if (!btn) return;
    var panel = document.querySelector('[data-apply-panel="' + btn.getAttribute('data-apply') + '"]');
    if (!panel) return;
    panel.hidden = false; buildApplyPanel(panel, btn.getAttribute('data-apply'), true).then(function () { panel.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  });
  document.addEventListener('submit', async function (e) {
    var form = e.target.closest('[data-apply-form]'); if (!form) return;
    e.preventDefault();
    var jobId = form.getAttribute('data-apply-form');
    var note = document.querySelector('[data-apply-note]');
    var btn = form.querySelector('button[type=submit]');
    var fail = function (m) { btn.disabled = false; btn.innerHTML = 'Send application &rarr;'; if (note) { note.className = 'notice err'; note.textContent = m; note.scrollIntoView({ block: 'nearest' }); } };
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      var s = await sb.auth.getSession(); var u = s.data.session && s.data.session.user;
      var row = { job_id: jobId, message: (form.elements.namedItem('message').value || '').trim() || null };
      var fileInp = form.elements.namedItem('cvfile');
      if (form.hasAttribute('data-guest')) {
        var f = fileInp.files[0]; var err = checkFile(f); if (err) return fail(err);
        row.user_id = null;
        row.guest_name = form.elements.namedItem('name').value.trim();
        row.guest_email = form.elements.namedItem('email').value.trim();
        row.guest_phone = form.elements.namedItem('phone').value.trim();
        row.cv_path = await uploadCv('guest', f); row.cv_name = f.name;
      } else {
        row.user_id = u.id;
        var pick = form.querySelector('input[name=cv]:checked');
        if (!pick || pick.value === 'new') {
          var f2 = fileInp && fileInp.files[0]; var err2 = checkFile(f2); if (err2) return fail(err2);
          var saved = await saveNewCv(u.id, f2); row.cv_path = saved.path; row.cv_name = saved.filename;
        } else {
          var c = (await myCvs()).filter(function (x) { return x.id === pick.value; })[0];
          if (!c) return fail('Could not find that CV. Please upload it again.');
          row.cv_path = c.path; row.cv_name = c.filename;
        }
      }
      var r = await sb.from('applications').insert(row);
      if (r.error && r.error.code === '23505') return fail('You have already applied for this role. You can change the CV on it from your account page.');
      if (r.error) return fail(r.error.message);
      form.closest('.apply-panel').hidden = true;
      var ab = document.querySelector('[data-apply="' + jobId + '"]'); if (ab) { ab.disabled = true; ab.textContent = 'Application sent ✓'; }
      if (note) { note.className = 'notice ok'; note.textContent = 'Application received. A sector specialist will call you within one working day.'; }
    } catch (ex) { fail(ex.message || String(ex)); }
  });

  /* ---- JOB ALERT FORM Supabase ---- */
  var af = document.querySelector('[data-alert]');
  if (af && ready) af.addEventListener('submit', async function (e) {
    e.preventDefault();
    var get = function (k) { var m = af.querySelector('.msel[data-key="' + k + '"]'); return m && m.getValues ? m.getValues() : []; };
    var s = await sb.auth.getSession();
    var r = await sb.from('job_alerts').insert({
      email: af.querySelector('[name=email]').value.trim(),
      roles: get('role'), cities: get('loc'),
      frequency: af.querySelector('[name=frequency]').value,
      user_id: s.data.session ? s.data.session.user.id : null
    });
    var n = document.querySelector('#alert-notice');
    if (n) { n.className = 'notice ' + (r.error ? 'err' : 'ok'); n.textContent = r.error ? r.error.message : 'Alert created. We\'ll email you when a matching role goes live.'; }
    if (!r.error) af.reset();
  });

  /* ---- header: swap "Sign in" for name when logged in ---- */
  if (ready) sb.auth.getSession().then(function (s) {
    var a = document.querySelector('.nav-right .signin');
    if (a && s.data.session) { a.textContent = 'My account'; a.href = 'account.html'; }
  });
})();
