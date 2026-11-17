/* Clean Force demo backend. Everything lives in this browser's localStorage so the
   website, customer portal and admin share one set of data with no server.
   A real build would swap these functions for API calls. */
(function () {
  var D = window.CF_DATA;
  var KEY = 'cleanforce.demo.v3';
  var mem = null; // fallback when storage is blocked

  function read() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return mem; }
  }
  function write(db) {
    mem = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode: keep in memory */ }
  }

  /* ---------- dates ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /* the business runs on Maldives time (UTC+5), whatever the visitor's device says */
  function mvNow() { var d = new Date(); return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 5 * 3600000); }
  function todayIso() { return iso(mvNow()); }
  function addDays(isoStr, n) { var d = parse(isoStr); d.setDate(d.getDate() + n); return iso(d); }
  function parse(isoStr) { var p = isoStr.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(isoStr, withDay) {
    if (!isoStr) return '';
    var d = parse(isoStr);
    return (withDay ? DAY[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function money(n) { return (Math.round(n) || 0).toLocaleString('en-US') + ' MVR'; }

  /* ---------- seeded demo data ---------- */
  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }; }

  var FIRST_F = ['Aishath', 'Fathimath', 'Mariyam', 'Aminath', 'Hawwa', 'Khadheeja', 'Shifa', 'Nasha', 'Zoona', 'Liusha', 'Shaheema', 'Raufa'];
  var FIRST_M = ['Mohamed', 'Ahmed', 'Ibrahim', 'Hussain', 'Ali', 'Hassan', 'Abdulla', 'Ismail', 'Yoosuf', 'Moosa', 'Shiyam', 'Naseem'];
  var LAST = ['Rasheed', 'Naseer', 'Shareef', 'Waheed', 'Zahir', 'Faisal', 'Latheef', 'Manik', 'Saeed', 'Areef', 'Nashid', 'Didi', 'Hameed', 'Rifau'];
  var BIZ = ['Sea Breeze Inn', 'Coral Point Office', 'Lagoon Suites Guesthouse', 'Boduthakurufaanu Clinic', 'Islandia Travel', 'Ocean Reef Apartments'];

  function address(area, r) {
    var n = function (a, b) { return a + Math.floor(r() * (b - a + 1)); };
    switch (area) {
      case 'hulhumale2': return 'Hiya Tower ' + n(1, 16) + ', Flat ' + pad(n(2, 25)) + '-' + pad(n(1, 8));
      case 'hulhumale': return r() < .5 ? 'Lot ' + n(10050, 11990) + ', ' + ['Nirolhu Magu', 'Kaani Magu', 'Huvandhumaa Hingun', 'Dhoshimeyna Goalhi'][n(0, 3)] : 'Fahi Dhiriulhun, Block ' + n(1, 12) + ', Flat ' + n(101, 1204);
      case 'vilimale': return 'Vilimalé, ' + ['Rehendhi', 'Saima', 'Mariyam Villa', 'Fehi Villa', 'Ujaalaa'] [n(0, 4)] + ' ' + n(1, 9) + 'F';
      default: return ['H. ', 'M. ', 'Ma. ', 'G. '][n(0, 3)] + ['Sea View', 'Javaahiru Villa', 'Fenfiyaz', 'Thaazaa', 'Kanmathee', 'Dhonveli', 'Maagiri', 'Anbaree'][n(0, 7)] + ', ' + n(2, 9) + 'th floor';
    }
  }

  function seed() {
    var r = rng(78016);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var today = todayIso();
    var customers = [];
    var areaW = ['hulhumale2', 'hulhumale2', 'hulhumale2', 'hulhumale', 'hulhumale', 'male', 'male', 'vilimale'];
    for (var i = 0; i < 62; i++) {
      var isBiz = i % 13 === 7;
      var female = r() < .55;
      var area = pick(areaW);
      customers.push({
        id: 'C' + (100 + i),
        name: isBiz ? BIZ[(i / 13 | 0) % BIZ.length] : (female ? pick(FIRST_F) : pick(FIRST_M)) + ' ' + pick(LAST),
        phone: String(pick([7, 9])) + String(Math.floor(100000 + r() * 899999)),
        area: area,
        address: address(area, r),
        business: isBiz,
        since: addDays(today, -Math.floor(20 + r() * 260)),
        notes: ''
      });
    }
    // a demo customer the portal can sign in as
    customers[0].name = 'Aishath Shifa'; customers[0].phone = '7771234'; customers[0].area = 'hulhumale2'; customers[0].address = 'Hiya Tower 7, Flat 12-04';
    customers[0].notes = 'Has a cat. Keys with the guard if not home.';

    var bookings = [];
    var weights = { home: 5, deep: 3, move: 1, sofa: 2, bath: 2, monthly: 1, office: 1 };
    var svcBag = [];
    D.services.forEach(function (s) { for (var k = 0; k < weights[s.id]; k++) svcBag.push(s); });

    function make(c, date, forceStatus) {
      var s = c.business ? D.services.filter(function (x) { return x.id === 'office' || x.id === 'deep'; })[r() < .7 ? 0 : 1] : pick(svcBag);
      var o = pick(s.options);
      var adds = [];
      if (!c.business && r() < .3) adds.push(pick(D.addons).id);
      var price = o.price + adds.reduce(function (t, a) { return t + D.addons.filter(function (x) { return x.id === a; })[0].price; }, 0);
      var past = date < today, isToday = date === today;
      var slot = pick(D.slots); if (parse(date).getDay() === 5 && slot < '13:30') slot = r() < .5 ? '13:30' : '16:00';
      var hourNow = mvNow().getHours() + mvNow().getMinutes() / 60, slotH = +slot.slice(0, 2) + +slot.slice(3) / 60;
      var todaySt = slotH + 3 <= hourNow ? 'done' : slotH <= hourNow ? 'cleaning' : slotH - 1 <= hourNow ? 'onway' : 'confirmed';
      var status = forceStatus || (past ? (r() < .06 ? 'cancelled' : 'done') : isToday ? todaySt : (r() < .7 ? 'confirmed' : 'booked'));
      var method = r() < .55 ? 'transfer' : 'cash';
      var payments = [];
      var old = date < addDays(today, -21);
      if (status === 'done' && r() > (old ? .015 : isToday ? .4 : .14)) payments.push({ amt: price, date: method === 'transfer' && !isToday && r() < .4 ? addDays(date, 1) > today ? date : addDays(date, 1) : date, method: method });
      return {
        id: '', customerId: c.id, service: s.id, option: o.id, addons: adds, price: price,
        date: date, slot: slot, area: c.area, address: c.address,
        status: status, team: status === 'cancelled' ? '' : pick(D.teams).id,
        method: method, payments: payments, source: pick(['web', 'web', 'web', 'phone', 'whatsapp']),
        created: addDays(date, -Math.floor(1 + r() * 6)), notes: ''
      };
    }

    // ~150 days of history, heavier recently (the business is growing)
    for (var d = -150; d <= 12; d++) {
      var date = addDays(today, d);
      var dow = parse(date).getDay();
      var base = d < -100 ? 1.2 : d < -50 ? 2 : 2.8;
      if (dow === 5) base *= .45; // Friday
      var n = Math.max(0, Math.round(base + (r() - .5) * 2.4));
      if (d > 0) n = Math.max(0, Math.round(n * (1 - d / 16)));
      var pool = customers.slice(0, Math.min(customers.length, Math.round(26 + (d + 150) / 155 * 36)));
      for (var j = 0; j < n; j++) bookings.push(make(pick(pool), date));
    }
    // demo customer: a clear history
    var me = customers[0];
    [-96, -64, -35, -8].forEach(function (off) { bookings.push(make(me, addDays(today, off), 'done')); });
    var up = make(me, addDays(today, 3), 'confirmed'); up.service = 'deep'; up.option = '2br'; up.price = 1100; up.addons = []; bookings.push(up);

    bookings.sort(function (a, b) { return (a.date + a.slot).localeCompare(b.date + b.slot); });
    // a customer exists from a few days before their first booking
    var first = {};
    bookings.forEach(function (b) { if (!first[b.customerId]) first[b.customerId] = b.created; });
    customers.forEach(function (c) { if (first[c.id]) c.since = addDays(first[c.id], -Math.floor(r() * 3)); });
    bookings.forEach(function (b, k) { b.id = 'CF-' + (1001 + k); });
    // the demo customer's past jobs show before / after photos
    bookings.forEach(function (b) { if (b.customerId === me.id && b.status === 'done') b.payments = [{ amt: b.price, date: b.date, method: 'transfer' }]; });

    return { v: 1, created: today, customers: customers, bookings: bookings, prices: {}, nextCustomer: 100 + customers.length, nextBooking: 1001 + bookings.length, log: [] };
  }

  /* ---------- public API ---------- */
  var CF = window.CF = window.CF || {};
  CF.db = function () {
    var db = read();
    if (!db || db.v !== 1) { db = seed(); write(db); return db; }
    var t = todayIso();
    if (db.created !== t) { // demo data moves forward with the calendar so "today" always has jobs
      var n = Math.round((parse(t) - parse(db.created)) / 86400000);
      if (n) {
        db.bookings.forEach(function (b) { b.date = addDays(b.date, n); b.created = addDays(b.created, n); (b.payments || []).forEach(function (p) { p.date = addDays(p.date, n); }); });
        db.customers.forEach(function (c) { c.since = addDays(c.since, n); });
      }
      db.created = t; write(db);
    }
    return db;
  };
  CF.save = function (db) { write(db); };
  CF.reset = function () { var db = seed(); write(db); return db; };
  CF.iso = iso; CF.today = todayIso; CF.mvNow = mvNow; CF.addDays = addDays; CF.parse = parse; CF.fmtDate = fmtDate; CF.money = money; CF.pad = pad;

  CF.service = function (id) { return D.services.filter(function (s) { return s.id === id; })[0]; };
  CF.option = function (sid, oid) { var s = CF.service(sid); return s && s.options.filter(function (o) { return o.id === oid; })[0]; };
  CF.addon = function (id) { return D.addons.filter(function (a) { return a.id === id; })[0]; };
  CF.area = function (id) { return D.areas.filter(function (a) { return a.id === id; })[0] || { name: id }; };
  CF.team = function (id) { return D.teams.filter(function (t) { return t.id === id; })[0]; };
  CF.statusName = function (id) { var s = D.statuses.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; };

  /* prices can be edited in the admin; the site reads them through here */
  CF.price = function (sid, oid, db) {
    db = db || CF.db();
    var p = db.prices && db.prices[sid] && db.prices[sid][oid];
    if (p != null) return p;
    var o = CF.option(sid, oid); return o ? o.price : 0;
  };
  CF.fromPrice = function (sid, db) {
    var s = CF.service(sid); db = db || CF.db();
    return Math.min.apply(null, s.options.map(function (o) { return CF.price(sid, o.id, db); }));
  };

  CF.normPhone = function (p) { return String(p || '').replace(/\D/g, '').replace(/^960/, '').slice(-7); };
  CF.customerByPhone = function (phone, db) {
    db = db || CF.db(); var p = CF.normPhone(phone);
    return db.customers.filter(function (c) { return c.phone === p; })[0];
  };
  CF.customer = function (id, db) { db = db || CF.db(); return db.customers.filter(function (c) { return c.id === id; })[0]; };
  CF.booking = function (id, db) { db = db || CF.db(); id = String(id || '').toUpperCase().trim(); if (/^\d+$/.test(id)) id = 'CF-' + id; return db.bookings.filter(function (b) { return b.id === id; })[0]; };
  CF.paid = function (b) { return (b.payments || []).reduce(function (t, p) { return t + p.amt; }, 0); };
  CF.due = function (b) { return b.status === 'cancelled' ? 0 : Math.max(0, b.price - CF.paid(b)); };
  CF.bookingsOf = function (cid, db) { db = db || CF.db(); return db.bookings.filter(function (b) { return b.customerId === cid; }); };

  /* creates (or finds) the customer by phone and adds a booking; returns the booking */
  CF.addBooking = function (input) {
    var db = CF.db();
    var c = CF.customerByPhone(input.phone, db);
    if (!c) {
      c = { id: 'C' + (db.nextCustomer++), name: input.name, phone: CF.normPhone(input.phone), area: input.area, address: input.address, business: !!input.business, since: todayIso(), notes: '' };
      db.customers.push(c);
    } else {
      if (input.name) c.name = input.name;
      if (input.address) { c.address = input.address; c.area = input.area; }
    }
    var b = {
      id: 'CF-' + (db.nextBooking++), customerId: c.id, service: input.service, option: input.option, addons: input.addons || [],
      price: input.price, date: input.date, slot: input.slot, area: input.area, address: input.address,
      status: input.status || 'booked', team: input.team || '', method: input.method || 'cash', payments: [],
      source: input.source || 'web', created: todayIso(), notes: input.notes || '', slip: !!input.slip
    };
    db.bookings.push(b);
    CF.save(db);
    return b;
  };

  CF.slotsTaken = function (date, db) {
    db = db || CF.db(); var count = {};
    db.bookings.forEach(function (b) { if (b.date === date && b.status !== 'cancelled') count[b.slot] = (count[b.slot] || 0) + 1; });
    return count; // a slot is full at 4 jobs (one per team)
  };

  CF.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };

  /* before / after photo pair that matches a service, used in the portals */
  CF.photoPair = function (sid, id) {
    var map = { home: 'living', deep: 'kitchen', move: 'bedroom', sofa: 'sofa', bath: 'bathroom', monthly: 'living', office: 'living' };
    var k = map[sid] || 'living';
    if (sid === 'deep' && id && +id.slice(-1) % 2) k = 'bathroom';
    return { before: 'ba/' + k + '-before.jpg', after: 'ba/' + k + '-after.jpg' };
  };

  /* reload other open tabs when the data changes (e.g. a booking made on the site shows up in the admin) */
  CF.onChange = function (fn) { window.addEventListener('storage', function (e) { if (e.key === KEY) fn(); }); };
})();
