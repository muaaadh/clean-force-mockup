/* Clean Force: booking flow */
(function () {
  var D = window.CF_DATA, CF = window.CF;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var db = CF.db();
  var q = new URLSearchParams(location.search);
  var form = $('#bkForm');
  var state = {
    service: CF.service(q.get('service')) ? q.get('service') : 'home',
    option: q.get('option') || '',
    addons: [],
    date: '', slot: '',
    area: q.get('area') || ''
  };
  var step = 0, total = 0;

  /* ---------- step 1: service ---------- */
  $('#svcPick').innerHTML = D.services.map(function (s) {
    return '<label class="pick"><input type="radio" name="service" value="' + s.id + '"' + (s.id === state.service ? ' checked' : '') + '>' +
      '<span class="box"><img src="' + s.img + '" alt="" loading="lazy"><b>' + CF.esc(s.name) + '</b><small>from ' + CF.money(CF.fromPrice(s.id, db)) + (s.monthly ? ' / mo' : '') + '</small></span></label>';
  }).join('');
  function renderOptions() {
    var s = CF.service(state.service);
    $('#optLabel').textContent = s.unit;
    if (!s.options.some(function (o) { return o.id === state.option; })) state.option = s.options[Math.min(1, s.options.length - 1)].id;
    $('#optPick').innerHTML = s.options.map(function (o) {
      return '<label class="chip-o"><input type="radio" name="option" value="' + o.id + '"' + (o.id === state.option ? ' checked' : '') + '><span>' + CF.esc(o.name) + '<small>' + CF.money(CF.price(s.id, o.id, db)) + (s.monthly ? ' / mo' : '') + '</small></span></label>';
    }).join('');
    var showAdd = ['home', 'deep', 'move', 'monthly'].indexOf(s.id) > -1;
    $('#addonWrap').hidden = !showAdd;
    if (!showAdd) state.addons = [];
    $('#addonPick').innerHTML = D.addons.map(function (a) {
      return '<label class="chip-o"><input type="checkbox" name="addon" value="' + a.id + '"' + (state.addons.indexOf(a.id) > -1 ? ' checked' : '') + '><span>' + CF.esc(a.name) + '<small>+ ' + CF.money(a.price) + '</small></span></label>';
    }).join('');
  }
  form.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'service') { state.service = t.value; renderOptions(); }
    if (t.name === 'option') state.option = t.value;
    if (t.name === 'addon') state.addons = $$('input[name=addon]:checked').map(function (x) { return x.value; });
    if (t.name === 'day') { state.date = t.value; renderSlots(); $('#err1').hidden = true; }
    if (t.name === 'slot') { state.slot = t.value; $('#err1').hidden = true; }
    if (t.name === 'area') state.area = t.value;
    if (t.name === 'method') $('#bankBox').hidden = t.value !== 'transfer';
    summary();
  });
  form.addEventListener('input', summary);

  /* ---------- step 2: day + slot ---------- */
  var DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var today = CF.today(), days = [];
  for (var i = 1; i <= 14; i++) days.push(CF.addDays(today, i));
  $('#dayPick').innerHTML = days.map(function (d, k) {
    var dt = CF.parse(d);
    return '<label class="chip-o"><input type="radio" name="day" value="' + d + '"><span><small>' + (k === 0 ? 'Tomorrow' : DAY[dt.getDay()]) + '</small>' + dt.getDate() + ' ' + CF.fmtDate(d).split(' ')[1] + '</span></label>';
  }).join('');
  function renderSlots() {
    var taken = state.date ? CF.slotsTaken(state.date, db) : {};
    var fri = state.date && CF.parse(state.date).getDay() === 5;
    if (!state.date) { $('#slotPick').innerHTML = '<p class="slot-hint">Pick a day to see the open times.</p>'; return; }
    $('#slotPick').innerHTML = D.slots.map(function (s) {
      var full = !state.date || (taken[s] || 0) >= D.teams.length || (fri && s < '13:30');
      if (full && state.slot === s) state.slot = '';
      var left = D.teams.length - (taken[s] || 0);
      return '<label class="chip-o"><input type="radio" name="slot" value="' + s + '"' + (full ? ' disabled' : '') + (state.slot === s ? ' checked' : '') + '><span>' + s +
        '<small>' + (!state.date ? 'pick a day' : full ? (fri && s < '13:30' ? 'Friday prayer' : 'Full') : left === 1 ? '1 team left' : 'Open') + '</small></span></label>';
    }).join('');
  }
  renderSlots();

  /* ---------- step 3: address ---------- */
  $('#areaSel').innerHTML = D.areas.map(function (a) { return '<option value="' + a.id + '">' + CF.esc(a.name) + '</option>'; }).join('');
  $('#areaSel').value = state.area || 'hulhumale2'; state.area = $('#areaSel').value;
  // a returning customer: prefill from the last booking on this device
  try {
    var me = JSON.parse(localStorage.getItem('cleanforce.me') || 'null');
    var c = me && CF.customerByPhone(me.phone, db);
    if (c) { form.name.value = c.name; form.phone.value = c.phone; form.address.value = c.address; if (!q.get('area')) { $('#areaSel').value = c.area; state.area = c.area; } }
  } catch (e) { }

  $('#copyAcc').addEventListener('click', function () {
    var b = this;
    (navigator.clipboard ? navigator.clipboard.writeText(D.bank.account) : Promise.reject()).then(function () { b.textContent = 'Copied'; }, function () { b.textContent = 'Select and copy'; });
  });

  /* ---------- summary ---------- */
  function summary() {
    var s = CF.service(state.service), o = CF.option(state.service, state.option);
    total = CF.price(s.id, o.id, db) + state.addons.reduce(function (t, a) { return t + CF.addon(a).price; }, 0);
    $('#sName').textContent = s.name;
    var img = $('#sImg'); if (img.getAttribute('src') !== s.img) img.src = s.img;
    var rows = [[s.unit, o.name]];
    state.addons.forEach(function (a) { rows.push(['Extra', CF.addon(a).name]); });
    if (state.date) rows.push(['Date', CF.fmtDate(state.date, true) + (state.slot ? ', ' + state.slot : '')]);
    if (step >= 2) rows.push(['Area', CF.area(state.area).name]);
    if (form.address.value && step >= 2) rows.push(['Address', form.address.value]);
    $('#sList').innerHTML = rows.map(function (r) { return '<dt>' + CF.esc(r[0]) + '</dt><dd>' + CF.esc(r[1]) + '</dd>'; }).join('');
    var t = CF.money(total) + (s.monthly ? ' / mo' : '');
    $('#sTot').textContent = t; $('#mTot').textContent = t;
  }

  /* ---------- steps ---------- */
  var panels = $$('.panel', form), lis = $$('#steps li');
  function valid(n) {
    if (n === 1) { var ok = state.date && state.slot; $('#err1').hidden = !!ok; return ok; }
    if (n === 2) {
      var ph = CF.normPhone(form.phone.value);
      var ok2 = form.name.value.trim().length > 1 && /^[3-9]\d{6}$/.test(ph) && form.address.value.trim().length > 2;
      $('#err2').hidden = ok2;
      [form.name, form.phone, form.address].forEach(function (x) { x.removeAttribute('aria-invalid'); });
      if (!ok2) { var bad = form.name.value.trim().length < 2 ? form.name : !/^[3-9]\d{6}$/.test(ph) ? form.phone : form.address; bad.setAttribute('aria-invalid', 'true'); $('#err2').scrollIntoView({ block: 'center' }); bad.focus({ preventScroll: true }); }
      return ok2;
    }
    return true;
  }
  function go(n, quiet) {
    step = n;
    panels.forEach(function (p, k) { p.hidden = k !== n; });
    lis.forEach(function (l, k) { l.className = k === n ? 'on' : k < n ? 'ok' : ''; });
    $('#back').hidden = n === 0;
    var last = n === panels.length - 1;
    var lbl = last ? 'Confirm booking' : 'Continue <span class="arr">&rarr;</span>';
    $('#next').innerHTML = lbl; $('#mNext').innerHTML = lbl;
    $('#mStep').textContent = 'Step ' + (n + 1) + ' of 4';
    summary();
    var top = $('#steps').getBoundingClientRect().top + scrollY - 100;
    if (scrollY > top) window.scrollTo({ top: top, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    var h = panels[n].querySelector('h2'); if (h && !quiet) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
  function next() {
    if (!valid(step)) return;
    if (step < panels.length - 1) return go(step + 1);
    confirm();
  }
  $('#next').addEventListener('click', next);
  $('#mNext').addEventListener('click', next);
  $('#back').addEventListener('click', function () { go(step - 1); });

  /* ---------- confirm ---------- */
  function confirm() {
    var method = form.method.value;
    var b = CF.addBooking({
      name: form.name.value.trim(), phone: form.phone.value, area: state.area, address: form.address.value.trim(),
      service: state.service, option: state.option, addons: state.addons, price: total,
      date: state.date, slot: state.slot, method: method, notes: form.notes.value.trim(),
      slip: !!(form.slip && form.slip.files && form.slip.files.length), source: 'web'
    });
    try { localStorage.setItem('cleanforce.me', JSON.stringify({ phone: CF.normPhone(form.phone.value) })); } catch (e) { }
    var s = CF.service(b.service), o = CF.option(b.service, b.option);
    var wa = 'https://wa.me/' + D.phoneIntl + '?text=' + encodeURIComponent('Hi Clean Force, my booking is ' + b.id + '.' + (method === 'transfer' ? ' Sending the transfer slip.' : ''));
    $('#flow').hidden = true; $('#mbar').hidden = true;
    var done = $('#done'); done.hidden = false;
    done.innerHTML = '<div class="done-box">' +
      '<div class="tick"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<h1 tabindex="-1">Booking received.</h1><p class="lead">We will confirm your time by SMS. Keep this number.</p>' +
      '<span class="num">' + b.id + '</span>' +
      '<dl><dt>Service</dt><dd>' + CF.esc(s.name) + ', ' + CF.esc(o.name) + '</dd><dt>When</dt><dd>' + CF.fmtDate(b.date, true) + ', ' + b.slot + '</dd>' +
      '<dt>Where</dt><dd>' + CF.esc(b.address) + ', ' + CF.esc(CF.area(b.area).name) + '</dd><dt>Payment</dt><dd>' + (method === 'cash' ? 'Cash after the clean' : 'Bank transfer') + '</dd>' +
      '<dt>Total</dt><dd><b>' + CF.money(b.price) + '</b></dd></dl>' +
      (method === 'transfer' ? '<div class="bankbox" style="text-align:left;margin-top:12px"><span>Transfer to ' + D.bank.name + ', ' + D.bank.holder + '. Put <b>' + b.id + '</b> in the remarks.</span><span><code>' + D.bank.account + '</code><button class="copy" type="button" id="copyAcc2">Copy</button></span></div>' : '') +
      '<div class="acts"><a class="btn" href="track.html?id=' + b.id + '&phone=' + CF.normPhone(form.phone.value) + '">Track this booking</a>' +
      '<a class="btn btn-line" href="account.html">My bookings</a>' +
      '<a class="btn btn-line" href="' + wa + '" target="_blank" rel="noopener">' + (method === 'transfer' ? 'WhatsApp the slip' : 'WhatsApp us') + '</a></div></div>';
    var c2 = $('#copyAcc2'); if (c2) c2.addEventListener('click', function () { (navigator.clipboard ? navigator.clipboard.writeText(D.bank.account) : Promise.reject()).then(function () { c2.textContent = 'Copied'; }, function () { c2.textContent = 'Select and copy'; }); });
    window.scrollTo(0, 0); $('h1', done).focus();
  }

  renderOptions(); go(0, true);
  var wf = $('.wa-float'); if (wf) wf.classList.add('lift');
})();
