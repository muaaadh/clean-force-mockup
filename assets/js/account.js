/* Clean Force: customer portal. One page: next visit, what you owe, book again, history. */
(function () {
  var CF = window.CF, D = window.CF_DATA, $ = CF.$, $$ = CF.$$, esc = CF.esc;
  var root = $('#acct'), dlg = $('#dlg');
  var STEPS = ['booked', 'confirmed', 'onway', 'cleaning', 'done'];
  var phoneNow = '', open = {};

  function fmtPhone(p) { return '+960 ' + p.slice(0, 3) + ' ' + p.slice(3); }
  function err(el, msg) { el.textContent = msg; el.hidden = !msg; }

  /* ---------- sign in ---------- */
  function signIn(msg) {
    var last = ''; try { last = (JSON.parse(localStorage.getItem('cleanforce.me') || 'null') || {}).phone || ''; } catch (e) { }
    root.innerHTML = '<div class="auth"><h1>My bookings</h1><p class="lead">Sign in with the phone you booked with.</p>' +
      '<form class="card" id="f1" novalidate><label class="field"><span>Phone</span><span class="tel-in"><b>+960</b><input class="inp" name="phone" inputmode="tel" autocomplete="tel-national" placeholder="7xxxxxx" value="' + esc(last) + '" required></span></label>' +
      '<p class="err" id="e1" role="alert"' + (msg ? '' : ' hidden') + '>' + (msg || '') + '</p><button class="btn" type="submit" style="justify-self:start">Send me a code <span class="ic">' + CF.icon.arr + '</span></button>' +
      (CF.isDemo() ? '<p class="hint">Demo: use <b>7771234</b> to see a customer with history.</p>' : '') + '</form></div>';
    var f = $('#f1');
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!CF.validPhone(f.phone.value)) return err($('#e1'), 'Enter a 7 digit Maldives number.');
      var ph = CF.normPhone(f.phone.value), btn = f.querySelector('.btn'); btn.disabled = true;
      CF.auth.sendCode(ph).then(function () { code(ph); }, function (x) {
        btn.disabled = false;
        if (x.code === 'no_customer') { $('#e1').innerHTML = 'No bookings on this number yet. <a href="book.html">Book a clean</a>'; $('#e1').hidden = false; }
        else err($('#e1'), CF.problem(x));
      });
    });
  }
  function code(ph) {
    var len = CF.isDemo() ? 4 : 6;
    root.innerHTML = '<div class="auth"><h1>Enter the code</h1><p class="lead">We sent it to ' + fmtPhone(ph) + '.</p>' +
      '<form class="card" id="f2" novalidate><label class="field"><span>Code</span><input class="inp code-in" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="' + len + '" required></label>' +
      '<p class="err" id="e2" role="alert" hidden></p><button class="btn" type="submit" style="justify-self:start">Sign in <span class="ic">' + CF.icon.arr + '</span></button>' +
      (CF.isDemo() ? '<p class="hint">Demo code: <b>1234</b></p>' : '') + '<button class="addnote" type="button" id="chg" style="justify-self:start">Use another number</button></form></div>';
    var f = $('#f2'); f.code.focus();
    $('#chg').addEventListener('click', function () { signIn(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = f.querySelector('.btn'); btn.disabled = true;
      CF.auth.verifyCode(ph, f.code.value).then(function (c) { phoneNow = ph; return CF.ready('customer').then(function () { render(c); }); }, function (x) { btn.disabled = false; err($('#e2'), CF.problem(x)); f.code.select(); });
    });
  }

  /* ---------- signed in ---------- */
  function render(c) {
    c = c || CF.auth.me();
    if (!c) {
      if (phoneNow) { // signed in, but no bookings on this phone yet (live database)
        root.innerHTML = '<div class="auth"><h1>Nothing here yet.</h1><p class="lead">No bookings on ' + fmtPhone(phoneNow) + '. Book a clean and it will show up here.</p><div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap">' + CF.btn('Book a clean', 'book.html') + '<button class="btn btn-line plain" id="out">Sign out</button></div></div>';
        $('#out').addEventListener('click', out); return;
      }
      return signIn();
    }
    var db = CF.db(), today = CF.today();
    var mine = CF.bookingsOf(c.id, db).sort(function (a, b) { return (b.date + b.slot).localeCompare(a.date + a.slot); });
    var next = mine.filter(function (b) { return b.date >= today && b.status !== 'done' && b.status !== 'cancelled'; }).reverse()[0];
    var owe = mine.reduce(function (t, b) { return t + (b.status === 'done' || b.date < today ? CF.due(b) : 0); }, 0);
    var last = mine.filter(function (b) { return b.status === 'done'; })[0] || mine.filter(function (b) { return b.status !== 'cancelled'; })[0];
    var paid = mine.reduce(function (t, b) { return t + CF.paid(b); }, 0), doneN = mine.filter(function (b) { return b.status === 'done'; }).length;

    var h = '<div class="me-top"><div><p class="muted" style="font-size:15px">' + fmtPhone(c.phone) + '</p><h1>Hi ' + esc(c.name.split(' ')[0]) + '.</h1></div>' +
      '<div class="acts">' + CF.btn('Book a clean', 'book.html') + '<button class="btn btn-line plain" id="out">Sign out</button></div></div><div class="me-grid">';

    if (next) {
      var sv = CF.service(next.service), op = CF.option(next.service, next.option), t = CF.team(next.team), idx = STEPS.indexOf(next.status);
      h += '<div class="visit"><div class="ph"><img src="' + sv.img + '" alt=""></div><div class="bd"><small>Next visit &middot; ' + next.id + '</small>' +
        '<h2 tabindex="-1" id="nextH">' + CF.relDay(next.date) + ', ' + next.slot + '</h2>' +
        '<p>' + esc(sv.name) + ', ' + esc(op.name.toLowerCase()) + ' &middot; ' + esc(next.address) + '</p>' +
        '<p>' + (t ? t.name + ', led by ' + t.lead : 'Team set the day before') + ' &middot; ' + CF.money(next.price) + ', ' + (next.method === 'cash' ? 'cash after' : 'transfer') + '</p>' +
        '<div class="dots5" aria-hidden="true">' + STEPS.map(function (s, i) { return '<i class="' + (i <= idx ? 'ok' : '') + '"></i>'; }).join('') + '</div><span class="dots5-l">' + CF.statusName(next.status) + '</span>' +
        '<div class="acts">' + (CF.changeable(next) ? '<button class="btn btn-white btn-sm plain" data-act="move" data-id="' + next.id + '">Change time</button><button class="btn btn-ghost btn-sm plain" data-act="cancel" data-id="' + next.id + '">Cancel</button>' : '') +
        '<a class="btn btn-ghost btn-sm plain" href="track.html?id=' + next.id + '&phone=' + c.phone + '">Track</a></div>' +
        (CF.changeable(next) ? '' : '<p class="note">To change a visit on the day, call ' + D.phone + '.</p>') + '</div></div>';
    } else {
      h += '<div class="visit"><div class="ph"><img src="assets/img/living-after.jpg" alt=""></div><div class="bd"><small>Next visit</small><h2 tabindex="-1" id="nextH">Nothing booked.</h2><p>Pick a day and we send the team.</p><div class="acts">' + CF.btn('Book a clean', 'book.html', 'btn-white btn-sm') + '</div></div></div>';
    }

    h += '<div class="side-cards">';
    if (owe) h += '<div class="owe"><span>To pay: ' + CF.money(owe) + '<small>Cash to the team or a bank transfer.</small></span><a class="btn btn-sm plain" style="--b:var(--bad)" href="https://wa.me/' + D.phoneIntl + '?text=' + encodeURIComponent('Hi Clean Force, I want to pay ' + CF.money(owe) + '.') + '" target="_blank" rel="noopener">Pay by transfer</a></div>';
    if (last) {
      var ls = CF.service(last.service), lo = CF.option(last.service, last.option);
      h += '<div class="card again"><h3>Book again</h3><div class="row"><img src="' + ls.img + '" alt=""><span><b>' + esc(ls.name) + '</b><small>' + esc(lo.name) + (last.addons.length ? ' + ' + last.addons.length + ' extra' : '') + ' &middot; ' + CF.money(CF.quote(last.service, last.option, last.addons)) + '</small></span></div>' +
        CF.btn('Pick a day', 'book.html?service=' + last.service + '&option=' + last.option + (last.addons.length ? '&addons=' + last.addons.join(',') : '') + '&area=' + last.area, 'btn-sm') + '</div>';
    }
    h += '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h3>Your details</h3><button class="addnote" data-act="edit">Edit</button></div><dl class="kv" style="margin-top:12px"><dt>Name</dt><dd>' + esc(c.name) + '</dd><dt>Area</dt><dd>' + esc(CF.area(c.area).name) + '</dd><dt>Address</dt><dd>' + esc(c.address) + '</dd></dl></div>';
    h += '</div></div>';

    h += '<div class="hist-h"><h2>History</h2><span class="muted">' + doneN + ' clean' + (doneN === 1 ? '' : 's') + ' &middot; ' + CF.money(paid) + ' paid</span></div>';
    h += mine.length ? mine.map(function (b) {
      var s = CF.service(b.service), o = CF.option(b.service, b.option), due = CF.due(b);
      var badge = b.status === 'done' ? (due ? '<span class="badge due">To pay</span>' : '<span class="badge paid">Paid</span>') : '<span class="badge ' + b.status + '">' + CF.statusName(b.status) + '</span>';
      return '<div class="hrow"><button aria-expanded="' + !!open[b.id] + '" data-act="row" data-id="' + b.id + '"><span class="d">' + CF.fmtDate(b.date) + '<small>' + b.slot + '</small></span>' +
        '<span class="s"><b>' + esc(s.name) + '</b><small>' + esc(o.name) + ' &middot; ' + b.id + '</small></span><span class="bdg">' + badge + '</span><span class="m">' + CF.money(b.price) + '</span>' + CF.icon.chev + '</button>' +
        '<div class="exp" id="x' + b.id + '"' + (open[b.id] ? '' : ' hidden') + '></div></div>';
    }).join('') : '<p class="empty">No bookings yet.</p>';
    root.innerHTML = h;
    $('#out').addEventListener('click', out);
    Object.keys(open).forEach(function (id) { if (open[id]) fillRow(id); });
  }
  function out() { CF.auth.signOut().then(function () { phoneNow = ''; open = {}; signIn(); }); }

  function fillRow(id) {
    var b = CF.booking(id), el = $('#x' + id); if (!b || !el) return;
    var s = CF.service(b.service), o = CF.option(b.service, b.option), t = CF.team(b.team);
    el.innerHTML = (b.status === 'done' ? '<div class="baHost"></div>' : '') +
      '<div><dl class="kv"><dt>Clean</dt><dd>' + esc(s.name) + ', ' + esc(o.name.toLowerCase()) + (b.addons.length ? ' + ' + esc(b.addons.map(function (a) { return CF.addon(a).name.toLowerCase(); }).join(', ')) : '') + '</dd>' +
      '<dt>Where</dt><dd>' + esc(b.address) + '</dd>' + (t && b.status !== 'cancelled' ? '<dt>Team</dt><dd>' + t.name + ', ' + t.lead + '</dd>' : '') +
      '<dt>Paid</dt><dd>' + CF.money(CF.paid(b)) + (CF.due(b) && b.status !== 'cancelled' ? ' of ' + CF.money(b.price) : '') + '</dd></dl>' +
      '<div class="acts">' + (CF.paid(b) ? '<button class="btn btn-line btn-sm plain" data-act="receipt" data-id="' + b.id + '">Receipt</button>' : '') +
      CF.btn('Book again', 'book.html?service=' + b.service + '&option=' + b.option + (b.addons.length ? '&addons=' + b.addons.join(',') : '') + '&area=' + b.area, 'btn-sm') + '</div></div>';
    if (b.status === 'done') { var pp = CF.photoPair(b.service, b.id); CF.mountBA($('.baHost', el), 'assets/img/' + pp.before, 'assets/img/' + pp.after, s.name); }
  }

  /* ---------- actions ---------- */
  function focusNext() { var h = $('#nextH'); if (h) h.focus(); }
  function dialog(html) { dlg.innerHTML = html; dlg.showModal(); var x = dlg.querySelector('[data-close]'); if (x) x.onclick = function () { dlg.close(); }; }
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var act = el.dataset.act, b = el.dataset.id && CF.booking(el.dataset.id), c = CF.auth.me();
    if (act === 'row') {
      var x = $('#x' + b.id), show = x.hidden; x.hidden = !show; el.setAttribute('aria-expanded', show); open[b.id] = show;
      if (show && !x.firstChild) fillRow(b.id);
    }
    if (act === 'cancel') {
      dialog('<div class="in-d"><h2>Cancel this visit?</h2><p class="muted">' + CF.relDay(b.date) + ', ' + b.slot + ' &middot; ' + b.id + '. Free up to a day before.</p><p class="err" id="dErr" hidden></p></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm plain" data-close>Keep it</button><button class="btn btn-navy btn-sm plain" id="dYes">Cancel visit</button></div>');
      $('#dYes').onclick = function () { this.disabled = true; CF.api.cancelMine(b.id).then(function () { dlg.close(); render(); focusNext(); }, function (x) { err($('#dErr'), CF.problem(x)); }); };
    }
    if (act === 'move') {
      var days = []; for (var i = 1; i <= 14; i++) days.push(CF.addDays(CF.today(), i));
      if (days.indexOf(b.date) < 0) { days.push(b.date); days.sort(); }
      dialog('<form><div class="in-d"><h2>Change time</h2><p class="muted" style="margin-bottom:18px">Now ' + CF.relDay(b.date) + ', ' + b.slot + '</p>' +
        '<div class="grid2"><label class="field"><span>Day</span><select class="inp" name="day">' + days.map(function (d) { return '<option value="' + d + '"' + (d === b.date ? ' selected' : '') + '>' + CF.relDay(d) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Start</span><select class="inp" name="slot"></select></label></div><p class="err" id="dErr" hidden style="margin-top:12px"></p></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm plain" type="button" data-close>Close</button><button class="btn btn-sm plain" type="submit" id="dYes">Save</button></div></form>');
      var f = dlg.querySelector('form');
      var slots = function () {
        var keep = f.slot.value || b.slot;
        f.slot.innerHTML = D.slots.map(function (s) { var why = CF.slotProblem(f.day.value, s, b.id); return '<option value="' + s + '"' + (why ? ' disabled' : '') + (s === keep && !why ? ' selected' : '') + '>' + s + (why === 'full' ? ' (full)' : why === 'friday' ? ' (Friday prayer)' : '') + '</option>'; }).join('');
        if (f.slot.selectedOptions[0] && f.slot.selectedOptions[0].disabled) { var ok = Array.prototype.filter.call(f.slot.options, function (o) { return !o.disabled; })[0]; if (ok) f.slot.value = ok.value; }
      };
      f.day.addEventListener('change', slots); slots();
      f.onsubmit = function (ev) {
        ev.preventDefault();
        if (f.day.value === b.date && f.slot.value === b.slot) { dlg.close(); return; }
        $('#dYes').disabled = true;
        CF.api.moveMine(b.id, f.day.value, f.slot.value).then(function () { dlg.close(); render(); focusNext(); }, function (x) { $('#dYes').disabled = false; err($('#dErr'), CF.problem(x)); });
      };
    }
    if (act === 'receipt') {
      var s = CF.service(b.service), o = CF.option(b.service, b.option), base = b.price - b.addons.reduce(function (t, a) { return t + CF.addon(a).price; }, 0);
      dialog('<div class="in-d"><img src="assets/brand/logo-light-full.svg" alt="Clean Force" style="height:64px;margin-bottom:18px"><h2>Receipt ' + b.id + '</h2>' +
        '<p class="muted">' + esc(c.name) + ' &middot; ' + esc(b.address) + ' &middot; ' + CF.fmtDate(b.date) + '</p>' +
        '<dl style="display:grid;grid-template-columns:1fr auto;gap:8px;margin:18px 0 0;font-size:15px"><dt>' + esc(s.name) + ', ' + esc(o.name.toLowerCase()) + '</dt><dd style="margin:0">' + CF.money(base) + '</dd>' +
        b.addons.map(function (a) { return '<dt>' + esc(CF.addon(a).name) + '</dt><dd style="margin:0">' + CF.money(CF.addon(a).price) + '</dd>'; }).join('') +
        b.payments.map(function (p) { return '<dt style="border-top:1px solid var(--line);padding-top:8px;font-weight:600">Paid ' + CF.fmtDate(p.date) + ', ' + (p.method === 'cash' ? 'cash' : 'transfer') + '</dt><dd style="margin:0;border-top:1px solid var(--line);padding-top:8px;font-weight:700">' + CF.money(p.amt) + '</dd>'; }).join('') + '</dl></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm plain" data-close>Close</button><button class="btn btn-sm plain" id="dPrint">Print</button></div>');
      $('#dPrint').onclick = function () { window.print(); };
    }
    if (act === 'edit') {
      dialog('<form><div class="in-d"><h2>Your details</h2><div style="display:grid;gap:14px;margin-top:14px">' +
        '<label class="field"><span>Name</span><input class="inp" name="name" value="' + esc(c.name) + '" required></label>' +
        '<label class="field"><span>Area</span><select class="inp" name="area">' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (a.id === c.area ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Building and flat</span><input class="inp" name="address" value="' + esc(c.address) + '" required></label></div><p class="err" id="dErr" hidden style="margin-top:12px"></p></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm plain" type="button" data-close>Close</button><button class="btn btn-sm plain" type="submit">Save</button></div></form>');
      var ef = dlg.querySelector('form');
      ef.onsubmit = function (ev) {
        ev.preventDefault();
        if (!ef.name.value.trim() || !ef.address.value.trim()) return err($('#dErr'), 'Add your name and address.');
        CF.api.saveMyDetails({ name: ef.name.value.trim(), area: ef.area.value, address: ef.address.value.trim() }).then(function () { dlg.close(); render(); }, function (x) { err($('#dErr'), CF.problem(x)); });
      };
    }
  });

  CF.ready('customer').then(function () {
    CF.onChange(function () { var a = document.activeElement; if (!dlg.open && !(a && a.matches('input, textarea, select') && root.contains(a))) render(); });
    CF.auth.me() ? render() : signIn();
  }, function () { root.innerHTML = '<div class="auth"><h1>My bookings</h1><p class="lead">We could not load your bookings. Call or WhatsApp ' + D.phone + '.</p></div>'; });
})();
