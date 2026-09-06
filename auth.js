/* ============================================================
   FAZIL — authentication (Supabase Auth)
   Paste your project URL + anon key in config.js
   ============================================================ */
(function () {
  var CFG = window.FAZIL_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var note = $('#notice');
  function say(type, msg) { if (!note) return; note.className = 'notice ' + type; note.textContent = msg; }
  var ready = !!(CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase);
  var sb = ready ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey) : null;
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
    var out = $('#logout'); if (out) out.addEventListener('click', async function (e) { e.preventDefault(); await sb.auth.signOut(); go('index.html'); });
  })();

  /* ---- header: swap "Sign in" for name when logged in ---- */
  if (ready) sb.auth.getSession().then(function (s) {
    var a = document.querySelector('.nav-right .signin');
    if (a && s.data.session) { a.textContent = 'My account'; a.href = 'account.html'; }
  });
})();
