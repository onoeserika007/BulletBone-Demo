export type WeaponId =
  | 'laser'
  | 'gravity'
  | 'revolver'
  | 'auto-pistol'
  | 'smg'
  | 'shotgun'
  | 'hunting-rifle'
  | 'assault-rifle';

export type WeaponRarity = 'white' | 'blue' | 'orange';
export type WeaponAffixId = 'calibrated' | 'rapid' | 'twin-shot' | 'piercing';

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  fireMode: 'hitscan' | 'projectile' | 'gravity';
  damage: number;
  intervalMs: number;
  projectileSpeed?: number;
  pellets: number;
  spreadDeg: number;
  color: number;
  dropWeight: number;
  description: string;
}

export interface WeaponInstance {
  uid: string;
  definitionId: WeaponId;
  rarity: WeaponRarity;
  affixes: WeaponAffixId[];
}

export interface WeaponRuntime {
  instance: WeaponInstance;
  definition: WeaponDefinition;
  displayName: string;
  damage: number;
  intervalMs: number;
  projectileSpeed: number;
  pellets: number;
  spreadDeg: number;
  penetration: number;
  color: number;
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  laser: {
    id: 'laser', name: '连发激光枪', fireMode: 'hitscan', damage: 14, intervalMs: 145,
    pellets: 1, spreadDeg: 0, color: 0x7be4ff, dropWeight: 0,
    description: '无弹道时间的高速连发光束。',
  },
  gravity: {
    id: 'gravity', name: '重力场枪', fireMode: 'gravity', damage: 44, intervalMs: 900,
    pellets: 1, spreadDeg: 0, color: 0xa979ff, dropWeight: 0,
    description: '向鼠标落点发射重力弹，碰撞或抵达后坍缩。',
  },
  revolver: {
    id: 'revolver', name: '左轮手枪', fireMode: 'projectile', damage: 25, intervalMs: 360,
    projectileSpeed: 1100, pellets: 1, spreadDeg: 0, color: 0xf3d5a1, dropWeight: 20,
    description: '均衡、可靠、枪枪有分量。',
  },
  'auto-pistol': {
    id: 'auto-pistol', name: '自动手枪', fireMode: 'projectile', damage: 15, intervalMs: 115,
    projectileSpeed: 1050, pellets: 1, spreadDeg: 2, color: 0xffd577, dropWeight: 18,
    description: '快速倾泻火力的轻型自动枪。',
  },
  smg: {
    id: 'smg', name: '冲锋枪', fireMode: 'projectile', damage: 12, intervalMs: 72,
    projectileSpeed: 920, pellets: 1, spreadDeg: 7, color: 0xff9a5f, dropWeight: 17,
    description: '近距离弹雨，射速极高但散布明显。',
  },
  shotgun: {
    id: 'shotgun', name: '霰弹枪', fireMode: 'projectile', damage: 13, intervalMs: 720,
    projectileSpeed: 780, pellets: 6, spreadDeg: 24, color: 0xff6e52, dropWeight: 13,
    description: '一次发射六颗弹丸，贴脸爆发。',
  },
  'hunting-rifle': {
    id: 'hunting-rifle', name: '狩猎步枪', fireMode: 'projectile', damage: 50, intervalMs: 780,
    projectileSpeed: 1450, pellets: 1, spreadDeg: 0, color: 0xb8f1ff, dropWeight: 13,
    description: '远程精准重击，天然穿透一个目标。',
  },
  'assault-rifle': {
    id: 'assault-rifle', name: '突击步枪', fireMode: 'projectile', damage: 22, intervalMs: 135,
    projectileSpeed: 1150, pellets: 1, spreadDeg: 3, color: 0xb2ff9f, dropWeight: 19,
    description: '稳定的中距离自动火力。',
  },
};

export const RARITY_COLORS: Record<WeaponRarity, number> = {
  white: 0xe8e1d6,
  blue: 0x5caeff,
  orange: 0xff9d45,
};

export const RARITY_NAMES: Record<WeaponRarity, string> = {
  white: '白色', blue: '蓝色', orange: '橙色',
};

export const AFFIX_NAMES: Record<WeaponAffixId, string> = {
  calibrated: '校准', rapid: '急速', 'twin-shot': '双发', piercing: '穿透',
};

let instanceSequence = 1;

export const createWeaponInstance = (
  definitionId: WeaponId,
  rarity: WeaponRarity = 'white',
  affixes: WeaponAffixId[] = [],
): WeaponInstance => ({
  uid: `weapon-${instanceSequence++}`,
  definitionId,
  rarity,
  affixes,
});

export const buildWeaponRuntime = (
  instance: WeaponInstance,
  globalDamageBonus: number,
  globalFireRateBonus: number,
  dedicatedDamageBonus = 0,
): WeaponRuntime => {
  const definition = WEAPON_DEFINITIONS[instance.definitionId];
  const rarityDamage = instance.rarity === 'orange' ? 0.28 : instance.rarity === 'blue' ? 0.12 : 0;
  const calibrated = instance.affixes.includes('calibrated') ? 0.2 : 0;
  const rapid = instance.affixes.includes('rapid') ? 0.2 : 0;
  const twinShot = instance.affixes.includes('twin-shot');
  const naturalPiercing = instance.definitionId === 'hunting-rifle' ? 1 : 0;
  return {
    instance,
    definition,
    displayName: `${RARITY_NAMES[instance.rarity]} ${definition.name}`,
    damage: definition.damage * (1 + globalDamageBonus + dedicatedDamageBonus + rarityDamage + calibrated) * (twinShot ? 0.85 : 1),
    intervalMs: definition.intervalMs / (1 + globalFireRateBonus + rapid),
    projectileSpeed: definition.projectileSpeed ?? 0,
    pellets: definition.pellets + (twinShot ? 1 : 0),
    spreadDeg: definition.spreadDeg,
    penetration: naturalPiercing + (instance.affixes.includes('piercing') ? 1 : 0),
    color: definition.color,
  };
};
