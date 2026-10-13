import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildBoard, BOARD } from '@/player/board/BoardMesh';
import { DECKS } from '@/world/decks';

function bounds(o: THREE.Object3D): THREE.Box3 {
  let root = o;
  while (root.parent) root = root.parent;
  root.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

describe('Board mesh', () => {
  it('puts the wheel bottoms on the ground', () => {
    const rig = buildBoard(DECKS[0]);
    for (const w of rig.wheels) expect(bounds(w).min.y).toBeCloseTo(0, 3);
  });

  it('sits the deck top at 9.5 cm between the trucks, with a 36 cm wheelbase', () => {
    const rig = buildBoard(DECKS[0]);
    expect(BOARD.DECK_TOP).toBeCloseTo(0.095, 4);
    const top = rig.deck.children[0] as THREE.Mesh;
    const pos = top.geometry.getAttribute('position');
    let centreY = 0;
    for (let i = 0; i < pos.count; i++) if (Math.abs(pos.getX(i)) < 0.01 && Math.abs(pos.getZ(i)) < 0.01) centreY = pos.getY(i);
    expect(centreY).toBeCloseTo(0.095, 3);
    const xs = rig.wheels.map(w => w.getWorldPosition(new THREE.Vector3()).x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(0.36, 3);
  });

  it('raises the kicktails about 6 cm and keeps the wheels clear of the deck', () => {
    const rig = buildBoard(DECKS[0]);
    expect(bounds(rig.deck).max.y).toBeGreaterThan(0.15);
    const wheelTop = Math.max(...rig.wheels.map(w => bounds(w).max.y));
    expect(wheelTop).toBeLessThan(BOARD.DECK_BOTTOM);
  });

  it('steers the trucks in opposite directions', () => {
    const rig = buildBoard(DECKS[0]);
    rig.setSteer(0.1);
    expect(rig.frontHanger.rotation.y).toBeCloseTo(0.1);
    expect(rig.backHanger.rotation.y).toBeCloseTo(-0.1);
  });

  it('swaps the wheel colour with the deck', () => {
    const rig = buildBoard(DECKS[0]);
    rig.setDeck(DECKS[4]);
    expect(((rig.wheels[0].material) as THREE.MeshStandardMaterial).color.getHex()).toBe(DECKS[4].wheelColor);
  });

  it('faces the grip up and the graphic down', () => {
    const rig = buildBoard(DECKS[0]);
    const normalY = (m: THREE.Mesh) => {
      const n = m.geometry.getAttribute('normal');
      let sum = 0;
      for (let i = 0; i < n.count; i++) sum += n.getY(i);
      return sum / n.count;
    };
    expect(normalY(rig.deck.children[0] as THREE.Mesh)).toBeGreaterThan(0.5);
    expect(normalY(rig.deck.children[1] as THREE.Mesh)).toBeLessThan(-0.5);
  });
});
