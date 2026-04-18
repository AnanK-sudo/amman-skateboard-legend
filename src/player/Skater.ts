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

export class Skater {
  readonly body: CANNON.Body;
  readonly mesh: THREE.Group;
  private _yaw = 0;
  readonly maxSpeed = 15;
  private pushForce = 30;
  private brakeForce = 20;
  private turnSpeed = 2.5;
  private ollieImpulse = 6;

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    // Physics body — box approximation, mass 70, fixedRotation true, linearDamping 0.2, angularDamping 0.99
    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      linearDamping: 0.2,
      angularDamping: 0.99,
      fixedRotation: true,
    });
    world.addBody(this.body);

    // Visual mesh — placeholder orange box body + purple board + 4 white wheels
    this.mesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.8, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    bodyMesh.position.y = 0.9;
    this.mesh.add(bodyMesh);

    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.05, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd2a8ff })
    );
    board.position.y = 0.025;
    this.mesh.add(board);

    const wheelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    for (const [x, y, z] of [[-0.1, 0.04, 0.3], [0.1, 0.04, 0.3], [-0.1, 0.04, -0.3], [0.1, 0.04, -0.3]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.mesh.add(wheel);
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

  update(delta: number, input: SkaterInput): void {
    if (input.left) this._yaw += this.turnSpeed * delta;
    if (input.right) this._yaw -= this.turnSpeed * delta;

    const forward = new CANNON.Vec3(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));

    if (input.forward && this.speed < this.maxSpeed) {
      this.body.applyForce(forward.scale(this.pushForce * this.body.mass));
    }
    if (input.backward) {
      const vel = this.body.velocity;
      const brakeVec = new CANNON.Vec3(-vel.x, 0, -vel.z);
      if (brakeVec.length() > 0.1) {
        brakeVec.normalize();
        this.body.applyForce(brakeVec.scale(this.brakeForce * this.body.mass));
      }
    }

    if (input.ollie && this.isGrounded) {
      this.body.velocity.y = this.ollieImpulse;
    }

    this.mesh.position.set(this.body.position.x, this.body.position.y - 0.9, this.body.position.z);
    this.mesh.rotation.y = this._yaw;
  }
}
