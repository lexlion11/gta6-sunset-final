// Keyboard and mouse input. Held keys give an 8-direction move; the mouse gives an aim
// angle in world space; one-shot presses (enter vehicle, shoot, pause, start) are queued
// as bit flags and taken once by the loop, so a press between two frames is never lost.

export const ACTION_ENTER = 1;
export const ACTION_SHOOT = 2;
export const ACTION_PAUSE = 4;
export const ACTION_START = 8;
export const ACTION_PUNCH = 16;
export const ACTION_MISSION = 32;
export const ACTION_HORN = 64;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);

export function createInput(canvas, camera) {
  const keys = new Set();
  let actions = 0;
  let mouse = { sx: 0, sy: 0, down: false };

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACTION_ENTER;
    else if (event.code === 'KeyF') actions |= ACTION_MISSION;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    else if (event.code === 'Enter') actions |= ACTION_START;
    else if (event.code === 'Space') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.sx = event.clientX - rect.left;
    mouse.sy = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', () => { mouse.down = true; actions |= ACTION_SHOOT; });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    move() {
      const dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
      const dy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0);
      const len = Math.hypot(dx, dy) || 1;
      const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
      return { dx: dx / len, dy: dy / len, running };
    },
    /** Aim angle in world coordinates from the mouse position and the camera transform. */
    aim(player, view) {
      const wx = mouse.sx - view.viewW / 2 + camera.cam.x * view.scale;
      const wy = mouse.sy - view.viewH / 2 + camera.cam.y * view.scale;
      return Math.atan2(wy - player.y, wx - player.x);
    },
    mouseDown() { return mouse.down; },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Used by the screenshot autopilot to inject input. */
    inject(flags) { actions |= flags; },
    setMouse(sx, sy) { mouse.sx = sx; mouse.sy = sy; },
  };
}
