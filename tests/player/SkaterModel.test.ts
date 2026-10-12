import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('three/addons/loaders/FBXLoader.js', () => ({
  FBXLoader: class { load() {} },
}));

import { SkaterModel, SkaterAnimState } from '@/player/SkaterModel';

const state: SkaterAnimState = {
  position: new THREE.Vector3(0, 0.9, 0), yaw: 0, speed: 5, maxSpeed: 15,
  isGrounded: false, isBailing: false, bailProgress: 0, shock: 0,
  trick: 'none', trickProgress: 0,
  pushState: { phase: 'none', phaseT: 0, contactTravel: 0, stride: 0.6 },
  turn: 0, braking: false, grinding: false,
};

function make(): SkaterModel {
  return new SkaterModel(new THREE.Scene(), new THREE.Group());
}

describe('SkaterModel tricks (the visible character)', () => {
  it('flips the visible board around its long axis during a kickflip', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    expect(Math.abs(model.group.getObjectByName('boardFlip')!.rotation.x)).toBeCloseTo(Math.PI, 1);
  });

  it('flips the other way for a heelflip', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'heelflip', trickProgress: 0.5 });
    expect(model.group.getObjectByName('boardFlip')!.rotation.x).toBeLessThan(-1);
  });

  it('spins the whole visible skater during a spin', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'spin', trickProgress: 0.5 });
    expect(Math.abs(model.group.getObjectByName('trickPivot')!.rotation.y)).toBeGreaterThan(1);
  });

  it('settles back to neutral when no trick is playing', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    model.update(1 / 60, state);
    expect(model.group.getObjectByName('boardFlip')!.rotation.x).toBe(0);
    expect(model.group.getObjectByName('trickPivot')!.rotation.y).toBe(0);
  });
});

describe('SkaterModel stance', () => {
  it('turns the body sideways: regular faces the right of travel, goofy the left', () => {
    const model = make();
    const root = model.group.getObjectByName('stanceRoot')!;
    expect(root.rotation.y).toBeCloseTo(-Math.PI / 2);
    model.setStance('goofy');
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(model.chestSide).toBe(-1);
  });

  it('mirrors board flips for goofy', () => {
    const model = make();
    model.setStance('goofy');
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    expect(model.group.getObjectByName('boardFlip')!.rotation.x).toBeCloseTo(-Math.PI, 1);
  });

  it('runs before the character model has loaded and reports big moves to the camera', () => {
    const model = make();
    expect(model.loaded).toBe(false);
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.2 });
    expect(model.cameraMoment).toBe(true);
    model.update(1 / 60, { ...state, isGrounded: true, speed: 8 });
    expect(model.cameraMoment).toBe(false);
  });
});

