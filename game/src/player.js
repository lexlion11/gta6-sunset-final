// The player: Riley, a small-time hustler. Two states — on foot (8-direction move, aim
// with the mouse, punch, shoot) and driving (the car's body with input). Health, money,
// entering and exiting vehicles, respawn at the hospital on death or the station when
// busted.
import { COLORS, PLAYER, WANTED } from './config.js';
import { collidesWorld } from './world.js';
import { drivePlayerCar, nearestEnterableCar } from './vehicles.js';

export function createPlayer(spawn) {
  return {
    x: spawn.x, y: spawn.y,
    vx: 0, vy: 0,
    angle: 0,
    health: PLAYER.maxHealth,
    money: 0,
    driving: null,
    fireTimer: 0,
    punchTimer: 0,
    invuln: 1.5,
    weapon: 'pistol',
    walkPhase: 0,
  };
}

export function updatePlayer(dt, state, input, view) {
  const p = state.player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.fireTimer = Math.max(0, p.fireTimer - dt);
  p.punchTimer = Math.max(0, p.punchTimer - dt);
  const actions = input.takeActions();

  if (p.driving) {
    const move = input.move();
    drivePlayerCar(p.driving, move, dt, state);
    p.x = p.driving.x;
    p.y = p.driving.y;
    p.vx = p.driving.vx;
    p.vy = p.driving.vy;
    p.angle = p.driving.angle;
    // Drive-by: shoot forward with mouse while driving.
    if (input.mouseDown() && p.fireTimer === 0) {
      const aim = input.aim(p, view);
      fire(state, aim);
    }
    if (actions & 1) exitVehicle(state);
    return actions;
  }

  // On foot.
  const move = input.move();
  const speed = move.running ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const nx = p.x + move.dx * speed * dt;
  const ny = p.y + move.dy * speed * dt;
  if (!collidesWorld(state.world, nx, p.y, PLAYER.radius)) p.x = nx;
  if (!collidesWorld(state.world, p.x, ny, PLAYER.radius)) p.y = ny;
  p.vx = move.dx * speed;
  p.vy = move.dy * speed;
  if (move.dx !== 0 || move.dy !== 0) p.walkPhase += dt * 10;
  const aim = input.aim(p, view);
  p.angle = aim;

  if (actions & 1) {
    const car = nearestEnterableCar(state);
    if (car) enterVehicle(state, car);
  }
  if ((actions & 2 || input.mouseDown()) && p.fireTimer === 0) fire(state, aim);
  if ((actions & 16) && p.punchTimer === 0) {
    p.punchTimer = 0.45;
    state.combat.punch(p.x, p.y, aim);
    state.audio.whoosh();
  }
  return actions;
}

function fire(state, aim) {
  const p = state.player;
  // Fire rate lives in config.js (PLAYER.fireRate) so it can be tuned in one place.
  p.fireTimer = PLAYER.fireRate;
  const mx = p.x + Math.cos(aim) * 18;
  const my = p.y + Math.sin(aim) * 18;
  state.combat.spawnBullet(mx, my, aim, PLAYER.bulletDamage, 'player');
  state.combat.muzzle(mx, my, aim);
  state.audio.gunshot(1);
  state.camera.shake(0.18);
}

export function enterVehicle(state, car) {
  const p = state.player;
  const wasTraffic = car.ai === 'traffic';
  p.driving = car;
  car.ai = 'player';
  p.invuln = 0.5;
  if (wasTraffic) {
    state.wanted.addHeat(WANTED.stealCar, 'steal');
    state.mission.notify('Vehicle stolen');
  }
  state.audio.door();
}

export function exitVehicle(state) {
  const p = state.player;
  const car = p.driving;
  if (!car) return;
  car.ai = 'parked';
  car.speed *= 0.3;
  const side = car.angle + Math.PI / 2;
  const ex = car.x + Math.cos(side) * 34;
  const ey = car.y + Math.sin(side) * 34;
  if (!collidesWorld(state.world, ex, ey, PLAYER.radius)) {
    p.x = ex;
    p.y = ey;
  } else {
    p.x = car.x - Math.cos(side) * 34;
    p.y = car.y - Math.sin(side) * 34;
  }
  p.driving = null;
  p.vx = 0;
  p.vy = 0;
  state.audio.door();
}

export function respawnPlayer(state, kind) {
  const p = state.player;
  if (p.driving) {
    p.driving.ai = 'parked';
    p.driving = null;
  }
  const spot = kind === 'busted' ? state.world.spots.lockup : state.world.spots.hospital;
  p.x = spot.x;
  p.y = spot.y;
  p.health = PLAYER.maxHealth;
  p.invuln = 2.5;
  p.vx = 0;
  p.vy = 0;
  state.wanted.stars = 0;
  state.wanted.heat = 0;
  state.wanted.decayTimer = 0;
  state.cops = [];
  state.cars = state.cars.filter((c) => c.ai !== 'police');
  const fee = kind === 'busted' ? Math.min(p.money, 300) : Math.min(p.money, 150);
  p.money -= fee;
  state.mission.notify(kind === 'busted' ? `Busted. Paid $${fee} in fines.` : `Wasted. Hospital bill: $${fee}`);
}
