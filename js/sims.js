(function () {
  'use strict';

  /* ---------- Tabs de la diapositiva de procesos ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('.tab-panel'));

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var key = tab.dataset.tab;
      tabs.forEach(function (t) {
        var active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      panels.forEach(function (p) {
        p.classList.toggle('is-active', p.dataset.panel === key);
      });
    });
  });

  /* ---------- Acordeón de funciones ---------- */
  var fnCards = Array.prototype.slice.call(document.querySelectorAll('.fn-card'));
  fnCards.forEach(function (card) {
    card.addEventListener('toggle', function () {
      if (!card.open) return;
      fnCards.forEach(function (other) {
        if (other !== card) other.open = false;
      });
    });
  });

  /* ---------- Simulador de llamadas al sistema ---------- */
  var sysSim = document.getElementById('syscallSim');
  if (!sysSim) return;

  var sysButtons = Array.prototype.slice.call(sysSim.querySelectorAll('[data-syscall]'));
  var sysLog = document.getElementById('sysLog');
  var sysMode = document.getElementById('sysMode');
  var sysToken = document.getElementById('sysToken');
  var sysSteps = Array.prototype.slice.call(sysSim.querySelectorAll('[data-sys-step]'));

  var busy = false;

  var CALLS = {
    fork: {
      title: 'fork() · crear un nuevo proceso',
      trap: 'El programa cruza la puerta con una instrucción trap. El modo cambia a kernel.',
      kernel: 'El kernel duplica el PCB del proceso y le asigna un nuevo PID.',
      hardware: 'El planificador coloca al proceso hijo en la cola de listos.',
      ret: 'Retorno: el padre recibe el PID del hijo; el hijo recibe 0.'
    },
    read: {
      title: 'read() · leer datos de un archivo',
      trap: 'El programa pide leer el descriptor de archivo y cruza la puerta syscall.',
      kernel: 'El kernel valida el descriptor y consulta su tabla de archivos abiertos.',
      hardware: 'Los datos se copian desde el almacenamiento al buffer del proceso.',
      ret: 'Retorno: el kernel devuelve el número de bytes leídos.'
    },
    write: {
      title: 'write() · escribir datos en un archivo',
      trap: 'El programa entrega un buffer y solicita escribir en un descriptor.',
      kernel: 'El kernel valida permisos y prepara los bloques del sistema de archivos.',
      hardware: 'Los datos viajan al controlador del disco (o a la caché) para guardarse.',
      ret: 'Retorno: el kernel devuelve cuántos bytes se escribieron correctamente.'
    },
    chmod: {
      title: 'chmod() · cambiar permisos de un archivo',
      trap: 'El programa solicita modificar los bits de permiso del archivo.',
      kernel: 'El kernel comprueba que el proceso sea el propietario del archivo.',
      hardware: 'Se actualizan los metadatos del inodo con los nuevos permisos.',
      ret: 'Retorno: 0 si tuvo éxito; -1 si no tenía autorización.'
    }
  };

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function setMode(kernel) {
    if (!sysMode) return;
    sysMode.textContent = kernel ? 'MODO KERNEL' : 'MODO USUARIO';
    sysMode.classList.toggle('is-kernel', kernel);
    sysMode.classList.toggle('is-user', !kernel);
    if (sysToken) sysToken.classList.toggle('is-kernel', kernel);
  }

  function setStep(index) {
    sysSteps.forEach(function (step, i) {
      step.classList.toggle('is-on', i === index);
      step.classList.toggle('is-kernel', i === 1 || i === 2);
    });
    if (sysToken) sysToken.style.left = (12.5 + index * 25) + '%';
  }

  function clearLog() {
    if (sysLog) sysLog.innerHTML = '';
  }

  function log(text, cls) {
    if (!sysLog) return;
    var p = document.createElement('p');
    p.className = 'log-line ' + (cls || '');
    p.textContent = text;
    sysLog.appendChild(p);
    sysLog.scrollTop = sysLog.scrollHeight;
  }

  function setButtonsDisabled(disabled) {
    sysButtons.forEach(function (b) { b.disabled = disabled; });
  }

  async function runCall(name) {
    if (busy) return;
    var call = CALLS[name];
    if (!call) return;

    busy = true;
    setButtonsDisabled(true);
    clearLog();

    setMode(false);
    setStep(0);
    log('> ' + call.title, 'log-user');
    await wait(480);

    log('→ ' + call.trap, 'log-action');
    setMode(true);
    setStep(1);
    await wait(620);

    setStep(2);
    log('◆ ' + call.kernel, 'log-kernel');
    await wait(700);

    setStep(3);
    log('◆ ' + call.hardware, 'log-kernel');
    await wait(560);

    log('← ' + call.ret, 'log-done');
    setMode(false);
    setStep(0);
    await wait(320);

    busy = false;
    setButtonsDisabled(false);
  }

  sysButtons.forEach(function (btn) {
    btn.addEventListener('click', function () { runCall(btn.dataset.syscall); });
  });
})();
