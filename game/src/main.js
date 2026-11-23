// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (STEP from config.js, accumulated against real frame time so a slow display
// never slows the simulation), and the renderer paints what is there. The game moves
// between screens: start, playing, mission offer, paused, wasted and busted. ?shot=N
// stages a screenshot scene instead of running the interactive loop.
import { COLORS, SAVE_KEY, STEP, TRAFFIC_COUNT, PED_COUNT } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createCamera } from './camera.js';
import { createInput } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer, respawnPlayer } from './player.js';
import { spawnTraffic, spawnParked, updateAiCar, resolveCarCollisions } from './vehicles.js';
import { spawnPeds, updatePeds } from './pedestrians.js';
import { createWanted, updatePolice } from './police.js';
import { createCombat, EVENT_PLAYER_DEAD } from './combat.js';
import { createMissionEngine } from './missions.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shotParam = params.get('shot');
const shot = shotParam ? Number.parseInt(shotParam, 10) : null;
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 424242;

const canvas = document.getElementById('game');
const status = document.getElementById('status');

function createGame() {
  const world = createWorld(createRandom(seed));
  const camera = createCamera(canvas);
  const audio = createAudio();
  const renderer = createRenderer(canvas);
  const input = createInput(canvas, camera);

  const player = createPlayer(world.spots.playerStart);
  const state = {
    world, camera, audio, player,
    cars: [...spawnTraffic(world, TRAFFIC_COUNT, world.random), ...spawnParked(world, world.random)],
    peds: spawnPeds(world, PED_COUNT, world.random),
    cops: [],
    pickups: [],
    combat: null,
    wanted: null,
    mission: null,
    time: 0,
    screen: 'start',
    events: 0,
    hasSave: false,
    policeSpawnTimer: 0,
    copSpawnTimer: 0,
    get money() { return player.money; },
    set money(v) { player.money = v; },
    save() {
      try {
        window.localStorage.setItem(SAVE_KEY, JSON.stringify({
          money: player.money,
          missionIndex: this.mission.index,
          health: player.health,
        }));
      } catch (err) { /* storage off: the save lasts this visit only */ }
    },
    load() {
      try {
        const raw = window.localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        player.money = data.money ?? 0;
        this.mission.index = data.missionIndex ?? 0;
        player.health = data.health ?? player.health;
        return true;
      } catch (err) { return false; }
    },
  };

  state.combat = createCombat(state);
  state.wanted = createWanted(state);
  state.mission = createMissionEngine(state);

  /** Advance the simulation one fixed step. `inputObj` is the input interface; `shot`
   *  skips screen handling so scenes run deterministically. */
  function step(dt, inputObj, isShot) {
    state.time += dt;
    state.events = 0;
    const actions = updatePlayer(dt, state, inputObj, currentView());
    if (!isShot) handleActions(actions, inputObj);

    // Traffic and police cars.
    for (let i = state.cars.length - 1; i >= 0; i -= 1) {
      const car = state.cars[i];
      if (car.ai === 'player') continue;
      if (!updateAiCar(car, dt, state)) continue;
    }
    resolveCarCollisions(state);
    updatePeds(dt, state);
    updatePolice(dt, state);
    state.combat.update(dt);
    state.mission.start(dt);
    camera.follow(player, dt);

    // Engine / siren audio follows the action.
    if (player.driving) audio.engine(Math.abs(player.driving.speed), true);
    else audio.engine(0, false);
    if (state.wanted.stars >= 2) audio.siren();
    else audio.stopSiren();

    if (!isShot) {
      if (state.events & EVENT_PLAYER_DEAD) {
        state.screen = 'dead';
        audio.stopSiren();
        announce('You were wasted. Press Enter to continue.');
      } else if (state.events & 2) {
        state.screen = 'busted';
        audio.stopSiren();
        announce('Busted. Press Enter to continue.');
      }
    }
  }

  function handleActions(actions, inputObj) {
    if (state.screen === 'start') {
      if (actions & 8) { // ACTION_START
        state.screen = 'playing';
        audio.resume();
        announce('Playing. Walk into the yellow marker to take a mission.');
      }
      return;
    }
    if (state.screen === 'dead' || state.screen === 'busted') {
      if (actions & 8 || actions & 2) {
        respawnPlayer(state, state.screen === 'busted' ? 'busted' : 'dead');
        state.screen = 'playing';
        announce('Back on the street.');
      }
      return;
    }
    if (state.screen === 'offer') {
      if (actions & 8) { state.mission.accept(); state.screen = 'playing'; announce('Mission accepted.'); }
      else if (actions & 4) { state.mission.decline(); state.screen = 'playing'; }
      return;
    }
    if (state.screen === 'paused') {
      if (actions & 4 || actions & 8) { state.screen = 'playing'; announce('Playing.'); }
      return;
    }
    // Playing.
    if (actions & 4) { state.screen = 'paused'; audio.stopSiren(); announce('Paused.'); }
    // Mission offer trigger.
    if (state.mission.state === 'offer') { state.screen = 'offer'; }
  }

  let view = { viewW: 800, viewH: 600, scale: 1, mx: 400, my: 300 };
  function currentView() {
    const ratio = window.devicePixelRatio || 1;
    const viewW = canvas.width / ratio;
    const viewH = canvas.height / ratio;
    const scale = Math.min(viewW, viewH) / 720 * camera.cam.zoom;
    // Mouse in screen space for the crosshair.
    view = { viewW, viewH, scale, mx: viewW / 2, my: viewH / 2 };
    return view;
  }

  function announce(message) {
    if (status) status.textContent = message;
  }

  return { state, input, camera, renderer, audio, step, handleActions, announce, currentView };
}

const game = createGame();
game.state.hasSave = game.state.load();

function paint() {
  const view = game.currentView();
  // Mouse position for the crosshair: read from the input module's last known position.
  view.mx = lastMouse.x;
  view.my = lastMouse.y;
  game.renderer.draw(game.state, view);
  const s = game.state.screen;
  const hud = game.renderer.hud;
  if (s === 'start') hud.drawStart(game.state);
  else if (s === 'paused') hud.drawPanel('Paused', ['The city waits for no one.'], 'Press ESC or ENTER to resume');
  else if (s === 'dead') hud.drawPanel('WASTED', ['You lost some cash at the hospital.'], 'Press ENTER to get back up');
  else if (s === 'busted') hud.drawPanel('BUSTED', ['The cops took their cut.'], 'Press ENTER to get back out');
  else if (s === 'offer') {
    const offer = game.state.mission.offerText();
    if (offer) hud.drawMissionOffer(offer);
  }
}

const lastMouse = { x: innerWidth / 2, y: innerHeight / 2 };
canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  lastMouse.x = event.clientX - rect.left;
  lastMouse.y = event.clientY - rect.top;
});

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (game.state.screen === 'playing' || game.state.screen === 'start') {
      while (accumulator >= STEP && (game.state.screen === 'playing' || game.state.screen === 'start')) {
        game.step(STEP, game.input, false);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      // Panels still need to read one-shot presses: the simulation is paused, the input is not.
      game.handleActions(game.input.takeActions());
    }
    paint();
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.state.screen === 'playing') {
      game.state.screen = 'paused';
      game.announce('Paused.');
    }
  });
  game.announce('Sunset City. Press Enter to start.');
  requestAnimationFrame(frame);
}

function runShot(n) {
  const screen = stageShot(n, game);
  game.state.screen = screen;
  let painted = 0;
  function paintTwice() {
    paint();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paintTwice);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintTwice);
}

if (shot !== null && shot >= 1 && shot <= 4) runShot(shot);
else runGame();
