import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import type { TrickAnim } from './Skater';

export interface SkaterAnimState {
  position: THREE.Vector3;
  yaw: number;
  speed: number;
  maxSpeed: number;
  isGrounded: boolean;
  isAirborne: boolean;
  isPushing: boolean;
  isBailing: boolean;
  lean: number;
  shock: number;
  trick: TrickAnim;
  trickProgress: number;
}

const B = {
  HIPS:    'mixamorigHips',
  SPINE1:  'mixamorigSpine1',
  HEAD:    'mixamorigHead',
  L_ARM:   'mixamorigLeftArm',
  R_ARM:   'mixamorigRightArm',
} as const;

const HALF_HEIGHT = 0.9;

export class SkaterModel {
  readonly group: THREE.Group;
  private mixer: THREE.AnimationMixer | null = null;
  private action: THREE.AnimationAction | null = null;
  private bones: Partial<Record<string, THREE.Bone>> = {};
  private _loaded = false;

  // Whole-body trick motion (spins, grab tilt) lives on the pivot; board flips on boardFlip
  private pivot: THREE.Group;
  private body: THREE.Group;
  private boardGroup: THREE.Group;
  private boardFlip: THREE.Group;

  get loaded() { return this._loaded; }

  constructor(scene: THREE.Scene, geometricSkater: THREE.Group) {
    this.group = new THREE.Group();
    scene.add(this.group);

    this.pivot = new THREE.Group();
    this.pivot.name = 'trickPivot';
    this.group.add(this.pivot);

    this.body = new THREE.Group();
    this.pivot.add(this.body);

    // ── Skateboard (always visible, aligned with travel direction) ─────────
    // Long axis along boardFlip's local X, so rotation.x there is a kickflip roll
    this.boardGroup = new THREE.Group();
    this.boardGroup.rotation.y = Math.PI / 2;
    this.boardGroup.position.y = -0.04; // slight clearance below feet
    this.boardFlip = this._buildBoard();
    this.boardFlip.name = 'boardFlip';
    this.boardGroup.add(this.boardFlip);
    this.pivot.add(this.boardGroup);

    // ── FBX character ──────────────────────────────────────────────────────
    const loader = new FBXLoader();
    loader.load(
      `${import.meta.env.BASE_URL}models/skater.fbx`,
      (fbx) => {
        fbx.scale.setScalar(0.01);

        // Strip root-motion position on hips so the physics body controls XZ.
        // Without this, the hips bone translates forward during the animation
        // and fights our per-frame group.position update, making the character
        // look frozen/twitching in place.
        for (const clip of fbx.animations) {
          clip.tracks = clip.tracks.filter(
            t => !(t.name.includes('Hips') && t.name.endsWith('.position')),
          );
        }

        fbx.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) child.castShadow = true;
          if ((child as THREE.Bone).isBone) this.bones[child.name] = child as THREE.Bone;
        });

        this.body.add(fbx);

        // Auto-correct Y so the character's feet land exactly on the board.
        // FBX bind pose feet are at box.min.y in group-local space; shift fbx
        // up so feet sit at y = 0 (board surface level).
        fbx.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(fbx);
        const footY = box.min.y;
        fbx.position.y -= footY;
        console.log('[SkaterModel] foot correction Y =', -footY.toFixed(3));
        console.log('[SkaterModel] clips:', fbx.animations.map(c => c.name));
        console.log('[SkaterModel] bones found:', Object.keys(this.bones).length);

        this.mixer = new THREE.AnimationMixer(fbx);
        if (fbx.animations.length > 0) {
          this.action = this.mixer.clipAction(fbx.animations[0]);
          this.action.setLoop(THREE.LoopRepeat, Infinity);
          this.action.play();
        }

        // Hide only the geometric body — board stays (we replaced it above).
        geometricSkater.visible = false;
        this._loaded = true;
      },
      undefined,
      (err) => console.error('[SkaterModel] load error', err),
    );
  }

  private _buildBoard(): THREE.Group {
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
    this._wheels = [];
    for (const [wx, wz] of [[0.28, 0.114], [0.28, -0.114], [-0.28, 0.114], [-0.28, -0.114]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.035, wz);
      g.add(wheel);
      this._wheels.push(wheel);
    }

    return g;
  }

  private _wheels: THREE.Mesh[] = [];

  private _applyTrick(trick: TrickAnim, t: number) {
    const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const arc  = Math.sin(t * Math.PI); // 0 → 1 → 0 over the trick

    this.boardFlip.rotation.set(0, 0, 0);
    this.boardFlip.position.y = 0;
    this.pivot.rotation.set(0, 0, 0);
    this.body.position.y = 0;

    switch (trick) {
      case 'kickflip':
        this.boardFlip.rotation.x = ease * Math.PI * 2;
        this.boardFlip.position.y = arc * 0.12;
        this.body.position.y = arc * 0.25; // feet lift off so the board can turn under them
        break;
      case 'heelflip':
        this.boardFlip.rotation.x = -ease * Math.PI * 2;
        this.boardFlip.position.y = arc * 0.12;
        this.body.position.y = arc * 0.25;
        break;
      case 'tre_flip':
        this.boardFlip.rotation.x = ease * Math.PI * 2;
        this.boardFlip.rotation.y = ease * Math.PI * 2;
        this.boardFlip.position.y = arc * 0.15;
        this.body.position.y = arc * 0.3;
        break;
      case 'ollie':
        this.boardFlip.rotation.z = -arc * 0.35; // tail snap, nose up
        break;
      case 'manual':
        this.boardFlip.rotation.z = -arc * 0.28;
        this.pivot.rotation.x = -arc * 0.1;
        break;
      case 'grab':
        this.boardFlip.position.y = arc * 0.3; // board pulled up to the hand
        this.pivot.rotation.x = arc * 0.25;
        break;
      case 'spin':
        this.pivot.rotation.y = ease * Math.PI * 2;
        break;
    }
  }

  update(delta: number, state: SkaterAnimState) {
    // Group tracks physics body
    this.group.position.copy(state.position);
    this.group.position.y -= HALF_HEIGHT;
    this.group.rotation.y = state.yaw;

    // Wheel spin
    const spin = state.speed * delta * 22;
    for (const w of this._wheels) w.rotation.y += spin;

    // Board tilt matches lean
    this.boardGroup.rotation.z = state.lean * 0.55;

    this._applyTrick(state.trick, state.trickProgress);

    if (!this._loaded || !this.mixer) return;

    // Scale animation to speed so idle doesn't look frantic
    if (this.action) {
      const speedRatio = state.speed / state.maxSpeed;
      this.action.timeScale = state.isAirborne ? 0.45 : 0.55 + speedRatio * 0.70;
    }

    this.mixer.update(delta);

    // ── Procedural overrides AFTER mixer (additive on top of clip) ──────────

    // Lean hips into turns (follow-through + arcs)
    const hips = this.bones[B.HIPS];
    if (hips) hips.rotation.z += state.lean * -0.18;

    // Spine crunch: speed aerodynamics + landing squash (squash & stretch)
    const spine1 = this.bones[B.SPINE1];
    if (spine1) {
      const target = (state.speed / state.maxSpeed) * 0.10 + state.shock * 0.25
        + (state.isAirborne ? -0.08 : 0);
      spine1.rotation.x += target;
    }

    // Head yaws into turn (overlapping action — head lags body)
    const head = this.bones[B.HEAD];
    if (head) head.rotation.y += state.lean * -0.30;

    // Grab: fold the upper body down toward the board
    if (spine1 && state.trick === 'grab') spine1.rotation.x += Math.sin(state.trickProgress * Math.PI) * 0.6;

    // Arms spread wider at speed (secondary action)
    const lArm = this.bones[B.L_ARM];
    const rArm = this.bones[B.R_ARM];
    if (lArm && rArm) {
      const spread = (state.speed / state.maxSpeed) * 0.22;
      lArm.rotation.z += spread;
      rArm.rotation.z -= spread;
    }
  }
}
