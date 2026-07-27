import Phaser from 'phaser';
import { COLORS } from '../config/demoConfig';

const generate = (
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (graphics: Phaser.GameObjects.Graphics) => void,
): void => {
  if (scene.textures.exists(key)) return;
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
};

export const ensureTextures = (scene: Phaser.Scene): void => {
  generate(scene, 'player', 48, 48, (g) => {
    g.fillStyle(0x241e1b).fillCircle(24, 24, 21);
    g.lineStyle(3, COLORS.bone).strokeCircle(24, 24, 19);
    g.fillStyle(COLORS.bone).fillCircle(24, 22, 13);
    g.fillStyle(0x161719).fillCircle(19, 20, 4).fillCircle(29, 20, 4);
    g.fillTriangle(24, 24, 20, 31, 28, 31);
    g.lineStyle(2, 0x161719).lineBetween(18, 34, 30, 34);
  });
  generate(scene, 'melee', 44, 44, (g) => {
    g.fillStyle(0x341b17).fillCircle(22, 22, 20);
    g.lineStyle(3, COLORS.rust).strokeCircle(22, 22, 18);
    g.fillStyle(0xe07a43).fillTriangle(8, 13, 16, 4, 18, 17).fillTriangle(36, 13, 28, 4, 26, 17);
    g.fillStyle(0xffcf80).fillCircle(16, 21, 3).fillCircle(28, 21, 3);
  });
  generate(scene, 'ranged', 46, 46, (g) => {
    g.fillStyle(0x242020).fillCircle(23, 23, 20);
    g.lineStyle(3, 0xd79d48).strokeCircle(23, 23, 18);
    g.fillStyle(0xffe09b).fillRect(9, 19, 28, 8);
    g.fillStyle(COLORS.enemyLaser).fillCircle(23, 23, 4);
  });
  generate(scene, 'boss', 96, 96, (g) => {
    g.fillStyle(0x1c1717).fillCircle(48, 48, 43);
    g.lineStyle(5, COLORS.rust).strokeCircle(48, 48, 40);
    g.fillStyle(0x6f3326).fillRect(14, 30, 68, 34);
    g.fillStyle(COLORS.gold).fillCircle(34, 43, 7).fillCircle(62, 43, 7);
    g.fillStyle(0x111214).fillCircle(34, 43, 3).fillCircle(62, 43, 3);
    g.lineStyle(4, COLORS.bone).lineBetween(28, 70, 68, 70);
  });
  generate(scene, 'laser-bolt', 30, 8, (g) => {
    g.fillStyle(0xffffff, 0.35).fillRect(0, 0, 30, 8);
    g.fillStyle(COLORS.playerLaser).fillRect(2, 2, 26, 4);
  });
  generate(scene, 'gravity-orb', 30, 30, (g) => {
    g.fillStyle(0x1a102c).fillCircle(15, 15, 14);
    g.lineStyle(3, COLORS.gravity).strokeCircle(15, 15, 12);
    g.fillStyle(0xf3d5ff).fillCircle(15, 15, 4);
  });
  generate(scene, 'rage-shard', 24, 30, (g) => {
    g.fillStyle(COLORS.boneBright).fillTriangle(12, 0, 23, 14, 12, 30);
    g.fillTriangle(12, 0, 1, 14, 12, 30);
    g.lineStyle(2, COLORS.gold).lineBetween(12, 3, 12, 27);
  });
  generate(scene, 'spark', 8, 8, (g) => {
    g.fillStyle(COLORS.boneBright).fillCircle(4, 4, 4);
  });
};
