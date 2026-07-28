export interface ChoiceOption {
  id: string;
  title: string;
  description: string;
  tag?: string;
}

const root = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>('#overlay-root');
  if (!element) throw new Error('Missing #overlay-root');
  return element;
};

export const clearOverlay = (): void => {
  root().replaceChildren();
};

export const showChoices = (
  title: string,
  subtitle: string,
  options: ChoiceOption[],
): Promise<string> => new Promise((resolve) => {
  const panel = document.createElement('section');
  panel.className = 'overlay';
  panel.innerHTML = `<h2>${title}</h2><p class="subtitle">${subtitle}</p><div class="cards"></div>`;
  const cards = panel.querySelector<HTMLElement>('.cards');
  if (!cards) throw new Error('Failed to create cards');

  for (const option of options) {
    const button = document.createElement('button');
    button.className = 'card';
    button.innerHTML = `<strong>${option.title}</strong><span>${option.description}</span><em>${option.tag ?? '选择'}</em>`;
    button.addEventListener('click', () => {
      clearOverlay();
      resolve(option.id);
    }, { once: true });
    cards.append(button);
  }

  root().replaceChildren(panel);
});

export const showMenu = (onStart: () => void): void => {
  const panel = document.createElement('section');
  panel.className = 'overlay';
  panel.innerHTML = `
    <h1>BULLET BONE</h1>
    <p class="subtitle">骨塔传说 · 接住攻击，点燃狂暴，把整间房轰成废铁。</p>
    <div class="controls">
      <span><kbd>WASD</kbd> 移动</span><span><kbd>鼠标</kbd> 瞄准</span><span><kbd>左键</kbd> 射击</span>
      <span><kbd>右键</kbd> 格挡反击</span><span><kbd>Shift</kbd> 翻滚闪避</span><span><kbd>1 / 2</kbd> 切枪</span><span><kbd>ESC</kbd> 暂停</span>
    </div>
    <button class="primary-button">开始狩猎</button>`;
  panel.querySelector('button')?.addEventListener('click', () => {
    clearOverlay();
    onStart();
  }, { once: true });
  root().replaceChildren(panel);
};

export interface ResultData {
  victory: boolean;
  kills: number;
  blocks: number;
  rageCount: number;
  seconds: number;
}

export const showResult = (data: ResultData, onRestart: () => void): void => {
  const panel = document.createElement('section');
  panel.className = 'overlay';
  panel.innerHTML = `
    <h1>${data.victory ? 'WASTELAND CLEARED' : 'BONES BROKEN'}</h1>
    <p class="subtitle">${data.victory ? '废土暂时安静了。骨头里的火还没有熄灭。' : '骨头会重组。下一次，把那束光砸回去。'}</p>
    <div class="result-grid">
      <div><b>${data.kills}</b>击杀</div><div><b>${data.blocks}</b>格挡</div>
      <div><b>${data.rageCount}</b>狂暴</div><div><b>${Math.ceil(data.seconds)}s</b>耗时</div>
    </div>
    <button class="primary-button">再来一局</button>`;
  panel.querySelector('button')?.addEventListener('click', () => {
    clearOverlay();
    onRestart();
  }, { once: true });
  root().replaceChildren(panel);
};
