export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

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
  playerLaser: 0x7be4ff,
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
