export interface EngineCallbacks {
  update: (delta: number) => void;
  render: () => void;
}

export class Engine {
  private callbacks: EngineCallbacks;
  private paused = false;
  private _elapsed = 0;
  private maxDelta = 0.1;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  get elapsed(): number { return this._elapsed; }

  tick(deltaMs: number): void {
    if (this.paused) return;
    const delta = Math.min(deltaMs / 1000, this.maxDelta);
    this._elapsed += delta;
    this.callbacks.update(delta);
    this.callbacks.render();
  }

  pause(): void { this.paused = true; }
  resume(): void { this.paused = false; }

  start(): void {
    let lastTime = performance.now();
    const loop = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      this.tick(deltaMs);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
