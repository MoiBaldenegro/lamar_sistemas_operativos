(function () {
  'use strict';

  var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
  if (!slides.length) return;

  var total = slides.length;
  var current = 0;

  var progressFill = document.getElementById('progressFill');
  var slideCurrent = document.getElementById('slideCurrent');
  var slideTotal = document.getElementById('slideTotal');
  var prevBtn = document.getElementById('prevBtn');
  var nextBtn = document.getElementById('nextBtn');
  var dotsWrap = document.getElementById('dots');
  var fullscreenBtn = document.getElementById('fullscreenBtn');
  var deck = document.getElementById('deck');

  if (slideTotal) slideTotal.textContent = String(total);

  var dots = slides.map(function (slide, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'dot' + (i === 0 ? ' is-active' : '');
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', 'Diapositiva ' + (i + 1) + ': ' + (slide.dataset.title || ''));
    dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    dot.addEventListener('click', function () { goTo(i); });
    if (dotsWrap) dotsWrap.appendChild(dot);
    return dot;
  });

  function goTo(index, options) {
    options = options || {};
    index = Math.max(0, Math.min(total - 1, index));
    if (index === current && !options.force) return;

    var previous = current;
    current = index;

    slides.forEach(function (slide, i) {
      slide.classList.toggle('is-active', i === index);
      slide.setAttribute('aria-hidden', i === index ? 'false' : 'true');
    });

    dots.forEach(function (dot, i) {
      dot.classList.toggle('is-active', i === index);
      dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });

    if (progressFill) progressFill.style.width = ((index + 1) / total) * 100 + '%';
    if (slideCurrent) slideCurrent.textContent = String(index + 1);
    if (prevBtn) prevBtn.disabled = index === 0;
    if (nextBtn) nextBtn.disabled = index === total - 1;

    var active = slides[index];
    if (active && options.scroll !== false) active.scrollTop = 0;

    try {
      if (history.replaceState) {
        history.replaceState(null, '', '#' + (index + 1));
      } else {
        location.hash = '#' + (index + 1);
      }
    } catch (err) {
      /* algunos navegadores bloquean replaceState en file:// */
    }

    window.dispatchEvent(new CustomEvent('deck:change', {
      detail: { index: index, previous: previous, slide: active }
    }));
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);

  Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      goTo(parseInt(btn.dataset.goto, 10) || 0);
    });
  });

  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function isActivatable(el) {
    if (!el) return false;
    var tag = el.tagName;
    return tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY' || tag === 'LABEL';
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isEditable(e.target)) return;
    if (e.key === ' ' && isActivatable(e.target)) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        next();
        break;
      case ' ':
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        prev();
        break;
      case 'Home':
        e.preventDefault();
        goTo(0);
        break;
      case 'End':
        e.preventDefault();
        goTo(total - 1);
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      default:
        break;
    }
  });

  var touchStart = null;
  if (deck) {
    deck.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    deck.addEventListener('touchend', function (e) {
      if (!touchStart) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - touchStart.x;
      var dy = t.clientY - touchStart.y;
      touchStart = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        if (dx < 0) next(); else prev();
      }
    }, { passive: true });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      var el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen();
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }

  if (fullscreenBtn) fullscreenBtn.addEventListener('click', toggleFullscreen);

  var initial = 0;
  if (location.hash) {
    var parsed = parseInt(location.hash.replace('#', ''), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= total) initial = parsed - 1;
  }

  window.Deck = {
    goTo: goTo,
    next: next,
    prev: prev,
    get index() { return current; },
    get total() { return total; }
  };

  goTo(initial, { force: true });
})();
