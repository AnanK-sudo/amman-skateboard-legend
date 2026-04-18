import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone } from './ZoneBase';

export class ZoneManager {
  private zones = new Map<string, Zone>();
  private _activeZoneId: string | null = null;
  private scene: THREE.Scene;
  private world: CANNON.World;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.scene = scene;
    this.world = world;
  }

  get activeZoneId(): string | null { return this._activeZoneId; }

  register(zone: Zone): void { this.zones.set(zone.config.id, zone); }

  getZone(id: string): Zone | null { return this.zones.get(id) ?? null; }

  switchTo(id: string): void {
    const zone = this.zones.get(id);
    if (!zone) throw new Error(`Zone "${id}" not registered`);
    if (this._activeZoneId) {
      const current = this.zones.get(this._activeZoneId)!;
      current.unload(this.scene, this.world);
    }
    zone.load(this.scene, this.world);
    this._activeZoneId = id;
  }
}
