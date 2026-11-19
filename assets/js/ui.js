/* Shared widgets: icons and the before / after slider (home page, tracking, portal). */
(function () {
  var CF = window.CF = window.CF || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  CF.icon = {
    arr: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    tick: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    knob: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg>'
  };
  CF.btn = function (label, href, cls, attrs) { return '<a class="btn ' + (cls || '') + '" href="' + href + '"' + (attrs || '') + '>' + label + ' <span class="ic">' + CF.icon.arr + '</span></a>'; };

  /* makes any .ba element draggable: mouse drags straight away, touch only once the finger moves sideways */
  CF.slider = function (ba) {
    var range = ba.querySelector('input[type=range]'), anim = null, pos = 50;
    var tb = ba.querySelector('.tag.b'), ta = ba.querySelector('.tag.a');
    function set(p) {
      pos = Math.max(0, Math.min(100, p));
      ba.style.setProperty('--x', pos + '%');
      if (range) { range.value = Math.round(pos); range.setAttribute('aria-valuetext', Math.round(pos) + ' percent before'); }
      if (tb) tb.style.opacity = pos < 12 ? 0 : 1; if (ta) ta.style.opacity = pos > 88 ? 0 : 1;
    }
    function stop() { if (anim) { cancelAnimationFrame(anim); anim = null; } }
    function at(e) { var r = ba.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; }
    var dragging = false, decided = false, sx = 0, sy = 0;
    ba.addEventListener('pointerdown', function (e) {
      stop(); dragging = true; decided = e.pointerType === 'mouse'; sx = e.clientX; sy = e.clientY;
      if (decided) { try { ba.setPointerCapture(e.pointerId); } catch (x) { } ba.classList.add('drag'); set(at(e)); e.preventDefault(); }
    });
    ba.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (!decided) {
        var dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true; try { ba.setPointerCapture(e.pointerId); } catch (x) { } ba.classList.add('drag');
      }
      set(at(e));
    });
    function end() { dragging = false; ba.classList.remove('drag'); }
    ba.addEventListener('pointerup', function (e) { if (dragging && !decided) set(at(e)); end(); });
    ba.addEventListener('pointercancel', end);
    if (range) { range.style.pointerEvents = 'none'; range.addEventListener('input', function () { stop(); set(+range.value); }); }
    function sweep() {
      if (reduce) { set(50); return; }
      stop(); var t0 = null, keys = [[0, pos], [700, 86], [1500, 14], [2300, 50]];
      var step = function (t) {
        if (!t0) t0 = t; var el = t - t0, k = 0;
        while (k < keys.length - 2 && el > keys[k + 1][0]) k++;
        var a = keys[k], b = keys[k + 1], u = Math.min(1, (el - a[0]) / (b[0] - a[0]));
        u = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        set(a[1] + (b[1] - a[1]) * u);
        anim = el < keys[keys.length - 1][0] ? requestAnimationFrame(step) : null;
      };
      anim = requestAnimationFrame(step);
    }
    set(50);
    return { set: set, sweep: sweep };
  };

  CF.mountBA = function (host, before, after, label) {
    host.innerHTML = '<div class="ba" data-cursor="Drag"><img class="before" src="' + before + '" alt="' + CF.esc(label || 'Room') + ' before cleaning" draggable="false">' +
      '<img class="after" src="' + after + '" alt="' + CF.esc(label || 'Room') + ' after cleaning" draggable="false">' +
      '<span class="bar"></span><span class="knob">' + CF.icon.knob + '</span><span class="tag b">Before</span><span class="tag a">After</span>' +
      '<input type="range" min="0" max="100" step="5" value="50" aria-label="Before and after position"></div>';
    var s = CF.slider(host.firstChild); setTimeout(s.sweep, 250); return s;
  };

  /* number tween for prices */
  CF.tween = function (el, to, fmt) {
    var from = +(el.dataset.v || 0); el.dataset.v = to;
    if (reduce || !from) { el.textContent = fmt(to); return; }
    var t0 = performance.now();
    (function f(t) { var u = Math.min(1, (t - t0) / 500); u = 1 - Math.pow(1 - u, 3); el.textContent = fmt(Math.round(from + (to - from) * u)); if (u < 1) requestAnimationFrame(f); })(t0);
  };
})();
