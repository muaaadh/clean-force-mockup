/* Clean Force admin: a simple ERP over the demo store (bookings, customers, sales, teams, prices). */
(function () {
  var CF = window.CF, D = window.CF_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = CF.esc, money = CF.money;
  var view = $('#view'), drawer = $('#drawer'), dbg = $('#drawerBg'), tip = $('#tip');
  var db, today = CF.today();
  var SKEY = 'cleanforce.admin';
  var ui = { bk: { f: 'upcoming', area: '', team: '', n: 40, q: '' }, cu: { sort: 'last', area: '', q: '', n: 50 }, month: today.slice(0, 7) };

  function load() { db = CF.db(); today = CF.today(); }
  /* every change goes through CF.api; on success redraw, on failure say why */
  function act(p, msg, after) {
    return p.then(function (r) { load(); if (msg) toast(typeof msg === 'function' ? msg(r) : msg); if (after) after(r); else route(); return r; },
      function (e) { toast(CF.problem(e)); load(); route(); throw e; });
  }
  var NEXT = { booked: ['confirmed', 'Confirm'], confirmed: ['onway', 'On the way'], onway: ['cleaning', 'Start'], cleaning: ['done', 'Done'] };
  function stepBtn(b) {
    if (b.status === 'cancelled') return '<span class="pill cancelled">Cancelled</span>';
    if (NEXT[b.status]) return '<button class="b b-sm b-step s-' + b.status + '" data-step="' + b.id + '" title="Mark as ' + CF.statusName(NEXT[b.status][0]).toLowerCase() + '">' + NEXT[b.status][1] + '</button>';
    return CF.due(b) ? '<button class="b b-sm b-good" data-pay="' + b.id + '">Mark paid</button>' : '<span class="pill paid">Paid</span>';
  }
  function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('on'); }, 2400); }
  function cust(b) { return CF.customer(b.customerId, db) || { name: 'Unknown', phone: '' }; }
  function svcLine(b) { var s = CF.service(b.service), o = CF.option(b.service, b.option); return (s ? s.name : b.service) + (o ? ', ' + o.name : ''); }
  function pill(st) { return '<span class="pill ' + st + '">' + CF.statusName(st) + '</span>'; }
  function payPill(b) {
    if (b.status === 'cancelled') return '<span class="muted small">None</span>';
    var paid = CF.paid(b), due = CF.due(b);
    if (!due) return '<span class="pill paid">Paid</span>';
    if (paid) return '<span class="pill part">Part paid</span>';
    if (b.status === 'done' || b.date < today) return '<span class="pill unpaid">Unpaid</span>';
    return '<span class="muted small">' + (b.method === 'cash' ? 'Cash on day' : 'Transfer') + '</span>';
  }
  function owed(b) { return (b.status === 'done' || b.date < today) ? CF.due(b) : 0; }
  function month(iso) { return iso.slice(0, 7); }
  function monthName(ym) { var p = ym.split('-'); return new Date(+p[0], +p[1] - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' }); }
  function shiftMonth(ym, n) { var p = ym.split('-'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '-' + CF.pad(d.getMonth() + 1); }
  function payments(filter) {
    var out = [];
    db.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (!filter || filter(p, b)) out.push({ p: p, b: b }); }); });
    return out;
  }
  function initials(n) { return n.split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase(); }
  function teamSel(b) { return '<select class="sel" data-set="team" data-id="' + b.id + '" aria-label="Team for ' + b.id + '"><option value="">No team</option>' + D.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === b.team ? ' selected' : '') + '>' + t.name + '</option>'; }).join('') + '</select>'; }
  function statusSel(b) { return '<select class="sel" data-set="status" data-id="' + b.id + '" aria-label="Status for ' + b.id + '">' + D.statuses.map(function (s) { return '<option value="' + s.id + '"' + (s.id === b.status ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select>'; }

  /* ---------- auth ---------- */
  function authed() { return !!CF.auth.staff(); }
  function start() {
    if (!authed()) { $('#login').hidden = false; $('#app').hidden = true; return; }
    $('#login').hidden = true; $('#app').hidden = false;
    var st = CF.auth.staff(); $('#who').textContent = st.name || 'Office';
    route();
  }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault(); var f = this, btn = f.querySelector('button'); btn.disabled = true; $('#loginErr').hidden = true;
    CF.auth.staffSignIn(f.user.value, f.pass.value).then(function () { return CF.ready('staff'); }).then(function () { btn.disabled = false; start(); },
      function (x) { btn.disabled = false; $('#loginErr').textContent = CF.problem(x); $('#loginErr').hidden = false; });
  });
  $('#logout').addEventListener('click', function () { CF.auth.staffSignOut().then(start); });
  $('#resetBtn').addEventListener('click', function () { if (confirm('Reset all demo data? Bookings made on the website in this browser will be removed.')) act(CF.api.reset(), 'Demo data reset'); });
  if (!CF.isDemo()) { $('#resetBtn').hidden = true; $('#uLbl').textContent = 'Email'; var lf = $('#loginForm'); lf.user.value = ''; lf.pass.value = ''; lf.user.type = 'email'; $('#demoNote').hidden = true; }

  /* ---------- router ---------- */
  var TITLES = { today: 'Today', bookings: 'Bookings', customers: 'Customers', customer: 'Customer', sales: 'Sales', teams: 'Schedule', prices: 'Prices' };
  function route() {
    load(); tip.hidden = true;
    var h = (location.hash.slice(1) || 'today').split('/'), v = VIEWS[h[0]] ? h[0] : 'today';
    $$('.snav a').forEach(function (a) { a.classList.toggle('on', a.dataset.v === (v === 'customer' ? 'customers' : v)); if (a.classList.contains('on')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    $('#title').textContent = TITLES[v];
    document.title = TITLES[v] + ' | Clean Force Admin';
    VIEWS[v](h[1]);
    $('#side').classList.remove('open'); $('#menu').setAttribute('aria-expanded', 'false');
  }
  window.addEventListener('hashchange', function () { route(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  $('#menu').addEventListener('click', function () { var o = $('#side').classList.toggle('open'); this.setAttribute('aria-expanded', o); });
  var typing = function () { var a = document.activeElement; return a && a.matches('textarea, input:not([type=checkbox]):not([type=radio])') && view.contains(a); };
  var pending = false;
  CF.onChange(function () { if (!authed()) return; if (drawer.hidden && !typing()) route(); else { load(); pending = drawer.hidden; } toast('New data from the website'); });
  view.addEventListener('focusout', function () { if (pending) setTimeout(function () { if (!typing() && drawer.hidden) { pending = false; route(); } }, 0); });

  /* inline selects in tables (team / status) */
  view.addEventListener('change', function (e) {
    var t = e.target; if (!t.dataset.set) return;
    var patch = {}; patch[t.dataset.set] = t.value;
    act(CF.api.updateBooking(t.dataset.id, patch), t.dataset.id + ': ' + (t.dataset.set === 'team' ? (t.value ? CF.team(t.value).name : 'no team') : CF.statusName(t.value)));
  });
  view.addEventListener('click', function (e) {
    var el = e.target.closest('[data-open], [data-cust], [data-pay], [data-go], [data-step]');
    if (!el || e.target.closest('select')) return;
    if (el.dataset.open) openBooking(el.dataset.open);
    else if (el.dataset.cust) location.hash = 'customer/' + el.dataset.cust;
    else if (el.dataset.go) location.hash = el.dataset.go;
    else if (el.dataset.pay) { load(); var b = CF.booking(el.dataset.pay, db); if (!b || !CF.due(b)) { route(); return; } el.disabled = true; act(CF.api.addPayment(b.id, { amt: CF.due(b), method: b.method }), function (x) { return x.id + ' paid, ' + money(CF.paid(x)); }); }
    else if (el.dataset.step) { load(); var sb = CF.booking(el.dataset.step, db); if (!sb || !NEXT[sb.status]) { route(); return; } el.disabled = true; act(CF.api.updateBooking(sb.id, { status: NEXT[sb.status][0] }), sb.id + ': ' + CF.statusName(NEXT[sb.status][0])); }
  });
  view.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('tr.click')) e.target.click(); });

  /* ---------- chart: single series bars, hover tooltip ---------- */
  function barChart(host, data, fmtTip) {
    var W = 760, H = 220, L = 46, R = 8, T = 10, B = 26;
    var max = Math.max.apply(null, data.map(function (d) { return d.v; }).concat([1]));
    var step = Math.pow(10, Math.floor(Math.log10(max / 4))); var nice = [1, 2, 2.5, 5, 10].map(function (m) { return m * step; }).filter(function (s) { return max / s <= 5; })[0] || step * 10;
    var top = Math.ceil(max / nice) * nice, n = data.length, bw = (W - L - R) / n, gap = Math.min(4, bw * .25);
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Bar chart">';
    s += '<g class="grid">'; for (var g = 0; g <= top; g += nice) s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(g) + '" y2="' + y(g) + '"/>'; s += '</g>';
    s += '<g class="ax">'; for (g = 0; g <= top; g += nice) s += '<text x="' + (L - 8) + '" y="' + (y(g) + 4) + '" text-anchor="end">' + (g >= 1000 ? (g / 1000) + 'k' : g) + '</text>';
    var every = Math.ceil(n / (host.clientWidth && host.clientWidth < 500 ? 4 : 8));
    data.forEach(function (d, i) { if (i % every === 0 || (i === n - 1 && (n - 1) % every >= every / 2)) s += '<text x="' + (L + bw * i + bw / 2) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(d.l) + '</text>'; });
    s += '</g>';
    data.forEach(function (d, i) {
      var x = L + bw * i + gap / 2, w = bw - gap, yy = y(d.v), base = y(0), h = base - yy, r = Math.min(4, w / 2, h);
      s += '<g data-i="' + i + '"><rect class="hit" x="' + (L + bw * i) + '" y="' + T + '" width="' + bw + '" height="' + (H - T - B) + '"/>';
      if (d.v > 0) s += '<path class="bar-m" d="M' + x + ',' + base + 'V' + (yy + r) + 'Q' + x + ',' + yy + ' ' + (x + r) + ',' + yy + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + yy + ' ' + (x + w) + ',' + (yy + r) + 'V' + base + 'Z"/>';
      s += '</g>';
    });
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#c9cfdd"/></svg>';
    host.innerHTML = s; host.classList.add('chart');
    $$('g[data-i]', host).forEach(function (g) {
      g.addEventListener('pointerenter', function (e) { var d = data[+g.dataset.i]; g.classList.add('on'); tip.hidden = false; tip.innerHTML = fmtTip(d); });
      g.addEventListener('pointermove', function (e) { tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; });
      g.addEventListener('pointerleave', function () { g.classList.remove('on'); tip.hidden = true; });
    });
  }
  function hbars(rows) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="hbars">' + rows.map(function (r) {
      return '<div class="hb"><span>' + esc(r.l) + '</span><span class="tr"><span class="fill" style="display:block;width:' + (r.v / max * 100).toFixed(1) + '%"></span></span><span class="v">' + money(r.v) + (r.s ? '<small>' + esc(r.s) + '</small>' : '') + '</span></div>';
    }).join('') + '</div>';
  }

  var VIEWS = {};

  /* ---------- TODAY ---------- */
  VIEWS.today = function () {
    var ym = month(today), prev = shiftMonth(ym, -1), dayN = +today.slice(8);
    var coll = 0, collPrev = 0;
    payments().forEach(function (x) {
      if (month(x.p.date) === ym) coll += x.p.amt;
      if (month(x.p.date) === prev && +x.p.date.slice(8) <= dayN) collPrev += x.p.amt;
    });
    var jobs = db.bookings.filter(function (b) { return month(b.date) === ym && b.status === 'done'; }).length;
    var owing = db.bookings.filter(function (b) { return owed(b) > 0; });
    var owe = owing.reduce(function (t, b) { return t + owed(b); }, 0);
    var newC = db.customers.filter(function (c) { return month(c.since) === ym; }).length;
    var ch = collPrev ? Math.round((coll - collPrev) / collPrev * 100) : 0;
    var todays = db.bookings.filter(function (b) { return b.date === today && b.status !== 'cancelled'; }).sort(function (a, b) { return a.slot.localeCompare(b.slot); });
    var tomorrow = db.bookings.filter(function (b) { return b.date === CF.addDays(today, 1) && b.status !== 'cancelled'; });
    var unconf = db.bookings.filter(function (b) { return b.status === 'booked' && b.date >= today; });

    view.innerHTML =
      '<div class="g g4">' +
      '<button class="card kpi act" data-go="sales"><span>Sales this month</span><b>' + money(coll) + '</b><small class="' + (ch >= 0 ? 'up' : 'down') + '">' + (ch >= 0 ? '+' : '') + ch + '% on the same days last month</small></button>' +
      '<button class="card kpi act" data-go="bookings"><span>Cleans done this month</span><b>' + jobs + '</b><small>' + todays.length + ' today, ' + tomorrow.length + ' tomorrow</small></button>' +
      '<button class="card kpi act" id="kOwe"><span>To collect</span><b>' + money(owe) + '</b><small>' + owing.length + ' unpaid jobs</small></button>' +
      '<button class="card kpi act" data-go="customers"><span>New customers this month</span><b>' + newC + '</b><small>' + db.customers.length + ' customers in total</small></button></div>' +
      '<div class="g g21 mt"><div class="card"><div class="card-h"><h2>Sales, last 30 days</h2><span class="muted small">Money received per day</span></div><div class="card-b"><div id="ch30"></div></div></div>' +
      '<div class="card"><div class="card-h"><h2>Needs a call</h2><span class="muted small">' + unconf.length + ' not confirmed</span></div><div class="card-b">' +
      (unconf.length ? unconf.slice(0, 3).map(function (b) { var c = cust(b); return '<div class="lrow" style="grid-template-columns:1fr auto"><button class="who" data-open="' + b.id + '"><b>' + esc(c.name) + '</b><small>' + CF.fmtDate(b.date, true) + ', ' + b.slot + ' &middot; ' + esc(svcLine(b)) + '</small></button><a class="b b-sm" href="tel:+960' + c.phone + '">Call</a></div>'; }).join('') : '<p class="empty">All bookings are confirmed.</p>') +
      '</div></div></div>' +
      '<div class="g g21 mt"><div class="card"><div class="card-h"><h2>Today, ' + CF.fmtDate(today, true) + '</h2><span class="muted small">' + todays.length + ' jobs</span></div><div class="card-b">' +
      (todays.length ? todays.map(function (b) {
        var c = cust(b);
        return '<div class="lrow job s-' + b.status + '"><span class="t">' + b.slot + '</span><button class="who" data-open="' + b.id + '"><b>' + esc(c.name) + ' ' + pill(b.status) + '</b><small>' + esc(svcLine(b)) + ' &middot; ' + esc(b.address) + ', ' + esc(CF.area(b.area).name) + '</small></button>' + teamSel(b) + stepBtn(b) + '</div>';
      }).join('') : '<p class="empty">No jobs today.</p>') + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>To collect</h2><a class="small" href="#bookings" id="seeUnpaid">See all</a></div><div class="card-b">' +
      (owing.length ? owing.sort(function (a, b) { return a.date.localeCompare(b.date); }).slice(0, 6).map(function (b) {
        var c = cust(b);
        return '<div class="lrow" style="grid-template-columns:1fr auto auto"><button class="who" data-open="' + b.id + '"><b>' + esc(c.name) + '</b><small>' + b.id + ' &middot; ' + CF.fmtDate(b.date) + ' &middot; ' + (b.method === 'cash' ? 'cash' : 'transfer') + '</small></button><span class="num"><b>' + money(owed(b)) + '</b></span><button class="b b-sm" data-pay="' + b.id + '">Mark paid</button></div>';
      }).join('') : '<p class="empty">Nothing to collect.</p>') + '</div></div></div>';

    var days = []; for (var i = 29; i >= 0; i--) days.push(CF.addDays(today, -i));
    var by = {}; payments().forEach(function (x) { by[x.p.date] = (by[x.p.date] || 0) + x.p.amt; });
    barChart($('#ch30'), days.map(function (d) { return { l: CF.fmtDate(d), v: by[d] || 0, d: d }; }), function (d) { return CF.fmtDate(d.d, true) + '<br><b>' + money(d.v) + '</b>'; });
    var go = function (e) { e.preventDefault(); ui.bk.f = 'unpaid'; location.hash = 'bookings'; if (location.hash === '#bookings') route(); };
    $('#kOwe').addEventListener('click', go); $('#seeUnpaid').addEventListener('click', go);
  };

  /* ---------- BOOKINGS ---------- */
  VIEWS.bookings = function () {
    var s = ui.bk;
    var F = {
      upcoming: function (b) { return b.date >= today && b.status !== 'cancelled' && b.status !== 'done'; },
      today: function (b) { return b.date === today; },
      unpaid: function (b) { return owed(b) > 0; },
      done: function (b) { return b.status === 'done'; },
      cancelled: function (b) { return b.status === 'cancelled'; },
      all: function () { return true; }
    };
    var labels = { upcoming: 'Upcoming', today: 'Today', unpaid: 'Unpaid', done: 'Done', cancelled: 'Cancelled', all: 'All' };
    var q = s.q.toLowerCase();
    var list = db.bookings.filter(F[s.f]).filter(function (b) {
      if (s.area && b.area !== s.area) return false;
      if (s.team && b.team !== s.team) return false;
      if (q) { var c = cust(b); return (b.id + ' ' + c.name + ' ' + c.phone + ' ' + b.address).toLowerCase().indexOf(q) > -1; }
      return true;
    });
    list.sort(function (a, b) { var k = (a.date + a.slot).localeCompare(b.date + b.slot); return s.f === 'upcoming' || s.f === 'today' ? k : -k; });
    var total = list.reduce(function (t, b) { return t + (b.status === 'cancelled' ? 0 : b.price); }, 0);
    var due = list.reduce(function (t, b) { return t + owed(b); }, 0);

    view.innerHTML = '<div class="bar"><div class="seg" role="group" aria-label="Show">' + Object.keys(F).map(function (k) {
      return '<button aria-pressed="' + (s.f === k) + '" data-f="' + k + '">' + labels[k] + '<span>' + db.bookings.filter(F[k]).length + '</span></button>';
    }).join('') + '</div>' +
      '<select class="sel" id="fArea" aria-label="Area"><option value="">All areas</option>' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (s.area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>' +
      '<select class="sel" id="fTeam" aria-label="Team"><option value="">All teams</option>' + D.teams.map(function (t) { return '<option value="' + t.id + '"' + (s.team === t.id ? ' selected' : '') + '>' + t.name + '</option>'; }).join('') + '</select>' +
      '<input class="sel" id="fQ" placeholder="Filter this list" value="' + esc(s.q) + '" style="width:180px" aria-label="Filter bookings"><span class="grow"></span>' +
      '<span class="muted small">' + list.length + ' bookings &middot; ' + money(total) + (due ? ' &middot; <b style="color:var(--bad)">' + money(due) + ' unpaid</b>' : '') + '</span></div>' +
      '<div class="card tw"><table class="rt rt-bk"><thead><tr><th>Booking</th><th>When</th><th>Customer</th><th>Service</th><th class="hide-m">Area</th><th class="hide-m">Team</th><th class="r">Total</th><th>Payment</th><th>Status</th></tr></thead><tbody>' +
      (list.length ? list.slice(0, s.n).map(function (b) {
        var c = cust(b), t = CF.team(b.team);
        return '<tr class="click" tabindex="0" data-open="' + b.id + '"><td><b>' + b.id + '</b><small class="src">' + ({ web: 'Website', phone: 'Phone', whatsapp: 'WhatsApp', walkin: 'Walk-in' }[b.source] || b.source) + '</small></td>' +
          '<td>' + CF.fmtDate(b.date, true) + '<small>' + b.slot + '</small></td><td><b>' + esc(c.name) + '</b><small>' + c.phone + '</small></td>' +
          '<td>' + esc(CF.service(b.service).name) + '<small>' + esc(CF.option(b.service, b.option).name) + '</small></td><td class="hide-m">' + esc(CF.area(b.area).name) + '</td>' +
          '<td class="hide-m">' + (t ? t.name : '<span class="muted">None</span>') + '</td><td class="r"><b>' + money(b.price) + '</b></td><td>' + payPill(b) + '</td><td>' + pill(b.status) + '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="empty" style="text-align:center">No bookings match.</td></tr>') +
      '</tbody></table>' + (list.length > s.n ? '<div class="more"><button class="b" id="more">Show ' + Math.min(40, list.length - s.n) + ' more</button></div>' : '') + '</div>';

    $$('.seg button', view).forEach(function (b) { b.addEventListener('click', function () { s.f = b.dataset.f; s.n = 40; VIEWS.bookings(); }); });
    $('#fArea').addEventListener('change', function () { s.area = this.value; VIEWS.bookings(); });
    $('#fTeam').addEventListener('change', function () { s.team = this.value; VIEWS.bookings(); });
    var fq = $('#fQ'); fq.addEventListener('input', function () { s.q = this.value; clearTimeout(fq._t); fq._t = setTimeout(function () { VIEWS.bookings(); var n = $('#fQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    var m = $('#more'); if (m) m.addEventListener('click', function () { s.n += 40; VIEWS.bookings(); });
  };

  /* ---------- CUSTOMERS ---------- */
  function custStats(c) {
    var bs = CF.bookingsOf(c.id, db), spent = 0, owe = 0, jobs = 0, last = '', next = '';
    bs.forEach(function (b) {
      spent += CF.paid(b); owe += owed(b);
      if (b.status === 'done') { jobs++; if (b.date > last) last = b.date; }
      if (b.date >= today && b.status !== 'cancelled' && b.status !== 'done' && (!next || b.date < next)) next = b.date;
    });
    return { bs: bs, spent: spent, owe: owe, jobs: jobs, last: last, next: next };
  }
  VIEWS.customers = function () {
    var s = ui.cu, q = s.q.toLowerCase();
    var rows = db.customers.map(function (c) { return { c: c, st: custStats(c) }; }).filter(function (r) {
      if (s.area && r.c.area !== s.area) return false;
      return !q || (r.c.name + ' ' + r.c.phone + ' ' + r.c.address).toLowerCase().indexOf(q) > -1;
    });
    var sorts = { last: function (a, b) { return (b.st.last || '').localeCompare(a.st.last || ''); }, spent: function (a, b) { return b.st.spent - a.st.spent; }, owe: function (a, b) { return b.st.owe - a.st.owe; }, name: function (a, b) { return a.c.name.localeCompare(b.c.name); }, newest: function (a, b) { return b.c.since.localeCompare(a.c.since); } };
    rows.sort(sorts[s.sort]);
    if (s.sort === 'owe') rows = rows.filter(function (r) { return r.st.owe > 0; });
    var repeat = db.customers.filter(function (c) { return custStats(c).jobs > 1; }).length;
    view.innerHTML = '<div class="bar"><input class="sel" id="cQ" placeholder="Name, phone or address" value="' + esc(s.q) + '" style="width:240px" aria-label="Find a customer">' +
      '<select class="sel" id="cSort" aria-label="Sort"><option value="last">Last visit</option><option value="spent">Most spent</option><option value="owe">Owes money</option><option value="newest">Newest</option><option value="name">Name A to Z</option></select>' +
      '<select class="sel" id="cArea" aria-label="Area"><option value="">All areas</option>' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (s.area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select>' +
      '<span class="grow"></span><span class="muted small">' + rows.length + ' customers &middot; ' + repeat + ' came back more than once</span><button class="b" id="addCust">Add customer</button></div>' +
      '<div class="card tw"><table class="rt rt-cu"><thead><tr><th>Customer</th><th>Phone</th><th class="hide-m">Area</th><th class="r">Cleans</th><th class="r">Spent</th><th class="r">Owes</th><th>Last visit</th><th class="hide-m">Next</th></tr></thead><tbody>' +
      (rows.length ? rows.slice(0, s.n).map(function (r) {
        var c = r.c, st = r.st;
        return '<tr class="click" tabindex="0" data-cust="' + c.id + '"><td><b>' + esc(c.name) + '</b><small>' + (c.business ? 'Business &middot; ' : '') + 'since ' + CF.fmtDate(c.since) + '</small></td><td class="num">' + c.phone + '</td><td class="hide-m">' + esc(CF.area(c.area).name) + '</td>' +
          '<td class="r">' + st.jobs + '</td><td class="r"><b>' + money(st.spent) + '</b></td><td class="r">' + (st.owe ? '<b style="color:var(--bad)">' + money(st.owe) + '</b>' : '<span class="muted">0</span>') + '</td>' +
          '<td>' + (st.last ? CF.fmtDate(st.last) : '<span class="muted">Never</span>') + '</td><td class="hide-m">' + (st.next ? CF.fmtDate(st.next) : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="8" class="empty" style="text-align:center">No customers match.</td></tr>') +
      '</tbody></table>' + (rows.length > s.n ? '<div class="more"><button class="b" id="cMore">Show more</button></div>' : '') + '</div>';
    $('#cSort').value = s.sort;
    $('#cSort').addEventListener('change', function () { s.sort = this.value; VIEWS.customers(); });
    $('#cArea').addEventListener('change', function () { s.area = this.value; VIEWS.customers(); });
    var cq = $('#cQ'); cq.addEventListener('input', function () { s.q = this.value; clearTimeout(cq._t); cq._t = setTimeout(function () { VIEWS.customers(); var n = $('#cQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 250); });
    var cm = $('#cMore'); if (cm) cm.addEventListener('click', function () { s.n += 50; VIEWS.customers(); });
    $('#addCust').addEventListener('click', function () { editCustomer(null); });
  };

  VIEWS.customer = function (id) {
    var c = CF.customer(id, db);
    if (!c) { view.innerHTML = '<p class="empty">Customer not found. <a href="#customers">Back to customers</a></p>'; return; }
    $('#title').textContent = c.name;
    var st = custStats(c), bs = st.bs.slice().sort(function (a, b) { return (b.date + b.slot).localeCompare(a.date + a.slot); });
    var valueDone = bs.filter(function (b) { return b.status === 'done'; }).reduce(function (t, b) { return t + b.price; }, 0);
    var fav = {}; bs.forEach(function (b) { if (b.status !== 'cancelled') fav[b.service] = (fav[b.service] || 0) + 1; });
    var favS = Object.keys(fav).sort(function (a, b) { return fav[b] - fav[a]; })[0];
    view.innerHTML = '<button class="back" data-go="customers">&larr; All customers</button><div class="prof">' +
      '<div class="card who"><div class="avatar">' + esc(initials(c.name)) + '</div><h2>' + esc(c.name) + '</h2><p class="muted">' + (c.business ? 'Business customer' : 'Home customer') + ' since ' + CF.fmtDate(c.since) + '</p>' +
      '<dl class="kv"><dt>Phone</dt><dd class="num">+960 ' + c.phone + '</dd><dt>Area</dt><dd>' + esc(CF.area(c.area).name) + '</dd><dt>Address</dt><dd>' + esc(c.address) + '</dd>' + (favS ? '<dt>Usually books</dt><dd>' + esc(CF.service(favS).name) + '</dd>' : '') + '</dl>' +
      '<div class="acts"><a class="b" href="tel:+960' + c.phone + '">Call</a><a class="b" href="https://wa.me/960' + c.phone + '" target="_blank" rel="noopener">WhatsApp</a><button class="b" id="editC">Edit</button><button class="b b-pri" id="bookC">New booking</button></div>' +
      '<label class="f" style="margin-top:18px"><span>Notes</span><textarea id="cNotes" placeholder="Keys, pets, preferences">' + esc(c.notes || '') + '</textarea></label></div>' +
      '<div><div class="g g4"><div class="card kpi"><span>Paid in total</span><b>' + money(st.spent) + '</b></div><div class="card kpi"><span>Cleans done</span><b>' + st.jobs + '</b></div>' +
      '<div class="card kpi"><span>Average clean</span><b>' + money(st.jobs ? valueDone / st.jobs : 0) + '</b></div><div class="card kpi"><span>Owes</span><b style="' + (st.owe ? 'color:var(--bad)' : '') + '">' + money(st.owe) + '</b></div></div>' +
      '<div class="card mt"><div class="card-h"><h2>History</h2><span class="muted small">' + bs.length + ' bookings</span></div><div class="card-b"><ul class="hist">' +
      (bs.length ? bs.map(function (b) {
        return '<li data-open="' + b.id + '" tabindex="0"><span class="dot ' + b.status + '"></span><span><b>' + esc(svcLine(b)) + '</b><small>' + CF.fmtDate(b.date, true) + ', ' + b.slot + ' &middot; ' + b.id + (b.team ? ' &middot; ' + CF.team(b.team).name : '') + '</small>' + (b.notes ? '<small>' + esc(b.notes) + '</small>' : '') + '</span>' +
          '<span class="r"><b>' + money(b.price) + '</b><br>' + (b.status === 'done' ? payPill(b) : pill(b.status)) + '</span></li>';
      }).join('') : '<li class="empty">No bookings yet.</li>') + '</ul></div></div></div></div>';
    $('#cNotes').addEventListener('change', function () { var v = this.value; act(CF.api.saveCustomer({ id: c.id, name: c.name, phone: c.phone, notes: v }), 'Notes saved', function () { }); });
    $('#editC').addEventListener('click', function () { editCustomer(c); });
    $('#bookC').addEventListener('click', function () { newBooking(c); });
    $$('.hist li[data-open]').forEach(function (li) { li.addEventListener('keydown', function (e) { if (e.key === 'Enter') li.click(); }); });
  };

  /* ---------- SALES ---------- */
  VIEWS.sales = function () {
    var ym = ui.month;
    var pays = payments(function (p) { return month(p.date) === ym; });
    var coll = pays.reduce(function (t, x) { return t + x.p.amt; }, 0);
    var jobs = db.bookings.filter(function (b) { return month(b.date) === ym && b.status === 'done'; });
    var jobVal = jobs.reduce(function (t, b) { return t + b.price; }, 0);
    var out = db.bookings.filter(function (b) { return month(b.date) === ym; }).reduce(function (t, b) { return t + owed(b); }, 0);
    var isNow0 = ym === month(today), dayCut = +today.slice(8);
    var prevColl = payments(function (p) { return month(p.date) === shiftMonth(ym, -1) && (!isNow0 || +p.date.slice(8) <= dayCut); }).reduce(function (t, x) { return t + x.p.amt; }, 0);
    var bySvc = {}, byArea = {}, byMethod = { cash: 0, transfer: 0 }, cntSvc = {};
    jobs.forEach(function (b) { bySvc[b.service] = (bySvc[b.service] || 0) + b.price; cntSvc[b.service] = (cntSvc[b.service] || 0) + 1; byArea[b.area] = (byArea[b.area] || 0) + b.price; });
    pays.forEach(function (x) { byMethod[x.p.method] = (byMethod[x.p.method] || 0) + x.p.amt; });
    var p = ym.split('-'), dim = new Date(+p[0], +p[1], 0).getDate(), byDay = {};
    pays.forEach(function (x) { byDay[x.p.date] = (byDay[x.p.date] || 0) + x.p.amt; });
    var days = []; for (var d = 1; d <= dim; d++) days.push(ym + '-' + CF.pad(d));
    var isNow = ym === month(today);

    view.innerHTML = '<div class="bar"><button class="b" id="mPrev" aria-label="Previous month">&larr;</button><h2 style="font-size:18px;min-width:170px;text-align:center">' + monthName(ym) + '</h2><button class="b" id="mNext" aria-label="Next month"' + (isNow ? ' disabled' : '') + '>&rarr;</button>' +
      '<span class="grow"></span><button class="b" id="csv">Export payments (CSV)</button><button class="b" id="prt">Print</button></div>' +
      '<div class="g g4"><div class="card kpi"><span>Money received</span><b>' + money(coll) + '</b><small class="' + (coll >= prevColl ? 'up' : 'down') + '">' + (prevColl ? (coll >= prevColl ? '+' : '') + Math.round((coll - prevColl) / prevColl * 100) + '% on ' + monthName(shiftMonth(ym, -1)).split(' ')[0] + (isNow ? ', same days' : '') : '') + '</small></div>' +
      '<div class="card kpi"><span>Cleans done</span><b>' + jobs.length + '</b><small>worth ' + money(jobVal) + '</small></div>' +
      '<div class="card kpi"><span>Average clean</span><b>' + money(jobs.length ? jobVal / jobs.length : 0) + '</b></div>' +
      '<div class="card kpi"><span>Still unpaid</span><b style="' + (out ? 'color:var(--bad)' : '') + '">' + money(out) + '</b><small>from this month&rsquo;s jobs</small></div></div>' +
      '<div class="card mt"><div class="card-h"><h2>Money received per day</h2></div><div class="card-b"><div id="chM"></div></div></div>' +
      '<div class="g g2 mt"><div class="card"><div class="card-h"><h2>By service</h2><span class="muted small">Cleans done</span></div><div class="card-b">' +
      (jobs.length ? hbars(Object.keys(bySvc).sort(function (a, b) { return bySvc[b] - bySvc[a]; }).map(function (k) { return { l: CF.service(k).name, v: bySvc[k], s: cntSvc[k] + ' cleans' }; })) : '<p class="empty">No cleans this month.</p>') + '</div></div>' +
      '<div class="card"><div class="card-h"><h2>By area</h2><span class="muted small">Cleans done</span></div><div class="card-b">' +
      (jobs.length ? hbars(D.areas.map(function (a) { return { l: a.name, v: byArea[a.id] || 0 }; }).sort(function (a, b) { return b.v - a.v; })) : '<p class="empty">No cleans this month.</p>') +
      '<h2 style="font-size:16px;margin:22px 0 12px">How customers paid</h2>' + hbars([{ l: 'Bank transfer', v: byMethod.transfer }, { l: 'Cash', v: byMethod.cash }]) + '</div></div></div>' +
      '<div class="card mt tw"><div class="card-h"><h2>Payments</h2><span class="muted small">' + pays.length + ' payments</span></div><div class="card-b" style="padding:8px 0 0"><table class="rt rt-pay"><thead><tr><th>Date</th><th>Booking</th><th>Customer</th><th class="hide-m">Service</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>' +
      (pays.length ? pays.sort(function (a, b) { return b.p.date.localeCompare(a.p.date); }).slice(0, ui.payN || 15).map(function (x) {
        var c = cust(x.b);
        return '<tr class="click" tabindex="0" data-open="' + x.b.id + '"><td>' + CF.fmtDate(x.p.date) + '</td><td>' + x.b.id + '</td><td><b>' + esc(c.name) + '</b></td><td class="hide-m">' + esc(CF.service(x.b.service).name) + '</td><td>' + (x.p.method === 'cash' ? 'Cash' : 'Transfer') + '</td><td class="r"><b>' + money(x.p.amt) + '</b></td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty" style="text-align:center">No payments this month.</td></tr>') + '</tbody></table>' + (pays.length > (ui.payN || 15) ? '<div class="more"><button class="b" id="payMore">Show all ' + pays.length + '</button></div>' : '') + '</div></div>';

    barChart($('#chM'), days.map(function (dd) { return { l: String(+dd.slice(8)), v: byDay[dd] || 0, d: dd }; }), function (x) { return CF.fmtDate(x.d, true) + '<br><b>' + money(x.v) + '</b>'; });
    $('#mPrev').addEventListener('click', function () { ui.month = shiftMonth(ym, -1); ui.payN = 0; VIEWS.sales(); });
    $('#mNext').addEventListener('click', function () { if (!isNow) { ui.month = shiftMonth(ym, 1); ui.payN = 0; VIEWS.sales(); } });
    $('#prt').addEventListener('click', function () { window.print(); });
    var pm = $('#payMore'); if (pm) pm.addEventListener('click', function () { ui.payN = 9999; VIEWS.sales(); });
    $('#csv').addEventListener('click', function () {
      var lines = [['Date', 'Booking', 'Customer', 'Phone', 'Service', 'Option', 'Area', 'Method', 'Amount MVR']];
      pays.forEach(function (x) { var c = cust(x.b); lines.push([x.p.date, x.b.id, c.name, c.phone, CF.service(x.b.service).name, CF.option(x.b.service, x.b.option).name, CF.area(x.b.area).name, x.p.method, x.p.amt]); });
      var csv = lines.map(function (r) { return r.map(function (v) { v = String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'clean-force-payments-' + ym + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      toast('CSV downloaded');
    });
  };

  /* ---------- SCHEDULE: teams down the side, the next 7 days across ---------- */
  var CREW = { A: ['Hassan', 'Mohamed', 'Shareef'], B: ['Rifaz', 'Ali', 'Naseer'], C: ['Shiyam', 'Ahmed', 'Zahir'], D: ['Nashid', 'Ibrahim', 'Waheed'] };
  VIEWS.teams = function () {
    var start = ui.wk || today, days = []; for (var i = 0; i < 7; i++) days.push(CF.addDays(start, i));
    var rows = D.teams.map(function (t) { return { id: t.id, name: t.name, sub: (CREW[t.id] || [t.lead]).join(', ') }; }).concat([{ id: '', name: 'No team yet', sub: 'Assign from the booking' }]);
    var jobs = db.bookings.filter(function (b) { return b.date >= days[0] && b.date <= days[6] && b.status !== 'cancelled'; });
    var unassigned = jobs.filter(function (b) { return !b.team; }).length;
    view.innerHTML = '<div class="bar"><button class="b" id="wPrev" aria-label="Previous week">&larr;</button><h2 style="font-size:17px;min-width:190px;text-align:center">' + CF.fmtDate(days[0]) + ' to ' + CF.fmtDate(days[6]) + '</h2><button class="b" id="wNext" aria-label="Next week">&rarr;</button>' +
      (start !== today ? '<button class="b" id="wToday">This week</button>' : '') + '<span class="grow"></span><span class="muted small">' + jobs.length + ' jobs' + (unassigned ? ' &middot; <b style="color:var(--warn)">' + unassigned + ' without a team</b>' : '') + '</span></div>' +
      '<div class="card tw"><div class="sched" style="--n:7"><div class="sh"></div>' + days.map(function (d) { return '<div class="sh' + (d === today ? ' now' : '') + '"><b>' + CF.fmtDate(d, true).split(' ')[0] + '</b> ' + CF.parse(d).getDate() + '</div>'; }).join('') +
      rows.map(function (r) {
        if (!r.id && !jobs.some(function (b) { return !b.team; })) return '';
        return '<div class="sr"><b>' + esc(r.name) + '</b><small>' + esc(r.sub) + '</small></div>' + days.map(function (d) {
          var list = jobs.filter(function (b) { return b.date === d && (b.team || '') === r.id; }).sort(function (a, b) { return a.slot.localeCompare(b.slot); });
          return '<div class="sc' + (d === today ? ' now' : '') + '">' + list.map(function (b) { var c = cust(b); return '<button class="jb s-' + b.status + '" data-open="' + b.id + '"><b>' + b.slot + '</b> ' + esc(c.name.split(' ')[0]) + '<small>' + esc(CF.service(b.service).name.split(' ')[0]) + ' &middot; ' + esc(CF.area(b.area).name.replace('Hulhumalé Phase 2', 'Phase 2')) + '</small></button>'; }).join('') + '</div>';
        }).join('');
      }).join('') + '</div></div>' +
      '<p class="muted small" style="margin-top:12px">Tap a job to change its team, time or status.</p>';
    $('#wPrev').addEventListener('click', function () { ui.wk = CF.addDays(start, -7); VIEWS.teams(); });
    $('#wNext').addEventListener('click', function () { ui.wk = CF.addDays(start, 7); VIEWS.teams(); });
    var wt = $('#wToday'); if (wt) wt.addEventListener('click', function () { ui.wk = ''; VIEWS.teams(); });
  };

  /* ---------- PRICES ---------- */
  VIEWS.prices = function () {
    view.innerHTML = '<div class="bar"><span class="muted">Change a price and save. The website and booking page use the new price straight away.</span><span class="grow"></span><button class="b" id="pReset">Back to list prices</button><button class="b b-pri" id="pSave">Save prices</button></div>' +
      '<div class="card tw"><table class="ptable"><thead><tr><th>Service</th><th>Option</th><th class="r">List price</th><th class="r">Price now (MVR)</th></tr></thead><tbody>' +
      D.services.map(function (s) {
        return s.options.map(function (o, i) {
          return '<tr><td>' + (i ? '' : '<b>' + esc(s.name) + '</b>' + (s.monthly ? '<small>per month</small>' : '')) + '</td><td>' + esc(o.name) + '</td><td class="r muted">' + money(o.price) + '</td>' +
            '<td class="r"><input type="number" min="0" step="10" data-s="' + s.id + '" data-o="' + o.id + '" value="' + CF.price(s.id, o.id, db) + '" aria-label="' + esc(s.name + ', ' + o.name) + ' price"></td></tr>';
        }).join('');
      }).join('') + '<tr><td><b>Extras</b></td><td colspan="3" class="muted">' + D.addons.map(function (a) { return esc(a.name) + ' ' + money(a.price); }).join(' &middot; ') + '</td></tr></tbody></table></div>';
    $$('.ptable input', view).forEach(function (i) { i.addEventListener('input', function () { i.classList.toggle('changed', +i.value !== CF.price(i.dataset.s, i.dataset.o, db)); }); });
    $('#pSave').addEventListener('click', function () {
      load(); var map = JSON.parse(JSON.stringify(db.prices || {}));
      $$('.ptable input', view).forEach(function (i) { if (i.value.trim() === '' || isNaN(+i.value) || +i.value <= 0) return; var v = Math.round(+i.value); var list = CF.option(i.dataset.s, i.dataset.o).price; map[i.dataset.s] = map[i.dataset.s] || {}; if (v === list) delete map[i.dataset.s][i.dataset.o]; else map[i.dataset.s][i.dataset.o] = v; });
      act(CF.api.setPrices(map), 'Prices saved. The website is updated.');
    });
    $('#pReset').addEventListener('click', function () { act(CF.api.setPrices({}), 'Prices back to the list'); });
  };

  /* ---------- drawer ---------- */
  var lastFocus = null;
  function refocus(id) { var el = view.querySelector('[data-open="' + id + '"]'); if (el) { if (!el.matches('button, a, [tabindex]')) el.tabIndex = -1; el.focus(); } }
  function openDrawer(html) {
    if (drawer.hidden || !drawer.contains(document.activeElement)) lastFocus = document.activeElement;
    drawer.innerHTML = html; drawer.hidden = false; dbg.hidden = false; document.body.style.overflow = 'hidden';
    $('.main').inert = true; $('#side').inert = true;
    var f = drawer.querySelector('input, select, textarea, button:not(.x)') || drawer.querySelector('.x'); f && f.focus();
    drawer.querySelector('.x').addEventListener('click', closeDrawer);
  }
  function closeDrawer() {
    drawer.hidden = true; dbg.hidden = true; document.body.style.overflow = ''; $('.main').inert = false; $('#side').inert = false;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); else if (drawer._id) refocus(drawer._id);
  }
  dbg.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) closeDrawer(); });

  function openBooking(id) {
    load();
    var b = CF.booking(id, db); if (!b) return;
    drawer._id = id;
    var c = cust(b), paid = CF.paid(b), due = CF.due(b);
    var base = b.price - b.addons.reduce(function (t, a) { return t + CF.addon(a).price; }, 0);
    openDrawer('<div class="dr-h"><div><h2 id="drTitle">' + b.id + ' &middot; ' + esc(CF.service(b.service).name) + '</h2><p>Booked ' + CF.fmtDate(b.created) + ' via ' + ({ web: 'website', phone: 'phone', whatsapp: 'WhatsApp', walkin: 'walk-in' }[b.source] || b.source) + '</p></div><button class="x" aria-label="Close">&times;</button></div>' +
      '<form class="dr-b" id="bf">' +
      '<div class="box" style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b style="color:var(--ink)">' + esc(c.name) + '</b><br><span class="muted small">+960 ' + c.phone + ' &middot; ' + esc(b.address) + ', ' + esc(CF.area(b.area).name) + '</span></div><div style="display:flex;gap:6px"><a class="b b-sm" href="tel:+960' + c.phone + '">Call</a><button class="b b-sm" type="button" id="toCust">Profile</button></div></div>' +
      (c.notes ? '<p class="small" style="margin:0;background:var(--warn-bg);color:var(--warn);padding:8px 10px;border-radius:8px">' + esc(c.notes) + '</p>' : '') +
      '<div><p class="sec-t">Job</p><div class="row2">' +
      '<label class="f"><span>Status</span><select name="status">' + D.statuses.map(function (s) { return '<option value="' + s.id + '"' + (s.id === b.status ? ' selected' : '') + '>' + s.name + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Team</span><select name="team"><option value="">No team yet</option>' + D.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === b.team ? ' selected' : '') + '>' + t.name + ' (' + t.lead + ')</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Date</span><input type="date" name="date" value="' + b.date + '"></label>' +
      '<label class="f"><span>Start</span><select name="slot">' + D.slots.map(function (s) { return '<option' + (s === b.slot ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="f full"><span>Service</span><input value="' + esc(svcLine(b)) + (b.addons.length ? ' + ' + esc(b.addons.map(function (a) { return CF.addon(a).name; }).join(', ')) : '') + '" disabled></label>' +
      '<label class="f full"><span>Job notes</span><textarea name="notes">' + esc(b.notes || '') + '</textarea></label></div></div>' +
      '<div><p class="sec-t">Payment</p><div class="box">' +
      '<div class="payline"><span>' + esc(svcLine(b)) + '</span><span class="num">' + money(base) + '</span></div>' +
      b.addons.map(function (a) { return '<div class="payline"><span>' + esc(CF.addon(a).name) + '</span><span class="num">' + money(CF.addon(a).price) + '</span></div>'; }).join('') +
      '<div class="payline tot"><span>Total</span><span class="num">' + money(b.price) + '</span></div>' +
      (b.payments.length ? b.payments.map(function (p) { return '<div class="payline" style="color:var(--good)"><span>Paid ' + CF.fmtDate(p.date) + ', ' + (p.method === 'cash' ? 'cash' : 'transfer') + '</span><span class="num">&minus; ' + money(p.amt) + '</span></div>'; }).join('') : '') +
      '<div class="payline tot"><span>' + (due ? 'Left to pay' : 'Fully paid') + '</span><span class="num" style="color:' + (due ? 'var(--bad)' : 'var(--good)') + '">' + money(due) + '</span></div>' +
      (b.slip ? '<p class="small muted" style="margin:8px 0 0">Customer uploaded a transfer slip.</p>' : '') + '</div>' +
      (due && b.status !== 'cancelled' ? '<div class="row2" style="margin-top:10px;align-items:end"><label class="f"><span>Amount</span><input type="number" name="amt" value="' + due + '" min="1" max="' + due + '"></label><label class="f"><span>Method</span><select name="pm"><option value="cash"' + (b.method === 'cash' ? ' selected' : '') + '>Cash</option><option value="transfer"' + (b.method === 'transfer' ? ' selected' : '') + '>Bank transfer</option></select></label>' +
        '<button class="b b-good full" type="button" id="recPay">Record payment</button></div>' : '') + '</div></form>' +
      '<div class="dr-f">' + (b.status !== 'cancelled' ? '<button class="b b-danger" id="cxl" style="margin-right:auto">Cancel booking</button>' : '') + '<button class="b" id="cls">Close</button><button class="b b-pri" id="sv">Save changes</button></div>');
    var f = $('#bf');
    $('#toCust').addEventListener('click', function () { closeDrawer(); location.hash = 'customer/' + c.id; });
    $('#cls').addEventListener('click', closeDrawer);
    var patch = function () { return { status: f.status.value, team: f.team.value, date: f.date.value || b.date, slot: f.slot.value, notes: f.notes.value }; };
    $('#sv').addEventListener('click', function () { this.disabled = true; act(CF.api.updateBooking(b.id, patch()), b.id + ' saved', function () { closeDrawer(); route(); refocus(b.id); }); });
    var rp = $('#recPay');
    if (rp) rp.addEventListener('click', function () {
      var amt = Math.min(due, Math.max(0, Math.round(+f.amt.value || 0))); if (!amt) return; rp.disabled = true;
      act(CF.api.updateBooking(b.id, patch()).then(function () { return CF.api.addPayment(b.id, { amt: amt, method: f.pm.value }); }), money(amt) + ' recorded on ' + b.id, function () { route(); openBooking(b.id); });
    });
    var cx = $('#cxl');
    if (cx) cx.addEventListener('click', function () { if (!confirm('Cancel ' + b.id + '?')) return; act(CF.api.updateBooking(b.id, { status: 'cancelled' }), b.id + ' cancelled', function () { closeDrawer(); route(); refocus(b.id); }); });
  }

  /* ---------- new booking (phone, WhatsApp, walk-in) ---------- */
  function newBooking(pre) {
    load();
    var days = []; for (var i = 0; i <= 30; i++) days.push(CF.addDays(today, i));
    openDrawer('<div class="dr-h"><div><h2 id="drTitle">New booking</h2><p>For a call, a WhatsApp message or a walk-in.</p></div><button class="x" aria-label="Close">&times;</button></div>' +
      '<form class="dr-b" id="nf" novalidate><div><p class="sec-t">Customer</p><div class="row2">' +
      '<label class="f"><span>Phone</span><input name="phone" inputmode="tel" placeholder="7xxxxxx" value="' + (pre ? pre.phone : '') + '" required></label>' +
      '<label class="f"><span>Name</span><input name="name" value="' + (pre ? esc(pre.name) : '') + '" required></label>' +
      '<div class="full" id="hit"></div>' +
      '<label class="f"><span>Area</span><select name="area">' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (pre && pre.area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Building and flat</span><input name="address" value="' + (pre ? esc(pre.address) : '') + '" placeholder="Hiya Tower 7, Flat 12-04" required></label></div></div>' +
      '<div><p class="sec-t">Job</p><div class="row2">' +
      '<label class="f"><span>Service</span><select name="service">' + D.services.map(function (s) { return '<option value="' + s.id + '">' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Size</span><select name="option"></select></label>' +
      '<label class="f"><span>Date</span><select name="date">' + days.map(function (d) { return '<option value="' + d + '">' + CF.fmtDate(d, true) + (d === today ? ' (today)' : '') + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Start</span><select name="slot">' + D.slots.map(function (s) { return '<option>' + s + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Team</span><select name="team"><option value="">Decide later</option>' + D.teams.map(function (t) { return '<option value="' + t.id + '">' + t.name + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Came in by</span><select name="source"><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="walkin">Walk-in</option></select></label>' +
      '<label class="f"><span>Payment</span><select name="method"><option value="cash">Cash after the clean</option><option value="transfer">Bank transfer</option></select></label>' +
      '<label class="f"><span>Price (MVR)</span><input type="number" name="price" min="0" step="10"></label>' +
      '<label class="f full"><span>Notes</span><textarea name="notes"></textarea></label></div></div><p class="err" id="nErr" hidden>Add a 7 digit phone, a name and the address.</p></form>' +
      '<div class="dr-f"><button class="b" id="cls">Close</button><button class="b b-pri" id="sv">Create booking</button></div>');
    var f = $('#nf');
    var opts = function () { var s = CF.service(f.service.value); f.option.innerHTML = s.options.map(function (o) { return '<option value="' + o.id + '">' + esc(o.name) + ' (' + money(CF.price(s.id, o.id, db)) + ')</option>'; }).join(''); price(); };
    var price = function () { f.price.value = CF.price(f.service.value, f.option.value, db); };
    f.service.addEventListener('change', opts); f.option.addEventListener('change', price); opts();
    var look = function () {
      var c = CF.customerByPhone(f.phone.value, db);
      if (c && CF.normPhone(f.phone.value).length === 7) {
        var st = custStats(c);
        $('#hit').innerHTML = '<p class="cust-hit">Existing customer: <b>' + esc(c.name) + '</b>, ' + st.jobs + ' cleans' + (st.owe ? ', owes ' + money(st.owe) : '') + '</p>';
        if (!f.name.value) f.name.value = c.name; if (!f.address.value) { f.address.value = c.address; f.area.value = c.area; }
      } else $('#hit').innerHTML = '';
    };
    f.phone.addEventListener('input', look); look();
    $('#cls').addEventListener('click', closeDrawer);
    $('#sv').addEventListener('click', function () {
      var ph = CF.normPhone(f.phone.value);
      if (!/^[3-9]\d{6}$/.test(ph) || !f.name.value.trim() || !f.address.value.trim()) { $('#nErr').hidden = false; return; }
      this.disabled = true;
      act(CF.api.createBooking({ byStaff: true, phone: ph, name: f.name.value.trim(), area: f.area.value, address: f.address.value.trim(), service: f.service.value, option: f.option.value, addons: [],
        price: Math.max(0, Math.round(+f.price.value || 0)), date: f.date.value, slot: f.slot.value, team: f.team.value, method: f.method.value, source: f.source.value,
        notes: f.notes.value.trim() }), null, function (b) { closeDrawer(); toast(b.id + ' created for ' + f.name.value.trim()); route(); });
    });
  }
  $('#newBtn').addEventListener('click', function () { newBooking(null); });

  function editCustomer(c) {
    openDrawer('<div class="dr-h"><div><h2 id="drTitle">' + (c ? 'Edit customer' : 'Add customer') + '</h2></div><button class="x" aria-label="Close">&times;</button></div>' +
      '<form class="dr-b" id="ef"><div class="row2"><label class="f full"><span>Name</span><input name="name" value="' + (c ? esc(c.name) : '') + '" required></label>' +
      '<label class="f"><span>Phone</span><input name="phone" inputmode="tel" value="' + (c ? c.phone : '') + '" required></label>' +
      '<label class="f"><span>Area</span><select name="area">' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (c && c.area === a.id ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f full"><span>Building and flat</span><input name="address" value="' + (c ? esc(c.address) : '') + '"></label>' +
      '<label class="f full" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" name="biz" style="width:auto;height:auto"' + (c && c.business ? ' checked' : '') + '> <span>Business customer (office, guesthouse)</span></label></div><p class="err" id="eErr" hidden></p></form>' +
      '<div class="dr-f"><button class="b" id="cls">Close</button><button class="b b-pri" id="sv">Save</button></div>');
    var f = $('#ef');
    $('#cls').addEventListener('click', closeDrawer);
    $('#sv').addEventListener('click', function () {
      var ph = CF.normPhone(f.phone.value);
      if (!f.name.value.trim() || !CF.validPhone(ph)) { $('#eErr').hidden = false; $('#eErr').textContent = 'Add a name and a 7 digit phone.'; return; }
      CF.api.saveCustomer({ id: c ? c.id : '', name: f.name.value.trim(), phone: ph, area: f.area.value, address: f.address.value.trim(), business: f.biz.checked }).then(function (x) {
        load(); toast('Customer saved'); closeDrawer(); location.hash = 'customer/' + x.id; route();
      }, function (x) { $('#eErr').hidden = false; $('#eErr').textContent = x.code === 'phone_taken' && x.other ? 'That phone belongs to ' + x.other.name + '.' : CF.problem(x); });
    });
  }

  /* ---------- global search ---------- */
  var qi = $('#q'), sr = $('#sres');
  qi.addEventListener('input', function () {
    var q = qi.value.trim().toLowerCase(); if (q.length < 2) { sr.hidden = true; return; }
    var cs = db.customers.filter(function (c) { return (c.name + ' ' + c.phone).toLowerCase().indexOf(q) > -1; }).slice(0, 6);
    var bs = db.bookings.filter(function (b) { return b.id.toLowerCase().indexOf(q) > -1; }).slice(-4).reverse();
    sr.innerHTML = cs.map(function (c) { return '<button data-c="' + c.id + '"><span><b>' + esc(c.name) + '</b><br><small>' + c.phone + ' &middot; ' + esc(CF.area(c.area).name) + '</small></span><small>Customer</small></button>'; }).join('') +
      bs.map(function (b) { return '<button data-b="' + b.id + '"><span><b>' + b.id + '</b><br><small>' + esc(cust(b).name) + ' &middot; ' + CF.fmtDate(b.date) + '</small></span><small>Booking</small></button>'; }).join('') +
      (cs.length + bs.length ? '' : '<p class="none">Nothing found.</p>');
    sr.hidden = false;
  });
  sr.addEventListener('click', function (e) {
    var t = e.target.closest('button'); if (!t) return;
    sr.hidden = true; qi.value = '';
    if (t.dataset.c) location.hash = 'customer/' + t.dataset.c; else openBooking(t.dataset.b);
  });
  qi.addEventListener('keydown', function (e) { if (e.key === 'ArrowDown') { var f = sr.querySelector('button'); f && f.focus(); e.preventDefault(); } if (e.key === 'Escape') { sr.hidden = true; } });
  sr.addEventListener('keydown', function (e) {
    var bs = $$('button', sr), i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' && bs[i + 1]) { bs[i + 1].focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { (bs[i - 1] || qi).focus(); e.preventDefault(); }
    if (e.key === 'Escape') { sr.hidden = true; qi.focus(); }
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.search')) sr.hidden = true; });

  CF.ready('staff').then(start, function () { $('#login').hidden = false; $('#loginErr').textContent = 'Could not reach the database. Check the connection.'; $('#loginErr').hidden = false; });
})();
