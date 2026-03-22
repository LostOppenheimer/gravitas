/**
 * Physics engine — Velocity Verlet integration (symplectic, energy-conserving)
 *
 * Velocity Verlet algorithm per step:
 *   1. x(t+dt) = x(t) + v(t)*dt + 0.5*a(t)*dt²
 *   2. Compute a(t+dt) from new positions
 *   3. v(t+dt) = v(t) + 0.5*(a(t) + a(t+dt))*dt
 *
 * Gravitational force with softening to avoid singularities:
 *   F = G * m1 * m2 / (r² + ε²)  ×  r̂
 *   where ε (softening length) prevents infinite force at r→0
 */

const Physics = (() => {
  const G          = 200;    // gravitational constant (simulation units)
  const SOFTENING  = 15;     // softening length ε (pixels)
  const SOFT_SQ    = SOFTENING * SOFTENING;
  const MERGE_MULT = 0.85;   // fraction of smaller radius that triggers merge

  // ── Compute gravitational acceleration on each planet from all others ──
  function computeAccelerations(planets) {
    const n = planets.length;
    const acc = planets.map(() => Vec2.zero());

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pi = planets[i];
        const pj = planets[j];

        const r   = pj.pos.sub(pi.pos);
        const r2  = r.lenSq() + SOFT_SQ;
        const r1  = Math.sqrt(r2);
        const inv = 1.0 / (r2 * r1);   // 1 / (r² + ε²)^(3/2)

        const fi  = G * pj.mass * inv;  // acc on i from j
        const fj  = G * pi.mass * inv;  // acc on j from i

        acc[i] = acc[i].add(r.scale(fi));
        acc[j] = acc[j].sub(r.scale(fj));
      }
    }
    return acc;
  }

  // ── Velocity Verlet step ──────────────────────────────────────────────
  function step(planets, dt) {
    const n = planets.length;
    if (n === 0) return;

    // Step 1: update positions using current vel + acc
    for (let i = 0; i < n; i++) {
      const p = planets[i];
      if (p.isStar) continue;
      const dt2 = 0.5 * dt * dt;
      p.pos = p.pos.add(p.vel.scale(dt)).add(p.acc.scale(dt2));
    }

    // Step 2: compute new accelerations at new positions
    const newAcc = computeAccelerations(planets);

    // Step 3: update velocities using average of old and new acc
    for (let i = 0; i < n; i++) {
      const p = planets[i];
      if (p.isStar) continue;
      p.vel = p.vel.add(p.acc.add(newAcc[i]).scale(0.5 * dt));
      p.acc = newAcc[i];
    }

    // Update stars' accelerations too (needed for correct next step even if pos fixed)
    for (let i = 0; i < n; i++) {
      if (planets[i].isStar) planets[i].acc = newAcc[i];
    }
  }

  // ── Collision detection & merging ────────────────────────────────────
  function handleCollisions(planets) {
    const n = planets.length;
    for (let i = 0; i < n; i++) {
      if (planets[i].dead) continue;
      for (let j = i + 1; j < n; j++) {
        if (planets[j].dead) continue;

        const pi = planets[i];
        const pj = planets[j];
        const r  = pj.pos.sub(pi.pos).len();
        const mergeR = (pi.radius + pj.radius) * MERGE_MULT;

        if (r < mergeR) {
          _merge(pi, pj);
        }
      }
    }
  }

  // Perfectly inelastic collision — momentum conserved, KE partially lost
  function _merge(a, b) {
    const totalMass = a.mass + b.mass;
    // New position = center of mass
    const newPos = a.pos.scale(a.mass).add(b.pos.scale(b.mass)).scale(1 / totalMass);
    // Momentum-conserving velocity
    const newVel = a.vel.scale(a.mass).add(b.vel.scale(b.mass)).scale(1 / totalMass);

    const survivor = a.mass >= b.mass ? a : b;
    const victim   = a.mass >= b.mass ? b : a;

    // Transfer color if victim is larger or is a star
    if (victim.mass > survivor.mass * 0.6) {
      survivor.color = blendColors(survivor.color, victim.color, 0.35);
    }
    if (victim.isStar) survivor.isStar = true;

    survivor.mass  = totalMass;
    survivor.pos   = newPos;
    survivor.vel   = newVel;
    survivor.updateRadius();
    victim.dead = true;
  }

  // ── System energy (KE + gravitational PE) ────────────────────────────
  function systemEnergy(planets) {
    let ke = 0, pe = 0;
    const n = planets.length;
    for (let i = 0; i < n; i++) {
      ke += planets[i].kineticEnergy();
      for (let j = i + 1; j < n; j++) {
        const r = planets[j].pos.sub(planets[i].pos).len();
        pe -= G * planets[i].mass * planets[j].mass / Math.sqrt(r * r + SOFT_SQ);
      }
    }
    return { ke, pe, total: ke + pe };
  }

  // ── Center of mass ────────────────────────────────────────────────────
  function centerOfMass(planets) {
    let totalMass = 0;
    let cx = 0, cy = 0;
    for (const p of planets) {
      totalMass += p.mass;
      cx += p.pos.x * p.mass;
      cy += p.pos.y * p.mass;
    }
    if (totalMass === 0) return Vec2.zero();
    return new Vec2(cx / totalMass, cy / totalMass);
  }

  // ── Angular momentum (conserved quantity check) ───────────────────────
  function angularMomentum(planets, origin) {
    let L = 0;
    for (const p of planets) {
      const r = p.pos.sub(origin);
      L += p.mass * (r.x * p.vel.y - r.y * p.vel.x);
    }
    return L;
  }

  // ── Circular orbit velocity for a body orbiting a central mass ────────
  function circularOrbitSpeed(centralMass, radius) {
    return Math.sqrt(G * centralMass / Math.max(radius, 1));
  }

  // ── Predict future orbit path (fast, low-accuracy Euler for preview) ──
  function predictOrbit(planet, planets, steps = 300, dt = 0.3) {
    let px = planet.pos.x, py = planet.pos.y;
    let vx = planet.vel.x, vy = planet.vel.y;
    const path = [new Vec2(px, py)];

    for (let s = 0; s < steps; s++) {
      let ax = 0, ay = 0;
      for (const other of planets) {
        if (other === planet || other.dead) continue;
        const dx = other.pos.x - px;
        const dy = other.pos.y - py;
        const r2 = dx*dx + dy*dy + SOFT_SQ;
        const r1 = Math.sqrt(r2);
        const inv = G * other.mass / (r2 * r1);
        ax += inv * dx;
        ay += inv * dy;
      }
      vx += ax * dt;
      vy += ay * dt;
      px += vx * dt;
      py += vy * dt;
      path.push(new Vec2(px, py));
    }
    return path;
  }

  function blendColors(c1, c2, t) {
    const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
    const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
    const r = Math.round(r1*(1-t)+r2*t), g = Math.round(g1*(1-t)+g2*t), b = Math.round(b1*(1-t)+b2*t);
    return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
  }

  return { step, handleCollisions, systemEnergy, centerOfMass, angularMomentum, circularOrbitSpeed, predictOrbit, G };
})();
