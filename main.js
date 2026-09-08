/* ============================================================
   FAZIL — site behaviour
   ============================================================ */
function fazilInit() {
  var JOBS = window.FAZIL_JOBS || [];
  var CFG = window.FAZIL_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var uniq = function (arr) { return arr.filter(function (v, i, a) { return a.indexOf(v) === i; }); };

  /* ---------- always start at the top ---------- */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) window.scrollTo(0, 0);
  window.addEventListener('load', function () {
    if (!location.hash) { window.scrollTo(0, 0); }
    else { var t = $(location.hash); if (t) setTimeout(function(){ t.scrollIntoView({behavior:'smooth'}); }, 50); }
  });

  /* ---------- FAQ ---------- */
  $$('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.parentElement;
      $$('.faq-item').forEach(function (i) { if (i !== item) i.classList.remove('open'); });
      item.classList.toggle('open');
    });
  });

  /* ---------- mobile menu ---------- */
  var burger = $('.burger'), mob = $('.mobile-menu');
  if (burger && mob) burger.addEventListener('click', function () { mob.classList.toggle('open'); });

  /* ---------- active nav ---------- */
  var page = location.pathname.split('/').pop() || 'index.html';
  $$('.nav-item > a, .mobile-menu a').forEach(function (a) {
    if ((a.getAttribute('href') || '').split('#')[0] === page) a.classList.add('active');
  });

  /* ---------- live numbers ---------- */
  $$('[data-live-jobs]').forEach(function (el) { el.textContent = JOBS.length; });
  $$('[data-placed]').forEach(function (el) { el.textContent = (CFG.candidatesPlaced || 0) + '+'; });
  $$('[data-years]').forEach(function (el) { el.textContent = (CFG.yearsExperience || 0) + '+'; });

  /* ---------- multi-select "reel" ---------- */
  function buildMsel(el) {
    var key = el.getAttribute('data-key');
    var opts = [];
    if (key === 'role') opts = uniq(JOBS.map(function (j) { return j.title; })).sort();
    if (key === 'loc') opts = uniq(JOBS.map(function (j) { return j.city; })).sort();
    if (key === 'sector') opts = uniq(JOBS.map(function (j) { return j.sector; })).sort();
    var counts = {};
    JOBS.forEach(function (j) { var v = key === 'role' ? j.title : key === 'loc' ? j.city : j.sector; counts[v] = (counts[v] || 0) + 1; });
    var box = $('.msel-box', el), panel = $('.msel-panel', el), ph = box.getAttribute('data-ph') || 'Select';
    var sel = [];
    panel.innerHTML = opts.map(function (o) {
      return '<label><input type="checkbox" value="' + o.replace(/"/g, '&quot;') + '"> ' + o + '<span class="cnt">' + counts[o] + '</span></label>';
    }).join('');
    function render() {
      box.innerHTML = sel.length ? sel.map(function (s) { return '<span class="chip">' + s + ' <b data-v="' + s + '">&times;</b></span>'; }).join('') : '<span class="ph">' + ph + '</span>';
      $$('input', panel).forEach(function (i) { i.checked = sel.indexOf(i.value) > -1; });
      el.dispatchEvent(new CustomEvent('change'));
    }
    el.getValues = function () { return sel.slice(); };
    el.setValues = function (v) { sel = v.filter(function (x) { return opts.indexOf(x) > -1; }); render(); };
    panel.addEventListener('change', function (e) {
      var v = e.target.value; if (e.target.checked) { if (sel.indexOf(v) < 0) sel.push(v); } else { sel = sel.filter(function (x) { return x !== v; }); }
      render();
    });
    box.addEventListener('click', function (e) {
      var x = e.target.closest('b[data-v]');
      if (x) { sel = sel.filter(function (s) { return s !== x.getAttribute('data-v'); }); render(); e.stopPropagation(); return; }
      el.classList.toggle('open');
    });
    el.addEventListener('click', function (e) { if (e.target === el || e.target.tagName === 'LABEL' && e.target.parentElement === el) el.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!el.contains(e.target)) el.classList.remove('open'); });
    render();
  }
  $$('.msel').forEach(buildMsel);

  /* ---------- search form → jobs.html?params ---------- */
  function qs(obj) {
    return Object.keys(obj).filter(function (k) { return obj[k] && obj[k].length; })
      .map(function (k) { return k + '=' + encodeURIComponent(obj[k].join('|')); }).join('&');
  }
  $$('form.search-bar[data-search]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var role = $('.msel[data-key="role"]', f), loc = $('.msel[data-key="loc"]', f);
      var q = qs({ role: role ? role.getValues() : [], loc: loc ? loc.getValues() : [] });
      location.href = 'jobs.html' + (q ? '?' + q : '');
    });
  });

  /* ---------- browse pills (sector + city) → jobs ---------- */
  var browse = $('[data-browse]');
  if (browse) {
    var sum = $('.sum', browse);
    function update() {
      var s = $$('.pills[data-group="sector"] .sel', browse).map(function (b) { return b.textContent; });
      var c = $$('.pills[data-group="loc"] .sel', browse).map(function (b) { return b.textContent; });
      var n = JOBS.filter(function (j) { return (!s.length || s.indexOf(j.sector) > -1) && (!c.length || c.indexOf(j.city) > -1); }).length;
      if (sum) sum.textContent = n + ' matching role' + (n === 1 ? '' : 's');
      return { sector: s, loc: c };
    }
    $$('.pills button', browse).forEach(function (b) { b.addEventListener('click', function () { b.classList.toggle('sel'); update(); }); });
    var go = $('[data-browse-go]', browse);
    if (go) go.addEventListener('click', function () { var q = qs(update()); location.href = 'jobs.html' + (q ? '?' + q : ''); });
    update();
  }

  /* ---------- JOBS PAGE ---------- */
  var list = $('[data-job-list]');
  if (list) {
    var params = new URLSearchParams(location.search);
    var get = function (k) { var v = params.get(k); return v ? v.split('|') : []; };
    var state = { role: get('role'), loc: get('loc'), sector: get('sector'), type: get('type'), q: params.get('q') || '', sort: 'new' };

    // build filter checkboxes from data
    function fill(group, key) {
      var box = $('[data-filter="' + group + '"]'); if (!box) return;
      var vals = uniq(JOBS.map(function (j) { return j[key]; })).sort();
      box.innerHTML = vals.map(function (v) { return '<label><input type="checkbox" value="' + v + '"' + (state[group].indexOf(v) > -1 ? ' checked' : '') + '> ' + v + '</label>'; }).join('');
      box.addEventListener('change', function () { state[group] = $$('input:checked', box).map(function (i) { return i.value; }); render(); });
    }
    fill('sector', 'sector'); fill('loc', 'city'); fill('type', 'type');

    var roleSel = $('.msel[data-key="role"]'), locSel = $('.msel[data-key="loc"]');
    if (roleSel) { roleSel.setValues(state.role); roleSel.addEventListener('change', function () { state.role = roleSel.getValues(); render(); }); }
    if (locSel) { locSel.setValues(state.loc); locSel.addEventListener('change', function () { state.loc = locSel.getValues(); render(); }); }
    var sortSel = $('[data-sort]'); if (sortSel) sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
    var clear = $('[data-clear]'); if (clear) clear.addEventListener('click', function (e) { e.preventDefault(); location.href = 'jobs.html'; });

    function salNum(s) { var m = s.replace(/,/g, '').match(/\d+/g); return m ? +m[m.length - 1] : 0; }
    function render() {
      var out = JOBS.filter(function (j) {
        return (!state.role.length || state.role.indexOf(j.title) > -1)
          && (!state.loc.length || state.loc.indexOf(j.city) > -1)
          && (!state.sector.length || state.sector.indexOf(j.sector) > -1)
          && (!state.type.length || state.type.indexOf(j.type) > -1)
          && (!state.q || (j.title + ' ' + j.sector + ' ' + j.city).toLowerCase().indexOf(state.q.toLowerCase()) > -1);
      });
      if (state.sort === 'hi') out.sort(function (a, b) { return salNum(b.salary) - salNum(a.salary); });
      else if (state.sort === 'lo') out.sort(function (a, b) { return salNum(a.salary) - salNum(b.salary); });
      else out.sort(function (a, b) { return (b.featured - a.featured) || (b.posted > a.posted ? 1 : -1); });
      var cnt = $('[data-count]'); if (cnt) cnt.innerHTML = 'Showing <b>' + out.length + '</b> of ' + JOBS.length + ' roles';
      var active = $('[data-active-filters]');
      if (active) {
        var chips = [].concat(state.role, state.loc, state.sector, state.type);
        active.innerHTML = chips.length ? chips.map(function (c) { return '<span class="chip">' + c + '</span>'; }).join('') + ' <a href="jobs.html" data-clear style="font-size:13px;font-weight:700;color:var(--blue);margin-left:6px">Clear all</a>' : '';
        var cl = $('[data-clear]', active); if (cl) cl.addEventListener('click', function (e) { e.preventDefault(); location.href = 'jobs.html'; });
      }
      list.innerHTML = out.length ? out.map(function (j) {
        return '<a href="job.html?id=' + j.id + '" class="job-row"><div><h3>' + j.title + '</h3><div class="meta"><span>' + j.city + ', UK</span><span class="sal">' + j.salary + '</span><span>' + j.type + '</span></div><div class="tags">' + (j.featured ? '<span class="tag blue">Featured</span>' : '') + '<span class="tag">' + j.sector + '</span></div></div><div class="btn btn-outline">View role &rarr;</div></a>';
      }).join('') : '<div class="empty">No roles match those filters yet. <a href="jobs.html" style="color:var(--blue);font-weight:700">Clear filters</a> or <a href="register.html" style="color:var(--blue);font-weight:700">register</a> and we\'ll call you when one comes up.</div>';
    }
    render();
  }

  /* ---------- JOB DETAIL PAGE ---------- */
  var jd = $('[data-job-detail]');
  if (jd) {
    var id = new URLSearchParams(location.search).get('id');
    var j = JOBS.filter(function (x) { return x.id === id; })[0];
    if (!j) { jd.innerHTML = '<div class="wrap" style="padding:80px 40px"><div class="empty">That role is no longer live. <a href="jobs.html" style="color:var(--blue);font-weight:700">See all live jobs</a></div></div>'; }
    else {
      document.title = j.title + ' — Fazil Recruitment Group';
      jd.innerHTML =
        '<div class="job-head"><div class="wrap"><div class="crumbs" style="color:var(--grey-700)"><a href="index.html">Home</a> / <a href="jobs.html">Live jobs</a> / ' + j.sector + '</div>' +
        (j.featured ? '<span class="tag blue">Featured</span>' : '') + '<h1>' + j.title + '</h1><div class="meta"><span>' + j.city + ', UK</span><span class="sal">' + j.salary + '</span><span>' + j.type + '</span><span>' + j.sector + '</span></div></div></div>' +
        '<section><div class="wrap job-detail"><div><p style="font-size:18px;color:var(--navy);font-weight:500">' + j.summary + '</p><h3>About this role</h3><p>' + j.about + '</p><h3>What we\'re looking for</h3><ul>' + j.requirements.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul><h3>How to apply</h3><p>Click apply and a sector specialist will call you within one working day. You\'ll need a Fazil account &mdash; it takes 30 seconds.</p></div>' +
        '<aside class="job-aside"><div data-apply-note class="notice"></div><button data-apply="' + j.id + '" class="btn btn-blue btn-lg">Apply for this role &rarr;</button><a href="contact-candidates.html" class="btn btn-outline">Refer a candidate</a><dl><dt>Location</dt><dd>' + j.city + ', United Kingdom</dd><dt>Salary</dt><dd>' + j.salary + '</dd><dt>Contract</dt><dd>' + j.type + '</dd><dt>Sector</dt><dd>' + j.sector + '</dd><dt>Posted</dt><dd>' + j.posted + '</dd><dt>Reference</dt><dd>FZ-' + j.id.toUpperCase() + '</dd></dl></aside></div></section>';
    }
  }

  /* ---------- INSIGHTS TABS ---------- */
  var tabs = $('[data-tabs]');
  if (tabs) {
    var cards = $$('[data-cat]'), intros = $$('.cat-intro');
    function show(cat) {
      $$('button', tabs).forEach(function (b) { b.classList.toggle('sel', b.getAttribute('data-tab') === cat); });
      cards.forEach(function (c) { c.hidden = !(cat === 'all' || c.getAttribute('data-cat') === cat); });
      intros.forEach(function (i) { i.classList.toggle('show', i.getAttribute('data-intro') === cat); });
    }
    $$('button', tabs).forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-tab')); history.replaceState(null, '', '#' + b.getAttribute('data-tab')); }); });
    show((location.hash || '#all').slice(1));
  }
}

/* ============================================================
   v3 — featured job cards, job-alert hidden fields, scroll top
   ============================================================ */
function fazilInit2() {
  var JOBS = window.FAZIL_JOBS || [];
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // belt-and-braces: start at the top unless there's an anchor
  function top() { if (!location.hash) window.scrollTo(0, 0); }
  document.addEventListener('DOMContentLoaded', top);
  window.addEventListener('pageshow', top);
  setTimeout(top, 0); setTimeout(top, 120);

  function ago(d) {
    var days = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 864e5));
    return days === 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
  }

  $$('[data-job-cards]').forEach(function (box) {
    var limit = +box.getAttribute('data-limit') || 3;
    var list = JOBS.slice().sort(function (a, b) { return (b.featured - a.featured) || (b.posted > a.posted ? 1 : -1); }).slice(0, limit);
    box.innerHTML = list.map(function (j) {
      return '<a href="job.html?id=' + j.id + '" class="job-card"><span class="sector">' + j.sector + '</span><h3>' + j.title + '</h3>' +
        '<div class="row">' + j.city + ', UK &middot; ' + j.type + '</div><div class="row"><b>' + j.salary + '</b></div>' +
        '<div class="foot"><span>' + ago(j.posted) + '</span><span class="link">View role &rarr;</span></div></a>';
    }).join('');
  });

  // job-alert form: copy multi-select values into hidden inputs for Netlify
  var af = $('[data-alert]');
  if (af) af.addEventListener('submit', function () {
    $$('[data-hidden]', af).forEach(function (h) {
      var m = $('.msel[data-key="' + h.getAttribute('data-hidden') + '"]', af);
      h.value = m && m.getValues ? m.getValues().join(', ') : '';
    });
  });
}

/* ---- boot: wait for Supabase data, then render ---- */
(function () {
  function boot() { try { fazilInit(); } catch (e) { console.error(e); } try { fazilInit2(); } catch (e) { console.error(e); } }
  var ready = window.FAZIL_READY || Promise.resolve();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { ready.then(boot); });
  else ready.then(boot);
})();
