const TIPPING = 1.5;     // how fast an off-centre needle falls further, per unit off centre
const AGEING = 0.5;      // instability added per second held
const LEAN_RATE = 1.6;   // how fast W/S move the needle back
const NOISE = 0.8;

/** Manual balance needle in [-1, 1]; past either end the rider falls off the back or front */
export class ManualBalance {
  private _value = 0;
  private held = 0;

  constructor(private readonly random: () => number = Math.random) {}

  get value(): number { return this._value; }

  start(): void { this._value = (this.random() - 0.5) * 0.1; this.held = 0; }
  reset(value: number): void { this._value = value; }
  nudge(amount: number): void { this._value += amount; }

  /** lean: -1 (S, back) to 1 (W, forward), same axis as the needle. Returns true when the balance is lost */
  update(dt: number, lean: number): boolean {
    this.held += dt;
    const drift = TIPPING * (1 + this.held * AGEING) * this._value + (this.random() - 0.5) * NOISE;
    this._value += (drift + lean * LEAN_RATE) * dt;
    return Math.abs(this._value) > 1;
  }
}
