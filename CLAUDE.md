# anan-skate

Browser-based 3D skateboarding game.

## Stack
Three.js (rendering), cannon-es (physics), Vite (bundler), TypeScript

## Commands
```
npm run dev          # Dev server with HMR
npm run build        # Production build to dist/
npm test             # Tests (interactive/watch)
npm run test:run     # Tests (CI mode, single run)
```

## Structure
```
src/main.ts       — entry point, scene init
src/core/         — game loop, engine utilities
src/player/       — player controller, input handling
src/world/        — terrain, obstacles, level geometry
src/effects/      — visual effects, particles
src/shaders/      — custom GLSL shaders
src/ui/           — HUD, menus
src/progression/  — scoring, unlocks
tests/            — unit and integration tests
```

## Notes
- cannon-es is a maintained fork of cannon.js. Use its API, not the original cannon.js docs.
- Physics runs at a fixed timestep. Decouple physics updates from the render loop.
- GLSL in src/shaders/ — Vite imports these as strings via ?raw or a shader plugin.
