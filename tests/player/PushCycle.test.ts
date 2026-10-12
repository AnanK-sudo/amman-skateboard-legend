import { describe, it, expect } from 'vitest';
import { PushCycle } from '@/player/anim/PushCycle';

const DT = 1 / 120;

function runToContact(c: PushCycle, speed: number): void {
  for (let i = 0; i < 200 && c.phase !== 'contact'; i++) c.update(DT, speed, true, false);
}

describe('PushCycle', () => {
  it('starts with a reach, then plants the foot', () => {
    const c = new PushCycle();
    expect(c.update(DT, 0, true, false)).toBe(false);
    expect(c.phase).toBe('reach');
    runToContact(c, 0);
    expect(c.phase).toBe('contact');
  });

  it('only thrusts while the foot is on the ground', () => {
    const c = new PushCycle();
    let speed = 2;
    for (let i = 0; i < 600; i++) {
      const thrust = c.update(DT, speed, true, false);
      expect(thrust).toBe(c.phase === 'contact');
    }
  });

  it('slides the planted foot back exactly as far as the board rolls (no foot slip)', () => {
    const c = new PushCycle();
    runToContact(c, 5);
    let rolled = 0;
    let speed = 5;
    while (c.phase === 'contact') {
      speed += 0.02;
      c.update(DT, speed, true, false);
      if (c.phase === 'contact') { rolled += speed * DT; expect(c.contactTravel).toBeCloseTo(rolled, 6); }
    }
  });

  it('makes quicker strokes at higher speed', () => {
    const contactTime = (speed: number) => {
      const c = new PushCycle();
      runToContact(c, speed);
      let t = 0;
      while (c.phase === 'contact') { c.update(DT, speed, true, false); t += DT; }
      return t;
    };
    expect(contactTime(12)).toBeLessThan(contactTime(3) / 2);
  });

  it('does not start a new stroke at max speed', () => {
    const c = new PushCycle();
    c.update(DT, 15, true, true);
    expect(c.phase).toBe('none');
  });

  it('lifts the foot when the key is released mid-stroke, then rests on the board', () => {
    const c = new PushCycle();
    runToContact(c, 4);
    c.update(DT, 4, false, false);
    expect(c.phase).toBe('return');
    for (let i = 0; i < 200; i++) c.update(DT, 4, false, false);
    expect(c.phase).toBe('none');
  });
});
