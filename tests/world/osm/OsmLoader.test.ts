import { describe, it, expect } from 'vitest';
import { OsmLoader } from '@/world/osm/OsmLoader';

const sampleGeoJson = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { building: 'yes', height: 10 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[35.928, 31.954], [35.929, 31.954], [35.929, 31.955], [35.928, 31.955], [35.928, 31.954]]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { highway: 'residential', width: 6 },
      geometry: {
        type: 'LineString' as const,
        coordinates: [[35.927, 31.953], [35.929, 31.953], [35.930, 31.954]],
      },
    },
  ],
};

describe('OsmLoader', () => {
  it('converts building polygon to 3D mesh with correct height', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);
    const buildings = meshes.filter(m => m.userData.type === 'building');
    expect(buildings.length).toBe(1);
    expect(buildings[0].userData.height).toBe(10);
  });

  it('converts road linestring to flat mesh', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);
    const roads = meshes.filter(m => m.userData.type === 'road');
    expect(roads.length).toBe(1);
  });

  it('projects coordinates relative to center', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);
    for (const mesh of meshes) {
      expect(Math.abs(mesh.position.x)).toBeLessThan(200);
      expect(Math.abs(mesh.position.z)).toBeLessThan(200);
    }
  });
});
