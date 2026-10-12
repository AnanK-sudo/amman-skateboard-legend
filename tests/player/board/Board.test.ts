import { describe, it, expect } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { Board } from '@/player/board/Board';

function world(): CANNON.World {
  const w = new CANNON.World();
  const g = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  g.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  w.addBody(g);
  return w;
}
function wall(w: CANNON.World, z: number): void {
  w.addBody(new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Box(new CANNON.Vec3(5, 1, 0.5)), position: new CANNON.Vec3(0, 1, z) }));
}
function run(b: Board, w: CANNON.World, seconds: number): void {
  for (let t = 0; t < seconds; t += 1 / 60) { w.step(1 / 60); b.update(1 / 60, w); }
}

describe('Board (free)', () => {
  it('slides off along the launch velocity and settles', () => {
    const w = world();
    const b = new Board();
    b.launch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 6), 0, 0, false);
    run(b, w, 1);
    expect(b.position.z).toBeGreaterThan(2);
    run(b, w, 20);
    expect(b.settled).toBe(true);
    expect(b.position.y).toBeCloseTo(0, 3);
  });

  it('rolls further wheels-down than upside down', () => {
    const distance = (wheelsUp: boolean) => {
      const w = world();
      const b = new Board();
      b.launch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 6), 0, 0, wheelsUp);
      run(b, w, 20);
      return b.position.z;
    };
    expect(distance(false)).toBeGreaterThan(distance(true) * 2);
  });

  it('bounces off a wall instead of passing through it', () => {
    const w = world();
    wall(w, 3);
    const b = new Board();
    b.launch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 10), 0, 0, false);
    let maxZ = 0;
    for (let t = 0; t < 4; t += 1 / 60) { w.step(1 / 60); b.update(1 / 60, w); maxZ = Math.max(maxZ, b.position.z); }
    expect(maxZ).toBeLessThan(2.6);
    expect(b.position.z).toBeLessThan(2.5);
  });

  it('falls with gravity when launched into the air and lands', () => {
    const w = world();
    const b = new Board();
    b.launch(new THREE.Vector3(0, 1.5, 0), new THREE.Vector3(0, 2, 2), 0, 4, true);
    run(b, w, 0.3);
    expect(b.position.y).toBeGreaterThan(0.5);
    run(b, w, 3);
    expect(b.position.y).toBeCloseTo(0, 3);
  });

  it('reports falling out of the world', () => {
    const b = new Board();
    b.launch(new THREE.Vector3(0, -11, 0), new THREE.Vector3(0, -5, 0), 0, 0, false);
    run(b, new CANNON.World(), 0.1);
    expect(b.lost).toBe(true);
  });
});
