import { Customization, PRESET_STYLES } from '@/player/Customization';
import type { Stance } from '@/player/anim/mirror';
import type { DeckDef } from '@/world/decks';

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

  private deckRow: HTMLDivElement | null = null;
  private deckState: { decks: DeckDef[]; owned: () => string[]; equipped: string; onPick: (id: string) => void } | null = null;

  /** Deck picker: locked decks show how to earn them and cannot be picked */
  addDeckRow(decks: DeckDef[], owned: () => string[], equipped: string, onPick: (id: string) => void): void {
    this.deckState = { decks, owned, equipped, onPick };
    this.deckRow = document.createElement('div');
    this.deckRow.style.cssText = `display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 620px; margin-top: 14px;`;
    this.overlay.insertBefore(this.deckRow, this.overlay.lastElementChild);
    this.refreshDecks();
  }

  refreshDecks(): void {
    if (!this.deckRow || !this.deckState) return;
    const st = this.deckState;
    this.deckRow.replaceChildren();
    for (const d of st.decks) {
      const unlocked = st.owned().includes(d.id);
      const btn = document.createElement('button');
      btn.textContent = unlocked ? d.name.toUpperCase() : `LOCKED: ${d.hint}`;
      btn.disabled = !unlocked;
      const active = d.id === st.equipped;
      btn.style.cssText = `
        padding: 8px 14px; font-family: Impact, sans-serif; font-size: 13px; letter-spacing: 1px;
        border-radius: 4px; cursor: ${unlocked ? 'pointer' : 'not-allowed'};
        border: 2px solid ${active ? '#3fb950' : unlocked ? '#ff6b35' : '#444'};
        background: ${active ? '#3fb950' : 'transparent'}; color: ${active ? '#0d0d0d' : unlocked ? '#ff6b35' : '#666'};
      `;
      btn.addEventListener('click', () => {
        if (!unlocked) return;
        st.equipped = d.id;
        st.onPick(d.id);
        this.refreshDecks();
      });
      this.deckRow.appendChild(btn);
    }
  }

  /** Regular rides left foot forward, goofy right foot forward */
  addStanceToggle(initial: Stance, onChange: (stance: Stance) => void): void {
    let stance = initial;
    const btn = document.createElement('button');
    const label = () => { btn.textContent = `STANCE: ${stance.toUpperCase()}`; };
    label();
    btn.style.cssText = `
      margin-top: 16px; padding: 10px 28px; font-family: Impact, sans-serif; font-size: 16px;
      letter-spacing: 2px; cursor: pointer; border: 2px solid #ff6b35; border-radius: 4px;
      background: transparent; color: #ff6b35;
    `;
    btn.addEventListener('click', () => {
      stance = stance === 'regular' ? 'goofy' : 'regular';
      label();
      onChange(stance);
    });
    // Sits above the DONE button
    this.overlay.insertBefore(btn, this.overlay.lastElementChild);
  }

  show(): void { this.overlay.style.display = 'flex'; this.visible = true; }
  hide(): void { this.overlay.style.display = 'none'; this.visible = false; }
  get isVisible(): boolean { return this.visible; }
}
