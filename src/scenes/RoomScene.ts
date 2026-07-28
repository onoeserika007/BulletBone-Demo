import Phaser from 'phaser';
import {
  BASE_STATS,
  COLORS,
  DEBUG_KEYS,
  ENEMY_SPAWN_MIN_ENEMY_DISTANCE,
  ENEMY_SPAWN_MIN_PLAYER_DISTANCE,
  GAME_HEIGHT,
  GAME_WIDTH,
  PLAYER_SPAWN_X,
  PLAYER_SPAWN_Y,
  RAGE_SHARD_DROP_CHANCE,
  WEAPON_REPLACE_HOLD_MS,
} from '../config/demoConfig';
import {
  AFFIX_NAMES,
  RARITY_COLORS,
  WEAPON_DEFINITIONS,
  createWeaponInstance,
  type WeaponAffixId,
  type WeaponDefinition,
  type WeaponInstance,
  type WeaponRarity,
  type WeaponRuntime,
} from '../config/weaponDefinitions';
import { Enemy, randomSpawnPoint } from '../combat/Enemy';
import type { IncomingAttack } from '../combat/IncomingAttack';
import { Player } from '../combat/Player';
import { playTone } from '../combat/Sfx';
import { ensureTextures } from '../combat/Textures';
import { CHIPS, RUN_FLOW, runState } from '../run/RunState';
import { runRng } from '../run/RunRng';
import { clearOverlay, showChoices } from '../ui/Overlay';

interface GravityProjectileData {
  damage: number;
  targetX: number;
  targetY: number;
  expiresAt: number;
  marker: Phaser.GameObjects.Graphics;
}

interface GravityField {
  x: number;
  y: number;
  radius: number;
  endAt: number;
  ring: Phaser.GameObjects.Arc;
}

interface BulletProjectile {
  sprite: Phaser.GameObjects.Image;
  velocityX: number;
  velocityY: number;
  damage: number;
  penetration: number;
  color: number;
  expiresAt: number;
  hitEnemies: Set<Enemy>;
}

interface WeaponPickup {
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  baseLabel: string;
  instance: WeaponInstance;
  collecting: boolean;
  availableAt: number;
}

export class RoomScene extends Phaser.Scene {
  private player?: Player;
  private readonly enemies: Enemy[] = [];
  private readonly gravityProjectileData = new Map<Phaser.Physics.Arcade.Sprite, GravityProjectileData>();
  private readonly gravityFields: GravityField[] = [];
  private readonly bulletProjectiles: BulletProjectile[] = [];
  private readonly shards: Phaser.Physics.Arcade.Sprite[] = [];
  private readonly weaponPickups: WeaponPickup[] = [];
  private readonly wallRects: Phaser.Geom.Rectangle[] = [];
  private enemyGroup?: Phaser.Physics.Arcade.Group;
  private gravityProjectileGroup?: Phaser.Physics.Arcade.Group;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private hud?: Phaser.GameObjects.Text;
  private healthBar?: Phaser.GameObjects.Graphics;
  private blockHud?: Phaser.GameObjects.Text;
  private rollHud?: Phaser.GameObjects.Text;
  private bossBar?: Phaser.GameObjects.Graphics;
  private exitPortal?: Phaser.GameObjects.Arc;
  private exitLabel?: Phaser.GameObjects.Text;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private roomClearing = false;
  private portalInteracting = false;
  private combatActive = false;
  private replaceHoldUid?: string;
  private replaceHoldStartedAt = 0;
  private replaceHoldConsumed = false;
  private debugKeys?: Record<'reset' | 'rage' | 'boss' | 'pause', Phaser.Input.Keyboard.Key>;

  public constructor() {
    super('Room');
  }

  public create(): void {
    this.roomClearing = false;
    this.combatActive = false;
    this.player = undefined;
    this.hud = undefined;
    this.healthBar = undefined;
    this.blockHud = undefined;
    this.rollHud = undefined;
    this.bossBar = undefined;
    this.exitPortal = undefined;
    this.exitLabel = undefined;
    this.interactKey = undefined;
    this.portalInteracting = false;
    this.resetReplaceHold();
    this.enemies.length = 0;
    this.shards.length = 0;
    this.weaponPickups.length = 0;
    this.gravityFields.length = 0;
    this.bulletProjectiles.length = 0;
    this.wallRects.length = 0;
    this.gravityProjectileData.clear();
    ensureTextures(this);
    clearOverlay();
    this.cameras.main.resetFX();
    this.cameras.main.setBackgroundColor(runState.stage.theme);
    this.drawBackdrop();
    this.drawProgress();
    this.add.text(GAME_WIDTH / 2, 28, runState.stage.title, {
      color: '#f3d5a1', fontFamily: 'monospace', fontSize: '25px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(50);
    this.add.text(GAME_WIDTH / 2, 55, runState.stage.subtitle, {
      color: '#a99b90', fontFamily: 'monospace', fontSize: '12px',
    }).setOrigin(0.5).setDepth(50);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.setupDebugKeys();

    if (runState.stage.kind === 'merchant' || runState.stage.kind === 'rest') {
      void this.runNonCombatStage();
      return;
    }

    this.combatActive = true;
    this.walls = this.physics.add.staticGroup();
    this.createWalls();
    this.enemyGroup = this.physics.add.group();
    this.gravityProjectileGroup = this.physics.add.group();

    this.player = new Player(this, {
      fireWeapon: (runtime, x, y, angle, targetX, targetY, damageMultiplier) => {
        this.fireWeapon(runtime, x, y, angle, targetX, targetY, damageMultiplier);
      },
      fireCounter: (x, y, angle, damage) => this.fireCounter(x, y, angle, damage),
      dropWeapon: (instance, x, y) => this.spawnWeaponPickup(instance, x + 46, y, 700),
      showMessage: (message) => this.showMessage(message),
      hasLivingTargets: () => this.livingEnemyCount > 0,
      onDeath: () => this.onPlayerDeath(),
    });
    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.enemyGroup, this.walls);
    this.physics.add.collider(this.gravityProjectileGroup, this.walls, (projectileObject) => {
      this.detonateGravity(projectileObject as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.gravityProjectileGroup, this.enemyGroup, (projectileObject) => {
      this.detonateGravity(projectileObject as Phaser.Physics.Arcade.Sprite);
    });

    this.createHud();
    if (runState.stage.id === 'combat-4' && !runState.hasWeapon('gravity')) {
      this.spawnWeaponPickup(
        createWeaponInstance('gravity', 'orange', ['calibrated', 'rapid']),
        this.player.sprite.x + 78,
        this.player.sprite.y - 20,
      );
      this.showMessage('重力坍缩枪已掉落 · 靠近后按 E 拾取或长按 E 替换');
    }
    if (runState.stage.kind === 'boss') this.spawnBoss();
    else this.spawnWave(runState.stage.melee ?? 0, runState.stage.ranged ?? 0);

    if (runState.beginCombat()) playTone('rage');
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  public update(time: number, delta: number): void {
    if (!this.combatActive || !this.player) return;
    this.player.update(time, delta);
    for (const enemy of this.enemies) enemy.update(time);
    this.updateBulletProjectiles(time, delta);
    this.updateGravityProjectiles(time, delta);
    this.updateGravityFields(time);
    this.updateShards();
    const pickupNearby = this.updateWeaponPickups();
    this.updateExitPortal(pickupNearby);
    this.updateHud();
    this.handleDebugInput();
  }

  private async runNonCombatStage(): Promise<void> {
    if (runState.stage.kind === 'rest') {
      await showChoices('休息空间', `骨火稳定燃烧。当前生命 ${Math.ceil(runState.hp)}/${runState.stats.maxHp}`, [{
        id: 'rest', title: '重组骨架', description: '恢复全部生命，然后继续深入骨塔。', tag: '完全恢复',
      }]);
      if (!this.sys.isActive()) return;
      runState.healFull();
    } else {
      const options = runState.sampleChips();
      const id = await showChoices('废土商店', '骨匠打开零件箱：“这枚芯片算在路费里。”', options.length ? options : CHIPS.slice(0, 3));
      if (!this.sys.isActive()) return;
      runState.applyUpgrade(id);
    }
    this.advanceStage();
  }

  private spawnWave(melee: number, ranged: number): void {
    const total = melee + ranged;
    for (let index = 0; index < total; index += 1) {
      const point = this.findSafeEnemySpawnPoint(index, total);
      this.spawnEnemy(index < melee ? 'melee' : 'ranged', point);
    }
  }

  private findSafeEnemySpawnPoint(index: number, total: number): Phaser.Math.Vector2 {
    const candidates: Phaser.Math.Vector2[] = [];
    for (let attempt = 0; attempt < 72; attempt += 1) {
      const rotatedIndex = index + attempt * total * 0.381966;
      candidates.push(randomSpawnPoint(rotatedIndex, total));
    }
    for (let y = 126; y <= GAME_HEIGHT - 96; y += 62) {
      for (let x = 92; x <= GAME_WIDTH - 92; x += 68) candidates.push(new Phaser.Math.Vector2(x, y));
    }
    const safeCandidates = candidates.filter((candidate) => this.isSafeEnemySpawnPoint(candidate));
    if (safeCandidates.length === 0) {
      throw new Error(`No safe enemy spawn point for ${runState.stage.id}`);
    }
    safeCandidates.sort((left, right) => this.nearestEnemyDistance(right) - this.nearestEnemyDistance(left));
    return safeCandidates[0];
  }

  private isSafeEnemySpawnPoint(point: Phaser.Math.Vector2): boolean {
    const awayFromSpawn = Phaser.Math.Distance.Between(
      point.x,
      point.y,
      PLAYER_SPAWN_X,
      PLAYER_SPAWN_Y,
    ) >= ENEMY_SPAWN_MIN_PLAYER_DISTANCE;
    const awayFromPlayer = !this.player || Phaser.Math.Distance.Between(
      point.x,
      point.y,
      this.player.sprite.x,
      this.player.sprite.y,
    ) >= ENEMY_SPAWN_MIN_PLAYER_DISTANCE;
    const awayFromWalls = !this.wallRects.some((wall) => (
      point.x >= wall.left - 28
      && point.x <= wall.right + 28
      && point.y >= wall.top - 28
      && point.y <= wall.bottom + 28
    ));
    return awayFromSpawn
      && awayFromPlayer
      && awayFromWalls
      && this.nearestEnemyDistance(point) >= ENEMY_SPAWN_MIN_ENEMY_DISTANCE;
  }

  private nearestEnemyDistance(point: Phaser.Math.Vector2): number {
    return this.enemies.reduce((nearest, enemy) => (
      enemy.alive
        ? Math.min(nearest, Phaser.Math.Distance.Between(point.x, point.y, enemy.sprite.x, enemy.sprite.y))
        : nearest
    ), Number.POSITIVE_INFINITY);
  }

  private spawnBoss(): void {
    playTone('boss');
    this.cameras.main.shake(450, 0.012);
    this.spawnEnemy('boss', new Phaser.Math.Vector2(GAME_WIDTH / 2, 145));
    this.bossBar = this.add.graphics().setDepth(60);
  }

  private spawnEnemy(kind: 'melee' | 'ranged' | 'boss', point: Phaser.Math.Vector2): void {
    const enemy = new Enemy(this, kind, point.x, point.y, {
      getPlayerPosition: () => new Phaser.Math.Vector2(this.player?.sprite.x ?? 0, this.player?.sprite.y ?? 0),
      resolveAttack: (attack) => this.resolveIncomingAttack(attack),
      onDeath: (target) => this.onEnemyDeath(target),
    });
    this.enemies.push(enemy);
    this.enemyGroup?.add(enemy.sprite);
  }

  private resolveIncomingAttack(attack: IncomingAttack): void {
    this.player?.resolveIncoming(attack);
  }

  private fireWeapon(
    runtime: WeaponRuntime,
    x: number,
    y: number,
    angle: number,
    targetX: number,
    targetY: number,
    damageMultiplier: number,
  ): void {
    if (runtime.definition.fireMode === 'gravity') {
      this.fireGravity(x, y, targetX, targetY, runtime.damage * damageMultiplier);
      return;
    }
    const pelletCount = runtime.pellets;
    for (let pellet = 0; pellet < pelletCount; pellet += 1) {
      const centeredIndex = pellet - (pelletCount - 1) / 2;
      const spreadStep = pelletCount > 1 ? runtime.spreadDeg / Math.max(1, pelletCount - 1) : 0;
      const deterministicSpread = centeredIndex * spreadStep;
      const jitter = pelletCount === 1 ? Phaser.Math.FloatBetween(-runtime.spreadDeg, runtime.spreadDeg) : 0;
      const shotAngle = angle + Phaser.Math.DegToRad(deterministicSpread + jitter);
      if (runtime.definition.fireMode === 'hitscan') {
        this.fireHitscan(
          x,
          y,
          shotAngle,
          runtime.damage * damageMultiplier,
          runtime.penetration,
          runtime.color,
        );
      } else {
        this.spawnBulletProjectile(
          x,
          y,
          shotAngle,
          runtime.projectileSpeed,
          runtime.damage * damageMultiplier,
          runtime.penetration,
          runtime.color,
        );
      }
    }
    this.createMuzzleFlash(x, y, angle, runtime.color);
  }

  private spawnBulletProjectile(
    x: number,
    y: number,
    angle: number,
    speed: number,
    damage: number,
    penetration: number,
    color: number,
  ): void {
    const startX = x + Math.cos(angle) * 32;
    const startY = y + Math.sin(angle) * 32;
    const sprite = this.add.image(startX, startY, 'bullet')
      .setTint(color).setRotation(angle).setDepth(18);
    this.bulletProjectiles.push({
      sprite,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      damage,
      penetration,
      color,
      expiresAt: this.time.now + 2800,
      hitEnemies: new Set<Enemy>(),
    });
  }

  private updateBulletProjectiles(time: number, delta: number): void {
    const deltaSeconds = Math.min(delta, 50) / 1000;
    for (let index = this.bulletProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = this.bulletProjectiles[index];
      if (!projectile.sprite.active || time >= projectile.expiresAt) {
        this.destroyBulletProjectile(index);
        continue;
      }
      const startX = projectile.sprite.x;
      const startY = projectile.sprite.y;
      const stepX = projectile.velocityX * deltaSeconds;
      const stepY = projectile.velocityY * deltaSeconds;
      const distance = Math.hypot(stepX, stepY);
      if (distance <= 0) continue;
      const directionX = stepX / distance;
      const directionY = stepY / distance;
      const wallDistance = this.rayWallDistance(startX, startY, directionX, directionY, distance);
      const hits: Array<{ enemy: Enemy; distance: number }> = [];

      for (const enemy of this.enemies) {
        if (!enemy.alive || projectile.hitEnemies.has(enemy)) continue;
        const offsetX = enemy.sprite.x - startX;
        const offsetY = enemy.sprite.y - startY;
        const projection = offsetX * directionX + offsetY * directionY;
        if (projection <= 0 || projection > wallDistance) continue;
        const perpendicular = Math.abs(offsetX * directionY - offsetY * directionX);
        const hitRadius = enemy.kind === 'boss' ? 49 : 25;
        if (perpendicular <= hitRadius) hits.push({ enemy, distance: projection });
      }
      hits.sort((left, right) => left.distance - right.distance);

      let destroyed = false;
      for (const hit of hits) {
        projectile.hitEnemies.add(hit.enemy);
        hit.enemy.takeDamage(projectile.damage);
        const hitX = startX + directionX * hit.distance;
        const hitY = startY + directionY * hit.distance;
        this.createImpact(hitX, hitY, projectile.color);
        if (projectile.penetration <= 0) {
          projectile.sprite.setPosition(hitX, hitY);
          this.destroyBulletProjectile(index);
          destroyed = true;
          break;
        }
        projectile.penetration -= 1;
      }
      if (destroyed) continue;

      if (wallDistance < distance - 0.01) {
        projectile.sprite.setPosition(
          startX + directionX * wallDistance,
          startY + directionY * wallDistance,
        );
        this.createImpact(projectile.sprite.x, projectile.sprite.y, projectile.color, 4);
        this.destroyBulletProjectile(index);
        continue;
      }
      projectile.sprite.setPosition(startX + stepX, startY + stepY);
    }
  }

  private destroyBulletProjectile(index: number): void {
    const projectile = this.bulletProjectiles[index];
    if (!projectile) return;
    projectile.sprite.destroy();
    this.bulletProjectiles.splice(index, 1);
  }

  private fireHitscan(
    x: number,
    y: number,
    angle: number,
    damage: number,
    penetration: number,
    color: number,
  ): void {
    const startX = x + Math.cos(angle) * 30;
    const startY = y + Math.sin(angle) * 30;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const wallDistance = this.rayWallDistance(startX, startY, directionX, directionY, 2200);
    const candidates: Array<{ enemy: Enemy; distance: number }> = [];

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const offsetX = enemy.sprite.x - startX;
      const offsetY = enemy.sprite.y - startY;
      const projection = offsetX * directionX + offsetY * directionY;
      if (projection <= 0 || projection >= wallDistance) continue;
      const perpendicular = Math.abs(offsetX * directionY - offsetY * directionX);
      const hitRadius = enemy.kind === 'boss' ? 46 : 22;
      if (perpendicular <= hitRadius) candidates.push({ enemy, distance: projection });
    }
    candidates.sort((left, right) => left.distance - right.distance);
    const hits = candidates.slice(0, 1 + penetration);
    const endDistance = hits.length > penetration ? hits[hits.length - 1].distance : wallDistance;
    const endX = startX + directionX * endDistance;
    const endY = startY + directionY * endDistance;
    const beam = this.add.graphics().setDepth(17);
    beam.lineStyle(runState.rageActive ? 8 : 5, 0xffffff, 0.18).lineBetween(startX, startY, endX, endY);
    beam.lineStyle(runState.rageActive ? 4 : 3, color, 0.95).lineBetween(startX, startY, endX, endY);
    this.tweens.add({ targets: beam, alpha: 0, duration: 75, onComplete: () => beam.destroy() });

    hits.forEach((hit, index) => {
      hit.enemy.takeDamage(damage * Math.max(0.55, 1 - index * 0.2));
      this.createImpact(
        startX + directionX * hit.distance,
        startY + directionY * hit.distance,
        color,
      );
    });
  }

  private fireGravity(x: number, y: number, targetX: number, targetY: number, damage: number): void {
    if (!runState.hasWeapon('gravity') || !this.gravityProjectileGroup) return;
    const landingX = Phaser.Math.Clamp(targetX, 62, GAME_WIDTH - 62);
    const landingY = Phaser.Math.Clamp(targetY, 100, GAME_HEIGHT - 62);
    const angle = Phaser.Math.Angle.Between(x, y, landingX, landingY);
    const startX = x + Math.cos(angle) * 34;
    const startY = y + Math.sin(angle) * 34;
    const projectile = this.physics.add.sprite(startX, startY, 'gravity-orb').setDepth(22);
    projectile.setCircle(12, 3, 3).setRotation(angle);
    this.gravityProjectileGroup.add(projectile);
    this.physics.velocityFromRotation(angle, 430, projectile.body.velocity);

    const marker = this.add.graphics().setPosition(landingX, landingY).setDepth(7);
    marker.lineStyle(2, COLORS.gravity, 0.7).strokeCircle(0, 0, 13);
    marker.lineBetween(-21, 0, -8, 0).lineBetween(8, 0, 21, 0);
    marker.lineBetween(0, -21, 0, -8).lineBetween(0, 8, 0, 21);
    this.tweens.add({ targets: marker, alpha: 0.28, yoyo: true, repeat: -1, duration: 260 });
    this.tweens.add({ targets: projectile, angle: projectile.angle + 360, duration: 380, repeat: -1 });
    const travelMs = Phaser.Math.Distance.Between(startX, startY, landingX, landingY) / 430 * 1000;
    this.gravityProjectileData.set(projectile, {
      damage,
      targetX: landingX,
      targetY: landingY,
      expiresAt: this.time.now + travelMs + 500,
      marker,
    });
    this.createMuzzleFlash(x, y, angle, COLORS.gravity);
  }

  private fireCounter(x: number, y: number, angle: number, damage: number): void {
    const x2 = x + Math.cos(angle) * 1100;
    const y2 = y + Math.sin(angle) * 1100;
    const beam = this.add.graphics().setDepth(25);
    beam.lineStyle(14, COLORS.blockBlue, 0.35).lineBetween(x, y, x2, y2);
    beam.lineStyle(7, COLORS.blockBlueBright, 0.95).lineBetween(x, y, x2, y2);
    this.tweens.add({ targets: beam, alpha: 0, duration: 150, onComplete: () => beam.destroy() });
    for (const enemy of this.enemies) {
      if (enemy.alive && this.distanceToSegment(enemy.sprite.x, enemy.sprite.y, x, y, x2, y2) < 38) {
        enemy.takeDamage(damage);
      }
    }
  }

  private detonateGravity(projectile: Phaser.Physics.Arcade.Sprite): void {
    const data = this.gravityProjectileData.get(projectile);
    if (!data) return;
    const x = projectile.x;
    const y = projectile.y;
    this.gravityProjectileData.delete(projectile);
    this.tweens.killTweensOf(data.marker);
    this.tweens.killTweensOf(projectile);
    data.marker.destroy();
    this.gravityProjectileGroup?.remove(projectile);
    projectile.destroy();
    const radius = runState.stats.gravityRadius;
    const ring = this.add.circle(x, y, radius, COLORS.gravity, 0.08)
      .setStrokeStyle(4, COLORS.gravity, 0.8).setDepth(12);
    ring.setScale(0.15);
    this.tweens.add({ targets: ring, scale: 1, duration: BASE_STATS.gravityPullMs, ease: 'Quad.easeOut' });
    this.gravityFields.push({ x, y, radius, endAt: this.time.now + BASE_STATS.gravityPullMs, ring });
    ring.setData('damage', data.damage);
    playTone('gravity');
  }

  private updateGravityProjectiles(time: number, delta: number): void {
    const arrivalDistance = Math.max(14, 430 * delta / 1000 + 4);
    for (const [projectile, data] of this.gravityProjectileData) {
      if (!projectile.active) {
        this.tweens.killTweensOf(data.marker);
        data.marker.destroy();
        this.gravityProjectileData.delete(projectile);
        continue;
      }
      const reachedTarget = Phaser.Math.Distance.Between(
        projectile.x,
        projectile.y,
        data.targetX,
        data.targetY,
      ) <= arrivalDistance;
      if (reachedTarget) projectile.setPosition(data.targetX, data.targetY);
      if (reachedTarget || time >= data.expiresAt) this.detonateGravity(projectile);
    }
  }

  private updateGravityFields(time: number): void {
    for (let index = this.gravityFields.length - 1; index >= 0; index -= 1) {
      const field = this.gravityFields[index];
      if (time < field.endAt) {
        for (const enemy of this.enemies) {
          if (enemy.alive && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, field.x, field.y) <= field.radius) {
            enemy.pullToward(field.x, field.y, field.endAt);
          }
        }
        continue;
      }
      const damage = Number(field.ring.getData('damage'));
      for (const enemy of this.enemies) {
        if (enemy.alive && Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, field.x, field.y) <= field.radius) {
          enemy.takeDamage(damage);
        }
      }
      this.createImpact(field.x, field.y, COLORS.gravity, 16);
      this.cameras.main.shake(130, 0.01);
      field.ring.destroy();
      this.gravityFields.splice(index, 1);
    }
  }

  private onEnemyDeath(enemy: Enemy): void {
    runState.kills += 1;
    if (runState.rageActive) {
      if (enemy.kind !== 'boss' && runRng.next() < RAGE_SHARD_DROP_CHANCE) this.spawnShard(enemy.sprite.x, enemy.sprite.y);
    } else runState.gainMark(this.livingEnemyCount > 0);
    if (enemy.kind !== 'boss') this.tryDropWeapon(enemy);

    if (enemy.kind === 'boss') {
      this.combatActive = false;
      this.time.delayedCall(850, () => this.scene.start('Result'));
      return;
    }
    if (this.livingEnemyCount === 0 && !this.roomClearing) {
      this.roomClearing = true;
      this.time.delayedCall(450, () => this.spawnExitPortal());
    }
  }

  private tryDropWeapon(enemy: Enemy): void {
    const chance = enemy.kind === 'ranged' ? 0.22 : 0.14;
    if (runRng.next() > chance) return;
    const definitions = Object.values(WEAPON_DEFINITIONS).filter((definition) => definition.dropWeight > 0);
    const totalWeight = definitions.reduce((total, definition) => total + definition.dropWeight, 0);
    let roll = runRng.next() * totalWeight;
    let definition: WeaponDefinition = definitions[0];
    for (const candidate of definitions) {
      roll -= candidate.dropWeight;
      if (roll <= 0) {
        definition = candidate;
        break;
      }
    }

    const rarityRoll = runRng.next();
    const rarity: WeaponRarity = rarityRoll < 0.07 ? 'orange' : rarityRoll < 0.35 ? 'blue' : 'white';
    const affixCount = rarity === 'orange' ? 2 : rarity === 'blue' ? 1 : 0;
    const affixPool: WeaponAffixId[] = ['calibrated', 'rapid', 'twin-shot', 'piercing'];
    const affixes = runRng.sample(affixPool, affixCount);
    this.spawnWeaponPickup(
      createWeaponInstance(definition.id, rarity, affixes),
      enemy.sprite.x,
      enemy.sprite.y,
    );
  }

  private spawnWeaponPickup(instance: WeaponInstance, x: number, y: number, pickupDelayMs = 0): void {
    const definition = WEAPON_DEFINITIONS[instance.definitionId];
    const dropX = Phaser.Math.Clamp(x, 62, GAME_WIDTH - 62);
    const dropY = Phaser.Math.Clamp(y, 108, GAME_HEIGHT - 62);
    const sprite = this.add.image(dropX, dropY, 'weapon-pickup')
      .setTint(RARITY_COLORS[instance.rarity]).setDepth(18);
    const affixText = instance.affixes.map((id) => AFFIX_NAMES[id]).join(' · ');
    const baseLabel = `${definition.name}${affixText ? ` [${affixText}]` : ''}`;
    const label = this.add.text(dropX, dropY - 27, baseLabel, {
      color: `#${RARITY_COLORS[instance.rarity].toString(16).padStart(6, '0')}`,
      fontFamily: 'monospace', fontSize: '11px', fontStyle: 'bold',
      backgroundColor: '#090b0dcc', padding: { x: 4, y: 2 },
    }).setOrigin(0.5).setDepth(19);
    this.tweens.add({ targets: [sprite, label], y: '-=6', yoyo: true, repeat: -1, duration: 420 });
    this.weaponPickups.push({
      sprite,
      label,
      baseLabel,
      instance,
      collecting: false,
      availableAt: this.time.now + pickupDelayMs,
    });
  }

  private updateWeaponPickups(): boolean {
    if (!this.player) return false;
    if (!this.interactKey?.isDown && (this.replaceHoldUid || this.replaceHoldConsumed)) this.resetReplaceHold();
    let nearestIndex = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < this.weaponPickups.length; index += 1) {
      const pickup = this.weaponPickups[index];
      if (pickup.collecting || !pickup.sprite.active) continue;
      const distance = Phaser.Math.Distance.Between(
        pickup.sprite.x,
        pickup.sprite.y,
        this.player.sprite.x,
        this.player.sprite.y,
      );
      pickup.label.setText(pickup.baseLabel);
      if (distance <= 58 && distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    }
    if (nearestIndex < 0) return false;

    const pickup = this.weaponPickups[nearestIndex];
    if (this.time.now < pickup.availableAt) {
      pickup.label.setText(`${pickup.baseLabel}\n刚刚丢弃`);
      return true;
    }

    let slot: number | null = null;
    let replacedWeapon: WeaponInstance | null = null;
    if (runState.hasEmptyWeaponSlot) {
      pickup.label.setText(`${pickup.baseLabel}\n[E] 拾取`);
      if (!this.interactKey || !Phaser.Input.Keyboard.JustDown(this.interactKey)) return true;
      slot = runState.tryPickupWeapon(pickup.instance);
    } else {
      if (!this.interactKey?.isDown) {
        pickup.label.setText(`${pickup.baseLabel}\n长按 E 替换当前武器`);
        return true;
      }
      if (this.replaceHoldConsumed) {
        pickup.label.setText(`${pickup.baseLabel}\n松开 E 后可再次替换`);
        return true;
      }
      if (this.replaceHoldUid !== pickup.instance.uid) {
        this.replaceHoldUid = pickup.instance.uid;
        this.replaceHoldStartedAt = this.time.now;
      }
      const progress = Phaser.Math.Clamp(
        (this.time.now - this.replaceHoldStartedAt) / WEAPON_REPLACE_HOLD_MS,
        0,
        1,
      );
      const filled = Math.floor(progress * 8);
      pickup.label.setText(`${pickup.baseLabel}\n长按 E 替换 [${'■'.repeat(filled)}${'□'.repeat(8 - filled)}]`);
      if (progress < 1) return true;
      replacedWeapon = runState.replaceActiveWeapon(pickup.instance);
      slot = runState.activeWeaponSlot;
      this.replaceHoldConsumed = true;
    }

    if (slot === null) return true;
    pickup.collecting = true;
    const dropX = pickup.sprite.x;
    const dropY = pickup.sprite.y;
    const runtime = runState.activeWeaponRuntime;
    const action = replacedWeapon ? '替换为' : '拾取';
    const notice = this.add.text(GAME_WIDTH / 2, 92, `${action} ${runtime.displayName}  →  槽位 ${slot + 1}`, {
      color: '#fff1ce', fontFamily: 'monospace', fontSize: '18px', fontStyle: 'bold',
      backgroundColor: '#111316ee', padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setDepth(90);
    this.tweens.add({ targets: notice, y: 72, alpha: 0, duration: 1100, onComplete: () => notice.destroy() });
    this.tweens.killTweensOf(pickup.sprite);
    this.tweens.killTweensOf(pickup.label);
    pickup.sprite.destroy();
    pickup.label.destroy();
    this.weaponPickups.splice(nearestIndex, 1);
    if (replacedWeapon) this.spawnWeaponPickup(replacedWeapon, dropX, dropY, 700);
    playTone('pickup');
    return true;
  }

  private resetReplaceHold(): void {
    this.replaceHoldUid = undefined;
    this.replaceHoldStartedAt = 0;
    this.replaceHoldConsumed = false;
  }

  private spawnShard(x: number, y: number): void {
    const shard = this.physics.add.sprite(x, y, 'rage-shard').setDepth(15);
    shard.setCircle(10, 2, 5);
    this.shards.push(shard);
    this.tweens.add({ targets: shard, y: y - 8, yoyo: true, repeat: -1, duration: 280 });
  }

  private updateShards(): void {
    if (!this.player) return;
    for (let index = this.shards.length - 1; index >= 0; index -= 1) {
      const shard = this.shards[index];
      if (!shard.active || !runState.rageActive) {
        shard.destroy();
        this.shards.splice(index, 1);
        continue;
      }
      const distance = Phaser.Math.Distance.Between(shard.x, shard.y, this.player.sprite.x, this.player.sprite.y);
      shard.setVelocity(0);
      if (distance < 28) {
        runState.extendRage();
        playTone('pickup');
        shard.destroy();
        this.shards.splice(index, 1);
      }
    }
  }

  private spawnExitPortal(): void {
    if (this.exitPortal || !this.sys.isActive()) return;
    const x = GAME_WIDTH / 2;
    const y = 122;
    this.exitPortal = this.add.circle(x, y, 20, COLORS.boneBright, 0.22)
      .setStrokeStyle(4, COLORS.gold, 0.95).setDepth(24);
    this.exitLabel = this.add.text(x, y - 37, '出口光点', {
      color: '#ffe1a3', fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold',
      backgroundColor: '#090b0dcc', padding: { x: 6, y: 3 },
    }).setOrigin(0.5).setDepth(25);
    this.tweens.add({
      targets: this.exitPortal,
      scale: 1.65,
      alpha: 0.48,
      yoyo: true,
      repeat: -1,
      duration: 620,
    });
    this.showMessage('房间已清空 · 前往光点按 E 离开');
  }

  private updateExitPortal(pickupNearby: boolean): void {
    if (!this.player || !this.exitPortal || !this.exitLabel || this.portalInteracting) return;
    const distance = Phaser.Math.Distance.Between(
      this.player.sprite.x,
      this.player.sprite.y,
      this.exitPortal.x,
      this.exitPortal.y,
    );
    const nearby = distance <= 72;
    this.exitLabel.setText(nearby ? '按 E 离开关卡' : '出口光点');
    this.exitLabel.setColor(nearby ? '#ffffff' : '#ffe1a3');
    if (nearby && !pickupNearby && this.interactKey && Phaser.Input.Keyboard.JustDown(this.interactKey)) {
      this.portalInteracting = true;
      void this.completeCombatRoom();
    }
  }

  private showMessage(message: string): void {
    const notice = this.add.text(GAME_WIDTH / 2, 96, message, {
      color: '#fff1ce', fontFamily: 'monospace', fontSize: '16px', fontStyle: 'bold',
      backgroundColor: '#111316ee', padding: { x: 12, y: 7 },
    }).setOrigin(0.5).setDepth(95);
    this.tweens.add({
      targets: notice,
      y: 76,
      alpha: 0,
      duration: 1300,
      onComplete: () => notice.destroy(),
    });
  }

  private async completeCombatRoom(): Promise<void> {
    if (!this.sys.isActive()) return;
    this.combatActive = false;
    this.physics.pause();
    const choice = await showChoices('选择一项词条', '清场奖励会在本局持续生效。', runState.sampleAffixes());
    if (!this.sys.isActive()) return;
    runState.applyUpgrade(choice);
    this.advanceStage();
  }

  private advanceStage(): void {
    runState.advance();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.time.delayedCall(190, () => this.scene.restart());
  }

  private onPlayerDeath(): void {
    this.combatActive = false;
    this.time.delayedCall(500, () => this.scene.start('Result'));
  }

  private createWalls(): void {
    const wallData: Array<[number, number, number, number]> = [
      [GAME_WIDTH / 2, 78, GAME_WIDTH - 70, 24],
      [GAME_WIDTH / 2, GAME_HEIGHT - 32, GAME_WIDTH - 70, 24],
      [34, GAME_HEIGHT / 2, 24, GAME_HEIGHT - 90],
      [GAME_WIDTH - 34, GAME_HEIGHT / 2, 24, GAME_HEIGHT - 90],
      [270, 235, 120, 24],
      [690, 330, 120, 24],
    ];
    for (const [x, y, width, height] of wallData) {
      const wall = this.add.rectangle(x, y, width, height, COLORS.wall).setStrokeStyle(2, COLORS.wallEdge);
      this.walls?.add(wall);
      this.wallRects.push(new Phaser.Geom.Rectangle(x - width / 2, y - height / 2, width, height));
    }
  }

  private drawBackdrop(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(COLORS.floor).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(runState.stage.theme, 0.72).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, 0x7f4b34, 0.12);
    for (let x = 0; x < GAME_WIDTH; x += 48) graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    for (let y = 0; y < GAME_HEIGHT; y += 48) graphics.lineBetween(0, y, GAME_WIDTH, y);
    graphics.fillStyle(0x090b0d, 0.22);
    for (let index = 0; index < 24; index += 1) {
      const x = (index * 137) % GAME_WIDTH;
      const y = (index * 83) % GAME_HEIGHT;
      graphics.fillCircle(x, y, 3 + (index % 4));
    }
  }

  private drawProgress(): void {
    const y = GAME_HEIGHT - 11;
    const graphics = this.add.graphics().setDepth(70);
    const startX = 120;
    const endX = GAME_WIDTH - 94;
    const gap = (endX - startX) / Math.max(1, RUN_FLOW.length - 1);
    graphics.lineStyle(3, COLORS.wallEdge, 0.5).lineBetween(startX, y, endX, y);
    RUN_FLOW.forEach((stage, index) => {
      const active = index === runState.stageIndex;
      const done = index < runState.stageIndex;
      graphics.fillStyle(active ? COLORS.gold : done ? COLORS.bone : COLORS.muted, active ? 1 : 0.7)
        .fillCircle(startX + index * gap, y, active ? 7 : 5);
      const marker = stage.kind === 'combat' ? '战' : stage.kind === 'merchant' ? '商' : stage.kind === 'rest' ? '休' : '王';
      this.add.text(startX + index * gap, y - 18, marker, {
        color: active ? '#ffcf80' : '#897b71', fontFamily: 'monospace', fontSize: '10px',
      }).setOrigin(0.5).setDepth(70);
    });
  }

  private createHud(): void {
    this.healthBar = this.add.graphics().setDepth(72);
    this.hud = this.add.text(18, 45, '', {
      color: '#f4dfba', fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
      backgroundColor: '#0a0c0ecc', padding: { x: 10, y: 8 },
    }).setDepth(70);
    this.add.text(GAME_WIDTH - 18, 18, 'LMB 射击  RMB 格挡  Shift 翻滚  1/2 切枪  G 丢弃  E 交互', {
      color: '#9b8d82', fontFamily: 'monospace', fontSize: '11px',
    }).setOrigin(1, 0).setDepth(70);
    this.rollHud = this.add.text(GAME_WIDTH - 18, GAME_HEIGHT - 96, '翻滚就绪  Shift', {
      color: '#bce8ff', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      backgroundColor: '#0a0c0edd', padding: { x: 10, y: 7 },
    }).setOrigin(1, 1).setDepth(72);
    this.blockHud = this.add.text(GAME_WIDTH - 18, GAME_HEIGHT - 58, '格挡就绪  RMB', {
      color: '#f1dfbd', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      backgroundColor: '#0a0c0edd', padding: { x: 10, y: 7 },
    }).setOrigin(1, 1).setDepth(72);
  }

  private updateHud(): void {
    if (!this.hud) return;
    if (this.healthBar) {
      const healthRatio = Phaser.Math.Clamp(runState.hp / runState.stats.maxHp, 0, 1);
      this.healthBar.clear();
      this.healthBar.fillStyle(0x100809, 0.94).fillRoundedRect(18, 15, 254, 25, 7);
      this.healthBar.fillStyle(COLORS.healthRed, 1).fillRoundedRect(22, 19, 246 * healthRatio, 17, 5);
      this.healthBar.lineStyle(2, 0xff8b83, 0.9).strokeRoundedRect(18, 15, 254, 25, 7);
    }
    const markBar = Array.from({ length: 5 }, (_, index) => index < runState.marks ? '◆' : '◇').join('');
    const rage = runState.rageActive ? `  狂暴 ${(runState.rageRemainingMs / 1000).toFixed(1)}s` : runState.ragePending ? '  狂暴 READY' : '';
    const slot1 = runState.equippedWeapons[0] ? WEAPON_DEFINITIONS[runState.equippedWeapons[0].definitionId].name : '空';
    const slot2 = runState.equippedWeapons[1] ? WEAPON_DEFINITIONS[runState.equippedWeapons[1].definitionId].name : '空';
    const activeMarker1 = runState.activeWeaponSlot === 0 ? '▶' : ' ';
    const activeMarker2 = runState.activeWeaponSlot === 1 ? '▶' : ' ';
    this.hud.setText(
      `HP ${Math.ceil(runState.hp)}/${runState.stats.maxHp}\n` +
      `印记 ${markBar}${rage}\n` +
      `击杀/成功格挡 +1 · 满5自动狂暴 · 狂暴碎片续时\n` +
      `${activeMarker1}[1] ${slot1}   ${activeMarker2}[2] ${slot2}`,
    );

    if (this.player && this.blockHud) {
      const remaining = this.player.blockCooldownRemainingMs;
      if (this.player.isBlocking) {
        this.blockHud.setText('格挡展开').setColor('#fff2cc');
      } else if (remaining > 0) {
        this.blockHud.setText(`格挡冷却  ${(remaining / 1000).toFixed(1)}s`).setColor('#e57c59');
      } else {
        this.blockHud.setText('格挡就绪  RMB').setColor('#f1dfbd');
      }
    }
    if (this.player && this.rollHud) {
      const remaining = this.player.rollCooldownRemainingMs;
      if (this.player.isRolling) {
        this.rollHud.setText('翻滚闪避').setColor('#ffffff');
      } else if (remaining > 0) {
        this.rollHud.setText(`翻滚冷却  ${(remaining / 1000).toFixed(1)}s`).setColor('#63b9d8');
      } else {
        this.rollHud.setText('翻滚就绪  Shift').setColor('#bce8ff');
      }
    }

    const boss = this.enemies.find((enemy) => enemy.kind === 'boss' && enemy.alive);
    if (boss && this.bossBar) {
      this.bossBar.clear();
      this.bossBar.fillStyle(0x150d0c, 0.9).fillRect(250, 73, 460, 14);
      this.bossBar.fillStyle(COLORS.rust).fillRect(254, 77, 452 * Phaser.Math.Clamp(boss.health / boss.maxHp, 0, 1), 6);
    }
  }

  private createMuzzleFlash(x: number, y: number, angle: number, color: number): void {
    const flash = this.add.triangle(
      x + Math.cos(angle) * 34,
      y + Math.sin(angle) * 34,
      0, -7, 24, 0, 0, 7,
      color,
      0.9,
    ).setRotation(angle).setDepth(22);
    this.tweens.add({ targets: flash, alpha: 0, scaleX: 1.8, duration: 70, onComplete: () => flash.destroy() });
  }

  private createImpact(x: number, y: number, color: number, count = 7): void {
    for (let index = 0; index < count; index += 1) {
      const spark = this.add.image(x, y, 'spark').setTint(color).setDepth(24);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(18, 52);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.2,
        duration: Phaser.Math.Between(160, 300),
        onComplete: () => spark.destroy(),
      });
    }
  }

  private setupDebugKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.interactKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.debugKeys = {
      reset: keyboard.addKey(DEBUG_KEYS.resetRoom),
      rage: keyboard.addKey(DEBUG_KEYS.forceRage),
      boss: keyboard.addKey(DEBUG_KEYS.jumpBoss),
      pause: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC),
    };
  }

  private handleDebugInput(): void {
    if (!this.debugKeys) return;
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.reset)) this.scene.restart();
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.rage)) runState.startRage();
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.boss)) {
      runState.jumpToBoss();
      this.scene.restart();
    }
    if (Phaser.Input.Keyboard.JustDown(this.debugKeys.pause)) void this.togglePause();
  }

  private async togglePause(): Promise<void> {
    if (!this.combatActive) return;
    this.combatActive = false;
    this.physics.pause();
    await showChoices('暂停', '骨塔在等你。', [{ id: 'resume', title: '继续狩猎', description: '返回当前房间', tag: 'ESC' }]);
    if (!this.sys.isActive()) return;
    this.physics.resume();
    this.combatActive = true;
  }

  private shutdown(): void {
    clearOverlay();
    this.combatActive = false;
    this.time.removeAllEvents();
    this.tweens.killAll();
    for (const enemy of this.enemies) enemy.destroy();
    for (const [projectile, data] of this.gravityProjectileData) {
      data.marker.destroy();
      projectile.destroy();
    }
    for (const projectile of this.bulletProjectiles) projectile.sprite.destroy();
    for (const shard of this.shards) shard.destroy();
    for (const pickup of this.weaponPickups) {
      pickup.sprite.destroy();
      pickup.label.destroy();
    }
    this.exitPortal?.destroy();
    this.exitLabel?.destroy();
    for (const field of this.gravityFields) field.ring.destroy();
    this.enemies.length = 0;
    this.shards.length = 0;
    this.weaponPickups.length = 0;
    this.gravityFields.length = 0;
    this.bulletProjectiles.length = 0;
    this.wallRects.length = 0;
    this.gravityProjectileData.clear();
    this.enemyGroup = undefined;
    this.gravityProjectileGroup = undefined;
    this.walls = undefined;
  }

  private get livingEnemyCount(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  private rayWallDistance(x: number, y: number, dx: number, dy: number, maximum: number): number {
    let nearest = maximum;
    for (const rectangle of this.wallRects) {
      const distance = this.rayRectangleDistance(x, y, dx, dy, rectangle, maximum);
      if (distance !== null && distance > 0) nearest = Math.min(nearest, distance);
    }
    return nearest;
  }

  private rayRectangleDistance(
    x: number,
    y: number,
    dx: number,
    dy: number,
    rectangle: Phaser.Geom.Rectangle,
    maximum: number,
  ): number | null {
    let minimum = 0;
    let limit = maximum;
    const axes: Array<[number, number, number, number]> = [
      [x, dx, rectangle.left, rectangle.right],
      [y, dy, rectangle.top, rectangle.bottom],
    ];
    for (const [origin, direction, lower, upper] of axes) {
      if (Math.abs(direction) < 0.00001) {
        if (origin < lower || origin > upper) return null;
        continue;
      }
      let first = (lower - origin) / direction;
      let second = (upper - origin) / direction;
      if (first > second) [first, second] = [second, first];
      minimum = Math.max(minimum, first);
      limit = Math.min(limit, second);
      if (minimum > limit) return null;
    }
    return minimum >= 0 ? minimum : limit >= 0 ? limit : null;
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + t * dx, y1 + t * dy);
  }
}
