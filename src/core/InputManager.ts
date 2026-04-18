export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressedKeys = new Set<string>();
  private justReleasedKeys = new Set<string>();
  private _mouseDelta = { x: 0, y: 0 };
  private target: EventTarget | null = null;

  private onKeyDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (!this.keys.get(code)) this.justPressedKeys.add(code);
    this.keys.set(code, true);
  };

  private onKeyUp = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    this.keys.set(code, false);
    this.justReleasedKeys.add(code);
  };

  private onMouseMove = (e: Event) => {
    const me = e as MouseEvent;
    this._mouseDelta.x += me.movementX;
    this._mouseDelta.y += me.movementY;
  };

  attach(target: EventTarget): void {
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousemove', this.onMouseMove);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousemove', this.onMouseMove);
    this.target = null;
    this.keys.clear();
  }

  isDown(code: string): boolean { return this.keys.get(code) === true; }
  justPressed(code: string): boolean { return this.justPressedKeys.has(code); }
  justReleased(code: string): boolean { return this.justReleasedKeys.has(code); }
  get mouseDelta(): { x: number; y: number } { return this._mouseDelta; }

  update(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
  }
}
