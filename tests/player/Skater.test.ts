import { describe, it, expect } from 'vitest';
import { Skater, SkaterInput } from '@/player/Skater';
import * as CANNON from 'cannon-es';

function makeWorld(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);
  return world;
}

const baseInput: SkaterInput = {
  forward: false, backward: false, left: false, right: false,
  ollie: false, trick1: false, trick2: false, grind: false,
  grab: false, manual: false, cameraYaw: 0,
};

describe('Skater', () => {
  it('creates a physics body added to the world', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    expect(world.bodies.length).toBe(2); // ground + skater
  });

  it('starts at spawn position', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 5, y: 1, z: 3 });
    expect(skater.body.position.x).toBe(5);
    expect(skater.body.position.z).toBe(3);
  });

  it('accelerates forward when W is pressed', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    const initialZ = skater.body.position.z;
    const input = { ...baseInput, forward: true };
    for (let i = 0; i < 60; i++) { skater.update(1/60, input); world.step(1/60); }
    expect(skater.body.position.z).not.toBe(initialZ);
  });

  it('turns when A/D is pressed', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    const initialYaw = skater.yaw;
    const input = { ...baseInput, forward: true, left: true };
    for (let i = 0; i < 30; i++) { skater.update(1/60, input); world.step(1/60); }
    expect(skater.yaw).not.toBe(initialYaw);
  });

  it('speed is capped at max speed', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    const input = { ...baseInput, forward: true };
    for (let i = 0; i < 600; i++) { skater.update(1/60, input); world.step(1/60); }
    expect(skater.speed).toBeLessThanOrEqual(skater.maxSpeed + 0.5);
  });
});
