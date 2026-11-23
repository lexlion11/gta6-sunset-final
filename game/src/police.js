// Police and the wanted system. Crimes add heat; heat fills stars 1-5; stars decay after
// `decayTime` seconds without a crime. At 2+ stars police cars spawn and give chase; at
// 3+ stars officers on foot join and fire back. Being caught on foot at high heat busts
// the player (lose money, respawn at the station); dying respawns at the hospital.
import { COLORS, POLICE_CAR_MAX, WANTED, WORLD } from './config.js';
import { spawnVehicle } from './vehicles.js';

export function createWanted(state) {
  const w = {
    stars: 0,
    heat: 0,            // 0..5 progress to next star
    crimeTimers: {},    // per crime type cooldown
    decayTimer: 0,      // time since last crime
    flash: 0,
    addHeat(amount, kind) {
      const now = state.time;
      const last = this.crimeTimers[kind] ?? -99;
      if (now - last < WANTED.crimeCooldown && kind !== 'kill' && kind !== 'copdown') return;
      this.crimeTimers[kind] = now;
      this.heat += amount;
      this.decayTimer = 0;
      this.flash = 1;
      const newStars = Math.min(5, 1 + Math.floor(this.heat));
      if (newStars > this.stars) state.audio.siren();
      this.stars = newStars;
      if (this.heat > 5) this.heat = 5;
    },
    update(dt) {
      this.flash = Math.max(0, this.flash - dt * 2);
      if (this.stars === 0) return;
      this.decayTimer += dt;
      if (this.decayTimer > WANTED.decayTime) {
        this.decayTimer = 0;
        this.heat = Math.max(0, this.heat - 1);
        this.stars = Math.min(5, 1 + Math.floor(this.heat));
        if (this.stars === 0) this.heat = 0;
      }
    },
  };
  return w;
}

export function spawnPoliceCar(state) {
  const world = state.world;
  const random = world.random;
  // Spawn on a road edge away from the player.
  const edge = Math.floor(random() * 4);
  let x = 0, y = 0, angle = 0;
  if (edge === 0) { const line = world.roadsY[1 + Math.floor(random() * 9)]; x = 120; y = line; angle = 0; }
  else if (edge === 1) { const line = world.roadsY[1 + Math.floor(random() * 9)]; x = WORLD.size - 120; y = line; angle = Math.PI; }
  else if (edge === 2) { const line = world.roadsX[1 + Math.floor(random() * 9)]; x = line; y = 120; angle = Math.PI / 2; }
  else { const line = world.roadsX[1 + Math.floor(random() * 9)]; x = line; y = WORLD.size - 120; angle = -Math.PI / 2; }
  const car = spawnVehicle(world, x, y, angle, 1, 'police');
  car.speed = 200;
  state.cars.push(car);
  state.audio.siren();
}

export function spawnCopOnFoot(state, near) {
  const random = state.world.random;
  const a = random() * Math.PI * 2;
  const cop = {
    x: near.x + Math.cos(a) * 90,
    y: near.y + Math.sin(a) * 90,
    vx: 0, vy: 0,
    angle: 0,
    health: 70,
    fireTimer: 0,
    bustTimer: 0,
  };
  state.cops.push(cop);
}

export function updatePolice(dt, state) {
  state.wanted.update(dt);
  const w = state.wanted;
  const player = state.player;

  // Spawn police cars at 2+ stars, up to a cap that grows with heat.
  state.policeSpawnTimer -= dt;
  if (w.stars >= 2 && state.policeSpawnTimer <= 0) {
    const maxCars = Math.min(POLICE_CAR_MAX, 1 + Math.floor(w.stars / 2));
    const active = state.cars.filter((c) => c.ai === 'police').length;
    if (active < maxCars) spawnPoliceCar(state);
    state.policeSpawnTimer = 3.5;
  }
  // Foot cops at 3+ stars.
  state.copSpawnTimer -= dt;
  if (w.stars >= 3 && state.copSpawnTimer <= 0) {
    const maxCops = (w.stars - 2) * 2;
    if (state.cops.length < maxCops) {
      const anchor = player.driving ? player.driving : player;
      spawnCopOnFoot(state, anchor);
    }
    state.copSpawnTimer = 4;
  }
  // Despawn everything when the heat is off.
  if (w.stars === 0) {
    if (state.cops.length > 0) state.cops = [];
    state.cars = state.cars.filter((c) => c.ai !== 'police');
  }

  // Foot cop AI: chase, shoot, bust.
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    const target = player.driving ? player.driving : player;
    const dx = target.x - cop.x;
    const dy = target.y - cop.y;
    const d = Math.hypot(dx, dy);
    cop.angle = Math.atan2(dy, dx);
    const speed = 120;
    if (d > 150) {
      cop.vx = (dx / d) * speed;
      cop.vy = (dy / d) * speed;
    } else {
      cop.vx *= 0.8;
      cop.vy *= 0.8;
    }
    cop.x += cop.vx * dt;
    cop.y += cop.vy * dt;
    cop.fireTimer -= dt;
    if (d < 340 && !player.driving && cop.fireTimer <= 0 && w.stars >= 3) {
      cop.fireTimer = 0.9;
      const aim = cop.angle + (Math.random() - 0.5) * 0.22;
      state.combat.spawnBullet(cop.x + Math.cos(aim) * 14, cop.y + Math.sin(aim) * 14, aim, 18, 'cop');
      state.combat.muzzle(cop.x + Math.cos(aim) * 14, cop.y + Math.sin(aim) * 14, aim);
      state.audio.gunshot(0.5);
    }
    // Bust: standing next to a player on foot with no weapon out.
    if (!player.driving && d < 30) {
      cop.bustTimer += dt;
      if (cop.bustTimer > 1.4) {
        state.events |= 2; // EVENT_PLAYER_BUSTED
        return;
      }
    } else {
      cop.bustTimer = Math.max(0, cop.bustTimer - dt * 0.5);
    }
  }
}
