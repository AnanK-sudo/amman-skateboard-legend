import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { SkatePark } from '@/world/zones/SkatePark';
import { Skater, SkaterInput } from '@/player/Skater';

const input: SkaterInput = {
  forward: true, backward: false, left: false, right: false, ollieHeld: false, spinLeft: false, spinRight: false,
};

function park(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  new SkatePark().load(new THREE.Scene(), world);
  return world;
}

function feetHeightAfterRiding(world: CANNON.World, spawn: { x: number; y: number; z: number }, yaw: number, frames: number): number {
  const skater = new Skater(world, spawn);
  (skater as unknown as { _yaw: number })._yaw = yaw;
  let peak = 0;
  for (let i = 0; i < frames; i++) { skater.update(1 / 60, input); world.step(1 / 60); peak = Math.max(peak, skater.body.position.y - 0.9); }
  return peak;
}

describe('SkatePark banks are solid and face their platforms', () => {
  it('rides from the spawn up the south bank onto the fun box', () => {
    expect(feetHeightAfterRiding(park(), { x: 0, y: 0.9, z: 8 }, Math.PI, 150)).toBeGreaterThan(0.6);
  });

  it('rides up the east bank onto the pyramid heading west', () => {
    expect(feetHeightAfterRiding(park(), { x: -2, y: 0.9, z: -8 }, -Math.PI / 2, 150)).toBeGreaterThan(0.9);
  });

  it('rides up the west bank onto the pyramid heading east', () => {
    expect(feetHeightAfterRiding(park(), { x: -18, y: 0.9, z: -8 }, Math.PI / 2, 150)).toBeGreaterThan(0.9);
  });
});
