/* Clean Force: public site behaviour. Plain JS, no libraries. */
(function () {
  var D = window.CF_DATA, CF = window.CF;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var db = CF.db();
  var root = document.documentElement;

  /* ---------- header ---------- */
  var hdr = $('#hdr');
  if (hdr) {
    var hero = $('#hero'), lastY = 0;
    var onScroll = function () {
      var y = window.scrollY;
      var solidAt = hero ? hero.offsetHeight - 90 : 10;
      hdr.classList.toggle('solid', y > solidAt);
      hdr.classList.toggle('hide', y > 400 && y > lastY + 4 && !document.body.classList.contains('menu-open'));
      if (y < lastY - 4 || y < 400) hdr.classList.remove('hide');
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  /* WhatsApp button waits until the visitor has scrolled past the hero price bar */
  var wa = $('.wa-float'), heroBox = $('#hero');
  if (wa && heroBox) {
    var waTick = function () { wa.classList.toggle('away', window.scrollY < heroBox.offsetHeight * .75); };
    window.addEventListener('scroll', waTick, { passive: true }); waTick();
  }

  /* ---------- mobile menu ---------- */
  var mnav = $('#mnav'), mbtn = $('#menuBtn');
  if (mnav && mbtn) {
    var main = $('#main');
    var setMenu = function (open) {
      mnav.classList.toggle('open', open); mbtn.setAttribute('aria-expanded', open);
      document.body.classList.toggle('menu-open', open); document.body.style.overflow = open ? 'hidden' : '';
      [main, $('.ftr'), $('.mini-ftr'), $('.wa-float'), hdr].forEach(function (el) { if (el) el.inert = open; });
      if (open) $('#menuClose').focus(); else mbtn.focus();
    };
    mbtn.addEventListener('click', function () { setMenu(true); });
    $('#menuClose').addEventListener('click', function () { setMenu(false); });
    $$('a', mnav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mnav.classList.contains('open')) setMenu(false); });
  }

  /* ---------- quick price bar ---------- */
  var qs = $('#qService');
  if (qs) {
    var qo = $('#qOption'), qa = $('#qArea'), qp = $('#qPrice'), qu = $('#qUnit');
    qs.innerHTML = D.services.map(function (s) { return '<option value="' + s.id + '">' + CF.esc(s.name) + '</option>'; }).join('');
    qa.innerHTML = D.areas.map(function (a) { return '<option value="' + a.id + '">' + CF.esc(a.name) + '</option>'; }).join('');
    qa.value = 'hulhumale2';
    var fillOpts = function () {
      var s = CF.service(qs.value);
      qu.textContent = s.unit;
      qo.innerHTML = s.options.map(function (o) { return '<option value="' + o.id + '">' + CF.esc(o.name) + '</option>'; }).join('');
      if (s.options[1]) qo.value = s.options[1].id;
    };
    var upd = function () {
      var s = CF.service(qs.value);
      var p = CF.price(qs.value, qo.value, db);
      qp.textContent = CF.money(p) + (s.monthly ? ' / mo' : '');
      qp.animate && !reduce && qp.animate([{ opacity: .2, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 350, easing: 'cubic-bezier(.2,.7,.1,1)' });
    };
    qs.addEventListener('change', function () { fillOpts(); upd(); });
    qo.addEventListener('change', upd);
    fillOpts(); qs.value = 'home'; fillOpts(); upd();
  }

  /* ---------- services list ---------- */
  var list = $('#svcList');
  if (list) {
    list.innerHTML = D.services.map(function (s, i) {
      var from = CF.fromPrice(s.id, db);
      return '<a class="svc" href="book.html?service=' + s.id + '" data-img="' + s.img + '" data-reveal style="--d:' + (i * .05) + 's">' +
        '<span class="th"><img src="' + s.img + '" alt="" loading="lazy"></span>' +
        '<span class="nm">' + CF.esc(s.name) + ' <small>' + CF.esc(s.short) + '</small></span>' +
        '<span class="pr"><small>from </small>' + CF.money(from) + (s.monthly ? '<small> / mo</small>' : '') + '</span>' +
        '<span class="ar" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></a>';
    }).join('');
    var mf = $('#monthlyFrom'); if (mf) mf.textContent = CF.money(CF.fromPrice('monthly', db));
    var of = $('#officeFrom'); if (of) of.textContent = CF.money(CF.fromPrice('office', db));
  }
  var fs = $('#ftrSvc');
  if (fs) fs.innerHTML = D.services.map(function (s) { return '<li><a href="book.html?service=' + s.id + '">' + CF.esc(s.name) + '</a></li>'; }).join('');

  /* ---------- areas ---------- */
  var track = $('#areaTrack');
  if (track) {
    var counts = {};
    db.customers.forEach(function (c) { counts[c.area] = (counts[c.area] || 0) + 1; });
    track.innerHTML = D.areas.map(function (a, i) {
      return '<a class="area" href="book.html?area=' + a.id + '" data-cursor="Book" data-reveal style="--d:' + (i * .08) + 's">' +
        '<img src="' + a.img + '" alt="' + CF.esc(a.name) + '" loading="lazy">' +
        '<span class="lbl"><b>' + CF.esc(a.name) + '</b><span>Book here <i>&rarr;</i></span></span></a>';
    }).join('');
  }

  /* ---------- before / after slider ---------- */
  var ba = $('#ba');
  if (ba) {
    var range = $('#baRange'), pos = 50, anim = null;
    var set = function (p) { pos = Math.max(0, Math.min(100, p)); ba.style.setProperty('--p', pos + '%'); range.value = Math.round(pos); range.setAttribute('aria-valuetext', Math.round(pos) + '% before shown');
      $('.tag.b', ba).style.opacity = pos < 12 ? 0 : 1; $('.tag.a', ba).style.opacity = pos > 88 ? 0 : 1; };
    var fromEvent = function (e) { var r = ba.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
    var stop = function () { if (anim) { cancelAnimationFrame(anim); anim = null; } };
    var dragging = false, startX = 0, startY = 0, decided = false;
    ba.addEventListener('pointerdown', function (e) {
      stop(); dragging = true; decided = e.pointerType === 'mouse'; startX = e.clientX; startY = e.clientY;
      if (decided) { ba.setPointerCapture(e.pointerId); ba.classList.add('drag'); set(fromEvent(e)); }
    });
    ba.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (!decided) { // touch: only take over when the finger moves sideways, so the page can still scroll
        var dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true; ba.setPointerCapture(e.pointerId); ba.classList.add('drag');
      }
      set(fromEvent(e));
    });
    var end = function () { dragging = false; ba.classList.remove('drag'); };
    ba.addEventListener('pointerup', function (e) { if (!decided && dragging) set(fromEvent(e)); end(); });
    ba.addEventListener('pointercancel', end);
    range.addEventListener('input', function () { stop(); set(+range.value); });
    // keyboard: the range input is the focus target
    range.style.pointerEvents = 'none';

    var sweep = function () {
      if (reduce) { set(50); return; }
      stop(); var t0 = null, keys = [[0, 50], [700, 88], [1500, 12], [2300, 50]];
      var step = function (t) {
        if (!t0) t0 = t; var e = t - t0, k = 0;
        while (k < keys.length - 2 && e > keys[k + 1][0]) k++;
        var a = keys[k], b = keys[k + 1], u = Math.min(1, (e - a[0]) / (b[0] - a[0]));
        u = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        set(a[1] + (b[1] - a[1]) * u);
        anim = e < keys[keys.length - 1][0] ? requestAnimationFrame(step) : null;
      };
      anim = requestAnimationFrame(step);
    };
    var seen = false;
    new IntersectionObserver(function (es, o) { es.forEach(function (en) { if (en.isIntersecting && !seen) { seen = true; setTimeout(sweep, 500); o.disconnect(); } }); }, { threshold: .55 }).observe(ba);

    var caps = {
      living: ['Living room', 'Deep cleaning, 2 bedroom flat', 'deep'],
      kitchen: ['Kitchen', 'Kitchen deep clean, grease and hob', 'bath'],
      bathroom: ['Bathroom', 'Scale, mould and grout', 'bath'],
      bedroom: ['Bedroom', 'Home cleaning, tidy and dust', 'home'],
      sofa: ['Sofa', 'Shampoo and stain removal, 3 seats', 'sofa']
    };
    var tabs = $$('#baTabs .tab');
    // preload all pairs after the page settles
    window.addEventListener('load', function () { setTimeout(function () { Object.keys(caps).forEach(function (k) { new Image().src = 'assets/img/ba/' + k + '-before.jpg'; new Image().src = 'assets/img/ba/' + k + '-after.jpg'; }); }, 1200); });
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        var k = t.dataset.room, c = caps[k];
        tabs.forEach(function (x) { x.setAttribute('aria-selected', x === t); x.tabIndex = x === t ? 0 : -1; });
        var bi = $('.before', ba), ai = $('.after', ba);
        ba.style.opacity = .35;
        var n = 0, done = function () { if (++n === 2) { ba.style.opacity = 1; sweep(); } };
        bi.onload = ai.onload = done;
        bi.src = 'assets/img/ba/' + k + '-before.jpg'; ai.src = 'assets/img/ba/' + k + '-after.jpg';
        bi.alt = c[0] + ' before cleaning'; ai.alt = 'The same ' + c[0].toLowerCase() + ' after cleaning';
        if (bi.complete && ai.complete) { n = 0; done(); done(); }
        $('#baCap').innerHTML = '<b>' + c[0] + '</b> · ' + c[1];
        $('#baBook').href = 'book.html?service=' + c[2];
      });
      t.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : null;
        if (j === null) return; j = (j + tabs.length) % tabs.length; tabs[j].focus(); tabs[j].click();
      });
    });
    ba.style.transition = 'opacity .3s';
    set(50);
  }

  /* ---------- split headings into words ---------- */
  $$('[data-split]').forEach(function (el) {
    var i = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'); w.className = 'w';
            var s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    };
    walk(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  });

  /* ---------- reveals ---------- */
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  $$('[data-reveal], [data-mask], [data-split]').forEach(function (el) { io.observe(el); });

  /* ---------- counters ---------- */
  $$('[data-count]').forEach(function (el) {
    if (reduce) return;
    var to = +el.dataset.count; el.textContent = '0';
    new IntersectionObserver(function (es, o) {
      if (!es[0].isIntersecting) return; o.disconnect();
      var t0 = performance.now();
      (function f(t) { var u = Math.min(1, (t - t0) / 1100); el.textContent = Math.round(to * (1 - Math.pow(1 - u, 3))); if (u < 1) requestAnimationFrame(f); })(t0);
    }, { threshold: .6 }).observe(el);
  });

  /* ---------- parallax + area drift (one rAF loop) ---------- */
  var para = $$('[data-parallax]'), drift = $('[data-drift]');
  if (!reduce && (para.length || drift)) {
    var ticking = false;
    var frame = function () {
      ticking = false; var vh = window.innerHeight;
      para.forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.bottom < -200 || r.top > vh + 200) return;
        var k = +el.dataset.parallax, c = r.top + r.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + (-c * k).toFixed(1) + 'px,0)';
      });
      if (drift && window.innerWidth > 760) {
        var r2 = drift.getBoundingClientRect(), p = (vh - r2.top) / (vh + r2.height);
        p = Math.max(0, Math.min(1, p));
        drift.style.transform = 'translate3d(' + ((.5 - p) * 24).toFixed(1) + 'px,0,0)';
      }
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
    window.addEventListener('resize', frame); frame();
  }

  /* ---------- cursor, labels, service peek, hero bubbles ---------- */
  if (fine && !reduce) {
    var cur = $('#cur'), lbl = $('#curLbl'), peek = $('#peek');
    var mx = -100, my = -100, cx = -100, cy = -100, px = -100, py = -100;
    var loop = function () {
      cx += (mx - cx) * .2; cy += (my - cy) * .2; px += (mx - px) * .12; py += (my - py) * .12;
      if (cur) cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      if (lbl) lbl.style.left = cx + 'px', lbl.style.top = cy + 'px';
      if (peek) { peek.style.left = px + 'px'; peek.style.top = py + 'px'; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    document.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; cur && cur.classList.add('vis'); }, { passive: true });
    document.addEventListener('pointerleave', function () { cur && cur.classList.remove('vis'); });
    document.addEventListener('pointerdown', function () { cur && cur.classList.add('down'); });
    document.addEventListener('pointerup', function () { cur && cur.classList.remove('down'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target.closest ? e.target.closest('a, button, select, input, label, [data-cursor]') : null;
      var lab = e.target.closest ? e.target.closest('[data-cursor]') : null;
      if (cur) cur.classList.toggle('hov', !!t && !lab);
      if (lbl) { lbl.classList.toggle('on', !!lab); if (lab) lbl.textContent = lab.dataset.cursor; if (cur) cur.style.opacity = lab ? 0 : ''; }
    });
    // service row: a photo follows the pointer
    if (peek && list) {
      var cache = {};
      $$('.svc', list).forEach(function (row) {
        row.addEventListener('pointerenter', function () {
          var src = row.dataset.img;
          if (!cache[src]) { var im = new Image(); im.src = src; im.alt = ''; cache[src] = im; peek.appendChild(im); }
          $$('img', peek).forEach(function (im) { im.style.opacity = im === cache[src] ? 1 : 0; });
          peek.classList.add('on'); peek.style.transform = 'translate(-50%,-50%) scale(1)';
        });
        row.addEventListener('pointerleave', function () { peek.classList.remove('on'); peek.style.transform = 'translate(-50%,-50%) scale(.6)'; });
      });
    }
    // bubbles rise from the pointer over the hero (the logo's bubbles)
    var heroEl = $('#hero');
    if (heroEl) {
      var lx = 0, ly = 0, live = 0;
      heroEl.addEventListener('pointermove', function (e) {
        var r = heroEl.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
        if (Math.hypot(x - lx, y - ly) < 46 || live > 14) return; lx = x; ly = y;
        var b = document.createElement('span'), s = 8 + Math.random() * 18;
        b.className = 'bub'; b.style.cssText = 'left:' + (x + (Math.random() - .5) * 20) + 'px;top:' + y + 'px;width:' + s + 'px;height:' + s + 'px;animation-duration:' + (1.1 + Math.random() * .8) + 's';
        heroEl.appendChild(b); live++;
        b.addEventListener('animationend', function () { b.remove(); live--; });
      });
    }
  }

  window.CF_READY = true;
  requestAnimationFrame(function () { root.classList.add('ready'); });
})();
