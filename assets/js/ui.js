/* Small shared widgets for the track page and the portals. */
(function () {
  var CF = window.CF;
  /* a compact before / after slider: drag, tap or use the arrow keys */
  CF.mountBA = function (host, before, after, label) {
    host.innerHTML = '<div class="ba" style="--p:50%">' +
      '<img class="before" src="' + before + '" alt="' + CF.esc(label || 'Room') + ' before cleaning" draggable="false">' +
      '<img class="after" src="' + after + '" alt="' + CF.esc(label || 'Room') + ' after cleaning" draggable="false">' +
      '<span class="bar"></span><span class="knob"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span>' +
      '<span class="tag b">Before</span><span class="tag a">After</span>' +
      '<input type="range" min="0" max="100" value="50" aria-label="Before and after position"></div>';
    var ba = host.firstChild, r = ba.querySelector('input'), drag = false;
    var set = function (p) { p = Math.max(0, Math.min(100, p)); ba.style.setProperty('--p', p + '%'); r.value = Math.round(p); };
    var at = function (e) { var b = ba.getBoundingClientRect(); return (e.clientX - b.left) / b.width * 100; };
    ba.addEventListener('pointerdown', function (e) { drag = true; if (e.pointerType === 'mouse') ba.setPointerCapture(e.pointerId); set(at(e)); });
    ba.addEventListener('pointermove', function (e) { if (drag && e.pointerType === 'mouse') set(at(e)); });
    ba.addEventListener('pointerup', function () { drag = false; });
    ba.addEventListener('pointercancel', function () { drag = false; });
    r.addEventListener('input', function () { set(+r.value); });
    return ba;
  };
})();
