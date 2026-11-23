# Sunset City

A 2D top-down open-world crime game that runs in a desktop browser from static files —
HTML5 Canvas and plain ES modules, no libraries, no network requests. Built for the
make.fun open-world bounty.

You play **Riley**, a street-level hustler clawing your way up in **Sunset City**, a
sun-drenched coastal town: jack cars, run jobs for your contacts, weave through traffic,
and stay one step ahead of the cops' five-star wanted system.

## Play

```bash
node serve.ts          # serves game/ on http://localhost:8080
```

Then open http://localhost:8080 in a desktop browser (ES modules need a server).
Or open `game/index.html` directly on any static file server.

### Controls

| Action | Keys |
|---|---|
| Move | `W` `A` `S` `D` / arrow keys |
| Aim | Mouse |
| Shoot | Left click |
| Punch | `Space` |
| Run | `Shift` |
| Enter / exit vehicle | `E` |
| Pause | `Esc` / `P` |
| Start / continue | `Enter` |

### Features

- **Open world** — a procedurally laid-out 4000×4000 city: road grid, downtown towers,
  parks, beach and water, with a smooth follow camera that zooms out at speed.
- **Driving** — traffic follows the roads and stops at jams; steal any of five car types
  (sedan, coupe, sports, truck, van), each with its own speed and handling.
- **Pedestrians** — the streets are alive; they flee from gunfire and drop cash.
- **Wanted system** — crimes fill the five-star meter; police cars give chase at two
  stars, armed officers on foot join at three. Heat decays when you lay low.
- **Five story missions** — from a first car theft to a multi-part big score, given by
  contacts through phone-style mission panels, with markers on the minimap.
- **Combat** — pistol and punch, bullets, muzzle flashes, blood, explosions, screen shake.
- **HUD** — health bar, money, wanted stars, minimap, objective text, pause menu.
- **Save** — progress (money, mission progress) persists in localStorage.
- **Audio** — every sound is generated at runtime with the Web Audio API.

### Screenshot mode

`?shot=1` start screen · `?shot=2` driving · `?shot=3` police chase · `?shot=4` mission.

## Structure

```
game/
  index.html
  src/
    main.js         game loop, screen state machine, save/load
    config.js       every tuning number and colour
    world.js        procedural city: roads, buildings, parks, beach, collisions
    camera.js       smooth follow camera with speed zoom and shake
    input.js        keyboard + mouse
    player.js       Riley: on foot and driving, enter/exit vehicles, respawn
    vehicles.js     traffic AI, parked cars, car physics and collisions
    pedestrians.js  walking NPCs that flee from trouble
    police.js       wanted system, police cars and foot officers
    missions.js     five story missions as state machines
    hud.js          HUD, minimap, menus, mission offer panels
    combat.js       bullets, damage, particles, pickups
    audio.js        Web Audio generated sounds
    render.js       canvas rendering of the world
    shots.js        ?shot=N screenshot scenes
```

## Hand it in

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

## License

MIT
