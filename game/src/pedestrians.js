// Pedestrians: NPCs strolling the sidewalks, fleeing when shots are fired near them, and
// dropping cash when they go down. They wander between random sidewalk points and react
// to gunfire within earshot. Fleeing peds run ~2.6x their stroll speed and only calm down
// once they have put 220px between themselves and the player.
import { COLORS, PED_COUNT, WORLD } from './config.js';
import { collidesWorld } from './world.js';

export function spawnPeds(world, count, random) {
  const peds = [];
  for (let i = 0; i < count; i += 1) peds.push(spawnPed(world, random));
  return peds;
}

export function spawnPed(world, random) {
  const axis = random() < 0.5 ? 'h' : 'v';
  const lines = axis === 'h' ? world.roadsY : world.roadsX;
  const line = lines[1 + Math.floor(random() * (lines.length - 2))];
  const along = WORLD.block * 0.5 + random() * (WORLD.size - WORLD.block);
  const side = random() < 0.5 ? 1 : -1;
  const offset = 42 + random() * 18;
  const ped = {
    x: axis === 'h' ? along : line + side * offset,
    y: axis === 'h' ? line + side * offset : along,
    vx: 0, vy: 0,
    angle: random() * Math.PI * 2,
    state: 'walk',
    health: 40,
    speed: 34 + random() * 22,
    timer: 0,
    targetX: 0, targetY: 0,
    money: random() < 0.4 ? 10 + Math.floor(random() * 60) : 0,
    color: ['#e0d0b0', '#c8a878', '#d8b898', '#b89868'][Math.floor(random() * 4)],
    shirt: COLORS.traffic[Math.floor(random() * COLORS.traffic.length)],
    fleeTimer: 0,
    deadTimer: 0,
  };
  pickTarget(ped, world, random);
  return ped;
}

function pickTarget(ped, world, random) {
  const axis = random() < 0.5 ? 'h' : 'v';
  const lines = axis === 'h' ? world.roadsY : world.roadsX;
  const line = lines[1 + Math.floor(random() * (lines.length - 2))];
  const along = WORLD.block * 0.5 + random() * (WORLD.size - WORLD.block);
  const side = random() < 0.5 ? 1 : -1;
  const offset = 42 + random() * 18;
  ped.targetX = axis === 'h' ? along : line + side * offset;
  ped.targetY = axis === 'h' ? line + side * offset : along;
  ped.timer = 4 + random() * 6;
}

export function updatePeds(dt, state) {
  const random = state.world.random;
  const peds = state.peds;
  const player = state.player;
  for (let i = 0; i < peds.length; i += 1) {
    const ped = peds[i];
    if (ped.state === 'dead') {
      ped.deadTimer += dt;
      continue;
    }
    // Hear gunfire / see trouble nearby.
    const dp = Math.hypot(ped.x - player.x, ped.y - player.y);
    const gunOut = player.fireTimer > 0 && player.fireTimer < 0.3;
    if ((gunOut || state.wanted.stars >= 3) && dp < 260 && ped.state === 'walk') {
      ped.state = 'flee';
      ped.fleeTimer = 4 + random() * 3;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const fa = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.vx = Math.cos(fa) * ped.speed * 2.6;
      ped.vy = Math.sin(fa) * ped.speed * 2.6;
      if (ped.fleeTimer <= 0 && dp > 220) {
        ped.state = 'walk';
        pickTarget(ped, state.world, random);
      }
    } else {
      const dx = ped.targetX - ped.x;
      const dy = ped.targetY - ped.y;
      const d = Math.hypot(dx, dy);
      if (d < 12) pickTarget(ped, state.world, random);
      else {
        ped.vx = (dx / d) * ped.speed;
        ped.vy = (dy / d) * ped.speed;
      }
      ped.timer -= dt;
      if (ped.timer <= 0) pickTarget(ped, state.world, random);
    }
    const nx = ped.x + ped.vx * dt;
    const ny = ped.y + ped.vy * dt;
    if (!collidesWorld(state.world, nx, ped.y, 9)) ped.x = nx;
    if (!collidesWorld(state.world, ped.x, ny, 9)) ped.y = ny;
    if (ped.vx !== 0 || ped.vy !== 0) ped.angle = Math.atan2(ped.vy, ped.vx);
    // Run over by cars.
    for (let j = 0; j < state.cars.length; j += 1) {
      const car = state.cars[j];
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 24 && Math.abs(car.speed) > 60) {
        state.combat.killPed(ped, state);
        state.wanted.addHeat(1.0, 'hitped');
        break;
      }
    }
  }
  // Respawn dead peds after a while to keep the street alive.
  for (let i = peds.length - 1; i >= 0; i -= 1) {
    if (peds[i].state === 'dead' && peds[i].deadTimer > 12) {
      peds[i] = spawnPed(state.world, random);
    }
  }
  while (peds.length < PED_COUNT) peds.push(spawnPed(state.world, random));
}
