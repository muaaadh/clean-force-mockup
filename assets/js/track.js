/* Clean Force: track a booking with its number and the phone it was booked with. */
(function () {
  var CF = window.CF, D = window.CF_DATA, $ = CF.$, esc = CF.esc;
  var f = $('#trkForm'), out = $('#trkOut'), er = $('#trkErr');
  var STEPS = ['booked', 'confirmed', 'onway', 'cleaning', 'done'];
  var LABEL = { booked: 'Booked', confirmed: 'Confirmed', onway: 'Team on the way', cleaning: 'Cleaning', done: 'Done' };

  function show(r) {
    var b = r.booking, s = CF.service(b.service), o = CF.option(b.service, b.option), t = CF.team(b.team);
    var idx = STEPS.indexOf(b.status), cancelled = b.status === 'cancelled', due = CF.due(b);
    var prog = cancelled ? '<p class="badge cancelled" style="margin-top:16px">Cancelled</p>' :
      '<ol class="prog">' + STEPS.map(function (st, i) { return '<li class="' + (i < idx ? 'ok' : i === idx ? 'now' : '') + '">' + LABEL[st] + (i === idx && st === 'booked' ? ' <span class="muted" style="font-weight:400">&middot; we will confirm soon</span>' : '') + '</li>'; }).join('') + '</ol>';
    out.innerHTML = '<div class="tcard">' +
      '<div class="card"><p class="muted" style="font-size:14px">' + b.id + ' &middot; ' + esc(r.customer.name.split(' ')[0]) + '</p><h2 style="font-size:clamp(28px,3vw,40px);letter-spacing:-.04em;margin-top:6px">' + CF.relDay(b.date) + ', ' + b.slot + '</h2>' + prog + '</div>' +
      '<div class="card"><dl class="kv"><dt>Clean</dt><dd>' + esc(s.name) + ', ' + esc(o.name.toLowerCase()) + '</dd><dt>Where</dt><dd>' + esc(b.address) + ', ' + esc(CF.area(b.area).name) + '</dd>' +
      (!cancelled ? '<dt>Team</dt><dd>' + (t ? t.name + ', led by ' + t.lead : 'Set the day before') + '</dd>' : '') +
      '<dt>Total</dt><dd><b>' + CF.money(b.price) + '</b> ' + (cancelled ? '' : due ? '<span class="badge ' + (b.status === 'done' ? 'due' : '') + '">' + (b.method === 'cash' ? 'Cash after the clean' : 'Bank transfer') + '</span>' : '<span class="badge paid">Paid</span>') + '</dd></dl>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px">' + CF.btn('My bookings', 'account.html', 'btn-sm') + '<a class="btn btn-line btn-sm plain" href="https://wa.me/' + D.phoneIntl + '?text=' + encodeURIComponent('Hi Clean Force, about booking ' + b.id) + '" target="_blank" rel="noopener">WhatsApp us</a></div></div>' +
      '</div>' + (b.status === 'done' ? '<div class="card" style="margin-top:16px"><h3 style="margin-bottom:14px">Your before and after</h3><div id="trkBa" style="max-width:820px"></div></div>' : '');
    if (b.status === 'done') { var pp = CF.photoPair(b.service, b.id); CF.mountBA($('#trkBa'), 'assets/img/' + pp.before, 'assets/img/' + pp.after, s.name); }
  }
  function lookup(id, phone) {
    er.hidden = true;
    return CF.api.track(id, phone).then(function (r) {
      if (!r) { out.innerHTML = ''; er.textContent = 'No booking with that number and phone. Check both and try again.'; er.hidden = false; return; }
      show(r);
    }, function (e) { er.textContent = CF.problem(e); er.hidden = false; });
  }
  CF.ready('public').then(function () {
    f.addEventListener('submit', function (e) { e.preventDefault(); lookup(f.elements.namedItem('id').value, f.elements.namedItem('phone').value); });
    var q = new URLSearchParams(location.search);
    if (q.get('id')) { f.elements.namedItem('id').value = q.get('id'); f.elements.namedItem('phone').value = q.get('phone') || ''; if (q.get('phone')) lookup(q.get('id'), q.get('phone')); }
    if (CF.isDemo()) {
      var db = CF.db(), c = CF.customerByPhone('7771234', db);
      var up = c && CF.bookingsOf(c.id, db).filter(function (b) { return b.date >= CF.today() && b.status !== 'cancelled'; })[0];
      if (up) { var h = $('#trkHint'); h.innerHTML = 'Demo: try <b>' + up.id + '</b> with <b>7771234</b>.'; h.hidden = false; }
    }
  });
})();
