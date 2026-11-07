(function () {
  'use strict';

  var sim = document.getElementById('schedSim');
  if (!sim) return;

  var algoSel = document.getElementById('schedAlgo');
  var quantumField = document.getElementById('quantumField');
  var quantumInput = document.getElementById('schedQuantum');
  var tbody = document.getElementById('schedProcesses');
  var runBtn = document.getElementById('schedRun');
  var resetBtn = document.getElementById('schedReset');
  var gantt = document.getElementById('gantt');
  var axis = document.getElementById('ganttAxis');
  var cpuEl = document.getElementById('schedCpu');
  var clockEl = document.getElementById('schedClock');
  var queueEl = document.getElementById('schedQueue');
  var noteEl = document.getElementById('schedNote');
  var mWait = document.getElementById('mAvgWait');
  var mTat = document.getElementById('mAvgTat');
  var mCtx = document.getElementById('mCtx');

  var COLORS = ['#34e1ff', '#8b8cff', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];

  var NOTES = {
    fifo: 'FIFO atiende por orden de llegada. Es simple, pero un proceso largo puede bloquear a los demás (efecto convoy).',
    sjf: 'SJF elige primero la ráfaga más corta. Minimiza la espera media, aunque puede provocar starvation en procesos largos.',
    rr: 'Round Robin reparte la CPU en turnos de duración fija (quantum). Es equitativo y da buena respuesta interactiva.'
  };

  var running = false;
  var generation = 0;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) n = fallback;
    return Math.max(min, Math.min(max, n));
  }

  function readProcesses() {
    return Array.prototype.map.call(tbody.querySelectorAll('tr'), function (tr, i) {
      var inputs = tr.querySelectorAll('input');
      return {
        pid: 'P' + (i + 1),
        arrival: clampInt(inputs[0].value, 0, 20, 0),
        burst: clampInt(inputs[1].value, 1, 20, 1)
      };
    });
  }

  function fifo(procs) {
    var segs = [];
    var finish = {};
    var order = procs.slice().sort(function (a, b) {
      return a.arrival - b.arrival || procs.indexOf(a) - procs.indexOf(b);
    });
    var t = 0;
    order.forEach(function (p) {
      if (t < p.arrival) {
        segs.push({ pid: 'IDLE', start: t, end: p.arrival, idle: true });
        t = p.arrival;
      }
      segs.push({ pid: p.pid, start: t, end: t + p.burst });
      t += p.burst;
      finish[p.pid] = t;
    });
    return { segs: segs, finish: finish, total: t };
  }

  function sjf(procs) {
    var segs = [];
    var finish = {};
    var done = {};
    var t = Math.min.apply(null, procs.map(function (p) { return p.arrival; }));

    while (Object.keys(done).length < procs.length) {
      var available = procs.filter(function (p) {
        return !done[p.pid] && p.arrival <= t;
      });

      if (!available.length) {
        var pending = procs.filter(function (p) { return !done[p.pid]; });
        var next = Math.min.apply(null, pending.map(function (p) { return p.arrival; }));
        if (next > t) {
          segs.push({ pid: 'IDLE', start: t, end: next, idle: true });
          t = next;
        }
        continue;
      }

      available.sort(function (a, b) {
        return a.burst - b.burst ||
          a.arrival - b.arrival ||
          procs.indexOf(a) - procs.indexOf(b);
      });

      var p = available[0];
      segs.push({ pid: p.pid, start: t, end: t + p.burst });
      t += p.burst;
      finish[p.pid] = t;
      done[p.pid] = true;
    }

    return { segs: segs, finish: finish, total: t };
  }

  function roundRobin(procs, quantum) {
    var segs = [];
    var finish = {};
    var remaining = {};
    var arrived = {};
    var queue = [];

    procs.forEach(function (p) { remaining[p.pid] = p.burst; });

    var t = Math.min.apply(null, procs.map(function (p) { return p.arrival; }));

    function enqueueUpTo(time) {
      procs
        .filter(function (p) { return !arrived[p.pid] && p.arrival <= time; })
        .sort(function (a, b) {
          return a.arrival - b.arrival || procs.indexOf(a) - procs.indexOf(b);
        })
        .forEach(function (p) {
          arrived[p.pid] = true;
          queue.push(p);
        });
    }

    enqueueUpTo(t);

    while (queue.length || Object.keys(arrived).length < procs.length) {
      if (!queue.length) {
        var pending = procs.filter(function (p) { return !arrived[p.pid]; });
        var next = Math.min.apply(null, pending.map(function (p) { return p.arrival; }));
        if (next > t) {
          segs.push({ pid: 'IDLE', start: t, end: next, idle: true });
          t = next;
        }
        enqueueUpTo(t);
        continue;
      }

      var p = queue.shift();
      var run = Math.min(quantum, remaining[p.pid]);
      segs.push({ pid: p.pid, start: t, end: t + run });
      t += run;
      remaining[p.pid] -= run;
      enqueueUpTo(t);

      if (remaining[p.pid] > 0) {
        queue.push(p);
      } else {
        finish[p.pid] = t;
      }
    }

    return { segs: segs, finish: finish, total: t };
  }

  function buildSchedule(procs, algo, quantum) {
    if (algo === 'fifo') return fifo(procs);
    if (algo === 'sjf') return sjf(procs);
    return roundRobin(procs, quantum);
  }

  function colorFor(procs, pid) {
    var idx = procs.findIndex(function (p) { return p.pid === pid; });
    return COLORS[idx % COLORS.length];
  }

  function renderGantt(result, procs) {
    gantt.innerHTML = '';
    axis.innerHTML = '';
    var total = result.total || 1;

    result.segs.forEach(function (seg, i) {
      var block = document.createElement('div');
      block.className = 'gantt-block' + (seg.idle ? ' is-idle' : '');
      block.style.left = (seg.start / total) * 100 + '%';
      block.style.width = (seg.end - seg.start) / total * 100 + '%';
      if (!seg.idle) block.style.background = colorFor(procs, seg.pid);
      block.style.animationDelay = (i * 70) + 'ms';
      block.innerHTML = '<span>' + (seg.idle ? 'IDLE' : seg.pid) + '</span><small>' + (seg.end - seg.start) + '</small>';
      block.title = (seg.idle ? 'Inactivo' : seg.pid) + ': t=' + seg.start + ' → ' + seg.end;
      gantt.appendChild(block);
    });

    var bounds = [];
    result.segs.forEach(function (seg) {
      if (bounds.indexOf(seg.start) === -1) bounds.push(seg.start);
      if (bounds.indexOf(seg.end) === -1) bounds.push(seg.end);
    });
    bounds.sort(function (a, b) { return a - b; });

    bounds.forEach(function (t) {
      var tick = document.createElement('span');
      tick.className = 'gantt-tick';
      tick.style.left = (t / total) * 100 + '%';
      tick.textContent = t;
      axis.appendChild(tick);
    });
  }

  function renderQueue(pids) {
    if (!queueEl) return;
    queueEl.innerHTML = '';
    if (!pids.length) {
      var empty = document.createElement('span');
      empty.className = 'rq-empty';
      empty.textContent = '—';
      queueEl.appendChild(empty);
      return;
    }
    pids.forEach(function (pid) {
      var chip = document.createElement('span');
      chip.className = 'rq-chip';
      chip.textContent = pid;
      queueEl.appendChild(chip);
    });
  }

  function computeMetrics(result, procs) {
    var totalWait = 0;
    var totalTat = 0;

    procs.forEach(function (p) {
      var finish = result.finish[p.pid] || 0;
      var tat = finish - p.arrival;
      var wait = tat - p.burst;
      totalWait += wait;
      totalTat += tat;
    });

    var ctx = 0;
    result.segs.forEach(function (seg, i) {
      if (i > 0 && seg.pid !== result.segs[i - 1].pid) ctx += 1;
    });

    return {
      avgWait: totalWait / procs.length,
      avgTat: totalTat / procs.length,
      ctx: ctx
    };
  }

  function fmt(n) {
    return (Math.round(n * 100) / 100).toFixed(2);
  }

  function resetVisual() {
    if (gantt) gantt.innerHTML = '';
    if (axis) axis.innerHTML = '';
    if (cpuEl) cpuEl.textContent = '—';
    if (clockEl) clockEl.textContent = 't = 0';
    renderQueue([]);
    if (mWait) mWait.textContent = '—';
    if (mTat) mTat.textContent = '—';
    if (mCtx) mCtx.textContent = '—';
  }

  function reset() {
    generation += 1;
    running = false;
    if (runBtn) runBtn.disabled = false;
    resetVisual();
  }

  async function run() {
    if (running) return;

    var procs = readProcesses();
    var algo = algoSel.value;
    var quantum = clampInt(quantumInput.value, 1, 10, 2);
    var result = buildSchedule(procs, algo, quantum);
    var metrics = computeMetrics(result, procs);

    resetVisual();
    running = true;
    if (runBtn) runBtn.disabled = true;
    var myGeneration = ++generation;

    renderGantt(result, procs);
    if (mWait) mWait.textContent = fmt(metrics.avgWait) + ' u';
    if (mTat) mTat.textContent = fmt(metrics.avgTat) + ' u';
    if (mCtx) mCtx.textContent = String(metrics.ctx);

    for (var i = 0; i < result.segs.length; i++) {
      if (myGeneration !== generation) return;
      var seg = result.segs[i];
      if (cpuEl) cpuEl.textContent = seg.idle ? 'IDLE' : seg.pid;
      if (clockEl) clockEl.textContent = 't = ' + seg.end;

      var done = {};
      Object.keys(result.finish).forEach(function (pid) {
        if (result.finish[pid] <= seg.start) done[pid] = true;
      });

      var queued = procs.filter(function (p) {
        return p.arrival <= seg.start &&
          !done[p.pid] &&
          p.pid !== seg.pid &&
          result.finish[p.pid] > seg.start;
      }).map(function (p) { return p.pid; });

      renderQueue(queued);

      var delay = Math.min(620, 230 + (seg.end - seg.start) * 70);
      await wait(delay);
    }

    if (myGeneration !== generation) return;
    if (cpuEl) cpuEl.textContent = '—';
    if (clockEl) clockEl.textContent = 't = ' + result.total;
    renderQueue([]);
    running = false;
    if (runBtn) runBtn.disabled = false;
  }

  function updateAlgoUI() {
    var algo = algoSel.value;
    if (quantumField) quantumField.classList.toggle('is-hidden', algo !== 'rr');
    if (noteEl) noteEl.textContent = NOTES[algo];
  }

  algoSel.addEventListener('change', function () {
    updateAlgoUI();
    reset();
  });

  if (runBtn) runBtn.addEventListener('click', run);
  if (resetBtn) resetBtn.addEventListener('click', reset);

  updateAlgoUI();
  resetVisual();
})();
