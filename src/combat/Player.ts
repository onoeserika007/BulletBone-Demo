import Phaser from 'phaser';
import { BASE_STATS, COLORS, PLAYER_SPAWN_X, PLAYER_SPAWN_Y } from '../config/demoConfig';
import type { WeaponInstance, WeaponRuntime } from '../config/weaponDefinitions';
import { runState } from '../run/RunState';
import type { IncomingAttack } from './IncomingAttack';
import { playTone } from './Sfx';

export interface PlayerHooks {
  fireWeapon: (
    runtime: WeaponRuntime,
    x: number,
    y: number,
    angle: number,
    targetX: number,
    targetY: number,
    damageMultiplier: number,
  ) => void;
  fireCounter: (x: number, y: number, angle: number, damage: number) => void;
  dropWeapon: (instance: WeaponInstance, x: number, y: number) => void;
  showMessage: (message: string) => void;
  hasLivingTargets: () => boolean;
  onDeath: () => void;
}

export class Player {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  private readonly weapon: Phaser.GameObjects.Rectangle;
  private readonly keys: Record<'up' | 'down' | 'left' | 'right' | 'one' | 'two' | 'drop' | 'roll', Phaser.Input.Keyboard.Key>;
  private readonly pointerDownHandler: (pointer: Phaser.Input.Pointer) => void;
  private readonly rollDirection = new Phaser.Math.Vector2();
  private aimAngle = 0;
  private nextShotAt = 0;
  private blockUntil = 0;
  private blockCooldownUntil = 0;
  private blockHit = false;
  private rollUntil = 0;
  private rollCooldownUntil = 0;
  private wasRaging = false;
  private dead = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly hooks: PlayerHooks,
  ) {
    this.sprite = scene.physics.add.sprite(PLAYER_SPAWN_X, PLAYER_SPAWN_Y, 'player');
    this.sprite.setCircle(18, 6, 6).setDepth(20).setCollideWorldBounds(true);
    this.wasRaging = runState.rageActive;
    if (this.wasRaging) this.sprite.setTint(COLORS.playerRage);
    this.weapon = scene.add.rectangle(this.sprite.x, this.sprite.y, 32, 7, COLORS.playerLaser)
      .setOrigin(0.12, 0.5).setDepth(21);

    const keyboard = scene.input.keyboard;
    if (!keyboard) throw new Error('Keyboard input is unavailable');
    this.keys = {
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      one: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      two: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      drop: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G),
      roll: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };
    this.pointerDownHandler = (pointer) => {
      if (pointer.button === 2) this.beginBlock();
    };
    scene.input.on('pointerdown', this.pointerDownHandler);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  public update(time: number, delta: number): void {
    if (this.dead) return;
    const pointer = this.scene.input.activePointer;
    this.aimAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, pointer.worldX, pointer.worldY);

    if (Phaser.Input.Keyboard.JustDown(this.keys.one)) runState.switchWeapon(0);
    if (Phaser.Input.Keyboard.JustDown(this.keys.two)) runState.switchWeapon(1);
    if (Phaser.Input.Keyboard.JustDown(this.keys.drop)) {
      const dropped = runState.dropActiveWeapon();
      if (dropped) this.hooks.dropWeapon(dropped, this.sprite.x, this.sprite.y);
      else this.hooks.showMessage('至少保留一把武器');
    }

    let blocking = time < this.blockUntil;
    if (!blocking && this.blockUntil > 0) {
      if (!this.blockHit) this.blockCooldownUntil = Math.max(this.blockCooldownUntil, time + runState.stats.blockFailCooldownMs);
      this.blockUntil = 0;
      this.refreshTint();
    }

    const direction = new Phaser.Math.Vector2(
      Number(this.keys.right.isDown) - Number(this.keys.left.isDown),
      Number(this.keys.down.isDown) - Number(this.keys.up.isDown),
    ).normalize();
    if (Phaser.Input.Keyboard.JustDown(this.keys.roll)) this.beginRoll(direction);
    const rolling = time < this.rollUntil;
    if (rolling) {
      this.sprite.setVelocity(this.rollDirection.x * BASE_STATS.rollSpeed, this.rollDirection.y * BASE_STATS.rollSpeed);
    } else {
      const speed = blocking ? 0 : runState.stats.moveSpeed;
      this.sprite.setVelocity(direction.x * speed, direction.y * speed);
    }

    blocking = time < this.blockUntil;
    this.weapon.setPosition(this.sprite.x, this.sprite.y).setRotation(this.aimAngle);
    this.weapon.setFillStyle(runState.activeWeaponRuntime.color);

    if (!blocking && !rolling && pointer.leftButtonDown() && time >= this.nextShotAt) this.fire(time);

    const rageEnded = runState.updateRage(delta);
    if (rageEnded) this.scene.cameras.main.flash(120, 60, 45, 35, false);
    if (runState.rageActive !== this.wasRaging) {
      this.wasRaging = runState.rageActive;
      if (this.wasRaging) {
        this.refreshTint();
        this.scene.cameras.main.flash(220, 55, 220, 255, false);
        this.scene.cameras.main.shake(180, 0.012);
        playTone('rage');
      } else if (!blocking) this.refreshTint();
    }
  }

  public resolveIncoming(attack: IncomingAttack): boolean {
    if (this.dead) return false;
    const now = this.scene.time.now;
    if (now < this.rollUntil) return true;
    const sourceAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, attack.sourceX, attack.sourceY);
    const facingDifference = Math.abs(Phaser.Math.Angle.Wrap(sourceAngle - this.aimAngle));
    if (now < this.blockUntil && facingDifference <= Phaser.Math.DegToRad(75)) {
      this.blockHit = true;
      this.blockUntil = 0;
      this.blockCooldownUntil = now + runState.stats.blockSuccessCooldownMs;
      this.refreshTint();
      runState.blocks += 1;
      if (!runState.rageActive) runState.gainMark(this.hooks.hasLivingTargets());
      this.createBlockSuccessEffect();
      this.hooks.fireCounter(this.sprite.x, this.sprite.y, this.aimAngle, this.withRageDamage(runState.stats.counterDamage));
      this.scene.cameras.main.shake(90, 0.009);
      playTone('block');
      return true;
    }
    this.takeDamage(attack.damage);
    return false;
  }

  public get blockCooldownRemainingMs(): number {
    return Math.max(0, this.blockCooldownUntil - this.scene.time.now);
  }

  public get isBlocking(): boolean {
    return this.scene.time.now < this.blockUntil;
  }

  public get rollCooldownRemainingMs(): number {
    return Math.max(0, this.rollCooldownUntil - this.scene.time.now);
  }

  public get isRolling(): boolean {
    return this.scene.time.now < this.rollUntil;
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.pointerDownHandler);
    this.weapon.destroy();
  }

  private beginBlock(): void {
    const now = this.scene.time.now;
    if (this.dead || now < this.blockCooldownUntil || now < this.blockUntil || now < this.rollUntil) return;
    this.blockHit = false;
    this.blockUntil = now + runState.stats.blockWindowMs;
    this.sprite.setTint(COLORS.blockBlueBright);
    const arc = this.scene.add.arc(this.sprite.x, this.sprite.y, 58, -75, 75, false, COLORS.blockBlue, 0.32)
      .setRotation(this.aimAngle).setDepth(19);
    this.scene.tweens.add({ targets: arc, alpha: 0, scale: 1.25, duration: runState.stats.blockWindowMs, onComplete: () => arc.destroy() });
  }

  private beginRoll(direction: Phaser.Math.Vector2): void {
    const now = this.scene.time.now;
    if (this.dead || now < this.rollCooldownUntil || now < this.blockUntil) return;
    if (direction.lengthSq() > 0) this.rollDirection.copy(direction).normalize();
    else this.rollDirection.set(Math.cos(this.aimAngle), Math.sin(this.aimAngle));
    this.rollUntil = now + BASE_STATS.rollDurationMs;
    this.rollCooldownUntil = now + BASE_STATS.rollCooldownMs;
    const ghost = this.scene.add.image(this.sprite.x, this.sprite.y, 'player')
      .setTint(COLORS.playerRage).setAlpha(0.45).setDepth(19);
    this.scene.tweens.add({ targets: ghost, alpha: 0, scale: 1.25, duration: 240, onComplete: () => ghost.destroy() });
  }

  private createBlockSuccessEffect(): void {
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 26, COLORS.blockBlue, 0.18)
      .setStrokeStyle(5, COLORS.blockBlueBright, 0.95).setDepth(28);
    const flash = this.scene.add.arc(
      this.sprite.x,
      this.sprite.y,
      72,
      -78,
      78,
      false,
      COLORS.blockBlue,
      0.42,
    ).setRotation(this.aimAngle).setDepth(27);
    this.scene.tweens.add({ targets: ring, scale: 3.2, alpha: 0, duration: 180, onComplete: () => ring.destroy() });
    this.scene.tweens.add({ targets: flash, scale: 1.45, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
    this.scene.cameras.main.flash(85, 45, 145, 255, false);
  }

  private fire(time: number): void {
    const runtime = runState.activeWeaponRuntime;
    const rageRate = runState.rageActive ? runState.rageFireRateMultiplier : 1;
    const rageDamage = runState.rageActive ? runState.rageDamageMultiplier : 1;
    const pointer = this.scene.input.activePointer;
    this.hooks.fireWeapon(
      runtime,
      this.sprite.x,
      this.sprite.y,
      this.aimAngle,
      pointer.worldX,
      pointer.worldY,
      rageDamage,
    );
    this.nextShotAt = time + runtime.intervalMs / rageRate;
    playTone(runtime.definition.fireMode === 'gravity' ? 'gravity' : 'shot');
    this.weapon.x -= Math.cos(this.aimAngle) * 5;
    this.weapon.y -= Math.sin(this.aimAngle) * 5;
    this.scene.tweens.add({ targets: this.weapon, x: this.sprite.x, y: this.sprite.y, duration: 55 });
  }

  private withRageDamage(damage: number): number {
    return damage * (runState.rageActive ? runState.rageDamageMultiplier : 1);
  }

  private refreshTint(): void {
    if (this.dead) return;
    if (this.scene.time.now < this.blockUntil) this.sprite.setTint(COLORS.blockBlueBright);
    else if (runState.rageActive) this.sprite.setTint(COLORS.playerRage);
    else this.sprite.clearTint();
  }

  private takeDamage(amount: number): void {
    runState.hp = Math.max(0, runState.hp - amount);
    this.sprite.setTint(COLORS.rust);
    this.scene.time.delayedCall(90, () => {
      if (!this.dead) this.refreshTint();
    });
    this.scene.cameras.main.shake(120, 0.014);
    playTone('hit');
    if (runState.hp <= 0) {
      this.dead = true;
      this.sprite.setVelocity(0).setTint(0x553b36);
      this.hooks.onDeath();
    }
  }
}
