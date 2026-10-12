export type PushPhase = 'none' | 'reach' | 'contact' | 'return';

const REACH_TIME  = 0.22;
const RETURN_TIME = 0.25;
const STRIDE_SLOW = 0.6;
const STRIDE_FAST = 0.9;
const STRIDE_SPEED = 15;

export class PushCycle {
  private _phase: PushPhase = 'none';
  private _phaseT = 0;
  private _contactTravel = 0;
  private _stride = STRIDE_SLOW;

  get phase(): PushPhase { return this._phase; }
  /** 0 to 1 through reach or return */
  get phaseT(): number { return this._phaseT; }
  /** Metres the board has rolled since the foot was planted; the foot sits this far behind its plant point */
  get contactTravel(): number { return this._contactTravel; }
  get stride(): number { return this._stride; }

  /** Advances the cycle; returns true when the push foot is driving the board this frame */
  update(dt: number, speed: number, wantPush: boolean, atMax: boolean): boolean {
    switch (this._phase) {
      case 'none':
        if (wantPush && !atMax) { this._phase = 'reach'; this._phaseT = 0; }
        return false;

      case 'reach':
        this._phaseT += dt / REACH_TIME;
        if (!wantPush) { this._phase = 'return'; this._phaseT = 1 - Math.min(this._phaseT, 1); return false; }
        if (this._phaseT >= 1) {
          this._phase = 'contact';
          this._contactTravel = 0;
          this._stride = STRIDE_SLOW + (STRIDE_FAST - STRIDE_SLOW) * Math.min(speed / STRIDE_SPEED, 1);
          return true;
        }
        return false;

      case 'contact':
        if (!wantPush) { this._phase = 'return'; this._phaseT = 0; return false; }
        this._contactTravel += speed * dt;
        if (this._contactTravel >= this._stride) { this._phase = 'return'; this._phaseT = 0; return false; }
        return true;

      case 'return':
        this._phaseT += dt / RETURN_TIME;
        if (this._phaseT >= 1) { this._phase = 'none'; this._phaseT = 0; }
        return false;
    }
  }
}
