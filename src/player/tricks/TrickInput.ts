import { trickFor, type Dir, type Family } from './catalog';

export interface Keys {
  isDown(code: string): boolean;
  justPressed(code: string): boolean;
  justReleased(code: string): boolean;
}

export interface TrickPresses {
  flip: string | null;
  grab: string | null;
  grabReleased: boolean;
  /** Grind type for the direction held right now, while F is held; read at lock-on */
  grind: string | null;
  manual: string | null;
}

export function heldDirection(k: Keys): Dir {
  const v = (k.isDown('KeyW') ? 1 : 0) - (k.isDown('KeyS') ? 1 : 0);
  const h = (k.isDown('KeyD') ? 1 : 0) - (k.isDown('KeyA') ? 1 : 0);
  const vs = v > 0 ? 'W' : v < 0 ? 'S' : '';
  const hs = h > 0 ? 'D' : h < 0 ? 'A' : '';
  return ((vs + hs) || 'none') as Dir;
}

/** Empty table cells fall back to the vertical part of the direction, then the horizontal, then none */
function pick(family: Family, dir: Dir): string | null {
  const tries: Dir[] = dir.length === 2 ? [dir, dir[0] as Dir, dir[1] as Dir, 'none'] : [dir, 'none'];
  for (const d of tries) {
    const t = trickFor(family, d);
    if (t) return t.id;
  }
  return null;
}

export function readTricks(k: Keys): TrickPresses {
  const dir = heldDirection(k);
  const shift = k.justPressed('ShiftLeft') || k.justPressed('ShiftRight');
  return {
    flip: k.justPressed('KeyJ') ? pick('flip', dir) : null,
    grab: k.justPressed('KeyL') ? pick('grab', dir) : null,
    grabReleased: k.justReleased('KeyL'),
    grind: k.isDown('KeyF') ? pick('grind', dir) : null,
    manual: shift ? (dir.startsWith('W') ? 'nose_manual' : 'manual') : null,
  };
}
