import * as THREE from 'three';

export interface CharacterStyle {
  shirtColor: number;
  pantsColor: number;
  shoeColor: number;
  hatColor: number;
  skinColor: number;
  boardColor: number;
  boardAccent: number;  // stripe/design color
  wheelColor: number;
}

export const PRESET_STYLES: Record<string, CharacterStyle> = {
  default: {
    shirtColor: 0xff6b35, pantsColor: 0x2d2d4e, shoeColor: 0x222222,
    hatColor: 0xff6b35, skinColor: 0xffb088, boardColor: 0xd2a8ff,
    boardAccent: 0xff6b35, wheelColor: 0xffffff,
  },
  midnight: {
    shirtColor: 0x1a1a3e, pantsColor: 0x0d0d1e, shoeColor: 0x111111,
    hatColor: 0x3fb950, skinColor: 0xffb088, boardColor: 0x1a1a3e,
    boardAccent: 0x3fb950, wheelColor: 0x3fb950,
  },
  amman: {
    shirtColor: 0xd4c4a0, pantsColor: 0x5a4a30, shoeColor: 0x3a2a1a,
    hatColor: 0xc4b090, skinColor: 0xe0b880, boardColor: 0x8b6914,
    boardAccent: 0xff6b35, wheelColor: 0xd4c4a0,
  },
  neon: {
    shirtColor: 0xff00ff, pantsColor: 0x000000, shoeColor: 0x00ffff,
    hatColor: 0xff00ff, skinColor: 0xffb088, boardColor: 0x000000,
    boardAccent: 0x00ff00, wheelColor: 0xff00ff,
  },
  stealth: {
    shirtColor: 0x1a1a1a, pantsColor: 0x111111, shoeColor: 0x080808,
    hatColor: 0x1a1a1a, skinColor: 0xffb088, boardColor: 0x222222,
    boardAccent: 0xff0000, wheelColor: 0x333333,
  },
  sunset: {
    shirtColor: 0xff4500, pantsColor: 0x2d1b00, shoeColor: 0x1a0a00,
    hatColor: 0xffaa00, skinColor: 0xffb088, boardColor: 0xff6b35,
    boardAccent: 0xffdd00, wheelColor: 0xff8800,
  },
  ocean: {
    shirtColor: 0x0077be, pantsColor: 0x003355, shoeColor: 0x001a2e,
    hatColor: 0x00aaff, skinColor: 0xffb088, boardColor: 0x004488,
    boardAccent: 0x00ddff, wheelColor: 0x88ccff,
  },
  graffiti: {
    shirtColor: 0x8b00ff, pantsColor: 0x2a0a4a, shoeColor: 0x1a0a2a,
    hatColor: 0xff1493, skinColor: 0xffb088, boardColor: 0x4a0080,
    boardAccent: 0xff1493, wheelColor: 0xff69b4,
  },
};

export const BOARD_DESIGNS = ['solid', 'stripe', 'split', 'gradient'] as const;
export type BoardDesign = typeof BOARD_DESIGNS[number];

export class Customization {
  private style: CharacterStyle;
  private boardDesign: BoardDesign = 'solid';

  constructor(styleName = 'default') {
    this.style = { ...PRESET_STYLES[styleName] || PRESET_STYLES.default };
  }

  getStyle(): CharacterStyle { return this.style; }
  getBoardDesign(): BoardDesign { return this.boardDesign; }

  setPreset(name: string): void {
    if (PRESET_STYLES[name]) {
      this.style = { ...PRESET_STYLES[name] };
    }
  }

  setBoardDesign(design: BoardDesign): void {
    this.boardDesign = design;
  }

  setColor(part: keyof CharacterStyle, color: number): void {
    this.style[part] = color;
  }

  // Apply style to a skater mesh group
  // Expects the skater's innerGroup children in order:
  // [0]=torso, [1]=head, [2]=leftArm, [3]=rightArm, [4]=leftLeg, [5]=rightLeg, [6]=hat, [7]=leftShoe, [8]=rightShoe
  // And boardGroup children: [0]=board, [1]=frontTruck, [2]=backTruck, then wheels
  applyToSkater(innerGroup: THREE.Group, boardGroup: THREE.Group): void {
    const s = this.style;

    // Body parts
    const torso = innerGroup.children[0] as THREE.Mesh;
    const head = innerGroup.children[1] as THREE.Mesh;
    const leftArm = innerGroup.children[2] as THREE.Mesh;
    const rightArm = innerGroup.children[3] as THREE.Mesh;
    const leftLeg = innerGroup.children[4] as THREE.Mesh;
    const rightLeg = innerGroup.children[5] as THREE.Mesh;

    if (torso?.material) (torso.material as THREE.MeshStandardMaterial).color.setHex(s.shirtColor);
    if (head?.material) (head.material as THREE.MeshStandardMaterial).color.setHex(s.skinColor);
    if (leftArm?.material) (leftArm.material as THREE.MeshStandardMaterial).color.setHex(s.shirtColor);
    if (rightArm?.material) (rightArm.material as THREE.MeshStandardMaterial).color.setHex(s.shirtColor);
    if (leftLeg?.material) (leftLeg.material as THREE.MeshStandardMaterial).color.setHex(s.pantsColor);
    if (rightLeg?.material) (rightLeg.material as THREE.MeshStandardMaterial).color.setHex(s.pantsColor);

    // Hat (index 6 if exists)
    const hat = innerGroup.children[6] as THREE.Mesh | undefined;
    if (hat?.material) (hat.material as THREE.MeshStandardMaterial).color.setHex(s.hatColor);

    // Shoes (index 7, 8 if exist)
    const leftShoe = innerGroup.children[7] as THREE.Mesh | undefined;
    const rightShoe = innerGroup.children[8] as THREE.Mesh | undefined;
    if (leftShoe?.material) (leftShoe.material as THREE.MeshStandardMaterial).color.setHex(s.shoeColor);
    if (rightShoe?.material) (rightShoe.material as THREE.MeshStandardMaterial).color.setHex(s.shoeColor);

    // Board
    const board = boardGroup.children[0] as THREE.Mesh;
    if (board?.material) (board.material as THREE.MeshStandardMaterial).color.setHex(s.boardColor);

    // Wheels (after trucks, indices 3+)
    for (let i = 3; i < boardGroup.children.length; i++) {
      const wheel = boardGroup.children[i] as THREE.Mesh;
      if (wheel?.material) (wheel.material as THREE.MeshStandardMaterial).color.setHex(s.wheelColor);
    }
  }

  // Serialize for save
  toJSON(): { preset?: string; boardDesign: string; style: CharacterStyle } {
    return { boardDesign: this.boardDesign, style: { ...this.style } };
  }

  // Load from save
  fromJSON(data: { preset?: string; boardDesign?: string; style?: Partial<CharacterStyle> }): void {
    if (data.style) Object.assign(this.style, data.style);
    if (data.boardDesign) this.boardDesign = data.boardDesign as BoardDesign;
  }
}
