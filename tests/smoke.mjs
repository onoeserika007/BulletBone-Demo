import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack ?? error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

await page.goto('http://127.0.0.1:5173', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: '开始狩猎' }).click();
await page.locator('.overlay .card').first().click();
await page.locator('canvas').waitFor({ state: 'visible' });

const canvas = page.locator('canvas');
const box = await canvas.boundingBox();
if (!box) throw new Error('Canvas has no bounding box');
await page.mouse.move(box.x + box.width / 2, box.y + 100);
await page.mouse.down({ button: 'right' });
await page.waitForTimeout(60);
const blocked = await page.evaluate(() => {
  const room = window.__BULLET_BONE_GAME__.scene.getScene('Room');
  const player = room.player;
  return player.resolveIncoming({ id: 999999, sourceX: player.sprite.x, sourceY: player.sprite.y - 100, damage: 1, kind: 'laser' });
});
await page.mouse.up({ button: 'right' });
if (!blocked) throw new Error('Expected incoming attack to be blocked');

for (let step = 0; step < 40; step += 1) {
  if (await page.locator('.result-grid').isVisible()) break;
  const card = page.locator('.overlay .card').first();
  if (await card.isVisible()) {
    await card.click();
    await page.waitForTimeout(350);
    continue;
  }
  await page.evaluate(() => {
    const room = window.__BULLET_BONE_GAME__.scene.getScene('Room');
    if (!room?.sys.isActive() || !room.enemies) return;
    for (const enemy of room.enemies) if (enemy.alive) enemy.takeDamage(99999);
  });
  await page.waitForTimeout(1150);
}

await page.locator('.result-grid').waitFor({ state: 'visible', timeout: 5000 });
await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log('full-run-smoke-ok');
