// Story missions: five scores given by contacts around the city. A mission starts when the
// player steps into the yellow marker; a phone-style panel lays out the job, ENTER accepts.
// Each mission is a small state machine of stages with markers the HUD and minimap show.
import { MISSIONS } from './config.js';

export const MISSION_STATE_IDLE = 'idle';       // marker waiting
export const MISSION_STATE_OFFER = 'offer';     // phone panel up
export const MISSION_STATE_ACTIVE = 'active';
export const MISSION_STATE_DONE = 'done';

export function createMissionEngine(state) {
  const engine = {
    index: 0,            // next mission to offer (0-based)
    state: MISSION_STATE_IDLE,
    stage: 0,
    timer: 0,
    targets: [],         // [{x,y,r,label,kind}]
    objective: '',
    message: '',
    messageTimer: 0,
    rivals: [],
    car: null,
    packages: 0,

    notify(text) {
      this.message = text;
      this.messageTimer = 3.5;
    },

    /** Marker where the next mission is offered. */
    offerMarker() {
      if (this.index >= MISSIONS.length) return null;
      const spots = state.world.spots;
      const at = this.index === 0 || this.index === 1 || this.index === 4 ? spots.lockup : spots.downtown;
      return { x: at.x, y: at.y, r: 46, label: MISSIONS[this.index].name, kind: 'mission' };
    },

    markers() {
      if (this.state === MISSION_STATE_ACTIVE) return this.targets;
      const m = this.offerMarker();
      return m ? [m] : [];
    },

    start(dt) {
      // Called every frame; handles the offer trigger and stage logic.
      if (this.messageTimer > 0) this.messageTimer -= dt;
      if (this.state === MISSION_STATE_IDLE) {
        const m = this.offerMarker();
        if (m && Math.hypot(state.player.x - m.x, state.player.y - m.y) < m.r && !state.player.driving) {
          this.state = MISSION_STATE_OFFER;
        }
        return;
      }
      if (this.state === MISSION_STATE_ACTIVE) {
        this.run(dt);
      }
    },

    accept() {
      if (this.state !== MISSION_STATE_OFFER) return;
      this.state = MISSION_STATE_ACTIVE;
      this.stage = 0;
      this.timer = 0;
      this.setup();
    },

    decline() {
      if (this.state !== MISSION_STATE_OFFER) return;
      this.state = MISSION_STATE_IDLE;
    },

    setup() {
      const world = state.world;
      const random = world.random;
      this.targets = [];
      this.rivals = [];
      this.packages = 0;
      const m = MISSIONS[this.index];
      if (this.index === 0) {
        // First Score: a marked coupe downtown; deliver to the lockup.
        this.car = spawnMissionCar(state, world.spots.downtown.x + 160, world.spots.downtown.y - 140);
        this.targets = [
          { x: this.car.x, y: this.car.y, r: 40, label: 'Steal the coupe', kind: 'objective' },
        ];
      } else if (this.index === 1) {
        // Package Run: three pickups, each delivered to the next spot.
        this.packages = 0;
        this.nextPackage();
      } else if (this.index === 2) {
        // Shake Down: four rivals at the docks.
        for (let i = 0; i < 4; i += 1) {
          const a = (i / 4) * Math.PI * 2;
          this.rivals.push({
            x: world.spots.docks.x + Math.cos(a) * 130,
            y: world.spots.docks.y + Math.sin(a) * 130,
            health: 60, fireTimer: Math.random() * 1.5, angle: 0,
          });
        }
        this.targets = [{ x: world.spots.docks.x, y: world.spots.docks.y, r: 60, label: 'Take out the rival crew', kind: 'objective' }];
      } else if (this.index === 3) {
        // Getaway: survive 3 stars for 60s.
        state.wanted.stars = 3;
        state.wanted.heat = 3;
        state.wanted.decayTimer = 0;
        this.timer = 60;
        this.targets = [];
      } else if (this.index === 4) {
        // Big Score: guarded shipment car downtown, lose heat, deliver to docks.
        this.car = spawnMissionCar(state, world.spots.downtown.x - 180, world.spots.downtown.y + 160);
        for (let i = 0; i < 3; i += 1) {
          const a = (i / 3) * Math.PI * 2;
          this.rivals.push({
            x: this.car.x + Math.cos(a) * 70,
            y: this.car.y + Math.sin(a) * 70,
            health: 70, fireTimer: Math.random(), angle: 0,
          });
        }
        this.targets = [{ x: this.car.x, y: this.car.y, r: 40, label: 'Steal the shipment', kind: 'objective' }];
      }
      this.objective = m.intro;
    },

    nextPackage() {
      const world = state.world;
      const random = world.random;
      const spots = [world.spots.hospital, world.spots.downtown, world.spots.docks, world.spots.playerStart];
      const target = spots[this.packages % spots.length];
      this.targets = [{ x: target.x + (random() - 0.5) * 200, y: target.y + (random() - 0.5) * 200, r: 44, label: `Package ${this.packages + 1}/3`, kind: 'objective' }];
    },

    run(dt) {
      const p = state.player;
      const m = MISSIONS[this.index];

      if (this.index === 0 || this.index === 4) {
        // Steal the car, then deliver it.
        if (this.stage === 0) {
          if (p.driving === this.car) {
            this.stage = 1;
            const dest = this.index === 0 ? state.world.spots.lockup : state.world.spots.docks;
            this.targets = [{ x: dest.x, y: dest.y, r: 55, label: 'Deliver the car', kind: 'objective' }];
            this.notify('Get the car to the drop-off!');
          } else if (!this.car || this.car.burning > 0) {
            this.fail('The car was destroyed.');
            return;
          }
        } else if (this.stage === 1) {
          if (p.driving === this.car && Math.hypot(p.x - this.targets[0].x, p.y - this.targets[0].y) < this.targets[0].r) {
            this.complete();
            return;
          }
          if (this.car.burning > 0 || (p.driving !== this.car && Math.hypot(p.x - this.car.x, p.y - this.car.y) > 700)) {
            this.fail('You lost the car.');
            return;
          }
        }
      }

      if (this.index === 1) {
        // Package run: pick up, deliver to the same marker (drive-through), 3 packages.
        const t = this.targets[0];
        if (t && Math.hypot(p.x - t.x, p.y - t.y) < t.r) {
          this.packages += 1;
          state.audio.chime();
          if (this.packages >= 3) {
            this.complete();
          } else {
            this.nextPackage();
            this.notify(`Package delivered. ${3 - this.packages} to go.`);
          }
        }
      }

      if (this.index === 2 || this.index === 4) {
        // Rivals: armed peds that shoot back; stage 4 also requires losing heat after grabbing the car.
        for (let i = this.rivals.length - 1; i >= 0; i -= 1) {
          const r = this.rivals[i];
          const dx = p.x - r.x;
          const dy = p.y - r.y;
          const d = Math.hypot(dx, dy);
          r.angle = Math.atan2(dy, dx);
          if (d > 60) {
            r.x += (dx / d) * 90 * dt;
            r.y += (dy / d) * 90 * dt;
          }
          r.fireTimer -= dt;
          if (r.fireTimer <= 0 && d < 400) {
            r.fireTimer = 0.8 + Math.random() * 0.6;
            const aim = r.angle + (Math.random() - 0.5) * 0.25;
            state.combat.spawnBullet(r.x + Math.cos(aim) * 14, r.y + Math.sin(aim) * 14, aim, 16, 'rival');
            state.combat.muzzle(r.x + Math.cos(aim) * 14, r.y + Math.sin(aim) * 14, aim);
            state.audio.gunshot(0.6);
          }
          // Rivals take damage from bullets handled in combat via the "ped" list? They are
          // separate; check bullet hits here.
          const bullets = state.combat.bullets;
          for (let b = bullets.length - 1; b >= 0; b -= 1) {
            const bl = bullets[b];
            if (bl.owner === 'rival') continue;
            if (Math.hypot(bl.x - r.x, bl.y - r.y) < 14) {
              r.health -= bl.damage;
              state.combat.blood(bl.x, bl.y, Math.atan2(bl.vy, bl.vx));
              bullets.splice(b, 1);
            }
          }
          if (r.health <= 0) {
            state.combat.blood(r.x, r.y, Math.random() * Math.PI * 2);
            this.rivals.splice(i, 1);
          }
        }
        if (this.index === 2 && this.rivals.length === 0) {
          this.complete();
          return;
        }
        if (this.index === 4 && this.stage === 0 && this.rivals.length === 0 && p.driving === this.car) {
          this.stage = 1;
          state.wanted.addHeat(2, 'copdown');
          const dest = state.world.spots.docks;
          this.targets = [{ x: dest.x, y: dest.y, r: 55, label: 'Lose the heat, deliver to the docks', kind: 'objective' }];
        }
        if (this.index === 4 && this.stage === 1) {
          if (p.driving === this.car && state.wanted.stars === 0 && Math.hypot(p.x - this.targets[0].x, p.y - this.targets[0].y) < this.targets[0].r) {
            this.complete();
            return;
          }
        }
      }

      if (this.index === 3) {
        // Getaway: survive 60s. Keep the heat up.
        this.timer -= dt;
        if (state.wanted.stars < 3) state.wanted.addHeat(0.4, 'copdown');
        if (this.timer <= 0) {
          this.complete();
          return;
        }
        this.objective = `Survive the heat: ${Math.ceil(this.timer)}s left`;
      }
    },

    complete() {
      const m = MISSIONS[this.index];
      state.player.money += m.reward;
      state.audio.chime();
      this.notify(`${m.name} complete! +$${m.reward}`);
      this.index += 1;
      this.state = MISSION_STATE_IDLE;
      this.stage = 0;
      this.targets = [];
      this.rivals = [];
      this.car = null;
      state.save();
    },

    fail(reason) {
      this.notify(`Mission failed. ${reason}`);
      this.state = MISSION_STATE_IDLE;
      this.stage = 0;
      this.targets = [];
      this.rivals = [];
      this.car = null;
    },

    /** The phone panel shown when a mission is on offer. */
    offerText() {
      if (this.state !== MISSION_STATE_OFFER) return null;
      const m = MISSIONS[this.index];
      return { name: m.name, contact: m.contact, intro: m.intro, reward: m.reward };
    },
  };
  return engine;
}

function spawnMissionCar(state, x, y) {
  // A unique-looking sports car for the mission target.
  const car = {
    id: 9999 + Math.floor(Math.random() * 9000),
    x, y, angle: 0,
    speed: 0, vx: 0, vy: 0,
    type: { name: 'Sport', width: 42, length: 80, accel: 560, maxSpeed: 480, turn: 3.4, color: '#2ecf8f', hp: 90 },
    hp: 90,
    ai: 'parked',
    dir: 1, axis: 'h', turnTimer: 0, stopTimer: 0, burning: 0,
    color: '#2ecf8f',
  };
  state.cars.push(car);
  return car;
}
