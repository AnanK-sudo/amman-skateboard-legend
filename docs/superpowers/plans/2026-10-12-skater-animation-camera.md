# Skater Animation and Camera Implementation Plan

> Executed inline by the session that wrote it (Anan away, full go for build, push and deploy). Steps use TDD: failing test, implement, pass, commit per task.

**Goal:** Procedural full-body skater animation (all states, tricks, speed-true pushing, regular/goofy) and a Tony Hawk style camera with big-move swoops.

**Architecture:** Pose library plus blending (approach A). Data poses in character rest space are applied to the Mixamo skeleton through identity child "slot" bones; legs are placed by a two-bone IK on markers attached to the board; a physics-owned push cycle drives thrust and the push foot.

**Tech Stack:** Three.js, cannon-es, Vite, TypeScript strict, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-12-skater-animation-camera-design.md`

## Global Constraints

- Character rest space: faces +Z, +X is the character's left, +Y up. Pose angles in degrees, Euler XYZ.
- Group space: travel is +Z. Board long axis is boardFlip local X with the nose at local -X.
- Regular rides left foot forward, stance root yaw -90 deg; goofy mirrors (front limbs on Right bones, negate Y and Z pose angles), yaw +90 deg.
- No new dependencies. No comments unless the why is non-obvious. No emojis.

## Review Focus

1. Push with the forward key tapped and released mid-stroke: the foot must finish the stroke or return, never freeze on the ground. Test in Task 1.
2. Pushing at max speed: no new stroke starts, the rider settles into the ride pose. Test in Task 1.
3. Stance switched while rolling: the rig re-maps bones and the next frame is valid (no stale rotation on the old side). Test in Task 5.
4. Out-of-reach foot targets (deep tuck, board far below on landing): legs clamp straight, no NaN. Test in Task 4.
5. FBX not loaded yet (first frames): SkaterModel.update must run without the rig. Test in Task 6.

---

### Task 1: PushCycle and thrust only during contact

**Files:** Create `src/player/anim/PushCycle.ts`; modify `src/player/Skater.ts`; test `tests/player/PushCycle.test.ts`, `tests/player/Skater.test.ts`.

**Produces:**
```ts
export type PushPhase = 'none' | 'reach' | 'contact' | 'return';
export class PushCycle {
  readonly phase: PushPhase; readonly phaseT: number; readonly contactTravel: number; readonly stride: number;
  update(dt: number, speed: number, wantPush: boolean, atMax: boolean): boolean; // true while thrusting
}
```
Skater: `get pushState(): { phase: PushPhase; phaseT: number; contactTravel: number; stride: number }`, `isPushing` = phase !== 'none'.

Tests: contact travel equals integrated speed (foot world speed zero); thrust only in contact; contact time shorter at higher speed; no new stroke at max speed; releasing the key mid-contact moves to return then none; holding W from rest reaches at least 8 m/s in 2 s.

### Task 2: Skater exposes animation facts and stretches trick duration

**Files:** modify `src/player/Skater.ts`; test `tests/player/Skater.test.ts`.

**Produces:** `turnInput: number`, `braking: boolean`, `bailProgress: number`, `trickDuration` set from expected airtime (`2v/g` from the ground, remaining flight when airborne), clamped 0.35 to 0.8 s; manual 0.6 s. The geometric skater's trick posing switch is deleted; the timer stays.

Tests: kickflip from the ground lasts about 85 percent of the ollie airtime; bailProgress runs 0 to 1.

### Task 3: Pose data, mirroring, tricks, state machine

**Files:** create `src/player/anim/mirror.ts`, `poses.ts`, `tricks.ts`, `AnimStateMachine.ts`; test `tests/player/AnimStateMachine.test.ts`.

**Produces:**
```ts
export type Stance = 'regular' | 'goofy';
export type Joint = 'hips'|'spine'|'spine1'|'spine2'|'neck'|'head'|'frontArm'|'frontForeArm'|'backArm'|'backForeArm';
export type Vec3 = [number, number, number];
export type JointPose = Partial<Record<Joint, Vec3>>;
export const STANCE_YAW: Record<Stance, number>;
export function boneName(joint: Joint, stance: Stance): string;
export function mirrorPose(p: JointPose): JointPose;
export type BaseState = 'idle'|'push'|'ride'|'carve'|'brake'|'pop'|'air'|'land'|'grind'|'manual'|'bail';
export interface AnimInput { speed; maxSpeed; grounded; pushPhase; turn; braking; grinding; bailing; bailProgress; trick; trickProgress; shock; stance }
export interface BoardPose { flip; shove; pitch; lift; roll }
export interface PoseFrame { state: BaseState; joints: JointPose; hipDrop: number; frontLift: number; backLift: number; board: BoardPose; pivotPitch: number; spin: number; cameraMoment: boolean; pushWeight: number }
export class AnimStateMachine { update(dt: number, input: AnimInput): PoseFrame }
```
Tests: state per snapshot (idle, push, ride, carve, brake, pop, air, land, grind, bail); camera moment true for kickflip, spin, grab, grind and false for ollie, manual, riding; kickflip board flip reaches a full turn at progress 1; goofy output equals mirrored regular joints.

### Task 4: Two-bone IK solver

**Files:** create `src/player/anim/FootIK.ts`; test `tests/player/FootIK.test.ts`.

**Produces:** `solveTwoBone(hip: Vector3, target: Vector3, pole: Vector3, upper: number, lower: number): { knee: Vector3; ankle: Vector3 }`.

Tests: reachable target hit within 1 cm with both segment lengths preserved; knee offset points along the pole; unreachable target clamps to a straight leg along the hip-target line; target at the hip returns finite values.

### Task 5: Rig

**Files:** create `src/player/anim/Rig.ts`; test `tests/player/Rig.test.ts` (parses `public/models/skater.fbx`).

**Produces:**
```ts
export class Rig {
  constructor(fbxRoot: THREE.Object3D);
  setStance(s: Stance): void;
  applyPose(joints: JointPose): void;      // writes slot quaternions, unmentioned joints reset
  setHipDrop(meters: number): void;
  legLengths(): { upper: number; lower: number };
  hipWorld(side: 'front'|'back', out: Vector3): Vector3;
  aimLeg(side: 'front'|'back', knee: Vector3, ankle: Vector3, pole: Vector3, footWorld: Quaternion): void;
}
```
Tests: arm-down pose puts the front hand below its shoulder; a spine lean moves the head toward +Z; goofy maps front limbs to Right bones; switching stance resets the old side; aimLeg places the ankle bone at the requested point within 2 cm.

### Task 6: SkaterModel coordinator

**Files:** modify `src/player/SkaterModel.ts`, `src/main.ts`; test `tests/player/SkaterModel.test.ts`.

Hierarchy `group > trickPivot > stanceRoot > fbx`, board under `trickPivot` with foot markers on `boardFlip`. Each frame: state machine, rig pose and hip drop, IK for both feet (deck markers, or the push path for the back foot), board transform, spin and bail pitch. Mixer removed. Exposes `cameraMoment`.

Tests: kickflip still rolls the board; spin rotates the pivot; neutral resets; update runs before the FBX loads; stance root yaw follows stance.

### Task 7: Camera framing and big-move swoop

**Files:** modify `src/player/Camera.ts`, `src/main.ts`; test `tests/player/Camera.test.ts`.

`update(delta, target, speed, maxSpeed, skaterYaw, moment = false, chestSide = 1)`. Chase distance 4.2 (+1.5 with speed), pitch 0.2, look height 1.0. Moment: distance 3.0, swing 40 deg toward the chest side, pitch 0.12, ease in 0.35 s, out 0.6 s.

Tests: settles behind at the chase distance; with a moment it ends closer and displaced toward the chest side; returns behind after the moment ends.

### Task 8: Stance setting

**Files:** modify `src/progression/SaveManager.ts`, `src/ui/CustomizeMenu.ts`, `src/main.ts`; test `tests/progression/SaveManager.test.ts` if present, else extend an existing progression test.

Save field `stance` (default regular), a STANCE toggle button in Customize, applied to the model on change and on load.

### Task 9: Visual verification and tuning

Headless screenshots (playwright-core, system Chrome, swiftshader) of idle, push, ride, air, kickflip, grab, grind, manual in both stances; tune pose numbers until each reads correctly. Full suite, typecheck, build.

### Task 10: Ship

Commit, push with the ephemeral helper, `npx vercel --prod --yes`, wait for the Pages workflow, verify both bundles, update memory.
