export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const PLAYER_SPAWN_X = GAME_WIDTH / 2;
export const PLAYER_SPAWN_Y = GAME_HEIGHT - 100;
export const ENEMY_SPAWN_MIN_PLAYER_DISTANCE = 240;
export const ENEMY_SPAWN_MIN_ENEMY_DISTANCE = 58;
export const WEAPON_REPLACE_HOLD_MS = 700;
export const RAGE_SHARD_DROP_CHANCE = 0.3;

export const COLORS = {
  void: 0x090b0d,
  floor: 0x19191a,
  floorAlt: 0x211b18,
  wall: 0x4b3329,
  wallEdge: 0xa45d38,
  bone: 0xf1dfbd,
  boneBright: 0xfff2cc,
  rust: 0xb64f32,
  enemyLaser: 0xff493d,
  healthRed: 0xe53935,
  playerLaser: 0x7be4ff,
  playerRage: 0x37f2ff,
  blockBlue: 0x43a9ff,
  blockBlueBright: 0xbce8ff,
  gravity: 0xa979ff,
  gold: 0xffbd59,
  muted: 0x8e8177,
} as const;

export const BASE_STATS = {
  maxHp: 100,
  moveSpeed: 220,
  laserDamage: 14,
  laserIntervalMs: 145,
  gravityDamage: 44,
  gravityIntervalMs: 900,
  gravityRadius: 145,
  gravityPullMs: 420,
  counterDamage: 55,
  blockWindowMs: 450,
  blockSuccessCooldownMs: 350,
  blockFailCooldownMs: 1000,
  rollDurationMs: 240,
  rollCooldownMs: 1600,
  rollSpeed: 580,
  rageDurationMs: 6000,
  rageShardBonusMs: 1000,
  rageDamageBonus: 0.3,
  rageFireRateBonus: 0.5,
} as const;

export const DEBUG_KEYS = {
  resetRoom: 'F2',
  forceRage: 'F3',
  jumpBoss: 'F4',
} as const;
