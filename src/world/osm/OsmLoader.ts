import * as THREE from 'three';

const METERS_PER_DEG_LAT = 111320;

export interface OsmLoaderOptions {
  center: [number, number]; // [lon, lat]
}

export class OsmLoader {
  private centerLon: number;
  private centerLat: number;
  private cosLat: number;

  constructor(options: OsmLoaderOptions) {
    this.centerLon = options.center[0];
    this.centerLat = options.center[1];
    this.cosLat = Math.cos((this.centerLat * Math.PI) / 180);
  }

  toLocal(lon: number, lat: number): [number, number] {
    const x = (lon - this.centerLon) * METERS_PER_DEG_LAT * this.cosLat;
    const z = -(lat - this.centerLat) * METERS_PER_DEG_LAT;
    return [x, z];
  }

  parse(geojson: GeoJSON.FeatureCollection): THREE.Object3D[] {
    const result: THREE.Object3D[] = [];

    for (const feature of geojson.features) {
      const geom = feature.geometry;
      const props = feature.properties ?? {};

      if (geom.type === 'Polygon' && props['building']) {
        const mesh = this._buildingFromPolygon(geom as GeoJSON.Polygon, props);
        if (mesh) result.push(mesh);
      } else if (geom.type === 'LineString' && props['highway']) {
        const mesh = this._roadFromLineString(geom as GeoJSON.LineString, props);
        if (mesh) result.push(mesh);
      }
    }

    return result;
  }

  private _buildingFromPolygon(
    geom: GeoJSON.Polygon,
    props: Record<string, unknown>,
  ): THREE.Mesh | null {
    const ring = geom.coordinates[0];
    if (!ring || ring.length < 3) return null;

    const height = typeof props['height'] === 'number' ? props['height'] : 6;

    const shape = new THREE.Shape();
    const [x0, z0] = this.toLocal(ring[0][0], ring[0][1]);
    shape.moveTo(x0, z0);

    for (let i = 1; i < ring.length - 1; i++) {
      const [x, z] = this.toLocal(ring[i][0], ring[i][1]);
      shape.lineTo(x, z);
    }
    shape.closePath();

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: height,
      bevelEnabled: false,
    };

    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // ExtrudeGeometry extrudes along Z; rotate so extrusion goes up (Y)
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, roughness: 0.8 });
    const mesh = new THREE.Mesh(geo, mat);

    // Compute centroid for position placement
    const [cx, cz] = this._polygonCentroid(ring);
    mesh.position.set(cx, 0, cz);

    mesh.userData.type = 'building';
    mesh.userData.height = height;

    return mesh;
  }

  private _roadFromLineString(
    geom: GeoJSON.LineString,
    props: Record<string, unknown>,
  ): THREE.Group | null {
    const coords = geom.coordinates;
    if (coords.length < 2) return null;

    const width = typeof props['width'] === 'number' ? props['width'] : 4;
    const halfW = width / 2;

    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 1 });

    for (let i = 0; i < coords.length - 1; i++) {
      const [ax, az] = this.toLocal(coords[i][0], coords[i][1]);
      const [bx, bz] = this.toLocal(coords[i + 1][0], coords[i + 1][1]);

      const dx = bx - ax;
      const dz = bz - az;
      const len = Math.sqrt(dx * dx + dz * dz);
      if (len === 0) continue;

      const angle = Math.atan2(dx, dz);

      const geo = new THREE.PlaneGeometry(width, len);
      const quad = new THREE.Mesh(geo, mat);

      quad.rotation.x = -Math.PI / 2;
      quad.rotation.z = -angle;

      quad.position.set((ax + bx) / 2, 0, (az + bz) / 2);

      group.add(quad);
      void halfW;
    }

    // Set group position at midpoint of whole line for userData check
    const [fx, fz] = this.toLocal(coords[0][0], coords[0][1]);
    const [lx, lz] = this.toLocal(
      coords[coords.length - 1][0],
      coords[coords.length - 1][1],
    );
    group.position.set((fx + lx) / 2, 0, (fz + lz) / 2);

    group.userData.type = 'road';

    return group;
  }

  private _polygonCentroid(ring: number[][]): [number, number] {
    let sumX = 0;
    let sumZ = 0;
    const n = ring.length - 1; // last point duplicates first
    for (let i = 0; i < n; i++) {
      const [x, z] = this.toLocal(ring[i][0], ring[i][1]);
      sumX += x;
      sumZ += z;
    }
    return [sumX / n, sumZ / n];
  }
}
