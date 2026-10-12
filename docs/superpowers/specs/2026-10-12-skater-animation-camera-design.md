# Skater full-body animation and camera: design

Date: 2026-10-12. Status: approved by Anan in chat (approach A, full go to build, push and deploy).

## Intent

Anan wants to see the skater's legs, hands, torso and head move while skating, in each stance and during every trick, with a camera close enough to read it. Reference feel: Tony Hawk readability (big, clear poses, full body in frame) plus cinematic camera moves on big tricks.

Decisions from the brainstorm:

| Topic | Decision |
|---|---|
| Feel | Tony Hawk style framing, cinematic swoops |
| Motion source | All procedural, no new clips; keep the current Mixamo mesh and skeleton |
| Scope | Riding basics, air and landing, flips and spins, grabs, grinds and manuals |
| Push | One foot on the board, one foot pushing; push cadence, foot contact and acceleration tied to the board's real speed |
| Trick camera | Swoops only for big moves: flips, spins, grabs, grinds. Ollies, manuals and riding keep the chase cam |
| Stance | Regular or goofy, chosen in the Customize menu and saved |

Success: in a screenshot of any state the stance is readable (sideways on the board, front foot over the front bolts, head toward travel); the pushing foot never slides on the ground; the board only accelerates while the push foot is down; flips show the legs lifting and the board turning under them; the camera frames the full body while riding and moves in on big tricks.

## Architecture (approach A: pose library plus blending, small IK helpers)

New units in `src/player/anim/`:

| Unit | Job |
|---|---|
| `Rig.ts` | Finds the driven Mixamo bones, records their rest world rotations, applies a pose as rotations in character rest space, sets hip height. |
| `poses.ts` | Data: base poses (degrees, character space) for front and back limbs. |
| `tricks.ts` | Data: each trick as keyframes over progress 0 to 1 (additive joint offsets, foot lift, board flip, spin, pitch, lift). |
| `AnimStateMachine.ts` | Picks the base state from the skater snapshot, blends continuous parameters (crouch, lean), samples the trick timeline, outputs a target `PoseFrame`. |
| `PushCycle.ts` | Push rhythm owned by the physics: phases, contact travel, whether thrust is applied this frame. |
| `FootIK.ts` | Two-bone leg solver with a knee pole; keeps feet on the deck or on the ground. |
| `mirror.ts` | Front/back limb mapping per stance and pose mirroring for goofy. |

Changed files:

- `Skater.ts`: owns a `PushCycle`. Thrust is applied only during the contact phase (scaled so the average acceleration stays close to today's). Exposes `turnInput`, `braking`, `pushState`, `airtime`, `bailProgress`. Trick duration stretches to the expected airtime (`2v/g`, clamped 0.35 to 0.8 s) so flips fill the jump.
- `SkaterModel.ts`: thin coordinator. Hierarchy `group (yaw) > trickPivot (spins, bail) > stanceRoot (+-90 deg sideways) > fbx` plus the board under `trickPivot`. The Mixamo clip and mixer are removed. Each frame: state machine, rig pose, IK, feet, board.
- `Camera.ts`: new chase framing and a big-move swoop driven by a `cameraMoment` flag.
- `main.ts`: passes `isGrinding`, stance and the new fields into the snapshot; reads stance from the save.
- `SaveManager.ts`: `stance: 'regular' | 'goofy'` (default regular). `CustomizeMenu.ts`: a REGULAR/GOOFY toggle.
- The hidden geometric skater stays as the loading fallback; its trick animation code is deleted.

## Pose model

- A pose sets joints in character rest space (character faces +Z, +X is its left, +Y up). For each driven bone the rig writes the bone's identity child slot: `local = W^-1 * R * W`, where `W` is the bone's rest world rotation relative to the FBX root and `R` the pose rotation (Euler XYZ, degrees). This rotates the joint about character axes regardless of Mixamo's bone axes and composes like FK.
- Joints: `hips, spine, spine1, spine2, neck, head, frontArm, frontForeArm, backArm, backForeArm`. Legs come from IK. Arms are in T-pose at rest, so every pose brings them down.
- Front/back: regular rides left foot forward. Front limbs map to Left bones in regular and Right bones in goofy. Goofy mirrors a pose across the sagittal plane: swap sides, negate Y and Z rotations.
- Stance root yaw: regular `-90 deg` (chest faces the right of travel), goofy `+90 deg`.
- Blending: base states blend by weights into a target; each joint slerps toward the target every frame (rate 10, tricks 22). Tricks add on top of the base pose.

## States

| State | When | Body |
|---|---|---|
| idle | grounded, speed < 0.5, no push | relaxed, slight bob, head toward nose |
| push | push cycle active | chest turned toward travel, front knee bent, back leg follows push IK, arms counter-swing |
| ride | grounded, rolling | crouch grows with speed, arms out for balance |
| carve | turning | lean into the turn, hips and arms follow, head leads |
| brake | backward key | weight back, front arm forward |
| pop | first 0.12 s of an ollie | deep crouch then extend |
| air | airborne | tuck, arms out, head down at the board |
| land | 0.25 s after touchdown, scaled by impact | squash, arms drop |
| grind | grinding | low crouch, arms wide, sway |
| manual | manual trick | weight on the tail, nose up, arms balancing, sway |
| bail | bailing | timeline on the pivot: pitch forward, arms reach, roll, get up |

## Tricks (additive timelines)

| Trick | Body | Board |
|---|---|---|
| ollie | back foot snaps, front foot slides up, tuck | pitch nose up then level |
| kickflip | front foot flicks toe side, both feet lift, tuck | one roll around the long axis |
| heelflip | front foot flicks heel side | opposite roll |
| tre flip | back foot scoops | roll plus 360 shove |
| spin | arms wind then lead, head leads | spins with the pivot |
| grab | front hand reaches down to the toe edge, knees up | lifted to the hand |

## Push and feet (the no-slide rule)

- Phases: `reach` (back foot lifts off the deck and moves to the plant point beside the front truck, toe side), `contact` (foot on the ground), `return` (foot lifts and swings back onto the tail).
- During contact the foot stays fixed in the world: its position along travel is `plantZ - contactTravel`, where `contactTravel` integrates the board's speed. Contact ends when the foot reaches the stride end behind the back truck. Stride length scales from 0.6 to 0.9 m with speed, so contact time is `stride / speed`: long strokes when slow, quick ones when fast.
- Thrust only during contact. No new push starts at max speed or without the forward key; a stroke in progress finishes.
- IK: thigh and shin aim at the knee from the law of cosines; the knee pole points where the chest faces. Out-of-reach targets clamp to a straight leg. Feet stay flat on the deck (or ground) and turn with the board's pitch and flip; the front foot turns toward the nose while pushing.

## Camera

- Chase: distance 4.2 (plus up to 1.5 with speed), pitch 0.2 rad, look at hip height (1.0 m). Full body in frame, horizon visible.
- Big move (flip, spin, grab, grind): over 0.35 s ease to distance 3.0, swing 40 deg toward the side the chest faces, lower pitch 0.12; hold during the move; glide back over 0.6 s after landing or grind end.
- Mouse look still adds a decaying offset on top.

## Testing

- `PushCycle`: contact foot world speed is zero; thrust only in contact; cadence rises with speed; no new stroke at max speed.
- `FootIK`: reaches targets within 1 cm; clamps unreachable targets; knee bends toward the pole.
- `Rig` (parses the real FBX in jsdom): an arm-down pose puts the hand below the shoulder; goofy mirrors hand positions.
- `AnimStateMachine`: state selection per snapshot; trick timelines sampled at their keys.
- `Camera`: swoops for kickflip and grind, not for ollie or manual.
- Headless screenshots of idle, push, ride, air, kickflip, grab, grind and manual in both stances.

## Out of scope

Switch riding, new clips, a new character, changes to scoring, grind detection or physics beyond push thrust and trick duration.
