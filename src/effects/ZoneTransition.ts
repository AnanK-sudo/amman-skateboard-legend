export class ZoneTransition {
  private overlay: HTMLDivElement;
  private nameEl: HTMLDivElement;
  private active = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: #0d0d0d; display: none; align-items: center; justify-content: center;
      flex-direction: column; z-index: 50; pointer-events: none;
      transition: opacity 0.4s ease;
    `;

    this.nameEl = document.createElement('div');
    this.nameEl.style.cssText = `
      font-family: Impact, 'Arial Black', sans-serif;
      font-size: 48px; color: #ff6b35; letter-spacing: 6px;
      text-transform: uppercase; transform: rotate(-3deg);
      text-shadow: 3px 3px 0 rgba(0,0,0,0.5);
    `;

    this.overlay.appendChild(this.nameEl);
    document.body.appendChild(this.overlay);
  }

  play(zoneName: string): Promise<void> {
    return new Promise((resolve) => {
      this.nameEl.textContent = zoneName;
      this.overlay.style.display = 'flex';
      this.overlay.style.opacity = '1';
      this.active = true;

      // Hold for 1 second, then fade out
      setTimeout(() => {
        this.overlay.style.opacity = '0';
        setTimeout(() => {
          this.overlay.style.display = 'none';
          this.active = false;
          resolve();
        }, 400);
      }, 800);
    });
  }

  get isActive(): boolean { return this.active; }
}
