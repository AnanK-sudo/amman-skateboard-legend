# Anan's Skateboarding Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personalized 3D skateboarding game in the browser with Three.js, featuring third-person controls, a full trick/combo system, 3 zones (Skate Park, Street Spot, Old Amman from OSM data), progression/unlocks, and street art/graffiti visuals.

**Architecture:** Vite + TypeScript project. Three.js for rendering, cannon-es for physics. Game loop manages scene, physics world, input, and state. Each zone is a self-contained module exporting geometry and metadata. HUD is an HTML/CSS overlay on the canvas. All state persisted to localStorage.

**Tech Stack:** TypeScript, Three.js, cannon-es, Vite, Vercel

---

## File Structure

```
anan-skate/
├── index.html                      # Entry point, canvas + HUD container
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.ts                     # Bootstrap: init renderer, physics, game loop
│   ├── core/
│   │   ├── Engine.ts               # Game loop (update/render cycle, delta time)
│   │   ├── InputManager.ts         # Keyboard + mouse state, pointer lock
│   │   ├── PhysicsWorld.ts         # cannon-es world wrapper, step, helpers
│   │   └── AudioManager.ts         # Stub for later audio phase
│   ├── player/
│   │   ├── Skater.ts               # Three.js mesh + cannon-es body, movement
│   │   ├── SkaterAnimations.ts     # Animation state machine for tricks
│   │   ├── TrickSystem.ts          # Trick detection, combo chain, scoring
│   │   └── Camera.ts               # Third-person follow camera
│   ├── world/
│   │   ├── ZoneManager.ts          # Load/unload zones, transitions
│   │   ├── ZoneBase.ts             # Interface/base class for zones
│   │   ├── zones/
│   │   │   ├── SkatePark.ts        # Zone 1: procedural skate park
│   │   │   ├── StreetSpot.ts       # Zone 2: procedural street spot
│   │   │   └── OldAmman.ts         # Zone 4: OSM-based Amman zone
│   │   ├── objects/
│   │   │   ├── Rail.ts             # Grindable rail (mesh + physics + grind path)
│   │   │   ├── Ramp.ts             # Quarter pipe / halfpipe / launch ramp
│   │   │   ├── Stairs.ts           # Stair set with handrail
│   │   │   ├── Ledge.ts            # Grindable ledge/bench
│   │   │   └── Platform.ts         # Flat platform / fun box
│   │   └── osm/
│   │       └── OsmLoader.ts        # Parse OSM GeoJSON → Three.js geometry
│   ├── progression/
│   │   ├── ChallengeManager.ts     # Challenge definitions, tracking, completion
│   │   ├── UnlockManager.ts        # Zone unlocks, cosmetic unlocks
│   │   └── SaveManager.ts          # localStorage read/write, export/import
│   ├── ui/
│   │   ├── HUD.ts                  # Score, combo, trick flash, speed, challenge
│   │   ├── PauseMenu.ts            # Pause overlay with menu options
│   │   ├── MainMenu.ts             # Title screen
│   │   ├── CustomizeMenu.ts        # Board/outfit/wheel picker
│   │   └── TrickListOverlay.ts     # Trick reference sheet
│   └── shaders/
│       ├── OutlineShader.ts        # Cel-shading / outline post-processing
│       └── GraffitiMaterial.ts     # Spray-paint textured material
├── public/
│   ├── models/                     # GLTF models (skater, board)
│   ├── textures/                   # Graffiti textures, ground, walls
│   └── data/
│       └── old-amman.geojson       # Exported OSM data for Old Amman zone
├── tests/
│   ├── core/
│   │   ├── Engine.test.ts
│   │   └── InputManager.test.ts
│   ├── player/
│   │   ├── TrickSystem.test.ts
│   │   └── Skater.test.ts
│   ├── world/
│   │   ├── ZoneManager.test.ts
│   │   └── osm/OsmLoader.test.ts
│   ├── progression/
│   │   ├── ChallengeManager.test.ts
│   │   ├── UnlockManager.test.ts
│   │   └── SaveManager.test.ts
│   └── setup.ts                    # Test setup: mock canvas, RAF, etc.
```

---

## Task 1: Project Scaffold & Dev Server

**Files:**
- Create: `anan-skate/package.json`
- Create: `anan-skate/tsconfig.json`
- Create: `anan-skate/vite.config.ts`
- Create: `anan-skate/index.html`
- Create: `anan-skate/src/main.ts`
- Create: `anan-skate/.gitignore`

- [ ] **Step 1: Create project directory and initialize**

```bash
mkdir -p ~/anan-skate && cd ~/anan-skate
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install three cannon-es
npm install -D typescript vite @types/three vitest jsdom
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **Step 4: Write vite.config.ts**

```ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
  },
});
```

- [ ] **Step 5: Write index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ANAN SKATE</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: #0d0d0d; font-family: 'Impact', 'Arial Black', sans-serif; }
    #game-canvas { display: block; width: 100vw; height: 100vh; }
    #hud { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
    #hud > * { pointer-events: auto; }
  </style>
</head>
<body>
  <canvas id="game-canvas"></canvas>
  <div id="hud"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **Step 6: Write src/main.ts (minimal — just renders a colored background)**

```ts
import * as THREE from 'three';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

// Placeholder ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

console.log('ANAN SKATE — engine running');
```

- [ ] **Step 7: Write .gitignore**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 8: Write test setup file**

Create `tests/setup.ts`:
```ts
// Mock canvas and requestAnimationFrame for test environment
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: () => {},
    clearRect: () => {},
    getImageData: () => ({ data: [] }),
    putImageData: () => {},
    createImageData: () => [],
    setTransform: () => {},
    drawImage: () => {},
    save: () => {},
    fillText: () => {},
    restore: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    closePath: () => {},
    stroke: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    arc: () => {},
    fill: () => {},
    measureText: () => ({ width: 0 }),
    transform: () => {},
    rect: () => {},
    clip: () => {},
  }),
});

global.requestAnimationFrame = (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 0) as unknown as number;
};
global.cancelAnimationFrame = (id: number) => clearTimeout(id);
```

- [ ] **Step 9: Update package.json scripts**

Add to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 10: Run dev server and verify**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Vite starts, open browser to localhost, see dark purple ground plane on dark background.

- [ ] **Step 11: Initialize git and commit**

```bash
cd ~/anan-skate && git init && git add -A && git commit -m "feat: project scaffold with Three.js, Vite, and test setup"
```

---

## Task 2: Game Engine Loop

**Files:**
- Create: `src/core/Engine.ts`
- Create: `tests/core/Engine.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/Engine.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { Engine } from '@/core/Engine';

describe('Engine', () => {
  it('calls update and render callbacks each frame', () => {
    const update = vi.fn();
    const render = vi.fn();
    const engine = new Engine({ update, render });

    // Simulate one frame
    engine.tick(16.67);

    expect(update).toHaveBeenCalledOnce();
    expect(render).toHaveBeenCalledOnce();
  });

  it('passes delta time in seconds to update', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });

    engine.tick(16.67);

    const delta = update.mock.calls[0][0];
    expect(delta).toBeCloseTo(0.01667, 3);
  });

  it('clamps delta time to prevent spiral of death', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });

    // Simulate a 500ms frame (tab was backgrounded)
    engine.tick(500);

    const delta = update.mock.calls[0][0];
    expect(delta).toBeLessThanOrEqual(0.1); // Max 100ms
  });

  it('tracks elapsed time', () => {
    const engine = new Engine({ update: vi.fn(), render: vi.fn() });

    engine.tick(16.67);
    engine.tick(16.67);

    expect(engine.elapsed).toBeCloseTo(0.03334, 3);
  });

  it('can pause and resume', () => {
    const update = vi.fn();
    const engine = new Engine({ update, render: vi.fn() });

    engine.pause();
    engine.tick(16.67);
    expect(update).not.toHaveBeenCalled();

    engine.resume();
    engine.tick(16.67);
    expect(update).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/core/Engine.test.ts
```
Expected: FAIL — cannot resolve `@/core/Engine`

- [ ] **Step 3: Write Engine implementation**

Create `src/core/Engine.ts`:
```ts
export interface EngineCallbacks {
  update: (delta: number) => void;
  render: () => void;
}

export class Engine {
  private callbacks: EngineCallbacks;
  private paused = false;
  private _elapsed = 0;
  private maxDelta = 0.1; // 100ms cap

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  get elapsed(): number {
    return this._elapsed;
  }

  tick(deltaMs: number): void {
    if (this.paused) return;

    const delta = Math.min(deltaMs / 1000, this.maxDelta);
    this._elapsed += delta;
    this.callbacks.update(delta);
    this.callbacks.render();
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  start(): void {
    let lastTime = performance.now();
    const loop = (now: number) => {
      const deltaMs = now - lastTime;
      lastTime = now;
      this.tick(deltaMs);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/core/Engine.test.ts
```
Expected: All 5 tests PASS

- [ ] **Step 5: Integrate Engine into main.ts**

Replace the `animate()` loop in `src/main.ts`:
```ts
import * as THREE from 'three';
import { Engine } from '@/core/Engine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 10);
camera.lookAt(0, 0, 0);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(50, 50),
  new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 5);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

const engine = new Engine({
  update: (_delta) => {
    // Game logic will go here
  },
  render: () => {
    renderer.render(scene, camera);
  },
});
engine.start();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

console.log('ANAN SKATE — engine running');
```

- [ ] **Step 6: Verify dev server still works**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Same visual output, no errors in console, "ANAN SKATE — engine running" logged.

- [ ] **Step 7: Commit**

```bash
git add src/core/Engine.ts tests/core/Engine.test.ts src/main.ts && git commit -m "feat: game engine loop with delta time, pause/resume, and death spiral protection"
```

---

## Task 3: Input Manager

**Files:**
- Create: `src/core/InputManager.ts`
- Create: `tests/core/InputManager.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/core/InputManager.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { InputManager } from '@/core/InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager();
    input.attach(document.body);
  });

  it('tracks key down state', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(true);
  });

  it('tracks key up state', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(false);
  });

  it('detects key just pressed this frame', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.justPressed('Space')).toBe(true);

    // After update (new frame), justPressed should be false
    input.update();
    expect(input.justPressed('Space')).toBe(false);
  });

  it('detects key just released this frame', () => {
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    input.update();
    document.body.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    expect(input.justReleased('Space')).toBe(true);

    input.update();
    expect(input.justReleased('Space')).toBe(false);
  });

  it('tracks mouse movement delta', () => {
    document.body.dispatchEvent(new MouseEvent('mousemove', { movementX: 10, movementY: -5 }));
    expect(input.mouseDelta.x).toBe(10);
    expect(input.mouseDelta.y).toBe(-5);

    // Delta resets after update
    input.update();
    expect(input.mouseDelta.x).toBe(0);
    expect(input.mouseDelta.y).toBe(0);
  });

  it('can detach listeners', () => {
    input.detach();
    document.body.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    expect(input.isDown('KeyW')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/core/InputManager.test.ts
```
Expected: FAIL — cannot resolve `@/core/InputManager`

- [ ] **Step 3: Write InputManager implementation**

Create `src/core/InputManager.ts`:
```ts
export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressedKeys = new Set<string>();
  private justReleasedKeys = new Set<string>();
  private _mouseDelta = { x: 0, y: 0 };
  private target: EventTarget | null = null;

  private onKeyDown = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    if (!this.keys.get(code)) {
      this.justPressedKeys.add(code);
    }
    this.keys.set(code, true);
  };

  private onKeyUp = (e: Event) => {
    const code = (e as KeyboardEvent).code;
    this.keys.set(code, false);
    this.justReleasedKeys.add(code);
  };

  private onMouseMove = (e: Event) => {
    const me = e as MouseEvent;
    this._mouseDelta.x += me.movementX;
    this._mouseDelta.y += me.movementY;
  };

  attach(target: EventTarget): void {
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('mousemove', this.onMouseMove);
  }

  detach(): void {
    if (!this.target) return;
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('mousemove', this.onMouseMove);
    this.target = null;
    this.keys.clear();
  }

  isDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  justPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  justReleased(code: string): boolean {
    return this.justReleasedKeys.has(code);
  }

  get mouseDelta(): { x: number; y: number } {
    return this._mouseDelta;
  }

  update(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
    this._mouseDelta.x = 0;
    this._mouseDelta.y = 0;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/core/InputManager.test.ts
```
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/InputManager.ts tests/core/InputManager.test.ts && git commit -m "feat: input manager with keyboard state, just-pressed detection, and mouse delta"
```

---

## Task 4: Physics World

**Files:**
- Create: `src/core/PhysicsWorld.ts`

- [ ] **Step 1: Write PhysicsWorld**

Create `src/core/PhysicsWorld.ts`:
```ts
import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  readonly world: CANNON.World;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.1;
  }

  addBody(body: CANNON.Body): void {
    this.world.addBody(body);
  }

  removeBody(body: CANNON.Body): void {
    this.world.removeBody(body);
  }

  step(delta: number): void {
    this.world.step(1 / 60, delta, 3);
  }

  createGroundPlane(): CANNON.Body {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    body.quaternion.setFromEulerAngles(-Math.PI / 2, 0, 0);
    this.world.addBody(body);
    return body;
  }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd ~/anan-skate && npx tsc --noEmit src/core/PhysicsWorld.ts
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/PhysicsWorld.ts && git commit -m "feat: physics world wrapper with cannon-es, ground plane helper"
```

---

## Task 5: Skater — Movement & Physics Body

**Files:**
- Create: `src/player/Skater.ts`
- Create: `src/player/Camera.ts`
- Create: `tests/player/Skater.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/player/Skater.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { Skater, SkaterInput } from '@/player/Skater';
import * as CANNON from 'cannon-es';

function makeWorld(): CANNON.World {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  // Ground
  const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
  ground.quaternion.setFromEulerAngles(-Math.PI / 2, 0, 0);
  world.addBody(ground);
  return world;
}

describe('Skater', () => {
  it('creates a physics body added to the world', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    // world has ground + skater = 2 bodies
    expect(world.bodies.length).toBe(2);
    expect(skater.body).toBeDefined();
  });

  it('starts at spawn position', () => {
    const world = makeWorld();
    const skater = new Skater(world, { x: 5, y: 1, z: 3 });
    expect(skater.body.position.x).toBe(5);
    expect(skater.body.position.z).toBe(3);
  });

  it('accelerates forward when W is pressed', () => {
    const world = makeWorld();
    const skater = new Skater(world);
    const initialZ = skater.body.position.z;

    const input: SkaterInput = {
      forward: true, backward: false, left: false, right: false,
      ollie: false, trick1: false, trick2: false, grind: false,
      grab: false, manual: false, cameraYaw: 0,
    };

    // Simulate several frames
    for (let i = 0; i < 60; i++) {
      skater.update(1 / 60, input);
      world.step(1 / 60);
    }

    // Should have moved forward (negative Z in Three.js convention)
    expect(skater.body.position.z).not.toBe(initialZ);
  });

  it('turns when A/D is pressed', () => {
    const world = makeWorld();
    const skater = new Skater(world);

    const input: SkaterInput = {
      forward: true, backward: false, left: true, right: false,
      ollie: false, trick1: false, trick2: false, grind: false,
      grab: false, manual: false, cameraYaw: 0,
    };

    const initialYaw = skater.yaw;
    for (let i = 0; i < 30; i++) {
      skater.update(1 / 60, input);
      world.step(1 / 60);
    }

    expect(skater.yaw).not.toBe(initialYaw);
  });

  it('speed is capped at max speed', () => {
    const world = makeWorld();
    const skater = new Skater(world);

    const input: SkaterInput = {
      forward: true, backward: false, left: false, right: false,
      ollie: false, trick1: false, trick2: false, grind: false,
      grab: false, manual: false, cameraYaw: 0,
    };

    for (let i = 0; i < 600; i++) {
      skater.update(1 / 60, input);
      world.step(1 / 60);
    }

    const vel = skater.body.velocity;
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    expect(speed).toBeLessThanOrEqual(skater.maxSpeed + 0.5); // small tolerance
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/player/Skater.test.ts
```
Expected: FAIL — cannot resolve `@/player/Skater`

- [ ] **Step 3: Write Skater implementation**

Create `src/player/Skater.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface SkaterInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  ollie: boolean;
  trick1: boolean;   // J — kickflip
  trick2: boolean;   // K — heelflip
  grind: boolean;    // F
  grab: boolean;     // L
  manual: boolean;   // Shift
  cameraYaw: number; // radians
}

export class Skater {
  readonly body: CANNON.Body;
  readonly mesh: THREE.Group;
  private _yaw = 0;
  readonly maxSpeed = 15;
  private pushForce = 30;
  private brakeForce = 20;
  private turnSpeed = 2.5;
  private ollieImpulse = 6;

  constructor(world: CANNON.World, spawn?: { x: number; y: number; z: number }) {
    // Physics body — capsule approximated as box
    this.body = new CANNON.Body({
      mass: 70,
      shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.9, 0.15)),
      position: new CANNON.Vec3(spawn?.x ?? 0, spawn?.y ?? 1, spawn?.z ?? 0),
      linearDamping: 0.2,
      angularDamping: 0.99,
      fixedRotation: true,
    });
    world.addBody(this.body);

    // Visual mesh — placeholder box (will be replaced with GLTF)
    this.mesh = new THREE.Group();
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.8, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xff6b35 })
    );
    bodyMesh.position.y = 0.9;
    this.mesh.add(bodyMesh);

    // Board
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.05, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xd2a8ff })
    );
    board.position.y = 0.025;
    this.mesh.add(board);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const wheelPositions = [
      [-0.1, 0.04, 0.3], [0.1, 0.04, 0.3],
      [-0.1, 0.04, -0.3], [0.1, 0.04, -0.3],
    ];
    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      this.mesh.add(wheel);
    }
  }

  get yaw(): number {
    return this._yaw;
  }

  get position(): THREE.Vector3 {
    const p = this.body.position;
    return new THREE.Vector3(p.x, p.y, p.z);
  }

  get isGrounded(): boolean {
    return this.body.position.y < 1.1;
  }

  get speed(): number {
    const v = this.body.velocity;
    return Math.sqrt(v.x * v.x + v.z * v.z);
  }

  update(delta: number, input: SkaterInput): void {
    // Turning
    if (input.left) this._yaw += this.turnSpeed * delta;
    if (input.right) this._yaw -= this.turnSpeed * delta;

    // Forward direction based on yaw
    const forward = new CANNON.Vec3(
      -Math.sin(this._yaw),
      0,
      -Math.cos(this._yaw)
    );

    // Push / brake
    if (input.forward && this.speed < this.maxSpeed) {
      this.body.applyForce(
        forward.scale(this.pushForce * this.body.mass)
      );
    }
    if (input.backward) {
      const vel = this.body.velocity;
      const brakeVec = new CANNON.Vec3(-vel.x, 0, -vel.z);
      if (brakeVec.length() > 0.1) {
        brakeVec.normalize();
        this.body.applyForce(brakeVec.scale(this.brakeForce * this.body.mass));
      }
    }

    // Ollie
    if (input.ollie && this.isGrounded) {
      this.body.velocity.y = this.ollieImpulse;
    }

    // Sync mesh to physics
    this.mesh.position.set(
      this.body.position.x,
      this.body.position.y - 0.9,
      this.body.position.z
    );
    this.mesh.rotation.y = this._yaw;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/player/Skater.test.ts
```
Expected: All 4 tests PASS

- [ ] **Step 5: Write Camera**

Create `src/player/Camera.ts`:
```ts
import * as THREE from 'three';

export class FollowCamera {
  readonly camera: THREE.PerspectiveCamera;
  private offset = new THREE.Vector3(0, 3, 8);
  private lookOffset = new THREE.Vector3(0, 1.5, 0);
  private smoothSpeed = 5;
  private yaw = 0;
  private pitch = 0.3;
  private distance = 8;
  private minPitch = -0.2;
  private maxPitch = 1.2;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
  }

  handleMouseInput(dx: number, dy: number, sensitivity = 0.002): void {
    this.yaw -= dx * sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * sensitivity));
  }

  getCameraYaw(): number {
    return this.yaw;
  }

  update(delta: number, target: THREE.Vector3): void {
    // Compute desired camera position from yaw/pitch/distance
    const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance;
    const offsetY = Math.sin(this.pitch) * this.distance;
    const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance;

    const desired = new THREE.Vector3(
      target.x + offsetX,
      target.y + offsetY,
      target.z + offsetZ
    );

    // Smooth follow
    this.camera.position.lerp(desired, 1 - Math.exp(-this.smoothSpeed * delta));

    // Look at target + offset
    const lookAt = target.clone().add(this.lookOffset);
    this.camera.lookAt(lookAt);
  }
}
```

- [ ] **Step 6: Integrate Skater + Camera + Physics into main.ts**

Replace `src/main.ts`:
```ts
import * as THREE from 'three';
import { Engine } from '@/core/Engine';
import { InputManager } from '@/core/InputManager';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { Skater, SkaterInput } from '@/player/Skater';
import { FollowCamera } from '@/player/Camera';

// Renderer
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);
renderer.shadowMap.enabled = true;

// Scene
const scene = new THREE.Scene();

// Lights
const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040, 0.6));

// Ground (visual)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Physics
const physics = new PhysicsWorld();
physics.createGroundPlane();

// Skater
const skater = new Skater(physics.world);
scene.add(skater.mesh);

// Camera
const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

// Input
const input = new InputManager();
input.attach(document.body);

// Pointer lock
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});

// Map input to skater commands
function getSkaterInput(): SkaterInput {
  return {
    forward: input.isDown('KeyW'),
    backward: input.isDown('KeyS'),
    left: input.isDown('KeyA'),
    right: input.isDown('KeyD'),
    ollie: input.justPressed('Space'),
    trick1: input.isDown('KeyJ'),
    trick2: input.isDown('KeyK'),
    grind: input.isDown('KeyF'),
    grab: input.isDown('KeyL'),
    manual: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
    cameraYaw: followCam.getCameraYaw(),
  };
}

// Engine
const engine = new Engine({
  update: (delta) => {
    followCam.handleMouseInput(input.mouseDelta.x, input.mouseDelta.y);
    skater.update(delta, getSkaterInput());
    physics.step(delta);
    followCam.update(delta, skater.position);
    input.update();
  },
  render: () => {
    renderer.render(scene, followCam.camera);
  },
});
engine.start();

// Resize
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
});

console.log('ANAN SKATE — click to start, WASD to move, Space to ollie');
```

- [ ] **Step 7: Run dev server and test manually**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Orange box skater on purple ground. Click to capture mouse. WASD moves the skater, mouse orbits camera, Space makes the skater jump. Third-person camera follows smoothly.

- [ ] **Step 8: Run all tests**

```bash
cd ~/anan-skate && npx vitest run
```
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: skater movement, physics body, third-person camera, and input integration"
```

---

## Task 6: Trick System & Combo Scoring

**Files:**
- Create: `src/player/TrickSystem.ts`
- Create: `tests/player/TrickSystem.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/player/TrickSystem.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TrickSystem, Trick, TrickName } from '@/player/TrickSystem';

describe('TrickSystem', () => {
  let tricks: TrickSystem;

  beforeEach(() => {
    tricks = new TrickSystem();
  });

  it('starts with no active combo', () => {
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
    expect(tricks.comboMultiplier).toBe(0);
  });

  it('landing a trick starts a combo', () => {
    tricks.landTrick('kickflip');
    expect(tricks.comboActive).toBe(true);
    expect(tricks.comboMultiplier).toBe(1);
    expect(tricks.comboScore).toBe(200); // kickflip base
  });

  it('chaining tricks increases multiplier', () => {
    tricks.landTrick('kickflip');     // 200 × 1 = 200
    tricks.landTrick('fifty_fifty');  // (200 + 500) × 2 = 1400
    expect(tricks.comboMultiplier).toBe(2);
    expect(tricks.comboScore).toBe(1400);
  });

  it('rejects duplicate tricks in same combo', () => {
    tricks.landTrick('kickflip');
    const result = tricks.landTrick('kickflip');
    expect(result).toBe(false);
    expect(tricks.comboMultiplier).toBe(1); // didn't increase
  });

  it('bail resets combo and returns 0', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('fifty_fifty');
    const score = tricks.bail();
    expect(score).toBe(0);
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
  });

  it('cash out returns final score and resets', () => {
    tricks.landTrick('kickflip');       // 200 × 1
    tricks.landTrick('fifty_fifty');    // (200+500) × 2
    const score = tricks.cashOut();
    expect(score).toBe(1400);
    expect(tricks.comboActive).toBe(false);
    expect(tricks.comboScore).toBe(0);
  });

  it('combo chain list tracks trick names', () => {
    tricks.landTrick('kickflip');
    tricks.landTrick('nosegrind');
    expect(tricks.comboChain).toEqual(['kickflip', 'nosegrind']);
  });

  it('all defined tricks have base scores', () => {
    const allTricks: TrickName[] = [
      'ollie', 'kickflip', 'heelflip', 'tre_flip',
      'fifty_fifty', 'nosegrind', 'tailslide', 'boardslide',
      'grab', 'spin_180', 'spin_360', 'spin_540', 'manual',
    ];
    for (const name of allTricks) {
      expect(tricks.getBaseScore(name)).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/player/TrickSystem.test.ts
```
Expected: FAIL — cannot resolve `@/player/TrickSystem`

- [ ] **Step 3: Write TrickSystem implementation**

Create `src/player/TrickSystem.ts`:
```ts
export type TrickName =
  | 'ollie' | 'kickflip' | 'heelflip' | 'tre_flip'
  | 'fifty_fifty' | 'nosegrind' | 'tailslide' | 'boardslide'
  | 'grab' | 'spin_180' | 'spin_360' | 'spin_540'
  | 'manual';

export interface Trick {
  name: TrickName;
  baseScore: number;
}

const TRICK_SCORES: Record<TrickName, number> = {
  ollie: 50,
  kickflip: 200,
  heelflip: 200,
  tre_flip: 400,
  fifty_fifty: 500,
  nosegrind: 600,
  tailslide: 550,
  boardslide: 500,
  grab: 300,
  spin_180: 250,
  spin_360: 400,
  spin_540: 600,
  manual: 100,
};

export class TrickSystem {
  private chain: TrickName[] = [];
  private baseTotal = 0;
  private _lastTrickName: TrickName | null = null;

  get comboActive(): boolean {
    return this.chain.length > 0;
  }

  get comboMultiplier(): number {
    return this.chain.length;
  }

  get comboScore(): number {
    return this.baseTotal * this.comboMultiplier;
  }

  get comboChain(): TrickName[] {
    return [...this.chain];
  }

  get lastTrick(): TrickName | null {
    return this._lastTrickName;
  }

  getBaseScore(name: TrickName): number {
    return TRICK_SCORES[name];
  }

  landTrick(name: TrickName): boolean {
    // No duplicates in same combo
    if (this.chain.includes(name)) return false;

    this.chain.push(name);
    this.baseTotal += TRICK_SCORES[name];
    this._lastTrickName = name;
    return true;
  }

  bail(): number {
    this.reset();
    return 0;
  }

  cashOut(): number {
    const score = this.comboScore;
    this.reset();
    return score;
  }

  private reset(): void {
    this.chain = [];
    this.baseTotal = 0;
    this._lastTrickName = null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/player/TrickSystem.test.ts
```
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/player/TrickSystem.ts tests/player/TrickSystem.test.ts && git commit -m "feat: trick system with combo chaining, multiplier, no-duplicate rule, bail/cashout"
```

---

## Task 7: World Objects — Rail, Ramp, Stairs, Ledge, Platform

**Files:**
- Create: `src/world/objects/Rail.ts`
- Create: `src/world/objects/Ramp.ts`
- Create: `src/world/objects/Stairs.ts`
- Create: `src/world/objects/Ledge.ts`
- Create: `src/world/objects/Platform.ts`

- [ ] **Step 1: Write Rail**

Create `src/world/objects/Rail.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface RailConfig {
  position: THREE.Vector3;
  length: number;
  height: number;
  rotation?: number; // Y-axis rotation in radians
}

export class Rail {
  readonly mesh: THREE.Group;
  readonly body: CANNON.Body;
  readonly grindPath: { start: THREE.Vector3; end: THREE.Vector3 };

  constructor(config: RailConfig, world: CANNON.World) {
    const { position, length, height, rotation = 0 } = config;

    // Visual
    this.mesh = new THREE.Group();
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, length, 8),
      new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 })
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.y = height;

    // Support posts
    const postGeo = new THREE.CylinderGeometry(0.03, 0.03, height, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
    const leftPost = new THREE.Mesh(postGeo, postMat);
    leftPost.position.set(-length / 2 + 0.1, height / 2, 0);
    const rightPost = new THREE.Mesh(postGeo, postMat);
    rightPost.position.set(length / 2 - 0.1, height / 2, 0);

    this.mesh.add(rail, leftPost, rightPost);
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;

    // Physics — thin box for collision
    this.body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(length / 2, 0.05, 0.05)),
      position: new CANNON.Vec3(position.x, position.y + height, position.z),
    });
    this.body.quaternion.setFromEulerAngles(0, rotation, 0);
    world.addBody(this.body);

    // Grind path (world-space endpoints)
    const halfLen = length / 2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    this.grindPath = {
      start: new THREE.Vector3(
        position.x - halfLen * cos, position.y + height, position.z - halfLen * sin
      ),
      end: new THREE.Vector3(
        position.x + halfLen * cos, position.y + height, position.z + halfLen * sin
      ),
    };
  }
}
```

- [ ] **Step 2: Write Ramp**

Create `src/world/objects/Ramp.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface RampConfig {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
  rotation?: number;
}

export class Ramp {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  readonly isLaunchRamp = true;

  constructor(config: RampConfig, world: CANNON.World) {
    const { position, width, height, depth, rotation = 0 } = config;

    // Visual — a wedge shape using ExtrudeGeometry
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(depth, 0);
    shape.lineTo(0, height);
    shape.closePath();

    const extrudeSettings = { depth: width, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geo.translate(-depth / 2, 0, -width / 2);

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: 0x3a3a5c })
    );
    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;

    // Physics — trimesh for accurate ramp collision
    const vertices = new Float32Array(geo.attributes.position.array);
    const indices = geo.index ? Array.from(geo.index.array) : [];
    const trimesh = new CANNON.Trimesh(
      Array.from(vertices),
      indices
    );

    this.body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: trimesh,
      position: new CANNON.Vec3(position.x, position.y, position.z),
    });
    this.body.quaternion.setFromEulerAngles(0, rotation, 0);
    world.addBody(this.body);
  }
}
```

- [ ] **Step 3: Write Stairs**

Create `src/world/objects/Stairs.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface StairsConfig {
  position: THREE.Vector3;
  steps: number;       // 3, 5, or 8
  stepWidth: number;
  rotation?: number;
}

export class Stairs {
  readonly mesh: THREE.Group;
  readonly bodies: CANNON.Body[];

  constructor(config: StairsConfig, world: CANNON.World) {
    const { position, steps, stepWidth, rotation = 0 } = config;
    const stepHeight = 0.18;
    const stepDepth = 0.28;

    this.mesh = new THREE.Group();
    this.bodies = [];

    const stepMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a });

    for (let i = 0; i < steps; i++) {
      // Visual
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(stepWidth, stepHeight, stepDepth),
        stepMat
      );
      stepMesh.position.set(0, stepHeight * (i + 0.5), -stepDepth * i);
      this.mesh.add(stepMesh);

      // Physics
      const body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(stepWidth / 2, stepHeight / 2, stepDepth / 2)),
        position: new CANNON.Vec3(
          position.x, position.y + stepHeight * (i + 0.5), position.z - stepDepth * i
        ),
      });
      body.quaternion.setFromEulerAngles(0, rotation, 0);
      world.addBody(body);
      this.bodies.push(body);
    }

    this.mesh.position.copy(position);
    this.mesh.rotation.y = rotation;
  }
}
```

- [ ] **Step 4: Write Ledge**

Create `src/world/objects/Ledge.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface LedgeConfig {
  position: THREE.Vector3;
  length: number;
  height: number;
  width: number;
  rotation?: number;
}

export class Ledge {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;
  readonly grindPath: { start: THREE.Vector3; end: THREE.Vector3 };

  constructor(config: LedgeConfig, world: CANNON.World) {
    const { position, length, height, width, rotation = 0 } = config;

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(length, height, width),
      new THREE.MeshStandardMaterial({ color: 0x5a5a7a })
    );
    this.mesh.position.copy(position);
    this.mesh.position.y += height / 2;
    this.mesh.rotation.y = rotation;

    this.body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(length / 2, height / 2, width / 2)),
      position: new CANNON.Vec3(position.x, position.y + height / 2, position.z),
    });
    this.body.quaternion.setFromEulerAngles(0, rotation, 0);
    world.addBody(this.body);

    // Grind along the top edge
    const halfLen = length / 2;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    this.grindPath = {
      start: new THREE.Vector3(
        position.x - halfLen * cos, position.y + height, position.z - halfLen * sin
      ),
      end: new THREE.Vector3(
        position.x + halfLen * cos, position.y + height, position.z + halfLen * sin
      ),
    };
  }
}
```

- [ ] **Step 5: Write Platform**

Create `src/world/objects/Platform.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface PlatformConfig {
  position: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
}

export class Platform {
  readonly mesh: THREE.Mesh;
  readonly body: CANNON.Body;

  constructor(config: PlatformConfig, world: CANNON.World) {
    const { position, width, height, depth } = config;

    this.mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      new THREE.MeshStandardMaterial({ color: 0x3a3a5c })
    );
    this.mesh.position.copy(position);
    this.mesh.position.y += height / 2;

    this.body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2)),
      position: new CANNON.Vec3(position.x, position.y + height / 2, position.z),
    });
    world.addBody(this.body);
  }
}
```

- [ ] **Step 6: Verify all compile**

```bash
cd ~/anan-skate && npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/world/objects/ && git commit -m "feat: world objects — Rail, Ramp, Stairs, Ledge, Platform with physics"
```

---

## Task 8: Zone Base & Zone Manager

**Files:**
- Create: `src/world/ZoneBase.ts`
- Create: `src/world/ZoneManager.ts`
- Create: `tests/world/ZoneManager.test.ts`

- [ ] **Step 1: Write ZoneBase interface**

Create `src/world/ZoneBase.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export interface ZoneConfig {
  id: string;
  name: string;
  spawnPoint: THREE.Vector3;
}

export interface Zone {
  readonly config: ZoneConfig;
  load(scene: THREE.Scene, world: CANNON.World): void;
  unload(scene: THREE.Scene, world: CANNON.World): void;
}
```

- [ ] **Step 2: Write the failing test for ZoneManager**

Create `tests/world/ZoneManager.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZoneManager } from '@/world/ZoneManager';
import { Zone, ZoneConfig } from '@/world/ZoneBase';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

function makeMockZone(id: string): Zone {
  return {
    config: { id, name: id, spawnPoint: new THREE.Vector3() },
    load: vi.fn(),
    unload: vi.fn(),
  };
}

describe('ZoneManager', () => {
  let scene: THREE.Scene;
  let world: CANNON.World;
  let manager: ZoneManager;

  beforeEach(() => {
    scene = new THREE.Scene();
    world = new CANNON.World();
    manager = new ZoneManager(scene, world);
  });

  it('registers zones', () => {
    const zone = makeMockZone('park');
    manager.register(zone);
    expect(manager.getZone('park')).toBe(zone);
  });

  it('loads a zone and calls load()', () => {
    const zone = makeMockZone('park');
    manager.register(zone);
    manager.switchTo('park');
    expect(zone.load).toHaveBeenCalledWith(scene, world);
    expect(manager.activeZoneId).toBe('park');
  });

  it('unloads previous zone when switching', () => {
    const park = makeMockZone('park');
    const street = makeMockZone('street');
    manager.register(park);
    manager.register(street);

    manager.switchTo('park');
    manager.switchTo('street');

    expect(park.unload).toHaveBeenCalledWith(scene, world);
    expect(street.load).toHaveBeenCalledWith(scene, world);
  });

  it('returns null for unknown zone', () => {
    expect(manager.getZone('unknown')).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/world/ZoneManager.test.ts
```
Expected: FAIL

- [ ] **Step 4: Write ZoneManager implementation**

Create `src/world/ZoneManager.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone } from './ZoneBase';

export class ZoneManager {
  private zones = new Map<string, Zone>();
  private _activeZoneId: string | null = null;
  private scene: THREE.Scene;
  private world: CANNON.World;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.scene = scene;
    this.world = world;
  }

  get activeZoneId(): string | null {
    return this._activeZoneId;
  }

  register(zone: Zone): void {
    this.zones.set(zone.config.id, zone);
  }

  getZone(id: string): Zone | null {
    return this.zones.get(id) ?? null;
  }

  switchTo(id: string): void {
    const zone = this.zones.get(id);
    if (!zone) throw new Error(`Zone "${id}" not registered`);

    // Unload current
    if (this._activeZoneId) {
      const current = this.zones.get(this._activeZoneId)!;
      current.unload(this.scene, this.world);
    }

    // Load new
    zone.load(this.scene, this.world);
    this._activeZoneId = id;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/world/ZoneManager.test.ts
```
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/world/ZoneBase.ts src/world/ZoneManager.ts tests/world/ZoneManager.test.ts && git commit -m "feat: zone base interface and zone manager with load/unload/switch"
```

---

## Task 9: Skate Park Zone (Zone 1)

**Files:**
- Create: `src/world/zones/SkatePark.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write SkatePark zone**

Create `src/world/zones/SkatePark.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Ramp } from '../objects/Ramp';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';

export class SkatePark implements Zone {
  readonly config: ZoneConfig = {
    id: 'skate_park',
    name: 'Skate Park',
    spawnPoint: new THREE.Vector3(0, 1, 0),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    // Quarter pipe (left side)
    const qp1 = new Ramp({
      position: new THREE.Vector3(-15, 0, 0),
      width: 10, height: 3, depth: 4,
      rotation: Math.PI / 2,
    }, world);
    scene.add(qp1.mesh);
    this.objects.push(qp1.mesh);
    this.bodies.push(qp1.body);

    // Quarter pipe (right side)
    const qp2 = new Ramp({
      position: new THREE.Vector3(15, 0, 0),
      width: 10, height: 3, depth: 4,
      rotation: -Math.PI / 2,
    }, world);
    scene.add(qp2.mesh);
    this.objects.push(qp2.mesh);
    this.bodies.push(qp2.body);

    // Center rail
    const rail1 = new Rail({
      position: new THREE.Vector3(0, 0, -5),
      length: 6, height: 0.6,
    }, world);
    scene.add(rail1.mesh);
    this.objects.push(rail1.mesh);
    this.bodies.push(rail1.body);

    // Side rail
    const rail2 = new Rail({
      position: new THREE.Vector3(8, 0, 5),
      length: 5, height: 0.5,
      rotation: Math.PI / 4,
    }, world);
    scene.add(rail2.mesh);
    this.objects.push(rail2.mesh);
    this.bodies.push(rail2.body);

    // Fun box (center platform)
    const funbox = new Platform({
      position: new THREE.Vector3(0, 0, 8),
      width: 4, height: 0.6, depth: 3,
    }, world);
    scene.add(funbox.mesh);
    this.objects.push(funbox.mesh);
    this.bodies.push(funbox.body);

    // Ledge
    const ledge = new Ledge({
      position: new THREE.Vector3(-6, 0, -10),
      length: 5, height: 0.45, width: 0.6,
    }, world);
    scene.add(ledge.mesh);
    this.objects.push(ledge.mesh);
    this.bodies.push(ledge.body);

    // Launch ramp (small)
    const launch = new Ramp({
      position: new THREE.Vector3(6, 0, -12),
      width: 3, height: 1.5, depth: 2.5,
    }, world);
    scene.add(launch.mesh);
    this.objects.push(launch.mesh);
    this.bodies.push(launch.body);

    // Pyramid (center)
    const pyramid = new Platform({
      position: new THREE.Vector3(-8, 0, 8),
      width: 3, height: 0.8, depth: 3,
    }, world);
    scene.add(pyramid.mesh);
    this.objects.push(pyramid.mesh);
    this.bodies.push(pyramid.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
```

- [ ] **Step 2: Integrate into main.ts**

Add to `src/main.ts` after physics setup:
```ts
import { ZoneManager } from '@/world/ZoneManager';
import { SkatePark } from '@/world/zones/SkatePark';

// ... after physics and skater setup ...

const zoneManager = new ZoneManager(scene, physics.world);
zoneManager.register(new SkatePark());
zoneManager.switchTo('skate_park');
```

Remove the old hardcoded ground plane from main.ts (the zone provides its own ground).

- [ ] **Step 3: Run dev server and verify**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Skate park with ramps, rails, ledge, fun box, pyramid visible. Skater can ride around and collide with objects.

- [ ] **Step 4: Commit**

```bash
git add src/world/zones/SkatePark.ts src/main.ts && git commit -m "feat: Skate Park zone with ramps, rails, ledge, funbox, pyramid"
```

---

## Task 10: Street Spot Zone (Zone 2)

**Files:**
- Create: `src/world/zones/StreetSpot.ts`

- [ ] **Step 1: Write StreetSpot zone**

Create `src/world/zones/StreetSpot.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { Rail } from '../objects/Rail';
import { Stairs } from '../objects/Stairs';
import { Ledge } from '../objects/Ledge';
import { Platform } from '../objects/Platform';

export class StreetSpot implements Zone {
  readonly config: ZoneConfig = {
    id: 'street',
    name: 'Street Spot',
    spawnPoint: new THREE.Vector3(0, 1, 10),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];

  load(scene: THREE.Scene, world: CANNON.World): void {
    // Ground — concrete colored
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x3a3a4a })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    // 3-stair
    const stairs3 = new Stairs({
      position: new THREE.Vector3(-10, 0, -5),
      steps: 3, stepWidth: 4,
    }, world);
    scene.add(stairs3.mesh);
    this.objects.push(stairs3.mesh);
    this.bodies.push(...stairs3.bodies);

    // 5-stair with handrail
    const stairs5 = new Stairs({
      position: new THREE.Vector3(0, 0, -8),
      steps: 5, stepWidth: 5,
    }, world);
    scene.add(stairs5.mesh);
    this.objects.push(stairs5.mesh);
    this.bodies.push(...stairs5.bodies);

    const handrail5 = new Rail({
      position: new THREE.Vector3(2, 0.45, -9),
      length: 3, height: 0.7,
      rotation: 0.35,
    }, world);
    scene.add(handrail5.mesh);
    this.objects.push(handrail5.mesh);
    this.bodies.push(handrail5.body);

    // 8-stair with handrail
    const stairs8 = new Stairs({
      position: new THREE.Vector3(12, 0, -5),
      steps: 8, stepWidth: 6,
    }, world);
    scene.add(stairs8.mesh);
    this.objects.push(stairs8.mesh);
    this.bodies.push(...stairs8.bodies);

    const handrail8 = new Rail({
      position: new THREE.Vector3(15, 0.72, -7),
      length: 4.5, height: 0.8,
      rotation: 0.3,
    }, world);
    scene.add(handrail8.mesh);
    this.objects.push(handrail8.mesh);
    this.bodies.push(handrail8.body);

    // Long ledge
    const ledge1 = new Ledge({
      position: new THREE.Vector3(-8, 0, 8),
      length: 8, height: 0.4, width: 0.5,
    }, world);
    scene.add(ledge1.mesh);
    this.objects.push(ledge1.mesh);
    this.bodies.push(ledge1.body);

    // Bench (short ledge)
    const bench = new Ledge({
      position: new THREE.Vector3(8, 0, 10),
      length: 2, height: 0.45, width: 0.6,
    }, world);
    scene.add(bench.mesh);
    this.objects.push(bench.mesh);
    this.bodies.push(bench.body);

    // Gap platform (loading dock)
    const dock = new Platform({
      position: new THREE.Vector3(-15, 0, -15),
      width: 6, height: 1.2, depth: 4,
    }, world);
    scene.add(dock.mesh);
    this.objects.push(dock.mesh);
    this.bodies.push(dock.body);

    // Flat rail
    const flatRail = new Rail({
      position: new THREE.Vector3(0, 0, 15),
      length: 7, height: 0.35,
    }, world);
    scene.add(flatRail.mesh);
    this.objects.push(flatRail.mesh);
    this.bodies.push(flatRail.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
  }
}
```

- [ ] **Step 2: Register in main.ts**

Add to main.ts:
```ts
import { StreetSpot } from '@/world/zones/StreetSpot';

zoneManager.register(new StreetSpot());
```

- [ ] **Step 3: Verify by temporarily switching to street zone**

Change `zoneManager.switchTo('street')` temporarily, run dev server, confirm street objects render. Then switch back to `'skate_park'`.

- [ ] **Step 4: Commit**

```bash
git add src/world/zones/StreetSpot.ts src/main.ts && git commit -m "feat: Street Spot zone with stair sets, handrails, ledges, loading dock"
```

---

## Task 11: OSM Loader & Old Amman Zone (Zone 4)

**Files:**
- Create: `src/world/osm/OsmLoader.ts`
- Create: `tests/world/osm/OsmLoader.test.ts`
- Create: `src/world/zones/OldAmman.ts`
- Create: `public/data/old-amman.geojson` (placeholder)

- [ ] **Step 1: Create placeholder GeoJSON**

Create `public/data/old-amman.geojson`:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "building": "yes", "height": 8 },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[35.9280, 31.9540], [35.9285, 31.9540], [35.9285, 31.9545], [35.9280, 31.9545], [35.9280, 31.9540]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "highway": "residential", "width": 6 },
      "geometry": {
        "type": "LineString",
        "coordinates": [[35.9275, 31.9535], [35.9290, 31.9535], [35.9295, 31.9540]]
      }
    }
  ]
}
```

Note: This placeholder will be replaced with real OSM data exported from the Lweibdeh/7 Hills area. To get the real data, export from https://overpass-turbo.eu/ with a bounding box around the area.

- [ ] **Step 2: Write the failing test for OsmLoader**

Create `tests/world/osm/OsmLoader.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { OsmLoader, OsmFeature } from '@/world/osm/OsmLoader';

const sampleGeoJson = {
  type: 'FeatureCollection' as const,
  features: [
    {
      type: 'Feature' as const,
      properties: { building: 'yes', height: 10 },
      geometry: {
        type: 'Polygon' as const,
        coordinates: [[[35.928, 31.954], [35.929, 31.954], [35.929, 31.955], [35.928, 31.955], [35.928, 31.954]]],
      },
    },
    {
      type: 'Feature' as const,
      properties: { highway: 'residential', width: 6 },
      geometry: {
        type: 'LineString' as const,
        coordinates: [[35.927, 31.953], [35.929, 31.953], [35.930, 31.954]],
      },
    },
  ],
};

describe('OsmLoader', () => {
  it('converts building polygon to 3D mesh with correct height', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);

    const buildings = meshes.filter(m => m.userData.type === 'building');
    expect(buildings.length).toBe(1);
    // Building should have height from properties
    expect(buildings[0].userData.height).toBe(10);
  });

  it('converts road linestring to flat mesh', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);

    const roads = meshes.filter(m => m.userData.type === 'road');
    expect(roads.length).toBe(1);
  });

  it('projects coordinates relative to center', () => {
    const loader = new OsmLoader({ center: [35.9285, 31.9545] });
    const meshes = loader.parse(sampleGeoJson);

    // All meshes should be near origin (within ~200m)
    for (const mesh of meshes) {
      expect(Math.abs(mesh.position.x)).toBeLessThan(200);
      expect(Math.abs(mesh.position.z)).toBeLessThan(200);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/world/osm/OsmLoader.test.ts
```
Expected: FAIL

- [ ] **Step 4: Write OsmLoader implementation**

Create `src/world/osm/OsmLoader.ts`:
```ts
import * as THREE from 'three';

export interface OsmFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: 'Polygon' | 'LineString' | 'Point';
    coordinates: number[][] | number[][][] ;
  };
}

export interface GeoJson {
  type: 'FeatureCollection';
  features: OsmFeature[];
}

interface OsmLoaderOptions {
  center: [number, number]; // [lon, lat] — the map center
  metersPerDegLat?: number;
  metersPerDegLon?: number;
}

export class OsmLoader {
  private center: [number, number];
  private mPerLat: number;
  private mPerLon: number;

  constructor(options: OsmLoaderOptions) {
    this.center = options.center;
    // Approximate meters per degree at Amman's latitude (~31.95°N)
    this.mPerLat = options.metersPerDegLat ?? 111320;
    this.mPerLon = options.metersPerDegLon ?? 111320 * Math.cos((this.center[1] * Math.PI) / 180);
  }

  private toLocal(lon: number, lat: number): [number, number] {
    const x = (lon - this.center[0]) * this.mPerLon;
    const z = -(lat - this.center[1]) * this.mPerLat; // Negative because Three.js Z is south
    return [x, z];
  }

  parse(geojson: GeoJson): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];

    for (const feature of geojson.features) {
      if (feature.properties.building) {
        const mesh = this.parseBuilding(feature);
        if (mesh) meshes.push(mesh);
      } else if (feature.properties.highway) {
        const mesh = this.parseRoad(feature);
        if (mesh) meshes.push(mesh);
      }
    }

    return meshes;
  }

  private parseBuilding(feature: OsmFeature): THREE.Mesh | null {
    if (feature.geometry.type !== 'Polygon') return null;

    const coords = (feature.geometry.coordinates as number[][][])[0];
    const height = feature.properties.height ?? 6; // Default 6m

    // Convert to local coords
    const points = coords.map(([lon, lat]) => {
      const [x, z] = this.toLocal(lon, lat);
      return new THREE.Vector2(x, z);
    });

    // Create extruded shape
    const shape = new THREE.Shape(points);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: height,
      bevelEnabled: false,
    });
    // Rotate so extrusion goes up (Y axis) instead of Z
    geo.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0x4a4a6a,
        roughness: 0.9,
      })
    );

    mesh.userData = { type: 'building', height };
    return mesh;
  }

  private parseRoad(feature: OsmFeature): THREE.Mesh | null {
    if (feature.geometry.type !== 'LineString') return null;

    const coords = feature.geometry.coordinates as number[][];
    const width = feature.properties.width ?? 4;

    // Convert to local points
    const points = coords.map(([lon, lat]) => {
      const [x, z] = this.toLocal(lon, lat);
      return new THREE.Vector3(x, 0.01, z); // Slightly above ground
    });

    if (points.length < 2) return null;

    // Create road as a series of quads along the path
    const group = new THREE.Group();
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x333344 });

    for (let i = 0; i < points.length - 1; i++) {
      const start = points[i];
      const end = points[i + 1];
      const dir = end.clone().sub(start);
      const len = dir.length();
      const mid = start.clone().add(end).multiplyScalar(0.5);

      const segment = new THREE.Mesh(
        new THREE.PlaneGeometry(width, len),
        roadMat
      );
      segment.rotation.x = -Math.PI / 2;
      segment.rotation.z = -Math.atan2(dir.z, dir.x) + Math.PI / 2;
      segment.position.copy(mid);
      group.add(segment);
    }

    // Compute average position for the group
    const center = points.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(points.length);
    group.position.copy(center);
    group.userData = { type: 'road' };

    return group as unknown as THREE.Mesh;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/world/osm/OsmLoader.test.ts
```
Expected: All 3 tests PASS

- [ ] **Step 6: Write OldAmman zone**

Create `src/world/zones/OldAmman.ts`:
```ts
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Zone, ZoneConfig } from '../ZoneBase';
import { OsmLoader, GeoJson } from '../osm/OsmLoader';
import { Rail } from '../objects/Rail';
import { Stairs } from '../objects/Stairs';
import { Ledge } from '../objects/Ledge';

export class OldAmman implements Zone {
  readonly config: ZoneConfig = {
    id: 'old_amman',
    name: 'Old Amman',
    spawnPoint: new THREE.Vector3(0, 1, 0),
  };

  private objects: THREE.Object3D[] = [];
  private bodies: CANNON.Body[] = [];
  private loaded = false;

  async loadGeoJson(): Promise<GeoJson> {
    const resp = await fetch('/data/old-amman.geojson');
    return resp.json();
  }

  load(scene: THREE.Scene, world: CANNON.World): void {
    // Ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x3d3528 }) // Amman stone color
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    this.objects.push(ground);

    // Load OSM data async
    this.loadGeoJson().then((geojson) => {
      const loader = new OsmLoader({
        center: [35.9285, 31.9545], // Lweibdeh center
      });
      const meshes = loader.parse(geojson);
      for (const mesh of meshes) {
        scene.add(mesh);
        this.objects.push(mesh);
      }

      // Add physics boxes for buildings
      for (const mesh of meshes) {
        if (mesh.userData.type === 'building') {
          const box = new THREE.Box3().setFromObject(mesh);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const body = new CANNON.Body({
            type: CANNON.Body.STATIC,
            shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
            position: new CANNON.Vec3(center.x, center.y, center.z),
          });
          world.addBody(body);
          this.bodies.push(body);
        }
      }

      this.loaded = true;
    });

    // Hand-placed skate objects (based on Anan's photos — positions adjusted after real data)
    // Stairs near 7 Hills area
    const stairs1 = new Stairs({
      position: new THREE.Vector3(10, 0, -15),
      steps: 6, stepWidth: 3,
    }, world);
    scene.add(stairs1.mesh);
    this.objects.push(stairs1.mesh);
    this.bodies.push(...stairs1.bodies);

    // Handrail along the stairs
    const rail1 = new Rail({
      position: new THREE.Vector3(11.5, 0.5, -16),
      length: 4, height: 0.7,
      rotation: 0.3,
    }, world);
    scene.add(rail1.mesh);
    this.objects.push(rail1.mesh);
    this.bodies.push(rail1.body);

    // Stone ledge (typical Amman architecture)
    const ledge1 = new Ledge({
      position: new THREE.Vector3(-8, 0, 5),
      length: 6, height: 0.5, width: 0.7,
    }, world);
    scene.add(ledge1.mesh);
    this.objects.push(ledge1.mesh);
    this.bodies.push(ledge1.body);

    // Another set of stairs
    const stairs2 = new Stairs({
      position: new THREE.Vector3(-15, 0, -8),
      steps: 4, stepWidth: 5,
      rotation: Math.PI / 2,
    }, world);
    scene.add(stairs2.mesh);
    this.objects.push(stairs2.mesh);
    this.bodies.push(...stairs2.bodies);

    // Flat rail on a plaza
    const rail2 = new Rail({
      position: new THREE.Vector3(0, 0, 12),
      length: 5, height: 0.4,
    }, world);
    scene.add(rail2.mesh);
    this.objects.push(rail2.mesh);
    this.bodies.push(rail2.body);
  }

  unload(scene: THREE.Scene, world: CANNON.World): void {
    for (const obj of this.objects) scene.remove(obj);
    for (const body of this.bodies) world.removeBody(body);
    this.objects = [];
    this.bodies = [];
    this.loaded = false;
  }
}
```

- [ ] **Step 7: Register in main.ts**

Add to main.ts:
```ts
import { OldAmman } from '@/world/zones/OldAmman';

zoneManager.register(new OldAmman());
```

- [ ] **Step 8: Run all tests**

```bash
cd ~/anan-skate && npx vitest run
```
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/world/osm/ tests/world/osm/ src/world/zones/OldAmman.ts public/data/ src/main.ts && git commit -m "feat: OSM loader and Old Amman zone with real street layout support"
```

---

## Task 12: Save Manager

**Files:**
- Create: `src/progression/SaveManager.ts`
- Create: `tests/progression/SaveManager.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/progression/SaveManager.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager, GameSave } from '@/progression/SaveManager';

describe('SaveManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns default save when nothing is stored', () => {
    const save = SaveManager.load();
    expect(save.highScore).toBe(0);
    expect(save.unlockedZones).toEqual(['skate_park']);
    expect(save.unlockedBoards).toEqual(['default']);
    expect(save.unlockedOutfits).toEqual(['default']);
    expect(save.completedChallenges).toEqual([]);
  });

  it('saves and loads data', () => {
    const save: GameSave = {
      highScore: 5000,
      unlockedZones: ['skate_park', 'street'],
      unlockedBoards: ['default', 'graffiti'],
      unlockedOutfits: ['default', 'hoodie'],
      completedChallenges: ['park_grind_rail'],
      equippedBoard: 'graffiti',
      equippedOutfit: 'hoodie',
    };
    SaveManager.save(save);

    const loaded = SaveManager.load();
    expect(loaded.highScore).toBe(5000);
    expect(loaded.unlockedZones).toContain('street');
    expect(loaded.equippedBoard).toBe('graffiti');
  });

  it('exports save as JSON string', () => {
    SaveManager.save({ ...SaveManager.load(), highScore: 999 });
    const json = SaveManager.exportSave();
    const parsed = JSON.parse(json);
    expect(parsed.highScore).toBe(999);
  });

  it('imports save from JSON string', () => {
    const json = JSON.stringify({
      highScore: 1234,
      unlockedZones: ['skate_park', 'street', 'old_amman'],
      unlockedBoards: ['default'],
      unlockedOutfits: ['default'],
      completedChallenges: ['park_ollie'],
      equippedBoard: 'default',
      equippedOutfit: 'default',
    });
    SaveManager.importSave(json);
    const loaded = SaveManager.load();
    expect(loaded.highScore).toBe(1234);
    expect(loaded.unlockedZones).toContain('old_amman');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/progression/SaveManager.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write SaveManager**

Create `src/progression/SaveManager.ts`:
```ts
const SAVE_KEY = 'anan_skate_save';

export interface GameSave {
  highScore: number;
  unlockedZones: string[];
  unlockedBoards: string[];
  unlockedOutfits: string[];
  completedChallenges: string[];
  equippedBoard: string;
  equippedOutfit: string;
}

const DEFAULT_SAVE: GameSave = {
  highScore: 0,
  unlockedZones: ['skate_park'],
  unlockedBoards: ['default'],
  unlockedOutfits: ['default'],
  completedChallenges: [],
  equippedBoard: 'default',
  equippedOutfit: 'default',
};

export class SaveManager {
  static load(): GameSave {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    try {
      return { ...DEFAULT_SAVE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SAVE };
    }
  }

  static save(data: GameSave): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }

  static exportSave(): string {
    return localStorage.getItem(SAVE_KEY) ?? JSON.stringify(DEFAULT_SAVE);
  }

  static importSave(json: string): void {
    const parsed = JSON.parse(json);
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...DEFAULT_SAVE, ...parsed }));
  }

  static reset(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ~/anan-skate && npx vitest run tests/progression/SaveManager.test.ts
```
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/progression/SaveManager.ts tests/progression/SaveManager.test.ts && git commit -m "feat: save manager with localStorage, export/import, defaults"
```

---

## Task 13: Challenge Manager & Unlock Manager

**Files:**
- Create: `src/progression/ChallengeManager.ts`
- Create: `src/progression/UnlockManager.ts`
- Create: `tests/progression/ChallengeManager.test.ts`
- Create: `tests/progression/UnlockManager.test.ts`

- [ ] **Step 1: Write ChallengeManager failing test**

Create `tests/progression/ChallengeManager.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ChallengeManager, Challenge } from '@/progression/ChallengeManager';

describe('ChallengeManager', () => {
  let mgr: ChallengeManager;

  const challenges: Challenge[] = [
    { id: 'park_grind_rail', zone: 'skate_park', name: 'Grind the full rail', type: 'grind_distance', target: 6, description: 'Grind the center rail end to end' },
    { id: 'park_ollie_3', zone: 'skate_park', name: 'Ollie 3 times', type: 'trick_count', target: 3, description: 'Land 3 ollies', trickName: 'ollie' },
    { id: 'park_combo_2k', zone: 'skate_park', name: '2K Combo', type: 'combo_score', target: 2000, description: 'Land a 2000+ point combo' },
  ];

  beforeEach(() => {
    mgr = new ChallengeManager(challenges);
  });

  it('lists challenges for a zone', () => {
    const parkChallenges = mgr.getForZone('skate_park');
    expect(parkChallenges.length).toBe(3);
  });

  it('tracks progress on trick_count challenge', () => {
    mgr.onTrickLanded('ollie');
    expect(mgr.getProgress('park_ollie_3')).toBe(1);

    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    expect(mgr.isCompleted('park_ollie_3')).toBe(true);
  });

  it('tracks progress on combo_score challenge', () => {
    mgr.onComboCashed(1500);
    expect(mgr.isCompleted('park_combo_2k')).toBe(false);

    mgr.onComboCashed(2500);
    expect(mgr.isCompleted('park_combo_2k')).toBe(true);
  });

  it('returns completed challenge IDs', () => {
    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    mgr.onTrickLanded('ollie');
    expect(mgr.completedIds).toContain('park_ollie_3');
  });

  it('can load completed state from save', () => {
    mgr.loadCompleted(['park_grind_rail']);
    expect(mgr.isCompleted('park_grind_rail')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/progression/ChallengeManager.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write ChallengeManager**

Create `src/progression/ChallengeManager.ts`:
```ts
export interface Challenge {
  id: string;
  zone: string;
  name: string;
  description: string;
  type: 'trick_count' | 'combo_score' | 'grind_distance' | 'speed' | 'zone_time';
  target: number;
  trickName?: string; // For trick_count type
}

export class ChallengeManager {
  private challenges: Challenge[];
  private progress = new Map<string, number>();
  private completed = new Set<string>();

  constructor(challenges: Challenge[]) {
    this.challenges = challenges;
    for (const c of challenges) {
      this.progress.set(c.id, 0);
    }
  }

  getForZone(zone: string): Challenge[] {
    return this.challenges.filter(c => c.zone === zone);
  }

  getProgress(id: string): number {
    return this.progress.get(id) ?? 0;
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  get completedIds(): string[] {
    return [...this.completed];
  }

  loadCompleted(ids: string[]): void {
    for (const id of ids) {
      this.completed.add(id);
      const challenge = this.challenges.find(c => c.id === id);
      if (challenge) this.progress.set(id, challenge.target);
    }
  }

  onTrickLanded(trickName: string): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'trick_count' && c.trickName === trickName) {
        const current = (this.progress.get(c.id) ?? 0) + 1;
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }

  onComboCashed(score: number): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'combo_score') {
        const current = Math.max(this.progress.get(c.id) ?? 0, score);
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }

  onGrindDistance(distance: number): void {
    for (const c of this.challenges) {
      if (this.completed.has(c.id)) continue;
      if (c.type === 'grind_distance') {
        const current = Math.max(this.progress.get(c.id) ?? 0, distance);
        this.progress.set(c.id, current);
        if (current >= c.target) this.completed.add(c.id);
      }
    }
  }
}
```

- [ ] **Step 4: Run ChallengeManager test**

```bash
cd ~/anan-skate && npx vitest run tests/progression/ChallengeManager.test.ts
```
Expected: All 5 tests PASS

- [ ] **Step 5: Write UnlockManager failing test**

Create `tests/progression/UnlockManager.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { UnlockManager } from '@/progression/UnlockManager';

describe('UnlockManager', () => {
  it('skate_park is always unlocked', () => {
    const mgr = new UnlockManager([]);
    expect(mgr.isZoneUnlocked('skate_park')).toBe(true);
  });

  it('street unlocks after 3 park challenges', () => {
    const mgr = new UnlockManager([]);
    expect(mgr.isZoneUnlocked('street')).toBe(false);

    mgr.updateCompleted(['park_1', 'park_2', 'park_3']);
    expect(mgr.isZoneUnlocked('street')).toBe(true);
  });

  it('old_amman unlocks after 5 street challenges', () => {
    const mgr = new UnlockManager(['park_1', 'park_2', 'park_3']);
    expect(mgr.isZoneUnlocked('old_amman')).toBe(false);

    mgr.updateCompleted([
      'park_1', 'park_2', 'park_3',
      'street_1', 'street_2', 'street_3', 'street_4', 'street_5',
    ]);
    expect(mgr.isZoneUnlocked('old_amman')).toBe(true);
  });

  it('returns list of unlocked zones', () => {
    const mgr = new UnlockManager(['park_1', 'park_2', 'park_3']);
    expect(mgr.unlockedZones).toContain('skate_park');
    expect(mgr.unlockedZones).toContain('street');
    expect(mgr.unlockedZones).not.toContain('old_amman');
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
cd ~/anan-skate && npx vitest run tests/progression/UnlockManager.test.ts
```
Expected: FAIL

- [ ] **Step 7: Write UnlockManager**

Create `src/progression/UnlockManager.ts`:
```ts
interface ZoneUnlockRule {
  zoneId: string;
  requiredChallengePrefix: string;
  requiredCount: number;
}

const ZONE_UNLOCK_RULES: ZoneUnlockRule[] = [
  { zoneId: 'street', requiredChallengePrefix: 'park_', requiredCount: 3 },
  { zoneId: 'old_amman', requiredChallengePrefix: 'street_', requiredCount: 5 },
];

export class UnlockManager {
  private completedChallenges: string[];

  constructor(completedChallenges: string[]) {
    this.completedChallenges = [...completedChallenges];
  }

  updateCompleted(challenges: string[]): void {
    this.completedChallenges = [...challenges];
  }

  isZoneUnlocked(zoneId: string): boolean {
    if (zoneId === 'skate_park') return true;

    const rule = ZONE_UNLOCK_RULES.find(r => r.zoneId === zoneId);
    if (!rule) return false;

    const count = this.completedChallenges.filter(
      id => id.startsWith(rule.requiredChallengePrefix)
    ).length;

    return count >= rule.requiredCount;
  }

  get unlockedZones(): string[] {
    const zones = ['skate_park'];
    for (const rule of ZONE_UNLOCK_RULES) {
      if (this.isZoneUnlocked(rule.zoneId)) {
        zones.push(rule.zoneId);
      }
    }
    return zones;
  }
}
```

- [ ] **Step 8: Run all progression tests**

```bash
cd ~/anan-skate && npx vitest run tests/progression/
```
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/progression/ tests/progression/ && git commit -m "feat: challenge manager and unlock manager with zone progression rules"
```

---

## Task 14: HUD

**Files:**
- Create: `src/ui/HUD.ts`

- [ ] **Step 1: Write HUD**

Create `src/ui/HUD.ts`:
```ts
export class HUD {
  private container: HTMLElement;
  private scoreEl: HTMLElement;
  private zoneEl: HTMLElement;
  private comboEl: HTMLElement;
  private trickFlashEl: HTMLElement;
  private speedBarEl: HTMLElement;
  private challengeEl: HTMLElement;
  private flashTimeout: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = '';

    // Score (top-left)
    this.scoreEl = this.createElement('div', {
      position: 'absolute', top: '16px', left: '16px',
      fontFamily: "'Impact', 'Arial Black', sans-serif",
    });
    this.scoreEl.innerHTML = `
      <div style="font-size:11px;color:#8b949e;letter-spacing:2px;">SCORE</div>
      <div class="score-value" style="font-size:32px;color:#fff;text-shadow:2px 2px 0 #ff6b35;line-height:1;">0</div>
    `;

    // Zone (top-right)
    this.zoneEl = this.createElement('div', {
      position: 'absolute', top: '16px', right: '16px', textAlign: 'right',
      fontFamily: "'Impact', 'Arial Black', sans-serif",
    });
    this.zoneEl.innerHTML = `
      <div style="font-size:11px;color:#8b949e;letter-spacing:2px;">ZONE</div>
      <div class="zone-name" style="font-size:14px;color:#3fb950;border:1px solid #3fb950;padding:2px 10px;border-radius:4px;font-family:monospace;display:inline-block;"></div>
    `;

    // Combo (right side)
    this.comboEl = this.createElement('div', {
      position: 'absolute', top: '50%', right: '24px', transform: 'translateY(-50%)',
      textAlign: 'right', fontFamily: "'Impact', 'Arial Black', sans-serif",
      display: 'none',
    });

    // Trick flash (center)
    this.trickFlashEl = this.createElement('div', {
      position: 'absolute', bottom: '40%', left: '50%', transform: 'translateX(-50%) rotate(-3deg)',
      fontFamily: "'Impact', 'Arial Black', sans-serif", fontSize: '36px',
      color: '#ff6b35', textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
      letterSpacing: '3px', opacity: '0', transition: 'opacity 0.3s',
      pointerEvents: 'none',
    });

    // Speed bar (bottom-left)
    this.speedBarEl = this.createElement('div', {
      position: 'absolute', bottom: '24px', left: '16px',
      fontFamily: 'monospace', fontSize: '10px', color: '#8b949e',
    });
    this.speedBarEl.innerHTML = `
      <div style="letter-spacing:1px;">SPEED</div>
      <div style="width:80px;height:6px;background:#30363d;border-radius:3px;margin-top:4px;">
        <div class="speed-fill" style="width:0%;height:6px;background:linear-gradient(to right,#3fb950,#ff6b35);border-radius:3px;transition:width 0.1s;"></div>
      </div>
    `;

    // Challenge (bottom-right)
    this.challengeEl = this.createElement('div', {
      position: 'absolute', bottom: '24px', right: '16px', textAlign: 'right',
      fontFamily: 'monospace', fontSize: '10px', color: '#8b949e',
      display: 'none',
    });

    this.container.append(
      this.scoreEl, this.zoneEl, this.comboEl,
      this.trickFlashEl, this.speedBarEl, this.challengeEl
    );
  }

  private createElement(tag: string, styles: Record<string, string>): HTMLElement {
    const el = document.createElement(tag);
    Object.assign(el.style, styles);
    return el;
  }

  updateScore(score: number): void {
    const el = this.scoreEl.querySelector('.score-value') as HTMLElement;
    el.textContent = score.toLocaleString();
  }

  updateZone(name: string): void {
    const el = this.zoneEl.querySelector('.zone-name') as HTMLElement;
    el.textContent = name.toUpperCase();
  }

  updateCombo(chain: string[], multiplier: number, score: number): void {
    if (chain.length === 0) {
      this.comboEl.style.display = 'none';
      return;
    }
    this.comboEl.style.display = 'block';
    const trickList = chain.map(t => t.replace(/_/g, ' ')).join('<br>');
    this.comboEl.innerHTML = `
      <div style="font-size:13px;color:#f778ba;letter-spacing:1px;">COMBO</div>
      <div style="font-size:22px;color:#fff;">x${multiplier}</div>
      <div style="font-size:12px;color:#d2a8ff;margin-top:4px;line-height:1.6;font-family:monospace;">${trickList}</div>
      <div style="font-size:14px;color:#3fb950;margin-top:4px;">${score.toLocaleString()}</div>
    `;
  }

  flashTrick(name: string, points: number): void {
    if (this.flashTimeout) clearTimeout(this.flashTimeout);

    const displayName = name.replace(/_/g, ' ').toUpperCase();
    this.trickFlashEl.innerHTML = `${displayName}!<br><span style="font-size:18px;color:#3fb950;">+${points}</span>`;
    this.trickFlashEl.style.opacity = '1';

    this.flashTimeout = window.setTimeout(() => {
      this.trickFlashEl.style.opacity = '0';
    }, 800);
  }

  updateSpeed(ratio: number): void {
    const fill = this.speedBarEl.querySelector('.speed-fill') as HTMLElement;
    fill.style.width = `${Math.min(100, ratio * 100)}%`;
  }

  updateChallenge(name: string, progress: number, target: number): void {
    this.challengeEl.style.display = 'block';
    this.challengeEl.innerHTML = `
      <div style="letter-spacing:1px;">CHALLENGE</div>
      <div style="font-size:12px;color:#58a6ff;margin-top:4px;">${name}</div>
      <div style="font-size:11px;color:#3fb950;margin-top:2px;">${progress} / ${target}</div>
    `;
  }

  hideChallenge(): void {
    this.challengeEl.style.display = 'none';
  }
}
```

- [ ] **Step 2: Integrate HUD into main.ts**

Add to main.ts:
```ts
import { HUD } from '@/ui/HUD';

const hudContainer = document.getElementById('hud')!;
const hud = new HUD(hudContainer);
hud.updateZone('Skate Park');
hud.updateScore(0);
```

In the engine update callback, add:
```ts
hud.updateSpeed(skater.speed / skater.maxSpeed);
```

- [ ] **Step 3: Verify HUD renders in browser**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Score top-left, zone name top-right, speed bar bottom-left all visible. Trick flash and combo hidden until triggered.

- [ ] **Step 4: Commit**

```bash
git add src/ui/HUD.ts src/main.ts && git commit -m "feat: HUD with score, zone, combo stack, trick flash, speed bar, challenge tracker"
```

---

## Task 15: Pause Menu & Main Menu

**Files:**
- Create: `src/ui/PauseMenu.ts`
- Create: `src/ui/MainMenu.ts`

- [ ] **Step 1: Write PauseMenu**

Create `src/ui/PauseMenu.ts`:
```ts
export interface PauseMenuCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onQuitToMenu: () => void;
}

export class PauseMenu {
  private overlay: HTMLElement;
  private visible = false;

  constructor(container: HTMLElement, callbacks: PauseMenuCallbacks) {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(13,13,13,0.85)', display: 'none',
      justifyContent: 'center', alignItems: 'center', flexDirection: 'column',
      fontFamily: "'Impact', 'Arial Black', sans-serif", zIndex: '100',
    });

    const title = document.createElement('div');
    title.textContent = 'PAUSED';
    Object.assign(title.style, {
      fontSize: '48px', color: '#ff6b35', letterSpacing: '6px',
      marginBottom: '40px', textShadow: '3px 3px 0 rgba(0,0,0,0.5)',
    });

    const buttons = [
      { label: 'RESUME', action: callbacks.onResume },
      { label: 'RESTART', action: callbacks.onRestart },
      { label: 'QUIT', action: callbacks.onQuitToMenu },
    ];

    this.overlay.appendChild(title);

    for (const btn of buttons) {
      const el = document.createElement('button');
      el.textContent = btn.label;
      Object.assign(el.style, {
        display: 'block', width: '200px', padding: '12px', margin: '8px auto',
        fontSize: '18px', fontFamily: "'Impact', 'Arial Black', sans-serif",
        color: '#fff', background: 'transparent', border: '2px solid #ff6b35',
        borderRadius: '4px', cursor: 'pointer', letterSpacing: '2px',
      });
      el.addEventListener('mouseenter', () => { el.style.background = '#ff6b35'; });
      el.addEventListener('mouseleave', () => { el.style.background = 'transparent'; });
      el.addEventListener('click', () => btn.action());
      this.overlay.appendChild(el);
    }

    container.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.style.display = 'flex';
    this.visible = true;
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.visible = false;
  }

  get isVisible(): boolean {
    return this.visible;
  }
}
```

- [ ] **Step 2: Write MainMenu**

Create `src/ui/MainMenu.ts`:
```ts
export interface MainMenuCallbacks {
  onPlay: () => void;
}

export class MainMenu {
  private overlay: HTMLElement;

  constructor(container: HTMLElement, callbacks: MainMenuCallbacks) {
    this.overlay = document.createElement('div');
    Object.assign(this.overlay.style, {
      position: 'absolute', top: '0', left: '0', width: '100%', height: '100%',
      background: '#0d0d0d', display: 'flex',
      justifyContent: 'center', alignItems: 'center', flexDirection: 'column',
      fontFamily: "'Impact', 'Arial Black', sans-serif", zIndex: '200',
    });

    // Title
    const title = document.createElement('div');
    title.textContent = 'ANAN SKATE';
    Object.assign(title.style, {
      fontSize: '72px', color: '#ff6b35', letterSpacing: '8px',
      textShadow: '4px 4px 0 #d2a8ff', marginBottom: '20px',
      transform: 'rotate(-2deg)',
    });

    // Subtitle
    const sub = document.createElement('div');
    sub.textContent = 'AMMAN STREETS';
    Object.assign(sub.style, {
      fontSize: '24px', color: '#8b949e', letterSpacing: '6px', marginBottom: '60px',
    });

    // Play button
    const playBtn = document.createElement('button');
    playBtn.textContent = 'PLAY';
    Object.assign(playBtn.style, {
      padding: '16px 60px', fontSize: '24px',
      fontFamily: "'Impact', 'Arial Black', sans-serif",
      color: '#0d0d0d', background: '#ff6b35', border: 'none',
      borderRadius: '4px', cursor: 'pointer', letterSpacing: '4px',
    });
    playBtn.addEventListener('click', () => {
      this.hide();
      callbacks.onPlay();
    });

    // Controls hint
    const hint = document.createElement('div');
    hint.textContent = 'WASD to move • Space to ollie • Mouse to look';
    Object.assign(hint.style, {
      fontSize: '12px', color: '#484f58', marginTop: '40px', letterSpacing: '1px',
      fontFamily: 'monospace',
    });

    this.overlay.append(title, sub, playBtn, hint);
    container.appendChild(this.overlay);
  }

  show(): void {
    this.overlay.style.display = 'flex';
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
```

- [ ] **Step 3: Integrate menus into main.ts**

Add pause toggle with Escape key and main menu at startup. Update the engine update to check for Escape:

```ts
import { PauseMenu } from '@/ui/PauseMenu';
import { MainMenu } from '@/ui/MainMenu';

// After HUD setup:
const pauseMenu = new PauseMenu(hudContainer, {
  onResume: () => { pauseMenu.hide(); engine.resume(); canvas.requestPointerLock(); },
  onRestart: () => { /* reload zone */ pauseMenu.hide(); engine.resume(); },
  onQuitToMenu: () => { pauseMenu.hide(); mainMenu.show(); engine.pause(); },
});

const mainMenu = new MainMenu(hudContainer, {
  onPlay: () => { engine.resume(); canvas.requestPointerLock(); },
});
engine.pause(); // Start paused on main menu

// In engine update, before other logic:
if (input.justPressed('Escape')) {
  if (pauseMenu.isVisible) {
    pauseMenu.hide();
    engine.resume();
    canvas.requestPointerLock();
  } else {
    pauseMenu.show();
    engine.pause();
    document.exitPointerLock();
  }
}
```

- [ ] **Step 4: Verify menus work**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Main menu shows "ANAN SKATE" with Play button. Clicking Play starts the game. Escape opens pause menu. Resume returns to game.

- [ ] **Step 5: Commit**

```bash
git add src/ui/ src/main.ts && git commit -m "feat: main menu and pause menu with graffiti style"
```

---

## Task 16: Graffiti Shaders & Visual Style

**Files:**
- Create: `src/shaders/OutlineShader.ts`
- Create: `src/shaders/GraffitiMaterial.ts`

- [ ] **Step 1: Write OutlineShader**

Create `src/shaders/OutlineShader.ts`:
```ts
import * as THREE from 'three';

// Simple outline post-processing via inverted hull method
export function createOutlineMaterial(color = 0x000000, thickness = 0.03): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      outlineColor: { value: new THREE.Color(color) },
      outlineThickness: { value: thickness },
    },
    vertexShader: `
      uniform float outlineThickness;
      void main() {
        vec3 pos = position + normal * outlineThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 outlineColor;
      void main() {
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.BackSide,
  });
}

export function addOutline(mesh: THREE.Mesh, color?: number, thickness?: number): THREE.Mesh {
  const outline = new THREE.Mesh(mesh.geometry, createOutlineMaterial(color, thickness));
  outline.scale.copy(mesh.scale);
  mesh.add(outline);
  return outline;
}
```

- [ ] **Step 2: Write GraffitiMaterial**

Create `src/shaders/GraffitiMaterial.ts`:
```ts
import * as THREE from 'three';

// Stylized material with flat shading and color banding for graffiti look
export function createGraffitiMaterial(baseColor: number): THREE.MeshToonMaterial {
  // Create a gradient map for toon shading (3-step)
  const colors = new Uint8Array([40, 120, 255]);
  const gradientMap = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
  gradientMap.minFilter = THREE.NearestFilter;
  gradientMap.magFilter = THREE.NearestFilter;
  gradientMap.needsUpdate = true;

  return new THREE.MeshToonMaterial({
    color: baseColor,
    gradientMap,
  });
}

// Neon glow material for grindable surfaces
export function createNeonMaterial(color: number, intensity = 2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.5,
    roughness: 0.3,
  });
}
```

- [ ] **Step 3: Apply graffiti materials to world objects**

Update `src/world/objects/Rail.ts` — change the rail material:
```ts
import { createNeonMaterial } from '@/shaders/GraffitiMaterial';

// Replace the rail material line with:
const railMat = createNeonMaterial(0x3fb950, 1.5); // Green neon glow
```

Apply similar changes to other objects: ramps get `createGraffitiMaterial(0x3a3a5c)`, ledges get `createGraffitiMaterial(0x5a5a7a)`.

- [ ] **Step 4: Verify visual style in browser**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Rails glow with neon color. Ramps and ledges have flat/toon shading. Distinct graffiti art style visible.

- [ ] **Step 5: Commit**

```bash
git add src/shaders/ src/world/objects/ && git commit -m "feat: graffiti shaders — outline, toon shading, neon glow on grindables"
```

---

## Task 17: Wire Everything Together & Final Integration

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Full main.ts integration**

Update `src/main.ts` to wire together all systems:
- TrickSystem connected to HUD (trick flash, combo display)
- Skater ollie/trick inputs trigger TrickSystem
- ChallengeManager receives trick events
- SaveManager loads/saves on zone switch and combo cashout
- UnlockManager gates zone access
- Zone switching via a debug key (Tab to cycle zones, for testing)

Key wiring in the engine update:
```ts
// In engine update callback:
// 1. Check for ollie → if landed, trickSystem.landTrick('ollie')
// 2. Check for flip tricks in air → trickSystem.landTrick('kickflip')
// 3. If combo active → hud.updateCombo(...)
// 4. If landing after combo → trickSystem.cashOut() → challengeManager.onComboCashed()
// 5. hud.updateScore(totalScore)
// 6. hud.updateSpeed(skater.speed / skater.maxSpeed)
```

- [ ] **Step 2: Add challenge definitions**

Create challenge definitions inline in main.ts (or a separate data file):
```ts
import { Challenge } from '@/progression/ChallengeManager';

const CHALLENGES: Challenge[] = [
  // Skate Park
  { id: 'park_ollie_5', zone: 'skate_park', name: 'Ollie Master', type: 'trick_count', target: 5, description: 'Land 5 ollies', trickName: 'ollie' },
  { id: 'park_kickflip_3', zone: 'skate_park', name: 'Flip It', type: 'trick_count', target: 3, description: 'Land 3 kickflips', trickName: 'kickflip' },
  { id: 'park_combo_2k', zone: 'skate_park', name: '2K Combo', type: 'combo_score', target: 2000, description: 'Land a 2000+ combo' },
  { id: 'park_combo_5k', zone: 'skate_park', name: '5K Combo', type: 'combo_score', target: 5000, description: 'Land a 5000+ combo' },
  { id: 'park_grind_rail', zone: 'skate_park', name: 'Rail Master', type: 'grind_distance', target: 5, description: 'Grind 5+ meters' },
  // Street
  { id: 'street_heelflip_5', zone: 'street', name: 'Heel Yeah', type: 'trick_count', target: 5, description: 'Land 5 heelflips', trickName: 'heelflip' },
  { id: 'street_combo_5k', zone: 'street', name: 'Street 5K', type: 'combo_score', target: 5000, description: 'Land a 5000+ combo' },
  { id: 'street_combo_10k', zone: 'street', name: '10K Club', type: 'combo_score', target: 10000, description: 'Land a 10000+ combo' },
  { id: 'street_treflip_3', zone: 'street', name: 'Tre Flip Pro', type: 'trick_count', target: 3, description: 'Land 3 tre flips', trickName: 'tre_flip' },
  { id: 'street_grind_8', zone: 'street', name: 'Long Grind', type: 'grind_distance', target: 8, description: 'Grind 8+ meters' },
  // Old Amman
  { id: 'amman_combo_10k', zone: 'old_amman', name: 'Amman 10K', type: 'combo_score', target: 10000, description: 'Land a 10000+ combo in Old Amman' },
  { id: 'amman_kickflip_10', zone: 'old_amman', name: 'Kickflip Legend', type: 'trick_count', target: 10, description: 'Land 10 kickflips', trickName: 'kickflip' },
  { id: 'amman_grind_10', zone: 'old_amman', name: 'Stone Rail', type: 'grind_distance', target: 10, description: 'Grind 10+ meters' },
  { id: 'amman_combo_20k', zone: 'old_amman', name: 'King of Amman', type: 'combo_score', target: 20000, description: 'Land a 20000+ combo' },
  { id: 'amman_540_3', zone: 'old_amman', name: 'Big Spin', type: 'trick_count', target: 3, description: 'Land 3 540 spins', trickName: 'spin_540' },
];
```

- [ ] **Step 3: Load save on startup, save on combo cashout**

```ts
import { SaveManager } from '@/progression/SaveManager';
import { ChallengeManager } from '@/progression/ChallengeManager';
import { UnlockManager } from '@/progression/UnlockManager';

const save = SaveManager.load();
const challengeManager = new ChallengeManager(CHALLENGES);
challengeManager.loadCompleted(save.completedChallenges);
const unlockManager = new UnlockManager(save.completedChallenges);

// After combo cashout:
// save.highScore = Math.max(save.highScore, totalScore);
// save.completedChallenges = challengeManager.completedIds;
// save.unlockedZones = unlockManager.unlockedZones;
// SaveManager.save(save);
```

- [ ] **Step 4: Run all tests**

```bash
cd ~/anan-skate && npx vitest run
```
Expected: All tests pass

- [ ] **Step 5: Manual playtest**

```bash
cd ~/anan-skate && npm run dev
```
Expected: Full game loop works — main menu → play → skate → tricks update HUD → combo system works → pause works → score persists to localStorage.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: full game integration — trick system, challenges, progression, HUD, menus"
```

---

## Task 18: Deploy to Vercel

**Files:**
- No new files

- [ ] **Step 1: Build**

```bash
cd ~/anan-skate && npm run build
```
Expected: `dist/` folder created with optimized assets

- [ ] **Step 2: Deploy**

```bash
cd ~/anan-skate && npx vercel --prod
```
Expected: Deployed to Vercel. Returns a URL.

- [ ] **Step 3: Test deployed version**

Open the Vercel URL in browser. Verify:
- Main menu loads
- Play button starts game
- WASD movement works
- Space ollie works
- HUD displays correctly
- Pause menu works

- [ ] **Step 4: Commit deploy config if any**

```bash
git add -A && git commit -m "chore: vercel deployment config"
```

---

## Summary

| Task | Component | Tests |
|------|-----------|-------|
| 1 | Project scaffold | Setup only |
| 2 | Engine loop | 5 tests |
| 3 | Input manager | 6 tests |
| 4 | Physics world | Compile check |
| 5 | Skater + Camera | 4 tests |
| 6 | Trick system | 8 tests |
| 7 | World objects | Compile check |
| 8 | Zone manager | 4 tests |
| 9 | Skate Park zone | Manual |
| 10 | Street Spot zone | Manual |
| 11 | OSM loader + Old Amman | 3 tests |
| 12 | Save manager | 4 tests |
| 13 | Challenge + Unlock | 9 tests |
| 14 | HUD | Manual |
| 15 | Menus | Manual |
| 16 | Shaders | Manual |
| 17 | Integration | All tests + manual |
| 18 | Deploy | Manual verification |

**Total: 18 tasks, ~43 automated tests**

**Asset dependencies:** Before Task 11 can show real Amman data, Anan needs to provide:
1. Photos of 7 Hills / Lweibdeh skate spots
2. We export real OSM data from overpass-turbo.eu to replace the placeholder GeoJSON

The game is fully playable without the real OSM data — the placeholder objects work as a starting point.
