export type Family = 'ollie' | 'flip' | 'grab' | 'grind' | 'manual' | 'spin';

/** Direction held at the moment the trick button is pressed */
export type Dir = 'none' | 'W' | 'S' | 'A' | 'D' | 'WA' | 'WD' | 'SA' | 'SD';

export interface FlipMotion {
  /** Turns around the board's long axis (kickflip +, heelflip -) */
  flip: number;
  /** Turns around the vertical axis (backside +) */
  shove: number;
  /** Turns end over end around the back foot (impossible) */
  wrap: number;
}

export interface GrindAngle {
  /** Turns around the vertical axis relative to the rail */
  yaw: number;
  /** Radians, nose up */
  pitch: number;
  /** Radians, toe edge down */
  roll: number;
}

export interface TrickDef {
  id: string;
  name: string;
  family: Family;
  dir?: Dir;
  score: number;
  flip?: FlipMotion;
  grind?: GrindAngle;
  /** Which hand grabs and where, for the grab pose */
  grab?: { hand: 'front' | 'back'; spot: 'toe' | 'heel' | 'nose' | 'tail' };
}

const flip = (id: string, name: string, dir: Dir, score: number, m: Partial<FlipMotion>): TrickDef =>
  ({ id, name, family: 'flip', dir, score, flip: { flip: 0, shove: 0, wrap: 0, ...m } });
const grab = (id: string, name: string, dir: Dir, score: number, hand: 'front' | 'back', spot: 'toe' | 'heel' | 'nose' | 'tail'): TrickDef =>
  ({ id, name, family: 'grab', dir, score, grab: { hand, spot } });
const grind = (id: string, name: string, dir: Dir, score: number, g: Partial<GrindAngle>): TrickDef =>
  ({ id, name, family: 'grind', dir, score, grind: { yaw: 0, pitch: 0, roll: 0, ...g } });

const LIST: TrickDef[] = [
  { id: 'ollie', name: 'Ollie', family: 'ollie', score: 50 },

  flip('kickflip',     'Kickflip',     'none', 200, { flip: 1 }),
  flip('impossible',   'Impossible',   'W',    400, { wrap: 1 }),
  flip('heelflip',     'Heelflip',     'S',    200, { flip: -1 }),
  flip('pop_shove_it', 'Pop Shove-it', 'A',    150, { shove: 0.5 }),
  flip('shove_it_360', '360 Shove-it', 'D',    300, { shove: 1 }),
  flip('varial_flip',  'Varial Flip',  'WA',   300, { flip: 1, shove: 0.5 }),
  flip('tre_flip',     '360 Flip',     'WD',   450, { flip: 1, shove: 1 }),
  flip('hardflip',     'Hardflip',     'SA',   400, { flip: 1, shove: -0.5 }),

  grab('indy',      'Indy',      'none', 200, 'back',  'toe'),
  grab('nosegrab',  'Nosegrab',  'W',    200, 'front', 'nose'),
  grab('tailgrab',  'Tailgrab',  'S',    200, 'back',  'tail'),
  grab('melon',     'Melon',     'A',    200, 'front', 'heel'),
  grab('method',    'Method',    'D',    250, 'front', 'heel'),
  grab('stalefish', 'Stalefish', 'SD',   250, 'back',  'heel'),

  grind('fifty_fifty', '50-50',      'none', 500, {}),
  grind('nosegrind',   'Nosegrind',  'W',    600, { pitch: -0.22 }),
  grind('five_o',      '5-0',        'S',    550, { pitch: 0.22 }),
  grind('boardslide',  'Boardslide', 'A',    500, { yaw: 0.25 }),
  grind('lipslide',    'Lipslide',   'D',    600, { yaw: -0.25 }),
  grind('crooked',     'Crooked',    'WA',   650, { pitch: -0.18, yaw: 0.06 }),
  grind('smith',       'Smith',      'SD',   650, { pitch: 0.14, roll: 0.35 }),

  { id: 'manual',      name: 'Manual',      family: 'manual', dir: 'none', score: 100 },
  { id: 'nose_manual', name: 'Nose Manual', family: 'manual', dir: 'W',    score: 150 },

  { id: 'spin_180', name: '180', family: 'spin', score: 250 },
  { id: 'spin_360', name: '360', family: 'spin', score: 400 },
  { id: 'spin_540', name: '540', family: 'spin', score: 600 },
];

export const TRICKS: Record<string, TrickDef> = Object.fromEntries(LIST.map(t => [t.id, t]));
export const TRICK_LIST: readonly TrickDef[] = LIST;

export function trickFor(family: Family, dir: Dir): TrickDef | null {
  return LIST.find(t => t.family === family && t.dir === dir) ?? null;
}

/** Spin ids by half turns; 4 or more still count as a 540 */
export function spinTrick(halfTurns: number): TrickDef | null {
  const n = Math.min(Math.abs(halfTurns), 3);
  return n === 0 ? null : TRICKS[['', 'spin_180', 'spin_360', 'spin_540'][n]];
}

export const SPIN_MULTIPLIER = [1, 1.5, 2, 3];

/** Held grabs add this many points per tenth of a second */
export const GRAB_TICK_POINTS = 50;
