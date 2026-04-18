export class TrickListOverlay {
  private overlay: HTMLDivElement;
  private visible = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(13,13,13,0.9); display: none; flex-direction: column;
      align-items: center; justify-content: center; z-index: 140;
      font-family: Impact, 'Arial Black', sans-serif;
    `;

    const title = document.createElement('div');
    title.textContent = 'TRICK LIST';
    title.style.cssText = `font-size: 36px; color: #ff6b35; letter-spacing: 4px; margin-bottom: 24px;`;
    this.overlay.appendChild(title);

    const tricks = [
      ['Space', 'Ollie', '50'],
      ['J', 'Kickflip', '200'],
      ['K', 'Heelflip', '200'],
      ['J + K', 'Tre Flip', '400'],
      ['Shift', 'Manual', '100'],
      ['F (near rail)', '50-50 Grind', '500'],
      ['L (in air)', 'Grab', '300'],
      ['A/D (in air)', 'Spin', '250-600'],
    ];

    const table = document.createElement('div');
    table.style.cssText = `display: grid; grid-template-columns: 120px 150px 80px; gap: 8px 16px; text-align: left;`;

    // Header
    for (const h of ['KEY', 'TRICK', 'POINTS']) {
      const el = document.createElement('div');
      el.textContent = h;
      el.style.cssText = `font-size: 12px; color: #8b949e; letter-spacing: 2px; border-bottom: 1px solid #333; padding-bottom: 6px;`;
      table.appendChild(el);
    }

    for (const [key, name, pts] of tricks) {
      const keyEl = document.createElement('div');
      keyEl.textContent = key;
      keyEl.style.cssText = `font-size: 16px; color: #3fb950; padding: 4px 0;`;

      const nameEl = document.createElement('div');
      nameEl.textContent = name;
      nameEl.style.cssText = `font-size: 16px; color: #fff; padding: 4px 0;`;

      const ptsEl = document.createElement('div');
      ptsEl.textContent = pts;
      ptsEl.style.cssText = `font-size: 16px; color: #f778ba; padding: 4px 0;`;

      table.appendChild(keyEl);
      table.appendChild(nameEl);
      table.appendChild(ptsEl);
    }

    this.overlay.appendChild(table);

    const hint = document.createElement('div');
    hint.textContent = 'Press T to close';
    hint.style.cssText = `font-size: 12px; color: #555; margin-top: 24px; font-family: monospace;`;
    this.overlay.appendChild(hint);

    document.body.appendChild(this.overlay);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.overlay.style.display = this.visible ? 'flex' : 'none';
  }

  get isVisible(): boolean { return this.visible; }
  hide(): void { this.visible = false; this.overlay.style.display = 'none'; }
}
