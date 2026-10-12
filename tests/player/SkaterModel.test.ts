import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';

vi.mock('three/addons/loaders/FBXLoader.js', () => ({
  FBXLoader: class { load() {} },
}));

import { SkaterModel, SkaterAnimState } from '@/player/SkaterModel';

const state: SkaterAnimState = {
  mode: 'riding', feet: new THREE.Vector3(0, 0, 0), yaw: 0, speed: 5, maxSpeed: 15, isGrounded: false, shock: 0,
  trick: 'none', trickProgress: 0, pushState: { phase: 'none', phaseT: 0, contactTravel: 0, stride: 0.6 },
  turn: 0, braking: false, grinding: false, grindType: null, crouch: 0, manualBalance: null, spinAngle: 0, fakie: false,
  bailReason: null, bailProgress: 0, mountProgress: 0, walkSpeed: 0, stridePhase: 0,
  board: { position: new THREE.Vector3(2, 0, 3), yaw: 1, wheelsUp: false, speed: 0 },
};

let scene = new THREE.Scene();
function make(): SkaterModel {
  scene = new THREE.Scene();
  return new SkaterModel(scene);
}

describe('SkaterModel tricks (the visible character)', () => {
  it('flips the visible board around its long axis during a kickflip', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    // Fast out of the pop, easing into the catch: well past halfway at half progress
    const x = scene.getObjectByName('boardFlip')!.rotation.x;
    expect(x).toBeGreaterThan(Math.PI);
    expect(x).toBeLessThan(Math.PI * 2);
  });

  it('flips the other way for a heelflip', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'heelflip', trickProgress: 0.5 });
    expect(scene.getObjectByName('boardFlip')!.rotation.x).toBeLessThan(-1);
  });

  it('spins the visible skater by the spin angle', () => {
    const model = make();
    model.update(1 / 60, { ...state, spinAngle: 2 });
    expect(scene.getObjectByName('trickPivot')!.rotation.y).toBeCloseTo(2);
  });

  it('rides fakie looking like the opposite stance', () => {
    const model = make();
    model.update(1 / 60, { ...state, isGrounded: true, fakie: true });
    expect(model.chestSide).toBe(-1);
  });

  it('settles back to neutral when no trick is playing', () => {
    const model = make();
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    model.update(1 / 60, state);
    expect(scene.getObjectByName('boardFlip')!.rotation.x).toBe(0);
    expect(scene.getObjectByName('trickPivot')!.rotation.y).toBeCloseTo(0);
  });
});

describe('SkaterModel stance', () => {
  it('turns the body sideways: regular faces the right of travel, goofy the left', () => {
    const model = make();
    const root = scene.getObjectByName('stanceRoot')!;
    model.update(1 / 60, { ...state, isGrounded: true });
    expect(root.rotation.y).toBeCloseTo(-Math.PI / 2);
    model.setStance('goofy');
    model.update(1 / 60, { ...state, isGrounded: true });
    expect(root.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(model.chestSide).toBe(-1);
  });

  it('mirrors board flips for goofy', () => {
    const model = make();
    model.setStance('goofy');
    model.update(1 / 60, { ...state, trick: 'kickflip', trickProgress: 0.5 });
    expect(scene.getObjectByName('boardFlip')!.rotation.x).toBeLessThan(-Math.PI);
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

