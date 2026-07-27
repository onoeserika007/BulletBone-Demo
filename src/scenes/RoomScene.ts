import Phaser from 'phaser';
import { BASE_STATS, COLORS, DEBUG_KEYS, GAME_HEIGHT, GAME_WIDTH } from '../config/demoConfig';
import { Enemy, randomSpawnPoint } from '../combat/Enemy';
import type { IncomingAttack } from '../combat/IncomingAttack';
import { Player } from '../combat/Player';
import { playTone } from '../combat/Sfx';
import { ensureTextures } from '../combat/Textures';
import { CHIPS, RUN_FLOW, runState } from '../run/RunState';
import { clearOverlay, showChoices } from '../ui/Overlay';

interface ProjectileData {
  kind: 'laser' | 'gravity';
  damage: number;
}

interface GravityField {
  x: number;
  y: number;
  radius: number;
  endAt: number;
  ring: Phaser.GameObjects.Arc;
}

export class RoomScene extends Phaser.Scene {
  private player?: Player;
  private readonly enemies: Enemy[] = [];
  private readonly projectileData = new Map<Phaser.Physics.Arcade.Sprite, ProjectileData>();
  private readonly gravityFields: GravityField[] = [];
  private readonly shards: Phaser.Physics.Arcade.Sprite[] = [];
  private enemyGroup?: Phaser.Physics.Arcade.Group;
  private projectileGroup?: Phaser.Physics.Arcade.Group;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private hud?: Phaser.GameObjects.Text;
  private bossBar?: Phaser.GameObjects.Graphics;
  private roomClearing = false;
  private combatActive = false;
  private debugKeys?: Record<'reset' | 'rage' | 'boss' | 'pause', Phaser.Input.Keyboard.Key>;

  public constructor() {
    super('Room');
  }

  public create(): void {
    this.roomClearing = false;
    this.combatActive = false;
    this.player = undefined;
    this.hud = undefined;
    this.bossBar = undefined;
    this.enemies.length = 0;
    this.shards.length = 0;
    this.gravityFields.length = 0;
    this.projectileData.clear();
    ensureTextures(this);
    clearOverlay();
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

    if (runState.stage.kind === 'merchant' || runState.stage.kind === 'chest') {
      void this.runNonCombatStage();
      return;
    }

    this.combatActive = true;
    this.walls = this.physics.add.staticGroup();
    this.createWalls();
    this.enemyGroup = this.physics.add.group();
    this.projectileGroup = this.physics.add.group();

    this.player = new Player(this, {
      fireLaser: (x, y, angle, damage) => this.fireLaser(x, y, angle, damage),
      fireGravity: (x, y, angle, damage) => this.fireGravity(x, y, angle, damage),
      fireCounter: (x, y, angle, damage) => this.fireCounter(x, y, angle, damage),
      hasLivingTargets: () => this.livingEnemyCount > 0,
      onDeath: () => this.onPlayerDeath(),
    });
    this.physics.add.collider(this.player.sprite, this.walls);
    this.physics.add.collider(this.enemyGroup, this.walls);
    this.physics.add.collider(this.projectileGroup, this.walls, (object) => {
      this.onProjectileHitWall(object as Phaser.Physics.Arcade.Sprite);
    });
    this.physics.add.overlap(this.projectileGroup, this.enemyGroup, (projectileObject, enemyObject) => {
      this.onProjectileHitEnemy(
        projectileObject as Phaser.Physics.Arcade.Sprite,
        enemyObject as Phaser.Physics.Arcade.Sprite,
      );
    });

    this.createHud();
    if (runState.stage.kind === 'boss') this.spawnBoss();
    else this.spawnWave(runState.stage.melee ?? 0, runState.stage.ranged ?? 0);

    if (runState.beginCombat()) playTone('rage');
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  public update(time: number, delta: number): void {
    if (!this.combatActive || !this.player) return;
    this.player.update(time, delta);
    for (const enemy of this.enemies) enemy.update(time);
    this.updateGravityFields(time);
    this.updateShards();
    this.updateHud();
    this.handleDebugInput();
  }

  private async runNonCombatStage(): Promise<void> {
    if (runState.stage.kind === 'merchant') {
      const options = runState.sampleChips();
      const id = await showChoices('废土商人', '骨匠咧嘴一笑：“第一枚芯片免费。”', options.length ? options : CHIPS.slice(0, 3));
      if (!this.sys.isActive()) return;
      runState.applyUpgrade(id);
    } else {
      await showChoices('橙色军械箱', '奇点在枪膛里低鸣。重力场枪已加入武器栏。', [{
        id: 'gravity', title: '重力场枪 · 重力过载', description: '低射速重力炸弹，命中后牵引并坍缩爆炸。按 2 切换。', tag: '固定橙色武器',
      }]);
      if (!this.sys.isActive()) return;
      runState.grantGravityGun();
    }
    this.advanceStage();
  }

  private spawnWave(melee: number, ranged: number): void {
    const total = melee + ranged;
    for (let index = 0; index < total; index += 1) {
      this.spawnEnemy(index < melee ? 'melee' : 'ranged', randomSpawnPoint(index, total));
    }
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

  private fireLaser(x: number, y: number, angle: number, damage: number): void {
    if (!this.projectileGroup) return;
    const projectile = this.physics.add.sprite(
      x + Math.cos(angle) * 30,
      y + Math.sin(angle) * 30,
      'laser-bolt',
    ).setRotation(angle).setDepth(16);
    projectile.body.setSize(26, 6);
    this.physics.velocityFromRotation(angle, 780, projectile.body.velocity);
    this.projectileData.set(projectile, { kind: 'laser', damage });
    this.projectileGroup.add(projectile);
    this.time.delayedCall(1100, () => this.destroyProjectile(projectile));
    this.createMuzzleFlash(x, y, angle, COLORS.playerLaser);
  }

  private fireGravity(x: number, y: number, angle: number, damage: number): void {
    if (!this.projectileGroup || !runState.weapons.has('gravity')) return;
    const projectile = this.physics.add.sprite(
      x + Math.cos(angle) * 34,
      y + Math.sin(angle) * 34,
      'gravity-orb',
    ).setDepth(16);
    projectile.setCircle(12, 3, 3);
    this.physics.velocityFromRotation(angle, 330, projectile.body.velocity);
    this.projectileData.set(projectile, { kind: 'gravity', damage });
    this.projectileGroup.add(projectile);
    this.tweens.add({ targets: projectile, angle: 360, duration: 420, repeat: -1 });
    this.time.delayedCall(1350, () => this.detonateGravity(projectile));
    this.createMuzzleFlash(x, y, angle, COLORS.gravity);
  }

  private fireCounter(x: number, y: number, angle: number, damage: number): void {
    const x2 = x + Math.cos(angle) * 1100;
    const y2 = y + Math.sin(angle) * 1100;
    const beam = this.add.graphics().setDepth(25);
    beam.lineStyle(10, COLORS.boneBright, 0.9).lineBetween(x, y, x2, y2);
    this.tweens.add({ targets: beam, alpha: 0, duration: 130, onComplete: () => beam.destroy() });
    for (const enemy of this.enemies) {
      if (enemy.alive && this.distanceToSegment(enemy.sprite.x, enemy.sprite.y, x, y, x2, y2) < 38) {
        enemy.takeDamage(damage);
      }
    }
  }

  private onProjectileHitEnemy(projectile: Phaser.Physics.Arcade.Sprite, enemySprite: Phaser.Physics.Arcade.Sprite): void {
    const data = this.projectileData.get(projectile);
    const enemy = this.enemies.find((candidate) => candidate.sprite === enemySprite && candidate.alive);
    if (!data || !enemy) return;
    if (data.kind === 'gravity') this.detonateGravity(projectile);
    else {
      enemy.takeDamage(data.damage);
      this.createImpact(projectile.x, projectile.y, COLORS.playerLaser);
      this.destroyProjectile(projectile);
    }
  }

  private onProjectileHitWall(projectile: Phaser.Physics.Arcade.Sprite): void {
    const data = this.projectileData.get(projectile);
    if (!data) return;
    if (data.kind === 'gravity') this.detonateGravity(projectile);
    else this.destroyProjectile(projectile);
  }

  private detonateGravity(projectile: Phaser.Physics.Arcade.Sprite): void {
    const data = this.projectileData.get(projectile);
    if (!data || data.kind !== 'gravity') return;
    const x = projectile.x;
    const y = projectile.y;
    this.destroyProjectile(projectile);
    const radius = runState.stats.gravityRadius;
    const ring = this.add.circle(x, y, radius, COLORS.gravity, 0.08)
      .setStrokeStyle(4, COLORS.gravity, 0.8).setDepth(12);
    ring.setScale(0.15);
    this.tweens.add({ targets: ring, scale: 1, duration: BASE_STATS.gravityPullMs, ease: 'Quad.easeOut' });
    this.gravityFields.push({ x, y, radius, endAt: this.time.now + BASE_STATS.gravityPullMs, ring });
    ring.setData('damage', data.damage);
    playTone('gravity');
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
    if (runState.rageActive) this.spawnShard(enemy.sprite.x, enemy.sprite.y);
    else runState.gainMark(this.livingEnemyCount > 0);

    if (enemy.kind === 'boss') {
      this.combatActive = false;
      this.time.delayedCall(850, () => this.scene.start('Result'));
      return;
    }
    if (this.livingEnemyCount === 0 && !this.roomClearing) {
      this.roomClearing = true;
      this.time.delayedCall(1000, () => void this.completeCombatRoom());
    }
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
      const magnetRange = this.roomClearing ? 1000 : 145;
      if (distance < magnetRange) {
        const direction = new Phaser.Math.Vector2(this.player.sprite.x - shard.x, this.player.sprite.y - shard.y).normalize();
        shard.setVelocity(direction.x * (this.roomClearing ? 620 : 320), direction.y * (this.roomClearing ? 620 : 320));
      }
      if (distance < 28) {
        runState.extendRage();
        playTone('pickup');
        shard.destroy();
        this.shards.splice(index, 1);
      }
    }
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

  private destroyProjectile(projectile: Phaser.Physics.Arcade.Sprite): void {
    if (!this.projectileData.has(projectile)) return;
    this.projectileData.delete(projectile);
    projectile.destroy();
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
    const startX = 190;
    const gap = 116;
    graphics.lineStyle(3, COLORS.wallEdge, 0.5).lineBetween(startX, y, startX + gap * (RUN_FLOW.length - 1), y);
    RUN_FLOW.forEach((stage, index) => {
      const active = index === runState.stageIndex;
      const done = index < runState.stageIndex;
      graphics.fillStyle(active ? COLORS.gold : done ? COLORS.bone : COLORS.muted, active ? 1 : 0.7)
        .fillCircle(startX + index * gap, y, active ? 7 : 5);
      this.add.text(startX + index * gap, y - 18, stage.kind === 'combat' ? '战' : stage.kind === 'merchant' ? '商' : stage.kind === 'chest' ? '箱' : '王', {
        color: active ? '#ffcf80' : '#897b71', fontFamily: 'monospace', fontSize: '10px',
      }).setOrigin(0.5).setDepth(70);
    });
  }

  private createHud(): void {
    this.hud = this.add.text(18, 16, '', {
      color: '#f4dfba', fontFamily: 'monospace', fontSize: '15px', fontStyle: 'bold',
      backgroundColor: '#0a0c0ecc', padding: { x: 10, y: 8 },
    }).setDepth(70);
    this.add.text(GAME_WIDTH - 18, 18, 'LMB 射击  RMB 格挡反击  1/2 切枪', {
      color: '#9b8d82', fontFamily: 'monospace', fontSize: '11px',
    }).setOrigin(1, 0).setDepth(70);
  }

  private updateHud(): void {
    if (!this.hud) return;
    const markBar = Array.from({ length: 5 }, (_, index) => index < runState.marks ? '◆' : '◇').join('');
    const rage = runState.rageActive ? `  狂暴 ${(runState.rageRemainingMs / 1000).toFixed(1)}s` : runState.ragePending ? '  狂暴 READY' : '';
    const weapon = runState.activeWeapon === 'gravity' ? '重力场枪' : '连发激光枪';
    this.hud.setText(`HP ${Math.ceil(runState.hp)}/${runState.stats.maxHp}  ${markBar}${rage}\n武器 ${weapon}`);

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
    for (const projectile of this.projectileData.keys()) projectile.destroy();
    for (const shard of this.shards) shard.destroy();
    for (const field of this.gravityFields) field.ring.destroy();
    this.enemies.length = 0;
    this.shards.length = 0;
    this.gravityFields.length = 0;
    this.projectileData.clear();
    this.enemyGroup = undefined;
    this.projectileGroup = undefined;
    this.walls = undefined;
  }

  private get livingEnemyCount(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + t * dx, y1 + t * dy);
  }
}
