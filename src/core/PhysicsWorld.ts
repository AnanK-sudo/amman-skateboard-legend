import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  readonly world: CANNON.World;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.1;
  }

  addBody(body: CANNON.Body): void { this.world.addBody(body); }
  removeBody(body: CANNON.Body): void { this.world.removeBody(body); }

  step(delta: number): void {
    this.world.step(1 / 60, delta, 3);
  }

  createGroundPlane(): CANNON.Body {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(body);
    return body;
  }
}
