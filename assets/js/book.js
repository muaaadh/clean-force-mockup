/* Clean Force: booking in three steps (what, when, you). */
(function () {
  var D = window.CF_DATA, CF = window.CF, $ = CF.$, $$ = CF.$$, esc = CF.esc;
  var q = new URLSearchParams(location.search);
  var form = $('#bkForm'), ME = 'cleanforce.me';
  var state = {
    service: CF.service(q.get('service')) ? q.get('service') : 'home',
    option: q.get('option') || '',
    addons: (q.get('addons') || '').split(',').filter(function (a) { return D.addons.some(function (x) { return x.id === a; }); }),
    date: q.get('date') || '', slot: q.get('slot') || '',
    area: q.get('area') || ''
  };
  var step = 0, total = 0, busy = false;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function me() { try { return JSON.parse(localStorage.getItem(ME) || 'null') || {}; } catch (e) { return {}; } }

  CF.ready('book').then(function () {
    var db = function () { return CF.db(); };

    /* ---------- step 1: what ---------- */
    $('#svcPick').innerHTML = D.services.map(function (s) {
      return '<label class="pick"><input type="radio" name="service" value="' + s.id + '"' + (s.id === state.service ? ' checked' : '') + '>' +
        '<span class="box"><img src="' + s.img + '" alt="" loading="lazy"><b>' + esc(s.name) + '</b><small>from ' + CF.money(CF.fromPrice(s.id, db())) + (s.monthly ? ' a month' : '') + '</small></span></label>';
    }).join('');
    function renderOptions() {
      var s = CF.service(state.service);
      $('#optLabel').textContent = s.unit;
      if (!CF.option(s.id, state.option)) state.option = s.options[Math.min(1, s.options.length - 1)].id;
      $('#optPick').innerHTML = s.options.map(function (o) {
        return '<label class="chip-o"><input type="radio" name="option" value="' + o.id + '"' + (o.id === state.option ? ' checked' : '') + '><span>' + esc(o.name) + '<small>' + CF.money(CF.price(s.id, o.id, db())) + '</small></span></label>';
      }).join('');
      var flat = ['home', 'deep', 'move', 'monthly'].indexOf(s.id) > -1;
      $('#addonWrap').hidden = !flat;
      if (!flat) state.addons = [];
      $('#addonPick').innerHTML = D.addons.map(function (a) {
        return '<label class="chip-o"><input type="checkbox" name="addon" value="' + a.id + '"' + (state.addons.indexOf(a.id) > -1 ? ' checked' : '') + '><span>' + esc(a.name) + '<small>+ ' + CF.money(a.price) + '</small></span></label>';
      }).join('');
    }

    /* ---------- step 2: when ---------- */
    var today = CF.today(), days = [];
    for (var i = 1; i <= 14; i++) days.push(CF.addDays(today, i));
    if (state.date && days.indexOf(state.date) < 0) state.date = '';
    $('#dayPick').innerHTML = days.map(function (d) {
      var dt = CF.parse(d);
      return '<label class="chip-o"><input type="radio" name="day" value="' + d + '"' + (d === state.date ? ' checked' : '') + '><span><small>' + (d === CF.addDays(today, 1) ? 'Tomorrow' : CF.fmtDate(d, true).split(' ')[0]) + '</small>' + dt.getDate() + ' ' + CF.fmtDate(d).split(' ')[1] + '</span></label>';
    }).join('');
    function renderSlots() {
      if (!state.date) { $('#slotPick').innerHTML = '<p class="slot-hint">Pick a day to see the open times.</p>'; return; }
      var taken = CF.slotsTaken(state.date, db());
      $('#slotPick').innerHTML = D.slots.map(function (s) {
        var why = CF.slotProblem(state.date, s, null, db());
        if (why && state.slot === s) state.slot = '';
        var left = D.teams.length - (taken[s] || 0);
        return '<label class="chip-o"><input type="radio" name="slot" value="' + s + '"' + (why ? ' disabled' : '') + (state.slot === s ? ' checked' : '') + '><span>' + s +
          '<small>' + (why === 'friday' ? 'Friday prayer' : why === 'full' ? 'Full' : left === 1 ? '1 team left' : 'Open') + '</small></span></label>';
      }).join('');
    }

    /* ---------- step 3: you ---------- */
    $('#areaSel').innerHTML = D.areas.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + '</option>'; }).join('');
    var m = me();
    if (m.phone) { form.name.value = m.name || ''; form.phone.value = m.phone; form.address.value = m.address || ''; if (!state.area && m.area) state.area = m.area; }
    $('#areaSel').value = state.area || 'hulhumale2'; state.area = $('#areaSel').value;
    $('#bankName').textContent = D.bank.name + ' · ' + D.bank.holder;
    $('#acc').textContent = D.bank.account;
    $('#noteBtn').addEventListener('click', function () { $('#noteField').hidden = false; this.hidden = true; form.notes.focus(); });
    function copy(btn) { (navigator.clipboard ? navigator.clipboard.writeText(D.bank.account) : Promise.reject()).then(function () { btn.textContent = 'Copied'; }, function () { btn.textContent = 'Select and copy'; }); }
    $('#copyAcc').addEventListener('click', function () { copy(this); });

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
    form.addEventListener('input', function (e) { if (e.target.getAttribute('aria-invalid')) e.target.removeAttribute('aria-invalid'); summary(); });

    /* ---------- summary ---------- */
    function summary() {
      var s = CF.service(state.service), o = CF.option(state.service, state.option);
      total = CF.quote(s.id, o.id, state.addons, db());
      $('#sName').textContent = s.name;
      var img = $('#sImg'); if (img.getAttribute('src') !== s.img) img.src = s.img;
      var rows = [[s.unit, o.name]];
      if (state.addons.length) rows.push(['Extras', state.addons.map(function (a) { return CF.addon(a).name; }).join(', ')]);
      if (state.date) rows.push(['When', CF.relDay(state.date) + (state.slot ? ', ' + state.slot : '')]);
      if (step >= 2) rows.push(['Where', CF.area(state.area).name]);
      $('#sList').innerHTML = rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('');
      var t = CF.money(total) + (s.monthly ? ' a month' : '');
      $('#sTot').textContent = t; $('#mTot').textContent = t;
      if (step === 2) setNext();
    }

    /* ---------- steps ---------- */
    var panels = $$('.panel', form), lis = $$('#steps li');
    function setNext() {
      var last = step === panels.length - 1;
      var lbl = busy ? 'Booking...' : last ? 'Book for ' + CF.money(total) : 'Continue';
      [$('#next'), $('#mNext')].forEach(function (b) { b.innerHTML = lbl + ' <span class="ic">' + CF.icon.arr + '</span>'; b.disabled = busy; });
    }
    function valid(n) {
      if (n === 1) { var ok = state.date && state.slot; $('#err1').textContent = 'Pick a day and a start time.'; $('#err1').hidden = !!ok; if (!ok) $('#err1').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return ok; }
      if (n === 2) {
        var bad = form.name.value.trim().length < 2 ? form.name : !CF.validPhone(form.phone.value) ? form.phone : form.address.value.trim().length < 3 ? form.address : null;
        [form.name, form.phone, form.address].forEach(function (x) { x.removeAttribute('aria-invalid'); });
        if (bad) {
          bad.setAttribute('aria-invalid', 'true');
          showErr(bad === form.phone ? 'Add a 7 digit Maldives phone number.' : bad === form.name ? 'Add your name.' : 'Add your building and flat.');
          bad.focus();
          return false;
        }
        $('#err2').hidden = true;
      }
      return true;
    }
    function showErr(t) { var e = $('#err2'); e.textContent = t; e.hidden = false; }
    function go(n, quiet) {
      step = n;
      panels.forEach(function (p, k) { p.hidden = k !== n; });
      lis.forEach(function (l, k) { l.className = k === n ? 'on' : k < n ? 'ok' : ''; });
      $('#back').hidden = n === 0; $('#mBack').hidden = n === 0;
      $('#mStep').textContent = 'Step ' + (n + 1) + ' of ' + panels.length;
      summary(); setNext();
      var top = $('#steps').getBoundingClientRect().top + scrollY - 100;
      if (scrollY > top) window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
      var h = panels[n].querySelector('h2'); if (h && !quiet) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
    }
    function next() {
      if (busy || !valid(step)) return;
      if (step < panels.length - 1) return go(step + 1);
      submit();
    }
    $('#next').addEventListener('click', next);
    $('#mNext').addEventListener('click', next);
    $('#back').addEventListener('click', function () { go(step - 1); });
    $('#mBack').addEventListener('click', function () { go(step - 1); });

    /* ---------- book ---------- */
    function submit() {
      busy = true; setNext();
      var method = form.method.value, slip = form.slip && form.slip.files && form.slip.files[0];
      var input = {
        name: form.name.value.trim(), phone: form.phone.value, area: state.area, address: form.address.value.trim(),
        service: state.service, option: state.option, addons: state.addons,
        date: state.date, slot: state.slot, method: method, notes: form.notes.value.trim(), slip: slip || false
      };
      CF.api.createBooking(input).then(function (b) {
        try { localStorage.setItem(ME, JSON.stringify({ phone: CF.normPhone(input.phone), name: input.name, area: input.area, address: input.address })); } catch (e) { }
        done(b, method);
      }, function (e) {
        busy = false; setNext();
        if (e.code === 'full' || e.code === 'friday' || e.code === 'past') {
          state.slot = '';
          return CF.ready('book').then(function () { renderSlots(); go(1); var er = $('#err1'); er.textContent = CF.problem(e) + ' Pick another time.'; er.hidden = false; });
        }
        showErr(CF.problem(e));
      });
    }
    function done(b, method) {
      var s = CF.service(b.service), o = CF.option(b.service, b.option), ph = CF.normPhone(form.phone.value);
      var wa = 'https://wa.me/' + D.phoneIntl + '?text=' + encodeURIComponent('Hi Clean Force, my booking is ' + b.id + '.' + (method === 'transfer' ? ' Sending the transfer slip.' : ''));
      $('#flow').hidden = true; $('#mbar').hidden = true;
      var el = $('#done'); el.hidden = false;
      el.innerHTML = '<div class="done-box"><div class="tick">' + CF.icon.tick + '</div>' +
        '<h1 tabindex="-1">Booked.</h1><p class="lead">We will confirm your team on WhatsApp or SMS.</p>' +
        '<span class="num">' + b.id + '</span>' +
        '<dl><dt>Clean</dt><dd>' + esc(s.name) + ', ' + esc(o.name.toLowerCase()) + '</dd><dt>When</dt><dd>' + CF.relDay(b.date) + ', ' + b.slot + '</dd>' +
        '<dt>Where</dt><dd>' + esc(b.address) + ', ' + esc(CF.area(b.area).name) + '</dd><dt>Pay</dt><dd>' + (method === 'cash' ? 'Cash after the clean' : 'Bank transfer') + '</dd>' +
        '<dt>Total</dt><dd><b>' + CF.money(b.price) + '</b></dd></dl>' +
        (method === 'transfer' ? '<div class="bankbox" style="text-align:left;margin-top:16px"><span>' + esc(D.bank.name) + ' &middot; ' + esc(D.bank.holder) + '. Put <b>' + b.id + '</b> in the remarks.</span><span><code>' + D.bank.account + '</code><button class="copy" type="button" id="copyAcc2">Copy</button></span></div>' : '') +
        '<div class="acts">' + CF.btn('Track it', 'track.html?id=' + b.id + '&phone=' + ph) +
        '<a class="btn btn-line plain" href="account.html">My bookings</a>' +
        '<a class="btn btn-line plain" href="' + wa + '" target="_blank" rel="noopener">' + (method === 'transfer' ? 'WhatsApp the slip' : 'WhatsApp us') + '</a></div></div>';
      var c2 = $('#copyAcc2'); if (c2) c2.addEventListener('click', function () { copy(c2); });
      window.scrollTo(0, 0); $('h1', el).focus();
    }

    renderOptions(); renderSlots();
    if (form.method.value === 'transfer') $('#bankBox').hidden = false;
    go(0, true);
    var wf = $('.wa-float'); if (wf) wf.classList.add('lift');
  }, function () {
    $('#flow').innerHTML = '<h1>Book a clean</h1><p class="lead">We could not load the booking page. Call or WhatsApp ' + D.phone + '.</p>';
  });
})();
