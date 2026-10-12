import { describe, it, expect } from 'vitest';
import { heldDirection, readTricks } from '@/player/tricks/TrickInput';

function keys(down: string[], pressed: string[] = [], released: string[] = []) {
  return {
    isDown: (c: string) => down.includes(c) || pressed.includes(c),
    justPressed: (c: string) => pressed.includes(c),
    justReleased: (c: string) => released.includes(c),
  };
}

describe('TrickInput', () => {
  it('reads the held direction, with opposites cancelling', () => {
    expect(heldDirection(keys([]))).toBe('none');
    expect(heldDirection(keys(['KeyW', 'KeyA']))).toBe('WA');
    expect(heldDirection(keys(['KeyS', 'KeyD']))).toBe('SD');
    expect(heldDirection(keys(['KeyW', 'KeyS', 'KeyD']))).toBe('D');
  });

  const table: [string[], string, string][] = [
    [[], 'kickflip', 'indy'], [['KeyW'], 'impossible', 'nosegrab'], [['KeyS'], 'heelflip', 'tailgrab'],
    [['KeyA'], 'pop_shove_it', 'melon'], [['KeyD'], 'shove_it_360', 'method'],
    [['KeyW', 'KeyA'], 'varial_flip', 'nosegrab'], [['KeyW', 'KeyD'], 'tre_flip', 'nosegrab'],
    [['KeyS', 'KeyA'], 'hardflip', 'tailgrab'], [['KeyS', 'KeyD'], 'heelflip', 'stalefish'],
  ];
  for (const [dir, flipId, grabId] of table) {
    it(`J and L with ${dir.join('+') || 'no direction'} give ${flipId} and ${grabId}`, () => {
      expect(readTricks(keys(dir, ['KeyJ'])).flip).toBe(flipId);
      expect(readTricks(keys(dir, ['KeyL'])).grab).toBe(grabId);
    });
  }

  it('picks the grind type from the direction held with F', () => {
    expect(readTricks(keys(['KeyF'])).grind).toBe('fifty_fifty');
    expect(readTricks(keys(['KeyF', 'KeyA'])).grind).toBe('boardslide');
    expect(readTricks(keys(['KeyF', 'KeyS', 'KeyD'])).grind).toBe('smith');
    expect(readTricks(keys(['KeyS'])).grind).toBeNull();
  });

  it('starts manuals from Shift, nose manual with W', () => {
    expect(readTricks(keys([], ['ShiftLeft'])).manual).toBe('manual');
    expect(readTricks(keys(['KeyW'], ['ShiftRight'])).manual).toBe('nose_manual');
  });

  it('only fires on the press: holding J does nothing next frame', () => {
    expect(readTricks(keys(['KeyJ'])).flip).toBeNull();
  });

  it('reports a grab release', () => {
    expect(readTricks(keys([], [], ['KeyL'])).grabReleased).toBe(true);
  });
});
