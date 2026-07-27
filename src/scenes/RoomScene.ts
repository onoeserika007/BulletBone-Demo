import Phaser from 'phaser';
import { BASE_STATS, COLORS, DEBUG_KEYS, GAME_HEIGHT, GAME_WIDTH } from '../config/demoConfig';
import { Enemy, randomSpawnPoint } from '../combat/Enemy';
import type { IncomingAttack } from '../combat/IncomingAttack';
import { Player } from '../combat/Player';
import { playTone } from '../combat/Sfx';
import { ensureTextures } from '../combat/Textures';
import { CHIPS, RUN_FLOW, runState } from '../run/RunState';
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

export class RoomScene extends Phaser.Scene {
  private player?: Player;
  private readonly enemies: Enemy[] = [];
  private readonly gravityProjectileData = new Map<Phaser.Physics.Arcade.Sprite, GravityProjectileData>();
  private readonly gravityFields: GravityField[] = [];
  private readonly shards: Phaser.Physics.Arcade.Sprite[] = [];
  private readonly wallRects: Phaser.Geom.Rectangle[] = [];
  private enemyGroup?: Phaser.Physics.Arcade.Group;
  private gravityProjectileGroup?: Phaser.Physics.Arcade.Group;
  private walls?: Phaser.Physics.Arcade.StaticGroup;
  private hud?: Phaser.GameObjects.Text;
  private blockHud?: Phaser.GameObjects.Text;
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
    this.blockHud = undefined;
    this.bossBar = undefined;
    this.enemies.length = 0;
    this.shards.length = 0;
    this.gravityFields.length = 0;
    this.wallRects.length = 0;
    this.gravityProjectileData.clear();
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
    this.gravityProjectileGroup = this.physics.add.group();

    this.player = new Player(this, {
      fireLaser: (x, y, angle, damage) => this.fireLaser(x, y, angle, damage),
      fireGravity: (x, y, targetX, targetY, damage) => this.fireGravity(x, y, targetX, targetY, damage),
      fireCounter: (x, y, angle, damage) => this.fireCounter(x, y, angle, damage),
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
    if (runState.stage.kind === 'boss') this.spawnBoss();
    else this.spawnWave(runState.stage.melee ?? 0, runState.stage.ranged ?? 0);

    if (runState.beginCombat()) playTone('rage');
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  public update(time: number, delta: number): void {
    if (!this.combatActive || !this.player) return;
    this.player.update(time, delta);
    for (const enemy of this.enemies) enemy.update(time);
    this.updateGravityProjectiles(time, delta);
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
    const startX = x + Math.cos(angle) * 30;
    const startY = y + Math.sin(angle) * 30;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    let hitDistance = this.rayWallDistance(startX, startY, directionX, directionY, 2200);
    let hitEnemy: Enemy | undefined;

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const offsetX = enemy.sprite.x - startX;
      const offsetY = enemy.sprite.y - startY;
      const projection = offsetX * directionX + offsetY * directionY;
      if (projection <= 0 || projection >= hitDistance) continue;
      const perpendicular = Math.abs(offsetX * directionY - offsetY * directionX);
      const hitRadius = enemy.kind === 'boss' ? 46 : 22;
      if (perpendicular <= hitRadius) {
        hitDistance = projection;
        hitEnemy = enemy;
      }
    }

    const endX = startX + directionX * hitDistance;
    const endY = startY + directionY * hitDistance;
    const beam = this.add.graphics().setDepth(17);
    beam.lineStyle(runState.rageActive ? 9 : 6, 0xffffff, 0.2).lineBetween(startX, startY, endX, endY);
    beam.lineStyle(runState.rageActive ? 4 : 3, COLORS.playerLaser, 0.95).lineBetween(startX, startY, endX, endY);
    this.tweens.add({ targets: beam, alpha: 0, duration: 75, onComplete: () => beam.destroy() });

    if (hitEnemy) {
      hitEnemy.takeDamage(damage);
      this.createImpact(endX, endY, COLORS.playerLaser);
    }
    this.createMuzzleFlash(x, y, angle, COLORS.playerLaser);
  }

  private fireGravity(x: number, y: number, targetX: number, targetY: number, damage: number): void {
    if (!runState.weapons.has('gravity') || !this.gravityProjectileGroup) return;
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
    beam.lineStyle(10, COLORS.boneBright, 0.9).lineBetween(x, y, x2, y2);
    this.tweens.add({ targets: beam, alpha: 0, duration: 130, onComplete: () => beam.destroy() });
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
    this.blockHud = this.add.text(GAME_WIDTH - 18, GAME_HEIGHT - 58, '格挡就绪  RMB', {
      color: '#f1dfbd', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
      backgroundColor: '#0a0c0edd', padding: { x: 10, y: 7 },
    }).setOrigin(1, 1).setDepth(72);
  }

  private updateHud(): void {
    if (!this.hud) return;
    const markBar = Array.from({ length: 5 }, (_, index) => index < runState.marks ? '◆' : '◇').join('');
    const rage = runState.rageActive ? `  狂暴 ${(runState.rageRemainingMs / 1000).toFixed(1)}s` : runState.ragePending ? '  狂暴 READY' : '';
    const weapon = runState.activeWeapon === 'gravity' ? '重力场枪' : '连发激光枪';
    this.hud.setText(`HP ${Math.ceil(runState.hp)}/${runState.stats.maxHp}  ${markBar}${rage}\n武器 ${weapon}`);

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
    for (const [projectile, data] of this.gravityProjectileData) {
      data.marker.destroy();
      projectile.destroy();
    }
    for (const shard of this.shards) shard.destroy();
    for (const field of this.gravityFields) field.ring.destroy();
    this.enemies.length = 0;
    this.shards.length = 0;
    this.gravityFields.length = 0;
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
