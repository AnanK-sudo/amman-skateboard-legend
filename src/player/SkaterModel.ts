import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { TrickAnim } from './Skater';
import type { PushPhase } from './anim/PushCycle';
import type { Mode } from './RiderMode';
import type { BailReason } from './LandingJudge';
import { AnimStateMachine, type PoseFrame } from './anim/AnimStateMachine';
import { Rig } from './anim/Rig';
import { solveTwoBone } from './anim/FootIK';
import { STANCE_YAW, stanceSign, type Stance } from './anim/mirror';
import { easeInOut } from './anim/tricks';
import { BOARD, buildBoard, type BoardRig } from './board/BoardMesh';
import { deckById } from '../world/decks';

export interface SkaterAnimState {
  mode: Mode;
  /** Feet position and heading of the body */
  feet: THREE.Vector3;
  yaw: number;
  speed: number;
  maxSpeed: number;
  isGrounded: boolean;
  shock: number;
  trick: TrickAnim;
  trickProgress: number;
  pushState: { phase: PushPhase; phaseT: number; contactTravel: number; stride: number };
  turn: number;
  braking: boolean;
  grinding: boolean;
  grindType: string | null;
  crouch: number;
  manualBalance: number | null;
  /** Signed radians of spin this air */
  spinAngle: number;
  fakie: boolean;
  bailReason: BailReason | null;
  bailProgress: number;
  mountProgress: number;
  walkSpeed: number;
  stridePhase: number;
  /** The free board while not riding */
  board: { position: THREE.Vector3; yaw: number; wheelsUp: boolean; speed: number };
}

const ANKLE_H     = 0.085;   // ankle bone above the sole
const HEEL_OFFSET = 0.04;    // ankle sits behind the toes, toward the heel edge
const PLANT_SIDE  = 0.24;    // push foot lands this far out on the toe side
const PLANT_AHEAD = 0.25;    // and just ahead of the front truck
const HIP_WIDTH   = 0.1;
const STEP_LIFT   = 0.09;
const UP = new THREE.Vector3(0, 1, 0);

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();

export class SkaterModel {
  readonly group: THREE.Group;
  /** Spins and grind turns: body only; the board follows it while riding */
  private pivot: THREE.Group;
  /** Turns the body sideways for the stance */
  private stanceRoot: THREE.Group;
  /** Bail falls, pivoting at the feet */
  private bodyTilt: THREE.Group;
  /** The board lives in the scene so it can leave the rider */
  private boardRoot: THREE.Group;
  private boardGroup: THREE.Group;
  /** Pitch and lift; the feet follow this */
  private boardPitch: THREE.Group;
  /** Flips, shove-its, wraps and carve roll; the feet do not follow this */
  private boardFlip: THREE.Group;
  private board: BoardRig;
  private frontMarker = new THREE.Object3D();
  private backMarker  = new THREE.Object3D();

  private machine = new AnimStateMachine();
  private rig: Rig | null = null;
  private fbxMaterials: THREE.MeshStandardMaterial[] = [];
  private baseStance: Stance = 'regular';
  private stance: Stance = 'regular';
  private frame: PoseFrame | null = null;
  private _loaded = false;

  get loaded() { return this._loaded; }
  get cameraMoment(): boolean { return this.frame?.cameraMoment ?? false; }
  /** +1 when the chest faces the right of travel (regular), -1 for goofy */
  get chestSide(): number { return stanceSign(this.stance); }

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.pivot = new THREE.Group();
    this.pivot.name = 'trickPivot';
    this.group.add(this.pivot);

    this.stanceRoot = new THREE.Group();
    this.stanceRoot.name = 'stanceRoot';
    this.pivot.add(this.stanceRoot);

    this.bodyTilt = new THREE.Group();
    this.stanceRoot.add(this.bodyTilt);

    // Board frame: long axis is boardFlip local X with the nose at -X; boardRoot travels +Z
    this.boardRoot = new THREE.Group();
    scene.add(this.boardRoot);
    this.boardGroup = new THREE.Group();
    this.boardGroup.rotation.y = Math.PI / 2;
    this.boardRoot.add(this.boardGroup);
    this.boardPitch = new THREE.Group();
    this.boardGroup.add(this.boardPitch);
    this.boardFlip = new THREE.Group();
    this.boardFlip.name = 'boardFlip';
    this.boardPitch.add(this.boardFlip);
    this.board = buildBoard(deckById('default'));
    this.boardFlip.add(this.board.root);
    this.boardPitch.add(this.frontMarker, this.backMarker);
    this.setStance('regular');

    new FBXLoader().load(
      `${import.meta.env.BASE_URL}models/skater.fbx`,
      (fbx) => {
        fbx.scale.setScalar(0.01);
        fbx.animations = [];
        fbx.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
            if ((m as THREE.MeshStandardMaterial).color) this.fbxMaterials.push(m as THREE.MeshStandardMaterial);
          }
        });
        this.bodyTilt.add(fbx);
        fbx.updateWorldMatrix(true, true);
        fbx.position.y -= new THREE.Box3().setFromObject(fbx).min.y - this.bodyTilt.getWorldPosition(_v1).y;
        this.rig = new Rig(fbx);
        this.rig.setStance(this.stance);
        this._loaded = true;
      },
      undefined,
      (err) => console.error('[SkaterModel] load error', err),
    );
  }

  setStance(stance: Stance): void {
    this.baseStance = stance;
    this.applyStance(stance);
  }

  setDeck(id: string): void { this.board.setDeck(deckById(id)); }

  /** Tints the character (Customize presets) */
  setBodyColor(hex: number): void { for (const m of this.fbxMaterials) m.color.setHex(hex); }

  private applyStance(stance: Stance): void {
    this.stance = stance;
    const heel = HEEL_OFFSET * stanceSign(stance);
    this.frontMarker.position.set(-BOARD.TRUCK_X, BOARD.DECK_TOP + ANKLE_H, heel);
    this.backMarker.position.set(BOARD.TRUCK_X, BOARD.DECK_TOP + ANKLE_H, heel);
    this.rig?.setStance(stance);
  }

  update(delta: number, state: SkaterAnimState) {
    // Riding fakie looks exactly like the opposite stance
    const effective: Stance = state.fakie === (this.baseStance === 'regular') ? 'goofy' : 'regular';
    if (effective !== this.stance) this.applyStance(effective);
    const sign = stanceSign(this.stance);
    const riding = state.mode === 'riding';

    const f = this.machine.update(delta, {
      mode: state.mode, speed: state.speed, maxSpeed: state.maxSpeed, grounded: state.isGrounded,
      pushPhase: state.pushState.phase, turn: state.turn, braking: state.braking,
      grinding: state.grinding, grindType: state.grindType,
      bailReason: state.bailReason, bailProgress: state.bailProgress, mountProgress: state.mountProgress,
      walkSpeed: state.walkSpeed, stridePhase: state.stridePhase,
      trick: state.trick, trickProgress: state.trickProgress, shock: state.shock, crouch: state.crouch,
      manualBalance: state.manualBalance, stance: this.stance,
    });
    this.frame = f;

    this.group.position.copy(state.feet);
    this.group.rotation.y = state.yaw;
    this.pivot.rotation.y = riding ? state.spinAngle + f.grindYaw * Math.PI * 2 * sign : 0;
    this.stanceRoot.rotation.y = f.stand * (STANCE_YAW[this.stance] + f.bodyYaw * sign);
    this.stanceRoot.position.y = BOARD.DECK_TOP * f.stand;
    this.bodyTilt.rotation.set(f.pivotPitch, 0, f.pivotRoll * sign);

    this.placeBoard(f, state, sign, delta);

    if (!this.rig) return;
    this.rig.applyPose(f.joints);
    this.rig.setHipDrop(f.hipDrop);
    this.group.updateMatrixWorld(true);
    this.boardRoot.updateMatrixWorld(true);

    if (f.state === 'bail') { this.rig.resetLegs(); return; }
    if (f.state === 'walk' || f.state === 'getup') {
      this.walkFoot('front', state);
      this.walkFoot('back', state);
      return;
    }
    if (f.state === 'mount') {
      this.mountFoot('front', state);
      this.mountFoot('back', state);
      return;
    }
    this.rideFoot('front', f, state);
    this.rideFoot('back', f, state);
  }

  private placeBoard(f: PoseFrame, state: SkaterAnimState, sign: number, delta: number): void {
    if (state.mode === 'riding') {
      this.pivot.updateWorldMatrix(true, false);
      this.pivot.matrixWorld.decompose(this.boardRoot.position, this.boardRoot.quaternion, _v1);
      this.board.roll(state.speed * delta);
    } else {
      const b = state.board;
      // A wheels-up board flips back over during the first part of the hop on
      const upside = b.wheelsUp ? (state.mode === 'mounting' ? 1 - Math.min(state.mountProgress / 0.4, 1) : 1) : 0;
      this.boardRoot.position.copy(b.position);
      this.boardRoot.position.y += upside * (BOARD.DECK_TOP + 0.03);
      this.boardRoot.quaternion.setFromAxisAngle(UP, b.yaw).multiply(_q1.setFromAxisAngle(new THREE.Vector3(0, 0, 1), upside * Math.PI));
      this.board.roll(b.speed * delta);
    }

    this.boardPitch.position.y = f.board.lift;
    this.boardPitch.rotation.z = -f.board.pitch;
    // Impossible: wrap end over end around the back foot
    const wrap = f.board.wrap * Math.PI * 2 * sign;
    const pivotX = BOARD.TRUCK_X, pivotY = BOARD.DECK_TOP;
    this.boardFlip.position.set(pivotX - (pivotX * Math.cos(wrap) - pivotY * Math.sin(wrap)), pivotY - (pivotX * Math.sin(wrap) + pivotY * Math.cos(wrap)), 0);
    // Chest side is board local -Z for regular; a negative roll there drops the toe edge
    this.boardFlip.rotation.set(f.board.flip * Math.PI * 2 * sign - f.board.roll * sign, f.board.shove * Math.PI * 2 * sign, wrap);
    this.board.setSteer(f.board.roll * 0.5 * sign);
    this.board.setDip(state.mode === 'riding' ? state.shock * 0.008 : 0);
  }

  private pole(): THREE.Vector3 {
    return _v1.set(0, 0, 1).applyQuaternion(this.stanceRoot.getWorldQuaternion(_q2)).normalize().clone();
  }

  private aim(limb: 'front' | 'back', target: THREE.Vector3, footRot: THREE.Quaternion): void {
    const rig = this.rig!;
    const pole = this.pole();
    const hip = rig.hipWorld(limb, _v2);
    const { upper, lower } = rig.legLengths();
    const { knee, ankle } = solveTwoBone(hip, target, pole, upper, lower);
    rig.aimLeg(limb, knee, ankle, pole, footRot);
  }

  private rideFoot(limb: 'front' | 'back', f: PoseFrame, state: SkaterAnimState): void {
    const marker = limb === 'front' ? this.frontMarker : this.backMarker;
    const lift = limb === 'front' ? f.frontLift : f.backLift;
    const target = marker.getWorldPosition(new THREE.Vector3()).addScaledVector(UP, lift);
    const footRot = this.rig!.restFootWorld(limb, new THREE.Quaternion());

    const push = state.pushState;
    if (limb === 'back' && push.phase !== 'none') {
      this.pushFootTarget(push, target);
    } else {
      // Feet ride the board's pitch: rotate from the neutral board frame to the pitched one
      const neutral = this.boardGroup.getWorldQuaternion(_q1);
      const pitched = this.boardPitch.getWorldQuaternion(_q2);
      footRot.premultiply(pitched.multiply(neutral.invert()));
    }
    if (limb === 'front' && f.frontFootYaw > 0.001) {
      footRot.premultiply(_q1.setFromAxisAngle(UP, f.frontFootYaw * stanceSign(this.stance)));
    }
    this.aim(limb, target, footRot);
  }

  /** Back foot path while pushing, in the pivot frame (travel +Z); the planted foot stays fixed on the ground */
  private pushFootTarget(push: SkaterAnimState['pushState'], out: THREE.Vector3): void {
    const deck = this.pivot.worldToLocal(out.clone());
    const chestX = -stanceSign(this.stance);
    const plant = new THREE.Vector3(chestX * PLANT_SIDE, ANKLE_H, PLANT_AHEAD);
    const end = plant.clone().setZ(PLANT_AHEAD - push.stride);
    const t = easeInOut(push.phaseT);
    let p: THREE.Vector3;
    switch (push.phase) {
      case 'reach':
        p = deck.clone().lerp(plant, t);
        p.y += 0.12 * Math.sin(Math.PI * push.phaseT);
        break;
      case 'contact':
        p = plant.clone().setZ(PLANT_AHEAD - push.contactTravel);
        break;
      default:
        p = end.clone().lerp(deck, t);
        p.y += 0.16 * Math.sin(Math.PI * push.phaseT);
    }
    out.copy(this.pivot.localToWorld(p));
  }

  /** Walk cycle foot in the body frame (facing +Z): the stance foot slides back, the swing foot steps through */
  private walkFootLocal(limb: 'front' | 'back', state: SkaterAnimState): THREE.Vector3 {
    const stride = Math.min(state.walkSpeed / 1.6, 1.8) * 0.32;
    const phase = state.stridePhase + (limb === 'front' ? 0 : Math.PI);
    const side = (limb === 'front' ? 1 : -1) * stanceSign(this.stance) * HIP_WIDTH;
    return new THREE.Vector3(side, ANKLE_H + Math.max(0, Math.sin(phase)) * STEP_LIFT * (stride > 0.01 ? 1 : 0), Math.cos(phase) * stride);
  }

  private walkFoot(limb: 'front' | 'back', state: SkaterAnimState): void {
    const target = this.group.localToWorld(this.walkFootLocal(limb, state));
    this.aim(limb, target, this.rig!.restFootWorld(limb, new THREE.Quaternion()));
  }

  /** Front foot steps onto its bolt in the first half, then the back foot hops on */
  private mountFoot(limb: 'front' | 'back', state: SkaterAnimState): void {
    const t = state.mountProgress;
    const u = limb === 'front' ? Math.min(t / 0.5, 1) : Math.max(0, (t - 0.5) / 0.5);
    const from = this.group.localToWorld(this.walkFootLocal(limb, { ...state, walkSpeed: 0 }));
    const onBoard = (limb === 'front' ? this.frontMarker : this.backMarker).getWorldPosition(new THREE.Vector3());
    const target = from.lerp(onBoard, easeInOut(u)).addScaledVector(UP, Math.sin(Math.PI * u) * 0.14);
    this.aim(limb, target, this.rig!.restFootWorld(limb, new THREE.Quaternion()));
  }
}
