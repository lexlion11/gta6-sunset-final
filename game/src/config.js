// Every tuning number and colour in one place. The world is 4000x4000 px; the camera
// scales the view to the window. Sunset City: a sun-soaked coastal metropolis.

export const WORLD = { size: 4000, block: 400, road: 72 };

/** The simulation's fixed step, in seconds: the world always advances in 1/60 s
 *  ticks regardless of the display framerate, so movement is frame-rate independent. */
export const STEP = 1 / 60;

export const COLORS = {
  ground: '#c8b48a',
  grass: '#7fae6a',
  grassDark: '#6b9c58',
  sand: '#e6d5a8',
  water: '#2f8fb8',
  waterDeep: '#24749c',
  road: '#4a4a52',
  roadLine: '#d9c56e',
  sidewalk: '#a89e8c',
  building: '#d97b4a',
  buildingAlt: '#e89b6c',
  buildingHi: '#f2c29a',
  downtown: '#c9a0dc',
  downtownHi: '#e0c0ec',
  park: '#7fae6a',
  player: '#3aa0e0',
  playerSkin: '#f2c29a',
  ped: '#e0d0b0',
  cop: '#3858a0',
  copCar: '#3858a0',
  bullet: '#ffe066',
  muzzle: '#fff3c4',
  blood: '#c0392b',
  traffic: ['#d94f3d', '#3d7bd9', '#e8c84c', '#5cb85c', '#b06ad9', '#e88c3a'],
  hudBg: 'rgba(16,20,28,0.72)',
  hudText: '#f0ead6',
  hudAccent: '#f2c94c',
  wanted: '#ff5a4e',
  mission: '#f2c94c',
  panel: 'rgba(18,22,30,0.88)',
  shadow: 'rgba(0,0,0,0.28)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const PLAYER = {
  radius: 11,
  walkSpeed: 165,
  runSpeed: 260,
  maxHealth: 100,
  punchRange: 26,
  punchDamage: 18,
  fireRate: 0.28,
  bulletSpeed: 900,
  bulletDamage: 34,
  enterRange: 42,
};

export const VEHICLE_TYPES = [
  { name: 'Sedan', width: 46, length: 86, accel: 340, maxSpeed: 300, turn: 2.6, color: '#d94f3d', hp: 100 },
  { name: 'Coupe', width: 44, length: 82, accel: 460, maxSpeed: 400, turn: 3.1, color: '#3d7bd9', hp: 90 },
  { name: 'Sport', width: 42, length: 80, accel: 560, maxSpeed: 480, turn: 3.4, color: '#e8c84c', hp: 80 },
  { name: 'Truck', width: 56, length: 108, accel: 240, maxSpeed: 240, turn: 1.9, color: '#5cb85c', hp: 180 },
  { name: 'Van', width: 54, length: 100, accel: 280, maxSpeed: 260, turn: 2.1, color: '#b06ad9', hp: 140 },
];

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 22;
export const POLICE_CAR_MAX = 6;

export const WANTED = {
  decayTime: 14,       // seconds of no crime per star lost
  crimeCooldown: 4,    // seconds before the same crime type counts again
  shootPed: 1.5,
  killPed: 2,
  stealCar: 1,
  hitCar: 0.5,
  hitPed: 1,
  shootCop: 2,
  killCop: 2,
};

export const MISSIONS = [
  { id: 1, name: 'First Score', contact: 'Mara', reward: 500, intro: 'Steal the marked coupe and deliver it to the lockup.' },
  { id: 2, name: 'Package Run', contact: 'Mara', reward: 800, intro: 'Pick up the packages and deliver them across the city.' },
  { id: 3, name: 'Shake Down', contact: 'Dex', reward: 1200, intro: 'Confront the rival crew. Take them out.' },
  { id: 4, name: 'Getaway', contact: 'Dex', reward: 1500, intro: 'Survive a 3-star wanted level for 60 seconds.' },
  { id: 5, name: 'Big Score', contact: 'Mara', reward: 4000, intro: 'Steal the shipment, lose the heat, deliver the goods.' },
];

export const SAVE_KEY = 'sunset-city.save';

export const MINIMAP = { size: 190, pad: 16 };
