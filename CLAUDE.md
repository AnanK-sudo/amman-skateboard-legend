# Amman Skateboard Legend

Browser-based 3D skateboarding game set in Amman. Repo `AnanK-sudo/amman-skateboard-legend` (was anan-skate until 2026-10-10).

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
src/main.ts       entry point, scene init
src/core/         game loop, engine utilities
src/player/       player controller, input handling
src/world/        terrain, obstacles, level geometry
src/effects/      visual effects, particles
src/shaders/      custom GLSL shaders
src/ui/           HUD, menus
src/progression/  scoring, unlocks
tests/            unit and integration tests
```

## Deploy
- GitHub Pages: every push to `main` runs `.github/workflows/pages.yml`, which builds with `GITHUB_PAGES=true` so the site lives under `/amman-skateboard-legend/`.
- Vercel project `anan-skate` deploys only from the CLI (`npx vercel --prod --yes`), at base `/`.

## Notes
- cannon-es is a maintained fork of cannon.js. Use its API, not the original cannon.js docs.
- Physics runs at a fixed timestep. Decouple physics updates from the render loop.
- GLSL in src/shaders/: Vite imports these as strings via ?raw or a shader plugin.
- Build asset URLs from `import.meta.env.BASE_URL`, never a leading `/`, or they 404 on GitHub Pages.
- The debug readout only renders on the dev server (`import.meta.env.DEV`).
