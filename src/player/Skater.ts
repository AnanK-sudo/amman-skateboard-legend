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
  private innerGroup: THREE.Group; // rotates for trick animations
  private boardGroup: THREE.Group; // board + wheels, spins for flips
  private _yaw = 0;
  readonly maxSpeed = 15;
  private pushForce = 30;
  private brakeForce = 20;
  private turnSpeed = 2.5;
  private ollieImpulse = 6;

  // Trick animation state
  private trickAnim: TrickAnim = 'none';
  private trickTimer = 0;
  private trickDuration = 0.4; // seconds per trick anim

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      linearDamping: 0.2,
      angularDamping: 0.99,
      fixedRotation: true,
    });
    world.addBody(this.body);

    // Outer group — positioned by physics
    this.mesh = new THREE.Group();

    // Inner group — rotated by trick animations
    this.innerGroup = new THREE.Group();
    this.mesh.add(this.innerGroup);

    // Body mesh (torso + head)
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 1.0, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    torso.position.y = 1.2;
    this.innerGroup.add(torso);

    // Head
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffb088 })
    );
    head.position.y = 1.85;
    this.innerGroup.add(head);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.15, 0.6, 0.15);
    const armMat = new THREE.MeshStandardMaterial({ color: 0xff6b35 });
    const leftArm = new THREE.Mesh(armGeo, armMat);
    leftArm.position.set(-0.35, 1.3, 0);
    leftArm.rotation.z = 0.2;
    this.innerGroup.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, armMat);
    rightArm.position.set(0.35, 1.3, 0);
    rightArm.rotation.z = -0.2;
    this.innerGroup.add(rightArm);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.18, 0.6, 0.18);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2d2d4e });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.12, 0.4, 0);
    this.innerGroup.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.12, 0.4, 0);
    this.innerGroup.add(rightLeg);

    // Board group (board + wheels) — separate for flip animations
    this.boardGroup = new THREE.Group();
    this.innerGroup.add(this.boardGroup);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.04, 0.85),
      new THREE.MeshStandardMaterial({ color: 0xd2a8ff })
    );
    board.position.y = 0.04;
    this.boardGroup.add(board);

    // Trucks
    const truckGeo = new THREE.BoxGeometry(0.2, 0.03, 0.06);
    const truckMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.6 });
    const frontTruck = new THREE.Mesh(truckGeo, truckMat);
    frontTruck.position.set(0, 0.02, 0.28);
    this.boardGroup.add(frontTruck);
    const backTruck = new THREE.Mesh(truckGeo, truckMat);
    backTruck.position.set(0, 0.02, -0.28);
    this.boardGroup.add(backTruck);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const [x, y, z] of [[-0.09, 0.035, 0.28], [0.09, 0.035, 0.28], [-0.09, 0.035, -0.28], [0.09, 0.035, -0.28]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.boardGroup.add(wheel);
    }
  }

  get yaw(): number { return this._yaw; }
  get position(): THREE.Vector3 {
    const p = this.body.position;
    return new THREE.Vector3(p.x, p.y, p.z);
  }
  get isGrounded(): boolean { return this.body.position.y < 1.1; }
  get speed(): number {
    const v = this.body.velocity;
    return Math.sqrt(v.x * v.x + v.z * v.z);
  }

  playTrick(trick: TrickAnim): void {
    if (trick === 'none') return;
    this.trickAnim = trick;
    this.trickTimer = 0;
  }

  update(delta: number, input: SkaterInput): void {
    // Turning
    if (input.left) this._yaw += this.turnSpeed * delta;
    if (input.right) this._yaw -= this.turnSpeed * delta;

    const forward = new CANNON.Vec3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));

    // Push forward
    if (input.forward && this.speed < this.maxSpeed) {
      this.body.applyForce(forward.scale(this.pushForce * this.body.mass));
    }

    // Brake
    if (input.backward) {
      const vel = this.body.velocity;
      const brakeVec = new CANNON.Vec3(-vel.x, 0, -vel.z);
      if (brakeVec.length() > 0.1) {
        brakeVec.normalize();
        this.body.applyForce(brakeVec.scale(this.brakeForce * this.body.mass));
      }
    }

    // Ollie
    if (input.ollie && this.isGrounded) {
      this.body.velocity.y = this.ollieImpulse;
    }

    // --- Trick animations ---
    if (this.trickAnim !== 'none') {
      this.trickTimer += delta;
      const t = Math.min(this.trickTimer / this.trickDuration, 1);

      switch (this.trickAnim) {
        case 'kickflip':
          // Board does a full 360 roll on X axis
          this.boardGroup.rotation.z = t * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.15;
          break;
        case 'heelflip':
          // Board rolls opposite direction
          this.boardGroup.rotation.z = -t * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.15;
          break;
        case 'tre_flip':
          // Board flips + spins
          this.boardGroup.rotation.z = t * Math.PI * 2;
          this.boardGroup.rotation.y = t * Math.PI * 2;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.2;
          break;
        case 'ollie':
          // Crouch then extend
          this.innerGroup.position.y = Math.sin(t * Math.PI) * 0.3;
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * -0.1;
          break;
        case 'manual':
          // Tilt back, nose up
          this.boardGroup.rotation.x = -0.3 * (1 - t);
          this.innerGroup.rotation.x = -0.15 * (1 - t);
          break;
        case 'grab':
          // Crouch and reach down
          this.innerGroup.rotation.x = Math.sin(t * Math.PI) * 0.4;
          break;
        case 'spin':
          // Full 360 body spin
          this.innerGroup.rotation.y = t * Math.PI * 2;
          break;
      }

      if (t >= 1) {
        // Reset animation
        this.trickAnim = 'none';
        this.trickTimer = 0;
        this.boardGroup.rotation.set(0, 0, 0);
        this.innerGroup.rotation.set(0, 0, 0);
        this.innerGroup.position.set(0, 0, 0);
      }
    }

    // Sync mesh to physics
    this.mesh.position.set(this.body.position.x, this.body.position.y - 0.9, this.body.position.z);
    this.mesh.rotation.y = this._yaw;
  }
}
