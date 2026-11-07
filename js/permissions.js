(function () {
  'use strict';

  var sim = document.getElementById('permSim');
  if (!sim) return;

  var fileInput = document.getElementById('permFile');
  var octalEl = document.getElementById('permOctal');
  var symbolicEl = document.getElementById('permSymbolic');
  var commandEl = document.getElementById('permCommand');
  var legendEl = document.getElementById('permLegend');
  var presetButtons = Array.prototype.slice.call(sim.querySelectorAll('[data-perm-preset]'));
  var bits = Array.prototype.slice.call(sim.querySelectorAll('.perm-bit input'));

  var ROLES = ['owner', 'group', 'others'];
  var ROLE_NAMES = { owner: 'El propietario', group: 'El grupo', others: 'El resto' };

  function getState() {
    var state = {
      owner: { r: false, w: false, x: false },
      group: { r: false, w: false, x: false },
      others: { r: false, w: false, x: false }
    };
    bits.forEach(function (input) {
      state[input.dataset.role][input.dataset.bit] = input.checked;
    });
    return state;
  }

  function digit(perms) {
    return (perms.r ? 4 : 0) + (perms.w ? 2 : 0) + (perms.x ? 1 : 0);
  }

  function symbolic(state) {
    function part(perms) {
      return (perms.r ? 'r' : '-') + (perms.w ? 'w' : '-') + (perms.x ? 'x' : '-');
    }
    return '-' + part(state.owner) + part(state.group) + part(state.others);
  }

  function joinActions(list) {
    if (list.length <= 1) return list.join('');
    if (list.length === 2) return list[0] + ' y ' + list[1];
    return list.slice(0, -1).join(', ') + ' y ' + list[list.length - 1];
  }

  function describe(state) {
    var parts = ROLES.map(function (role) {
      var perms = state[role];
      var actions = [];
      if (perms.r) actions.push('leer');
      if (perms.w) actions.push('escribir');
      if (perms.x) actions.push('ejecutar');
      if (!actions.length) return ROLE_NAMES[role] + ' no tiene permisos';
      return ROLE_NAMES[role] + ' puede ' + joinActions(actions);
    });
    return parts.join('; ') + '.';
  }

  function update() {
    var state = getState();
    var oct = '' + digit(state.owner) + digit(state.group) + digit(state.others);

    if (octalEl) octalEl.textContent = oct;
    if (symbolicEl) symbolicEl.textContent = symbolic(state);
    if (commandEl) commandEl.textContent = 'chmod ' + oct + ' ' + (fileInput && fileInput.value.trim() ? fileInput.value.trim() : 'archivo');
    if (legendEl) legendEl.textContent = describe(state);

    bits.forEach(function (input) {
      var label = input.closest('.perm-bit');
      if (label) label.classList.toggle('is-on', input.checked);
    });
  }

  function applyPreset(octal) {
    var digits = String(octal).split('').map(Number);
    ROLES.forEach(function (role, i) {
      var d = digits[i] || 0;
      bits.forEach(function (input) {
        if (input.dataset.role !== role) return;
        var bit = input.dataset.bit;
        var value = false;
        if (bit === 'r') value = !!(d & 4);
        if (bit === 'w') value = !!(d & 2);
        if (bit === 'x') value = !!(d & 1);
        input.checked = value;
      });
    });
    update();
  }

  bits.forEach(function (input) {
    input.addEventListener('change', update);
  });

  if (fileInput) {
    fileInput.addEventListener('input', update);
  }

  presetButtons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyPreset(btn.dataset.permPreset);
      presetButtons.forEach(function (other) {
        other.classList.toggle('is-active', other === btn);
      });
    });
  });

  applyPreset('644');
  presetButtons.forEach(function (btn) {
    btn.classList.toggle('is-active', btn.dataset.permPreset === '644');
  });
})();
