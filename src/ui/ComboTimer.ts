export class ComboTimer {
  private bar: HTMLDivElement;
  private fill: HTMLDivElement;
  private container: HTMLDivElement;
  private maxTime = 3; // seconds before combo auto-expires
  private _timeLeft = 0;
  private _active = false;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.cssText = `
      position: absolute; bottom: 60px; left: 50%; transform: translateX(-50%);
      width: 200px; display: none; pointer-events: none;
    `;

    const label = document.createElement('div');
    label.textContent = 'COMBO';
    label.style.cssText = `
      font-family: Impact, sans-serif; font-size: 10px; color: #f778ba;
      letter-spacing: 2px; text-align: center; margin-bottom: 4px;
    `;

    this.bar = document.createElement('div');
    this.bar.style.cssText = `
      width: 100%; height: 6px; background: rgba(255,255,255,0.1);
      border-radius: 3px; overflow: hidden;
    `;

    this.fill = document.createElement('div');
    this.fill.style.cssText = `
      width: 100%; height: 100%; border-radius: 3px;
      background: linear-gradient(to right, #f778ba, #ff6b35);
      transition: width 0.1s linear;
    `;

    this.bar.appendChild(this.fill);
    this.container.appendChild(label);
    this.container.appendChild(this.bar);

    const hud = document.getElementById('hud');
    if (hud) hud.appendChild(this.container);
  }

  start(): void {
    this._timeLeft = this.maxTime;
    this._active = true;
    this.container.style.display = 'block';
  }

  extend(seconds = 1.5): void {
    this._timeLeft = Math.min(this._timeLeft + seconds, this.maxTime);
  }

  stop(): void {
    this._active = false;
    this.container.style.display = 'none';
  }

  get active(): boolean { return this._active; }
  get expired(): boolean { return this._active && this._timeLeft <= 0; }

  update(delta: number): void {
    if (!this._active) return;
    this._timeLeft -= delta;
    const ratio = Math.max(0, this._timeLeft / this.maxTime);
    this.fill.style.width = `${ratio * 100}%`;

    // Color shift as time runs out
    if (ratio < 0.3) {
      this.fill.style.background = '#ff0000';
    } else if (ratio < 0.6) {
      this.fill.style.background = 'linear-gradient(to right, #ff0000, #ff6b35)';
    } else {
      this.fill.style.background = 'linear-gradient(to right, #f778ba, #ff6b35)';
    }
  }
}
