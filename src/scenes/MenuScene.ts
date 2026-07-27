import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config/demoConfig';
import { ensureTextures } from '../combat/Textures';
import { runState } from '../run/RunState';
import { clearOverlay, showChoices, showMenu } from '../ui/Overlay';

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super('Menu');
  }

  public create(): void {
    ensureTextures(this);
    this.cameras.main.setBackgroundColor(COLORS.void);
    this.drawBackground();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, clearOverlay);
    showMenu(() => void this.startRun());
  }

  private async startRun(): Promise<void> {
    runState.reset();
    const selected = await showChoices('选择起始特质', '五个分支随机出现三个。这一项会影响整局。', runState.sampleTraits());
    if (!this.sys.isActive()) return;
    runState.applyUpgrade(selected);
    this.scene.start('Room');
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x090b0d, 0x090b0d, 0x2b1712, 0x140f0d, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(2, COLORS.wallEdge, 0.25);
    for (let index = 0; index < 13; index += 1) {
      const y = 70 + index * 38;
      graphics.lineBetween(0, y, GAME_WIDTH, y + Phaser.Math.Between(-12, 12));
    }
    const skull = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 55, 'player')
      .setScale(5.2).setAlpha(0.09).setTint(COLORS.bone);
    this.tweens.add({ targets: skull, scale: 5.5, alpha: 0.13, yoyo: true, repeat: -1, duration: 1600 });
  }
}
