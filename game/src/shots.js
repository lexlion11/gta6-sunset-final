// The screenshot scenes behind ?shot=N. Each one sets the game into a specific state,
// runs the real simulation forward for a few seconds under a scripted autopilot, then
// leaves it for the loop to paint — so each frame is what the game really looks like.
import { PLAYER } from './config.js';
import { enterVehicle } from './player.js';
import { spawnPoliceCar, spawnCopOnFoot } from './police.js';

const SECONDS = 6;

/** Set up scene N (1-4) on an already-created game. Returns the screen to draw. */
export function stageShot(n, game) {
  const state = game.state;
  const random = state.world.random;

  if (n === 2) {
    // Put the player behind the wheel of a decent car.
    const car = state.cars.find((c) => c.ai === 'traffic' || c.ai === 'parked');
    if (car) {
      car.x = state.player.x;
      car.y = state.player.y;
      enterVehicle(state, car);
      state.wanted.stars = 0;
      state.wanted.heat = 0;
    }
  }
  if (n === 3) {
    // On foot, shooting, wanted 4 with cars and foot cops closing in.
    state.wanted.stars = 4;
    state.wanted.heat = 4;
    state.wanted.decayTimer = 0;
    for (let i = 0; i < 3; i += 1) spawnPoliceCar(state);
    for (let i = 0; i < 3; i += 1) spawnCopOnFoot(state, state.player);
    state.player.fireTimer = 0.1;
    state.player.invuln = 4; // survive long enough to frame the chase
  }

  if (n === 4) {
    // Mission 1 in progress: the stolen coupe, deliver it to the lockup.
    state.mission.index = 0;
    state.mission.state = 'active';
    state.mission.setup(); // spawns the mission coupe downtown
    if (state.mission.car) {
      state.player.x = state.mission.car.x;
      state.player.y = state.mission.car.y;
      enterVehicle(state, state.mission.car);
    }
    state.mission.stage = 1;
    const dest = state.world.spots.lockup;
    state.mission.targets = [{ x: dest.x, y: dest.y, r: 55, label: 'Deliver the car', kind: 'objective' }];
    state.mission.objective = 'Deliver the coupe to the lockup';
    state.player.money = 1250;
  }

  if (n === 1) {
    // Start screen: some money and a populated street for the backdrop.
    state.player.money = 0;
  }

  // Run the simulation under an autopilot so the scene is alive.
  let fireTimer = 0;
  for (let i = 0; i < SECONDS / (1 / 60); i += 1) {
    const dt = 1 / 60;
    const input = autopilot(n, state, fireTimer);
    fireTimer = input._fireTimer;
    game.step(dt, input, true);
  }

  if (n === 1) return 'start';
  if (n === 3) return 'playing';
  if (n === 4) return 'playing';
  return 'playing';
}

function autopilot(n, state, fireTimer) {
  const p = state.player;
  let dx = 0, dy = 0;
  let shoot = false;
  let mx = 0, my = 0; // fake aim (screen centre-ish)

  if (p.driving) {
    // Cruise along the road, weaving slightly.
    const car = p.driving;
    const wander = Math.sin(performance.now() / 700) * 0.5;
    dx = wander;
    dy = -1; // forward
  } else {
    // Walk forward, occasionally shooting (scene 3).
    dx = Math.sin(performance.now() / 900) * 0.7;
    dy = -0.7;
    if (n === 3) {
      fireTimer -= 1 / 60;
      if (fireTimer <= 0) {
        shoot = true;
        fireTimer = 0.5;
      }
    }
  }
  const input = {
    move: () => ({ dx, dy, running: false }),
    aim: () => p.angle,
    mouseDown: () => shoot,
    takeActions: () => (shoot ? 2 : 0),
    _fireTimer: fireTimer,
  };
  return input;
}
