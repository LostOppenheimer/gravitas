/**
 * Preset systems — returns array of Planet objects centered on (cx, cy)
 * Velocities calculated for circular orbits: v = sqrt(G*M/r)
 */
const Presets = (() => {

  function _circular(cx, cy, centralMass, r, mass, color, angleOffset = 0) {
    const angle = Math.random() * Math.PI * 2 + angleOffset;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const v = Physics.circularOrbitSpeed(centralMass, r);
    const p = new Planet(x, y, mass, color, -Math.sin(angle)*v, Math.cos(angle)*v);
    return p;
  }

  // ── Single star system ────────────────────────────────────────────────
  function solarSystem(cx, cy) {
    const planets = [];

    const star = new Planet(cx, cy, 2000, '#fff8dc');
    star.isStar = true;
    star.name = 'Sol';
    planets.push(star);

    const bodies = [
      { r: 90,  mass: 3,   color: '#aaaaaa', name: 'Merkur'  },
      { r: 150, mass: 8,   color: '#e8c87a', name: 'Venus'   },
      { r: 210, mass: 10,  color: '#4488ff', name: 'Terra'   },
      { r: 290, mass: 6,   color: '#cc4422', name: 'Mars'    },
      { r: 430, mass: 120, color: '#c8a055', name: 'Jove'    },
      { r: 610, mass: 80,  color: '#d4a96a', name: 'Saturno' },
      { r: 780, mass: 40,  color: '#88ccff', name: 'Urano'   },
      { r: 950, mass: 45,  color: '#3355ff', name: 'Netuno'  },
    ];

    bodies.forEach(b => {
      const p = _circular(cx, cy, star.mass, b.r, b.mass, b.color);
      p.name = b.name;
      planets.push(p);
    });

    // moon for Terra
    const terra = planets.find(p => p.name === 'Terra');
    if (terra) {
      const moonAngle = Math.random() * Math.PI * 2;
      const moonR = 20;
      const moonV = Physics.circularOrbitSpeed(terra.mass, moonR);
      const mx = terra.pos.x + Math.cos(moonAngle) * moonR;
      const my = terra.pos.y + Math.sin(moonAngle) * moonR;
      const moon = new Planet(mx, my, 1, '#cccccc',
        terra.vel.x - Math.sin(moonAngle) * moonV,
        terra.vel.y + Math.cos(moonAngle) * moonV);
      moon.name = 'Lua';
      planets.push(moon);
    }

    return planets;
  }

  // ── Binary star system ────────────────────────────────────────────────
  function binaryStars(cx, cy) {
    const planets = [];
    const sep = 200;
    const starMass = 1200;

    // Two stars orbiting their common center of mass
    const v = Physics.circularOrbitSpeed(starMass, sep / 2) * 0.5;

    const s1 = new Planet(cx - sep/2, cy, starMass, '#ff9944', 0, v);
    const s2 = new Planet(cx + sep/2, cy, starMass, '#4499ff', 0, -v);
    s1.isStar = true; s1.name = 'Alpha';
    s2.isStar = true; s2.name = 'Beta';
    planets.push(s1, s2);

    // Planets in wide orbits around both stars (L4/L5 region)
    const totalMass = starMass * 2;
    const rs = [500, 650, 800];
    const colors = ['#88ff88', '#ff88cc', '#ffee44'];
    rs.forEach((r, i) => {
      const p = _circular(cx, cy, totalMass, r, 8, colors[i]);
      planets.push(p);
    });

    return planets;
  }

  // ── Triple star figure-8 orbit (Chenciner & Montgomery 2000) ─────────
  function figure8(cx, cy) {
    const planets = [];
    // Specific initial conditions for the figure-8 choreography
    // Scaled to simulation units
    const scale = 120;
    const m = 600;

    const ic = [
      { x:  0.97000436, y: -0.24308753, vx:  0.93240737/2, vy:  0.86473146/2 },
      { x: -0.97000436, y:  0.24308753, vx:  0.93240737/2, vy:  0.86473146/2 },
      { x:  0,          y:  0,          vx: -0.93240737,    vy: -0.86473146   },
    ];
    const colors = ['#ff6644', '#44aaff', '#aaff44'];

    ic.forEach((d, i) => {
      const p = new Planet(
        cx + d.x * scale, cy + d.y * scale,
        m, colors[i],
        d.vx * 0.35, d.vy * 0.35
      );
      p.isStar = true;
      planets.push(p);
    });

    return planets;
  }

  // ── Planetary rings (many small bodies, one large center) ─────────────
  function rings(cx, cy) {
    const planets = [];
    const star = new Planet(cx, cy, 3000, '#ffffff');
    star.isStar = true;
    star.name = 'Pulsar';
    planets.push(star);

    const bands = [
      { r: 120, n: 18, mass: 2,  color: '#ff8844' },
      { r: 200, n: 28, mass: 3,  color: '#44aaff' },
      { r: 300, n: 38, mass: 2,  color: '#88ff44' },
      { r: 430, n: 50, mass: 1.5,color: '#ff44aa' },
    ];

    bands.forEach(b => {
      for (let i = 0; i < b.n; i++) {
        const angle = (i / b.n) * Math.PI * 2;
        const jitter = (Math.random() - 0.5) * 12;
        const r = b.r + jitter;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        const v = Physics.circularOrbitSpeed(star.mass, r);
        planets.push(new Planet(x, y, b.mass + Math.random(), b.color,
          -Math.sin(angle)*v, Math.cos(angle)*v));
      }
    });

    return planets;
  }

  // ── Galaxy collision ──────────────────────────────────────────────────
  function galaxyCollision(cx, cy) {
    const planets = [];

    function makeGalaxy(ox, oy, vx, vy) {
      const star = new Planet(ox, oy, 2500, '#ffffaa', vx, vy);
      star.isStar = true;
      planets.push(star);

      for (let i = 0; i < 30; i++) {
        const r = 80 + Math.random() * 350;
        const angle = Math.random() * Math.PI * 2;
        const x = ox + Math.cos(angle) * r;
        const y = oy + Math.sin(angle) * r;
        const v = Physics.circularOrbitSpeed(star.mass, r);
        const hue = Math.floor(Math.random() * 60) + 180;
        const col = `hsl(${hue},70%,65%)`;
        planets.push(new Planet(x, y, 3 + Math.random()*8, col,
          vx - Math.sin(angle)*v, vy + Math.cos(angle)*v));
      }
    }

    makeGalaxy(cx - 500, cy - 200,  0.6, 0.2);
    makeGalaxy(cx + 500, cy + 200, -0.6, -0.2);

    return planets;
  }

  return { solarSystem, binaryStars, figure8, rings, galaxyCollision };
})();
