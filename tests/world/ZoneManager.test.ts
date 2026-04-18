import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneManager } from '@/world/ZoneManager';
import { Zone } from '@/world/ZoneBase';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

function makeMockZone(id: string): Zone {
  return {
    config: { id, name: id, spawnPoint: new THREE.Vector3() },
    load: vi.fn(),
    unload: vi.fn(),
  };
}

describe('ZoneManager', () => {
  let scene: THREE.Scene;
  let world: CANNON.World;
  let manager: ZoneManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    world = new CANNON.World();
    manager = new ZoneManager(scene, world);
  });

  it('registers zones', () => {
    const zone = makeMockZone('park');
    manager.register(zone);
    expect(manager.getZone('park')).toBe(zone);
  });

  it('loads a zone and calls load()', () => {
    const zone = makeMockZone('park');
    manager.register(zone);
    manager.switchTo('park');
    expect(zone.load).toHaveBeenCalledWith(scene, world);
    expect(manager.activeZoneId).toBe('park');
  });

  it('unloads previous zone when switching', () => {
    const park = makeMockZone('park');
    const street = makeMockZone('street');
    manager.register(park);
    manager.register(street);
    manager.switchTo('park');
    manager.switchTo('street');
    expect(park.unload).toHaveBeenCalledWith(scene, world);
    expect(street.load).toHaveBeenCalledWith(scene, world);
  });

  it('returns null for unknown zone', () => {
    expect(manager.getZone('unknown')).toBeNull();
  });
});
