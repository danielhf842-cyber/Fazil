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

    // applications
    var box = $('[data-applications]');
    if (box) {
      var r = await sb.from('applications').select('id, job_id, status, created_at, jobs(title, city, salary, sector)').order('created_at', { ascending: false });
      if (r.error || !r.data || !r.data.length) {
        box.innerHTML = '<p>You haven\'t applied for anything yet. <a href="jobs.html" style="color:var(--blue);font-weight:700">Browse live roles</a> — when you apply, a sector specialist calls you within one working day.</p>';
      } else {
        box.innerHTML = '<div class="jobs-grid" style="grid-template-columns:1fr">' + r.data.map(function (a) {
          var j = a.jobs || {};
          return '<a href="job.html?id=' + a.job_id + '" class="job-card"><span class="sector">' + (j.sector || '') + '</span><h3>' + (j.title || a.job_id) + '</h3><div class="row">' + (j.city || '') + ' · <b>' + (j.salary || '') + '</b></div><div class="foot"><span>Applied ' + new Date(a.created_at).toLocaleDateString() + '</span><span class="link">' + a.status + '</span></div></a>';
        }).join('') + '</div>';
      }
    }

    // alerts
    var ab = $('[data-my-alerts]');
    if (ab) {
      var al = await sb.from('job_alerts').select('*').order('created_at', { ascending: false });
      ab.innerHTML = (al.data && al.data.length)
        ? al.data.map(function (x) { return '<div class="row-line"><b>' + ((x.roles || []).join(', ') || 'All roles') + '</b><span>' + ((x.cities || []).join(', ') || 'All cities') + ' · ' + x.frequency + '</span></div>'; }).join('')
        : '<p>No job alerts yet. <a href="job-alerts.html" style="color:var(--blue);font-weight:700">Create one</a> and we\'ll email you matching roles.</p>';
    }
  })();

  /* ---- APPLY BUTTON (job detail page) ---- */
  document.addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-apply]');
    if (!btn) return;
    e.preventDefault();
    if (!ready) return alert('Applications are not switched on yet.');
    var jobId = btn.getAttribute('data-apply');
    var s = await sb.auth.getSession();
    if (!s.data.session) return go('login.html?next=' + encodeURIComponent('job.html?id=' + jobId));
    btn.disabled = true; btn.textContent = 'Sending…';
    var r = await sb.from('applications').insert({ user_id: s.data.session.user.id, job_id: jobId });
    if (r.error && r.error.code === '23505') { btn.textContent = 'Already applied ✓'; return; }
    if (r.error) { btn.disabled = false; btn.textContent = 'Apply for this role →'; return alert(r.error.message); }
    btn.textContent = 'Application sent ✓';
    var note = document.querySelector('[data-apply-note]');
    if (note) { note.className = 'notice ok'; note.textContent = 'Application received. A sector specialist will call you within one working day.'; }
  });

  /* ---- JOB ALERT FORM → Supabase ---- */
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
