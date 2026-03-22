// Immutable 2D vector math
class Vec2 {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  add(v)       { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v)       { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s)     { return new Vec2(this.x * s, this.y * s); }
  dot(v)       { return this.x * v.x + this.y * v.y; }
  lenSq()      { return this.x * this.x + this.y * this.y; }
  len()        { return Math.sqrt(this.lenSq()); }
  norm()       { const l = this.len(); return l > 0 ? this.scale(1/l) : new Vec2(); }
  perp()       { return new Vec2(-this.y, this.x); }
  clone()      { return new Vec2(this.x, this.y); }
  static zero(){ return new Vec2(0, 0); }
  static from(obj) { return new Vec2(obj.x, obj.y); }
}
