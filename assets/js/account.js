/* Clean Force: customer portal (demo sign in by phone + code) */
(function () {
  var CF = window.CF, D = window.CF_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = $('#acct'), dlg = $('#dlg');
  var SKEY = 'cleanforce.session';
  var tab = 'bookings';

  function session() { try { return JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { return null; } }
  function setSession(v) { try { v ? localStorage.setItem(SKEY, JSON.stringify(v)) : localStorage.removeItem(SKEY); } catch (e) { } }

  /* ---------- sign in ---------- */
  function signIn() {
    var last = ''; try { last = (JSON.parse(localStorage.getItem('cleanforce.me') || 'null') || {}).phone || ''; } catch (e) { }
    root.innerHTML = '<div class="auth"><h1>My bookings</h1><p class="lead" style="font-size:16px">Sign in with the phone you booked with.</p>' +
      '<form id="f1"><label class="field"><span>Phone</span><span class="tel-in"><b>+960</b><input class="inp" name="phone" inputmode="tel" autocomplete="tel-national" placeholder="7xxxxxx" value="' + CF.esc(last) + '" required></span></label>' +
      '<p class="err" id="e1" hidden></p><button class="btn" type="submit">Send code</button>' +
      '<p class="hint">Demo: use <b>7771234</b> to see a customer with history, or any number you booked with.</p></form></div>';
    $('#f1').addEventListener('submit', function (e) {
      e.preventDefault();
      var ph = CF.normPhone(this.phone.value);
      if (!/^[3-9]\d{6}$/.test(ph)) { $('#e1').hidden = false; $('#e1').textContent = 'Enter a 7 digit Maldives number.'; return; }
      var c = CF.customerByPhone(ph);
      if (!c) { $('#e1').hidden = false; $('#e1').innerHTML = 'No bookings on this number yet. <a href="book.html">Book a clean</a>'; return; }
      code(ph);
    });
  }
  function code(ph) {
    root.innerHTML = '<div class="auth"><h1>Enter the code</h1><p class="lead" style="font-size:16px">We sent a 4 digit code to +960 ' + ph.slice(0, 3) + ' ' + ph.slice(3) + '.</p>' +
      '<form id="f2"><label class="field"><span>Code</span><input class="inp" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="4" required style="font-size:24px;letter-spacing:.4em;text-align:center"></label>' +
      '<p class="err" id="e2" hidden>That code is not right.</p><button class="btn" type="submit">Sign in</button>' +
      '<p class="hint">Demo code: <b>1234</b></p><button class="link" type="button" id="chg" style="border:0;background:none;cursor:pointer">Use another number</button></form></div>';
    var f = $('#f2'); f.code.focus();
    $('#chg').addEventListener('click', signIn);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      if (f.code.value.trim() !== '1234') { $('#e2').hidden = false; return; }
      setSession({ phone: ph }); render();
    });
  }

  function focusNext() { var h = $('.next-visit h2'); if (h) { h.tabIndex = -1; h.focus(); } }
  function changeable(b) { return b.date > CF.today() && (b.status === 'booked' || b.status === 'confirmed'); }
  function slotOk(date, slot, selfId) {
    var d = CF.db(), taken = 0;
    d.bookings.forEach(function (x) { if (x.id !== selfId && x.date === date && x.slot === slot && x.status !== 'cancelled') taken++; });
    if (CF.parse(date).getDay() === 5 && slot < '13:30') return 'Friday visits start at 13:30.';
    if (taken >= D.teams.length) return 'That time is full. Pick another.';
    return '';
  }

  /* ---------- signed in ---------- */
  function render() {
    var s = session(), db = CF.db();
    var c = s && CF.customerByPhone(s.phone, db);
    if (!c) { setSession(null); return signIn(); }
    var mine = CF.bookingsOf(c.id, db).sort(function (a, b) { return (b.date + b.slot).localeCompare(a.date + a.slot); });
    var today = CF.today();
    var upcoming = mine.filter(function (b) { return b.date >= today && b.status !== 'done' && b.status !== 'cancelled'; }).reverse();
    var next = upcoming[0];
    var first = c.name.split(' ')[0];

    var html = '<div class="me-top"><div><p class="crumb" style="margin:0 0 8px">' + CF.esc(c.name) + ' &middot; +960 ' + c.phone + '</p><h1>Hi ' + CF.esc(first) + '.</h1></div>' +
      '<div class="acts"><a class="btn" href="book.html">Book a clean</a><button class="btn btn-line" id="out">Sign out</button></div></div>';

    if (next) {
      var sv = CF.service(next.service), op = CF.option(next.service, next.option), t = CF.team(next.team);
      html += '<div class="next-visit"><div class="ph"><img src="' + sv.img + '" alt=""></div><div class="bd">' +
        '<small>Next visit &middot; ' + next.id + '</small><h2>' + CF.fmtDate(next.date, true) + ', ' + next.slot + '</h2>' +
        '<p>' + CF.esc(sv.name) + ', ' + CF.esc(op.name) + ' &middot; ' + CF.esc(next.address) + '</p>' +
        '<p>' + (t ? t.name + ', led by ' + t.lead : 'Team assigned the day before') + ' &middot; ' + CF.money(next.price) + ' ' + (next.method === 'cash' ? 'cash on the day' : 'by transfer') + '</p>' +
        '<span class="badge ' + next.status + '">' + CF.statusName(next.status) + '</span>' +
        '<div class="acts">' + (changeable(next) ? '<button class="btn btn-white btn-sm" data-act="move" data-id="' + next.id + '">Change date</button>' : '') +
        '<a class="btn btn-ghost on-dark btn-sm" href="track.html?id=' + next.id + '&phone=' + c.phone + '">Track</a>' +
        (changeable(next) ? '<button class="btn btn-ghost on-dark btn-sm" data-act="cancel" data-id="' + next.id + '">Cancel</button>' : '') + '</div>' +
        (changeable(next) ? '' : '<p style="font-size:14px;opacity:.75;margin-top:4px">To change a visit on the day, call 7800016.</p>') + '</div></div>';
    } else {
      html += '<div class="next-visit"><div class="ph"><img src="assets/img/living-after.jpg" alt=""></div><div class="bd"><small>Next visit</small><h2>Nothing booked yet.</h2><p>Pick a day and we will send the team.</p><div class="acts"><a class="btn btn-white btn-sm" href="book.html">Book a clean</a></div></div></div>';
    }

    html += '<div class="ptabs" role="tablist"><button class="ptab" role="tab" data-tab="bookings" aria-selected="' + (tab === 'bookings') + '">Bookings</button>' +
      '<button class="ptab" role="tab" data-tab="payments" aria-selected="' + (tab === 'payments') + '">Payments</button>' +
      '<button class="ptab" role="tab" data-tab="profile" aria-selected="' + (tab === 'profile') + '">Details</button></div><div id="tabBody"></div>';
    root.innerHTML = html;

    var body = $('#tabBody');
    if (tab === 'bookings') {
      body.innerHTML = mine.length ? '<div class="rows">' + mine.map(function (b) {
        var sv = CF.service(b.service), op = CF.option(b.service, b.option);
        return '<div class="prow"><span class="d">' + CF.fmtDate(b.date) + '<small>' + b.slot + ' &middot; ' + b.id + '</small></span>' +
          '<span class="s"><b>' + CF.esc(sv.name) + '</b><small>' + CF.esc(op.name) + ' &middot; ' + CF.esc(CF.area(b.area).name) + '</small></span>' +
          '<span class="m">' + CF.money(b.price) + '<br><span class="badge ' + b.status + '" style="margin-top:4px">' + CF.statusName(b.status) + '</span></span>' +
          '<span class="a">' + (b.status === 'done' ? '<button class="mini-btn" data-act="photos" data-id="' + b.id + '" aria-expanded="false">Before / after</button>' : '') +
          '<a class="mini-btn" href="book.html?service=' + b.service + '&option=' + b.option + '&area=' + b.area + '">Book again</a></span>' +
          '<div class="exp" hidden></div></div>';
      }).join('') + '</div>' : '<p class="empty">No bookings yet.</p>';
    } else if (tab === 'payments') {
      var paid = 0, due = 0, n = 0;
      mine.forEach(function (b) { paid += CF.paid(b); if (b.date < today || b.status === 'done') due += CF.due(b); if (b.status === 'done') n++; });
      var pays = [];
      mine.forEach(function (b) { (b.payments || []).forEach(function (p) { pays.push({ b: b, p: p }); }); });
      body.innerHTML = '<div class="stat3"><div><span>Paid so far</span><b>' + CF.money(paid) + '</b></div><div><span>To pay</span><b>' + CF.money(due) + '</b></div><div><span>Cleans done</span><b>' + n + '</b></div></div>' +
        (pays.length ? '<div class="rows">' + pays.map(function (x) {
          return '<div class="prow"><span class="d">' + CF.fmtDate(x.p.date) + '<small>' + x.b.id + '</small></span><span class="s"><b>' + CF.esc(CF.service(x.b.service).name) + '</b><small>' + (x.p.method === 'cash' ? 'Cash' : 'Bank transfer') + '</small></span>' +
            '<span class="m">' + CF.money(x.p.amt) + '</span><span class="a"><button class="mini-btn" data-act="receipt" data-id="' + x.b.id + '">Receipt</button></span></div>';
        }).join('') + '</div>' : '<p class="empty">No payments yet.</p>');
    } else {
      body.innerHTML = '<form id="pf" class="grid2" style="max-width:720px">' +
        '<label class="field"><span>Name</span><input class="inp" name="name" value="' + CF.esc(c.name) + '" required></label>' +
        '<label class="field"><span>Phone</span><input class="inp" value="+960 ' + c.phone + '" disabled></label>' +
        '<label class="field"><span>Area</span><select class="inp" name="area">' + D.areas.map(function (a) { return '<option value="' + a.id + '"' + (a.id === c.area ? ' selected' : '') + '>' + CF.esc(a.name) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Building and flat</span><input class="inp" name="address" value="' + CF.esc(c.address) + '" required></label>' +
        '<div class="full" style="display:flex;gap:12px;align-items:center"><button class="btn" type="submit">Save</button><span id="saved" style="color:var(--muted)" aria-live="polite"></span></div></form>';
      $('#pf').addEventListener('submit', function (e) {
        e.preventDefault(); var d2 = CF.db(), cc = CF.customer(c.id, d2);
        cc.name = this.name.value.trim() || cc.name; cc.area = this.area.value; cc.address = this.address.value.trim() || cc.address;
        CF.save(d2); $('#saved').textContent = 'Saved.';
      });
    }
    $('#out').addEventListener('click', function () { setSession(null); signIn(); });
    $$('.ptab').forEach(function (b) { b.addEventListener('click', function () { tab = b.dataset.tab; render(); var t = $('.ptab[data-tab="' + tab + '"]'); t && t.focus(); }); });
  }

  /* ---------- actions ---------- */
  root.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var db = CF.db(), b = CF.booking(el.dataset.id, db);
    if (!b) return;
    var act = el.dataset.act;
    if (act === 'photos') {
      var exp = el.closest('.prow').querySelector('.exp'), open = exp.hidden;
      exp.hidden = !open; el.setAttribute('aria-expanded', open);
      if (open && !exp.firstChild) { var pp = CF.photoPair(b.service, b.id); CF.mountBA(exp, 'assets/img/' + pp.before, 'assets/img/' + pp.after, CF.service(b.service).name); exp.style.maxWidth = '720px'; }
    }
    if (act === 'cancel') {
      dlg.innerHTML = '<div class="in-d"><h2>Cancel ' + b.id + '?</h2><p style="color:var(--muted)">' + CF.fmtDate(b.date, true) + ', ' + b.slot + '. Free up to a day before.</p></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm" value="no" id="dNo">Keep it</button><button class="btn btn-navy btn-sm" id="dYes">Cancel booking</button></div>';
      dlg.showModal();
      $('#dNo').onclick = function () { dlg.close(); };
      $('#dYes').onclick = function () { var d = CF.db(), x = CF.booking(b.id, d); if (changeable(x)) { x.status = 'cancelled'; x.team = ''; x.notes = (x.notes ? x.notes + ' ' : '') + 'Cancelled by customer online.'; CF.save(d); } dlg.close(); render(); focusNext(); };
    }
    if (act === 'move') {
      var days = []; for (var i = 1; i <= 14; i++) days.push(CF.addDays(CF.today(), i));
      if (days.indexOf(b.date) < 0) { days.push(b.date); days.sort(); }
      dlg.innerHTML = '<form method="dialog"><div class="in-d"><h2>Change date</h2><p style="color:var(--muted);margin-bottom:16px">' + b.id + ' &middot; now ' + CF.fmtDate(b.date, true) + ', ' + b.slot + '</p>' +
        '<div class="grid2"><label class="field"><span>Day</span><select class="inp" name="day">' + days.map(function (d) { return '<option value="' + d + '"' + (d === b.date ? ' selected' : '') + '>' + CF.fmtDate(d, true) + '</option>'; }).join('') + '</select></label>' +
        '<label class="field"><span>Start time</span><select class="inp" name="slot">' + D.slots.map(function (s) { return '<option' + (s === b.slot ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></label></div></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm" type="button" id="dNo">Close</button><button class="btn btn-sm" type="submit" id="dYes">Save new time</button></div></form>';
      dlg.showModal();
      $('#dNo').onclick = function () { dlg.close(); };
      dlg.querySelector('form').onsubmit = function (ev) {
        ev.preventDefault(); var f = this;
        var why = slotOk(f.day.value, f.slot.value, b.id);
        var er = dlg.querySelector('.err') || dlg.querySelector('.in-d').appendChild(Object.assign(document.createElement('p'), { className: 'err' }));
        if (why) { er.textContent = why; return; }
        var d = CF.db(), x = CF.booking(b.id, d);
        if (changeable(x)) { var moved = x.date !== f.day.value || x.slot !== f.slot.value; x.date = f.day.value; x.slot = f.slot.value; if (moved) x.status = 'booked'; CF.save(d); }
        dlg.close(); render(); focusNext();
      };
    }
    if (act === 'receipt') {
      var c = CF.customer(b.customerId, db), sv = CF.service(b.service), op = CF.option(b.service, b.option);
      dlg.innerHTML = '<div class="in-d"><img src="assets/brand/logo-light-full.svg" alt="Clean Force" style="width:150px;margin-bottom:18px"><h2>Receipt ' + b.id + '</h2>' +
        '<p style="color:var(--muted)">' + CF.esc(c.name) + ' &middot; ' + CF.esc(b.address) + '</p>' +
        '<dl style="display:grid;grid-template-columns:1fr auto;gap:8px;margin:18px 0 0;font-size:15px"><dt>' + CF.esc(sv.name) + ', ' + CF.esc(op.name) + '</dt><dd style="margin:0">' + CF.money(b.price - b.addons.reduce(function (t, a) { return t + CF.addon(a).price; }, 0)) + '</dd>' +
        b.addons.map(function (a) { return '<dt>' + CF.esc(CF.addon(a).name) + '</dt><dd style="margin:0">' + CF.money(CF.addon(a).price) + '</dd>'; }).join('') +
        '<dt style="border-top:1px solid var(--line);padding-top:8px;font-weight:600;color:var(--ink)">Paid ' + CF.fmtDate((b.payments[0] || {}).date) + '</dt><dd style="margin:0;border-top:1px solid var(--line);padding-top:8px;font-weight:700">' + CF.money(CF.paid(b)) + '</dd></dl></div>' +
        '<div class="foot"><button class="btn btn-line btn-sm" id="dNo">Close</button><button class="btn btn-sm" id="dPrint">Print</button></div>';
      dlg.showModal(); $('#dNo').onclick = function () { dlg.close(); }; $('#dPrint').onclick = function () { window.print(); };
    }
  });

  CF.onChange(function () { var a = document.activeElement; if (session() && !dlg.open && !(a && a.matches('input, textarea, select') && root.contains(a))) render(); });
  session() ? render() : signIn();
})();
