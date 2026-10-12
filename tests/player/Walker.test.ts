import { describe, it, expect } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Walker, type WalkInput } from '@/player/Walker';

function world(): CANNON.World {
  const w = new CANNON.World();
  const g = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  g.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  w.addBody(g);
  return w;
}
const none: WalkInput = { forward: false, back: false, left: false, right: false, jog: false };
function walk(wk: Walker, w: CANNON.World, seconds: number, input: Partial<WalkInput>, cameraYaw: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) { w.step(1 / 60); wk.update(1 / 60, { ...none, ...input }, cameraYaw, w); }
}

describe('Walker', () => {
  it('walks away from the camera at 1.6 m/s', () => {
    const w = world();
    const wk = new Walker();
    wk.place(new THREE.Vector3(0, 0, 0), 0);
    // Camera sits at -Z (cameraYaw PI), so forward is +Z
    walk(wk, w, 2, { forward: true }, Math.PI);
    expect(wk.position.z).toBeGreaterThan(2.6);
    expect(wk.position.z).toBeLessThan(3.3);
    expect(Math.abs(wk.position.x)).toBeLessThan(0.05);
  });

  it('strafes relative to the camera and turns to face the way it walks', () => {
    const w = world();
    const wk = new Walker();
    wk.place(new THREE.Vector3(0, 0, 0), 0);
    walk(wk, w, 1.5, { right: true }, Math.PI);
    // Camera looking +Z: screen right is -X
    expect(wk.position.x).toBeLessThan(-1);
    expect(Math.sin(wk.yaw)).toBeLessThan(-0.9);
  });

  it('jogs at 3 m/s with Shift', () => {
    const w = world();
    const wk = new Walker();
    wk.place(new THREE.Vector3(0, 0, 0), 0);
    walk(wk, w, 2, { forward: true, jog: true }, Math.PI);
    expect(wk.position.z).toBeGreaterThan(5.2);
  });

  it('is stopped by walls and steps up curbs', () => {
    const w = world();
    w.addBody(new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(3, 1, 0.5)), position: new CANNON.Vec3(0, 1, 3) }));
    w.addBody(new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(3, 0.08, 2)), position: new CANNON.Vec3(0, 0.08, -4.5) }));
    const wk = new Walker();
    wk.place(new THREE.Vector3(0, 0, 0), 0);
    walk(wk, w, 4, { forward: true }, Math.PI);
    expect(wk.position.z).toBeLessThan(2.5);
    const wk2 = new Walker();
    wk2.place(new THREE.Vector3(0, 0, 0), Math.PI);
    walk(wk2, w, 2.5, { forward: true }, 0);
    expect(wk2.position.z).toBeLessThan(-3);
    expect(wk2.position.y).toBeCloseTo(0.16, 2);
  });

  it('stands still and keeps its stride phase without input', () => {
    const w = world();
    const wk = new Walker();
    wk.place(new THREE.Vector3(1, 0, 1), 0.5);
    walk(wk, w, 1, {}, Math.PI);
    expect(wk.position.x).toBeCloseTo(1, 3);
    expect(wk.speed).toBeCloseTo(0, 2);
  });
});
