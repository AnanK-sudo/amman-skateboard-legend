import { describe, it, expect } from 'vitest';
import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RiderMode, type ModeInput } from '@/player/RiderMode';
import { Skater, type SkaterInput } from '@/player/Skater';
import { Board } from '@/player/board/Board';
import { Walker } from '@/player/Walker';

function world(): CANNON.World {
  const w = new CANNON.World();
  const g = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  g.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  w.addBody(g);
  return w;
}
const ride: SkaterInput = { forward: true, backward: false, left: false, right: false, ollieHeld: false, spinLeft: false, spinRight: false };
const idle: ModeInput = { walk: { forward: false, back: false, left: false, right: false, jog: false }, mount: false };

function setup() {
  const w = world();
  const skater = new Skater(w, { x: 0, y: 0.9, z: 0 });
  const mode = new RiderMode(skater, new Board(), new Walker(), () => 0.5);
  for (let i = 0; i < 90; i++) { w.step(1 / 60); skater.update(1 / 60, ride); }
  return { w, skater, mode };
}
function step(mode: RiderMode, w: CANNON.World, seconds: number, input: Partial<ModeInput> = {}, cameraYaw = 0): void {
  for (let t = 0; t < seconds; t += 1 / 60) { w.step(1 / 60); mode.update(1 / 60, { ...idle, ...input }, cameraYaw, w); }
}

describe('RiderMode', () => {
  it('bails: rider and board separate, the board slides on ahead', () => {
    const { w, skater, mode } = setup();
    const at = skater.position.clone();
    mode.bail('unfinished');
    expect(mode.mode).toBe('bailing');
    step(mode, w, 1);
    expect(mode.board.position.distanceTo(new THREE.Vector3(at.x, 0, at.z))).toBeGreaterThan(2);
    expect(mode.riderFeet.distanceTo(new THREE.Vector3(at.x, 0, at.z))).toBeLessThan(2.2);
  });

  it('gets up and walks after the fall, then hops back on with E near the board', () => {
    const { w, mode, skater } = setup();
    mode.bail('crooked');
    step(mode, w, 1.7);
    expect(mode.mode).toBe('walking');
    step(mode, w, 10); // let the board settle
    expect(mode.canMount).toBe(false);
    // Walk straight at the board: put the camera behind the walker relative to the board
    for (let i = 0; i < 1200 && !mode.canMount; i++) {
      const toBoard = mode.board.position.clone().sub(mode.walker.position);
      const cameraYaw = Math.atan2(-toBoard.x, -toBoard.z);
      step(mode, w, 1 / 60, { walk: { ...idle.walk, forward: true, jog: true } }, cameraYaw);
    }
    expect(mode.canMount).toBe(true);
    step(mode, w, 1 / 60, { mount: true });
    expect(mode.mode).toBe('mounting');
    step(mode, w, 0.6);
    expect(mode.mode).toBe('riding');
    expect(skater.speed).toBe(0);
    expect(skater.position.distanceTo(mode.board.position.clone().setY(0.9))).toBeLessThan(0.1);
  });

  it('ignores E when far from the board, and while riding', () => {
    const { w, mode } = setup();
    step(mode, w, 0.1, { mount: true });
    expect(mode.mode).toBe('riding');
    mode.bail('wall');
    step(mode, w, 1.7);
    step(mode, w, 0.1, { mount: true });
    expect(mode.mode).toBe('walking');
  });

  it('respawns the board beside the walker when it is lost', () => {
    const { w, mode } = setup();
    mode.bail('drop');
    step(mode, w, 1.7);
    mode.board.launch(new THREE.Vector3(0, -20, 0), new THREE.Vector3(), 0, 0, false);
    step(mode, w, 3.2);
    expect(mode.board.position.distanceTo(mode.walker.position)).toBeLessThan(1.3);
    expect(mode.canMount).toBe(true);
  });

  it('puts rider and board back at the spawn on a zone switch', () => {
    const { w, mode, skater } = setup();
    mode.bail('manual');
    step(mode, w, 2);
    mode.resetToSpawn({ x: 3, y: 0, z: 4 }, Math.PI);
    expect(mode.mode).toBe('riding');
    expect(skater.position.x).toBe(3);
  });
});
