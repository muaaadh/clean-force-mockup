/* Clean Force: track a booking */
(function () {
  var CF = window.CF, D = window.CF_DATA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var f = $('#trkForm'), fid = f.elements.namedItem('id'), fph = f.elements.namedItem('phone'), out = $('#trkOut'), err = $('#trkErr');
  var q = new URLSearchParams(location.search);
  var FLOW = ['booked', 'confirmed', 'onway', 'cleaning', 'done'];
  var NOTE = { booked: 'We got your booking.', confirmed: 'Team and time are set.', onway: 'The team is heading to you.', cleaning: 'Cleaning in progress.', done: 'All done. Thank you.' };

  function show(id, phone) {
    var db = CF.db(), b = CF.booking(id, db);
    var c = b && CF.customer(b.customerId, db);
    if (!b || !c || c.phone !== CF.normPhone(phone)) {
      out.innerHTML = ''; err.hidden = false;
      err.textContent = 'We could not find that booking. Check the number and the phone you booked with, or call 7800016.';
      return;
    }
    err.hidden = true;
    var s = CF.service(b.service), o = CF.option(b.service, b.option), t = CF.team(b.team);
    var at = FLOW.indexOf(b.status), due = CF.due(b);
    var tl = b.status === 'cancelled' ? '<li class="ok"><b>Cancelled</b><small>This booking was cancelled.</small></li>' :
      FLOW.map(function (st, k) {
        return '<li class="' + (k <= at ? 'ok' : '') + (k === at && st !== 'done' ? ' now' : '') + '"><b>' + CF.statusName(st) + '</b>' + (k === at ? '<small>' + NOTE[st] + '</small>' : '') + '</li>';
      }).join('');
    out.innerHTML = '<div class="trk-card">' +
      '<div class="trk-top"><div><p style="color:var(--muted);font-size:14px">' + b.id + '</p><h2>' + CF.esc(s.name) + ', ' + CF.esc(o.name) + '</h2>' +
      '<p style="color:var(--muted);margin-top:6px">' + CF.fmtDate(b.date, true) + ' at ' + b.slot + ' &middot; ' + CF.esc(b.address) + ', ' + CF.esc(CF.area(b.area).name) + '</p></div>' +
      '<span class="badge ' + b.status + '">' + CF.statusName(b.status) + '</span></div>' +
      '<ol class="tl">' + tl + '</ol>' +
      '<div class="grid2" style="margin-top:6px;font-size:15px">' +
      (b.status === 'cancelled' ? '<div></div>' : '<div><span style="color:var(--muted)">Team</span><br><b>' + (t ? t.name + ', led by ' + t.lead : 'Assigned the day before') + '</b></div>') +
      '<div><span style="color:var(--muted)">Payment</span><br><b>' + CF.money(b.price) + '</b> ' + (b.status === 'cancelled' ? '' : due ? '<span class="badge unpaid">' + (b.method === 'cash' ? 'Cash on the day' : 'Transfer due') + '</span>' : '<span class="badge paid">Paid</span>') + '</div></div>' +
      (b.status === 'done' ? '<div class="ba-mini"><p style="font-weight:600;color:var(--ink);margin-bottom:10px">Your before and after</p><div id="trkBA"></div></div>' : '') +
      '<div class="row" style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap"><a class="btn btn-sm" href="https://wa.me/' + D.phoneIntl + '?text=' + encodeURIComponent('Hi, about booking ' + b.id) + '" target="_blank" rel="noopener">Message us</a>' +
      '<a class="btn btn-line btn-sm" href="account.html">All my bookings</a>' +
      (b.status === 'done' ? '<a class="btn btn-line btn-sm" href="book.html?service=' + b.service + '&option=' + b.option + '&area=' + b.area + '">Book again</a>' : '') + '</div></div>';
    if (b.status === 'done') { var pp = CF.photoPair(b.service, b.id); CF.mountBA($('#trkBA'), 'assets/img/' + pp.before, 'assets/img/' + pp.after, s.name); }
  }
  f.addEventListener('submit', function (e) { e.preventDefault(); show(fid.value, fph.value); history.replaceState(null, '', '?id=' + encodeURIComponent(fid.value.trim()) + '&phone=' + encodeURIComponent(CF.normPhone(fph.value))); });
  if (q.get('id')) { fid.value = q.get('id'); fph.value = q.get('phone') || ''; show(q.get('id'), q.get('phone')); }
  else {
    // demo hint: show a real booking the visitor can try
    var db = CF.db(), me = CF.customerByPhone('7771234', db);
    var b = me && CF.bookingsOf(me.id, db).filter(function (x) { return x.date >= CF.today() && x.status !== 'done' && x.status !== 'cancelled'; })[0];
    if (b) { var p = document.createElement('p'); p.className = 'lead'; p.style.fontSize = '14px'; p.innerHTML = 'Demo: try <b>' + b.id + '</b> with phone <b>7771234</b>.'; f.after(p); }
  }
})();
