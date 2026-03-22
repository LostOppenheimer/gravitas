let _planetId = 0;

class Planet {
  constructor(x, y, mass, color, vx = 0, vy = 0) {
    this.id       = _planetId++;
    this.pos      = new Vec2(x, y);
    this.vel      = new Vec2(vx, vy);
    this.acc      = Vec2.zero();   // current acceleration
    this.accPrev  = Vec2.zero();   // previous step acceleration (for Verlet)
    this.mass     = mass;
    this.color    = color;
    this.radius   = Planet.massToRadius(mass);
    this.isStar   = false;
    this.trail    = [];            // array of Vec2
    this.trailMax = 200;
    this.dead     = false;
    this.age      = 0;             // frames alive
    this.name     = Planet.randomName();
  }

  static massToRadius(mass) {
    return Math.cbrt(mass) * 2.4 + 1.5;
  }

  static randomName() {
    const p = ['Ara','Bel','Cor','Dal','Eos','Fyr','Gal','Hel','Ixo','Jal','Kel','Lyr','Myr','Nox','Ora','Pyx'];
    const s = ['is','on','ax','el','ur','ia','ix','os','an','ar'];
    return p[Math.floor(Math.random()*p.length)] + s[Math.floor(Math.random()*s.length)];
  }

  updateRadius() {
    this.radius = Planet.massToRadius(this.mass);
  }

  addTrail() {
    this.trail.push(this.pos.clone());
    if (this.trail.length > this.trailMax) this.trail.shift();
  }

  kineticEnergy() {
    return 0.5 * this.mass * this.vel.lenSq();
  }

  momentum() {
    return this.vel.scale(this.mass);
  }

  speed() {
    return this.vel.len();
  }
}
