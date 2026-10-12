import * as THREE from 'three';

const FALLBACK_POLE = new THREE.Vector3(0, 0, 1);
const ALT_POLE = new THREE.Vector3(1, 0, 0);

/** Places the knee for a hip-to-ankle chain; out-of-reach targets give a straight leg pointing at them */
export function solveTwoBone(
  hip: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, upper: number, lower: number,
): { knee: THREE.Vector3; ankle: THREE.Vector3 } {
  const toTarget = target.clone().sub(hip);
  let dist = toTarget.length();
  const dir = dist > 1e-6 ? toTarget.divideScalar(dist) : new THREE.Vector3(0, -1, 0);
  dist = Math.min(Math.max(dist, Math.abs(upper - lower) + 1e-4), upper + lower - 1e-4);

  // Knee sits along the hip-ankle line at distance a, pushed out by h toward the pole
  const a = (upper * upper - lower * lower + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));

  let bend = pole.clone().addScaledVector(dir, -pole.dot(dir));
  if (bend.lengthSq() < 1e-8) bend = FALLBACK_POLE.clone().addScaledVector(dir, -FALLBACK_POLE.dot(dir));
  if (bend.lengthSq() < 1e-8) bend = ALT_POLE.clone().addScaledVector(dir, -ALT_POLE.dot(dir));
  bend.normalize();

  const ankle = hip.clone().addScaledVector(dir, dist);
  const knee = hip.clone().addScaledVector(dir, a).addScaledVector(bend, h);
  return { knee, ankle };
}
