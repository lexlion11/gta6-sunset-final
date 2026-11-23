// Combat: bullets, melee hits, particles (blood, muzzle flash, explosions, smoke) and
// damage to pedestrians, cops, vehicles and the player. Also the death/busted bookkeeping
// the rest of the game reads through state.events.
import { COLORS, PLAYER, WORLD } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_PLAYER_DEAD = 1;
export const EVENT_PLAYER_BUSTED = 2;
export const EVENT_MISSION_HINT = 4;

export function createCombat(state) {
  const bullets = [];
  const particles = [];

  function spawnBullet(x, y, angle, damage, owner) {
    bullets.push({
      x, y,
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      life: 1.1,
      damage,
      owner,
    });
  }

  function muzzle(x, y, angle) {
    for (let i = 0; i < 6; i += 1) {
      const a = angle + (Math.random() - 0.5) * 0.6;
      particles.push({
        x, y,
        vx: Math.cos(a) * (120 + Math.random() * 180),
        vy: Math.sin(a) * (120 + Math.random() * 180),
        life: 0.09 + Math.random() * 0.06,
        maxLife: 0.15,
        color: i < 2 ? COLORS.muzzle : COLORS.bullet,
        size: 3 + Math.random() * 3,
      });
    }
  }

  function blood(x, y, angle) {
    for (let i = 0; i < 10; i += 1) {
      const a = angle + (Math.random() - 0.5) * 1.4;
      const sp = 60 + Math.random() * 160;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.3 + Math.random() * 0.4,
        maxLife: 0.7,
        color: COLORS.blood,
        size: 2 + Math.random() * 3,
        gravity: false,
      });
    }
  }

  function explosion(x, y, radius, killedCop) {
    for (let i = 0; i < 34; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 320;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.6,
        maxLife: 0.95,
        color: i % 3 === 0 ? '#ffe066' : i % 3 === 1 ? '#e8703a' : '#5a4030',
        size: 3 + Math.random() * 6,
      });
    }
    state.camera.shake(0.9);
    // Splash damage to nearby actors.
    const peds = state.peds;
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      if (ped.state === 'dead') continue;
      if (Math.hypot(ped.x - x, ped.y - y) < radius) killPed(ped, state);
    }
    for (let i = state.cops.length - 1; i >= 0; i -= 1) {
      const cop = state.cops[i];
      if (Math.hypot(cop.x - x, cop.y - y) < radius) killCop(cop, state);
    }
    if (Math.hypot(state.player.x - x, state.player.y - y) < radius * 0.7) hitPlayer(30, null);
    if (killedCop) state.wanted.addHeat(1.5, 'copdown');
  }

  function killPed(ped, state) {
    if (ped.state === 'dead') return;
    ped.state = 'dead';
    ped.deadTimer = 0;
    blood(ped.x, ped.y, Math.random() * Math.PI * 2);
    state.wanted.addHeat(1.2, 'kill');
    if (ped.money > 0) {
      state.pickups.push({ x: ped.x, y: ped.y, money: ped.money, life: 12 });
    }
  }

  function killCop(cop, state) {
    blood(cop.x, cop.y, Math.random() * Math.PI * 2);
    state.cops = state.cops.filter((c) => c !== cop);
    state.wanted.addHeat(1.6, 'copdown');
  }

  function hitPlayer(amount, source) {
    if (state.player.invuln > 0 || state.screen !== 'playing') return;
    state.player.health -= amount;
    state.camera.shake(Math.min(0.6, amount / 60));
    if (state.player.health <= 0) {
      state.player.health = 0;
      state.events |= EVENT_PLAYER_DEAD;
    }
  }

  function update(dt) {
    // Bullets.
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let hit = false;
      if (b.life <= 0 || collidesPoint(state, b.x, b.y)) hit = true;
      if (!hit) {
        // vs peds.
        for (let j = 0; j < state.peds.length; j += 1) {
          const ped = state.peds[j];
          if (ped.state === 'dead' || b.owner === 'ped') continue;
          if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
            blood(ped.x, ped.y, Math.atan2(b.vy, b.vx));
            ped.health -= b.damage;
            state.wanted.addHeat(0.8, 'shoot');
            if (ped.health <= 0) killPed(ped, state);
            else { ped.state = 'flee'; ped.fleeTimer = 6; }
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        for (let j = 0; j < state.cops.length; j += 1) {
          const cop = state.cops[j];
          if (Math.hypot(cop.x - b.x, cop.y - b.y) < 13) {
            blood(cop.x, cop.y, Math.atan2(b.vy, b.vx));
            cop.health -= b.damage;
            state.wanted.addHeat(1.0, 'shootcop');
            if (cop.health <= 0) killCop(cop, state);
            hit = true;
            break;
          }
        }
      }
      if (!hit) {
        // vs cars.
        for (let j = 0; j < state.cars.length; j += 1) {
          const car = state.cars[j];
          if (car === state.player.driving) continue;
          if (Math.abs(car.x - b.x) < car.type.width / 2 + 4 && Math.abs(car.y - b.y) < car.type.length / 2 + 4) {
            import_damageCar(state, car, b.damage * 0.5);
            hit = true;
            break;
          }
        }
      }
      if (!hit && state.player.driving === null && b.owner !== 'player') {
        // Enemy bullets vs player.
        if (Math.hypot(state.player.x - b.x, state.player.y - b.y) < PLAYER.radius) {
          hitPlayer(b.damage * 0.6, null);
          hit = true;
        }
      }
      if (hit) bullets.splice(i, 1);
    }
    // Particles.
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      pk.life -= dt;
      if (Math.hypot(state.player.x - pk.x, state.player.y - pk.y) < 26) {
        state.money += pk.money;
        state.pickups.splice(i, 1);
        state.audio.chime();
      } else if (pk.life <= 0) state.pickups.splice(i, 1);
    }
  }

  return {
    bullets, particles,
    spawnBullet, muzzle, blood, explosion, killPed, killCop, hitPlayer,
    update,
    punch(targetX, targetY, angle) {
      // Melee: hits anything within range in front.
      const p = state.player;
      const tx = p.x + Math.cos(angle) * PLAYER.punchRange;
      const ty = p.y + Math.sin(angle) * PLAYER.punchRange;
      for (let j = 0; j < state.peds.length; j += 1) {
        const ped = state.peds[j];
        if (ped.state === 'dead') continue;
        if (Math.hypot(ped.x - tx, ped.y - ty) < 20) {
          ped.health -= PLAYER.punchDamage;
          blood(ped.x, ped.y, angle);
          if (ped.health <= 0) killPed(ped, state);
          else { ped.state = 'flee'; ped.fleeTimer = 5; }
          return true;
        }
      }
      for (let j = 0; j < state.cops.length; j += 1) {
        const cop = state.cops[j];
        if (Math.hypot(cop.x - tx, cop.y - ty) < 20) {
          cop.health -= PLAYER.punchDamage;
          state.wanted.addHeat(0.6, 'shootcop');
          if (cop.health <= 0) killCop(cop, state);
          return true;
        }
      }
      return false;
    },
  };
}

function collidesPoint(state, x, y) {
  const world = state.world;
  if (x < 0 || y < 0 || x > WORLD.size || y > WORLD.size) return true;
  if (x > world.water.x) return true;
  for (let i = 0; i < world.buildings.length; i += 1) {
    const b = world.buildings[i];
    if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  }
  return false;
}

function import_damageCar(state, car, amount) {
  car.hp -= amount;
  if (car.hp <= 0 && car.burning === 0) {
    car.burning = 0.01;
  }
}
