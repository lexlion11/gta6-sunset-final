// The HUD and the menus: health bar, money, wanted stars, minimap (top-right), objective
// text, weapon indicator, crosshair, message toasts, and the full-screen panels (start,
// pause, mission offer, wasted/busted). All screen space, drawn over the world.
import { COLORS, FONT, MINIMAP, PLAYER, WORLD } from './config.js';

export function createHud(canvas, ctx) {
  function screenTransform() {
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { W: canvas.width / ratio, H: canvas.height / ratio };
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

  function drawStar(cx, cy, r, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i += 1) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const x = cx + Math.cos(a) * rad;
      const y = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  function draw(state, view) {
    const { W, H } = screenTransform();
    const p = state.player;

    // Health bar (bottom-left).
    const hbX = 20, hbY = H - 44, hbW = 220, hbH = 16;
    ctx.fillStyle = COLORS.hudBg;
    roundRect(hbX - 8, hbY - 26, hbW + 70, hbH + 52, 8); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    roundRect(hbX, hbY, hbW, hbH, 4); ctx.fill();
    const hp = Math.max(0, p.health / PLAYER.maxHealth);
    ctx.fillStyle = hp > 0.5 ? '#4cd964' : hp > 0.25 ? '#f2c94c' : '#ff5a4e';
    roundRect(hbX, hbY, Math.max(2, hbW * hp), hbH, 4); ctx.fill();
    ctx.fillStyle = COLORS.hudText;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('HEALTH', hbX, hbY - 8);
    ctx.fillText(`${Math.ceil(p.health)}`, hbX + hbW + 8, hbY + 13);

    // Money + weapon (top-left).
    ctx.fillStyle = COLORS.hudBg;
    roundRect(12, 12, 220, 64, 8); ctx.fill();
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 26px ' + FONT;
    ctx.fillText(`$${p.money}`, 26, 44);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '13px ' + FONT;
    ctx.fillText(p.driving ? `Driving: ${p.driving.type.name}` : `Weapon: ${p.weapon}`, 26, 64);
    // Small speedometer readout under the money panel while driving.
    if (p.driving) {
      const mph = Math.round(Math.abs(p.driving.speed) * 0.22);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '12px ' + FONT;
      ctx.fillText(`${mph} mph`, 26, 80);
    }

    // Wanted stars (top-centre).
    const stars = state.wanted.stars;
    if (stars > 0) {
      const sx = W / 2 - (5 * 26) / 2;
      for (let i = 0; i < 5; i += 1) {
        const filled = i < stars;
        ctx.fillStyle = filled ? (state.wanted.flash > 0 && Math.sin(performance.now() / 80) > 0 ? '#fff' : COLORS.wanted) : 'rgba(255,255,255,0.18)';
        drawStar(sx + i * 26 + 10, 30, 9, 5);
      }
    }

    // Objective text (left of the minimap).
    if (state.mission.objective && state.mission.state === 'active') {
      const ow = Math.min(340, W - MINIMAP.size - 80);
      ctx.fillStyle = COLORS.hudBg;
      roundRect(W - MINIMAP.size - 40 - ow, 12, ow, 46, 8); ctx.fill();
      ctx.fillStyle = COLORS.hudAccent;
      ctx.font = 'bold 13px ' + FONT;
      const text = state.mission.objective;
      ctx.fillText(text.length > 46 ? text.slice(0, 44) + '…' : text, W - MINIMAP.size - 30 - ow, 30);
      ctx.fillStyle = COLORS.hudText;
      ctx.font = '11px ' + FONT;
      ctx.fillText('Mission in progress', W - MINIMAP.size - 30 - ow, 47);
    }

    drawMinimap(state, W, H);

    // Message toast.
    if (state.mission.messageTimer > 0) {
      ctx.globalAlpha = Math.min(1, state.mission.messageTimer);
      ctx.fillStyle = COLORS.hudBg;
      const mw = 360;
      roundRect((W - mw) / 2, H - 90, mw, 40, 8); ctx.fill();
      ctx.fillStyle = COLORS.hudText;
      ctx.font = 'bold 15px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(state.mission.message, W / 2, H - 64);
      ctx.globalAlpha = 1;
    }

    // Crosshair when on foot.
    if (!p.driving && state.screen === 'playing' && view) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(view.mx, view.my, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(view.mx - 14, view.my); ctx.lineTo(view.mx - 5, view.my);
      ctx.moveTo(view.mx + 5, view.my); ctx.lineTo(view.mx + 14, view.my);
      ctx.moveTo(view.mx, view.my - 14); ctx.lineTo(view.mx, view.my - 5);
      ctx.moveTo(view.mx, view.my + 5); ctx.lineTo(view.mx, view.my + 14);
      ctx.stroke();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function drawMinimap(state, W, H) {
    const size = MINIMAP.size;
    const x = W - size - MINIMAP.pad;
    const y = MINIMAP.pad;
    const scale = size / WORLD.size;
    ctx.fillStyle = COLORS.hudBg;
    roundRect(x - 6, y - 6, size + 12, size + 12, 8); ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(x, y, size, size);
    const world = state.world;
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(x + world.water.x * scale, y, world.water.w * scale, size);
    // Roads.
    ctx.strokeStyle = '#5a5a66';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < world.roadsX.length; i += 1) {
      const rx = x + world.roadsX[i] * scale;
      ctx.moveTo(rx, y); ctx.lineTo(rx, y + size);
    }
    for (let i = 0; i < world.roadsY.length; i += 1) {
      const ry = y + world.roadsY[i] * scale;
      ctx.moveTo(x, ry); ctx.lineTo(x + size, ry);
    }
    ctx.stroke();
    // Buildings.
    ctx.fillStyle = 'rgba(80,60,45,0.55)';
    for (let i = 0; i < world.buildings.length; i += 1) {
      const b = world.buildings[i];
      ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
    }
    // Mission markers.
    const markers = state.mission.markers();
    for (let i = 0; i < markers.length; i += 1) {
      const m = markers[i];
      ctx.fillStyle = COLORS.mission;
      ctx.beginPath();
      ctx.arc(x + m.x * scale, y + m.y * scale, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#ff5a4e';
    for (let i = 0; i < state.cars.length; i += 1) {
      const c = state.cars[i];
      if (c.ai === 'police') {
        ctx.beginPath();
        ctx.arc(x + c.x * scale, y + c.y * scale, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < state.cops.length; i += 1) {
      const cop = state.cops[i];
      ctx.beginPath();
      ctx.arc(x + cop.x * scale, y + cop.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player blip.
    const p = state.player;
    ctx.fillStyle = '#3aa0e0';
    ctx.beginPath();
    ctx.arc(x + p.x * scale, y + p.y * scale, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    roundRect(x, y, size, size, 4);
    ctx.stroke();
  }

  function drawPanel(title, lines, prompt) {
    const { W, H } = screenTransform();
    ctx.fillStyle = 'rgba(10,12,18,0.55)';
    ctx.fillRect(0, 0, W, H);
    const pw = 560;
    const ph = 150 + lines.length * 30;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    ctx.fillStyle = COLORS.panel;
    roundRect(px, py, pw, ph, 12); ctx.fill();
    ctx.strokeStyle = COLORS.hudAccent;
    ctx.lineWidth = 2;
    roundRect(px, py, pw, ph, 12); ctx.stroke();
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(title, W / 2, py + 56);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '17px ' + FONT;
    for (let i = 0; i < lines.length; i += 1) {
      ctx.fillText(lines[i], W / 2, py + 100 + i * 30);
    }
    if (prompt) {
      const blink = Math.sin(performance.now() / 350) > -0.3;
      ctx.fillStyle = blink ? COLORS.hudAccent : 'rgba(242,201,76,0.35)';
      ctx.font = 'bold 18px ' + FONT;
      ctx.fillText(prompt, W / 2, py + ph - 28);
    }
  }

  /** The start screen: title over a live city backdrop. */
  function drawStart(state) {
    const { W, H } = screenTransform();
    // Backdrop is the live world; add a gradient scrim and the title.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(20,16,10,0.35)');
    g.addColorStop(0.55, 'rgba(20,16,10,0.15)');
    g.addColorStop(1, 'rgba(20,16,10,0.75)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 72px ' + FONT;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 18;
    ctx.fillText('SUNSET CITY', W / 2, H * 0.32);
    ctx.shadowBlur = 0;
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '20px ' + FONT;
    ctx.fillText('A tale of crime, cars and the coast', W / 2, H * 0.32 + 40);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = 'rgba(240,234,214,0.85)';
    ctx.fillText('WASD move · Mouse aim · Click shoot · E enter/exit car · ESC pause', W / 2, H * 0.32 + 84);
    const blink = Math.sin(performance.now() / 350) > -0.3;
    ctx.fillStyle = blink ? COLORS.hudAccent : 'rgba(242,201,76,0.35)';
    ctx.font = 'bold 24px ' + FONT;
    ctx.fillText('Press ENTER to start', W / 2, H * 0.32 + 140);
    if (state.hasSave) {
      ctx.fillStyle = 'rgba(240,234,214,0.6)';
      ctx.font = '14px ' + FONT;
      ctx.fillText('A saved game exists — progress carries over', W / 2, H * 0.32 + 172);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Phone-style mission offer panel. */
  function drawMissionOffer(offer) {
    const { W, H } = screenTransform();
    ctx.fillStyle = 'rgba(10,12,18,0.6)';
    ctx.fillRect(0, 0, W, H);
    const pw = 480;
    const ph = 260;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    ctx.fillStyle = '#141822';
    roundRect(px, py, pw, ph, 16); ctx.fill();
    ctx.strokeStyle = COLORS.hudAccent;
    ctx.lineWidth = 2;
    roundRect(px, py, pw, ph, 16); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8b93a3';
    ctx.font = '13px ' + FONT;
    ctx.fillText(`📞 ${offer.contact} calling`, W / 2, py + 36);
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 28px ' + FONT;
    ctx.fillText(offer.name, W / 2, py + 76);
    ctx.fillStyle = COLORS.hudText;
    ctx.font = '16px ' + FONT;
    // Wrap the intro text.
    const words = offer.intro.split(' ');
    let line = '';
    let lineY = py + 116;
    for (let i = 0; i < words.length; i += 1) {
      const test = line + words[i] + ' ';
      if (ctx.measureText(test).width > pw - 60) {
        ctx.fillText(line, W / 2, lineY);
        line = words[i] + ' ';
        lineY += 26;
      } else line = test;
    }
    if (line) ctx.fillText(line, W / 2, lineY);
    ctx.fillStyle = COLORS.hudAccent;
    ctx.font = 'bold 17px ' + FONT;
    ctx.fillText(`Reward: $${offer.reward}`, W / 2, py + ph - 62);
    const blink = Math.sin(performance.now() / 350) > -0.3;
    ctx.fillStyle = blink ? COLORS.hudText : 'rgba(240,234,214,0.35)';
    ctx.font = 'bold 16px ' + FONT;
    ctx.fillText('ENTER accept · ESC decline', W / 2, py + ph - 30);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, drawPanel, drawStart, drawMissionOffer, roundRect };
}
