import { BASE_STATS } from '../config/demoConfig';
import {
  buildWeaponRuntime,
  createWeaponInstance,
  type WeaponId,
  type WeaponInstance,
  type WeaponRuntime,
} from '../config/weaponDefinitions';
import type { ChoiceOption } from '../ui/Overlay';
import { runRng } from './RunRng';

export type { WeaponId, WeaponInstance, WeaponRuntime };
export type UpgradeId =
  | 'trait-rapid' | 'trait-gravity' | 'trait-guard' | 'trait-rage' | 'trait-survival'
  | 'chip-shell' | 'chip-counter' | 'chip-rage-core' | 'chip-rage-time'
  | 'affix-damage' | 'affix-fire-rate' | 'affix-speed' | 'affix-block-cooldown'
  | 'affix-gravity-radius' | 'affix-health' | 'affix-laser-power' | 'affix-gravity-power'
  | 'affix-counter-power' | 'affix-rage-time';

export interface CombatStats {
  maxHp: number;
  moveSpeed: number;
  laserDamage: number;
  laserIntervalMs: number;
  gravityDamage: number;
  gravityIntervalMs: number;
  gravityRadius: number;
  counterDamage: number;
  blockWindowMs: number;
  blockSuccessCooldownMs: number;
  blockFailCooldownMs: number;
  rageDurationMs: number;
}

interface ModifierTotals {
  damage: number;
  laserDamage: number;
  gravityDamage: number;
  fireRate: number;
  speed: number;
  maxHp: number;
  blockWindowMs: number;
  blockCooldown: number;
  gravityRadius: number;
  counterDamage: number;
  rageDurationMs: number;
}

export const TRAITS: ChoiceOption[] = [
  { id: 'trait-rapid', title: '快枪骨', description: '射速 +20%', tag: '速射分支' },
  { id: 'trait-gravity', title: '坍缩核心', description: '重力场半径 +25%', tag: '重力分支' },
  { id: 'trait-guard', title: '骨壳本能', description: '格挡窗口 +0.15 秒', tag: '格挡分支' },
  { id: 'trait-rage', title: '怒火延燃', description: '狂暴基础时间 +2 秒', tag: '狂暴分支' },
  { id: 'trait-survival', title: '硬骨头', description: '最大生命 +25%', tag: '生存分支' },
];

export const CHIPS: ChoiceOption[] = [
  { id: 'chip-shell', title: '骨壳强化', description: '格挡窗口扩大，失败冷却缩短', tag: '格挡流芯片' },
  { id: 'chip-counter', title: '反击增幅', description: '反射骨光伤害 +60%', tag: '格挡流芯片' },
  { id: 'chip-rage-core', title: '狂暴核心', description: '狂暴期间额外获得射速与伤害', tag: '狂暴流芯片' },
  { id: 'chip-rage-time', title: '延时狂暴', description: '狂暴基础时间 +2 秒', tag: '狂暴流芯片' },
];

export const AFFIXES: ChoiceOption[] = [
  { id: 'affix-damage', title: '高能线圈', description: '所有伤害 +20%', tag: '武器词条' },
  { id: 'affix-fire-rate', title: '急速扳机', description: '射速 +15%', tag: '武器词条' },
  { id: 'affix-speed', title: '轻骨关节', description: '移动速度 +10%', tag: '机动词条' },
  { id: 'affix-block-cooldown', title: '回声骨壳', description: '格挡冷却 -25%', tag: '格挡词条' },
  { id: 'affix-gravity-radius', title: '奇点扩容', description: '重力场半径 +20%', tag: '重力词条' },
  { id: 'affix-health', title: '骨髓增生', description: '最大生命 +20%', tag: '生存词条' },
  { id: 'affix-laser-power', title: '聚焦透镜', description: '激光伤害 +25%', tag: '激光词条' },
  { id: 'affix-gravity-power', title: '坍缩增压', description: '重力坍缩伤害 +30%', tag: '重力词条' },
  { id: 'affix-counter-power', title: '骨光回响', description: '格挡反击伤害 +35%', tag: '格挡词条' },
  { id: 'affix-rage-time', title: '怒火余烬', description: '狂暴基础时间 +1 秒', tag: '狂暴词条' },
];

export type StageKind = 'combat' | 'merchant' | 'rest' | 'boss';
export interface StageDefinition {
  id: string;
  kind: StageKind;
  title: string;
  subtitle: string;
  melee?: number;
  ranged?: number;
  theme: number;
}

export const RUN_FLOW: StageDefinition[] = [
  { id: 'combat-1', kind: 'combat', title: '外围入口', subtitle: '先让枪开口', melee: 6, ranged: 0, theme: 0x211a17 },
  { id: 'combat-2', kind: 'combat', title: '废料巷', subtitle: '别让它们围上来', melee: 5, ranged: 1, theme: 0x201813 },
  { id: 'merchant-1', kind: 'merchant', title: '废土商店', subtitle: '补充一枚免费芯片再出发', theme: 0x17211e },
  { id: 'combat-3', kind: 'combat', title: '激光走廊', subtitle: '红线出现时，迎着它格挡', melee: 4, ranged: 3, theme: 0x1d1719 },
  { id: 'rest-1', kind: 'rest', title: '骨火营地', subtitle: '在下一轮猛攻前重组骨架', theme: 0x152025 },
  { id: 'combat-4', kind: 'combat', title: '熔炉通道', subtitle: '夺取奇点武器，顶住增援', melee: 10, ranged: 4, theme: 0x251814 },
  { id: 'combat-5', kind: 'combat', title: '坍缩工场', subtitle: '用重力坍缩撕碎重兵群', melee: 11, ranged: 6, theme: 0x181524 },
  { id: 'merchant-2', kind: 'merchant', title: '前线黑市', subtitle: '最后一次整备机会', theme: 0x17211e },
  { id: 'combat-6', kind: 'combat', title: '核心防线', subtitle: '用成型 Build 撕开最后一道墙', melee: 5, ranged: 5, theme: 0x20141d },
  { id: 'rest-2', kind: 'rest', title: '寂静篝火', subtitle: '修复伤势，准备迎战钢铁海盗', theme: 0x151d24 },
  { id: 'boss', kind: 'boss', title: '钢铁海盗', subtitle: '接住最后一束光', theme: 0x241513 },
];

class RunState {
  public stageIndex = 0;
  public hp: number = BASE_STATS.maxHp;
  public marks = 0;
  public rageActive = false;
  public ragePending = false;
  public rageRemainingMs = 0;
  public activeWeaponSlot = 0;
  public equippedWeapons: [WeaponInstance, WeaponInstance | null] = [
    createWeaponInstance('laser', 'blue', ['rapid']),
    null,
  ];
  public readonly upgrades = new Set<UpgradeId>();
  public kills = 0;
  public blocks = 0;
  public rageCount = 0;
  public startedAt = 0;

  public reset(): void {
    this.stageIndex = 0;
    this.hp = BASE_STATS.maxHp;
    this.marks = 0;
    this.rageActive = false;
    this.ragePending = false;
    this.rageRemainingMs = 0;
    this.activeWeaponSlot = 0;
    this.equippedWeapons = [createWeaponInstance('laser', 'blue', ['rapid']), null];
    this.upgrades.clear();
    this.kills = 0;
    this.blocks = 0;
    this.rageCount = 0;
    this.startedAt = performance.now();
    runRng.reset(Date.now());
  }

  public get stage(): StageDefinition {
    return RUN_FLOW[this.stageIndex];
  }

  public get elapsedSeconds(): number {
    return Math.max(0, (performance.now() - this.startedAt) / 1000);
  }

  public get activeWeaponInstance(): WeaponInstance {
    return this.equippedWeapons[this.activeWeaponSlot] ?? this.equippedWeapons[0];
  }

  public get activeWeaponRuntime(): WeaponRuntime {
    const modifier = this.modifiers;
    const id = this.activeWeaponInstance.definitionId;
    const dedicated = id === 'laser' ? modifier.laserDamage : id === 'gravity' ? modifier.gravityDamage : 0;
    return buildWeaponRuntime(this.activeWeaponInstance, modifier.damage, modifier.fireRate, dedicated);
  }

  public get rageDamageMultiplier(): number {
    return 1 + BASE_STATS.rageDamageBonus + (this.hasUpgrade('chip-rage-core') ? 0.15 : 0);
  }

  public get rageFireRateMultiplier(): number {
    return 1 + BASE_STATS.rageFireRateBonus + (this.hasUpgrade('chip-rage-core') ? 0.15 : 0);
  }

  public get stats(): CombatStats {
    const modifier = this.modifiers;
    return {
      maxHp: Math.round(BASE_STATS.maxHp * (1 + modifier.maxHp)),
      moveSpeed: BASE_STATS.moveSpeed * (1 + modifier.speed),
      laserDamage: BASE_STATS.laserDamage * (1 + modifier.damage + modifier.laserDamage),
      laserIntervalMs: BASE_STATS.laserIntervalMs / (1 + modifier.fireRate),
      gravityDamage: BASE_STATS.gravityDamage * (1 + modifier.damage + modifier.gravityDamage),
      gravityIntervalMs: BASE_STATS.gravityIntervalMs,
      gravityRadius: BASE_STATS.gravityRadius * (1 + modifier.gravityRadius),
      counterDamage: BASE_STATS.counterDamage * (1 + modifier.damage + modifier.counterDamage),
      blockWindowMs: BASE_STATS.blockWindowMs + modifier.blockWindowMs,
      blockSuccessCooldownMs: BASE_STATS.blockSuccessCooldownMs * (1 - modifier.blockCooldown),
      blockFailCooldownMs: BASE_STATS.blockFailCooldownMs * (1 - modifier.blockCooldown),
      rageDurationMs: BASE_STATS.rageDurationMs + modifier.rageDurationMs,
    };
  }

  public applyUpgrade(id: string): void {
    if (!this.isUpgradeId(id) || this.upgrades.has(id)) return;
    const oldMaxHp = this.stats.maxHp;
    this.upgrades.add(id);
    this.hp = Math.min(this.stats.maxHp, this.hp + Math.max(0, this.stats.maxHp - oldMaxHp));
  }

  public healFull(): void {
    this.hp = this.stats.maxHp;
  }

  public hasUpgrade(id: UpgradeId): boolean {
    return this.upgrades.has(id);
  }

  public tryPickupWeapon(instance: WeaponInstance): number | null {
    const emptySlot = this.equippedWeapons.findIndex((weapon) => weapon === null);
    if (emptySlot < 0) return null;
    const slot = emptySlot === 1 ? 1 : 0;
    this.equippedWeapons[slot] = instance;
    this.activeWeaponSlot = slot;
    return slot;
  }

  public equipWeapon(instance: WeaponInstance, preferredSlot?: number): number {
    const emptySlot = this.equippedWeapons.findIndex((weapon) => weapon === null);
    const slot = preferredSlot ?? (emptySlot >= 0 ? emptySlot : this.activeWeaponSlot);
    const normalizedSlot = slot === 1 ? 1 : 0;
    this.equippedWeapons[normalizedSlot] = instance;
    this.activeWeaponSlot = normalizedSlot;
    return normalizedSlot;
  }

  public replaceActiveWeapon(instance: WeaponInstance): WeaponInstance {
    const replaced = this.activeWeaponInstance;
    this.equippedWeapons[this.activeWeaponSlot] = instance;
    return replaced;
  }

  public dropActiveWeapon(): WeaponInstance | null {
    const weaponCount = this.equippedWeapons.filter((weapon) => weapon !== null).length;
    if (weaponCount <= 1) return null;
    const dropped = this.equippedWeapons[this.activeWeaponSlot];
    if (!dropped) return null;
    this.equippedWeapons[this.activeWeaponSlot] = null;
    this.activeWeaponSlot = this.equippedWeapons[0] ? 0 : 1;
    return dropped;
  }

  public get hasEmptyWeaponSlot(): boolean {
    return this.equippedWeapons.some((weapon) => weapon === null);
  }

  public switchWeapon(slot: number): boolean {
    const normalizedSlot = slot === 1 ? 1 : 0;
    if (!this.equippedWeapons[normalizedSlot]) return false;
    this.activeWeaponSlot = normalizedSlot;
    return true;
  }

  public hasWeapon(id: WeaponId): boolean {
    return this.equippedWeapons.some((weapon) => weapon?.definitionId === id);
  }

  public gainMark(hasLivingTargets: boolean): boolean {
    if (this.rageActive) return false;
    this.marks = Math.min(5, this.marks + 1);
    if (this.marks < 5) return false;
    if (hasLivingTargets) this.startRage();
    else this.ragePending = true;
    return true;
  }

  public beginCombat(): boolean {
    if (!this.ragePending) return false;
    this.startRage();
    return true;
  }

  public startRage(): void {
    this.ragePending = false;
    this.rageActive = true;
    this.rageRemainingMs = this.stats.rageDurationMs;
    this.rageCount += 1;
  }

  public extendRage(): void {
    if (this.rageActive) this.rageRemainingMs += BASE_STATS.rageShardBonusMs;
  }

  public updateRage(deltaMs: number): boolean {
    if (!this.rageActive) return false;
    this.rageRemainingMs -= deltaMs;
    if (this.rageRemainingMs > 0) return false;
    this.rageActive = false;
    this.rageRemainingMs = 0;
    this.marks = 0;
    return true;
  }

  public advance(): void {
    this.stageIndex += 1;
  }

  public jumpToBoss(): void {
    this.stageIndex = RUN_FLOW.findIndex((stage) => stage.kind === 'boss');
  }

  public sampleTraits(): ChoiceOption[] {
    return runRng.sample(TRAITS, 3);
  }

  public sampleChips(): ChoiceOption[] {
    return runRng.sample(CHIPS.filter((item) => !this.upgrades.has(item.id as UpgradeId)), 3);
  }

  public sampleAffixes(): ChoiceOption[] {
    const available = AFFIXES.filter((item) => !this.upgrades.has(item.id as UpgradeId));
    return runRng.sample(available.length >= 3 ? available : AFFIXES, 3);
  }

  private get modifiers(): ModifierTotals {
    const value: ModifierTotals = {
      damage: 0,
      laserDamage: 0,
      gravityDamage: 0,
      fireRate: 0,
      speed: 0,
      maxHp: 0,
      blockWindowMs: 0,
      blockCooldown: 0,
      gravityRadius: 0,
      counterDamage: 0,
      rageDurationMs: 0,
    };
    for (const id of this.upgrades) {
      switch (id) {
        case 'trait-rapid': value.fireRate += 0.2; break;
        case 'trait-gravity': value.gravityRadius += 0.25; break;
        case 'trait-guard': value.blockWindowMs += 150; break;
        case 'trait-rage': value.rageDurationMs += 2000; break;
        case 'trait-survival': value.maxHp += 0.25; break;
        case 'chip-shell': value.blockWindowMs += 120; value.blockCooldown += 0.25; break;
        case 'chip-counter': value.counterDamage += 0.6; break;
        case 'chip-rage-core': break;
        case 'chip-rage-time': value.rageDurationMs += 2000; break;
        case 'affix-damage': value.damage += 0.2; break;
        case 'affix-fire-rate': value.fireRate += 0.15; break;
        case 'affix-speed': value.speed += 0.1; break;
        case 'affix-block-cooldown': value.blockCooldown += 0.25; break;
        case 'affix-gravity-radius': value.gravityRadius += 0.2; break;
        case 'affix-health': value.maxHp += 0.2; break;
        case 'affix-laser-power': value.laserDamage += 0.25; break;
        case 'affix-gravity-power': value.gravityDamage += 0.3; break;
        case 'affix-counter-power': value.counterDamage += 0.35; break;
        case 'affix-rage-time': value.rageDurationMs += 1000; break;
      }
    }
    return value;
  }

  private isUpgradeId(id: string): id is UpgradeId {
    return [...TRAITS, ...CHIPS, ...AFFIXES].some((option) => option.id === id);
  }
}

export const runState = new RunState();
