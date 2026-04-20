import { describe, it, expect, beforeEach } from 'vitest';
import { GrindDetector } from '@/player/GrindDetector';
import * as THREE from 'three';

function makeRail(sx: number, sz: number, ex: number, ez: number, y = 0.5) {
  return {
    grindPath: {
      start: new THREE.Vector3(sx, y, sz),
      end: new THREE.Vector3(ex, y, ez),
    },
  };
}

describe('GrindDetector', () => {
  let detector: GrindDetector;

  beforeEach(() => {
    detector = new GrindDetector();
  });

  it('starts not grinding', () => {
    expect(detector.isGrinding).toBe(false);
  });

  it('does not start grind without input', () => {
    detector.register(makeRail(-3, 0, 3, 0));
    const result = detector.update(new THREE.Vector3(0, 0.5, 0), false, 1 / 60);
    expect(result).toBeNull();
    expect(detector.isGrinding).toBe(false);
  });

  it('snaps to rail when close enough with input', () => {
    detector.register(makeRail(-3, 0, 3, 0));
    const skaterPos = new THREE.Vector3(0, 0.5, 0.8); // 0.8m from rail — within 1.5m snap
    const result = detector.update(skaterPos, true, 1 / 60);
    expect(result).not.toBeNull();
    expect(detector.isGrinding).toBe(true);
  });

  it('does not snap when too far', () => {
    detector.register(makeRail(-3, 0, 3, 0));
    const skaterPos = new THREE.Vector3(0, 0.5, 2.0); // 2m away — beyond 1.5m snap
    const result = detector.update(skaterPos, true, 1 / 60);
    expect(result).toBeNull();
    expect(detector.isGrinding).toBe(false);
  });

  it('advances progress along the rail each frame', () => {
    detector.register(makeRail(-3, 0, 3, 0)); // 6m rail
    detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60); // snap
    const progressBefore = detector.grindProgress;
    detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60); // advance
    expect(detector.grindProgress).toBeGreaterThan(progressBefore);
  });

  it('ends grind when input released', () => {
    detector.register(makeRail(-3, 0, 3, 0));
    detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60); // start
    expect(detector.isGrinding).toBe(true);
    detector.update(new THREE.Vector3(0, 0.5, 0), false, 1 / 60); // release F
    expect(detector.isGrinding).toBe(false);
  });

  it('ends grind at end of rail', () => {
    detector.register(makeRail(0, 0, 0.1, 0)); // very short rail (0.1m)
    detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60); // snap to start
    // One big step advances well past the end (8 m/s * 0.5s / 0.1m rail = 40x over)
    const result = detector.update(new THREE.Vector3(0, 0.5, 0), true, 0.5);
    expect(result).toBeNull();
    expect(detector.isGrinding).toBe(false);
  });

  it('clear() stops grinding and removes all rails', () => {
    detector.register(makeRail(-3, 0, 3, 0));
    detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60); // start
    detector.clear();
    expect(detector.isGrinding).toBe(false);
    // After clear, same position + input should not snap (no rails registered)
    const result = detector.update(new THREE.Vector3(0, 0.5, 0), true, 1 / 60);
    expect(result).toBeNull();
  });

  it('grindSpeed property is accessible for distance tracking', () => {
    expect(detector.grindSpeed).toBeGreaterThan(0);
  });
});
