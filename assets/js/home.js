/* Clean Force home page: price list, before / after, price picker, live status and timeline. */
(function () {
  var CF = window.CF, D = window.CF_DATA, $ = CF.$, $$ = CF.$$, esc = CF.esc;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var A = CF.icon.arr;

  /* ---------- before / after (static photos, no data needed) ---------- */
  var ROOMS = [
    { k: 'living', name: 'Living room', cap: 'Deep cleaning, 2 bedrooms', svc: 'deep' },
    { k: 'kitchen', name: 'Kitchen', cap: 'Grease, hob and cupboards', svc: 'bath' },
    { k: 'bathroom', name: 'Bathroom', cap: 'Scale, mould and grout', svc: 'bath' },
    { k: 'bedroom', name: 'Bedroom', cap: 'Home cleaning, tidy and dust', svc: 'home' },
    { k: 'sofa', name: 'Sofa', cap: 'Shampoo and stains, 3 seats', svc: 'sofa' }
  ];
  var ba = $('#ba'), slider = CF.slider(ba), roomsEl = $('#rooms');
  roomsEl.innerHTML = ROOMS.map(function (r, i) {
    return '<button class="room" role="tab" aria-selected="' + (i === 0) + '" tabindex="' + (i ? -1 : 0) + '" data-k="' + r.k + '"><img src="assets/img/' + r.k + '-after.jpg" alt="" loading="lazy">' + r.name + '<span class="arrow">' + A.replace('<svg', '<svg width="18" height="18"') + '</span></button>';
  }).join('');
  var tabs = $$('.room', roomsEl);
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () {
      var r = ROOMS[i], bi = $('.before', ba), ai = $('.after', ba);
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x === t); x.tabIndex = x === t ? 0 : -1; });
      ba.style.opacity = .4;
      var n = 0, done = function () { if (++n === 2) { ba.style.opacity = 1; slider.sweep(); } };
      bi.onload = ai.onload = done;
      bi.src = 'assets/img/ba/' + r.k + '-before.jpg'; ai.src = 'assets/img/ba/' + r.k + '-after.jpg';
      bi.alt = r.name + ' before cleaning'; ai.alt = 'The same ' + r.name.toLowerCase() + ' after cleaning';
      if (bi.complete && ai.complete) { n = 0; done(); done(); }
      $('#baCap').innerHTML = '<b>' + r.name + '</b> &middot; ' + r.cap;
      $('#baBook').href = 'book.html?service=' + r.svc;
    });
    t.addEventListener('keydown', function (e) {
      var j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? i - 1 : null;
      if (j === null) return; e.preventDefault(); j = (j + tabs.length) % tabs.length; tabs[j].focus(); tabs[j].click();
    });
  });
  ba.style.transition = 'opacity .3s';
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { o.disconnect(); setTimeout(slider.sweep, 400); } }, { threshold: .5 }).observe(ba);
  window.addEventListener('load', function () { setTimeout(function () { ROOMS.forEach(function (r) { new Image().src = 'assets/img/ba/' + r.k + '-before.jpg'; new Image().src = 'assets/img/ba/' + r.k + '-after.jpg'; }); }, 1500); });

  /* ---------- areas ---------- */
  $('#areaList').innerHTML = D.areas.map(function (a, i) {
    return '<a class="area" href="book.html?area=' + a.id + '" data-reveal style="--d:' + (i * .08) + 's"><img src="' + a.img + '" alt="' + esc(a.name) + ' from above" loading="lazy"><span class="nm"><b>' + esc(a.name) + '</b><span class="ic">' + A + '</span></span></a>';
  }).join('');
  CF.reveal($('#areaList'));

  /* ---------- line drawings for the price picker ---------- */
  function plan(n) { // flat: n bedrooms along the top, living room below
    var s = '<svg viewBox="0 0 120 84" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="112" height="76" rx="6"/>';
    var w = 112 / n;
    for (var i = 0; i < n; i++) { var x = 4 + w * i; s += '<rect class="fill" x="' + (x + 4) + '" y="8" width="' + (w - 8) + '" height="30" rx="3" stroke="none"/><rect x="' + (x + w / 2 - 7) + '" y="14" width="14" height="18" rx="2"/>'; if (i) s += '<path d="M' + x + ' 4v38"/>'; }
    return s + '<path d="M4 42h40M60 42h56"/><rect x="40" y="56" width="40" height="14" rx="3"/></svg>';
  }
  function sofa(n) {
    var w = Math.min(108, 30 + n * 12), x0 = (120 - w) / 2, s = '<svg viewBox="0 0 120 84" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">';
    s += '<rect x="' + x0 + '" y="22" width="' + w + '" height="24" rx="6"/><rect x="' + (x0 - 2) + '" y="40" width="' + (w + 4) + '" height="20" rx="5"/>';
    var cw = (w - 8) / n; for (var i = 0; i < n; i++) s += '<rect class="fill" x="' + (x0 + 4 + cw * i + 1) + '" y="43" width="' + (cw - 2) + '" height="11" rx="3" stroke="none"/>';
    return s + '<path d="M' + (x0 + 6) + ' 60v8M' + (x0 + w - 6) + ' 60v8"/></svg>';
  }
  function rooms(kind) {
    var s = '<svg viewBox="0 0 120 84" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true">';
    var tub = function (x) { return '<rect x="' + x + '" y="14" width="44" height="56" rx="6"/><rect class="fill" x="' + (x + 6) + '" y="22" width="32" height="40" rx="12" stroke="none"/><circle cx="' + (x + 22) + '" cy="30" r="3"/>'; };
    var kit = function (x) { return '<rect x="' + x + '" y="14" width="44" height="56" rx="6"/><rect class="fill" x="' + (x + 5) + '" y="19" width="34" height="22" rx="3" stroke="none"/><circle cx="' + (x + 14) + '" cy="30" r="5"/><circle cx="' + (x + 30) + '" cy="30" r="5"/><path d="M' + (x + 8) + ' 52h28"/>'; };
    if (kind === 'b1') s += tub(38); else if (kind === 'bk') s += kit(38); else s += tub(8) + kit(68);
    return s + '</svg>';
  }
  function office(n) {
    var s = '<svg viewBox="0 0 120 84" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="112" height="76" rx="6"/>';
    var cols = Math.ceil(n / 2), w = 104 / cols;
    for (var i = 0; i < n; i++) { var c = i % cols, r = (i / cols) | 0; s += '<rect class="fill" x="' + (10 + c * w) + '" y="' + (12 + r * 34) + '" width="' + (w - 12) + '" height="18" rx="3" stroke="none"/><circle cx="' + (10 + c * w + (w - 12) / 2) + '" cy="' + (36 + r * 34) + '" r="3"/>'; }
    return s + '</svg>';
  }
  function drawing(sid, oid) {
    var n = parseInt(oid, 10) || 1;
    if (sid === 'sofa') return sofa(n);
    if (sid === 'bath') return rooms(oid);
    if (sid === 'office') return office({ o1: 2, o3: 4, o5: 6 }[oid] || 2);
    return plan(n);
  }

  /* ---------- everything below reads prices and bookings ---------- */
  CF.ready('public').then(function () {
    var db = CF.db();

    // price rows
    $('#rows').innerHTML = D.services.map(function (s, i) {
      return '<a class="srow" href="book.html?service=' + s.id + '" data-img="' + s.img + '" data-reveal style="--d:' + (i * .05) + 's">' +
        '<span class="th"><img src="' + s.img + '" alt="" loading="lazy"></span><h3>' + esc(s.name) + '</h3><span class="s">' + esc(s.short) + '</span>' +
        '<span class="p">' + CF.money(CF.fromPrice(s.id, db)) + '<small>' + (s.monthly ? 'from, a month' : 'from') + '</small></span><span class="ic">' + A + '</span></a>';
    }).join('');
    CF.reveal($('#rows'));
    $('#monthlyFrom').textContent = CF.money(CF.fromPrice('monthly', db));
    $('#officeFrom').textContent = CF.money(CF.fromPrice('office', db));
    $('#mFrom').textContent = CF.money(Math.min.apply(null, D.services.map(function (s) { return CF.fromPrice(s.id, db); })));

    // price picker
    var st = { s: 'deep', o: '2br', add: [] };
    var NAMES = { home: 'Home', deep: 'Deep', move: 'Move out', sofa: 'Sofa', bath: 'Bathroom', monthly: 'Monthly', office: 'Office' };
    $('#cSvc').innerHTML = D.services.map(function (s) { return '<button type="button" data-s="' + s.id + '" aria-pressed="' + (s.id === st.s) + '">' + (NAMES[s.id] || s.name) + '</button>'; }).join('');
    function drawSizes() {
      var s = CF.service(st.s);
      if (!CF.option(st.s, st.o)) st.o = s.options[Math.min(1, s.options.length - 1)].id;
      $('#cSize').innerHTML = s.options.map(function (o) {
        return '<button type="button" class="size" data-o="' + o.id + '" aria-pressed="' + (o.id === st.o) + '">' + drawing(s.id, o.id) + '<b>' + esc(o.name) + '</b><small>' + CF.money(CF.price(s.id, o.id, db)) + '</small></button>';
      }).join('');
      var flat = ['home', 'deep', 'move', 'monthly'].indexOf(s.id) > -1;
      if (!flat) st.add = [];
      $('#cAdd').innerHTML = flat ? D.addons.map(function (a) { return '<label><input type="checkbox" value="' + a.id + '"' + (st.add.indexOf(a.id) > -1 ? ' checked' : '') + '><span>' + esc(a.name) + ' ' + a.price + '</span></label>'; }).join('') : '';
    }
    function out() {
      var s = CF.service(st.s), o = CF.option(st.s, st.o), total = CF.quote(st.s, st.o, st.add, db);
      $('#cLbl').textContent = s.name + ', ' + o.name.toLowerCase() + (st.add.length ? ' + ' + st.add.length + ' extra' + (st.add.length > 1 ? 's' : '') : '');
      CF.tween($('#cPrice'), total, function (v) { return v.toLocaleString('en-US'); });
      $('.out .big small').textContent = s.monthly ? 'MVR a month' : 'MVR';
      $('#cIncl').innerHTML = (s.incl || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      $('#cBook').href = 'book.html?service=' + st.s + '&option=' + st.o + (st.add.length ? '&addons=' + st.add.join(',') : '');
    }
    $('#cSvc').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      st.s = b.dataset.s; $$('#cSvc button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); drawSizes(); out();
    });
    $('#cSize').addEventListener('click', function (e) {
      var b = e.target.closest('.size'); if (!b) return;
      st.o = b.dataset.o; $$('#cSize .size').forEach(function (x) { x.setAttribute('aria-pressed', x === b); }); out();
    });
    $('#cAdd').addEventListener('change', function () { st.add = $$('#cAdd input:checked').map(function (x) { return x.value; }); out(); });
    drawSizes(); out();

    // live status, next free time, timeline
    function hm(h) { var hh = Math.floor(h), mm = Math.round((h - hh) * 60); if (mm === 60) { hh++; mm = 0; } return CF.pad(hh % 24) + ':' + CF.pad(mm); }
    function nextFree() {
      var t = CF.today();
      for (var d = 1; d <= D.bookAhead; d++) {
        var date = CF.addDays(t, d);
        for (var k = 0; k < D.slots.length; k++) if (!CF.slotProblem(date, D.slots[k], null, CF.db())) return { date: date, slot: D.slots[k] };
      }
      return null;
    }
    function live() {
      var now = CF.mvNow(), h = now.getHours() + now.getMinutes() / 60, t = CF.today();
      var startH = CF.isFriday(t) ? 13.5 : 8, open = h >= startH && h < 18;
      var taken = CF.slotsTaken(t), jobs = 0; for (var k in taken) jobs += taken[k];
      var T, S;
      if (open) { T = 'Crews out now'; S = (jobs ? jobs + ' visit' + (jobs > 1 ? 's' : '') + ' today, ' : '') + 'back by 6 pm'; }
      else if (h < startH) { T = 'Out from ' + (startH === 8 ? '8 am' : '1:30 pm'); S = 'Booking online is open'; }
      else { T = 'Done for today'; S = 'Out again tomorrow at ' + (CF.isFriday(CF.addDays(t, 1)) ? '1:30 pm' : '8 am'); }
      [['#liveDot', '#liveT', '#liveS'], ['#ctaDot', '#ctaT', '#ctaS']].forEach(function (ids) {
        $(ids[0]).classList.toggle('off', !open); $(ids[1]).textContent = T; $(ids[2]).textContent = S;
      });
      $('#ctaDot').style.background = open ? 'var(--cyan)' : 'rgba(255,255,255,.4)';

      var nf = nextFree();
      if (nf) {
        $('#nextT').textContent = CF.relDay(nf.date) + ', ' + nf.slot;
        $('#nextTile').href = 'book.html?date=' + nf.date + '&slot=' + nf.slot;
      }
      // timeline: book now, confirm within half an hour in office hours, crew at the next free time, done about three hours later
      var nowH = h, confirmH = nowH + .5, cDay = t;
      confirmH = Math.ceil(confirmH * 12) / 12;
      if (nowH < 8) { confirmH = 8.25; } else if (confirmH >= 22) { confirmH = 8.25; cDay = CF.addDays(t, 1); }
      $('#t1d').textContent = 'Now'; $('#t1').textContent = hm(nowH);
      $('#t2d').textContent = CF.relDay(cDay); $('#t2').textContent = hm(confirmH);
      if (nf) {
        var sh = +nf.slot.slice(0, 2) + +nf.slot.slice(3) / 60;
        $('#t3d').textContent = CF.relDay(nf.date); $('#t3').textContent = nf.slot;
        $('#t4d').textContent = CF.relDay(nf.date); $('#t4').textContent = hm(Math.min(sh + 3, 19));
      }
    }
    live(); setInterval(live, 60000);
    CF.onChange(function () { live(); });
  });

  /* ---------- timeline arc draws in as you scroll ---------- */
  var prog = $('#arcProg'), tl = $('#tl');
  if (prog && prog.getTotalLength) {
    var L = prog.getTotalLength();
    prog.style.strokeDasharray = L; prog.style.strokeDashoffset = L;
    var drawArc = function () {
      var r = tl.getBoundingClientRect(), vh = window.innerHeight;
      var p = reduce ? 1 : Math.max(0, Math.min(1, (vh * .9 - r.top) / (r.height + vh * .3)));
      prog.style.strokeDashoffset = L * (1 - p);
    };
    window.addEventListener('scroll', drawArc, { passive: true }); drawArc();
  }
})();
