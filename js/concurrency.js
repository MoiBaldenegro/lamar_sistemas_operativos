(function () {
  'use strict';

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function appendLog(el, text, cls, maxLines) {
    if (!el) return;
    var p = document.createElement('p');
    p.className = 'log-line ' + (cls || '');
    p.textContent = text;
    el.appendChild(p);
    while (maxLines && el.children.length > maxLines) {
      el.removeChild(el.firstElementChild);
    }
    el.scrollTop = el.scrollHeight;
  }

  /* ============================================================
     Cambio de contexto
     ============================================================ */
  var ctxSim = document.getElementById('ctxSim');
  if (ctxSim) {
    var ctxSwitch = document.getElementById('ctxSwitch');
    var ctxLog = document.getElementById('ctxLog');
    var pcbA = document.getElementById('pcbA');
    var pcbB = document.getElementById('pcbB');
    var cpuPc = document.getElementById('cpuPc');
    var cpuSp = document.getElementById('cpuSp');
    var cpuR1 = document.getElementById('cpuR1');

    var ctxState = {
      A: { pc: '0x1F4', sp: '0x7FF0', r1: '42', status: 'Ejecutando' },
      B: { pc: '0x8A0', sp: '0x7E20', r1: '17', status: 'Listo' }
    };

    var ctxRunning = 'A';
    var ctxBusy = false;
    var ctxGeneration = 0;

    function pcbFor(key) { return key === 'A' ? pcbA : pcbB; }

    function incHex(hex, amount) {
      return '0x' + (parseInt(hex, 16) + amount).toString(16).toUpperCase();
    }

    function writePcb(key) {
      var el = pcbFor(key);
      var state = ctxState[key];
      if (!el) return;
      Array.prototype.forEach.call(el.querySelectorAll('[data-f]'), function (node) {
        var field = node.getAttribute('data-f');
        if (state[field] !== undefined) node.textContent = state[field];
      });
      el.classList.toggle('is-running', state.status === 'Ejecutando');
      el.classList.toggle('is-idle', state.status !== 'Ejecutando');
      var badge = el.querySelector('[data-state]');
      if (badge) badge.textContent = state.status === 'Ejecutando' ? 'EJEC' : 'LISTO';
    }

    function renderCpu(state, flash) {
      if (cpuPc) cpuPc.textContent = state.pc;
      if (cpuSp) cpuSp.textContent = state.sp;
      if (cpuR1) cpuR1.textContent = state.r1;
      if (flash) {
        Array.prototype.forEach.call(ctxSim.querySelectorAll('.reg'), function (reg) {
          reg.classList.remove('is-flash');
          void reg.offsetWidth;
          reg.classList.add('is-flash');
        });
      }
    }

    function ctxResetVisual() {
      ctxState.A = { pc: '0x1F4', sp: '0x7FF0', r1: '42', status: 'Ejecutando' };
      ctxState.B = { pc: '0x8A0', sp: '0x7E20', r1: '17', status: 'Listo' };
      ctxRunning = 'A';
      writePcb('A');
      writePcb('B');
      renderCpu(ctxState.A, false);
      if (ctxLog) {
        ctxLog.innerHTML = '<p class="log-line log-muted">El proceso A está en la CPU. Pulsa “Cambiar contexto”.</p>';
      }
    }

    async function doContextSwitch() {
      if (ctxBusy) return;
      ctxBusy = true;
      if (ctxSwitch) ctxSwitch.disabled = true;
      var myGeneration = ++ctxGeneration;

      var from = ctxRunning;
      var to = from === 'A' ? 'B' : 'A';
      var fromEl = pcbFor(from);
      var toEl = pcbFor(to);

      ctxState[from].pc = incHex(ctxState[from].pc, 4);
      ctxState[from].r1 = String(parseInt(ctxState[from].r1, 10) + 3);
      renderCpu(ctxState[from], true);
      appendLog(ctxLog, '[' + from + '] Ejecutó una instrucción: PC += 4, R1 += 3.', 'log-action', 12);
      appendLog(ctxLog, '[' + from + '] Guardando PC, SP y registros en su PCB…', 'log-warn', 12);
      if (fromEl) fromEl.classList.add('is-saving');
      await wait(480);
      if (myGeneration !== ctxGeneration) return;

      ctxState[from].status = 'Listo';
      writePcb(from);
      if (fromEl) {
        fromEl.classList.remove('is-saving');
        fromEl.classList.add('is-idle');
      }
      appendLog(ctxLog, '[' + from + '] Estado guardado. El proceso pasa a Listo.', 'log-user', 12);
      await wait(400);
      if (myGeneration !== ctxGeneration) return;

      ctxState[to].status = 'Ejecutando';
      writePcb(to);
      if (toEl) {
        toEl.classList.remove('is-idle');
        toEl.classList.add('is-loading');
      }
      appendLog(ctxLog, '[' + to + '] Cargando su PCB en los registros de la CPU…', 'log-action', 12);
      renderCpu(ctxState[to], true);
      await wait(520);
      if (myGeneration !== ctxGeneration) return;

      if (toEl) {
        toEl.classList.remove('is-loading');
        toEl.classList.add('is-running');
      }
      ctxRunning = to;
      appendLog(ctxLog, '[' + to + '] En ejecución. Cambio de contexto completado (~1–10 µs).', 'log-done', 12);

      ctxBusy = false;
      if (ctxSwitch) ctxSwitch.disabled = false;
    }

    if (ctxSwitch) ctxSwitch.addEventListener('click', doContextSwitch);

    window.addEventListener('deck:change', function (e) {
      if (e.detail.slide && e.detail.slide.id !== 'slide-5') {
        ctxGeneration += 1;
        ctxBusy = false;
        if (ctxSwitch) ctxSwitch.disabled = false;
        [pcbA, pcbB].forEach(function (card) {
          if (card) card.classList.remove('is-saving', 'is-loading');
        });
      }
    });

    ctxResetVisual();
  }

  /* ============================================================
     Mutex / condición de carrera
     ============================================================ */
  var mutexSim = document.getElementById('mutexSim');
  if (mutexSim) {
    var mutexToggle = document.getElementById('mutexToggle');
    var mutexRun = document.getElementById('mutexRun');
    var mutexReset = document.getElementById('mutexReset');
    var mutexValue = document.getElementById('mutexValue');
    var mutexExpected = document.getElementById('mutexExpected');
    var mutexLost = document.getElementById('mutexLost');
    var mutexLog = document.getElementById('mutexLog');
    var t1Bar = document.getElementById('t1Bar');
    var t2Bar = document.getElementById('t2Bar');
    var t1Progress = document.getElementById('t1Progress');
    var t2Progress = document.getElementById('t2Progress');
    var switchLabel = mutexSim.querySelector('.switch-label');

    var ITERATIONS = 40;
    var mutexRunning = false;
    var mutexGeneration = 0;
    var locked = false;
    var waiters = [];
    var sharedValue = 0;
    var version = 0;
    var writes = 0;
    var lostUpdates = 0;

    function acquire() {
      return new Promise(function (resolve) {
        if (!locked) {
          locked = true;
          resolve();
        } else {
          waiters.push(resolve);
        }
      });
    }

    function release() {
      if (waiters.length) {
        var next = waiters.shift();
        next();
      } else {
        locked = false;
      }
    }

    function renderValue() {
      if (mutexValue) mutexValue.textContent = String(sharedValue);
    }

    function setBars(pct1, pct2) {
      if (t1Bar) t1Bar.style.width = pct1 + '%';
      if (t2Bar) t2Bar.style.width = pct2 + '%';
      if (t1Progress) t1Progress.textContent = pct1 + '%';
      if (t2Progress) t2Progress.textContent = pct2 + '%';
    }

    function resetCounters() {
      sharedValue = 0;
      version = 0;
      writes = 0;
      lostUpdates = 0;
      locked = false;
      var pending = waiters.splice(0);
      pending.forEach(function (resolve) { resolve(); });
      renderValue();
      if (mutexLost) mutexLost.textContent = '0';
      if (mutexExpected) mutexExpected.textContent = '0';
      setBars(0, 0);
    }

    async function worker(id, useMutex, myGeneration) {
      var bar = id === 'T1' ? t1Bar : t2Bar;
      var progress = id === 'T1' ? t1Progress : t2Progress;

      for (var i = 0; i < ITERATIONS; i++) {
        if (myGeneration !== mutexGeneration) return;

        if (useMutex) await acquire();
        if (myGeneration !== mutexGeneration) {
          if (useMutex) release();
          return;
        }

        var readValue = sharedValue;
        var readVersion = version;

        await wait(3 + Math.random() * 9);

        if (myGeneration !== mutexGeneration) {
          if (useMutex) release();
          return;
        }

        if (readVersion !== version) {
          appendLog(mutexLog, '⚠ ' + id + ' escribió sobre datos ya obsoletos (leyó ' + readValue + ').', 'log-warn', 7);
        }

        sharedValue = readValue + 1;
        version += 1;
        writes += 1;
        lostUpdates = Math.max(0, writes - sharedValue);
        if (mutexLost) mutexLost.textContent = String(lostUpdates);
        renderValue();

        if (useMutex) release();

        var pct = Math.round(((i + 1) / ITERATIONS) * 100);
        if (bar) bar.style.width = pct + '%';
        if (progress) progress.textContent = pct + '%';
      }
    }

    async function runMutex() {
      if (mutexRunning) return;

      mutexRunning = true;
      if (mutexRun) mutexRun.disabled = true;
      if (mutexToggle) mutexToggle.disabled = true;
      if (mutexReset) mutexReset.disabled = true;

      var useMutex = mutexToggle ? mutexToggle.checked : true;
      var myGeneration = ++mutexGeneration;

      resetCounters();
      if (mutexExpected) mutexExpected.textContent = String(ITERATIONS * 2);
      if (mutexLog) mutexLog.innerHTML = '';

      appendLog(
        mutexLog,
        'Ejecutando 2 hilos × ' + ITERATIONS + ' incrementos · mutex ' + (useMutex ? 'ACTIVADO' : 'DESACTIVADO') + '…',
        useMutex ? 'log-user' : 'log-warn',
        7
      );

      await Promise.all([
        worker('T1', useMutex, myGeneration),
        worker('T2', useMutex, myGeneration)
      ]);

      if (myGeneration !== mutexGeneration) return;

      mutexRunning = false;
      if (mutexRun) mutexRun.disabled = false;
      if (mutexToggle) mutexToggle.disabled = false;
      if (mutexReset) mutexReset.disabled = false;

      var expected = ITERATIONS * 2;
      appendLog(
        mutexLog,
        'Resultado: contador=' + sharedValue + ' · esperado=' + expected + ' · actualizaciones perdidas=' + lostUpdates,
        lostUpdates > 0 ? 'log-warn' : 'log-done',
        7
      );
    }

    function resetMutex() {
      mutexGeneration += 1;
      mutexRunning = false;
      if (mutexRun) mutexRun.disabled = false;
      if (mutexToggle) mutexToggle.disabled = false;
      if (mutexReset) mutexReset.disabled = false;
      resetCounters();
      if (mutexLog) {
        mutexLog.innerHTML = '<p class="log-line log-muted">Activa o desactiva el mutex y ejecuta para comparar los resultados.</p>';
      }
    }

    function updateSwitchLabel() {
      if (switchLabel && mutexToggle) {
        switchLabel.textContent = mutexToggle.checked ? 'Mutex activado' : 'Mutex desactivado';
      }
    }

    if (mutexRun) mutexRun.addEventListener('click', runMutex);
    if (mutexReset) mutexReset.addEventListener('click', resetMutex);
    if (mutexToggle) {
      mutexToggle.addEventListener('change', function () {
        updateSwitchLabel();
        resetMutex();
        if (mutexLog) mutexLog.innerHTML = '';
        appendLog(
          mutexLog,
          mutexToggle.checked ? 'Mutex activado: solo un hilo entra a la sección crítica.' : 'Mutex desactivado: los hilos compiten por el mismo recurso.',
          mutexToggle.checked ? 'log-user' : 'log-warn',
          7
        );
      });
    }

    window.addEventListener('deck:change', function (e) {
      if (e.detail.slide && e.detail.slide.id !== 'slide-5') {
        mutexGeneration += 1;
        mutexRunning = false;
        if (mutexRun) mutexRun.disabled = false;
        if (mutexToggle) mutexToggle.disabled = false;
        if (mutexReset) mutexReset.disabled = false;
      }
    });

    updateSwitchLabel();
    resetCounters();
  }
})();
