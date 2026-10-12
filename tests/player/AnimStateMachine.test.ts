import { describe, it, expect } from 'vitest';
import { AnimStateMachine, type AnimInput } from '@/player/anim/AnimStateMachine';
import { boneName, mirrorPose, type JointPose } from '@/player/anim/mirror';

const base: AnimInput = {
  mode: 'riding', speed: 0, maxSpeed: 15, grounded: true, pushPhase: 'none', turn: 0, braking: false,
  grinding: false, grindType: null, bailReason: null, bailProgress: 0, mountProgress: 0, walkSpeed: 0, stridePhase: 0,
  trick: 'none', trickProgress: 0, shock: 0, crouch: 0, manualBalance: null, stance: 'regular',
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
    ['manual', { speed: 8, trick: 'manual', trickProgress: 0.5, manualBalance: 0 }],
    ['charge', { crouch: 1 }],
    ['bail', { mode: 'bailing', bailReason: 'unfinished', bailProgress: 0.3 }],
    ['getup', { mode: 'bailing', bailReason: 'unfinished', bailProgress: 0.8 }],
    ['walk', { mode: 'walking', walkSpeed: 1.6 }],
    ['mount', { mode: 'mounting', mountProgress: 0.3 }],
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


  it('reaches the front hand down during a nosegrab', () => {
    const f = settle({ grounded: false, trick: 'nosegrab', trickProgress: 0.5 }, 30);
    const air = settle({ grounded: false }, 30);
    expect(f.joints.frontArm![2]).toBeLessThan(air.joints.frontArm![2] - 30);
  });

  it('only frames big moves for the cinematic camera', () => {
    const moment = (input: Partial<AnimInput>) => new AnimStateMachine().update(1 / 60, { ...base, ...input }).cameraMoment;
    for (const trick of ['kickflip', 'heelflip', 'tre_flip', 'impossible', 'indy', 'stalefish'] as const) {
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

describe('Push stance', () => {
  it('turns the body 65 degrees toward travel and the front foot to the nose while pushing', () => {
    const f = settle({ speed: 3, pushPhase: 'contact' });
    expect(f.bodyYaw).toBeCloseTo(65 * Math.PI / 180, 2);
    expect(f.frontFootYaw).toBeCloseTo(25 * Math.PI / 180, 2);
  });

  it('pivots back to sideways after the last stroke in about 0.3 s', () => {
    const m = new AnimStateMachine();
    settle({ speed: 3, pushPhase: 'contact' }, 60, m);
    const f = settle({ speed: 5 }, 25, m);
    expect(f.bodyYaw).toBeLessThan(0.25 * 65 * Math.PI / 180);
  });
});

describe('Walking, bails and mounting', () => {
  it('faces the way it walks and swings the arms with the stride', () => {
    const a = settle({ mode: 'walking', walkSpeed: 1.6, stridePhase: Math.PI / 2 });
    const b = settle({ mode: 'walking', walkSpeed: 1.6, stridePhase: -Math.PI / 2 });
    expect(a.stand).toBeLessThan(0.05);
    expect(Math.sign(a.joints.frontArm![1])).toBe(-Math.sign(b.joints.frontArm![1]));
  });

  it('falls forward for an unfinished trick and sideways for a crooked landing', () => {
    const slam = settle({ mode: 'bailing', bailReason: 'unfinished', bailProgress: 0.4 }, 5);
    const tumble = settle({ mode: 'bailing', bailReason: 'crooked', bailProgress: 0.4 }, 5);
    expect(slam.pivotPitch).toBeGreaterThan(1.2);
    expect(Math.abs(slam.pivotRoll)).toBe(0);
    expect(tumble.pivotRoll).toBeGreaterThan(1);
  });

  it('turns from facing forward to the riding stance through the hop on', () => {
    expect(settle({ mode: 'mounting', mountProgress: 0.1 }, 1).stand).toBeCloseTo(0.1, 5);
    expect(settle({ mode: 'mounting', mountProgress: 0.9 }, 1).stand).toBeCloseTo(0.9, 5);
  });
});

describe('Flip and grind board motion', () => {
  const cases: [string, number, number, number][] = [
    ['kickflip', 1, 0, 0], ['heelflip', -1, 0, 0], ['pop_shove_it', 0, 0.5, 0], ['shove_it_360', 0, 1, 0],
    ['varial_flip', 1, 0.5, 0], ['tre_flip', 1, 1, 0], ['hardflip', 1, -0.5, 0], ['impossible', 0, 0, 1],
  ];
  for (const [id, flip, shove, wrap] of cases) {
    it(`${id} completes its rotation by the catch`, () => {
      const b = new AnimStateMachine().update(1 / 60, { ...base, grounded: false, trick: id, trickProgress: 0.85 }).board;
      expect(b.flip).toBeCloseTo(flip, 5);
      expect(b.shove).toBeCloseTo(shove, 5);
      expect(b.wrap).toBeCloseTo(wrap, 5);
    });
  }

  it('sets a distinct board angle per grind', () => {
    const at = (grindType: string) => new AnimStateMachine().update(1 / 60, { ...base, speed: 8, grinding: true, grindType });
    expect(at('boardslide').grindYaw).toBeCloseTo(0.25);
    expect(at('nosegrind').board.pitch).toBeLessThan(-0.1);
    expect(at('five_o').board.pitch).toBeGreaterThan(0.1);
    expect(at('smith').board.roll).toBeGreaterThan(0.2);
  });
});

