import { describe, it, expect } from 'vitest';
import { Skater, SkaterInput } from '@/player/Skater';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Ramp } from '@/world/objects/Ramp';

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

function addBox(world: CANNON.World, x: number, z: number, hw: number, h: number, hd: number): void {
  world.addBody(new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(hw, h / 2, hd)),
    position: new CANNON.Vec3(x, h / 2, z),
  }));
}

function ride(world: CANNON.World, skater: Skater, frames: number, input: Partial<SkaterInput> = {}): void {
  for (let i = 0; i < frames; i++) { skater.update(1 / 60, { ...baseInput, forward: true, ...input }); world.step(1 / 60); }
}

describe('Skater facing', () => {
  it('rolls toward the direction the model and camera treat as forward (+Z rotated by yaw)', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 60);
    const p = skater.body.position;
    const along = p.x * Math.sin(skater.yaw) + p.z * Math.cos(skater.yaw);
    expect(along).toBeGreaterThan(1);
  });

  it('spawns heading toward -Z so zone layouts keep their old direction', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 60);
    expect(skater.body.position.z).toBeLessThan(-1);
  });
});

// Obstacles sit ahead on -Z, front face at z = -5
describe('Skater collision', () => {
  const cases: [string, (w: CANNON.World) => void][] = [
    ['a wall hit head-on', w => addBox(w, 0, -6, 2, 4, 1)],
    ['a wall whose edge overlaps the body off-center', w => addBox(w, 2.2, -6, 2, 4, 1)],
    ['a knee-high ledge', w => addBox(w, 0, -6, 2, 0.6, 1)],
    ['a thin pole slightly off-center', w => addBox(w, 0.2, -5.1, 0.1, 3, 0.1)],
  ];
  for (const [name, setup] of cases) {
    it(`stops at ${name} instead of passing through it`, () => {
      const world = makeWorld();
      setup(world);
      const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
      ride(world, skater, 180);
      expect(skater.body.position.z).toBeGreaterThan(-5);
      expect(skater.body.position.y - 0.9).toBeLessThan(0.05);
    });
  }

  it('climbs out when spawned inside a low platform instead of getting stuck', () => {
    const world = makeWorld();
    addBox(world, 0, -2, 3, 0.5, 4);
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 60);
    expect(skater.body.position.y - 0.9).toBeCloseTo(0.5, 1);
    expect(skater.body.position.z).toBeLessThan(-2);
  });

  it('loses its speed when it hits a wall head-on', () => {
    const world = makeWorld();
    addBox(world, 0, -6, 2, 4, 1);
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 120);
    expect(skater.speed).toBeLessThan(1);
  });

  it('rolls over a low curb', () => {
    const world = makeWorld();
    addBox(world, 0, -6, 2, 0.12, 1);
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 180);
    expect(skater.body.position.z).toBeLessThan(-8);
  });

  it('still rides up a ramp', () => {
    const world = makeWorld();
    new Ramp({ position: new THREE.Vector3(0, 0, -5), width: 4, height: 1.2, depth: 2, rotation: Math.PI / 2 }, world);
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    let peak = 0;
    for (let i = 0; i < 120; i++) { ride(world, skater, 1); peak = Math.max(peak, skater.body.position.y - 0.9); }
    expect(peak).toBeGreaterThan(0.6);
  });

  it('lands on top of a ledge after an ollie', () => {
    const world = makeWorld();
    addBox(world, 0, -15, 2, 0.5, 10);
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 50);
    ride(world, skater, 1, { ollie: true });
    ride(world, skater, 40);
    expect(skater.body.position.z).toBeLessThan(-5);
    expect(skater.body.position.y - 0.9).toBeCloseTo(0.5, 1);
  });
});

describe('Skater trick state', () => {
  it('exposes the playing trick and its progress for the visible model', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    skater.playTrick('kickflip');
    skater.update(0.1, baseInput);
    expect(skater.trick).toBe('kickflip');
    expect(skater.trickProgress).toBeGreaterThan(0.15);
    expect(skater.trickProgress).toBeLessThan(0.25);
  });
});

describe('Skater pushing', () => {
  it('reaches a useful speed from rest within two seconds of holding forward', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    ride(world, skater, 120);
    expect(skater.speed).toBeGreaterThan(8);
  });

  it('only gains speed while the push foot is on the ground', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    for (let i = 0; i < 240; i++) {
      const before = skater.speed;
      skater.update(1 / 60, { ...baseInput, forward: true });
      if (skater.speed > before + 1e-9) expect(skater.pushState.phase).toBe('contact');
    }
  });
});

describe('Skater animation facts', () => {
  const OLLIE_AIRTIME = (2 * 6) / (9.82 * 2);

  it('stretches a kickflip to fill most of the ollie airtime', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    skater.playTrick('kickflip');
    skater.update(OLLIE_AIRTIME * 0.85 / 2, baseInput);
    expect(skater.trickProgress).toBeCloseTo(0.5, 1);
  });

  it('holds a manual for 0.6 s', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    skater.playTrick('manual');
    skater.update(0.3, baseInput);
    expect(skater.trickProgress).toBeCloseTo(0.5, 1);
  });

  it('reports bail progress from 0 to 1', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    skater.triggerBail();
    skater.update(0.75, baseInput);
    expect(skater.bailProgress).toBeCloseTo(0.5, 1);
  });

  it('reports turn input and braking', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 0, y: 0.9, z: 0 });
    skater.update(1 / 60, { ...baseInput, left: true, backward: true });
    expect(skater.turnInput).toBe(1);
    expect(skater.braking).toBe(true);
  });
});
