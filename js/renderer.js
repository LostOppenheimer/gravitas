/**
 * Renderer — Canvas 2D rendering with camera transform
 */
const Renderer = (() => {
  let canvas, ctx;
  let showVelocity  = false;
  let showForce     = false;
  let showCOM       = false;
  let showGrid      = false;
  let showOrbits    = false;
  let showNames     = false;
  let trailLength   = 180;

  function init(c) {
    canvas = c;
    ctx    = c.getContext('2d');
  }

  // ── Background ───────────────────────────────────────────────────────
  function drawBackground() {
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function clearHard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ── Grid (world space) ────────────────────────────────────────────────
  function drawGrid() {
    if (!showGrid) return;
    const zoom = Camera.getZoom();
    const step = _niceGridStep(200 / zoom);
    const cam  = Camera.getPos();

    ctx.save();
    Camera.applyTransform(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1 / zoom;

    const viewW = canvas.width  / zoom;
    const viewH = canvas.height / zoom;
    const x0 = Math.floor((cam.x - viewW/2) / step) * step;
    const y0 = Math.floor((cam.y - viewH/2) / step) * step;

    for (let x = x0; x < cam.x + viewW/2; x += step) {
      ctx.beginPath(); ctx.moveTo(x, cam.y - viewH); ctx.lineTo(x, cam.y + viewH); ctx.stroke();
    }
    for (let y = y0; y < cam.y + viewH/2; y += step) {
      ctx.beginPath(); ctx.moveTo(cam.x - viewW, y); ctx.lineTo(cam.x + viewW, y); ctx.stroke();
    }
    // axes
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.moveTo(-99999, 0); ctx.lineTo(99999, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -99999); ctx.lineTo(0, 99999); ctx.stroke();
    ctx.restore();
  }

  function _niceGridStep(target) {
    const pow = Math.pow(10, Math.floor(Math.log10(target)));
    const f = target / pow;
    if (f < 1.5) return pow;
    if (f < 3.5) return 2 * pow;
    if (f < 7.5) return 5 * pow;
    return 10 * pow;
  }

  // ── Trail ─────────────────────────────────────────────────────────────
  function drawTrail(planet) {
    const trail = planet.trail;
    const n = Math.min(trail.length, trailLength);
    if (n < 2) return;

    const rgb = _hexRgb(planet.color);
    ctx.save();
    ctx.lineWidth = 1.2;

    for (let i = trail.length - n + 1; i < trail.length; i++) {
      const alpha = ((i - (trail.length - n)) / n) * 0.5;
      ctx.strokeStyle = `rgba(${rgb},${alpha})`;
      ctx.beginPath();
      ctx.moveTo(trail[i-1].x, trail[i-1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Planet body ───────────────────────────────────────────────────────
  function drawPlanet(planet, selected) {
    const { x, y } = planet.pos;
    const r        = planet.radius;
    const rgb      = _hexRgb(planet.color);
    const zoom     = Camera.getZoom();

    // glow
    const glowR = r * (planet.isStar ? 5 : 3);
    const grd   = ctx.createRadialGradient(x, y, 0, x, y, glowR);
    grd.addColorStop(0,   `rgba(${rgb},${planet.isStar ? 0.5 : 0.25})`);
    grd.addColorStop(1,   `rgba(${rgb},0)`);
    ctx.beginPath();
    ctx.arc(x, y, glowR, 0, Math.PI*2);
    ctx.fillStyle = grd;
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = planet.color;
    ctx.fill();

    // star ring
    if (planet.isStar) {
      ctx.beginPath();
      ctx.arc(x, y, r + 3/zoom, 0, Math.PI*2);
      ctx.strokeStyle = `rgba(${rgb},0.5)`;
      ctx.lineWidth = 1.5 / zoom;
      ctx.stroke();
    }

    // selection ring
    if (selected) {
      ctx.beginPath();
      ctx.arc(x, y, r + 6/zoom, 0, Math.PI*2);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 1.5 / zoom;
      ctx.setLineDash([4/zoom, 4/zoom]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // name
    if (showNames) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${11/zoom}px Space Mono, monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(planet.name, x, y - r - 5/zoom);
    }
  }

  // ── Velocity vector ───────────────────────────────────────────────────
  function drawVelocityVector(planet) {
    if (!showVelocity) return;
    const { x, y } = planet.pos;
    const scale    = 8;
    const ex = x + planet.vel.x * scale;
    const ey = y + planet.vel.y * scale;
    _drawArrow(x, y, ex, ey, 'rgba(100,220,255,0.8)', 1.5);
  }

  // ── Acceleration / force vector ───────────────────────────────────────
  function drawForceVector(planet) {
    if (!showForce) return;
    const { x, y } = planet.pos;
    const scale    = planet.mass * 30;
    const ex = x + planet.acc.x * scale;
    const ey = y + planet.acc.y * scale;
    _drawArrow(x, y, ex, ey, 'rgba(255,100,100,0.7)', 1.2);
  }

  function _drawArrow(x1, y1, x2, y2, color, width) {
    const zoom = Camera.getZoom();
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx*dx+dy*dy);
    if (len < 1) return;
    const ax = dx/len, ay = dy/len;
    const hs = Math.min(len*0.3, 8/zoom);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = width / zoom;
    ctx.stroke();

    // arrowhead
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ax*hs - ay*hs*0.5, y2 - ay*hs + ax*hs*0.5);
    ctx.lineTo(x2 - ax*hs + ay*hs*0.5, y2 - ay*hs - ax*hs*0.5);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // ── Predicted orbit path ──────────────────────────────────────────────
  function drawOrbitPreview(planet, planets) {
    if (!showOrbits && !planet._showOrbit) return;
    const path = Physics.predictOrbit(planet, planets);
    if (path.length < 2) return;

    const rgb = _hexRgb(planet.color);
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
    ctx.strokeStyle = `rgba(${rgb},0.25)`;
    ctx.lineWidth   = 1 / Camera.getZoom();
    ctx.setLineDash([3/Camera.getZoom(), 5/Camera.getZoom()]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Center of mass indicator ──────────────────────────────────────────
  function drawCOM(com) {
    if (!showCOM) return;
    const s = 6 / Camera.getZoom();
    ctx.strokeStyle = 'rgba(255,220,50,0.6)';
    ctx.lineWidth   = 1.5 / Camera.getZoom();
    ctx.beginPath(); ctx.moveTo(com.x - s, com.y); ctx.lineTo(com.x + s, com.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(com.x, com.y - s); ctx.lineTo(com.x, com.y + s); ctx.stroke();
    ctx.beginPath(); ctx.arc(com.x, com.y, s*0.6, 0, Math.PI*2); ctx.stroke();
  }

  // ── Drag preview arrow ────────────────────────────────────────────────
  function drawDragArrow(worldStart, worldEnd, color, mass) {
    if (!worldStart || !worldEnd) return;
    ctx.save();
    Camera.applyTransform(ctx);
    const r = Planet.massToRadius(mass);
    ctx.beginPath();
    ctx.arc(worldStart.x, worldStart.y, r, 0, Math.PI*2);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1.5 / Camera.getZoom();
    ctx.setLineDash([4/Camera.getZoom(), 4/Camera.getZoom()]);
    ctx.stroke();
    ctx.setLineDash([]);

    _drawArrow(worldStart.x, worldStart.y, worldEnd.x, worldEnd.y, color, 2);
    ctx.restore();
  }

  // ── Main render call ──────────────────────────────────────────────────
  function render(planets, selectedPlanet, com, dragState) {
    drawBackground();
    drawGrid();

    ctx.save();
    Camera.applyTransform(ctx);

    // orbits behind everything
    if (showOrbits) {
      for (const p of planets) {
        if (!p.dead && !p.isStar) drawOrbitPreview(p, planets);
      }
    }

    // selected planet orbit on top
    if (selectedPlanet && !selectedPlanet.isStar) {
      selectedPlanet._showOrbit = true;
      drawOrbitPreview(selectedPlanet, planets);
      selectedPlanet._showOrbit = false;
    }

    // trails
    for (const p of planets) { if (!p.dead) drawTrail(p); }

    // center of mass
    if (com) drawCOM(com);

    // planets
    for (const p of planets) {
      if (p.dead) continue;
      drawPlanet(p, p === selectedPlanet);
      drawVelocityVector(p);
      drawForceVector(p);
    }

    ctx.restore();

    // drag arrow in screen space but transformed
    if (dragState?.active) {
      ctx.save();
      Camera.applyTransform(ctx);
      drawDragArrow(dragState.worldStart, dragState.worldEnd, dragState.color, dragState.mass);
      ctx.restore();
    }
  }

  // ── Toggles ───────────────────────────────────────────────────────────
  function toggle(key) {
    const map = { velocity: 'showVelocity', force: 'showForce', com: 'showCOM',
                  grid: 'showGrid', orbits: 'showOrbits', names: 'showNames' };
    if (map[key] !== undefined) {
      const v = eval(map[key]);  // closure read
      if (key === 'velocity') showVelocity = !v;
      if (key === 'force')    showForce    = !v;
      if (key === 'com')      showCOM      = !v;
      if (key === 'grid')     showGrid     = !v;
      if (key === 'orbits')   showOrbits   = !v;
      if (key === 'names')    showNames    = !v;
    }
    return getToggles();
  }

  function getToggles() {
    return { velocity: showVelocity, force: showForce, com: showCOM,
             grid: showGrid, orbits: showOrbits, names: showNames };
  }

  function setTrailLength(v) { trailLength = v; }

  function hitTest(planets, sx, sy) {
    const w = Camera.toWorld(sx, sy);
    for (const p of planets) {
      if (p.dead) continue;
      const dx = p.pos.x - w.x, dy = p.pos.y - w.y;
      if (dx*dx + dy*dy < (p.radius * 2 + 4) * (p.radius * 2 + 4) / Camera.getZoom() / Camera.getZoom()) return p;
    }
    return null;
  }

  function _hexRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `${r},${g},${b}`;
  }

  function getCtx() { return ctx; }
  function getCanvas() { return canvas; }

  return { init, render, clearHard, toggle, getToggles, setTrailLength, hitTest, getCtx, getCanvas };
})();
