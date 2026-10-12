import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { TrickAnim } from './Skater';
import type { PushPhase } from './anim/PushCycle';
import { AnimStateMachine, type PoseFrame } from './anim/AnimStateMachine';
import { Rig } from './anim/Rig';
import { solveTwoBone } from './anim/FootIK';
import { STANCE_YAW, stanceSign, type Stance } from './anim/mirror';
import { easeInOut } from './anim/tricks';

export interface SkaterAnimState {
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  maxSpeed: number;
  isGrounded: boolean;
  isBailing: boolean;
  bailProgress: number;
  shock: number;
  trick: TrickAnim;
  trickProgress: number;
  pushState: { phase: PushPhase; phaseT: number; contactTravel: number; stride: number };
  turn: number;
  braking: boolean;
  grinding: boolean;
}

const HALF_HEIGHT = 0.9;
const DECK_TOP    = 0.0545;  // deck surface above the ground, board frame
const ANKLE_H     = 0.085;   // ankle bone above the sole
const FOOT_X      = 0.19;    // front and back feet from the board centre, over the bolts
const HEEL_OFFSET = 0.04;    // ankle sits behind the toes, toward the heel edge
const PLANT_SIDE  = 0.24;    // push foot lands this far out on the toe side
const PLANT_AHEAD = 0.32;    // and this far ahead of the board centre
const FRONT_FOOT_TURN = THREE.MathUtils.degToRad(55);

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);

export class SkaterModel {
  readonly group: THREE.Group;
  /** Spins: turns the body and board together */
  private pivot: THREE.Group;
  /** Turns the body sideways for the stance */
  private stanceRoot: THREE.Group;
  /** Bail fall, pivoting at the feet */
  private bodyTilt: THREE.Group;
  private boardGroup: THREE.Group;
  /** Pitch and lift; the feet follow this */
  private boardPitch: THREE.Group;
  /** Flips, shove-its and carve roll; the feet do not follow this */
  private boardFlip: THREE.Group;
  private frontMarker = new THREE.Object3D();
  private backMarker  = new THREE.Object3D();
  private wheels: THREE.Mesh[] = [];

  private machine = new AnimStateMachine();
  private rig: Rig | null = null;
  private stance: Stance = 'regular';
  private frame: PoseFrame | null = null;
  private _loaded = false;

  get loaded() { return this._loaded; }
  get cameraMoment(): boolean { return this.frame?.cameraMoment ?? false; }
  /** +1 when the chest faces the right of travel (regular), -1 for goofy */
  get chestSide(): number { return stanceSign(this.stance); }

  constructor(scene: THREE.Scene, geometricSkater: THREE.Group) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.pivot = new THREE.Group();
    this.pivot.name = 'trickPivot';
    this.group.add(this.pivot);

    this.stanceRoot = new THREE.Group();
    this.stanceRoot.name = 'stanceRoot';
    this.stanceRoot.position.y = DECK_TOP;
    this.pivot.add(this.stanceRoot);

    this.bodyTilt = new THREE.Group();
    this.stanceRoot.add(this.bodyTilt);

    // Board long axis is boardFlip local X with the nose at -X (travel is +Z)
    this.boardGroup = new THREE.Group();
    this.boardGroup.rotation.y = Math.PI / 2;
    this.pivot.add(this.boardGroup);
    this.boardPitch = new THREE.Group();
    this.boardGroup.add(this.boardPitch);
    this.boardFlip = this.buildBoard();
    this.boardFlip.name = 'boardFlip';
    this.boardPitch.add(this.boardFlip);
    this.boardPitch.add(this.frontMarker, this.backMarker);
    this.setStance('regular');

    new FBXLoader().load(
      `${import.meta.env.BASE_URL}models/skater.fbx`,
      (fbx) => {
        fbx.scale.setScalar(0.01);
        fbx.animations = [];
        fbx.traverse((child) => { if ((child as THREE.Mesh).isMesh) child.castShadow = true; });
        this.bodyTilt.add(fbx);
        fbx.updateWorldMatrix(true, true);
        fbx.position.y -= new THREE.Box3().setFromObject(fbx).min.y - this.bodyTilt.getWorldPosition(_v1).y;
        this.rig = new Rig(fbx);
        this.rig.setStance(this.stance);
        geometricSkater.visible = false;
        this._loaded = true;
      },
      undefined,
      (err) => console.error('[SkaterModel] load error', err),
    );
  }

  setStance(stance: Stance): void {
    this.stance = stance;
    this.stanceRoot.rotation.y = STANCE_YAW[stance];
    const heel = HEEL_OFFSET * stanceSign(stance);
    this.frontMarker.position.set(-FOOT_X, DECK_TOP + ANKLE_H, heel);
    this.backMarker.position.set(FOOT_X, DECK_TOP + ANKLE_H, heel);
    this.rig?.setStance(stance);
  }

  update(delta: number, state: SkaterAnimState) {
    this.group.position.set(state.position.x, state.position.y - HALF_HEIGHT, state.position.z);
    this.group.rotation.y = state.yaw;

    const f = this.machine.update(delta, {
      speed: state.speed, maxSpeed: state.maxSpeed, grounded: state.isGrounded,
      pushPhase: state.pushState.phase, turn: state.turn, braking: state.braking,
      grinding: state.grinding, bailing: state.isBailing, bailProgress: state.bailProgress,
      trick: state.trick, trickProgress: state.trickProgress, shock: state.shock, stance: this.stance,
    });
    this.frame = f;
    const sign = stanceSign(this.stance);

    this.pivot.rotation.y = f.spin * Math.PI * 2 * sign;
    this.bodyTilt.rotation.x = f.pivotPitch;
    this.boardPitch.position.y = f.board.lift;
    this.boardPitch.rotation.z = -f.board.pitch;
    // Chest side is board local -Z for regular; a negative roll there drops the toe edge
    this.boardFlip.rotation.set(f.board.flip * Math.PI * 2 * sign - f.board.roll * sign, f.board.shove * Math.PI * 2 * sign, 0);

    const spin = state.speed * delta * 22;
    for (const w of this.wheels) w.rotation.y += spin;

    if (!this.rig) return;
    this.rig.applyPose(f.joints);
    this.rig.setHipDrop(f.hipDrop);
    this.group.updateMatrixWorld(true);

    if (state.isBailing) { this.rig.resetLegs(); return; }
    this.placeFoot('front', f, state);
    this.placeFoot('back', f, state);
  }

  private placeFoot(limb: 'front' | 'back', f: PoseFrame, state: SkaterAnimState): void {
    const rig = this.rig!;
    const marker = limb === 'front' ? this.frontMarker : this.backMarker;
    const lift = limb === 'front' ? f.frontLift : f.backLift;
    const target = marker.getWorldPosition(new THREE.Vector3()).addScaledVector(UP, lift);
    const footRot = rig.restFootWorld(limb, new THREE.Quaternion());

    const push = state.pushState;
    const pushing = limb === 'back' && push.phase !== 'none' && !state.isBailing;
    if (pushing) {
      this.pushFootTarget(push, target);
    } else {
      // Feet ride the board's pitch: rotate from the neutral board frame to the pitched one
      const neutral = this.boardGroup.getWorldQuaternion(_q1);
      const pitched = this.boardPitch.getWorldQuaternion(_q2);
      footRot.premultiply(pitched.multiply(neutral.invert()));
    }
    if (limb === 'front' && f.pushWeight > 0.01) {
      footRot.premultiply(_q1.setFromAxisAngle(UP, FRONT_FOOT_TURN * f.pushWeight * stanceSign(this.stance)));
    }

    const pole = _v1.set(0, 0, 1).applyQuaternion(this.stanceRoot.getWorldQuaternion(_q2)).normalize();
    const hip = rig.hipWorld(limb, _v2);
    const { upper, lower } = rig.legLengths();
    const { knee, ankle } = solveTwoBone(hip, target, pole, upper, lower);
    rig.aimLeg(limb, knee, ankle, pole, footRot);
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

  private buildBoard(): THREE.Group {
    const g = new THREE.Group();
    const deckMat  = new THREE.MeshStandardMaterial({ color: 0xd2a8ff });
    const kickMat  = new THREE.MeshStandardMaterial({ color: 0xb888e8 });
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.7, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.033, 0.20), deckMat);
    deck.position.y = 0.038;
    deck.castShadow = true;
    g.add(deck);

    const noseKick = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.033, 0.20), kickMat);
    noseKick.position.set(0.42, 0.052, 0);
    noseKick.rotation.z = -0.32;
    g.add(noseKick);

    const tailKick = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.033, 0.20), kickMat);
    tailKick.position.set(-0.42, 0.052, 0);
    tailKick.rotation.z = 0.32;
    g.add(tailKick);

    const truckGeo = new THREE.BoxGeometry(0.06, 0.028, 0.22);
    for (const tx of [0.28, -0.28]) {
      const truck = new THREE.Mesh(truckGeo, truckMat);
      truck.position.set(tx, 0.018, 0);
      g.add(truck);
    }

    const wheelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.046, 10);
    for (const [wx, wz] of [[0.28, 0.114], [0.28, -0.114], [-0.28, 0.114], [-0.28, -0.114]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.035, wz);
      g.add(wheel);
      this.wheels.push(wheel);
    }
    return g;
  }
}
