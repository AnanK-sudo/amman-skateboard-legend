import * as THREE from 'three';
import type { DeckDef } from '../../world/decks';

// Real-world proportions, metres. Board frame: long axis X with the nose at -X, width along Z, ground at y = 0.
export const BOARD = {
  WHEEL_R: 0.027,
  WHEEL_W: 0.032,
  AXLE_Y: 0.027,
  TRUCK_X: 0.18,
  DECK_BOTTOM: 0.083,
  DECK_TOP: 0.095,
  LENGTH: 0.8,
  WIDTH: 0.205,
} as const;

const KICK_START = 0.26;
const KICK_RISE = 0.06;
const END_START = 0.3;
const CONCAVE = 0.007;
const THICK = BOARD.DECK_TOP - BOARD.DECK_BOTTOM;

export interface BoardRig {
  root: THREE.Group;
  /** Deck plus baseplates; dips on landings */
  deck: THREE.Group;
  frontHanger: THREE.Group;
  backHanger: THREE.Group;
  wheels: THREE.Mesh[];
  setDeck(deck: DeckDef): void;
  /** Radians of truck turn; the front truck turns this way, the back the other */
  setSteer(angle: number): void;
  /** Metres the deck sinks on the bushings */
  setDip(metres: number): void;
  /** Rolls the wheels by a distance travelled */
  roll(distance: number): void;
}

function halfWidth(x: number): number {
  const ax = Math.abs(x);
  if (ax <= END_START) return BOARD.WIDTH / 2;
  const u = Math.min((ax - END_START) / (BOARD.LENGTH / 2 - END_START), 1);
  return (BOARD.WIDTH / 2) * Math.sqrt(Math.max(0, 1 - u * u));
}

function surfaceY(x: number, z: number): number {
  const ax = Math.abs(x);
  const k = ax > KICK_START ? Math.min((ax - KICK_START) / (BOARD.LENGTH / 2 - KICK_START), 1) : 0;
  const kick = KICK_RISE * k * k * (3 - 2 * k);
  const c = z / (BOARD.WIDTH / 2);
  return kick + CONCAVE * c * c;
}

/** One surface of the deck (top or bottom) as a grid that follows the outline, kicks and concave */
function deckSurface(offsetY: number, flip: boolean): THREE.BufferGeometry {
  const NX = 48, NZ = 8;
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let i = 0; i <= NX; i++) {
    const x = -BOARD.LENGTH / 2 + (BOARD.LENGTH * i) / NX;
    const hw = halfWidth(x);
    for (let j = 0; j <= NZ; j++) {
      const z = -hw + (2 * hw * j) / NZ;
      pos.push(x, offsetY + surfaceY(x, z), z);
      uv.push(i / NX, j / NZ);
    }
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NZ; j++) {
      const a = i * (NZ + 1) + j, b = a + NZ + 1;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** The ply edge around the outline, joining the top and bottom surfaces */
function deckEdge(): THREE.BufferGeometry {
  const N = 96;
  const outline: [number, number][] = [];
  for (let i = 0; i <= N / 2; i++) { const x = -BOARD.LENGTH / 2 + (BOARD.LENGTH * i) / (N / 2); outline.push([x, halfWidth(x)]); }
  for (let i = N / 2; i >= 0; i--) { const x = -BOARD.LENGTH / 2 + (BOARD.LENGTH * i) / (N / 2); outline.push([x, -halfWidth(x)]); }
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  outline.forEach(([x, z], i) => {
    const y = surfaceY(x, z);
    pos.push(x, BOARD.DECK_BOTTOM + y, z, x, BOARD.DECK_TOP + y, z);
    uv.push(i / outline.length, 0, i / outline.length, 1);
  });
  for (let i = 0; i < outline.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function canvasTexture(w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) paint(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gripTexture(): THREE.CanvasTexture {
  return canvasTexture(128, 128, ctx => {
    ctx.fillStyle = '#1c1c1e';
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 900; i++) {
      const v = 30 + ((i * 73) % 40);
      ctx.fillStyle = `rgb(${v},${v},${v + 2})`;
      ctx.fillRect((i * 37) % 128, (i * 91) % 128, 1, 1);
    }
  });
}

function plyTexture(): THREE.CanvasTexture {
  const plies = ['#d9b382', '#3b2a1e', '#e2c08f', '#8a5a3c', '#e6c595', '#3b2a1e', '#d9b382'];
  return canvasTexture(4, 70, ctx => {
    plies.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * 10, 4, 10); });
  });
}

function wheelGeometry(): THREE.BufferGeometry {
  const r = BOARD.WHEEL_R, hw = BOARD.WHEEL_W / 2, round = 0.008;
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.008, -hw)];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - round + Math.sin(a) * round, -hw + round - Math.cos(a) * round));
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    pts.push(new THREE.Vector2(r - round + Math.cos(a) * round, hw - round + Math.sin(a) * round));
  }
  pts.push(new THREE.Vector2(0.008, hw));
  // Lathe spins around Y; the axle runs along Z
  return new THREE.LatheGeometry(pts, 20).rotateX(Math.PI / 2);
}

function buildTruck(x: number, metal: THREE.Material, bushing: THREE.Material, wheelMat: THREE.Material, wheels: THREE.Mesh[]): { base: THREE.Group; hanger: THREE.Group } {
  const base = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.008, 0.056), metal);
  plate.position.set(x, BOARD.DECK_BOTTOM - 0.004, 0);
  base.add(plate);
  const kingpin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), metal);
  kingpin.position.set(x + (x < 0 ? 0.012 : -0.012), BOARD.DECK_BOTTOM - 0.018, 0);
  base.add(kingpin);
  for (const dy of [0.012, 0.026]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.009, 10), bushing);
    b.position.set(kingpin.position.x, BOARD.DECK_BOTTOM - dy, 0);
    base.add(b);
  }

  // The hanger turns about a near-vertical axis through the pivot
  const hanger = new THREE.Group();
  hanger.position.set(x, BOARD.AXLE_Y, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.022, 0.15), metal);
  body.position.y = 0.012;
  hanger.add(body);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.04), metal);
  neck.position.y = 0.032;
  hanger.add(neck);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.212, 8).rotateX(Math.PI / 2), metal);
  hanger.add(axle);
  const wheelGeo = wheelGeometry();
  for (const z of [-0.092, 0.092]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.z = z;
    wheel.castShadow = true;
    hanger.add(wheel);
    wheels.push(wheel);
  }
  return { base, hanger };
}

export function buildBoard(deckDef: DeckDef): BoardRig {
  const root = new THREE.Group();
  const deck = new THREE.Group();
  root.add(deck);

  const gripMat = new THREE.MeshStandardMaterial({ map: gripTexture(), roughness: 0.95 });
  const graphicMat = new THREE.MeshStandardMaterial({ roughness: 0.6, side: THREE.DoubleSide });
  const plyMat = new THREE.MeshStandardMaterial({ map: plyTexture(), roughness: 0.8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.85, roughness: 0.35 });
  const bushing = new THREE.MeshStandardMaterial({ color: 0xd65a31, roughness: 0.7 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: deckDef.wheelColor, roughness: 0.55 });

  const top = new THREE.Mesh(deckSurface(BOARD.DECK_TOP, true), gripMat);
  const bottom = new THREE.Mesh(deckSurface(BOARD.DECK_BOTTOM, false), graphicMat);
  const edge = new THREE.Mesh(deckEdge(), plyMat);
  for (const m of [top, bottom, edge]) { m.castShadow = true; m.receiveShadow = true; deck.add(m); }

  const wheels: THREE.Mesh[] = [];
  const front = buildTruck(-BOARD.TRUCK_X, metal, bushing, wheelMat, wheels);
  const back = buildTruck(BOARD.TRUCK_X, metal, bushing, wheelMat, wheels);
  deck.add(front.base, back.base);
  root.add(front.hanger, back.hanger);

  const rig: BoardRig = {
    root, deck, frontHanger: front.hanger, backHanger: back.hanger, wheels,
    setDeck(d) {
      graphicMat.map?.dispose();
      graphicMat.map = canvasTexture(512, 128, ctx => d.paint(ctx, 512, 128));
      graphicMat.needsUpdate = true;
      wheelMat.color.setHex(d.wheelColor);
    },
    setSteer(angle) {
      front.hanger.rotation.y = angle;
      back.hanger.rotation.y = -angle;
    },
    setDip(m) { deck.position.y = -m; },
    roll(distance) {
      const a = distance / BOARD.WHEEL_R;
      for (const w of wheels) w.rotation.z -= a;
    },
  };
  rig.setDeck(deckDef);
  return rig;
}
