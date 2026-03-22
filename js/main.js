/**
 * Main — simulation loop and input handling
 */

// ── State ──────────────────────────────────────────────────────────────
let planets    = [];
let paused     = false;
let timeScale  = 1.0;       // simulation speed multiplier
let followCOM  = false;
let subSteps   = 4;         // physics sub-steps per frame (accuracy)

let dragState = {
  active:     false,
  worldStart: null,
  worldEnd:   null,
  color:      '#c8ff00',
  mass:       30,
};

let panActive = false;      // right-click pan
const canvas  = document.getElementById('canvas');

// ── Init ───────────────────────────────────────────────────────────────
function init() {
  Renderer.init(canvas);
  Camera.init(canvas);
  UI.init(planets);

  resize();
  window.addEventListener('resize', resize);

  bindControls();
  bindInput();
  bindKeyboard();

  // start with solar system
  loadPreset('solar');

  requestAnimationFrame(loop);
}

function resize() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

// ── Main loop ──────────────────────────────────────────────────────────
function loop() {
  if (!paused) {
    const dt = (1.0 / 60) * timeScale;
    const step = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      Physics.step(planets, step);
      Physics.handleCollisions(planets);
      // remove dead
      for (let i = planets.length - 1; i >= 0; i--) {
        if (planets[i].dead) planets.splice(i, 1);
      }
    }

    // trails after physics
    planets.forEach(p => { if (!p.isStar) p.addTrail(); });

    // follow center of mass
    if (followCOM && planets.length > 0) {
      const com = Physics.centerOfMass(planets);
      Camera.centerOn(com.x, com.y);
    }
  }

  const energy = Physics.systemEnergy(planets);
  const com    = Physics.centerOfMass(planets);
  const angMom = Physics.angularMomentum(planets, com);

  Renderer.render(planets, UI.getSelected(), com, dragState);
  UI.update(energy, com, angMom);

  requestAnimationFrame(loop);
}

// ── Input ──────────────────────────────────────────────────────────────
function bindInput() {
  // scroll → zoom
  canvas.addEventListener('wheel', Camera.onWheel, { passive: false });

  // left click: drag to place planet
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      // check hit first
      const hit = Renderer.hitTest(planets, e.clientX, e.clientY);
      if (hit) {
        UI.setSelected(hit);
        return;
      }
      UI.setSelected(null);
      dragState.active     = true;
      dragState.worldStart = Camera.toWorld(e.clientX, e.clientY);
      dragState.worldEnd   = { ...dragState.worldStart };
      dragState.color      = document.getElementById('ctrl-color').value;
      dragState.mass       = parseFloat(document.getElementById('ctrl-mass').value);
    }
    if (e.button === 1 || e.button === 2) {
      panActive = true;
      Camera.startPan(e);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (dragState.active) {
      dragState.worldEnd = Camera.toWorld(e.clientX, e.clientY);
    }
    if (panActive) Camera.doPan(e);
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0 && dragState.active) {
      spawnPlanet();
      dragState.active = false;
    }
    if (e.button === 1 || e.button === 2) {
      panActive = false;
      Camera.endPan();
    }
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // touch support
  let lastTouchDist = 0;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragState.active     = true;
      dragState.worldStart = Camera.toWorld(t.clientX, t.clientY);
      dragState.worldEnd   = { ...dragState.worldStart };
      dragState.color      = document.getElementById('ctrl-color').value;
      dragState.mass       = parseFloat(document.getElementById('ctrl-mass').value);
    }
    if (e.touches.length === 2) {
      dragState.active = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastTouchDist = Math.sqrt(dx*dx+dy*dy);
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && dragState.active) {
      const t = e.touches[0];
      dragState.worldEnd = Camera.toWorld(t.clientX, t.clientY);
    }
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const fakeDelta = lastTouchDist - dist;
      Camera.onWheel({ clientX: (e.touches[0].clientX+e.touches[1].clientX)/2,
                       clientY: (e.touches[0].clientY+e.touches[1].clientY)/2,
                       deltaY: fakeDelta * 2,
                       preventDefault: ()=>{} });
      lastTouchDist = dist;
    }
    e.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', () => {
    if (dragState.active) { spawnPlanet(); dragState.active = false; }
  });
}

function spawnPlanet() {
  const ws  = dragState.worldStart;
  const we  = dragState.worldEnd;
  if (!ws || !we) return;

  const mass  = parseFloat(document.getElementById('ctrl-mass').value);
  const color = document.getElementById('ctrl-color').value;
  const speed = parseFloat(document.getElementById('ctrl-speed').value);
  const isStar= document.getElementById('ctrl-star').checked;

  const dx = we.x - ws.x;
  const dy = we.y - ws.y;
  const len = Math.sqrt(dx*dx+dy*dy) || 1;

  const p = new Planet(ws.x, ws.y, mass, color,
    (dx / len) * speed,
    (dy / len) * speed);
  p.isStar = isStar;
  planets.push(p);

  // hide hint
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '0';
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key) {
      case ' ':  paused = !paused; document.getElementById('btn-pause').textContent = paused ? '▶' : '⏸'; break;
      case 'v':  document.getElementById('tog-velocity')?.click(); break;
      case 'f':  document.getElementById('tog-force')?.click();    break;
      case 'g':  document.getElementById('tog-grid')?.click();     break;
      case 'o':  document.getElementById('tog-orbits')?.click();   break;
      case 'n':  document.getElementById('tog-names')?.click();    break;
      case 'c':  document.getElementById('tog-com')?.click();      break;
      case 'r':  Camera.reset(canvas.width, canvas.height);        break;
      case 'Delete': case 'Backspace':
        if (UI.getSelected()) {
          UI.getSelected().dead = true;
          UI.setSelected(null);
        }
        break;
      case 'Escape': UI.setSelected(null); break;
    }
  });
}

// ── Controls ───────────────────────────────────────────────────────────
function bindControls() {
  // time scale
  const tsSlider = document.getElementById('ctrl-timescale');
  const tsLabel  = document.getElementById('lbl-timescale');
  if (tsSlider) {
    tsSlider.addEventListener('input', () => {
      timeScale = parseFloat(tsSlider.value);
      if (tsLabel) tsLabel.textContent = timeScale.toFixed(1) + '×';
    });
  }

  // trail length
  const trailSlider = document.getElementById('ctrl-trail');
  const trailLabel  = document.getElementById('lbl-trail');
  if (trailSlider) {
    trailSlider.addEventListener('input', () => {
      const v = parseInt(trailSlider.value);
      Renderer.setTrailLength(v);
      if (trailLabel) trailLabel.textContent = v;
    });
  }

  // sub-steps
  const ssSlider = document.getElementById('ctrl-substeps');
  const ssLabel  = document.getElementById('lbl-substeps');
  if (ssSlider) {
    ssSlider.addEventListener('input', () => {
      subSteps = parseInt(ssSlider.value);
      if (ssLabel) ssLabel.textContent = subSteps;
    });
  }

  // pause
  document.getElementById('btn-pause')?.addEventListener('click', () => {
    paused = !paused;
    document.getElementById('btn-pause').textContent = paused ? '▶' : '⏸';
  });

  // clear
  document.getElementById('btn-clear')?.addEventListener('click', () => {
    planets.length = 0;
    Renderer.clearHard();
    UI.setSelected(null);
    const hint = document.getElementById('hint');
    if (hint) hint.style.opacity = '1';
  });

  // follow COM
  document.getElementById('btn-follow')?.addEventListener('click', function() {
    followCOM = !followCOM;
    this.classList.toggle('active', followCOM);
  });

  // reset view
  document.getElementById('btn-resetview')?.addEventListener('click', () => {
    Camera.reset(canvas.width, canvas.height);
  });

  // presets
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
  });
}

function loadPreset(name) {
  planets.length = 0;
  Renderer.clearHard();
  UI.setSelected(null);
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const map = {
    solar:   () => Presets.solarSystem(cx, cy),
    binary:  () => Presets.binaryStars(cx, cy),
    figure8: () => Presets.figure8(cx, cy),
    rings:   () => Presets.rings(cx, cy),
    galaxy:  () => Presets.galaxyCollision(cx, cy),
  };
  if (map[name]) {
    const ps = map[name]();
    planets.push(...ps);
    // init accelerations so first Verlet step is correct
    const acc0 = [];
    planets.forEach(() => acc0.push(Vec2.zero()));
    planets.forEach((p, i) => p.acc = Vec2.zero());
  }
  const hint = document.getElementById('hint');
  if (hint) hint.style.opacity = '0';
}

window.addEventListener('load', init);
