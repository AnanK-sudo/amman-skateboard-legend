import * as THREE from 'three';
import { JOINTS, boneName, legBoneNames, type Joint, type JointPose, type Stance } from './mirror';

type Limb = 'front' | 'back';

interface DrivenBone {
  bone: THREE.Object3D;
  restLocal: THREE.Quaternion;
  restLocalPos: THREE.Vector3;
  /** Rest rotation relative to the FBX root */
  rest: THREE.Quaternion;
  /** Rest position relative to the FBX root, world units */
  restPos: THREE.Vector3;
}

const DEG = Math.PI / 180;
const REST_POLE = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();

function basis(dir: THREE.Vector3, pole: THREE.Vector3, out: THREE.Matrix4): THREE.Matrix4 {
  const y = dir.clone().normalize();
  const z = pole.clone().addScaledVector(y, -pole.dot(y));
  if (z.lengthSq() < 1e-8) z.set(1, 0, 0).addScaledVector(y, -y.x);
  z.normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return out.makeBasis(x, y, z);
}

export class Rig {
  private readonly root: THREE.Object3D;
  private readonly bones = new Map<string, DrivenBone>();
  private readonly hips: DrivenBone;
  private stance: Stance = 'regular';

  constructor(fbxRoot: THREE.Object3D) {
    this.root = fbxRoot;
    fbxRoot.updateMatrixWorld(true);
    const rootInv = fbxRoot.getWorldQuaternion(new THREE.Quaternion()).invert();
    const names = new Set<string>();
    for (const s of ['regular', 'goofy'] as Stance[]) {
      for (const j of JOINTS) names.add(boneName(j, s));
      for (const limb of ['front', 'back'] as Limb[]) Object.values(legBoneNames(limb, s)).forEach(n => names.add(n));
    }
    for (const name of names) {
      const bone = fbxRoot.getObjectByName(name);
      if (!bone) throw new Error(`Rig: bone ${name} missing`);
      const rest = rootInv.clone().multiply(bone.getWorldQuaternion(new THREE.Quaternion()));
      const restPos = fbxRoot.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).multiplyScalar(fbxRoot.scale.x);
      this.bones.set(name, { bone, restLocal: bone.quaternion.clone(), restLocalPos: bone.position.clone(), rest, restPos });
    }
    this.hips = this.bones.get('mixamorigHips')!;
  }

  setStance(stance: Stance): void {
    if (stance === this.stance) return;
    this.stance = stance;
    for (const b of this.bones.values()) b.bone.quaternion.copy(b.restLocal);
  }

  /** Rotates each joint about character rest axes (see mirror.ts); joints left out return to rest */
  applyPose(joints: JointPose): void {
    for (const j of JOINTS) {
      const b = this.bones.get(boneName(j, this.stance))!;
      const v = joints[j as Joint];
      if (!v) { b.bone.quaternion.copy(b.restLocal); continue; }
      _q.setFromEuler(_e.set(v[0] * DEG, v[1] * DEG, v[2] * DEG));
      // restLocal * rest^-1 * R * rest: R expressed in character space, applied at this joint
      b.bone.quaternion.copy(b.restLocal).multiply(_q2.copy(b.rest).invert()).multiply(_q).multiply(b.rest);
    }
  }

  setHipDrop(meters: number): void {
    this.hips.bone.position.copy(this.hips.restLocalPos).y -= meters / this.root.scale.x;
  }

  legLengths(): { upper: number; lower: number } {
    const n = legBoneNames('front', this.stance);
    const up = this.bones.get(n.upper)!, lo = this.bones.get(n.lower)!, ft = this.bones.get(n.foot)!;
    return { upper: up.restPos.distanceTo(lo.restPos), lower: lo.restPos.distanceTo(ft.restPos) };
  }

  hipWorld(limb: Limb, out: THREE.Vector3): THREE.Vector3 {
    const b = this.bones.get(legBoneNames(limb, this.stance).upper)!;
    b.bone.updateWorldMatrix(true, false);
    return b.bone.getWorldPosition(out);
  }

  /** The foot's world rotation if it kept its rest orientation relative to the character */
  restFootWorld(limb: Limb, out: THREE.Quaternion): THREE.Quaternion {
    const b = this.bones.get(legBoneNames(limb, this.stance).foot)!;
    return this.root.getWorldQuaternion(out).multiply(b.rest);
  }

  /** Orients thigh and shin through the knee to the ankle, then sets the foot's world rotation */
  aimLeg(limb: Limb, knee: THREE.Vector3, ankle: THREE.Vector3, pole: THREE.Vector3, footWorld: THREE.Quaternion): void {
    const n = legBoneNames(limb, this.stance);
    const up = this.bones.get(n.upper)!, lo = this.bones.get(n.lower)!, ft = this.bones.get(n.foot)!;
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rootInv = rootQ.clone().invert();
    const poleRoot = pole.clone().applyQuaternion(rootInv);

    const hip = this.hipWorld(limb, new THREE.Vector3());
    this.aimSegment(up, knee.clone().sub(hip).applyQuaternion(rootInv), lo.restPos.clone().sub(up.restPos), poleRoot, rootInv);
    lo.bone.updateWorldMatrix(true, false);
    const kneeNow = lo.bone.getWorldPosition(new THREE.Vector3());
    this.aimSegment(lo, ankle.clone().sub(kneeNow).applyQuaternion(rootInv), ft.restPos.clone().sub(lo.restPos), poleRoot, rootInv);

    ft.bone.updateWorldMatrix(true, false);
    this.setBoneWorld(ft, rootInv.clone().multiply(footWorld), rootInv);
  }

  private aimSegment(b: DrivenBone, dir: THREE.Vector3, restDir: THREE.Vector3, pole: THREE.Vector3, rootInv: THREE.Quaternion): void {
    basis(restDir, REST_POLE, _m1);
    basis(dir, pole, _m2);
    _q.setFromRotationMatrix(_m2.multiply(_m1.transpose()));
    this.setBoneWorld(b, _q.multiply(b.rest), rootInv);
  }

  /** Sets the bone's local rotation so it ends up with `desired` rotation relative to the FBX root */
  private setBoneWorld(b: DrivenBone, desired: THREE.Quaternion, rootInv: THREE.Quaternion): void {
    const parent = b.bone.parent!;
    parent.updateWorldMatrix(true, false);
    const parentRel = _q2.copy(rootInv).multiply(parent.getWorldQuaternion(new THREE.Quaternion()));
    b.bone.quaternion.copy(parentRel.invert().multiply(desired));
  }
}
