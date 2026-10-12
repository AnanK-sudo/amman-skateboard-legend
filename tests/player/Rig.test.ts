import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { readFileSync } from 'fs';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { Rig } from '@/player/anim/Rig';
import { solveTwoBone } from '@/player/anim/FootIK';

let buffer: ArrayBuffer;
beforeAll(() => {
  const b = readFileSync('public/models/skater.fbx');
  buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
});

function load(): { root: THREE.Group; rig: Rig } {
  const root = new FBXLoader().parse(buffer, '');
  root.scale.setScalar(0.01);
  root.updateMatrixWorld(true);
  return { root, rig: new Rig(root) };
}

function worldOf(root: THREE.Object3D, name: string): THREE.Vector3 {
  root.updateMatrixWorld(true);
  return root.getObjectByName(name)!.getWorldPosition(new THREE.Vector3());
}

describe('Rig', () => {
  it('lowers the front arm for regular (left side)', () => {
    const { root, rig } = load();
    rig.applyPose({ frontArm: [0, 0, -70] });
    expect(worldOf(root, 'mixamorigLeftHand').y).toBeLessThan(worldOf(root, 'mixamorigLeftArm').y - 0.3);
  });

  it('leans the head forward with the spine', () => {
    const { root, rig } = load();
    const restZ = worldOf(root, 'mixamorigHead').z;
    rig.applyPose({ spine: [30, 0, 0] });
    expect(worldOf(root, 'mixamorigHead').z).toBeGreaterThan(restZ + 0.15);
  });

  it('drives the right arm as front for goofy and resets the old side on a stance switch', () => {
    const { root, rig } = load();
    const restY = worldOf(root, 'mixamorigLeftHand').y;
    rig.applyPose({ frontArm: [0, 0, -70] });
    rig.setStance('goofy');
    rig.applyPose({ frontArm: [0, 0, 70] });
    expect(worldOf(root, 'mixamorigRightHand').y).toBeLessThan(restY - 0.3);
    expect(worldOf(root, 'mixamorigLeftHand').y).toBeCloseTo(restY, 3);
  });

  it('drops the hips by the requested height', () => {
    const { root, rig } = load();
    const rest = worldOf(root, 'mixamorigHips').y;
    rig.setHipDrop(0.2);
    expect(worldOf(root, 'mixamorigHips').y).toBeCloseTo(rest - 0.2, 3);
  });

  it('puts the ankle where the IK asks', () => {
    const { root, rig } = load();
    rig.setHipDrop(0.15);
    const { upper, lower } = rig.legLengths();
    const hip = rig.hipWorld('front', new THREE.Vector3());
    const target = hip.clone().add(new THREE.Vector3(0.12, -0.7, 0.1));
    const { knee, ankle } = solveTwoBone(hip, target, new THREE.Vector3(0, 0, 1), upper, lower);
    rig.aimLeg('front', knee, ankle, new THREE.Vector3(0, 0, 1), rig.restFootWorld('front', new THREE.Quaternion()));
    expect(worldOf(root, 'mixamorigLeftFoot').distanceTo(target)).toBeLessThan(0.02);
    expect(worldOf(root, 'mixamorigLeftLeg').distanceTo(knee)).toBeLessThan(0.02);
  });
});
