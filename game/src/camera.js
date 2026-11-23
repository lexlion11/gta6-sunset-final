// Smooth follow camera: eases toward the player, looks slightly ahead of movement, and
// zooms out when driving fast so more road is visible.
import { WORLD } from './config.js';

export function createCamera(canvas) {
  const cam = { x: WORLD.size / 2, y: WORLD.size / 2, zoom: 1, targetZoom: 1, shake: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
  }

  function follow(player, dt) {
    const look = player.driving ? 130 : 60;
    const tx = player.x + player.vx * look / 200;
    const ty = player.y + player.vy * look / 200;
    const ease = 1 - Math.pow(0.001, dt);
    cam.x += (tx - cam.x) * ease;
    cam.y += (ty - cam.y) * ease;
    cam.targetZoom = player.driving ? 1.25 : 1.0;
    const speed = Math.hypot(player.vx, player.vy);
    if (player.driving && speed > 220) cam.targetZoom = 1.05;
    cam.zoom += (cam.targetZoom - cam.zoom) * (1 - Math.pow(0.002, dt));
    cam.shake = Math.max(0, cam.shake - dt * 3.2);
  }

  function shake(amount) {
    cam.shake = Math.min(1, cam.shake + amount);
  }

  /** World->screen transform for the current frame; returns the canvas 2D context transform. */
  function transform(ctx) {
    const ratio = window.devicePixelRatio || 1;
    const viewW = canvas.width / ratio;
    const viewH = canvas.height / ratio;
    let sx = (Math.random() - 0.5) * cam.shake * 22;
    let sy = (Math.random() - 0.5) * cam.shake * 22;
    const scale = Math.min(viewW, viewH) / 720 * cam.zoom;
    ctx.setTransform(scale, 0, 0, scale, viewW / 2 - cam.x * scale + sx, viewH / 2 - cam.y * scale + sy);
    return { scale, viewW, viewH };
  }

  resize();
  window.addEventListener('resize', resize);

  return { cam, follow, shake, transform, resize };
}
