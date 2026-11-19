/* Clean Force: behaviour shared by every public page. Plain JS, no libraries. */
(function () {
  var CF = window.CF;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  CF.$ = $; CF.$$ = $$;

  /* ---------- header: turns solid once you scroll, hides while scrolling down ---------- */
  var hdr = $('#hdr'), lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    hdr.classList.toggle('solid', y > 24);
    if (y > 500 && y > lastY + 6 && !document.body.classList.contains('menu-open')) hdr.classList.add('away');
    else if (y < lastY - 6 || y < 500) hdr.classList.remove('away');
    lastY = y;
  }
  if (hdr) { window.addEventListener('scroll', onScroll, { passive: true }); onScroll(); hdr.addEventListener('focusin', function () { hdr.classList.remove('away'); }); }

  /* WhatsApp button stays out of the way on the home hero */
  var wa = $('.wa-float'), hero = $('#hero');
  if (wa && hero) { var waTick = function () { wa.classList.toggle('away', window.scrollY < hero.offsetHeight * .7); }; window.addEventListener('scroll', waTick, { passive: true }); waTick(); }

  /* ---------- mobile menu ---------- */
  var mnav = $('#mnav'), mbtn = $('#menuBtn');
  if (mnav && mbtn) {
    var setMenu = function (open) {
      mnav.classList.toggle('open', open); mbtn.setAttribute('aria-expanded', open);
      document.body.classList.toggle('menu-open', open); document.body.style.overflow = open ? 'hidden' : '';
      [$('#main'), $('.ftr'), $('.mini-ftr'), wa, hdr].forEach(function (el) { if (el) el.inert = open; });
      if (open) $('#menuClose').focus(); else mbtn.focus();
    };
    mbtn.addEventListener('click', function () { setMenu(true); });
    $('#menuClose').addEventListener('click', function () { setMenu(false); });
    $$('a', mnav).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mnav.classList.contains('open')) setMenu(false); });
  }

  /* ---------- headings rise word by word ---------- */
  CF.split = function (el) {
    if (el.querySelector('.w')) return;
    var i = 0;
    (function walk(node) {
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
    })(el);
    if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  };
  $$('[data-split]').forEach(CF.split);

  /* ---------- reveal on scroll ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -6% 0px' }) : null;
  CF.reveal = function (root) { $$('[data-reveal], [data-mask], [data-split], [data-pimg]', root).forEach(function (el) { if (io) io.observe(el); else el.classList.add('in'); }); };
  CF.reveal(document);

  /* ---------- gentle parallax on marked elements ---------- */
  var para = $$('[data-par]');
  if (!reduce && para.length) {
    var ticking = false;
    var frame = function () {
      ticking = false; var vh = window.innerHeight;
      para.forEach(function (el) {
        var r = el.getBoundingClientRect(); if (r.bottom < -100 || r.top > vh + 100) return;
        el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - vh / 2) * -(+el.dataset.par)).toFixed(1) + 'px,0)';
      });
    };
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
    frame();
  }

  /* ---------- cursor ring, labels, photo peek, bubbles ---------- */
  if (fine && !reduce) {
    var cur = $('#cur'), lbl = $('#curLbl'), peek = $('#peek'), peekCache = {};
    var mx = -100, my = -100, cx = -100, cy = -100, px = -100, py = -100;
    (function loop() {
      cx += (mx - cx) * .22; cy += (my - cy) * .22; px += (mx - px) * .12; py += (my - py) * .12;
      if (cur) cur.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
      if (lbl) { lbl.style.left = cx + 'px'; lbl.style.top = cy + 'px'; }
      if (peek) { peek.style.left = px + 'px'; peek.style.top = py + 'px'; }
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointermove', function (e) { mx = e.clientX; my = e.clientY; if (cur) cur.classList.add('on'); }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { if (cur) cur.classList.remove('on'); });
    document.addEventListener('pointerover', function (e) {
      var t = e.target && e.target.closest ? e.target : document.body;
      var lab = t.closest('[data-cursor]');
      if (cur) { cur.classList.toggle('big', !!lab); cur.classList.toggle('dark', !!t.closest('.panel-navy, .cta, .t3, .mnav, .visit')); }
      if (lbl) { lbl.classList.toggle('on', !!lab); if (lab) lbl.textContent = lab.dataset.cursor; }
      if (peek) {
        var row = t.closest('[data-img]');
        if (!row) { peek.classList.remove('on'); return; }
        var src = row.dataset.img;
        if (!peekCache[src]) { var im = new Image(); im.src = src; im.alt = ''; peekCache[src] = im; peek.appendChild(im); }
        $$('img', peek).forEach(function (im) { im.style.display = im === peekCache[src] ? '' : 'none'; });
        peek.classList.add('on');
      }
    });
    // the logo's bubbles rise from the pointer over the hero
    if (hero) {
      var lx = 0, ly = 0, live = 0;
      hero.addEventListener('pointermove', function (e) {
        if (Math.hypot(e.clientX - lx, e.clientY - ly) < 44 || live > 14) return; lx = e.clientX; ly = e.clientY;
        var b = document.createElement('span'), s = 8 + Math.random() * 18;
        b.className = 'trail'; b.style.cssText = 'left:' + (e.clientX - s / 2 + (Math.random() - .5) * 18) + 'px;top:' + (e.clientY - s / 2) + 'px;width:' + s + 'px;height:' + s + 'px;animation-duration:' + (1.1 + Math.random() * .8) + 's';
        document.body.appendChild(b); live++;
        b.addEventListener('animationend', function () { if (b.parentNode) b.parentNode.removeChild(b); live--; });
      });
    }
  }
  window.CF_READY = true;
})();
