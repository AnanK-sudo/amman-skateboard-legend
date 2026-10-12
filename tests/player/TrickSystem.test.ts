import { describe, it, expect, beforeEach } from 'vitest';
import { TrickSystem } from '@/player/TrickSystem';

const air = (over: Partial<{ airTricks: string[]; halfTurns: number; grabTicks: number; ollied: boolean }> = {}) =>
  ({ airTricks: [], halfTurns: 0, grabTicks: 0, ollied: false, ...over });

describe('TrickSystem', () => {
  let tricks: TrickSystem;
  beforeEach(() => { tricks = new TrickSystem(); });

  it('starts with no active combo', () => {
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
    expect(tricks.comboMultiplier).toBe(0);
  });

  it('chains tricks with a growing multiplier', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('fifty_fifty');
    expect(tricks.comboMultiplier).toBe(2);
    expect(tricks.comboScore).toBe((200 + 500) * 2);
    expect(tricks.comboChain).toEqual(['Kickflip', '50-50']);
  });

  it('scores a repeated trick at half each time instead of rejecting it', () => {
    tricks.landTrick('kickflip');
    expect(tricks.landTrick('kickflip').points).toBe(100);
    expect(tricks.landTrick('kickflip').points).toBe(50);
    expect(tricks.comboMultiplier).toBe(3);
  });

  it('bail and cash out reset the combo', () => {
    tricks.landTrick('kickflip');
    expect(tricks.bail()).toBe(0);
    expect(tricks.comboActive).toBe(false);
    tricks.landTrick('kickflip');
    tricks.landTrick('nosegrind');
    expect(tricks.cashOut()).toBe((200 + 600) * 2);
    expect(tricks.comboScore).toBe(0);
  });

  it('every catalog trick has a base score', () => {
    for (const id of ['ollie', 'kickflip', 'impossible', 'hardflip', 'tre_flip', 'indy', 'stalefish', 'smith', 'nose_manual', 'spin_540']) {
      expect(tricks.getBaseScore(id)).toBeGreaterThan(0);
    }
  });
});

describe('TrickSystem air landings', () => {
  let tricks: TrickSystem;
  beforeEach(() => { tricks = new TrickSystem(); });

  it('names and multiplies a flip combined with a spin', () => {
    const [t] = tricks.landAir(air({ airTricks: ['varial_flip'], halfTurns: 2 }), false);
    expect(t.name).toBe('360 Varial Flip');
    expect(t.points).toBe(300 * 2);
    expect(t.ids).toEqual(['varial_flip', 'spin_360']);
  });

  it('prefixes fakie', () => {
    const [t] = tricks.landAir(air({ airTricks: ['melon'], halfTurns: -1 }), true);
    expect(t.name).toBe('Fakie 180 Melon');
  });

  it('adds held grab ticks to the grab', () => {
    const [t] = tricks.landAir(air({ airTricks: ['indy'], grabTicks: 6 }), false);
    expect(t.points).toBe(200 + 6 * 50);
  });

  it('scores a spin on its own when nothing else was thrown', () => {
    const [t] = tricks.landAir(air({ halfTurns: 3, ollied: true }), false);
    expect(t.ids).toEqual(['spin_540']);
    expect(t.points).toBe(600);
  });

  it('scores a plain ollie only when nothing else happened', () => {
    expect(tricks.landAir(air({ ollied: true }), false).map(t => t.ids[0])).toEqual(['ollie']);
    expect(tricks.landAir(air(), false)).toEqual([]);
  });

  it('hands landed tricks to challenges once', () => {
    tricks.landAir(air({ airTricks: ['kickflip'], halfTurns: 2 }), false);
    expect(tricks.consumeLanded().flatMap(t => t.ids)).toEqual(['kickflip', 'spin_360']);
    expect(tricks.consumeLanded()).toEqual([]);
  });
});
