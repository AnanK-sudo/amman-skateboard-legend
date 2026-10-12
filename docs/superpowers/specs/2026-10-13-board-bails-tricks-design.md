# Board, bails, tricks, stance and camera: design

Date: 2026-10-13. Status: design approved section by section in chat; this spec awaits Anan's review.

## Intent

Round 2 of the skater work. Anan wants the board to look alive and sit on the ground, pushing and riding to look different, the camera to stop being steered by the mouse, a real consequence for botched landings (the rider falls, the board slides away, the player walks back and hops on), and tricks that look realistic and number around 30.

Decisions from the brainstorm:

| Topic | Decision |
|---|---|
| Scope | One spec for all five parts |
| Architecture | Approach A: board as its own kinematic object plus a rider mode machine |
| Camera | No mouse steering while skating; free-look eases back slowly |
| Bail triggers | Unfinished trick, crooked landing, hard wall hit, big drop without bending |
| Recovery | Walk with WASD, press E near the board to hop on; the failed combo is lost |
| Trick input | Direction plus button (Tony Hawk style) |
| Trick families | Flips, held grabs, grinds and slides, manuals with balance, combinable spins |
| Board look | Unlockable decks |

Assumptions (stated in chat, not corrected): flip, grab and grind stay on J, L and F; decks unlock through the existing challenge system; scoring and combo rules stay except where listed below; keyboard only.

Success: wheels touch the ground within 1 mm in close-up; the push pose faces travel with the front foot along the board and visibly pivots back to sideways; the mouse never moves the camera while riding; a kickflip landed early throws the rider off, the board slides away under its own physics, and walking back plus E resumes riding; every trick in the table is reachable by its input and looks distinct in the pose lab.

## 1. Architecture

New units:

| Unit | Job |
|---|---|
| `src/player/RiderMode.ts` | Mode machine `riding / bailing / walking / mounting`; owns transitions and which controller drives the body |
| `src/player/Board.ts` | The board as a kinematic object when not ridden: velocity, spin, ray-based ground and wall handling, friction, settling, respawn |
| `src/player/Walker.ts` | Walking controller: camera-relative WASD, 1.6 m/s, Shift jog 3 m/s, same wall and step rules as riding |
| `src/player/LandingJudge.ts` | Pure function from a touchdown snapshot to `clean` or a bail reason |
| `src/player/tricks/TrickInput.ts` | Key presses to trick requests (direction at press plus button) |
| `src/player/tricks/catalog.ts` | Data for every trick: name, family, input, base score, animation timeline, board rotation axes |
| `src/player/tricks/ManualBalance.ts` | Manual balance meter |
| `src/world/decks.ts` | Deck definitions: graphic painter, wheel colour, unlock rule |
| `src/progression/DeckUnlocks.ts` | Deck unlock rules next to the zone rules |

Changed:

- `Skater.ts` becomes the riding controller only; its bail branch moves to `RiderMode`. It reports touchdown snapshots, player-driven spin, crouch-to-pop ollie height and wall-hit speed loss. Shared ray helpers (ground, walls, step-up) move to `src/player/physicsRays.ts` so `Board` and `Walker` reuse them.
- `SkaterModel.ts` splits the board mesh from the body. Riding: board under the feet as today. Other modes: the board mesh follows `Board`. New states walk, get-up, mount. Push stance body yaw.
- `AnimStateMachine.ts`: trick timelines move to the catalog; adds walk, get-up, mount, held grab, grind types, manual balance lean; outputs body yaw and front-foot yaw.
- `Camera.ts`: mouse steering and pointer lock removed; right-mouse free-look; spring follow; walking and bail framing.
- `TrickSystem.ts`: repeats in a combo score half each time (replaces the consecutive-repeat block); held-grab points; spin multiplier; composed names.
- `GrindDetector.ts`: grind type chosen by direction at lock-on.
- `main.ts`: trick key handling replaced by `TrickInput`; mode wiring; HUD prompts (hop on, deck unlocked, manual balance bar, fakie tag).

Frame order: input → `TrickInput` and `RiderMode` → active controller (`Skater`, `Walker`, or scripted bail and mount) → `Board` when free → `LandingJudge` on touchdown → model → camera.

## 2. Board

Proportions:

| Part | Spec |
|---|---|
| Wheels | 54 mm diameter, 32 mm wide, rounded lathe profile with a core; axle at 27 mm so the wheel bottom sits at y = 0 |
| Trucks | Baseplate, hanger, axle, kingpin, bushings; 55 mm from deck bottom to axle; wheelbase 36 cm |
| Deck | 80 × 20.5 cm, 12 mm thick, rounded nose and tail, kicktails rising about 6 cm over their last 14 cm, slight concave; deck top about 9.5 cm above ground |

The deck is a procedural grid (length × width) with kick and concave offsets, extruded to its thickness, with three materials: grip top, graphic bottom, maple ply edge. All textures are canvas-drawn in code.

Alive: deck rolls toward the loaded edge when carving and both trucks steer into the curve (front and back opposite); wheels spin at true speed for 27 mm radius; on landing the deck dips and rebounds on the bushings by impact. Foot markers move to the new deck height and bolt positions (±0.18 m).

Decks:

| Deck | Graphic | Unlock |
|---|---|---|
| Starter | plain violet with logo | owned |
| Citadel | Temple of Hercules columns | 3 skate park challenges |
| Rainbow Street | stacked hillside houses | 3 street challenges |
| Jasmine | jasmine vines | a 1500-point combo |
| Desert Sun | Wadi Rum dunes at sunset | 5 Old Amman challenges |
| Graffiti | spray tags | every challenge in one zone |

Customize gets a deck row (locked decks show their rule and cannot be picked). The choice saves to `equippedBoard`; unlocks go to `unlockedBoards`. `DeckUnlocks` re-checks after each completed challenge and cashed combo, and the HUD shows "Deck unlocked: <name>".

## 3. Push vs ride stance, camera

Riding stance: fully sideways, feet across the bolts, knees bent, shoulders slightly open to the nose, head down the line.

Pushing stance: hips and shoulders turn 65° from sideways toward travel; the front foot pivots on the front bolt until its toes point at the nose; the push foot plants on the toe side just ahead of the front truck and drives straight back, fixed on the ground during contact; arms counter-swing like walking; head forward. After the last stroke the back foot lands on the tail, then the front foot pivots back and the body turns sideways over 0.3 s. The state machine outputs `bodyYaw = pushWeight × 65°` and a front-foot yaw; the knee pole follows the body; goofy mirrors.

Camera:

- Riding: automatic. No mouse steering, no pointer lock. Follow uses a critically damped spring settling in about 0.5 s. Spins do not drag the camera. The big-move swoop stays.
- Free-look: hold the right mouse button; on release ease back over 1.2 s.
- Walking: follow from 3.5 m with slow yaw; free-look available.
- Bailing: hold position and keep the rider framed during the fall, then hand over to the walking camera.

## 4. Bails, walking, remounting

`LandingJudge` at touchdown:

| Rule | Bail when |
|---|---|
| Trick not finished | Flip progress under 0.85, or the grab button still held |
| Crooked | Body yaw more than 30° from the nearest half turn |
| Hard wall hit | Speed above 9 m/s and the hit removes more than 70 % of it (checked on the hit, not at touchdown) |
| Big drop | Fall over 2.5 m without holding Space; with Space held survive up to 6 m; above 6 m always |

Spins are player-driven: Q and E rotate the body at 540°/s while airborne. The total names the spin (180, 360, 540, nearest half turn). A landed 180 or 540 rides out fakie: a visual mirror of the stance and a FAKIE tag, flipped back by the next odd half turn. Full switch riding is out of scope.

Bail sequence (about 1.6 s): the rider falls by reason (forward slam for unfinished tricks and walls, side tumble for crooked, knees then roll for drops) and slides 0.5 to 2 m with momentum. The board separates with the rider's velocity, a random lateral kick of up to 2 m/s and a yaw spin of 2 to 6 rad/s, may land wheels up (30 %), follows the ground, bounces off walls (restitution 0.4), rolls with low friction wheels down and scrapes to a stop otherwise, and settles below 0.05 m/s. The rider gets up over 0.6 s.

Walking: camera-relative WASD at 1.6 m/s, Shift jogs at 3 m/s; procedural walk cycle (IK steps with stride from speed, arm swing, head bob); same wall rays and 0.3 m step height as riding.

Mounting: within 1.2 m of the board a prompt "E: hop on" shows. E plays a 0.5 s mount (step beside, front foot on, hop) and riding resumes at speed 0 heading from the board end nearest the walker's facing. A wheels-up board is first flipped over with the foot.

Safety nets: a board below y = -10, or settled more than 1.5 m above any ground the walker can reach, respawns beside the walker after 3 s. Tab while walking returns rider and board to the zone spawn. A bail drops the combo; bails count in stats.

## 5. Tricks

Buttons (the direction held at the press picks the trick):

| Button | Use |
|---|---|
| Space | Ollie. Hold to crouch, release to pop; 0 to 0.4 s scales the pop from 5 to 7.5 m/s. Held while landing absorbs drops |
| J | Flips, from the ground (auto-pop) or in the air |
| L | Grabs, held |
| F | Grinds, type by direction at lock-on |
| Shift | Manual; Shift+W nose manual; W/S balance; Space pops out |
| Q / E | Spin left / right in the air |

| Direction | J flip | L grab | F grind |
|---|---|---|---|
| none | kickflip | indy | 50-50 |
| W | impossible | nosegrab | nosegrind |
| S | heelflip | tailgrab | 5-0 |
| A | pop shove-it | melon | boardslide |
| D | 360 shove-it | method | lipslide |
| W+A | varial flip | | crooked |
| W+D | 360 flip | | |
| S+A | hardflip | | |
| S+D | | stalefish | smith |

Plus manual and nose manual, and spins of 180, 360 and 540 that combine with any flip or grab. Names compose as `[Fakie] [spin] <trick>`, for example "360 Varial Flip".

Flip motion in five phases over the trick's progress: wind-up (crouch, shoulders load), pop (tail snap, board pitches up, front foot slides to the nose), trick (board rotates on its true axes: flips about the long axis, shove-its about the vertical, impossible end over end about the back foot's short axis, hardflip vertical between the legs; fast start easing into the catch; head watches the board; shoulders counter-rotate on shove-its), catch at 0.8 (legs extend to meet the board, rotation locks level), landing (knee bend by impact, arms settle, deck dips).

Grabs: knees pull up first, then the hand reaches the right edge or end; holding adds a tweak angle and 50 points per 0.1 s; release before touchdown or bail. Grinds: each type sets the board's angle to the rail (50-50 along, nosegrind tail up, 5-0 nose up, boardslide and lipslide crosswise, crooked on the nose truck angled, smith with the front dipped) and its own body pose.

Manual balance: a value in [-1, 1] that drifts with growing instability over time; W/S push it back; beyond ±1 the rider falls off the back or front (a bail). HUD bar while manualling.

Scoring: base values per trick in the catalog; held grabs add per tick; spins multiply the base (180 ×1.5, 360 ×2, 540 ×3); a trick repeated in one combo scores half each repeat; combo chain and multiplier unchanged. The trick list overlay shows the new table.

## 6. Testing

Unit (no browser): LandingJudge at and past each threshold plus clean landings; Board slide, wall bounce without tunnelling, wheels-down versus wheels-up roll distance, settle, respawn; Walker camera-relative motion, walls, steps, prompt radius; RiderMode full cycle, Tab while walking, combo dropped on bail; TrickInput for every table row and direction-at-press; spins amount and fakie; manual balance drift, hold, fail; scoring repeats, grab ticks, spin multipliers; board geometry (wheel bottoms at y = 0 within 1 mm, deck top 9.5 cm, wheelbase 36 cm); deck unlock rules, save and locked selection; camera ignores mouse while riding, free-look eases back, walking follow; push stance body yaw and front-foot yaw and the return to sideways.

Visual: pose lab extended to every trick at key progress values plus walk, get-up and mount in both stances; a headless game run covering a clean kickflip, an early landing bail, the board sliding off, the walk back and the remount; close-up board shots.

## Out of scope

Full switch riding beyond the fakie mirror, gamepad support, reverts, wallrides and lip tricks, online scores, zone layout changes.
