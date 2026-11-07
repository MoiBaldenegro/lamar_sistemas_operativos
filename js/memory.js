(function () {
  'use strict';

  var sim = document.getElementById('memorySim');
  if (!sim) return;

  var FRAME_COUNT = 4;
  var PAGE_COUNT = 6;
  var SEQUENCE = [0, 1, 2, 3, 0, 4, 1, 5, 2, 3, 4, 5];

  var policySel = document.getElementById('memPolicy');
  var framesEl = document.getElementById('memFrames');
  var swapEl = document.getElementById('memSwap');
  var pageTableEl = document.getElementById('memPageTable');
  var logEl = document.getElementById('memLog');
  var accessesEl = document.getElementById('memAccesses');
  var hitsEl = document.getElementById('memHits');
  var faultsEl = document.getElementById('memFaults');
  var rateEl = document.getElementById('memRate');
  var buttonsWrap = document.getElementById('memAccessButtons');
  var autoBtn = document.getElementById('memAuto');
  var resetBtn = document.getElementById('memReset');

  var frames = new Array(FRAME_COUNT).fill(null);
  var loadOrder = [];
  var lastUsed = {};
  var accesses = 0;
  var hits = 0;
  var faults = 0;
  var autoRunning = false;
  var autoToken = 0;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function policy() {
    return policySel ? policySel.value : 'fifo';
  }

  function log(text, cls) {
    if (!logEl) return;
    var p = document.createElement('p');
    p.className = 'log-line ' + (cls || '');
    p.textContent = text;
    logEl.appendChild(p);
    while (logEl.children.length > 7) logEl.removeChild(logEl.firstElementChild);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function frameIndex(page) {
    return frames.indexOf(page);
  }

  function renderFrames() {
    if (!framesEl) return;
    framesEl.innerHTML = '';
    frames.forEach(function (page, i) {
      var el = document.createElement('div');
      el.className = 'frame' + (page !== null ? ' is-filled' : '');
      el.setAttribute('data-frame', String(i));
      el.innerHTML = page !== null
        ? '<b>P' + page + '</b><span>marco ' + i + '</span>'
        : '<b>libre</b><span>marco ' + i + '</span>';
      framesEl.appendChild(el);
    });
  }

  function renderSwap() {
    if (!swapEl) return;
    swapEl.innerHTML = '';
    for (var p = 0; p < PAGE_COUNT; p++) {
      var inRam = frameIndex(p) !== -1;
      var chip = document.createElement('span');
      chip.className = 'swap-chip' + (inRam ? ' is-out' : '');
      chip.textContent = 'P' + p;
      chip.title = inRam ? 'En RAM' : 'En disco (swap)';
      swapEl.appendChild(chip);
    }
  }

  function renderPageTable() {
    if (!pageTableEl) return;
    pageTableEl.innerHTML = '';
    for (var p = 0; p < PAGE_COUNT; p++) {
      var idx = frameIndex(p);
      var entry = document.createElement('div');
      entry.className = 'page-entry' + (idx === -1 ? ' is-disk' : '');
      entry.innerHTML = '<span>P' + p + '</span><b>' + (idx === -1 ? 'disco' : 'marco ' + idx) + '</b>';
      pageTableEl.appendChild(entry);
    }
  }

  function renderStats() {
    if (accessesEl) accessesEl.textContent = String(accesses);
    if (hitsEl) hitsEl.textContent = String(hits);
    if (faultsEl) faultsEl.textContent = String(faults);
    if (rateEl) rateEl.textContent = accesses ? Math.round((faults / accesses) * 100) + '%' : '0%';
  }

  function render() {
    renderFrames();
    renderSwap();
    renderPageTable();
    renderStats();
  }

  function flashFrame(index, cls) {
    if (!framesEl) return;
    var el = framesEl.querySelector('[data-frame="' + index + '"]');
    if (!el) return;
    el.classList.remove('is-hit', 'is-fault');
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(function () { el.classList.remove(cls); }, 650);
  }

  function chooseVictim() {
    if (!frames.length) return null;
    if (policy() === 'fifo') {
      return loadOrder.length ? loadOrder[0] : frames[0];
    }
    return frames.reduce(function (best, page) {
      if (page === null) return best;
      if (best === null) return page;
      return (lastUsed[page] || 0) < (lastUsed[best] || 0) ? page : best;
    }, null);
  }

  function access(page) {
    accesses += 1;
    var idx = frameIndex(page);
    var flashTarget;

    if (idx !== -1) {
      hits += 1;
      lastUsed[page] = accesses;
      log('Acierto · P' + page + ' ya está en RAM (marco ' + idx + ').', 'log-user');
      flashTarget = { index: idx, cls: 'is-hit' };
    } else {
      faults += 1;
      var free = frames.indexOf(null);

      if (free === -1) {
        var victim = chooseVictim();
        var victimFrame = frameIndex(victim);
        frames[victimFrame] = null;
        loadOrder = loadOrder.filter(function (p) { return p !== victim; });
        log(
          'Fallo de página · P' + page + ' no está en RAM. Expulsando P' + victim +
          ' (' + policy().toUpperCase() + ').',
          'log-kernel'
        );
        flashTarget = { index: victimFrame, cls: 'is-fault' };
        free = victimFrame;
      } else {
        log('Fallo de página · P' + page + ' no está en RAM. Cargando en el marco ' + free + '.', 'log-kernel');
        flashTarget = { index: free, cls: 'is-fault' };
      }

      frames[free] = page;
      lastUsed[page] = accesses;
      loadOrder = loadOrder.filter(function (p) { return p !== page; });
      loadOrder.push(page);
    }

    render();
    if (flashTarget) flashFrame(flashTarget.index, flashTarget.cls);
  }

  async function runSequence() {
    if (autoRunning) return;
    autoRunning = true;
    var myToken = ++autoToken;
    if (autoBtn) autoBtn.disabled = true;
    setButtonsDisabled(true);

    for (var i = 0; i < SEQUENCE.length; i++) {
      if (myToken !== autoToken) break;
      access(SEQUENCE[i]);
      await wait(720);
    }

    if (myToken === autoToken) {
      autoRunning = false;
      if (autoBtn) autoBtn.disabled = false;
      setButtonsDisabled(false);
    }
  }

  function setButtonsDisabled(disabled) {
    if (!buttonsWrap) return;
    Array.prototype.forEach.call(buttonsWrap.querySelectorAll('button'), function (btn) {
      btn.disabled = disabled;
    });
  }

  function reset() {
    autoToken += 1;
    autoRunning = false;
    frames = new Array(FRAME_COUNT).fill(null);
    loadOrder = [];
    lastUsed = {};
    accesses = 0;
    hits = 0;
    faults = 0;
    if (autoBtn) autoBtn.disabled = false;
    setButtonsDisabled(false);
    render();
    if (logEl) {
      logEl.innerHTML = '<p class="log-line log-muted">Accede a una página para comenzar. Los marcos están vacíos.</p>';
    }
  }

  function buildButtons() {
    if (!buttonsWrap) return;
    for (var p = 0; p < PAGE_COUNT; p++) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'page-btn';
      btn.textContent = 'P' + p;
      btn.setAttribute('aria-label', 'Acceder a la página ' + p);
      btn.dataset.page = String(p);
      btn.addEventListener('click', function (e) {
        access(parseInt(e.currentTarget.dataset.page, 10));
      });
      buttonsWrap.appendChild(btn);
    }
  }

  if (policySel) {
    policySel.addEventListener('change', function () {
      log('Política de reemplazo: ' + policy().toUpperCase() + '.', 'log-action');
    });
  }
  if (autoBtn) autoBtn.addEventListener('click', runSequence);
  if (resetBtn) resetBtn.addEventListener('click', reset);

  window.addEventListener('deck:change', function (e) {
    if (e.detail.slide && e.detail.slide.id !== 'slide-6') {
      autoToken += 1;
      autoRunning = false;
      if (autoBtn) autoBtn.disabled = false;
      setButtonsDisabled(false);
    }
  });

  buildButtons();
  reset();
})();
