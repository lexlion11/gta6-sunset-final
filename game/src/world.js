// The city: a grid of roads with blocks of buildings between them, parks, a downtown core
// of taller towers and a beach with water on the east edge. Procedural from a seed, so the
// same seed always gives the same Sunset City. Also the collision data (building rects) and
// the road graph the traffic follows.
import { COLORS, WORLD } from './config.js';

const SIDEWALK = 14;

export function createWorld(random) {
  const { size, block, road } = WORLD;
  const halfRoad = road / 2;
  const cells = size / block; // 10 cells per axis

  // Road centre lines: x = 0, 400, ... 4000 (edges included, traffic loops within bounds).
  const roadsX = [];
  const roadsY = [];
  for (let i = 0; i <= cells; i += 1) {
    roadsX.push(i * block);
    roadsY.push(i * block);
  }

  const buildings = [];
  const parks = [];
  const trees = [];
  const downtown = new Set(['4,4', '5,4', '4,5', '5,5', '3,5', '6,4']);

  for (let cx = 0; cx < cells; cx += 1) {
    for (let cy = 0; cy < cells; cy += 1) {
      const x0 = cx * block + halfRoad + SIDEWALK;
      const y0 = cy * block + halfRoad + SIDEWALK;
      const w = block - road - SIDEWALK * 2;
      const h = block - road - SIDEWALK * 2;
      const key = `${cx},${cy}`;
      const isDowntown = downtown.has(key);
      const isBeach = cx === cells - 1;
      const roll = random();

      if (isBeach) {
        // Beach block: sand, no buildings, a few palms.
        parks.push({ x: x0 - SIDEWALK, y: y0 - SIDEWALK, w: w + SIDEWALK * 2, h: h + SIDEWALK * 2, kind: 'beach' });
        for (let t = 0; t < 4; t += 1) {
          trees.push({ x: x0 + random() * w, y: y0 + random() * h, palm: true });
        }
        continue;
      }
      if (roll < 0.12 && !isDowntown) {
        parks.push({ x: x0 - SIDEWALK, y: y0 - SIDEWALK, w: w + SIDEWALK * 2, h: h + SIDEWALK * 2, kind: 'park' });
        // A few more trees than the beach blocks: parks are where the city breathes.
        for (let t = 0; t < 7; t += 1) {
          trees.push({ x: x0 + random() * w, y: y0 + random() * h, palm: false });
        }
        continue;
      }
      // 1-3 buildings per block, split along the long axis, with a gap for variety.
      const splits = isDowntown ? 1 + Math.floor(random() * 2) : 1 + Math.floor(random() * 3);
      const gap = 10;
      if (random() < 0.5) {
        const bw = (w - gap * (splits - 1)) / splits;
        for (let s = 0; s < splits; s += 1) {
          const inset = random() * 0.12;
          const bh = h * (0.78 + random() * 0.2);
          buildings.push(makeBuilding(x0 + s * (bw + gap), y0 + h * inset * 0.5, bw, bh, isDowntown, random));
        }
      } else {
        const bh = (h - gap * (splits - 1)) / splits;
        for (let s = 0; s < splits; s += 1) {
          const inset = random() * 0.12;
          const bw = w * (0.78 + random() * 0.2);
          buildings.push(makeBuilding(x0 + w * inset * 0.5, y0 + s * (bh + gap), bw, bh, isDowntown, random));
        }
      }
    }
  }

  // Water covers the far east edge beyond the beach blocks (the border road as seawall).
  const water = { x: size - 40, y: 0, w: 40, h: size };

  // Landmark spots used by missions and spawns (road intersections in world coords).
  const spots = {
    playerStart: { x: block * 1.5, y: block * 1.5 },
    hospital: { x: block * 8.5, y: block * 1.5 },
    lockup: { x: block * 1.5, y: block * 8.5 },
    downtown: { x: block * 4.5, y: block * 4.5 },
    docks: { x: block * 8.5, y: block * 8.5 },
  };

  return { buildings, parks, trees, water, roadsX, roadsY, spots, random };
}

function makeBuilding(x, y, w, h, isDowntown, random) {
  const tall = isDowntown ? 1.6 + random() * 1.8 : 0.7 + random() * 0.9;
  const base = isDowntown ? COLORS.downtown : (random() < 0.5 ? COLORS.building : COLORS.buildingAlt);
  const hi = isDowntown ? COLORS.downtownHi : COLORS.buildingHi;
  return {
    x, y, w, h, tall, base, hi,
    roof: random() < 0.6,
    windows: Math.max(2, Math.round(w / 26)),
  };
}

/** True when the circle (cx,cy,r) hits a building or water. */
export function collidesWorld(world, cx, cy, r) {
  if (cx - r < 0 || cy - r < 0 || cx + r > WORLD.size || cy + r > WORLD.size) return true;
  if (cx + r > world.water.x) return true;
  const buildings = world.buildings;
  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    if (cx + r > b.x && cx - r < b.x + b.w && cy + r > b.y && cy - r < b.y + b.h) return true;
  }
  return false;
}

/** Nearest road centre line to a coordinate (axis: 'x' or 'y'). */
export function nearestRoad(world, pos, axis) {
  const lines = axis === 'x' ? world.roadsX : world.roadsY;
  let best = lines[0];
  let bestD = Math.abs(pos - lines[0]);
  for (let i = 1; i < lines.length; i += 1) {
    const d = Math.abs(pos - lines[i]);
    if (d < bestD) { bestD = d; best = lines[i]; }
  }
  return best;
}
