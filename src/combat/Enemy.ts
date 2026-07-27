import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/demoConfig';
import type { IncomingAttack } from './IncomingAttack';
import { playTone } from './Sfx';

export type EnemyKind = 'melee' | 'ranged' | 'boss';

export interface EnemyHooks {
  getPlayerPosition: () => Phaser.Math.Vector2;
  resolveAttack: (attack: IncomingAttack) => void;
  onDeath: (enemy: Enemy) => void;
}

let nextAttackId = 1;

export class Enemy {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  public alive = true;
  private hp: number;
  private nextAttackAt: number;
  private attacking = false;
  private gravityUntil = 0;
  private gravityX = 0;
  private gravityY = 0;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly kind: EnemyKind,
    x: number,
    y: number,
    private readonly hooks: EnemyHooks,
  ) {
    const texture = kind === 'boss' ? 'boss' : kind;
    this.sprite = scene.physics.add.sprite(x, y, texture).setDepth(10).setCollideWorldBounds(true);
    this.sprite.setCircle(kind === 'boss' ? 39 : 17, kind === 'boss' ? 9 : 5, kind === 'boss' ? 9 : 5);
    this.hp = kind === 'boss' ? 620 : kind === 'ranged' ? 52 : 45;
    this.nextAttackAt = scene.time.now + Phaser.Math.Between(450, 1000);
  }

  public get maxHp(): number {
    return this.kind === 'boss' ? 620 : this.kind === 'ranged' ? 52 : 45;
  }

  public get health(): number {
    return this.hp;
  }

  public update(time: number): void {
    if (!this.alive) return;
    if (time < this.gravityUntil) {
      const direction = new Phaser.Math.Vector2(this.gravityX - this.sprite.x, this.gravityY - this.sprite.y).normalize();
      this.sprite.setVelocity(direction.x * 330, direction.y * 330);
      return;
    }

    const player = this.hooks.getPlayerPosition();
    const distance = Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    const direction = new Phaser.Math.Vector2(player.x - this.sprite.x, player.y - this.sprite.y).normalize();

    if (this.kind === 'melee') {
      if (!this.attacking) this.sprite.setVelocity(direction.x * 105, direction.y * 105);
      if (distance < 68 && time >= this.nextAttackAt && !this.attacking) this.beginMeleeAttack();
      return;
    }

    if (this.kind === 'boss') {
      this.sprite.setVelocity(Math.sin(time / 700) * 55, Math.cos(time / 1100) * 24);
      if (time >= this.nextAttackAt && !this.attacking) this.beginLaserAttack(true);
      return;
    }

    if (!this.attacking) {
      if (distance < 245) this.sprite.setVelocity(-direction.x * 90, -direction.y * 90);
      else if (distance > 335) this.sprite.setVelocity(direction.x * 72, direction.y * 72);
      else this.sprite.setVelocity(-direction.y * 36, direction.x * 36);
    }
    if (time >= this.nextAttackAt && !this.attacking) this.beginLaserAttack(false);
  }

  public takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.flashDamage(amount);
    if (this.hp <= 0) this.die();
  }

  public pullToward(x: number, y: number, until: number): void {
    if (!this.alive) return;
    this.gravityX = x;
    this.gravityY = y;
    if (until <= this.gravityUntil) return;
    this.gravityUntil = until;
    this.attacking = false;
    this.sprite.setTint(COLORS.gravity);
    this.scene.time.delayedCall(Math.max(0, until - this.scene.time.now), () => {
      if (this.alive) this.sprite.clearTint();
    });
  }

  public destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }

  private beginMeleeAttack(): void {
    this.attacking = true;
    this.sprite.setVelocity(0).setTint(COLORS.rust);
    const warning = this.scene.add.circle(this.sprite.x, this.sprite.y, 31, COLORS.rust, 0.15)
      .setStrokeStyle(2, COLORS.rust).setDepth(9);
    this.scene.tweens.add({ targets: warning, scale: 1.55, alpha: 0, duration: 320, onComplete: () => warning.destroy() });
    const attackId = nextAttackId++;
    this.scene.time.delayedCall(320, () => {
      if (!this.alive) return;
      this.sprite.clearTint();
      const player = this.hooks.getPlayerPosition();
      if (Phaser.Math.Distance.Between(this.sprite.x, this.sprite.y, player.x, player.y) < 82) {
        this.hooks.resolveAttack({ id: attackId, sourceX: this.sprite.x, sourceY: this.sprite.y, damage: 14, kind: 'melee' });
      }
      this.attacking = false;
      this.nextAttackAt = this.scene.time.now + 900;
    });
  }

  private beginLaserAttack(isBoss: boolean): void {
    this.attacking = true;
    this.sprite.setVelocity(0).setTint(COLORS.enemyLaser);
    const player = this.hooks.getPlayerPosition();
    const baseAngle = Phaser.Math.Angle.Between(this.sprite.x, this.sprite.y, player.x, player.y);
    const spread = isBoss ? [-0.22, 0, 0.22] : [0];
    const beams = spread.map((offset) => {
      const angle = baseAngle + offset;
      return {
        x2: this.sprite.x + Math.cos(angle) * 1200,
        y2: this.sprite.y + Math.sin(angle) * 1200,
      };
    });
    const telegraph = this.scene.add.graphics().setDepth(8);
    telegraph.lineStyle(isBoss ? 3 : 2, COLORS.enemyLaser, 0.36);
    for (const beam of beams) telegraph.lineBetween(this.sprite.x, this.sprite.y, beam.x2, beam.y2);
    this.scene.tweens.add({ targets: telegraph, alpha: { from: 0.25, to: 1 }, yoyo: true, repeat: 3, duration: 90 });
    const attackId = nextAttackId++;

    this.scene.time.delayedCall(isBoss ? 720 : 620, () => {
      telegraph.destroy();
      if (!this.alive) return;
      this.sprite.clearTint();
      const blast = this.scene.add.graphics().setDepth(18);
      blast.lineStyle(isBoss ? 8 : 6, 0xffd2b8, 0.92);
      for (const beam of beams) blast.lineBetween(this.sprite.x, this.sprite.y, beam.x2, beam.y2);
      this.scene.tweens.add({ targets: blast, alpha: 0, duration: 105, onComplete: () => blast.destroy() });

      const currentPlayer = this.hooks.getPlayerPosition();
      const hit = beams.some((beam) => this.distanceToSegment(
        currentPlayer.x,
        currentPlayer.y,
        this.sprite.x,
        this.sprite.y,
        beam.x2,
        beam.y2,
      ) < 25);
      if (hit) {
        this.hooks.resolveAttack({
          id: attackId,
          sourceX: this.sprite.x,
          sourceY: this.sprite.y,
          damage: isBoss ? 16 : 10,
          kind: 'laser',
        });
      }
      this.attacking = false;
      this.nextAttackAt = this.scene.time.now + (isBoss ? 950 : 1350);
    });
  }

  private flashDamage(amount: number): void {
    this.sprite.setTint(0xffffff);
    this.scene.time.delayedCall(60, () => {
      if (this.alive && this.scene.time.now >= this.gravityUntil) this.sprite.clearTint();
    });
    const text = this.scene.add.text(this.sprite.x, this.sprite.y - 24, `${Math.round(amount)}`, {
      color: '#ffe2ad', fontFamily: 'monospace', fontSize: '14px', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(30);
    this.scene.tweens.add({ targets: text, y: text.y - 25, alpha: 0, duration: 430, onComplete: () => text.destroy() });
    playTone('hit');
  }

  private die(): void {
    if (!this.alive) return;
    this.alive = false;
    this.sprite.disableBody(true, false);
    this.hooks.onDeath(this);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: 1.55,
      alpha: 0,
      angle: Phaser.Math.Between(-35, 35),
      duration: this.kind === 'boss' ? 700 : 220,
      onComplete: () => this.sprite.destroy(),
    });
  }

  private distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Phaser.Math.Clamp(((px - x1) * dx + (py - y1) * dy) / lengthSquared, 0, 1);
    return Phaser.Math.Distance.Between(px, py, x1 + t * dx, y1 + t * dy);
  }
}

export const randomSpawnPoint = (index: number, total: number): Phaser.Math.Vector2 => {
  const angle = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  const radiusX = GAME_WIDTH * 0.35;
  const radiusY = GAME_HEIGHT * 0.31;
  return new Phaser.Math.Vector2(
    GAME_WIDTH / 2 + Math.cos(angle) * radiusX + Phaser.Math.Between(-35, 35),
    GAME_HEIGHT / 2 + Math.sin(angle) * radiusY + Phaser.Math.Between(-25, 25),
  );
};
