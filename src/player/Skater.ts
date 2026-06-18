import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface SkaterInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  ollie: boolean;
  trick1: boolean;
  trick2: boolean;
  grind: boolean;
  grab: boolean;
  manual: boolean;
  cameraYaw: number;
}

export type TrickAnim = 'none' | 'kickflip' | 'heelflip' | 'tre_flip' | 'ollie' | 'manual' | 'grab' | 'spin';

const BAIL_FALL   = 0.35;
const BAIL_GROUND = 0.65;
const BAIL_GETUP  = 0.50;
const BAIL_TOTAL  = BAIL_FALL + BAIL_GROUND + BAIL_GETUP;

// ─────────────────────────────────────────────────────────────────────────────
// Real-skater stance breakdown:
//   • Feet / board:   fully sideways   (stanceGroup Y = +90°)
//   • Lower body:     mostly sideways  (lowerGroup  Y =   0° offset from stance)
//   • Torso / arms:   open ~45° fwd   (upperGroup  Y = -50° from stance → net +40°)
//   • Head:           nearly forward   (head        Y = -30° extra  → net +10°)
// This means you can see where you're going while your feet ride sideways.
// ─────────────────────────────────────────────────────────────────────────────

export class Skater {
  readonly body: CANNON.Body;
  readonly mesh: THREE.Group;

  private stanceGroup: THREE.Group;   // +90° Y — feet face perpendicular to travel
  private innerGroup:  THREE.Group;   // lean / tilt / trick animations live here
  private lowerGroup:  THREE.Group;   // legs + board (fully sideways)
  private upperGroup:  THREE.Group;   // torso / arms / head (opened toward front)

  private boardGroup: THREE.Group;
  private pelvisGroup: THREE.Group;

  // Articulated legs: hip → thigh → knee → shin → ankle → foot
  private leftHip:   THREE.Group;
  private rightHip:  THREE.Group;
  private leftKnee:  THREE.Group;
  private rightKnee: THREE.Group;
  private leftAnkle: THREE.Group;
  private rightAnkle:THREE.Group;

  private leftThigh:  THREE.Mesh;
  private rightThigh: THREE.Mesh;
  private leftShin:   THREE.Mesh;
  private rightShin:  THREE.Mesh;
  private leftFoot:   THREE.Mesh;
  private rightFoot:  THREE.Mesh;

  private torso: THREE.Mesh;
  private head:  THREE.Mesh;
  private leftArm:  THREE.Mesh;
  private rightArm: THREE.Mesh;

  private wheels: THREE.Mesh[] = [];

  // Bail
  private _isBailing  = false;
  private bailTimer   = 0;
  private bailBoardX  = 0;

  // Movement
  private _yaw        = 0;
  private _speed      = 0;
  readonly maxSpeed   = 15;
  private pushForce   = 12;
  private brakeForce  = 15;
  private turnSpeed   = 2.5;
  private ollieImpulse = 6;

  // Trick
  private trickAnim:     TrickAnim = 'none';
  private trickTimer     = 0;
  private trickDuration  = 0.4;

  // Animation state
  private animTime    = 0;
  private currentLean = 0;
  private currentTilt = 0;
  private pushPhase   = 0;
  private isPushing   = false;
  private pumpAmount  = 0;       // bowl pump: positive = extend, negative = crouch
  private landingShock = 0;     // 0–1, peaks at landing, decays fast
  private prevGroundY  = 0;

  // Physics
  private readonly HALF_HEIGHT        = 0.9;
  private readonly AIRBORNE_THRESHOLD = 0.3;
  private world:       CANNON.World;
  private groundY:     number = 0;
  private verticalVel: number = 0;
  private airborne:    boolean = false;

  private _positionVec = new THREE.Vector3();

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    this.world = world;

    this.body = new CANNON.Body({
      type: CANNON.Body.KINEMATIC,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      fixedRotation: true,
    });
    world.addBody(this.body);

    this.mesh = new THREE.Group();

    // ── Stance layer — starts front-facing (0); dynamic in update ─────────
    this.stanceGroup = new THREE.Group();
    this.stanceGroup.rotation.y = 0;
    this.mesh.add(this.stanceGroup);

    // ── Animation layer ────────────────────────────────────────────────────
    this.innerGroup = new THREE.Group();
    this.stanceGroup.add(this.innerGroup);

    // ── Lower body (legs + board, remain fully sideways) ──────────────────
    this.lowerGroup = new THREE.Group();
    this.innerGroup.add(this.lowerGroup);

    // ── Upper body — rotation kept near-forward in world space by update ──
    this.upperGroup = new THREE.Group();
    this.upperGroup.rotation.y = -Math.PI * 0.05; // near-forward when stance=0
    this.innerGroup.add(this.upperGroup);

    // ── Materials ──────────────────────────────────────────────────────────
    const skinMat  = new THREE.MeshStandardMaterial({ color: 0xffb088 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1a1a3e });
    const capMat   = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const shoeMat  = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.7, roughness: 0.3 });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 });

    // ══════════════════════════════════════════════════════════════════════
    // UPPER BODY
    // ══════════════════════════════════════════════════════════════════════

    // Torso
    // Torso reaches down far enough to overlap the pelvis bridge
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.96, 0.26), shirtMat);
    this.torso.position.y = 1.22;
    this.torso.castShadow = true;
    this.upperGroup.add(this.torso);

    // Head — extra Y rotation so it faces even more forward (looking where going)
    this.head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 10, 8), skinMat);
    this.head.position.y = 1.82;
    this.head.rotation.y = -Math.PI * 0.28; // head looks toward travel
    this.head.castShadow = true;
    this.upperGroup.add(this.head);

    const capCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.155, 0.10, 10), capMat);
    capCrown.position.y = 1.97;
    capCrown.rotation.y = this.head.rotation.y;
    this.upperGroup.add(capCrown);

    const capBrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.26), capMat);
    // brim follows head orientation (local Z of head)
    const brimDir = new THREE.Vector3(0, 0, 0.16).applyEuler(new THREE.Euler(0, this.head.rotation.y, 0));
    capBrim.position.set(brimDir.x, 1.925, brimDir.z);
    capBrim.rotation.y = this.head.rotation.y;
    this.upperGroup.add(capBrim);

    // Arms — outspread along upper body's X axis for balance
    const armGeo = new THREE.BoxGeometry(0.13, 0.48, 0.13);
    this.leftArm = new THREE.Mesh(armGeo, shirtMat);
    this.leftArm.position.set(-0.30, 1.22, 0);
    this.leftArm.castShadow = true;
    this.upperGroup.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, shirtMat);
    this.rightArm.position.set(0.30, 1.22, 0);
    this.rightArm.castShadow = true;
    this.upperGroup.add(this.rightArm);

    // Forearms / hands
    const foreGeo = new THREE.BoxGeometry(0.10, 0.26, 0.10);
    const handL = new THREE.Mesh(foreGeo, skinMat);
    handL.position.set(-0.30, 0.90, 0);
    this.upperGroup.add(handL);
    const handR = new THREE.Mesh(foreGeo, skinMat);
    handR.position.set(0.30, 0.90, 0);
    this.upperGroup.add(handR);

    // ══════════════════════════════════════════════════════════════════════
    // PELVIS / WAIST BRIDGE
    // Sits in innerGroup with an intermediate Y rotation (-PI*0.24) so it
    // visually transitions between the sideways lowerGroup (0°) and the
    // open upperGroup (-PI*0.55°).  Large enough to overlap both torso
    // bottom and leg tops — hides the rotation seam completely.
    // ══════════════════════════════════════════════════════════════════════

    this.pelvisGroup = new THREE.Group();
    this.pelvisGroup.rotation.y = -Math.PI * 0.025; // matches stance=0 start
    this.innerGroup.add(this.pelvisGroup);
    const pelvisGroup = this.pelvisGroup; // local alias for the rest of constructor

    // Main pelvis block (pants colour — spans gap between legs and torso)
    const pelvisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.36, 0.28),
      new THREE.MeshStandardMaterial({ color: 0x1a1a3e }),
    );
    pelvisMesh.position.y = 0.82;
    pelvisMesh.castShadow = true;
    pelvisGroup.add(pelvisMesh);

    // Belt / waistband strip at the shirt-pants boundary
    const beltMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.07, 0.30),
      new THREE.MeshStandardMaterial({ color: 0x1a1010, roughness: 0.6, metalness: 0.25 }),
    );
    beltMesh.position.y = 1.00;
    pelvisGroup.add(beltMesh);

    // ══════════════════════════════════════════════════════════════════════
    // LOWER BODY — articulated legs
    // front foot = leftHip  (board nose side, at lowerGroup X = +0.21)
    // back  foot = rightHip (board tail side, at lowerGroup X = -0.21)
    // ══════════════════════════════════════════════════════════════════════

    const thighGeo = new THREE.BoxGeometry(0.14, 0.34, 0.14);
    const shinGeo  = new THREE.BoxGeometry(0.12, 0.32, 0.12);
    const footGeo  = new THREE.BoxGeometry(0.17, 0.07, 0.28);

    // ── Front (left) leg ──────────────────────────────────────────────────
    this.leftHip = new THREE.Group();
    this.leftHip.position.set(0.21, 0.78, 0);
    this.lowerGroup.add(this.leftHip);

    this.leftThigh = new THREE.Mesh(thighGeo, pantsMat);
    this.leftThigh.position.y = -0.17;
    this.leftThigh.castShadow = true;
    this.leftHip.add(this.leftThigh);

    this.leftKnee = new THREE.Group();
    this.leftKnee.position.y = -0.34;
    this.leftHip.add(this.leftKnee);

    this.leftShin = new THREE.Mesh(shinGeo, pantsMat);
    this.leftShin.position.y = -0.16;
    this.leftShin.castShadow = true;
    this.leftKnee.add(this.leftShin);

    this.leftAnkle = new THREE.Group();
    this.leftAnkle.position.y = -0.32;
    this.leftKnee.add(this.leftAnkle);

    this.leftFoot = new THREE.Mesh(footGeo, shoeMat);
    this.leftFoot.position.set(0, -0.035, 0.05);
    this.leftAnkle.add(this.leftFoot);

    // ── Back (right) leg ──────────────────────────────────────────────────
    this.rightHip = new THREE.Group();
    this.rightHip.position.set(-0.21, 0.78, 0);
    this.lowerGroup.add(this.rightHip);

    this.rightThigh = new THREE.Mesh(thighGeo, pantsMat);
    this.rightThigh.position.y = -0.17;
    this.rightThigh.castShadow = true;
    this.rightHip.add(this.rightThigh);

    this.rightKnee = new THREE.Group();
    this.rightKnee.position.y = -0.34;
    this.rightHip.add(this.rightKnee);

    this.rightShin = new THREE.Mesh(shinGeo, pantsMat);
    this.rightShin.position.y = -0.16;
    this.rightShin.castShadow = true;
    this.rightKnee.add(this.rightShin);

    this.rightAnkle = new THREE.Group();
    this.rightAnkle.position.y = -0.32;
    this.rightKnee.add(this.rightAnkle);

    this.rightFoot = new THREE.Mesh(footGeo, shoeMat);
    this.rightFoot.position.set(0, -0.035, 0.05);
    this.rightAnkle.add(this.rightFoot);

    // ══════════════════════════════════════════════════════════════════════
    // BOARD
    // deck long axis along lowerGroup local X (= world travel direction)
    // ══════════════════════════════════════════════════════════════════════

    this.boardGroup = new THREE.Group();
    this.lowerGroup.add(this.boardGroup);

    const deckMat = new THREE.MeshStandardMaterial({ color: 0xd2a8ff });
    const kickMat = new THREE.MeshStandardMaterial({ color: 0xb888e8 });

    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.80, 0.033, 0.20), deckMat);
    deck.position.y = 0.038;
    deck.castShadow = true;
    this.boardGroup.add(deck);

    // Nose kick
    const noseKick = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.033, 0.20), kickMat);
    noseKick.position.set(0.42, 0.052, 0);
    noseKick.rotation.z = -0.32;
    this.boardGroup.add(noseKick);

    // Tail kick
    const tailKick = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.033, 0.20), kickMat);
    tailKick.position.set(-0.42, 0.052, 0);
    tailKick.rotation.z = 0.32;
    this.boardGroup.add(tailKick);

    // Trucks
    const truckGeo = new THREE.BoxGeometry(0.06, 0.028, 0.22);
    const frontTruck = new THREE.Mesh(truckGeo, truckMat);
    frontTruck.position.set(0.28, 0.018, 0);
    this.boardGroup.add(frontTruck);

    const backTruck = new THREE.Mesh(truckGeo, truckMat);
    backTruck.position.set(-0.28, 0.018, 0);
    this.boardGroup.add(backTruck);

    // Wheels — cylinder axis along local Z (board width)
    const wheelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.046, 10);
    for (const [wx, wz] of [[0.28, 0.114], [0.28, -0.114], [-0.28, 0.114], [-0.28, -0.114]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(wx, 0.035, wz);
      this.boardGroup.add(wheel);
      this.wheels.push(wheel);
    }
  }

  // ── Public getters ─────────────────────────────────────────────────────────

  get yaw():       number        { return this._yaw; }
  get speed():     number        { return this._speed; }
  get isBailing(): boolean       { return this._isBailing; }
  get isGrounded(): boolean      { return !this.airborne; }
  get isAirborne(): boolean      { return this.airborne; }
  get pushing():   boolean       { return this.isPushing; }
  get lean():      number        { return this.currentLean; }
  get shock():     number        { return this.landingShock; }
  get position():  THREE.Vector3 {
    const p = this.body.position;
    return this._positionVec.set(p.x, p.y, p.z);
  }

  triggerBail(): void {
    if (this._isBailing) return;
    this._isBailing = true;
    this.bailTimer  = 0;
    this.bailBoardX = 0;
    this._speed    *= 0.2;
  }

  playTrick(trick: TrickAnim): void {
    if (trick === 'none') return;
    this.trickAnim  = trick;
    this.trickTimer = 0;
    // Auto-ollie: any trick except manual pops the board into the air
    if (!this.airborne && trick !== 'manual') {
      this.verticalVel = this.ollieImpulse;
      this.airborne    = true;
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private lerp(cur: number, tgt: number, rate: number, dt: number): number {
    return cur + (tgt - cur) * (1 - Math.exp(-rate * dt));
  }

  /** Drive hip/knee/ankle toward target angles at given rate */
  private poseLeg(
    hip: THREE.Group, knee: THREE.Group, ankle: THREE.Group,
    hipX: number, kneeX: number, ankleX: number,
    rate: number, dt: number,
  ) {
    hip.rotation.x   = this.lerp(hip.rotation.x,   hipX,   rate, dt);
    knee.rotation.x  = this.lerp(knee.rotation.x,  kneeX,  rate, dt);
    ankle.rotation.x = this.lerp(ankle.rotation.x, ankleX, rate, dt);
  }

  /** Project horizontal movement away from near-vertical walls using a single raycast. */
  private resolveWalls(dx: number, dz: number): [number, number] {
    const moveDist = Math.sqrt(dx * dx + dz * dz);
    if (moveDist < 0.001) return [dx, dz];

    const BODY_RADIUS = 0.35;
    const nx = dx / moveDist, nz = dz / moveDist;

    const from = new CANNON.Vec3(this.body.position.x, this.body.position.y, this.body.position.z);
    const to   = new CANNON.Vec3(
      from.x + nx * (BODY_RADIUS + moveDist + 0.05),
      from.y,
      from.z + nz * (BODY_RADIUS + moveDist + 0.05),
    );
    const res = new CANNON.RaycastResult();
    this.world.raycastClosest(from, to, { skipBackfaces: false, collisionFilterGroup: 1, collisionFilterMask: 1 }, res);

    if (!res.hasHit || !res.hitPointWorld || !res.hitNormalWorld) return [dx, dz];

    // Only block on near-vertical surfaces (walls); let slopes pass through for ramp riding
    if (Math.abs(res.hitNormalWorld.y) > 0.5) return [dx, dz];

    const hitDist = Math.sqrt(
      (res.hitPointWorld.x - this.body.position.x) ** 2 +
      (res.hitPointWorld.z - this.body.position.z) ** 2,
    );
    if (hitDist >= BODY_RADIUS + moveDist) return [dx, dz];

    // Slide along wall surface
    const wnx = res.hitNormalWorld.x, wnz = res.hitNormalWorld.z;
    const dot = dx * wnx + dz * wnz;
    if (dot >= 0) return [dx, dz]; // moving away from wall already
    return [dx - dot * wnx, dz - dot * wnz];
  }

  // ── Main update ────────────────────────────────────────────────────────────

  update(delta: number, input: SkaterInput): void {
    this.animTime += delta;

    // ══════════════════════════════════════════════════════════════════════
    // BAIL ANIMATION
    // ══════════════════════════════════════════════════════════════════════
    if (this._isBailing) {
      this.bailTimer += delta;
      const bt = this.bailTimer;

      if (bt < BAIL_FALL) {
        const t = bt / BAIL_FALL;
        // Body slams forward
        this.innerGroup.rotation.x = t * Math.PI * 0.45;
        this.innerGroup.rotation.z = t * 0.5;
        // Arms flail up
        this.leftArm.rotation.x   =  t * 1.0;
        this.rightArm.rotation.x  = -t * 1.2;
        // Legs collapse
        this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  t * 0.8, t * 0.5, 0, 20, delta);
        this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, t * 1.0, t * 0.8, 0, 20, delta);
        // Board flies off
        this.bailBoardX += delta * 6;
        this.boardGroup.position.x = this.bailBoardX;
        this.boardGroup.rotation.z += delta * 10;

      } else if (bt < BAIL_FALL + BAIL_GROUND) {
        const t = (bt - BAIL_FALL) / BAIL_GROUND;
        this.innerGroup.rotation.x = Math.PI * 0.45;
        this.innerGroup.rotation.z = 0.5 * (1 - t * 0.5);
        // Board continues sliding, decelerating
        this.bailBoardX += delta * (3 * (1 - t));
        this.boardGroup.position.x  = this.bailBoardX;
        this.boardGroup.rotation.z += delta * 4 * (1 - t);

      } else {
        // Get up — body rises, board slides back
        const t = (bt - BAIL_FALL - BAIL_GROUND) / BAIL_GETUP;
        this.innerGroup.rotation.x = (1 - t) * Math.PI * 0.45;
        this.innerGroup.rotation.z = (1 - t) * 0.25;
        this.leftArm.rotation.x   = (1 - t) * 1.0;
        this.rightArm.rotation.x  = -(1 - t) * 1.2;
        const getupEase = 1 - (1 - t) * (1 - t); // ease in
        this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.22 * getupEase, 0.4 * (1 - getupEase), -0.08, 12, delta);
        this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.14 * getupEase, 0.3 * (1 - getupEase), -0.05, 12, delta);
        this.boardGroup.position.x = this.lerp(this.boardGroup.position.x, 0, 6, delta);
        this.boardGroup.rotation.z = this.lerp(this.boardGroup.rotation.z, 0, 5, delta);
      }

      if (bt >= BAIL_TOTAL) {
        this._isBailing = false;
        this.bailTimer  = 0;
        this.bailBoardX = 0;
        this.innerGroup.rotation.set(0, 0, 0);
        this.innerGroup.position.set(0, 0, 0);
        this.boardGroup.rotation.set(0, 0, 0);
        this.boardGroup.position.set(0, 0, 0);
        this.leftArm.rotation.set(0, 0, 0);
        this.rightArm.rotation.set(0, 0, 0);
      }

      // Bail physics
      this.verticalVel -= 9.82 * delta * 2;
      this.body.position.y += this.verticalVel * delta;
      const bRF = new CANNON.Vec3(this.body.position.x, this.body.position.y + 2, this.body.position.z);
      const bRT = new CANNON.Vec3(this.body.position.x, -10, this.body.position.z);
      const bRR = new CANNON.RaycastResult();
      this.world.raycastClosest(bRF, bRT, { skipBackfaces: true, collisionFilterGroup: 1, collisionFilterMask: 1 }, bRR);
      if (bRR.hasHit && bRR.hitPointWorld) this.groundY = bRR.hitPointWorld.y;
      const bailFeet = this.groundY + this.HALF_HEIGHT;
      if (this.body.position.y <= bailFeet) { this.body.position.y = bailFeet; this.verticalVel = 0; this.airborne = false; }
      else this.airborne = true;
      if (this.body.position.y < -10) { this.body.position.set(0, 2, 0); this._speed = 0; this.verticalVel = 0; }

      this.body.position.x += (-Math.sin(this._yaw)) * this._speed * delta;
      this.body.position.z += (-Math.cos(this._yaw)) * this._speed * delta;
      this._speed *= (1 - 4 * delta);
      if (this._speed < 0.01) this._speed = 0;
      this.mesh.position.set(this.body.position.x, this.body.position.y - this.HALF_HEIGHT, this.body.position.z);
      this.mesh.rotation.y = this._yaw;
      return;
    }

    // ══════════════════════════════════════════════════════════════════════
    // MOVEMENT
    // ══════════════════════════════════════════════════════════════════════

    const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this._yaw += turnInput * this.turnSpeed * delta;

    const forward = new CANNON.Vec3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
    if (input.forward || input.backward || input.ollie || input.left || input.right) this.body.wakeUp();

    const wasPushing = this.isPushing;
    if (input.forward) {
      this._speed  = Math.min(this._speed + this.pushForce * delta, this.maxSpeed);
      this.isPushing = true;
    } else if (input.backward) {
      this._speed  = Math.max(this._speed - this.brakeForce * delta, 0);
      this.isPushing = false;
    } else {
      this._speed *= (1 - 2 * delta);
      if (this._speed < 0.01) this._speed = 0;
      this.isPushing = false;
    }
    if (this.isPushing && !wasPushing) this.pushPhase = 0;
    if (this.isPushing) this.pushPhase += delta * 3.0;

    let [_dx, _dz] = this.resolveWalls(forward.x * this._speed * delta, forward.z * this._speed * delta);
    this.body.position.x += _dx;
    this.body.position.z += _dz;

    // Raycast ground
    const rayFrom   = new CANNON.Vec3(this.body.position.x, this.body.position.y + 2, this.body.position.z);
    const rayTo     = new CANNON.Vec3(this.body.position.x, -10, this.body.position.z);
    const rayResult = new CANNON.RaycastResult();
    const hasHit = this.world.raycastClosest(rayFrom, rayTo, { skipBackfaces: true, collisionFilterGroup: 1, collisionFilterMask: 1 }, rayResult);
    if (hasHit && rayResult.hitPointWorld && rayResult.body !== this.body) this.groundY = rayResult.hitPointWorld.y;
    else this.groundY = 0;

    const feetHeight = this.groundY + this.HALF_HEIGHT;

    // Bowl pump: detect slope (groundY rising = pump up = extend legs, falling = absorb)
    const groundSlope  = (this.groundY - this.prevGroundY) / Math.max(delta, 0.001);
    this.prevGroundY   = this.groundY;
    const pumpTarget   = Math.max(-0.3, Math.min(0.25, groundSlope * 0.08));
    this.pumpAmount    = this.lerp(this.pumpAmount, pumpTarget, 5, delta);

    // Ollie / jump
    if (input.ollie && !this.airborne) {
      this.verticalVel = this.ollieImpulse;
      this.airborne    = true;
    }

    const wasAirborne = this.airborne;
    if (this.airborne) {
      this.verticalVel     -= 9.82 * delta * 2;
      this.body.position.y += this.verticalVel * delta;
      if (this.body.position.y <= feetHeight) {
        this.body.position.y = feetHeight;
        // Landing shock — harder landings = deeper shock
        if (wasAirborne) this.landingShock = Math.min(1.0, Math.abs(this.verticalVel) * 0.08);
        this.verticalVel = 0;
        this.airborne    = false;
      }
    } else {
      const currentY = this.body.position.y;
      if (currentY - feetHeight > this.AIRBORNE_THRESHOLD) {
        this.airborne    = true;
        this.verticalVel = 0;
      } else {
        this.body.position.y = this.lerp(currentY, feetHeight, 15, delta);
      }
    }

    // Landing shock decays
    this.landingShock = Math.max(0, this.landingShock - delta * 4);

    if (this.body.position.y < -10) {
      this.body.position.set(0, 2, 0); this._speed = 0; this.verticalVel = 0; this.airborne = false;
    }

    // ══════════════════════════════════════════════════════════════════════
    // BODY ANIMATION
    // ══════════════════════════════════════════════════════════════════════
    const speedRatio = this._speed / this.maxSpeed;

    if (this.trickAnim === 'none') {

      // ── Lean / tilt (whole body via innerGroup) ──────────────────────────
      const targetLean = -turnInput * 0.20 * Math.max(speedRatio, 0.25);
      this.currentLean = this.lerp(this.currentLean, targetLean, 8, delta);
      let targetTilt   = 0;
      if (input.forward)      targetTilt = -0.06 - speedRatio * 0.05;
      else if (input.backward) targetTilt = 0.10;
      this.currentTilt = this.lerp(this.currentTilt, targetTilt, 6, delta);

      this.innerGroup.rotation.z = this.currentLean;
      this.innerGroup.rotation.x = this.currentTilt;
      this.innerGroup.position.y = 0;
      this.boardGroup.rotation.z = this.currentLean * 0.55;

      // ── Leg animation ────────────────────────────────────────────────────

      if (this.airborne) {
        // ── AIR: full tuck — hip forward, knee sharp bend ─────────────────
        //   hipX  < 0  → thigh swings forward (toward character's facing dir)
        //   kneeX > 0  → shin bends back      (classic tuck position)
        this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.65, 1.20, 0.10, 12, delta);
        this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.55, 1.10, 0.08, 12, delta);
        // Arms out for air balance
        this.leftArm.rotation.z  = this.lerp(this.leftArm.rotation.z,   0.80, 8, delta);
        this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -0.80, 8, delta);
        this.leftArm.rotation.x  = 0;
        this.rightArm.rotation.x = 0;

      } else if (this.isPushing) {
        // ── PUSH: back foot (rightHip) steps off, kicks, returns ──────────
        // pushPhase cycles 0→1 per push stroke
        const cycle = this.pushPhase % 1.0;
        // sin(cycle*2π): 0 at start, +1 at 0.25 (kick out), 0 at 0.5, -0.x recovery
        const kickCurve = Math.sin(cycle * Math.PI * 2);
        // liftCurve: 1 when foot is off board (middle of stroke)
        const liftCurve = Math.max(0, kickCurve);

        // Front leg stays planted with bent knee (weight bearing)
        this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,
          -0.22,                            // hip fwd — thigh angled forward
          0.46,                             // knee — good riding bend
          -0.10,                            // ankle — foot flat
          10, delta);

        // Push leg swings back (hip rotates) + extends (knee straightens).
        // Hip pivot stays at y=0.78 — the leg reaches toward the ground purely
        // through rotation so the leg never visually detaches from the body.
        // hipX > 0 → thigh swings backward; kneeX small → leg straightens toward ground
        const pushHip   = -0.14 + kickCurve * 0.82; // forward → backward swing
        const pushKnee  =  0.36 - liftCurve * 0.28; // bends → near-straight on kick
        const pushAnkle = -0.08 + liftCurve * 0.22; // toe up as foot brushes ground
        this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle,
          pushHip, pushKnee, pushAnkle, 14, delta);

        // Arms swing for balance
        const armSwing = kickCurve * 0.30;
        this.leftArm.rotation.x  = this.lerp(this.leftArm.rotation.x,   armSwing, 6, delta);
        this.rightArm.rotation.x = this.lerp(this.rightArm.rotation.x, -armSwing * 0.6, 6, delta);
        this.leftArm.rotation.z  = this.lerp(this.leftArm.rotation.z,   0.18, 5, delta);
        this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -0.18, 5, delta);

      } else {
        // ── RIDING or IDLE ────────────────────────────────────────────────

        // Crouch depth: more at high speed + landing shock + bowl absorption
        const crouchBase  = 0.12 + speedRatio * 0.20;
        const shockAdd    = this.landingShock * 0.35;
        const pumpAdd     = -this.pumpAmount * 0.25;  // positive pump = extend (less crouch)
        const totalCrouch = Math.max(0, crouchBase + shockAdd + pumpAdd);

        // Hip angle: negative = thigh forward (real skater stance)
        // Knee angle: positive = shin back = knee bent
        // More crouch = bigger angles
        const frontHipX   = -(0.22 + totalCrouch * 0.40);
        const frontKneeX  =   0.44 + totalCrouch * 0.75;
        const frontAnkleX = -(0.08 + totalCrouch * 0.10);

        const backHipX    = -(0.14 + totalCrouch * 0.30);
        const backKneeX   =   0.30 + totalCrouch * 0.60;
        const backAnkleX  = -(0.06 + totalCrouch * 0.08);

        const rate = this.landingShock > 0.3 ? 20 : 7; // fast on landing
        this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  frontHipX, frontKneeX, frontAnkleX, rate, delta);
        this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, backHipX,  backKneeX,  backAnkleX,  rate, delta);

        // Lower body with crouch
        this.innerGroup.position.y = -totalCrouch * 0.06;

        if (this._speed > 0.5) {
          // Riding: arms spread wide, subtle fore-aft sway
          const spread = 0.25 + speedRatio * 0.50;
          const sway   = Math.sin(this.animTime * 2.0) * 0.04 * speedRatio;
          this.leftArm.rotation.z  = this.lerp(this.leftArm.rotation.z,   spread, 5, delta);
          this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -spread, 5, delta);
          this.leftArm.rotation.x  = this.lerp(this.leftArm.rotation.x,   sway,   4, delta);
          this.rightArm.rotation.x = this.lerp(this.rightArm.rotation.x, -sway,   4, delta);
        } else {
          // Idle: slight weight shift
          const idleBob = Math.sin(this.animTime * 1.2) * 0.012;
          this.innerGroup.position.y = idleBob - totalCrouch * 0.06;
          this.leftArm.rotation.z  = this.lerp(this.leftArm.rotation.z,   0.14, 4, delta);
          this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -0.14, 4, delta);
          this.leftArm.rotation.x  = 0;
          this.rightArm.rotation.x = 0;
        }
      }

      // Wheel spin
      const wheelSpin = this._speed * delta * 22;
      for (const w of this.wheels) w.rotation.y += wheelSpin;
    }

    // ══════════════════════════════════════════════════════════════════════
    // TRICK ANIMATIONS
    // ══════════════════════════════════════════════════════════════════════
    if (this.trickAnim !== 'none') {
      this.trickTimer += delta;
      const t    = Math.min(this.trickTimer / this.trickDuration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      switch (this.trickAnim) {
        case 'kickflip':
          this.boardGroup.rotation.x  =  ease * Math.PI * 2;
          this.innerGroup.rotation.x  =  Math.sin(t * Math.PI) * 0.15;
          this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.65, 1.10, 0.10, 25, delta);
          this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.50, 0.90, 0.08, 25, delta);
          break;
        case 'heelflip':
          this.boardGroup.rotation.x  = -ease * Math.PI * 2;
          this.innerGroup.rotation.x  =  Math.sin(t * Math.PI) * 0.15;
          this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.50, 0.90, 0.08, 25, delta);
          this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.65, 1.10, 0.10, 25, delta);
          break;
        case 'tre_flip':
          this.boardGroup.rotation.x  =  ease * Math.PI * 2;
          this.boardGroup.rotation.y  =  ease * Math.PI * 2;
          this.innerGroup.rotation.x  =  Math.sin(t * Math.PI) * 0.20;
          break;
        case 'ollie':
          this.innerGroup.position.y  =  Math.sin(t * Math.PI) * 0.30;
          this.innerGroup.rotation.x  =  Math.sin(t * Math.PI) * -0.10;
          this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.60 * Math.sin(t * Math.PI), 1.0 * Math.sin(t * Math.PI), 0.1, 20, delta);
          this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.40 * Math.sin(t * Math.PI), 0.8 * Math.sin(t * Math.PI), 0.05, 20, delta);
          break;
        case 'manual':
          this.boardGroup.rotation.x  = -0.28 * Math.sin(t * Math.PI);
          this.innerGroup.rotation.x  = -0.12 * Math.sin(t * Math.PI);
          this.leftArm.rotation.z     =  0.55 * Math.sin(t * Math.PI);
          this.rightArm.rotation.z    = -0.55 * Math.sin(t * Math.PI);
          break;
        case 'grab':
          this.innerGroup.rotation.x  =  Math.sin(t * Math.PI) * 0.35;
          this.rightArm.rotation.x    =  Math.sin(t * Math.PI) * -1.1;
          this.poseLeg(this.leftHip,  this.leftKnee,  this.leftAnkle,  -0.55, 1.05, 0.10, 20, delta);
          this.poseLeg(this.rightHip, this.rightKnee, this.rightAnkle, -0.45, 0.90, 0.08, 20, delta);
          break;
        case 'spin':
          this.innerGroup.rotation.y  =  ease * Math.PI * 2;
          this.leftArm.rotation.z     =  0.80;
          this.rightArm.rotation.z    = -0.80;
          break;
      }

      if (t >= 1) {
        this.trickAnim  = 'none';
        this.trickTimer = 0;
        this.boardGroup.rotation.set(0, 0, 0);
        this.innerGroup.rotation.set(0, 0, 0);
        this.innerGroup.position.set(0, 0, 0);
      }
    }

    // Dynamic stance: front-facing (0) when idle or pushing, sideways (PI/2) when riding/airborne
    const _stanceTarget = (this.airborne || (this._speed > 0.5 && !this.isPushing)) ? Math.PI / 2 : 0;
    this.stanceGroup.rotation.y = this.lerp(this.stanceGroup.rotation.y, _stanceTarget, 5, delta);
    // Upper body world angle stays near-forward (-PI*0.05) regardless of foot stance
    this.upperGroup.rotation.y  = this.lerp(this.upperGroup.rotation.y, -Math.PI * 0.05 - this.stanceGroup.rotation.y, 7, delta);
    // Pelvis bridges between lower (stance-relative) and upper (world-forward)
    const _pelvisMid = (this.stanceGroup.rotation.y + (-Math.PI * 0.05)) / 2;
    this.pelvisGroup.rotation.y = this.lerp(this.pelvisGroup.rotation.y, _pelvisMid - this.stanceGroup.rotation.y, 5, delta);

    // Sync mesh to physics
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - this.HALF_HEIGHT,
      this.body.position.z,
    );
    this.mesh.rotation.y = this._yaw;
  }
}
