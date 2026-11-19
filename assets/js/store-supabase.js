/* Clean Force: Supabase driver. Loaded by store.js when CF_CONFIG.backend = 'supabase'.
   Implements the same methods, return shapes and error codes as the local driver in store.js,
   on top of supabase/migrations/*_init.sql (tables, row level security and functions).

   Scopes for CF.ready(scope):
     public, book  prices + slot counts (no customer data is ever sent to a visitor)
     customer      the signed-in customer's own row, bookings and payments, plus prices and slot counts
     staff         everything, kept live with Supabase Realtime */
window.CF_SUPABASE_DRIVER = function (CF, CONF, D) {
  'use strict';
  var sb = window.supabase.createClient(CONF.supabaseUrl, CONF.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'cleanforce.auth' }
  });
  var BCOLS = 'id,customer_id,service,option,addons,price,date,slot,area,address,status,team,method,source,created,notes,slip_path';
  var CCOLS = 'id,name,phone,area,address,business,since,notes';
  var snap = empty(), scopeNow = 'public', me = null, staffRow = null;
  var fns = [], channel = null, reloadT = null, quietUntil = 0;

  function empty() { return { customers: [], bookings: [], prices: {}, slotCounts: {} }; }

  /* ---------- errors ---------- */
  function fail(e) {
    if (e && Object.prototype.hasOwnProperty.call(CF.problemText, e.code)) return e; // already a CF error
    var msg = (e && (e.message || e.error_description || e.msg)) || '';
    var m = /cf:([a-z_]+)/.exec(msg);
    if (m) return CF.err(m[1]);
    if (e && e.code === '23505') return CF.err('phone_taken');
    if (e && (e.code === '42501' || e.code === 'PGRST116' || e.code === 'PGRST301')) return CF.err('not_found');
    if (/fetch|network|timeout|load failed/i.test(msg) || (e && e.name === 'TypeError')) return CF.err('network');
    var x = CF.err('invalid', msg || 'invalid'); x.cause = e; return x;
  }
  function q(p) {
    return Promise.resolve(p).then(function (r) { if (r && r.error) throw fail(r.error); return r ? r.data : null; }, function (e) { throw fail(e); });
  }
  function rpc(name, args) { return q(sb.rpc(name, args || {})); }

  /* ---------- row mapping (database rows -> the shapes the pages use) ---------- */
  function mapC(r) {
    return { id: r.id, name: r.name, phone: r.phone, area: r.area, address: r.address || '', business: !!r.business, since: r.since, notes: r.notes || '' };
  }
  function mapB(r, pays) {
    return {
      id: r.id, customerId: r.customer_id, service: r.service, option: r.option, addons: r.addons || [], price: r.price,
      date: r.date, slot: r.slot, area: r.area, address: r.address, status: r.status, team: r.team || '', method: r.method,
      payments: pays || [], source: r.source, created: r.created, notes: r.notes || '', slip: !!r.slip_path
    };
  }
  function groupPays(rows) {
    var by = {};
    rows.slice().sort(function (a, b) { return a.paid_on < b.paid_on ? -1 : a.paid_on > b.paid_on ? 1 : a.id - b.id; })
      .forEach(function (p) { (by[p.booking_id] = by[p.booking_id] || []).push({ amt: p.amt, date: p.paid_on, method: p.method }); });
    return by;
  }
  function sortSnap() {
    snap.bookings.sort(function (a, b) { return (a.date + a.slot + a.id).localeCompare(b.date + b.slot + b.id); });
    snap.customers.sort(function (a, b) { return (+a.id.slice(1) || 0) - (+b.id.slice(1) || 0); });
  }
  function putB(b) {
    for (var i = 0; i < snap.bookings.length; i++) if (snap.bookings[i].id === b.id) { snap.bookings[i] = b; return b; }
    snap.bookings.push(b); sortSnap(); return b;
  }
  function putC(c) {
    for (var i = 0; i < snap.customers.length; i++) if (snap.customers[i].id === c.id) { snap.customers[i] = c; return c; }
    snap.customers.push(c); sortSnap(); return c;
  }

  /* ---------- loading ---------- */
  // PostgREST returns at most 1000 rows per request; page through
  function all(table, cols, order) {
    var out = [];
    function page(from) {
      return q(sb.from(table).select(cols).order(order).range(from, from + 999)).then(function (rows) {
        out = out.concat(rows || []);
        return rows && rows.length === 1000 ? page(from + 1000) : out;
      });
    }
    return page(0);
  }
  function loadPrices() {
    return q(sb.from('price_overrides').select('service_id,option_id,price')).then(function (rows) {
      var m = {};
      (rows || []).forEach(function (r) { (m[r.service_id] = m[r.service_id] || {})[r.option_id] = r.price; });
      snap.prices = m;
    });
  }
  function loadSlots() {
    var t = CF.today();
    return rpc('slot_counts', { p_from: t, p_to: CF.addDays(t, D.bookAhead || 30) }).then(function (rows) {
      var m = {};
      (rows || []).forEach(function (r) { (m[r.date] = m[r.date] || {})[r.slot] = r.n; });
      snap.slotCounts = m;
    });
  }
  function loadAll() {
    return Promise.all([
      all('customers', CCOLS, 'id'),
      all('bookings', BCOLS, 'id'),
      all('payments', 'id,booking_id,amt,paid_on,method', 'id'),
      loadPrices()
    ]).then(function (r) {
      var pays = groupPays(r[2]);
      snap.customers = r[0].map(mapC);
      snap.bookings = r[1].map(function (b) { return mapB(b, pays[b.id]); });
      delete snap.slotCounts; // staff count slots from the full booking list
      sortSnap();
    });
  }
  function loadOwn() {
    return rpc('my_customer').then(function (c) {
      me = c ? mapC(c) : null;
      if (!me) { snap.customers = []; snap.bookings = []; return; }
      return q(sb.from('bookings').select(BCOLS).eq('customer_id', me.id)).then(function (bs) {
        var ids = (bs || []).map(function (b) { return b.id; });
        var pp = ids.length ? q(sb.from('payments').select('id,booking_id,amt,paid_on,method').in('booking_id', ids)) : Promise.resolve([]);
        return pp.then(function (ps) {
          var pays = groupPays(ps || []);
          snap.customers = [me];
          snap.bookings = (bs || []).map(function (b) { return mapB(b, pays[b.id]); });
          sortSnap();
        });
      });
    });
  }
  function session() { return sb.auth.getSession().then(function (r) { return r && r.data ? r.data.session : null; }); }
  function loadStaffRow(uid) {
    return q(sb.from('staff').select('name,role').eq('user_id', uid).maybeSingle()).then(function (row) {
      staffRow = row ? { name: row.name, role: row.role } : null;
      return staffRow;
    });
  }

  /* ---------- live updates ---------- */
  function fire() { fns.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } }); }
  function reloadSoon() {
    clearTimeout(reloadT);
    reloadT = setTimeout(function () {
      var silent = Date.now() < quietUntil; // our own write echoing back: refresh, but don't announce it
      (scopeNow === 'staff' ? loadAll() : scopeNow === 'customer' ? Promise.all([loadOwn(), loadSlots()]) : Promise.all([loadPrices(), loadSlots()]))
        .then(function () { if (!silent) fire(); }, function () { /* offline: keep the last snapshot */ });
    }, 400);
  }
  function subscribe(tables) {
    unsubscribe();
    channel = sb.channel('cf-' + scopeNow);
    tables.forEach(function (t) { channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: t }, reloadSoon); });
    channel.subscribe();
  }
  function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }
  function wrote() { quietUntil = Date.now() + 2500; }
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_OUT' && (me || staffRow)) { me = null; staffRow = null; unsubscribe(); snap = empty(); fire(); }
  });

  /* ---------- slips ---------- */
  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function uploadSlip(file) {
    if (!file || typeof file !== 'object' || !('size' in file)) return Promise.resolve(null);
    var ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
    var path = 'pending/' + uid() + '.' + ext;
    return q(sb.storage.from('slips').upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })).then(function () { return path; });
  }

  var driver = {
    name: 'supabase',

    ready: function (scope) {
      scopeNow = scope || 'public';
      if (scopeNow === 'staff') {
        return session().then(function (s) {
          if (!s) { staffRow = null; snap = empty(); return; }
          return loadStaffRow(s.user.id).then(function (row) {
            if (!row) { snap = empty(); return; }
            return loadAll().then(function () { subscribe(['bookings', 'payments', 'customers', 'price_overrides']); });
          });
        });
      }
      if (scopeNow === 'customer') {
        return Promise.all([loadPrices(), loadSlots(), session().then(function (s) { return s ? loadOwn() : (me = null); })]).then(function () {
          if (me) subscribe(['bookings', 'payments']);
        });
      }
      return Promise.all([loadPrices(), loadSlots()]);
    },
    db: function () { return snap; },

    createBooking: function (input) {
      if (!CF.validPhone(input.phone) || !input.name || !input.address || !CF.option(input.service, input.option) || !input.date || D.slots.indexOf(input.slot) < 0) return Promise.reject(CF.err('invalid'));
      var byStaff = !!(input.byStaff && staffRow);
      return uploadSlip(input.slip).then(function (path) {
        wrote();
        return rpc('create_booking', {
          p_phone: CF.normPhone(input.phone), p_name: String(input.name).trim(), p_area: input.area, p_address: String(input.address).trim(),
          p_service: input.service, p_option: input.option, p_addons: input.addons || [], p_date: input.date, p_slot: input.slot,
          p_method: input.method === 'transfer' ? 'transfer' : 'cash', p_notes: input.notes || '', p_slip_path: path || null,
          p_by_staff: byStaff, p_price: byStaff && input.price != null && input.price !== '' ? Math.round(+input.price) : null,
          p_team: byStaff ? input.team || null : null, p_source: byStaff ? input.source || null : null, p_business: !!input.business
        });
      }).then(function (j) {
        var b = mapB(fromJson(j), j.payments);
        if (scopeNow === 'staff') {
          putB(b);
          return q(sb.from('customers').select(CCOLS).eq('id', b.customerId).single()).then(function (c) { putC(mapC(c)); return b; });
        }
        if (me && b.customerId === me.id) putB(b);
        return loadSlots().then(function () { return b; }, function () { return b; });
      });
    },

    updateBooking: function (id, patch) {
      var row = {};
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.team !== undefined) row.team = patch.team || null;
      if (patch.date !== undefined) row.date = patch.date;
      if (patch.slot !== undefined) row.slot = patch.slot;
      if (patch.notes !== undefined) row.notes = patch.notes || '';
      if (patch.method !== undefined) row.method = patch.method;
      if (patch.price !== undefined) row.price = Math.max(0, Math.round(+patch.price || 0));
      wrote();
      return q(sb.from('bookings').update(row).eq('id', id).select(BCOLS).single()).then(function (r) {
        var old = CF.booking(id, snap);
        return putB(mapB(r, old ? old.payments : []));
      });
    },

    addPayment: function (id, p) {
      wrote();
      return rpc('add_payment', { p_booking: id, p_amt: Math.round(+p.amt || 0), p_method: p.method || null }).then(function (j) {
        return putB(mapB(fromJson(j), j.payments));
      });
    },

    saveCustomer: function (c) {
      var ph = CF.normPhone(c.phone);
      if (!c.name || !CF.validPhone(ph)) return Promise.reject(CF.err('invalid'));
      var other = CF.customerByPhone(ph, snap);
      if (other && other.id !== c.id) { var e = CF.err('phone_taken'); e.other = other; return Promise.reject(e); }
      var row = { phone: ph };
      ['name', 'area', 'address', 'business', 'notes'].forEach(function (k) { if (c[k] !== undefined) row[k] = c[k]; });
      wrote();
      var call = c.id ? sb.from('customers').update(row).eq('id', c.id).select(CCOLS).single() : sb.from('customers').insert(row).select(CCOLS).single();
      return q(call).then(function (r) { return putC(mapC(r)); }, function (e) {
        if (e.code === 'phone_taken') { e.other = CF.customerByPhone(ph, snap); }
        throw e;
      });
    },

    setPrices: function (map) {
      wrote();
      return rpc('set_prices', { p_map: map || {} }).then(loadPrices).then(function () { return snap.prices; });
    },

    reset: function () { return Promise.reject(CF.err('invalid', 'Reset only exists in the demo')); },

    track: function (id, phone) {
      return rpc('track_booking', { p_id: id, p_phone: CF.normPhone(phone) }).then(function (j) {
        if (!j || !j.booking) return null;
        return { booking: mapB(fromJson(j.booking), j.booking.payments), customer: { name: j.customer.name } };
      });
    },

    /* customer self-service */
    saveMyDetails: function (v) {
      wrote();
      return rpc('update_my_details', { p_name: v.name || null, p_area: v.area || null, p_address: v.address || null }).then(function (c) {
        me = mapC(c); snap.customers = [me]; return me;
      });
    },
    cancelMine: function (id) {
      wrote();
      return rpc('cancel_my_booking', { p_id: id }).then(function (j) {
        var b = putB(mapB(fromJson(j), j.payments));
        return loadSlots().then(function () { return b; }, function () { return b; });
      });
    },
    moveMine: function (id, date, slot) {
      wrote();
      return rpc('move_my_booking', { p_id: id, p_date: date, p_slot: slot }).then(function (j) {
        var b = putB(mapB(fromJson(j), j.payments));
        return loadSlots().then(function () { return b; }, function () { return b; });
      });
    },

    /* auth: customers get a code by SMS (or WhatsApp, set in Supabase), staff use email + password */
    sendCode: function (phone) {
      if (!CF.validPhone(phone)) return Promise.reject(CF.err('invalid'));
      return q(sb.auth.signInWithOtp({ phone: '+960' + CF.normPhone(phone) })).then(function () { });
    },
    verifyCode: function (phone, code) {
      return sb.auth.verifyOtp({ phone: '+960' + CF.normPhone(phone), token: String(code).trim(), type: 'sms' }).then(function (r) {
        if (r.error) throw /fetch|network/i.test(r.error.message || '') ? CF.err('network') : CF.err('bad_code');
        scopeNow = 'customer';
        return Promise.all([loadOwn(), loadSlots()]).then(function () { if (me) subscribe(['bookings', 'payments']); return me; });
      }, function () { throw CF.err('network'); });
    },
    me: function () { return me; },
    signOut: function () {
      me = null; unsubscribe(); snap.customers = []; snap.bookings = [];
      return sb.auth.signOut().then(function () { }, function () { });
    },
    staffSignIn: function (user, pass) {
      return sb.auth.signInWithPassword({ email: String(user).trim(), password: pass }).then(function (r) {
        if (r.error) throw /fetch|network/i.test(r.error.message || '') ? CF.err('network') : CF.err('bad_login');
        return loadStaffRow(r.data.user.id).then(function (row) {
          if (!row) return sb.auth.signOut().then(function () { throw CF.err('bad_login'); });
          scopeNow = 'staff';
          return loadAll().then(function () { subscribe(['bookings', 'payments', 'customers', 'price_overrides']); return staffRow; });
        });
      }, function (e) { throw e && e.code ? e : CF.err('network'); });
    },
    staff: function () { return staffRow; },
    staffSignOut: function () {
      staffRow = null; unsubscribe(); snap = empty();
      return sb.auth.signOut().then(function () { }, function () { });
    },
    onChange: function (fn) { fns.push(fn); },

    _client: sb // for debugging in the console
  };

  // booking_json() returns the page shape already; normalise so mapB can take it
  function fromJson(j) {
    return {
      id: j.id, customer_id: j.customerId, service: j.service, option: j.option, addons: j.addons, price: j.price, date: j.date,
      slot: j.slot, area: j.area, address: j.address, status: j.status, team: j.team, method: j.method, source: j.source,
      created: j.created, notes: j.notes, slip_path: j.slip ? 'pending/' : null
    };
  }

  return driver;
};
