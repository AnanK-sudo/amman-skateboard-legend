export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
}

export class PauseMenu {
  private overlay: HTMLDivElement;
  private visible: boolean = false;

  constructor(callbacks: PauseMenuCallbacks) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(13, 13, 13, 0.85);
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 100;
      gap: 16px;
    `;

    const title = document.createElement('div');
    title.textContent = 'PAUSED';
    title.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: 48px;
      color: #ff6b35;
      letter-spacing: 6px;
      margin-bottom: 32px;
      text-transform: uppercase;
    `;

    const resumeBtn = this.createButton('RESUME', () => {
      this.hide();
      callbacks.onResume();
    });

    const restartBtn = this.createButton('RESTART', () => {
      this.hide();
      callbacks.onRestart();
    });

    const quitBtn = this.createButton('QUIT TO MENU', () => {
      this.hide();
      callbacks.onQuitToMenu();
    });

    this.overlay.appendChild(title);
    this.overlay.appendChild(resumeBtn);
    this.overlay.appendChild(restartBtn);
    this.overlay.appendChild(quitBtn);

    document.body.appendChild(this.overlay);
  }

  private createButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.style.cssText = `
      width: 200px;
      padding: 12px;
      font-family: Impact, 'Arial Narrow', sans-serif;
      font-size: 18px;
      letter-spacing: 3px;
      color: #ff6b35;
      background: transparent;
      border: 2px solid #ff6b35;
      cursor: pointer;
      text-transform: uppercase;
      transition: background 0.15s ease;
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#ff6b35';
      btn.style.color = '#0d0d0d';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'transparent';
      btn.style.color = '#ff6b35';
    });

    btn.addEventListener('click', onClick);

    return btn;
  }

  show(): void {
    this.overlay.style.display = 'flex';
    this.visible = true;
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
