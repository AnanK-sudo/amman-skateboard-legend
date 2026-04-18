import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface SkaterInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  ollie: boolean;
  trick1: boolean;   // J — kickflip
  trick2: boolean;   // K — heelflip
  grind: boolean;    // F
  grab: boolean;     // L
  manual: boolean;   // Shift
  cameraYaw: number; // radians
}

export type TrickAnim = 'none' | 'kickflip' | 'heelflip' | 'tre_flip' | 'ollie' | 'manual' | 'grab' | 'spin';

export class Skater {
  readonly body: CANNON.Body;
  readonly mesh: THREE.Group;
  private innerGroup: THREE.Group;
  private boardGroup: THREE.Group;
  private leftArm: THREE.Mesh;
  private rightArm: THREE.Mesh;
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private torso: THREE.Mesh;
  private head: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];

  private _yaw = 0;
  private _speed = 0;
  readonly maxSpeed = 15;
  private pushForce = 12;
  private brakeForce = 15;
  private turnSpeed = 2.5;
  private ollieImpulse = 6;

  // Trick animation state
  private trickAnim: TrickAnim = 'none';
  private trickTimer = 0;
  private trickDuration = 0.4;

  // Smooth motion state
  private animTime = 0;
  private currentLean = 0;
  private currentTilt = 0;
  private pushPhase = 0;
  private isPushing = false;

  // Named constants for ground following
  private readonly HALF_HEIGHT = 0.9;
  private readonly AIRBORNE_THRESHOLD = 0.3;

  // Ground following
  private world: CANNON.World;
  private groundY = 0;            // current ground height below skater
  private verticalVel = 0;        // manual vertical velocity for jumping
  private airborne = false;

  // Reusable Vector3 for position getter
  private _positionVec = new THREE.Vector3();

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    this.world = world;
    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      linearDamping: 0.2,
      angularDamping: 0.99,
      fixedRotation: true,
    });
    world.addBody(this.body);

    this.mesh = new THREE.Group();

    this.innerGroup = new THREE.Group();
    this.mesh.add(this.innerGroup);

    // Torso
    this.torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.0, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    this.torso.position.y = 1.2;
    this.innerGroup.add(this.torso);

    // Head
    this.head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb088 })
    );
    this.head.position.y = 1.85;
    this.innerGroup.add(this.head);

    // Arms — stored as fields for animation
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
    this.leftArm = new THREE.Mesh(armGeo, armMat);
    this.leftArm.position.set(-0.35, 1.3, 0);
    this.innerGroup.add(this.leftArm);
    this.rightArm = new THREE.Mesh(armGeo, armMat);
    this.rightArm.position.set(0.35, 1.3, 0);
    this.innerGroup.add(this.rightArm);

    // Legs — stored as fields for animation
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2d2d4e });
    this.leftLeg = new THREE.Mesh(legGeo, legMat);
    this.leftLeg.position.set(-0.12, 0.4, 0);
    this.innerGroup.add(this.leftLeg);
    this.rightLeg = new THREE.Mesh(legGeo, legMat);
    this.rightLeg.position.set(0.12, 0.4, 0);
    this.innerGroup.add(this.rightLeg);

    // Board group
    this.boardGroup = new THREE.Group();
    this.innerGroup.add(this.boardGroup);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xd2a8ff })
    );
    board.position.y = 0.04;
    this.boardGroup.add(board);

    const truckGeo = new THREE.BoxGeometry(0.2, 0.03, 0.06);
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
    const frontTruck = new THREE.Mesh(truckGeo, truckMat);
    frontTruck.position.set(0, 0.02, 0.28);
    this.boardGroup.add(frontTruck);
    const backTruck = new THREE.Mesh(truckGeo, truckMat);
    backTruck.position.set(0, 0.02, -0.28);
    this.boardGroup.add(backTruck);

    const wheelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const [x, y, z] of [[-0.09, 0.035, 0.28], [0.09, 0.035, 0.28], [-0.09, 0.035, -0.28], [0.09, 0.035, -0.28]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.boardGroup.add(wheel);
      this.wheels.push(wheel);
    }
  }

  get yaw(): number { return this._yaw; }
  get position(): THREE.Vector3 {
    const p = this.body.position;
    return this._positionVec.set(p.x, p.y, p.z);
  }
  get isGrounded(): boolean { return !this.airborne; }
  get speed(): number { return this._speed; }

  playTrick(trick: TrickAnim): void {
    if (trick === 'none') return;
    this.trickAnim = trick;
    this.trickTimer = 0;
  }

  private lerp(current: number, target: number, rate: number, delta: number): number {
    return current + (target - current) * (1 - Math.exp(-rate * delta));
  }

  update(delta: number, input: SkaterInput): void {
    this.animTime += delta;

    // --- Turning (smooth) ---
    const turnInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this._yaw += turnInput * this.turnSpeed * delta;

    const forward = new CANNON.Vec3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));

    if (input.forward || input.backward || input.ollie || input.left || input.right) {
      this.body.wakeUp();
    }

    // --- Speed (smooth acceleration/deceleration) ---
    const wasPushing = this.isPushing;
    if (input.forward) {
      this._speed = Math.min(this._speed + this.pushForce * delta, this.maxSpeed);
      this.isPushing = true;
    } else if (input.backward) {
      this._speed = Math.max(this._speed - this.brakeForce * delta, 0);
      this.isPushing = false;
    } else {
      this._speed *= (1 - 2 * delta);
      if (this._speed < 0.01) this._speed = 0;
      this.isPushing = false;
    }

    // Push animation trigger
    if (this.isPushing && !wasPushing) {
      this.pushPhase = 0;
    }
    if (this.isPushing) {
      this.pushPhase += delta * 4; // 4 pushes per second at full speed
    }

    // --- Move body horizontally ---
    this.body.position.x += forward.x * this._speed * delta;
    this.body.position.z += forward.z * this._speed * delta;

    // --- Ground following via raycast (skip own body) ---
    // Put skater in collision group 2, raycast only against group 1 (world)
    const rayFrom = new CANNON.Vec3(this.body.position.x, this.body.position.y + 2, this.body.position.z);
    const rayTo = new CANNON.Vec3(this.body.position.x, -10, this.body.position.z);
    const rayResult = new CANNON.RaycastResult();
    this.body.collisionFilterGroup = 2;
    this.body.collisionFilterMask = 1;
    const hasHit = this.world.raycastClosest(rayFrom, rayTo, {
      skipBackfaces: true,
      collisionFilterGroup: 1,
      collisionFilterMask: 1, // only hit group 1 (static world bodies)
    }, rayResult);

    if (hasHit && rayResult.hitPointWorld && rayResult.body !== this.body) {
      this.groundY = rayResult.hitPointWorld.y;
    } else {
      this.groundY = 0;
    }

    const feetHeight = this.groundY + this.HALF_HEIGHT; // half-height of physics box

    // Ollie / jumping
    if (input.ollie && !this.airborne) {
      this.verticalVel = this.ollieImpulse;
      this.airborne = true;
    }

    if (this.airborne) {
      // Apply gravity manually
      this.verticalVel -= 9.82 * delta * 2; // 2x gravity for snappy feel
      this.body.position.y += this.verticalVel * delta;

      // Land when below ground
      if (this.body.position.y <= feetHeight) {
        this.body.position.y = feetHeight;
        this.verticalVel = 0;
        this.airborne = false;
      }
    } else {
      // Stick to ground — smoothly follow terrain height
      const targetY = feetHeight;
      const currentY = this.body.position.y;
      // If ground drops away (e.g. edge of ramp), become airborne
      if (currentY - targetY > this.AIRBORNE_THRESHOLD) {
        this.airborne = true;
        this.verticalVel = 0;
      } else {
        this.body.position.y = this.lerp(currentY, targetY, 15, delta);
      }
    }

    // Prevent falling through the world
    if (this.body.position.y < -10) {
      this.body.position.set(0, 2, 0);
      this._speed = 0;
      this.verticalVel = 0;
      this.airborne = false;
    }

    // --- Smooth body motion (only when NOT doing a trick) ---
    const speedRatio = this._speed / this.maxSpeed;

    if (this.trickAnim === 'none') {
      // Lean into turns
      const targetLean = -turnInput * 0.25 * Math.max(speedRatio, 0.3);
      this.currentLean = this.lerp(this.currentLean, targetLean, 8, delta);

      // Forward tilt when accelerating, backward when braking
      let targetTilt = 0;
      if (input.forward) targetTilt = -0.08 - speedRatio * 0.06;
      else if (input.backward) targetTilt = 0.15;
      this.currentTilt = this.lerp(this.currentTilt, targetTilt, 6, delta);

      // Apply body lean + tilt
      this.innerGroup.rotation.z = this.currentLean;
      this.innerGroup.rotation.x = this.currentTilt;
      this.innerGroup.position.y = 0;

      // Board tilts with turn
      this.boardGroup.rotation.z = this.currentLean * 0.6;
      this.boardGroup.rotation.x = 0;
      this.boardGroup.rotation.y = 0;

      // --- Leg animation ---
      if (this.isPushing && this.isGrounded) {
        // Push kick: right leg swings back to push
        const pushSwing = Math.sin(this.pushPhase * Math.PI * 2);
        this.rightLeg.rotation.x = pushSwing * 0.6; // swing back and forward
        this.rightLeg.position.y = 0.4 - Math.abs(pushSwing) * 0.1;
        this.leftLeg.rotation.x = -pushSwing * 0.1; // subtle counter-movement
        this.leftLeg.position.y = 0.4;
      } else if (this._speed > 0.5 && this.isGrounded) {
        // Riding: slight crouch, knees bent
        const crouch = speedRatio * 0.05;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.leftLeg.position.y = 0.4 - crouch;
        this.rightLeg.position.y = 0.4 - crouch;
        // Slight body lower at speed
        this.torso.position.y = 1.2 - crouch;
      } else {
        // Idle: subtle idle sway
        const idleSway = Math.sin(this.animTime * 1.5) * 0.01;
        this.leftLeg.rotation.x = 0;
        this.rightLeg.rotation.x = 0;
        this.leftLeg.position.y = 0.4;
        this.rightLeg.position.y = 0.4;
        this.torso.position.y = 1.2;
        this.innerGroup.rotation.z = this.currentLean + idleSway;
      }

      // --- Arm animation ---
      if (this.isPushing && this.isGrounded) {
        // Arms swing opposite to legs for balance
        const armSwing = Math.sin(this.pushPhase * Math.PI * 2);
        this.leftArm.rotation.x = armSwing * 0.4;
        this.rightArm.rotation.x = -armSwing * 0.4;
        this.leftArm.rotation.z = 0.2;
        this.rightArm.rotation.z = -0.2;
      } else if (this._speed > 0.5) {
        // Arms out for balance at speed
        const balanceSpread = 0.3 + speedRatio * 0.4;
        this.leftArm.rotation.z = this.lerp(this.leftArm.rotation.z, balanceSpread, 4, delta);
        this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -balanceSpread, 4, delta);
        // Subtle sway
        const sway = Math.sin(this.animTime * 3) * 0.05 * speedRatio;
        this.leftArm.rotation.x = sway;
        this.rightArm.rotation.x = -sway;
      } else {
        // Idle arms
        this.leftArm.rotation.z = this.lerp(this.leftArm.rotation.z, 0.15, 4, delta);
        this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -0.15, 4, delta);
        this.leftArm.rotation.x = 0;
        this.rightArm.rotation.x = 0;
      }

      // In air: tuck legs up
      if (!this.isGrounded) {
        this.leftLeg.rotation.x = this.lerp(this.leftLeg.rotation.x, -0.4, 10, delta);
        this.rightLeg.rotation.x = this.lerp(this.rightLeg.rotation.x, -0.4, 10, delta);
        this.leftLeg.position.y = 0.45;
        this.rightLeg.position.y = 0.45;
        // Arms up for air balance
        this.leftArm.rotation.z = this.lerp(this.leftArm.rotation.z, 0.8, 8, delta);
        this.rightArm.rotation.z = this.lerp(this.rightArm.rotation.z, -0.8, 8, delta);
      }

      // Spin wheels based on speed
      const wheelSpin = this._speed * delta * 20;
      for (const wheel of this.wheels) {
        wheel.rotation.x += wheelSpin;
      }
    }

    // --- Trick animations (override body motion) ---
    if (this.trickAnim !== 'none') {
      this.trickTimer += delta;
      const t = Math.min(this.trickTimer / this.trickDuration, 1);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // easeInOutQuad

      switch (this.trickAnim) {
        case 'kickflip':
          this.boardGroup.rotation.z = ease * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.2;
          this.leftLeg.rotation.x = Math.sin(t * Math.PI) * -0.5;
          this.rightLeg.rotation.x = Math.sin(t * Math.PI) * -0.3;
          break;
        case 'heelflip':
          this.boardGroup.rotation.z = -ease * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.2;
          this.leftLeg.rotation.x = Math.sin(t * Math.PI) * -0.3;
          this.rightLeg.rotation.x = Math.sin(t * Math.PI) * -0.5;
          break;
        case 'tre_flip':
          this.boardGroup.rotation.z = ease * Math.PI * 2;
          this.boardGroup.rotation.y = ease * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.25;
          break;
        case 'ollie':
          this.innerGroup.position.y = Math.sin(t * Math.PI) * 0.3;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * -0.12;
          this.leftLeg.rotation.x = Math.sin(t * Math.PI) * -0.5;
          this.rightLeg.rotation.x = Math.sin(t * Math.PI) * -0.3;
          break;
        case 'manual':
          this.boardGroup.rotation.x = -0.3 * Math.sin(t * Math.PI);
          this.innerGroup.rotation.x = -0.15 * Math.sin(t * Math.PI);
          this.leftArm.rotation.z = 0.6 * Math.sin(t * Math.PI);
          this.rightArm.rotation.z = -0.6 * Math.sin(t * Math.PI);
          break;
        case 'grab':
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.4;
          this.rightArm.rotation.x = Math.sin(t * Math.PI) * -1.2;
          break;
        case 'spin':
          this.innerGroup.rotation.y = ease * Math.PI * 2;
          this.leftArm.rotation.z = 0.8;
          this.rightArm.rotation.z = -0.8;
          break;
      }

      if (t >= 1) {
        this.trickAnim = 'none';
        this.trickTimer = 0;
        this.boardGroup.rotation.set(0, 0, 0);
        this.innerGroup.rotation.set(0, 0, 0);
        this.innerGroup.position.set(0, 0, 0);
      }
    }

    // Sync mesh to physics
    this.mesh.position.set(this.body.position.x, this.body.position.y - this.HALF_HEIGHT, this.body.position.z);
    this.mesh.rotation.y = this._yaw;
  }
}
