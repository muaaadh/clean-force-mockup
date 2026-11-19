/* Clean Force data layer.

   Pages never touch storage directly. They:
     1. wait for   CF.ready(scope)        scope: 'public' | 'book' | 'customer' | 'staff'
     2. read from  CF.db()                a synchronous snapshot { customers, bookings, prices, slotCounts? }
     3. change data only through CF.api.* and CF.auth.*  (all return Promises)
     4. redraw on  CF.onChange(fn)

   Two drivers implement the same contract:
     local     (this file)                   demo data in this browser's localStorage, seeded around today
     supabase  (assets/js/store-supabase.js) the live database, loaded when CF_CONFIG.backend = 'supabase'

   Errors reject with an Error whose .code is one of:
     no_customer, bad_code, bad_login, phone_taken, not_changeable, friday, full, past, invalid, not_found, network */
(function () {
  var D = window.CF_DATA;
  var CONF = window.CF_CONFIG || { backend: 'local' };
  var CF = window.CF = window.CF || {};
  var SCRIPT_BASE = (function () { var s = document.currentScript && document.currentScript.src; return s ? s.replace(/[^/]*$/, '') : 'assets/js/'; })();

  /* ---------- dates, money, text ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  /* the business runs on Maldives time (UTC+5), whatever the visitor's device says */
  function mvNow() { var d = new Date(); return new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 5 * 3600000); }
  function todayIso() { return iso(mvNow()); }
  function parse(isoStr) { var p = isoStr.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(isoStr, n) { var d = parse(isoStr); d.setDate(d.getDate() + n); return iso(d); }
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function fmtDate(isoStr, withDay) {
    if (!isoStr) return '';
    var d = parse(isoStr);
    return (withDay ? DAY[d.getDay()] + ' ' : '') + d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== mvNow().getFullYear() ? ' ' + d.getFullYear() : '');
  }
  function relDay(isoStr) {
    var t = todayIso();
    if (isoStr === t) return 'Today';
    if (isoStr === addDays(t, 1)) return 'Tomorrow';
    if (isoStr === addDays(t, -1)) return 'Yesterday';
    return fmtDate(isoStr, true);
  }
  function money(n) { return (Math.round(n) || 0).toLocaleString('en-US') + ' MVR'; }
  function err(code, msg) { var e = new Error(msg || code); e.code = code; return e; }

  CF.iso = iso; CF.today = todayIso; CF.mvNow = mvNow; CF.addDays = addDays; CF.parse = parse;
  CF.fmtDate = fmtDate; CF.relDay = relDay; CF.money = money; CF.pad = pad; CF.err = err;
  CF.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]; }); };

  /* ---------- catalogue lookups (names and images live in data.js) ---------- */
  CF.service = function (id) { return D.services.filter(function (s) { return s.id === id; })[0]; };
  CF.option = function (sid, oid) { var s = CF.service(sid); return s && s.options.filter(function (o) { return o.id === oid; })[0]; };
  CF.addon = function (id) { return D.addons.filter(function (a) { return a.id === id; })[0] || { id: id, name: id, price: 0 }; };
  CF.area = function (id) { return D.areas.filter(function (a) { return a.id === id; })[0] || { id: id, name: id }; };
  CF.team = function (id) { return D.teams.filter(function (t) { return t.id === id; })[0]; };
  CF.statusName = function (id) { var s = D.statuses.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; };
  CF.normPhone = function (p) { return String(p || '').replace(/\D/g, '').replace(/^960(?=\d{7}$)/, '').slice(-7); };
  CF.validPhone = function (p) { return /^[3-9]\d{6}$/.test(CF.normPhone(p)); };

  /* ---------- reads over the snapshot ---------- */
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
  CF.quote = function (sid, oid, addons, db) {
    db = db || CF.db();
    return CF.price(sid, oid, db) + (addons || []).reduce(function (t, a) { return t + CF.addon(a).price; }, 0);
  };
  CF.customerByPhone = function (phone, db) { db = db || CF.db(); var p = CF.normPhone(phone); return db.customers.filter(function (c) { return c.phone === p; })[0]; };
  CF.customer = function (id, db) { db = db || CF.db(); return db.customers.filter(function (c) { return c.id === id; })[0]; };
  CF.normId = function (id) { id = String(id || '').toUpperCase().replace(/\s/g, ''); if (/^\d+$/.test(id)) id = 'CF-' + id; if (/^CF\d+$/.test(id)) id = 'CF-' + id.slice(2); return id; };
  CF.booking = function (id, db) { db = db || CF.db(); id = CF.normId(id); return db.bookings.filter(function (b) { return b.id === id; })[0]; };
  CF.paid = function (b) { return (b.payments || []).reduce(function (t, p) { return t + p.amt; }, 0); };
  CF.due = function (b) { return b.status === 'cancelled' ? 0 : Math.max(0, b.price - CF.paid(b)); };
  CF.bookingsOf = function (cid, db) { db = db || CF.db(); return db.bookings.filter(function (b) { return b.customerId === cid; }); };
  CF.changeable = function (b) { return b.date > todayIso() && (b.status === 'booked' || b.status === 'confirmed'); };

  /* slot capacity is one job per team; Friday visits start after prayer.
     The staff and local snapshots hold every booking; the public snapshot only holds counts (slotCounts). */
  CF.slotsTaken = function (date, db, selfId) {
    db = db || CF.db();
    var count = {};
    if (db.slotCounts) {
      var sc = db.slotCounts[date] || {}, own = selfId ? CF.booking(selfId, db) : null;
      for (var k in sc) count[k] = sc[k] - (own && own.date === date && own.slot === k && own.status !== 'cancelled' ? 1 : 0);
      return count;
    }
    db.bookings.forEach(function (b) { if (b.id !== selfId && b.date === date && b.status !== 'cancelled') count[b.slot] = (count[b.slot] || 0) + 1; });
    return count;
  };
  CF.isFriday = function (date) { return parse(date).getDay() === 5; };
  CF.slotProblem = function (date, slot, selfId, db) {
    if (CF.isFriday(date) && slot < D.fridayFrom) return 'friday';
    if ((CF.slotsTaken(date, db, selfId)[slot] || 0) >= D.teams.length) return 'full';
    return '';
  };
  CF.problemText = {
    friday: 'Friday visits start at ' + D.fridayFrom + '.', full: 'That time is full. Pick another.', past: 'Pick a day from tomorrow.',
    not_changeable: 'This visit can no longer be changed online. Call ' + D.phone + '.', network: 'No connection. Try again.', invalid: 'Check the details and try again.',
    no_customer: 'No bookings on this number yet.', bad_code: 'That code is not right.', bad_login: 'Wrong email or password.', phone_taken: 'That phone belongs to another customer.', not_found: 'Not found.'
  };
  CF.problem = function (e) { return (e && CF.problemText[e.code]) || 'Something went wrong. Try again.'; };

  CF.photoPair = function (sid, id) {
    var map = { home: 'living', deep: 'kitchen', move: 'bedroom', sofa: 'sofa', bath: 'bathroom', monthly: 'living', office: 'living' };
    var k = map[sid] || 'living';
    if (sid === 'deep' && id && +id.slice(-1) % 2) k = 'bathroom';
    return { before: 'ba/' + k + '-before.jpg', after: 'ba/' + k + '-after.jpg' };
  };

  /* =====================================================================
     LOCAL DRIVER: demo data in localStorage
     ===================================================================== */
  var KEY = 'cleanforce.demo.v4', SKEY = 'cleanforce.session', AKEY = 'cleanforce.admin';
  var mem = null, lastRaw = null, lastDb = null;

  function readRaw() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function read() {
    var raw = readRaw();
    if (raw == null) return mem;
    if (raw === lastRaw) return lastDb;
    try { lastDb = JSON.parse(raw); lastRaw = raw; } catch (e) { lastDb = null; }
    return lastDb;
  }
  function write(db) {
    mem = db;
    try { var raw = JSON.stringify(db); localStorage.setItem(KEY, raw); lastRaw = raw; lastDb = db; } catch (e) { /* private mode: memory only */ }
  }

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
      case 'vilimale': return 'Vilimalé, ' + ['Rehendhi', 'Saima', 'Mariyam Villa', 'Fehi Villa', 'Ujaalaa'][n(0, 4)] + ' ' + n(1, 9) + 'F';
      default: return ['H. ', 'M. ', 'Ma. ', 'G. '][n(0, 3)] + ['Sea View', 'Javaahiru Villa', 'Fenfiyaz', 'Thaazaa', 'Kanmathee', 'Dhonveli', 'Maagiri', 'Anbaree'][n(0, 7)] + ', ' + (function (f) { return f + (f === 2 ? 'nd' : f === 3 ? 'rd' : 'th'); })(n(2, 9)) + ' floor';
    }
  }

  /* deterministic demo data around "today"; tools/export-seed.mjs reuses it for the database seed */
  function seed(today, hourNow) {
    var r = rng(78016);
    var pick = function (a) { return a[Math.floor(r() * a.length)]; };
    today = today || todayIso();
    if (hourNow == null) hourNow = mvNow().getHours() + mvNow().getMinutes() / 60;
    var customers = [];
    var areaW = ['hulhumale2', 'hulhumale2', 'hulhumale2', 'hulhumale', 'hulhumale', 'male', 'male', 'vilimale'];
    for (var i = 0; i < 62; i++) {
      var isBiz = i % 13 === 7, female = r() < .55, area = pick(areaW);
      customers.push({
        id: 'C' + (100 + i),
        name: isBiz ? BIZ[(i / 13 | 0) % BIZ.length] : (female ? pick(FIRST_F) : pick(FIRST_M)) + ' ' + pick(LAST),
        phone: String(pick([7, 9])) + String(Math.floor(100000 + r() * 899999)),
        area: area, address: address(area, r), business: isBiz,
        since: addDays(today, -Math.floor(20 + r() * 260)), notes: ''
      });
    }
    customers[0].name = 'Aishath Shifa'; customers[0].phone = '7771234'; customers[0].area = 'hulhumale2'; customers[0].address = 'Hiya Tower 7, Flat 12-04';
    customers[0].notes = 'Has a cat. Keys with the guard if not home.';

    var bookings = [];
    var weights = { home: 5, deep: 3, move: 1, sofa: 2, bath: 2, monthly: 1, office: 1 };
    var svcBag = [];
    D.services.forEach(function (s) { for (var k = 0; k < (weights[s.id] || 1); k++) svcBag.push(s); });

    function make(c, date, forceStatus) {
      var s = c.business ? D.services.filter(function (x) { return x.id === 'office' || x.id === 'deep'; })[r() < .7 ? 0 : 1] : pick(svcBag);
      var o = pick(s.options), adds = [];
      if (!c.business && r() < .3) adds.push(pick(D.addons).id);
      var price = o.price + adds.reduce(function (t, a) { return t + CF.addon(a).price; }, 0);
      var past = date < today, isToday = date === today;
      var slot = pick(D.slots); if (parse(date).getDay() === 5 && slot < D.fridayFrom) slot = r() < .5 ? '13:30' : '16:00';
      var slotH = +slot.slice(0, 2) + +slot.slice(3) / 60;
      var todaySt = slotH + 3 <= hourNow ? 'done' : slotH <= hourNow ? 'cleaning' : slotH - 1 <= hourNow ? 'onway' : 'confirmed';
      var status = forceStatus || (past ? (r() < .06 ? 'cancelled' : 'done') : isToday ? todaySt : (r() < .7 ? 'confirmed' : 'booked'));
      var method = r() < .55 ? 'transfer' : 'cash', payments = [], old = date < addDays(today, -21);
      if (status === 'done' && r() > (old ? .015 : isToday ? .4 : .14)) payments.push({ amt: price, date: method === 'transfer' && !isToday && r() < .4 ? (addDays(date, 1) > today ? date : addDays(date, 1)) : date, method: method });
      return {
        id: '', customerId: c.id, service: s.id, option: o.id, addons: adds, price: price,
        date: date, slot: slot, area: c.area, address: c.address,
        status: status, team: status === 'cancelled' ? '' : pick(D.teams).id,
        method: method, payments: payments, source: pick(['web', 'web', 'web', 'phone', 'whatsapp']),
        created: addDays(date, -Math.floor(1 + r() * 6)), notes: '', slip: false
      };
    }
    for (var d = -150; d <= 12; d++) {
      var date = addDays(today, d), dow = parse(date).getDay();
      var base = d < -100 ? 1.2 : d < -50 ? 2 : 2.8;
      if (dow === 5) base *= .45;
      var n = Math.max(0, Math.round(base + (r() - .5) * 2.4));
      if (d > 0) n = Math.max(0, Math.round(n * (1 - d / 16)));
      var pool = customers.slice(0, Math.min(customers.length, Math.round(26 + (d + 150) / 155 * 36)));
      for (var j = 0; j < n; j++) bookings.push(make(pick(pool), date));
    }
    var me = customers[0];
    [-96, -64, -35, -8].forEach(function (off) { bookings.push(make(me, addDays(today, off), 'done')); });
    var up = make(me, addDays(today, 3), 'confirmed'); up.service = 'deep'; up.option = '2br'; up.price = 1100; up.addons = []; bookings.push(up);

    bookings.sort(function (a, b) { return (a.date + a.slot).localeCompare(b.date + b.slot); });
    var first = {};
    bookings.forEach(function (b) { if (!first[b.customerId]) first[b.customerId] = b.created; });
    customers.forEach(function (c) { if (first[c.id]) c.since = addDays(first[c.id], -Math.floor(r() * 3)); });
    bookings.forEach(function (b, k) { b.id = 'CF-' + (1001 + k); });
    bookings.forEach(function (b) { if (b.customerId === me.id && b.status === 'done') b.payments = [{ amt: b.price, date: b.date, method: 'transfer' }]; });
    return { v: 4, created: today, customers: customers, bookings: bookings, prices: {}, nextCustomer: 100 + customers.length, nextBooking: 1001 + bookings.length };
  }
  CF._seed = seed;

  function localDb() {
    var db = read();
    if (!db || db.v !== 4) { db = seed(); write(db); return db; }
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
  }
  /* every write re-reads storage first, so two open tabs never overwrite each other */
  function mutate(fn) {
    return new Promise(function (resolve, reject) {
      try { var db = localDb(), out = fn(db); write(db); resolve(out); } catch (e) { reject(e); }
    });
  }
  function getS(store, k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
  function setS(store, k, v) { try { v == null ? store.removeItem(k) : store.setItem(k, JSON.stringify(v)); } catch (e) { } }
  /* a website booking never overwrites a saved customer's name or address (anyone can type a phone number); staff bookings can */
  function findOrCreateCustomer(db, input, isStaff) {
    var c = CF.customerByPhone(input.phone, db);
    if (!c) {
      c = { id: 'C' + (db.nextCustomer++), name: input.name, phone: CF.normPhone(input.phone), area: input.area, address: input.address, business: !!input.business, since: todayIso(), notes: '' };
      db.customers.push(c);
    } else {
      if (input.name && (isStaff || !c.name)) c.name = input.name;
      if (input.address && (isStaff || !c.address)) { c.address = input.address; c.area = input.area; }
    }
    return c;
  }
  function staffNow() { return getS(sessionStorage, AKEY); }
  function customerNow(db) { var s = getS(localStorage, SKEY); return s ? CF.customerByPhone(s.phone, db || localDb()) || null : null; }

  var local = {
    name: 'local',
    ready: function () { localDb(); return Promise.resolve(); },
    db: localDb,
    createBooking: function (input) {
      return mutate(function (db) {
        var isStaff = !!staffNow() && input.byStaff;
        if (!CF.validPhone(input.phone) || !input.name || !input.address || !CF.option(input.service, input.option) || !input.date || D.slots.indexOf(input.slot) < 0) throw err('invalid');
        if (!isStaff) {
          if (input.date <= todayIso() || input.date > addDays(todayIso(), D.bookAhead)) throw err('past');
          var why = CF.slotProblem(input.date, input.slot, null, db); if (why) throw err(why);
        }
        var c = findOrCreateCustomer(db, input, isStaff);
        var b = {
          id: 'CF-' + (db.nextBooking++), customerId: c.id, service: input.service, option: input.option, addons: input.addons || [],
          price: isStaff && input.price != null && input.price !== '' ? Math.max(0, Math.round(+input.price)) : CF.quote(input.service, input.option, input.addons, db),
          date: input.date, slot: input.slot, area: input.area, address: input.address,
          status: isStaff && input.team ? 'confirmed' : 'booked', team: isStaff ? input.team || '' : '', method: input.method === 'transfer' ? 'transfer' : 'cash', payments: [],
          source: isStaff ? input.source || 'phone' : 'web', created: todayIso(), notes: input.notes || '', slip: !!input.slip
        };
        db.bookings.push(b);
        return b;
      });
    },
    updateBooking: function (id, patch) {
      return mutate(function (db) {
        var b = CF.booking(id, db); if (!b) throw err('not_found');
        ['status', 'team', 'date', 'slot', 'notes', 'method', 'price'].forEach(function (k) { if (patch[k] !== undefined) b[k] = k === 'price' ? Math.max(0, Math.round(+patch[k] || 0)) : patch[k]; });
        if (b.status === 'cancelled') b.team = '';
        return b;
      });
    },
    addPayment: function (id, p) {
      return mutate(function (db) {
        var b = CF.booking(id, db); if (!b) throw err('not_found');
        var amt = Math.min(CF.due(b), Math.max(0, Math.round(+p.amt || 0))); if (!amt) throw err('invalid');
        b.payments.push({ amt: amt, date: todayIso(), method: p.method === 'transfer' ? 'transfer' : 'cash' });
        if (p.method) b.method = p.method;
        return b;
      });
    },
    saveCustomer: function (c) {
      return mutate(function (db) {
        var ph = CF.normPhone(c.phone);
        if (!c.name || !CF.validPhone(ph)) throw err('invalid');
        var other = CF.customerByPhone(ph, db);
        if (other && other.id !== c.id) { var e = err('phone_taken'); e.other = other; throw e; }
        var x = c.id ? CF.customer(c.id, db) : null;
        if (!x) { x = { id: 'C' + (db.nextCustomer++), since: todayIso(), notes: '', area: 'hulhumale', address: '', business: false }; db.customers.push(x); }
        ['name', 'area', 'address', 'business', 'notes'].forEach(function (k) { if (c[k] !== undefined) x[k] = c[k]; });
        x.phone = ph;
        return x;
      });
    },
    setPrices: function (map) { return mutate(function (db) { db.prices = map || {}; return db.prices; }); },
    reset: function () { write(seed()); return Promise.resolve(); },
    track: function (id, phone) {
      var db = localDb(), b = CF.booking(id, db);
      if (!b) return Promise.resolve(null);
      var c = CF.customer(b.customerId, db);
      return Promise.resolve(c && c.phone === CF.normPhone(phone) ? { booking: b, customer: { name: c.name } } : null);
    },

    /* customer self-service */
    saveMyDetails: function (v) {
      return mutate(function (db) { var c = customerNow(db); if (!c) throw err('no_customer'); if (v.name) c.name = v.name; if (v.area) c.area = v.area; if (v.address) c.address = v.address; return c; });
    },
    cancelMine: function (id) {
      return mutate(function (db) {
        var c = customerNow(db), b = CF.booking(id, db);
        if (!c || !b || b.customerId !== c.id) throw err('not_found');
        if (!CF.changeable(b)) throw err('not_changeable');
        b.status = 'cancelled'; b.team = ''; b.notes = (b.notes ? b.notes + ' ' : '') + 'Cancelled by customer online.';
        return b;
      });
    },
    moveMine: function (id, date, slot) {
      return mutate(function (db) {
        var c = customerNow(db), b = CF.booking(id, db);
        if (!c || !b || b.customerId !== c.id) throw err('not_found');
        if (!CF.changeable(b)) throw err('not_changeable');
        if (date <= todayIso()) throw err('past');
        var why = CF.slotProblem(date, slot, b.id, db); if (why) throw err(why);
        if (b.date !== date || b.slot !== slot) { b.date = date; b.slot = slot; b.status = 'booked'; }
        return b;
      });
    },

    /* auth: demo code is 1234, admin is admin / cleanforce */
    sendCode: function (phone) {
      if (!CF.validPhone(phone)) return Promise.reject(err('invalid'));
      return CF.customerByPhone(phone, localDb()) ? Promise.resolve() : Promise.reject(err('no_customer'));
    },
    verifyCode: function (phone, code) {
      if (String(code).trim() !== '1234') return Promise.reject(err('bad_code'));
      setS(localStorage, SKEY, { phone: CF.normPhone(phone) });
      return Promise.resolve(customerNow());
    },
    me: function () { return customerNow(); },
    signOut: function () { setS(localStorage, SKEY, null); return Promise.resolve(); },
    staffSignIn: function (user, pass) {
      if (String(user).trim().toLowerCase() === 'admin' && pass === 'cleanforce') { setS(sessionStorage, AKEY, { name: 'Office', role: 'owner' }); return Promise.resolve(staffNow()); }
      return Promise.reject(err('bad_login'));
    },
    staff: staffNow,
    staffSignOut: function () { setS(sessionStorage, AKEY, null); return Promise.resolve(); },
    onChange: function (fn) { window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === SKEY) fn(); }); }
  };

  /* =====================================================================
     public surface: the same for both drivers
     ===================================================================== */
  var driver = local, booting = null;
  function loadScript(src) {
    return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(err('network', 'Could not load ' + src)); }; document.head.appendChild(s); });
  }
  CF.backend = CONF.backend === 'supabase' ? 'supabase' : 'local';
  function boot() {
    if (booting) return booting;
    if (CF.backend === 'supabase') {
      booting = (window.supabase ? Promise.resolve() : loadScript(CONF.supabaseJs || 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'))
        .then(function () { return window.CF_SUPABASE_DRIVER ? null : loadScript(SCRIPT_BASE + 'store-supabase.js'); })
        .then(function () { driver = window.CF_SUPABASE_DRIVER(CF, CONF, D); });
    } else booting = Promise.resolve();
    return booting;
  }
  CF.ready = function (scope) { return boot().then(function () { return driver.ready(scope || 'public'); }); };
  CF.db = function () { return driver.db(); };
  CF.api = {
    createBooking: function (i) { return driver.createBooking(i); },
    updateBooking: function (id, p) { return driver.updateBooking(id, p); },
    addPayment: function (id, p) { return driver.addPayment(id, p); },
    saveCustomer: function (c) { return driver.saveCustomer(c); },
    setPrices: function (m) { return driver.setPrices(m); },
    track: function (id, ph) { return driver.track(CF.normId(id), ph); },
    saveMyDetails: function (v) { return driver.saveMyDetails(v); },
    cancelMine: function (id) { return driver.cancelMine(id); },
    moveMine: function (id, d, s) { return driver.moveMine(id, d, s); },
    reset: function () { return driver.reset ? driver.reset() : Promise.resolve(); }
  };
  CF.auth = {
    sendCode: function (p) { return driver.sendCode(p); },
    verifyCode: function (p, c) { return driver.verifyCode(p, c); },
    me: function () { return driver.me(); },
    signOut: function () { return driver.signOut(); },
    staffSignIn: function (u, p) { return driver.staffSignIn(u, p); },
    staff: function () { return driver.staff(); },
    staffSignOut: function () { return driver.staffSignOut(); }
  };
  CF.onChange = function (fn) { boot().then(function () { driver.onChange(fn); }); };
  CF.isDemo = function () { return CF.backend === 'local'; };
})();
