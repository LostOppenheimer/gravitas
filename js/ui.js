/**
 * UI — manages panels, stats, toggles, selected planet info
 */
const UI = (() => {
  let _planets;
  let _selected = null;

  // element refs filled on init
  let elCount, elFps, elEnergy, elKE, elPE, elAM, elZoom;
  let elSelPanel, elSelName, elSelMass, elSelSpeed, elSelPos, elSelOrbit;
  let toggleBtns = {};
  let fpsHistory = [];
  let lastFpsTime = performance.now();
  let frameCount  = 0;
  let _fps = 60;

  function init(planets) {
    _planets = planets;
    elCount   = document.getElementById('stat-count');
    elFps     = document.getElementById('stat-fps');
    elEnergy  = document.getElementById('stat-energy');
    elKE      = document.getElementById('stat-ke');
    elPE      = document.getElementById('stat-pe');
    elAM      = document.getElementById('stat-am');
    elZoom    = document.getElementById('stat-zoom');
    elSelPanel= document.getElementById('sel-panel');
    elSelName = document.getElementById('sel-name');
    elSelMass = document.getElementById('sel-mass');
    elSelSpeed= document.getElementById('sel-speed');
    elSelPos  = document.getElementById('sel-pos');
    elSelOrbit= document.getElementById('sel-orbit');

    // toggle buttons
    ['velocity','force','com','grid','orbits','names'].forEach(k => {
      toggleBtns[k] = document.getElementById('tog-' + k);
      if (toggleBtns[k]) {
        toggleBtns[k].addEventListener('click', () => {
          const state = Renderer.toggle(k);
          toggleBtns[k].classList.toggle('active', state[k]);
        });
      }
    });
  }

  function tick() {
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 500) {
      _fps = Math.round(frameCount / ((now - lastFpsTime) / 1000));
      frameCount = 0;
      lastFpsTime = now;
    }
  }

  function update(energy, com, angMom) {
    tick();
    const alive = _planets.filter(p => !p.dead).length;

    if (elCount)  elCount.textContent  = alive;
    if (elFps)    elFps.textContent    = _fps;
    if (elEnergy) elEnergy.textContent = _fmt(energy.total);
    if (elKE)     elKE.textContent     = _fmt(energy.ke);
    if (elPE)     elPE.textContent     = _fmt(energy.pe);
    if (elAM)     elAM.textContent     = _fmt(angMom);
    if (elZoom)   elZoom.textContent   = (Camera.getZoom() * 100).toFixed(0) + '%';

    updateSelectedPanel();
  }

  function updateSelectedPanel() {
    if (!elSelPanel) return;
    if (!_selected || _selected.dead) {
      elSelPanel.style.display = 'none';
      return;
    }
    elSelPanel.style.display = 'flex';
    const p = _selected;
    if (elSelName)  elSelName.textContent  = p.name + (p.isStar ? ' ★' : '');
    if (elSelMass)  elSelMass.textContent  = p.mass.toFixed(1);
    if (elSelSpeed) elSelSpeed.textContent = p.speed().toFixed(2);
    if (elSelPos)   elSelPos.textContent   = `${p.pos.x.toFixed(0)}, ${p.pos.y.toFixed(0)}`;
    // Rough orbital period around largest body
    const largest = _planets.filter(q => !q.dead && q !== p).sort((a,b) => b.mass - a.mass)[0];
    if (largest && elSelOrbit) {
      const r = p.pos.sub(largest.pos).len();
      const v = Physics.circularOrbitSpeed(largest.mass, r);
      const T = v > 0 ? (2 * Math.PI * r / v).toFixed(0) : '—';
      elSelOrbit.textContent = T + ' u';
    }
  }

  function setSelected(planet) { _selected = planet; }
  function getSelected()       { return _selected; }

  function _fmt(n) {
    if (!isFinite(n)) return '—';
    if (Math.abs(n) > 1e6)  return (n/1e6).toFixed(2) + 'M';
    if (Math.abs(n) > 1000) return (n/1e3).toFixed(2) + 'k';
    return n.toFixed(1);
  }

  return { init, update, setSelected, getSelected };
})();
