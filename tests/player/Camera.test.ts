import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FollowCamera } from '@/player/Camera';

const target = new THREE.Vector3(0, 0.9, 0);

function run(cam: FollowCamera, seconds: number, moment: boolean, chestSide = 1, yaw = 0): void {
  for (let t = 0; t < seconds; t += 1 / 60) cam.update(1 / 60, target, 0, 15, yaw, moment, chestSide);
}

function horizontalDistance(cam: FollowCamera): number {
  return Math.hypot(cam.camera.position.x - target.x, cam.camera.position.z - target.z);
}

describe('FollowCamera', () => {
  it('settles behind the skater close enough to frame the whole body', () => {
    const cam = new FollowCamera(1.5);
    run(cam, 4, false);
    expect(cam.camera.position.z).toBeLessThan(-3.5); // travel is +Z at yaw 0, so behind is -Z
    expect(Math.abs(cam.camera.position.x)).toBeLessThan(0.05);
    expect(horizontalDistance(cam)).toBeLessThan(4.6);
    expect(cam.camera.position.y).toBeLessThan(target.y + 1.6);
  });

  it('swoops closer and out to the chest side for a big move', () => {
    const cam = new FollowCamera(1.5);
    run(cam, 3, false);
    const chase = horizontalDistance(cam);
    run(cam, 1.5, true, 1);
    expect(horizontalDistance(cam)).toBeLessThan(chase - 0.8);
    expect(cam.camera.position.x).toBeLessThan(-1.2); // regular faces -X (right of travel)
  });

  it('swings to the other side for goofy', () => {
    const cam = new FollowCamera(1.5);
    run(cam, 3, false);
    run(cam, 1.5, true, -1);
    expect(cam.camera.position.x).toBeGreaterThan(1.2);
  });

  it('glides back behind once the move ends', () => {
    const cam = new FollowCamera(1.5);
    run(cam, 3, false);
    run(cam, 1.5, true);
    run(cam, 3, false);
    expect(Math.abs(cam.camera.position.x)).toBeLessThan(0.1);
  });
});
