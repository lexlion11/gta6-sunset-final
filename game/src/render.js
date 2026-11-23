// Drawing only: the world and everything in it. The camera transform maps world
// coordinates to the screen; the HUD (health, money, stars, minimap, panels) is drawn in
// screen space on top by hud.js. Draw order: ground -> water -> roads -> buildings ->
// pickups -> markers -> peds -> cops -> rivals -> vehicles -> player -> bullets ->
// particles -> sun tint, with soft shadows under cars and people.
import { COLORS, FONT, PLAYER, SUN_TINT, WORLD } from './config.js';
import { createHud } from './hud.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const hud = createHud(canvas, ctx);
  let waveT = 0;

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1d24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawShadow(x, y, w, h) {
    ctx.fillStyle = COLORS.shadow;
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 4, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorld(state, view) {
    const world = state.world;
    waveT += 0.016;
    // Ground.
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, 0, WORLD.size, WORLD.size);
    // Water with gentle wave bands.
    const w = world.water;
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = COLORS.waterDeep;
    for (let i = 0; i < 7; i += 1) {
      const y = ((i * 120 + waveT * 14) % w.h);
      ctx.fillRect(w.x, w.y + y, w.w, 5);
    }
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(w.x - 26, 0, 26, WORLD.size);

    // Parks and beach blocks.
    for (let i = 0; i < world.parks.length; i += 1) {
      const p = world.parks[i];
      ctx.fillStyle = p.kind === 'beach' ? COLORS.sand : COLORS.grass;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      if (p.kind === 'park') {
        ctx.fillStyle = COLORS.grassDark;
        for (let e = 0; e < 3; e += 1) {
          ctx.fillRect(p.x + 20 + e * 40, p.y + 20, 18, p.h - 40);
        }
      }
    }

    // Roads with sidewalks and dashed centre lines.
    ctx.fillStyle = COLORS.road;
    const half = WORLD.road / 2;
    for (let i = 0; i < world.roadsX.length; i += 1) {
      const x = world.roadsX[i];
      ctx.fillRect(x - half, 0, WORLD.road, WORLD.size);
    }
    for (let i = 0; i < world.roadsY.length; i += 1) {
      const y = world.roadsY[i];
      ctx.fillRect(0, y - half, WORLD.size, WORLD.road);
    }
    ctx.fillStyle = COLORS.sidewalk;
    for (let i = 0; i < world.roadsX.length; i += 1) {
      const x = world.roadsX[i];
      ctx.fillRect(x - half - 8, 0, 8, WORLD.size);
      ctx.fillRect(x + half, 0, 8, WORLD.size);
    }
    for (let i = 0; i < world.roadsY.length; i += 1) {
      const y = world.roadsY[i];
      ctx.fillRect(0, y - half - 8, WORLD.size, 8);
      ctx.fillRect(0, y + half, WORLD.size, 8);
    }
    ctx.strokeStyle = COLORS.roadLine;
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 20]);
    ctx.beginPath();
    for (let i = 0; i < world.roadsX.length; i += 1) {
      const x = world.roadsX[i];
      ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.size);
    }
    for (let i = 0; i < world.roadsY.length; i += 1) {
      const y = world.roadsY[i];
      ctx.moveTo(0, y); ctx.lineTo(WORLD.size, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Buildings: shadow offset by height, body, lit edges, window grid.
    const buildings = world.buildings;
    for (let i = 0; i < buildings.length; i += 1) {
      const b = buildings[i];
      const off = b.tall * 9;
      ctx.fillStyle = COLORS.shadow;
      ctx.fillRect(b.x + off * 0.45, b.y + off * 0.45, b.w, b.h);
      ctx.fillStyle = b.base;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.hi;
      ctx.fillRect(b.x, b.y, b.w, Math.max(4, b.h * 0.12));
      ctx.fillRect(b.x, b.y, Math.max(3, b.w * 0.08), b.h);
      ctx.fillStyle = 'rgba(30,36,48,0.55)';
      const cols = b.windows;
      const rows = Math.max(2, Math.round(b.h / 26));
      const pad = 7;
      const cw = (b.w - pad * 2) / cols;
      const ch = (b.h - pad * 2) / rows;
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          if ((cx + cy + i) % 3 === 0) continue;
          ctx.fillRect(b.x + pad + cx * cw + 2, b.y + pad + cy * ch + 2, Math.max(1, cw - 5), Math.max(1, ch - 5));
        }
      }
      if (b.roof) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.3, b.w * 0.4, b.h * 0.4);
      }
    }

    // Trees.
    for (let i = 0; i < world.trees.length; i += 1) {
      const t = world.trees[i];
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath(); ctx.arc(t.x + 4, t.y + 5, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = t.palm ? '#3f8f4e' : '#2f7a3e';
      ctx.beginPath(); ctx.arc(t.x, t.y, 10, 0, Math.PI * 2); ctx.fill();
      if (t.palm) {
        ctx.strokeStyle = '#6b4a2a';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + 5, t.y - 16); ctx.stroke();
      }
    }

    // Money pickups.
    for (let i = 0; i < state.pickups.length; i += 1) {
      const pk = state.pickups[i];
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath(); ctx.arc(pk.x + 2, pk.y + 3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2ecc71';
      ctx.beginPath(); ctx.arc(pk.x, pk.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('$', pk.x, pk.y + 3);
    }

    // Mission markers: pulsing yellow rings.
    const markers = state.mission.markers();
    for (let i = 0; i < markers.length; i += 1) {
      const m = markers[i];
      const pulse = 1 + Math.sin(performance.now() / 220) * 0.18;
      ctx.strokeStyle = COLORS.mission;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(242,201,76,0.16)';
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.mission;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, m.x, m.y - m.r - 8);
    }

    // People.
    const peds = state.peds;
    for (let i = 0; i < peds.length; i += 1) drawPed(peds[i]);
    for (let i = 0; i < state.cops.length; i += 1) drawCop(state.cops[i]);
    for (let i = 0; i < state.mission.rivals.length; i += 1) drawRival(state.mission.rivals[i]);

    // Vehicles.
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) drawCar(cars[i]);

    // Player on foot (in a car, the car is the body).
    const p = state.player;
    if (!p.driving) drawPlayerOnFoot(p);

    // Bullets.
    ctx.fillStyle = COLORS.bullet;
    const bullets = state.combat.bullets;
    for (let i = 0; i < bullets.length; i += 1) {
      const b = bullets[i];
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    // Particles.
    const particles = state.combat.particles;
    for (let i = 0; i < particles.length; i += 1) {
      const pt = particles[i];
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // Warm sun tint over the visible world area (tunable in config.js as SUN_TINT).
    const cam = state.camera.cam;
    const vw = view.viewW / view.scale;
    const vh = view.viewH / view.scale;
    ctx.fillStyle = SUN_TINT;
    ctx.fillRect(cam.x - vw / 2 - 60, cam.y - vh / 2 - 60, vw + 120, vh + 120);
  }

  function drawPed(ped) {
    if (ped.state === 'dead') {
      ctx.globalAlpha = Math.max(0, 1 - ped.deadTimer / 12);
      ctx.fillStyle = COLORS.shadow;
      ctx.beginPath(); ctx.ellipse(ped.x + 2, ped.y + 3, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = ped.shirt;
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    drawShadow(ped.x, ped.y, 10, 6);
    const bob = Math.sin(ped.walkPhase || 0) * 1.6;
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 5, ped.y + Math.sin(ped.angle) * 5 + bob, 5, 0, Math.PI * 2); ctx.fill();
  }

  function drawCop(cop) {
    drawShadow(cop.x, cop.y, 10, 6);
    ctx.fillStyle = COLORS.cop;
    ctx.beginPath(); ctx.arc(cop.x, cop.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c29a';
    ctx.beginPath(); ctx.arc(cop.x + Math.cos(cop.angle) * 6, cop.y + Math.sin(cop.angle) * 6, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('P', cop.x, cop.y - 14);
  }

  function drawRival(r) {
    drawShadow(r.x, r.y, 10, 6);
    ctx.fillStyle = '#8a2f2f';
    ctx.beginPath(); ctx.arc(r.x, r.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c29a';
    ctx.beginPath(); ctx.arc(r.x + Math.cos(r.angle) * 6, r.y + Math.sin(r.angle) * 6, 5, 0, Math.PI * 2); ctx.fill();
  }

  function drawCar(car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    const tw = car.type.width;
    const tl = car.type.length;
    ctx.fillStyle = COLORS.shadow;
    ctx.fillRect(-tl / 2 + 4, -tw / 2 + 4, tl, tw);
    let body = car.color;
    if (car.burning > 0) body = car.burning > 1 ? '#3a3a3a' : '#7a4a2a';
    ctx.fillStyle = body;
    roundRect(-tl / 2, -tw / 2, tl, tw, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(-tl * 0.16, -tw * 0.36, tl * 0.42, tw * 0.72, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,225,255,0.5)';
    ctx.fillRect(tl * 0.18, -tw * 0.3, 5, tw * 0.6);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(tl / 2 - 4, -tw / 2 + 3, 4, 5);
    ctx.fillRect(tl / 2 - 4, tw / 2 - 8, 4, 5);
    if (car.ai === 'police') {
      const flash = Math.sin(performance.now() / 90) > 0;
      ctx.fillStyle = flash ? '#ff4a4a' : '#3a6bff';
      ctx.fillRect(-6, -tw / 2 + 2, 10, tw - 4);
      ctx.fillStyle = flash ? '#3a6bff' : '#ff4a4a';
      ctx.fillRect(-6, -tw / 2 + 2, 5, tw - 4);
    }
    ctx.restore();
    if (car.burning > 0) {
      ctx.fillStyle = Math.random() < 0.5 ? '#ff9a3a' : '#ffe066';
      ctx.beginPath(); ctx.arc(car.x + (Math.random() - 0.5) * 20, car.y - 14 - Math.random() * 10, 5 + Math.random() * 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPlayerOnFoot(p) {
    drawShadow(p.x, p.y, 11, 7);
    const bob = Math.sin(p.walkPhase) * 1.8;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = COLORS.playerSkin;
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 6, p.y + Math.sin(p.angle) * 6 + bob, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#22262e';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8 + bob);
    ctx.lineTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20 + bob);
    ctx.stroke();
    if (p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(p.x, p.y + bob, PLAYER.radius + 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Paint one whole frame: the world through the camera, then the HUD. */
  function draw(state, view) {
    clear();
    drawWorld(state, view);
    hud.draw(state, view);
  }

  return { draw, hud, ctx };
}
