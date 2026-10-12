export type DeckUnlock =
  | { kind: 'owned' }
  | { kind: 'challenges'; prefix: string; count: number }
  | { kind: 'combo'; points: number }
  | { kind: 'zoneComplete' };

export interface DeckDef {
  id: string;
  name: string;
  wheelColor: number;
  /** Paints the underside graphic; the canvas is long (nose on the left) and short */
  paint(ctx: CanvasRenderingContext2D, w: number, h: number): void;
  unlock: DeckUnlock;
  /** Shown on a locked deck in Customize */
  hint: string;
}

const band = (ctx: CanvasRenderingContext2D, colors: string[], w: number, h: number): void => {
  const step = h / colors.length;
  colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * step, w, step + 1); });
};

const label = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, size: number): void => {
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px Impact, Arial Black, sans-serif`;
  ctx.fillText(text, x, y);
};

export const DECKS: DeckDef[] = [
  {
    id: 'default', name: 'Starter', wheelColor: 0xf2efe6, unlock: { kind: 'owned' }, hint: '',
    paint(ctx, w, h) {
      ctx.fillStyle = '#7d4fc4'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9b72dd'; ctx.fillRect(0, h * 0.42, w, h * 0.16);
      label(ctx, 'AMMAN', w * 0.36, h * 0.62, '#f4e9ff', h * 0.34);
    },
  },
  {
    id: 'citadel', name: 'Citadel', wheelColor: 0xe9c46a, unlock: { kind: 'challenges', prefix: 'park_', count: 3 }, hint: '3 Skate Park challenges',
    paint(ctx, w, h) {
      band(ctx, ['#e8a850', '#e99a4a', '#d9844a', '#c86f45'], w, h);
      ctx.fillStyle = '#f3e6c8';
      // Temple of Hercules columns on a base
      ctx.fillRect(w * 0.25, h * 0.78, w * 0.5, h * 0.08);
      for (let i = 0; i < 6; i++) ctx.fillRect(w * (0.28 + i * 0.08), h * 0.2, w * 0.035, h * 0.58);
      ctx.fillRect(w * 0.26, h * 0.14, w * 0.48, h * 0.07);
    },
  },
  {
    id: 'rainbow', name: 'Rainbow Street', wheelColor: 0x2a9d8f, unlock: { kind: 'challenges', prefix: 'street_', count: 3 }, hint: '3 Street Spot challenges',
    paint(ctx, w, h) {
      ctx.fillStyle = '#1d3557'; ctx.fillRect(0, 0, w, h);
      const colors = ['#e9c46a', '#f4a261', '#e76f51', '#2a9d8f', '#a8dadc', '#f1faee'];
      for (let i = 0; i < 18; i++) {
        const bw = w / 18;
        const bh = h * (0.3 + ((i * 37) % 50) / 100);
        ctx.fillStyle = colors[i % colors.length];
        ctx.fillRect(i * bw, h - bh, bw - 2, bh);
        ctx.fillStyle = '#1d3557';
        ctx.fillRect(i * bw + bw * 0.3, h - bh + bh * 0.2, bw * 0.3, bh * 0.15);
      }
    },
  },
  {
    id: 'jasmine', name: 'Jasmine', wheelColor: 0xffffff, unlock: { kind: 'combo', points: 1500 }, hint: 'Cash a 1500-point combo',
    paint(ctx, w, h) {
      ctx.fillStyle = '#2d6a4f'; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#95d5b2'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, h / 2);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h / 2 + Math.sin(x / 28) * h * 0.25);
      ctx.stroke();
      ctx.fillStyle = '#fefae0';
      for (let x = 20; x < w; x += 46) {
        const y = h / 2 + Math.sin(x / 28) * h * 0.25;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath(); ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    },
  },
  {
    id: 'desert', name: 'Desert Sun', wheelColor: 0xe76f51, unlock: { kind: 'challenges', prefix: 'amman_', count: 5 }, hint: '5 Old Amman challenges',
    paint(ctx, w, h) {
      band(ctx, ['#3d1f4a', '#7a2e4f', '#c4534a', '#ee964b'], w, h * 0.7);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath(); ctx.arc(w * 0.5, h * 0.62, h * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b5562f';
      ctx.beginPath(); ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 10) ctx.lineTo(x, h * 0.7 - Math.sin(x / 70) * h * 0.12);
      ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
    },
  },
  {
    id: 'graffiti', name: 'Graffiti', wheelColor: 0x06d6a0, unlock: { kind: 'zoneComplete' }, hint: 'Every challenge in one zone',
    paint(ctx, w, h) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
      const colors = ['#ff006e', '#fb5607', '#ffbe0b', '#3a86ff', '#8338ec', '#06d6a0'];
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath(); ctx.arc((i * 97) % w, (i * 53) % h, 4 + (i % 5) * 3, 0, Math.PI * 2); ctx.fill();
      }
      label(ctx, 'WALLAH', w * 0.3, h * 0.66, '#ffbe0b', h * 0.42);
    },
  },
];

export function deckById(id: string): DeckDef {
  return DECKS.find(d => d.id === id) ?? DECKS[0];
}
