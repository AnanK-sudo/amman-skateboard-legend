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

describe('FollowCamera input and modes', () => {
  it('ignores the mouse unless free-look is held', () => {
    const a = new FollowCamera(1.5), b = new FollowCamera(1.5);
    run(a, 2, false);
    run(b, 2, false);
    b.freeLook(false, 400, 200);
    run(a, 0.5, false);
    run(b, 0.5, false);
    expect(b.camera.position.distanceTo(a.camera.position)).toBeLessThan(1e-6);
  });

  it('looks around while held, then eases back over about a second', () => {
    const cam = new FollowCamera(1.5);
    run(cam, 3, false);
    const rest = cam.camera.position.clone();
    cam.freeLook(true, 400, 0);
    run(cam, 0.1, false);
    expect(cam.camera.position.distanceTo(rest)).toBeGreaterThan(1);
    cam.freeLook(false, 0, 0);
    run(cam, 0.3, false);
    expect(cam.camera.position.distanceTo(rest)).toBeGreaterThan(0.3);
    run(cam, 1.5, false);
    expect(cam.camera.position.distanceTo(rest)).toBeLessThan(0.1);
  });

  it('follows a walker from 3.5 m', () => {
    const cam = new FollowCamera(1.5);
    for (let t = 0; t < 4; t += 1 / 60) cam.update(1 / 60, target, 0, 15, 0, false, 1, 'walk');
    expect(horizontalDistance(cam)).toBeCloseTo(3.5 * Math.cos(0.2), 1);
  });
});
