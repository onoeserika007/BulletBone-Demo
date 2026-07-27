import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => {
  const text = `pageerror: ${error.stack ?? error.message}`;
  errors.push(text);
  console.log(text);
});
page.on('console', (message) => {
  if (message.type() === 'error') {
    const text = `console: ${message.text()}`;
    errors.push(text);
    console.log(text);
  }
});

const chooseFirst = async () => {
  await page.locator('.overlay .card').first().waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('.overlay .card').first().click();
  await page.waitForTimeout(350);
};

const killCurrentRoom = async () => {
  await page.waitForFunction(() => {
    const game = window.__BULLET_BONE_GAME__;
    const room = game?.scene.getScene('Room');
    return Boolean(room?.sys.isActive() && room.enemies?.some((enemy) => enemy.alive));
  });
  await page.evaluate(() => {
    const room = window.__BULLET_BONE_GAME__.scene.getScene('Room');
    for (const enemy of room.enemies) if (enemy.alive) enemy.takeDamage(99999);
  });
};

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '开始狩猎' }).click();
await chooseFirst();

const canvas = page.locator('canvas');
const box = await canvas.boundingBox();
if (!box) throw new Error('Canvas has no bounding box');
await page.mouse.move(box.x + box.width / 2, box.y + 100);
await page.mouse.down({ button: 'left' });
await page.waitForTimeout(280);
await page.mouse.up({ button: 'left' });
await page.keyboard.down('KeyD');
await page.waitForTimeout(160);
await page.keyboard.up('KeyD');
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(60);
const blocked = await page.evaluate(() => {
  const room = window.__BULLET_BONE_GAME__.scene.getScene('Room');
  const player = room.player;
  return player.resolveIncoming({ id: 999999, sourceX: player.sprite.x, sourceY: player.sprite.y - 100, damage: 1, kind: 'laser' });
});
await page.mouse.up({ button: 'right' });
if (!blocked) throw new Error('Expected incoming attack to be blocked');
await page.waitForTimeout(500);

await killCurrentRoom();
await chooseFirst();
await chooseFirst();
await killCurrentRoom();
await chooseFirst();
await chooseFirst();
await killCurrentRoom();
await chooseFirst();
await killCurrentRoom();

await page.locator('.result-grid').waitFor({ state: 'visible', timeout: 5000 });
await page.screenshot({ path: 'test-artifacts/full-run-result.png' });
await browser.close();

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('full-run-smoke-ok');
