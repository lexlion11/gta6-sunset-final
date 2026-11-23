// particles.js — tiny visual effect system (explosions, blood, sparks).
// Note: combat.js owns the in-game particle list; this module is the standalone,
// class-based flavour kept for reuse and tooling.

export class Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;

  constructor(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.94;
    this.vy *= 0.94;
    this.life -= dt;
  }

  draw(ctx: any, camera: any): void {
    const p = camera.worldToScreen(this.x, this.y);
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    const s = this.size * camera.zoom * (0.5 + alpha * 0.5);
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    ctx.globalAlpha = 1;
  }
}

export class ParticleManager {
  list: Particle[] = [];

  burst(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 140;
      this.list.push(new Particle(
        x, y,
        Math.cos(a) * sp, Math.sin(a) * sp,
        0.4 + Math.random() * 0.5,
        color,
        2 + Math.random() * 4
      ));
    }
  }

  update(dt: number): void {
    for (const p of this.list) p.update(dt);
    this.list = this.list.filter((p) => p.life > 0);
  }

  draw(ctx: any, camera: any): void {
    for (const p of this.list) p.draw(ctx, camera);
  }
}
