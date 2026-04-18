export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
  onCustomize?: () => void;
}

export class PauseMenu {
  private overlay: HTMLDivElement;
  private statsEl: HTMLDivElement;
  private visible: boolean = false;

  constructor(callbacks: PauseMenuCallbacks) {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(13, 13, 13, 0.85); display: none; flex-direction: column;
      align-items: center; justify-content: center; z-index: 100; gap: 16px;
    `;

    const title = document.createElement('div');
    title.textContent = 'PAUSED';
    title.style.cssText = `
      font-family: Impact, 'Arial Narrow', sans-serif; font-size: 48px;
      color: #ff6b35; letter-spacing: 6px; margin-bottom: 16px;
    `;

    // Session stats display
    this.statsEl = document.createElement('div');
    this.statsEl.style.cssText = `
      font-family: 'Courier New', monospace; font-size: 13px; color: #8b949e;
      text-align: center; line-height: 1.8; margin-bottom: 20px;
      background: rgba(255,255,255,0.05); padding: 12px 24px; border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.1);
    `;

    const resumeBtn = this.createButton('RESUME', () => { this.hide(); callbacks.onResume(); });
    const customizeBtn = this.createButton('CUSTOMIZE', () => {
      this.hide();
      if ((callbacks as any).onCustomize) (callbacks as any).onCustomize();
    });
    const restartBtn = this.createButton('RESTART', () => { this.hide(); callbacks.onRestart(); });
    const quitBtn = this.createButton('QUIT TO MENU', () => { this.hide(); callbacks.onQuitToMenu(); });

    this.overlay.appendChild(title);
    this.overlay.appendChild(this.statsEl);
    this.overlay.appendChild(resumeBtn);
    this.overlay.appendChild(customizeBtn);
    this.overlay.appendChild(restartBtn);
    this.overlay.appendChild(quitBtn);

    document.body.appendChild(this.overlay);
  }

  updateStats(stats: { totalTricks: number; bestCombo: number; totalScore: number; timePlayedMs: number; bails: number }): void {
    const mins = Math.floor(stats.timePlayedMs / 60000);
    const secs = Math.floor((stats.timePlayedMs % 60000) / 1000);
    this.statsEl.innerHTML = `
      <span style="color:#ff6b35">TRICKS:</span> ${stats.totalTricks} &nbsp;|&nbsp;
      <span style="color:#f778ba">BEST COMBO:</span> ${stats.bestCombo.toLocaleString()} &nbsp;|&nbsp;
      <span style="color:#3fb950">SCORE:</span> ${stats.totalScore.toLocaleString()}<br>
      <span style="color:#58a6ff">TIME:</span> ${mins}:${secs.toString().padStart(2, '0')} &nbsp;|&nbsp;
      <span style="color:#d2a8ff">BAILS:</span> ${stats.bails}
    `;
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
