export class SlowMo {
  private active = false;
  private timer = 0;
  private duration = 0;
  private _timeScale = 1;

  get timeScale(): number { return this._timeScale; }
  get isActive(): boolean { return this.active; }

  trigger(duration = 0.5): void {
    this.active = true;
    this.timer = 0;
    this.duration = duration;
    this._timeScale = 0.3; // 30% speed
  }

  update(delta: number): void {
    if (!this.active) {
      this._timeScale = 1;
      return;
    }

    this.timer += delta; // use real delta, not scaled

    // Ease back to normal speed
    const t = this.timer / this.duration;
    if (t >= 1) {
      this.active = false;
      this._timeScale = 1;
    } else {
      // Smooth ease from 0.3 to 1.0
      this._timeScale = 0.3 + 0.7 * (t * t); // quadratic ease-in
    }
  }
}
