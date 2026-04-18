import { Customization, PRESET_STYLES } from '@/player/Customization';

export class CustomizeMenu {
  private overlay: HTMLDivElement;
  private visible = false;
  private customization: Customization;
  private onApply: () => void;

  private onClose: (() => void) | null = null;

  setOnClose(cb: () => void): void { this.onClose = cb; }

  constructor(customization: Customization, onApply: () => void) {
    this.customization = customization;
    this.onApply = onApply;

    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(13,13,13,0.92); display: none; flex-direction: column;
      align-items: center; justify-content: center; z-index: 150; gap: 12px;
      font-family: Impact, 'Arial Black', sans-serif;
    `;

    const title = document.createElement('div');
    title.textContent = 'CUSTOMIZE';
    title.style.cssText = `font-size: 42px; color: #ff6b35; letter-spacing: 4px; margin-bottom: 20px;`;
    this.overlay.appendChild(title);

    // Preset buttons
    const presetGrid = document.createElement('div');
    presetGrid.style.cssText = `display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; max-width: 500px;`;

    for (const name of Object.keys(PRESET_STYLES)) {
      const style = PRESET_STYLES[name];
      const btn = document.createElement('button');
      btn.textContent = name.toUpperCase();
      btn.style.cssText = `
        padding: 10px 20px; font-family: Impact, sans-serif; font-size: 14px;
        letter-spacing: 2px; cursor: pointer; border: 2px solid #ff6b35;
        border-radius: 4px; background: transparent; color: #ff6b35;
        transition: all 0.15s;
      `;

      // Color preview dot
      const dot = document.createElement('span');
      dot.style.cssText = `
        display: inline-block; width: 12px; height: 12px; border-radius: 50%;
        background: #${style.shirtColor.toString(16).padStart(6, '0')};
        margin-right: 8px; vertical-align: middle;
      `;
      btn.prepend(dot);

      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#ff6b35';
        btn.style.color = '#0d0d0d';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'transparent';
        btn.style.color = '#ff6b35';
      });
      btn.addEventListener('click', () => {
        this.customization.setPreset(name);
        this.onApply();
      });

      presetGrid.appendChild(btn);
    }
    this.overlay.appendChild(presetGrid);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'DONE';
    closeBtn.style.cssText = `
      margin-top: 24px; padding: 12px 40px; font-family: Impact, sans-serif;
      font-size: 18px; color: #0d0d0d; background: #3fb950; border: none;
      border-radius: 4px; cursor: pointer; letter-spacing: 3px;
    `;
    closeBtn.addEventListener('click', () => {
      this.hide();
      if (this.onClose) this.onClose();
    });
    this.overlay.appendChild(closeBtn);

    document.body.appendChild(this.overlay);
  }

  show(): void { this.overlay.style.display = 'flex'; this.visible = true; }
  hide(): void { this.overlay.style.display = 'none'; this.visible = false; }
  get isVisible(): boolean { return this.visible; }
}
