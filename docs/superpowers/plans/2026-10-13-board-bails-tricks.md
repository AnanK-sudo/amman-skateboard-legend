# Board, Bails, Tricks, Stance and Camera Implementation Plan

> Executed inline by the session that wrote it (Anan approved the spec and asked to build). TDD per task: failing test, implement, pass, commit.

**Goal:** A real-looking board with unlockable decks, a squared-up push stance, an automatic camera, bails that separate rider and board with a walk-back and remount, and a direction-plus-button trick system with about 30 tricks.

**Architecture:** Approach A from the spec. A `RiderMode` machine chooses the active controller (`Skater` riding, scripted bail, `Walker`, scripted mount); `Board` is its own kinematic object when free; `LandingJudge` decides bails at touchdown; tricks are catalog data read by `TrickInput`, `TrickSystem`, `Skater` and the animation state machine.

**Tech Stack:** Three.js, cannon-es (static colliders and raycasts only), Vite, TypeScript strict, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-10-13-board-bails-tricks-design.md`

## Global Constraints

- Travel is +Z rotated by yaw; character rest space faces +Z with +X its left; regular rides left foot forward.
- Wheel bottoms at y = 0 within 1 mm; deck top 0.095 m; wheelbase 0.36 m.
- Bail thresholds: flip progress < 0.85, grab held, yaw > 30 deg off a half turn, wall hit > 9 m/s losing > 70 %, drop > 2.5 m without Space (always above 6 m).
- Keys: Space ollie (hold to charge 0 to 0.4 s, 5 to 7.5 m/s), J flip, L grab, F grind, Shift manual, Q/E spin, E mount (walking only), right mouse free-look.
- Trick ids already used by challenges stay: `ollie`, `kickflip`, `heelflip`, `tre_flip`, `spin_180`, `spin_360`, `spin_540`, `fifty_fifty`, `manual`.
- No new dependencies. No comments unless the why is non-obvious. No emojis.

## Review Focus

1. Pressing E while airborne spins, never mounts; pressing E while walking far from the board does nothing. Test in Task 11.
2. Bail while grinding or manualling (balance fail) uses the same separation path as a landing bail. Test in Task 11.
3. Board settles inside geometry or on a roof out of reach: respawn path triggers. Test in Task 9.
4. Holding a trick button through a zone switch (Tab) does not leave a stale held grab or charge. Test in Task 7.
5. Deck unlocks are idempotent: re-checking after every combo does not duplicate entries or re-announce. Test in Task 3.

---

### Task 1: Shared physics rays
Create `src/player/physicsRays.ts` with `groundBelow(world, x, z, fromY)`, `findWall(world, pos, feetY, dx, dz, radius, heights, sides)`, `isStepUp(world, hit, normal, step)`, `resolveWalls(...)`. `Skater` uses them; behaviour unchanged (all collision tests stay green).

### Task 2: Board geometry
Create `src/player/board/BoardMesh.ts`: `buildBoard(deck: DeckDef): BoardRig` returning `{ root, deckMesh, frontTruck, backTruck, wheels, setDeck(deck) }`. Deck grid with kick and concave, ply edge, grip and graphic canvas textures, trucks (baseplate, hanger, axle, kingpin, bushings), lathe wheels radius 0.027. `SkaterModel` uses it: deck top 0.095, bolts plus or minus 0.18, truck steer from carve roll, landing dip. Tests: wheel bottoms at y = 0 within 1 mm, deck top 0.095 within 2 mm, wheelbase 0.36, trucks turn opposite under roll.

### Task 3: Decks and unlocks
`src/world/decks.ts` (`DECKS: DeckDef[]`, canvas painters), `src/progression/DeckUnlocks.ts` (`newlyUnlocked(completed, bestCombo, owned): string[]`), Customize deck row, save `equippedBoard`, `unlockedBoards`, `bestCombo`. Tests: each rule, idempotence, locked selection refused.

### Task 4: Push stance
`PoseFrame.bodyYaw` (radians, regular space) = pushWeight times 65 deg; `frontFootYaw`; model adds bodyYaw to stance root and turns the front foot; push plant ahead of the front truck. Tests: push weight 1 gives 65 deg, returns to 0 after the stroke, goofy mirrored.

### Task 5: Camera
Remove mouse steering and pointer lock; right mouse free-look with 1.2 s ease back; critically damped follow (about 0.5 s); `mode: 'ride' | 'walk' | 'bail'` framing. Tests: mouse deltas ignored while riding, free-look returns, walk distance 3.5.

### Task 6: Trick catalog, input, scoring
`src/player/tricks/catalog.ts` (`TRICKS: Record<TrickId, TrickDef>` with family, input, score, board axes, timeline keys), `TrickInput.ts` (`read(input): TrickRequest[]`, direction at press), `TrickSystem` (repeat halving, held-grab ticks, spin multiplier, composed names). Tests: every table row, direction at press, scoring rules.

### Task 7: Skater trick mechanics
Charged ollie, Q/E spin at 540 deg/s with spin total, held grab state, fakie flag, manual with `ManualBalance`, touchdown snapshot `{ trick, progress, grabHeld, spinResidualDeg, dropHeight, crouched, impactSpeed }`, wall-hit speed loss event. Tests: charge scaling, spin totals and fakie, balance drift and failure, snapshot values, Tab clears held state.

### Task 8: LandingJudge
`judgeLanding(snapshot): { clean: true } | { clean: false; reason: BailReason }` and `judgeWallHit(speedBefore, speedAfter)`. Tests at and past each threshold.

### Task 9: Free board
`src/player/board/Board.ts`: `launch(pos, vel, yaw, spin, wheelsUp)`, `update(dt)`, settles, respawn rules. Tests: slides, bounces off a wall without tunnelling, wheels-down rolls further, settles, respawns below -10 or out of reach.

### Task 10: Walker
`src/player/Walker.ts`: camera-relative WASD, 1.6 m/s, Shift 3 m/s, shared rays. Tests: direction from camera yaw, walls, steps.

### Task 11: RiderMode and main wiring
`src/player/RiderMode.ts` (`riding / bailing / walking / mounting`), bail separation from landings, walls, manual and grinds; mount prompt within 1.2 m; Tab reset; HUD prompt, FAKIE tag, balance bar; random landing bail removed. Tests: full cycle, E radius and airborne E, grind and manual bails, combo dropped.

### Task 12: Animation for the new tricks and modes
Catalog timelines in five phases for every flip and grab, grind type poses and board angles, walk cycle, get-up, mount, bail variants by reason, held grab tweak. Pose lab gains every trick. Tests: each flip completes its board rotation axes at progress 1, grind types set distinct board yaw, walk alternates feet.

### Task 13: Grind types
`GrindDetector` takes the grind type at lock-on; trick list overlay rewritten from the catalog.

### Task 14: Verify and ship
Full suite, typecheck, build, headless run (clean kickflip, early-landing bail, board slides, walk, remount), close-up board shot, push, Vercel deploy, Pages, memory.
