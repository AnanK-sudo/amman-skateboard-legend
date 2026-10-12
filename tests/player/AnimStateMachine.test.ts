import { describe, it, expect } from 'vitest';
import { AnimStateMachine, type AnimInput } from '@/player/anim/AnimStateMachine';
import { boneName, mirrorPose, type JointPose } from '@/player/anim/mirror';

const base: AnimInput = {
  speed: 0, maxSpeed: 15, grounded: true, pushPhase: 'none', turn: 0, braking: false,
  grinding: false, bailing: false, bailProgress: 0, trick: 'none', trickProgress: 0, shock: 0, stance: 'regular',
};

function settle(input: Partial<AnimInput>, frames = 60, m = new AnimStateMachine()) {
  let f = m.update(1 / 60, { ...base, ...input });
  for (let i = 1; i < frames; i++) f = m.update(1 / 60, { ...base, ...input });
  return f;
}

describe('AnimStateMachine states', () => {
  const cases: [string, Partial<AnimInput>][] = [
    ['idle', {}],
    ['push', { speed: 3, pushPhase: 'contact' }],
    ['ride', { speed: 8 }],
    ['carve', { speed: 8, turn: 1 }],
    ['brake', { speed: 8, braking: true }],
    ['air', { speed: 8, grounded: false }],
    ['grind', { speed: 8, grinding: true }],
    ['manual', { speed: 8, trick: 'manual', trickProgress: 0.5 }],
    ['bail', { bailing: true, bailProgress: 0.3 }],
  ];
  for (const [state, input] of cases) {
    it(`picks ${state}`, () => expect(settle(input).state).toBe(state));
  }

  it('pops on takeoff, then goes airborne', () => {
    const m = new AnimStateMachine();
    settle({ speed: 8 }, 10, m);
    expect(m.update(1 / 60, { ...base, speed: 8, grounded: false }).state).toBe('pop');
    expect(settle({ speed: 8, grounded: false }, 30, m).state).toBe('air');
  });

  it('squashes on landing, then rides', () => {
    const m = new AnimStateMachine();
    settle({ speed: 8, grounded: false }, 30, m);
    expect(m.update(1 / 60, { ...base, speed: 8, shock: 0.8 }).state).toBe('land');
    expect(settle({ speed: 8 }, 40, m).state).toBe('ride');
  });

  it('crouches deeper at speed', () => {
    expect(settle({ speed: 14 }).hipDrop).toBeGreaterThan(settle({ speed: 2 }).hipDrop);
  });
});

describe('AnimStateMachine tricks', () => {
  it('rolls the board one full turn over a kickflip', () => {
    const m = new AnimStateMachine();
    expect(m.update(1 / 60, { ...base, grounded: false, trick: 'kickflip', trickProgress: 1 }).board.flip).toBeCloseTo(1, 5);
  });

  it('rolls the other way for a heelflip and adds a shove for a tre flip', () => {
    const m = new AnimStateMachine();
    expect(m.update(1 / 60, { ...base, grounded: false, trick: 'heelflip', trickProgress: 1 }).board.flip).toBeCloseTo(-1, 5);
    const tre = m.update(1 / 60, { ...base, grounded: false, trick: 'tre_flip', trickProgress: 1 }).board;
    expect(tre.flip).toBeCloseTo(1, 5);
    expect(tre.shove).toBeCloseTo(1, 5);
  });

  it('lifts both feet off the board mid-flip', () => {
    const f = settle({ grounded: false, trick: 'kickflip', trickProgress: 0.45 }, 30);
    expect(f.frontLift).toBeGreaterThan(0.15);
    expect(f.backLift).toBeGreaterThan(0.1);
  });

  it('spins the body during a spin', () => {
    const m = new AnimStateMachine();
    expect(m.update(1 / 60, { ...base, grounded: false, trick: 'spin', trickProgress: 0.5 }).spin).toBeCloseTo(0.5, 1);
  });

  it('reaches the front hand down during a grab', () => {
    const f = settle({ grounded: false, trick: 'grab', trickProgress: 0.5 }, 30);
    const air = settle({ grounded: false }, 30);
    expect(f.joints.frontArm![2]).toBeLessThan(air.joints.frontArm![2] - 30);
  });

  it('only frames big moves for the cinematic camera', () => {
    const moment = (input: Partial<AnimInput>) => new AnimStateMachine().update(1 / 60, { ...base, ...input }).cameraMoment;
    for (const trick of ['kickflip', 'heelflip', 'tre_flip', 'spin', 'grab'] as const) {
      expect(moment({ grounded: false, trick, trickProgress: 0.3 })).toBe(true);
    }
    expect(moment({ grinding: true, speed: 5 })).toBe(true);
    expect(moment({ grounded: false, trick: 'ollie', trickProgress: 0.3 })).toBe(false);
    expect(moment({ speed: 5, trick: 'manual', trickProgress: 0.3 })).toBe(false);
    expect(moment({ speed: 10 })).toBe(false);
  });
});

describe('Stance mirroring', () => {
  it('drives the left limbs as front for regular and the right limbs for goofy', () => {
    expect(boneName('frontArm', 'regular')).toBe('mixamorigLeftArm');
    expect(boneName('frontArm', 'goofy')).toBe('mixamorigRightArm');
    expect(boneName('backForeArm', 'regular')).toBe('mixamorigRightForeArm');
    expect(boneName('head', 'goofy')).toBe('mixamorigHead');
  });

  it('mirrors across the body by negating yaw and roll', () => {
    expect(mirrorPose({ head: [10, 40, -5] })).toEqual({ head: [10, -40, 5] });
  });

  it('produces the mirror image of the regular pose for goofy', () => {
    const input = { speed: 8, pushPhase: 'contact' as const };
    const reg = settle(input).joints;
    const goofy = settle({ ...input, stance: 'goofy' }).joints;
    const mirrored: JointPose = mirrorPose(reg);
    for (const j of Object.keys(mirrored) as (keyof JointPose)[]) {
      mirrored[j]!.forEach((v, i) => expect(goofy[j]![i]).toBeCloseTo(v, 6));
    }
  });
});
