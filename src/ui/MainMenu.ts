export interface MainMenuCallbacks {
  onPlay: () => void;
}

export class MainMenu {
  private overlay: HTMLDivElement;

  constructor(callbacks: MainMenuCallbacks) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #0d0d0d;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 200;
      gap: 16px;
    `;

    const title = document.createElement('div');
    title.textContent = 'ANAN SKATE';
    title.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: 72px;
      color: #ff6b35;
      text-shadow: 4px 4px 0px #7b2d8b, 8px 8px 0px rgba(123, 45, 139, 0.4);
      transform: rotate(-2deg);
      text-transform: uppercase;
      line-height: 1;
    `;

    const subtitle = document.createElement('div');
    subtitle.textContent = 'AMMAN STREETS';
    subtitle.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: 24px;
      color: #888888;
      letter-spacing: 6px;
      text-transform: uppercase;
      margin-bottom: 48px;
    `;

    const playBtn = document.createElement('button');
    playBtn.textContent = 'PLAY';
    playBtn.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: 24px;
      color: #0d0d0d;
      background: #ff6b35;
      border: none;
      padding: 16px 60px;
      cursor: pointer;
      letter-spacing: 4px;
      text-transform: uppercase;
      transition: background 0.15s ease, transform 0.1s ease;
    `;

    playBtn.addEventListener('mouseenter', () => {
      playBtn.style.background = '#ff8c5a';
      playBtn.style.transform = 'scale(1.05)';
    });

    playBtn.addEventListener('mouseleave', () => {
      playBtn.style.background = '#ff6b35';
      playBtn.style.transform = 'scale(1)';
    });

    playBtn.addEventListener('click', () => {
      this.hide();
      callbacks.onPlay();
    });

    const hint = document.createElement('div');
    hint.textContent = 'WASD to move \u2022 Space to ollie \u2022 Mouse to look';
    hint.style.cssText = `
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      color: #555555;
      margin-top: 48px;
      text-transform: uppercase;
      letter-spacing: 1px;
    `;

    this.overlay.appendChild(title);
    this.overlay.appendChild(subtitle);
    this.overlay.appendChild(playBtn);
    this.overlay.appendChild(hint);

    document.body.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
