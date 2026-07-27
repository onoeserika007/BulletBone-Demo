import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config/demoConfig';
import { runState } from '../run/RunState';
import { clearOverlay, showResult } from '../ui/Overlay';

export class ResultScene extends Phaser.Scene {
  public constructor() {
    super('Result');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(runState.hp > 0 ? 0x17130f : 0x170c0c);
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x080a0b, 0x080a0b, runState.hp > 0 ? 0x3a2616 : 0x351313, 0x120d0c, 1)
      .fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, clearOverlay);
    showResult({
      victory: runState.hp > 0,
      kills: runState.kills,
      blocks: runState.blocks,
      rageCount: runState.rageCount,
      seconds: runState.elapsedSeconds,
    }, () => this.scene.start('Menu'));
  }
}
