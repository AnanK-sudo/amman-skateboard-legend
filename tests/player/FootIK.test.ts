import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { solveTwoBone } from '@/player/anim/FootIK';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

describe('solveTwoBone', () => {
  it('reaches a reachable target and keeps both segment lengths', () => {
    const hip = v(0, 1, 0), target = v(0.1, 0.2, 0.1);
    const { knee, ankle } = solveTwoBone(hip, target, v(0, 0, 1), 0.45, 0.45);
    expect(ankle.distanceTo(target)).toBeLessThan(0.01);
    expect(knee.distanceTo(hip)).toBeCloseTo(0.45, 4);
    expect(knee.distanceTo(ankle)).toBeCloseTo(0.45, 4);
  });

  it('bends the knee toward the pole', () => {
    const hip = v(0, 1, 0);
    const { knee } = solveTwoBone(hip, v(0, 0.3, 0), v(0, 0, 1), 0.45, 0.45);
    expect(knee.z).toBeGreaterThan(0.1);
    expect(Math.abs(knee.x)).toBeLessThan(1e-6);
  });

  it('clamps an unreachable target to a straight leg toward it', () => {
    const hip = v(0, 1, 0);
    const { knee, ankle } = solveTwoBone(hip, v(0, -2, 0), v(0, 0, 1), 0.45, 0.45);
    expect(ankle.y).toBeCloseTo(0.1, 2);
    expect(knee.y).toBeCloseTo(0.55, 2);
    expect(Math.abs(knee.z)).toBeLessThan(0.02);
  });

  it('stays finite when the target sits on the hip or the pole is parallel', () => {
    const hip = v(0, 1, 0);
    for (const [t, p] of [[v(0, 1, 0), v(0, 0, 1)], [v(0, 0.3, 0), v(0, -1, 0)]] as const) {
      const { knee, ankle } = solveTwoBone(hip, t, p, 0.45, 0.45);
      for (const n of [...knee.toArray(), ...ankle.toArray()]) expect(Number.isFinite(n)).toBe(true);
    }
  });
});
