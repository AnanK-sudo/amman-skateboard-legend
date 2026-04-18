import * as THREE from 'three';

export interface GrindableObject {
  grindPath: { start: THREE.Vector3; end: THREE.Vector3 };
}

export class GrindDetector {
  private grindables: GrindableObject[] = [];
  private _isGrinding = false;
  private _grindProgress = 0; // 0-1 along the rail
  private _grindTarget: GrindableObject | null = null;
  private grindSpeed = 8; // meters per second along rail
  private snapDistance = 1.5; // how close to rail to start grinding

  register(obj: GrindableObject): void {
    this.grindables.push(obj);
  }

  clear(): void {
    this.grindables = [];
    this._isGrinding = false;
    this._grindTarget = null;
  }

  get isGrinding(): boolean { return this._isGrinding; }
  get grindProgress(): number { return this._grindProgress; }

  // Call each frame with skater position and whether grind button (F) is held
  update(
    skaterPos: THREE.Vector3,
    grindInput: boolean,
    delta: number
  ): { position: THREE.Vector3; yaw: number } | null {

    if (this._isGrinding && this._grindTarget) {
      // Continue grinding — move along rail
      this._grindProgress += (this.grindSpeed * delta) / this.getRailLength(this._grindTarget);

      if (this._grindProgress >= 1 || !grindInput) {
        // End grind
        this._isGrinding = false;
        this._grindTarget = null;
        return null;
      }

      // Interpolate position along rail
      const pos = this.getPointOnRail(this._grindTarget, this._grindProgress);
      const dir = new THREE.Vector3().subVectors(
        this._grindTarget.grindPath.end,
        this._grindTarget.grindPath.start
      ).normalize();
      const yaw = Math.atan2(-dir.x, -dir.z);

      return { position: pos, yaw };
    }

    // Not grinding — check if we should start
    if (grindInput && !this._isGrinding) {
      let closest: GrindableObject | null = null;
      let closestDist = this.snapDistance;

      for (const obj of this.grindables) {
        const dist = this.distanceToRail(skaterPos, obj);
        if (dist < closestDist) {
          closestDist = dist;
          closest = obj;
        }
      }

      if (closest) {
        this._isGrinding = true;
        this._grindTarget = closest;
        this._grindProgress = this.getClosestT(skaterPos, closest);
        const pos = this.getPointOnRail(closest, this._grindProgress);
        const dir = new THREE.Vector3().subVectors(
          closest.grindPath.end,
          closest.grindPath.start
        ).normalize();
        return { position: pos, yaw: Math.atan2(-dir.x, -dir.z) };
      }
    }

    return null;
  }

  private getRailLength(obj: GrindableObject): number {
    return obj.grindPath.start.distanceTo(obj.grindPath.end);
  }

  private getPointOnRail(obj: GrindableObject, t: number): THREE.Vector3 {
    return new THREE.Vector3().lerpVectors(obj.grindPath.start, obj.grindPath.end, t);
  }

  private getClosestT(pos: THREE.Vector3, obj: GrindableObject): number {
    const ab = new THREE.Vector3().subVectors(obj.grindPath.end, obj.grindPath.start);
    const ap = new THREE.Vector3().subVectors(pos, obj.grindPath.start);
    const t = ap.dot(ab) / ab.dot(ab);
    return Math.max(0, Math.min(1, t));
  }

  private distanceToRail(pos: THREE.Vector3, obj: GrindableObject): number {
    const t = this.getClosestT(pos, obj);
    const closest = this.getPointOnRail(obj, t);
    // Only count horizontal + small vertical tolerance
    const dx = pos.x - closest.x;
    const dy = pos.y - closest.y;
    const dz = pos.z - closest.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
}
