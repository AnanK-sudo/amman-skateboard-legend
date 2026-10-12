import * as CANNON from 'cannon-es';

/** Anything taller than this needs an ollie; curbs, stair steps (0.18) and bank-to-box lips roll over */
export const STEP_HEIGHT = 0.3;

const RAY = { collisionFilterGroup: 1, collisionFilterMask: 1 };

export interface WallProbe {
  radius: number;
  /** Ray heights above the feet */
  heights: number[];
  /** Ray offsets across the width, as fractions of the radius */
  sides: number[];
}

export const RIDER_PROBE: WallProbe = { radius: 0.3, heights: [STEP_HEIGHT + 0.02, 0.9, 1.6], sides: [-1, -0.5, 0, 0.5, 1] };
export const WALKER_PROBE: WallProbe = { radius: 0.25, heights: [STEP_HEIGHT + 0.02, 0.9, 1.5], sides: [-1, 0, 1] };
export const BOARD_PROBE: WallProbe = { radius: 0.42, heights: [0.06], sides: [-1, 0, 1] };

export function groundHit(world: CANNON.World, x: number, z: number, fromY: number): { y: number; normalY: number } | null {
  const res = new CANNON.RaycastResult();
  world.raycastClosest(new CANNON.Vec3(x, fromY, z), new CANNON.Vec3(x, -10, z), { ...RAY, skipBackfaces: true }, res);
  return res.hasHit ? { y: res.hitPointWorld.y, normalY: res.hitNormalWorld.y } : null;
}

export function groundBelow(world: CANNON.World, x: number, z: number, fromY: number): number | null {
  return groundHit(world, x, z, fromY)?.y ?? null;
}

/** A face is only a wall if its top stands more than a step above the ground in front of it (e.g. a bank meeting a box) */
function isStepUp(world: CANNON.World, hit: CANNON.Vec3, normal: CANNON.Vec3): boolean {
  const top = groundBelow(world, hit.x - normal.x * 0.02, hit.z - normal.z * 0.02, hit.y + STEP_HEIGHT + 0.05);
  // Probe started inside the obstacle, so its top is higher than a step
  if (top === null || top < hit.y) return false;
  const front = groundBelow(world, hit.x + normal.x * 0.05, hit.z + normal.z * 0.05, hit.y);
  return top - (front ?? 0) <= STEP_HEIGHT;
}

/** Nearest near-vertical surface the body would run into, from a fan of rays across its width and height */
export function findWall(
  world: CANNON.World, x: number, feetY: number, z: number, dx: number, dz: number, probe: WallProbe,
): CANNON.Vec3 | null {
  const moveDist = Math.hypot(dx, dz);
  if (moveDist < 0.001) return null;
  const nx = dx / moveDist, nz = dz / moveDist;
  const reach = probe.radius + moveDist + 0.05;

  let nearest = Infinity;
  let normal: CANNON.Vec3 | null = null;
  const res = new CANNON.RaycastResult();
  for (const h of probe.heights) {
    for (const side of probe.sides) {
      const from = new CANNON.Vec3(x - nz * side * probe.radius, feetY + h, z + nx * side * probe.radius);
      const to = new CANNON.Vec3(from.x + nx * reach, from.y, from.z + nz * reach);
      res.reset();
      world.raycastClosest(from, to, { ...RAY, skipBackfaces: false }, res);
      // Slopes (ramps, quarter pipes) are ridden, not blocked
      if (!res.hasHit || Math.abs(res.hitNormalWorld.y) > 0.5) continue;
      if (res.hitNormalWorld.x * nx + res.hitNormalWorld.z * nz >= 0) continue; // exit face of something we're already leaving
      if (isStepUp(world, res.hitPointWorld, res.hitNormalWorld)) continue;
      if (res.distance < nearest) {
        nearest = res.distance;
        normal = res.hitNormalWorld.clone();
      }
    }
  }
  return nearest < probe.radius + moveDist ? normal : null;
}

/** Slides horizontal movement along any walls in the way; a second pass catches corners */
export function resolveWalls(
  world: CANNON.World, x: number, feetY: number, z: number, dx: number, dz: number, probe: WallProbe,
): [number, number] {
  for (let pass = 0; pass < 2; pass++) {
    const n = findWall(world, x, feetY, z, dx, dz, probe);
    if (!n) return [dx, dz];
    const dot = dx * n.x + dz * n.z;
    dx -= dot * n.x;
    dz -= dot * n.z;
  }
  return findWall(world, x, feetY, z, dx, dz, probe) ? [0, 0] : [dx, dz];
}
