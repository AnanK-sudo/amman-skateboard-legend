export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private size = 120;
  private mapRange = 40; // world units shown

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.size;
    this.canvas.height = this.size;
    this.canvas.style.cssText = `
      position: absolute; top: 60px; right: 16px;
      width: ${this.size}px; height: ${this.size}px;
      border: 2px solid rgba(255,107,53,0.4); border-radius: 8px;
      background: rgba(13,13,13,0.6); pointer-events: none;
    `;
    this.ctx = this.canvas.getContext('2d')!;

    const hud = document.getElementById('hud');
    if (hud) hud.appendChild(this.canvas);
  }

  update(playerX: number, playerZ: number, playerYaw: number): void {
    const ctx = this.ctx;
    const s = this.size;
    const half = s / 2;
    const scale = s / (this.mapRange * 2);

    ctx.clearRect(0, 0, s, s);

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 8; i++) {
      const p = (i / 8) * s;
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke();
    }

    // Zone boundary
    ctx.strokeStyle = 'rgba(255,107,53,0.3)';
    ctx.lineWidth = 1;
    const bndSize = 38 * scale * 2; // boundary is +-38
    const bndOffset = half - bndSize / 2;
    ctx.strokeRect(bndOffset, bndOffset, bndSize, bndSize);

    // Player dot
    const px = half + playerX * scale;
    const pz = half + playerZ * scale;

    // Direction arrow
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-playerYaw);
    ctx.fillStyle = '#ff6b35';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Player glow
    ctx.fillStyle = 'rgba(255,107,53,0.3)';
    ctx.beginPath();
    ctx.arc(px, pz, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}
