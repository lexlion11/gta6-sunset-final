// Vehicles: traffic that follows the road grid, parked cars, and the physics every car
// shares (acceleration, turning, friction, building collisions). The player's driven car
// is the same body with input instead of AI. Cars are stolen by walking up and pressing E.
import { COLORS, PLAYER, VEHICLE_TYPES, WORLD } from './config.js';
import { collidesWorld, nearestRoad } from './world.js';

let nextId = 1;

export function spawnVehicle(world, x, y, angle, typeIndex, ai) {
  const type = VEHICLE_TYPES[typeIndex % VEHICLE_TYPES.length];
  return {
    id: nextId++,
    x, y, angle,
    speed: 0,
    vx: 0, vy: 0,
    type,
    hp: type.hp,
    ai,             // 'traffic' | 'parked' | 'police' | 'player'
    dir: 1,         // travel direction along axis for traffic
    axis: 'h',      // current road axis
    turnTimer: 0,
    stopTimer: 0,
    burning: 0,
    color: ai === 'police' ? COLORS.copCar : type.color,
  };
}

/** Spawn traffic cars on road lanes, driving on the right. */
export function spawnTraffic(world, count, random) {
  const cars = [];
  for (let i = 0; i < count; i += 1) {
    const axis = random() < 0.5 ? 'h' : 'v';
    const lines = axis === 'h' ? world.roadsY : world.roadsX;
    const line = lines[1 + Math.floor(random() * (lines.length - 2))];
    const dir = random() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 20 : -20;
    const along = WORLD.block * 0.5 + random() * (WORLD.size - WORLD.block);
    const x = axis === 'h' ? along : line + lane;
    const y = axis === 'h' ? line + lane : along;
    const angle = axis === 'h' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = spawnVehicle(world, x, y, angle, Math.floor(random() * VEHICLE_TYPES.length), 'traffic');
    car.dir = dir;
    car.axis = axis;
    car.speed = 80 + random() * 60;
    cars.push(car);
  }
  return cars;
}

export function spawnParked(world, random) {
  const cars = [];
  for (let i = 0; i < 8; i += 1) {
    const line = world.roadsX[1 + Math.floor(random() * 9)];
    const x = WORLD.block * 0.5 + random() * (WORLD.size - WORLD.block);
    const car = spawnVehicle(world, x, line - 34, 0, Math.floor(random() * VEHICLE_TYPES.length), 'parked');
    cars.push(car);
  }
  return cars;
}

function carAhead(car, cars, state) {
  const look = 70 + Math.abs(car.speed) * 0.35;
  const fx = car.x + Math.cos(car.angle) * look;
  const fy = car.y + Math.sin(car.angle) * look;
  for (let i = 0; i < cars.length; i += 1) {
    const other = cars[i];
    if (other === car || other.burning > 0) continue;
    if (Math.hypot(other.x - fx, other.y - fy) < 34) return true;
  }
  if (state && state.player.driving === car) return false;
  if (state && !state.player.driving && Math.hypot(state.player.x - fx, state.player.y - fy) < 30) return true;
  return false;
}

/** Update one AI car (traffic or police chase). */
export function updateAiCar(car, dt, state) {
  if (car.burning > 0) {
    car.burning += dt;
    car.speed *= 0.96;
    if (car.burning > 2.5) {
      explode(car, state);
      return false;
    }
    integrate(car, dt, state);
    return true;
  }
  if (car.ai === 'parked') {
    car.speed = 0;
    return true;
  }
  if (car.ai === 'police') {
    policeDrive(car, dt, state);
  } else {
    // Traffic: cruise along the lane, slow for cars ahead, sometimes turn at intersections.
    car.turnTimer -= dt;
    const speedLimit = 150;
    if (carAhead(car, state.cars, state)) {
      car.speed = Math.max(0, car.speed - 420 * dt);
    } else {
      car.speed += (speedLimit - car.speed) * dt * 1.2;
    }
    if (car.turnTimer <= 0) {
      car.turnTimer = 2 + Math.random() * 4;
      maybeTurn(car, state.world);
    }
  }
  integrate(car, dt, state);
  return true;
}

function maybeTurn(car, world) {
  // Turn at the next intersection on the cross axis.
  const cross = car.axis === 'h' ? world.roadsX : world.roadsY;
  const pos = car.axis === 'h' ? car.x : car.y;
  const ahead = cross.find((line) => (car.dir > 0 ? line > pos + 30 : line < pos - 30));
  if (ahead === undefined) return;
  const dist = Math.abs(ahead - pos);
  if (dist > 160) return;
  if (Math.random() > 0.45) return;
  const newAxis = car.axis === 'h' ? 'v' : 'h';
  const lines = newAxis === 'h' ? world.roadsY : world.roadsX;
  if (!lines.includes(car.axis === 'h' ? car.y - (car.dir > 0 ? 20 : -20) : car.x - (car.dir > 0 ? 20 : -20))) return;
  // Snap to the intersection and pick a new direction.
  if (car.axis === 'h') car.x = ahead;
  else car.y = ahead;
  car.axis = newAxis;
  car.dir = Math.random() < 0.5 ? 1 : -1;
  const lane = car.dir > 0 ? 20 : -20;
  if (newAxis === 'v') {
    car.x += lane;
    car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.y += lane;
    car.angle = car.dir > 0 ? 0 : Math.PI;
  }
}

function policeDrive(car, dt, state) {
  const p = state.player;
  const target = p.driving ? p : p;
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy);
  const desired = Math.atan2(dy, dx);
  let diff = desired - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const turn = car.type.turn;
  car.angle += Math.max(-turn * dt, Math.min(turn * dt, diff));
  if (carAhead(car, state.cars, state) && dist > 120) {
    car.speed = Math.max(0, car.speed - 500 * dt);
  } else {
    const chase = 260 + state.wanted.stars * 22;
    car.speed += (chase - car.speed) * dt * 1.4;
  }
  // Ram damage on contact handled in combat collision pass.
  if (dist < 46 && !p.driving) {
    state.combat.hitPlayer(12 * dt, car);
  }
}

/** Integrate the car body: friction, building collision, velocity. */
function integrate(car, dt, state) {
  const friction = car.ai === 'player' ? 0.985 : 0.995;
  car.speed *= Math.pow(friction, dt * 60);
  const maxSpeed = car.type.maxSpeed * (car.ai === 'traffic' ? 0.55 : 1);
  car.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, car.speed));
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = car.type.width / 2;
  if (collidesWorld(state.world, nx, car.y, r)) {
    car.speed *= 0.4;
    damageCar(car, Math.abs(car.speed) * 0.05, state);
  } else car.x = nx;
  if (collidesWorld(state.world, car.x, ny, r)) {
    car.speed *= 0.4;
    damageCar(car, Math.abs(car.speed) * 0.05, state);
  } else car.y = ny;
  car.vx = Math.cos(car.angle) * car.speed;
  car.vy = Math.sin(car.angle) * car.speed;
}

export function damageCar(car, amount, state) {
  car.hp -= amount;
  if (car.hp <= 0 && car.burning === 0 && car.ai !== 'burning') {
    car.burning = 0.01;
    if (car.ai === 'police') state.wanted.addHeat(0.4, 'copdown');
  }
}

function explode(car, state) {
  car.ai = 'burning';
  car.burning = 3;
  state.combat.explosion(car.x, car.y, 70, car.ai === 'police');
  state.cars = state.cars.filter((c) => c !== car);
  if (state.player.driving === car) {
    state.player.driving = null;
    state.combat.hitPlayer(40, car);
  }
}

/** Player driving: input is a move vector {dx,dy} plus throttle semantics. */
export function drivePlayerCar(car, move, dt, state) {
  const turn = car.type.turn;
  const speed = car.speed;
  // Steering only works when moving.
  if (Math.abs(speed) > 12) {
    const steer = move.dx * turn * dt * Math.min(1, Math.abs(speed) / 120);
    car.angle += speed > 0 ? steer : -steer;
  }
  const throttle = move.dy < 0 ? 1 : move.dy > 0 ? -0.6 : 0;
  if (throttle > 0) car.speed += car.type.accel * dt;
  else if (throttle < 0) car.speed -= car.type.accel * 0.7 * dt;
  else car.speed *= Math.pow(0.97, dt * 60);
  // Handbrake-ish sharp turn at low speed: space handled as punch on foot; use Shift.
  if (move.running && Math.abs(speed) > 60) car.speed *= Math.pow(0.9, dt * 60);
  integrate(car, dt, state);
}

/** Can the player enter this vehicle? */
export function nearestEnterableCar(state) {
  const p = state.player;
  let best = null;
  let bestD = PLAYER.enterRange;
  for (let i = 0; i < state.cars.length; i += 1) {
    const car = state.cars[i];
    if (car.burning > 0) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

/** Separate overlapping cars (circle approximation) and damage both on hard hits. */
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = (a.type.width + b.type.width) / 2;
      if (d < min && d > 0.01) {
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push; a.y -= ny * push;
        b.x += nx * push; b.y += ny * push;
        const impact = Math.abs(a.speed) + Math.abs(b.speed);
        if (impact > 200) {
          damageCar(a, impact * 0.02, state);
          damageCar(b, impact * 0.02, state);
          if (a.ai === 'traffic' || b.ai === 'traffic') state.wanted.addHeat(0.3, 'hitcar');
          state.camera.shake(Math.min(0.5, impact / 1200));
        }
        a.speed *= 0.7;
        b.speed *= 0.7;
      }
    }
  }
}
