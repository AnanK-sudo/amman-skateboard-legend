import * as THREE from 'three';
import { Engine } from '@/core/Engine';
import { InputManager } from '@/core/InputManager';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { Skater, SkaterInput } from '@/player/Skater';
import { FollowCamera } from '@/player/Camera';
import { TrickSystem } from '@/player/TrickSystem';
import { ZoneManager } from '@/world/ZoneManager';
import { SkatePark } from '@/world/zones/SkatePark';
import { StreetSpot } from '@/world/zones/StreetSpot';
import { OldAmman } from '@/world/zones/OldAmman';
import { HUD } from '@/ui/HUD';
import { PauseMenu } from '@/ui/PauseMenu';
import { MainMenu } from '@/ui/MainMenu';
import { SaveManager } from '@/progression/SaveManager';
import { ChallengeManager, Challenge } from '@/progression/ChallengeManager';
import { UnlockManager } from '@/progression/UnlockManager';
import { GrindDetector } from '@/player/GrindDetector';
import { AudioManager } from '@/core/AudioManager';
import { SparkSystem } from '@/effects/SparkSystem';
import { CameraShake } from '@/effects/CameraShake';
import { SpeedLines } from '@/effects/SpeedLines';
import { SlowMo } from '@/effects/SlowMo';
import { ComboTimer } from '@/ui/ComboTimer';
import { Customization } from '@/player/Customization';
import { CustomizeMenu } from '@/ui/CustomizeMenu';
import { StatsTracker } from '@/progression/StatsTracker';

// --- Renderer ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Scene & Lighting ---
const scene = new THREE.Scene();

// --- Sky gradient background ---
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.012); // distance fog

// --- Lighting ---
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 100;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x606080, 0.8));
scene.add(new THREE.HemisphereLight(0x8888ff, 0x444422, 0.5));

// --- Stars / atmosphere ---
const starGeo = new THREE.BufferGeometry();
const starPositions: number[] = [];
for (let i = 0; i < 300; i++) {
  const r = 80 + Math.random() * 120;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.random() * Math.PI * 0.5; // upper hemisphere
  starPositions.push(
    r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi) + 10,
    r * Math.sin(phi) * Math.sin(theta)
  );
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, transparent: true, opacity: 0.6 });
scene.add(new THREE.Points(starGeo, starMat));

// --- Physics ---
const physics = new PhysicsWorld();
// Ground plane provided by each zone (with proper physics bodies for raycasting)

// --- Zone System ---
const zoneManager = new ZoneManager(scene, physics.world);
zoneManager.register(new SkatePark());
zoneManager.register(new StreetSpot());
zoneManager.register(new OldAmman());
zoneManager.switchTo('skate_park');

const zoneIds = ['skate_park', 'street', 'old_amman'] as const;
let currentZoneIndex = 0;

// --- Skater --- (must be after zone load so grindables can be registered after)
const skater = new Skater(physics.world);
scene.add(skater.mesh);

// --- Grind Detector ---
const grindDetector = new GrindDetector();

// --- Audio ---
const audio = new AudioManager();
let rollSound: ReturnType<typeof audio.playRollLoop> = null;
let grindSound: ReturnType<typeof audio.playGrindLoop> = null;

// --- Effects ---
const sparks = new SparkSystem(scene);
const cameraShake = new CameraShake();
const slowMo = new SlowMo();
const comboTimer = new ComboTimer();

// Speed lines overlay (attached to camera)
const speedLines = new SpeedLines(followCam.camera);
followCam.camera.add(speedLines.getMesh());
speedLines.getMesh().position.z = -1;
scene.add(followCam.camera); // camera must be in scene for child rendering

// --- Customization ---
const customization = new Customization();

// --- Stats ---
const stats = new StatsTracker();

// Scan scene for objects with grindPath and register them
function registerGrindables() {
  scene.traverse((obj: any) => {
    if (obj.userData?.grindPath) {
      grindDetector.register({ grindPath: obj.userData.grindPath });
    }
  });
}
registerGrindables(); // register initial zone grindables


// --- Blob shadow under skater ---
const shadowTex = new THREE.TextureLoader().load(
  'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><radialGradient id="g" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="black" stop-opacity="0.5"/><stop offset="100%" stop-color="black" stop-opacity="0"/></radialGradient><circle cx="32" cy="32" r="32" fill="url(#g)"/></svg>'
  )
);
const blobShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1.5, 1.5),
  new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
);
blobShadow.rotation.x = -Math.PI / 2;
scene.add(blobShadow);

// --- Dust particle system ---
const dustCount = 50;
const dustGeo = new THREE.BufferGeometry();
const dustPositions = new Float32Array(dustCount * 3);
const dustVelocities = new Float32Array(dustCount * 3);
const dustLifetimes = new Float32Array(dustCount);
dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
const dustMat = new THREE.PointsMaterial({
  color: 0x888888, size: 0.15, transparent: true, opacity: 0.4, depthWrite: false,
});
const dustParticles = new THREE.Points(dustGeo, dustMat);
scene.add(dustParticles);
let dustIndex = 0;

function emitDust(x: number, y: number, z: number) {
  for (let i = 0; i < 5; i++) {
    const idx = (dustIndex % dustCount) * 3;
    dustPositions[idx] = x + (Math.random() - 0.5) * 0.5;
    dustPositions[idx + 1] = y;
    dustPositions[idx + 2] = z + (Math.random() - 0.5) * 0.5;
    dustVelocities[idx] = (Math.random() - 0.5) * 2;
    dustVelocities[idx + 1] = Math.random() * 1.5 + 0.5;
    dustVelocities[idx + 2] = (Math.random() - 0.5) * 2;
    dustLifetimes[dustIndex % dustCount] = 1.0;
    dustIndex++;
  }
}

// --- Camera ---
const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

// --- Input ---
const input = new InputManager();
input.attach(document);

canvas.addEventListener('click', () => { canvas.requestPointerLock(); });

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

// --- Trick System ---
const trickSystem = new TrickSystem();

// --- Progression: Save, Challenges, Unlocks ---
const CHALLENGES: Challenge[] = [
  { id: 'park_ollie_5',      zone: 'skate_park', name: 'Ollie Master',      type: 'trick_count',    target: 5,     description: 'Land 5 ollies',          trickName: 'ollie' },
  { id: 'park_kickflip_3',   zone: 'skate_park', name: 'Flip It',           type: 'trick_count',    target: 3,     description: 'Land 3 kickflips',        trickName: 'kickflip' },
  { id: 'park_combo_2k',     zone: 'skate_park', name: '2K Combo',          type: 'combo_score',    target: 2000,  description: 'Land a 2000+ combo' },
  { id: 'park_combo_5k',     zone: 'skate_park', name: '5K Combo',          type: 'combo_score',    target: 5000,  description: 'Land a 5000+ combo' },
  { id: 'park_grind_rail',   zone: 'skate_park', name: 'Rail Master',       type: 'grind_distance', target: 5,     description: 'Grind 5+ meters' },
  { id: 'street_heelflip_5', zone: 'street',     name: 'Heel Yeah',         type: 'trick_count',    target: 5,     description: 'Land 5 heelflips',        trickName: 'heelflip' },
  { id: 'street_combo_5k',   zone: 'street',     name: 'Street 5K',         type: 'combo_score',    target: 5000,  description: 'Land a 5000+ combo' },
  { id: 'street_combo_10k',  zone: 'street',     name: '10K Club',          type: 'combo_score',    target: 10000, description: 'Land a 10000+ combo' },
  { id: 'street_treflip_3',  zone: 'street',     name: 'Tre Flip Pro',      type: 'trick_count',    target: 3,     description: 'Land 3 tre flips',        trickName: 'tre_flip' },
  { id: 'street_grind_8',    zone: 'street',     name: 'Long Grind',        type: 'grind_distance', target: 8,     description: 'Grind 8+ meters' },
  { id: 'amman_combo_10k',   zone: 'old_amman',  name: 'Amman 10K',         type: 'combo_score',    target: 10000, description: 'Land a 10000+ combo' },
  { id: 'amman_kickflip_10', zone: 'old_amman',  name: 'Kickflip Legend',   type: 'trick_count',    target: 10,    description: 'Land 10 kickflips',       trickName: 'kickflip' },
  { id: 'amman_grind_10',    zone: 'old_amman',  name: 'Stone Rail',        type: 'grind_distance', target: 10,    description: 'Grind 10+ meters' },
  { id: 'amman_combo_20k',   zone: 'old_amman',  name: 'King of Amman',     type: 'combo_score',    target: 20000, description: 'Land a 20000+ combo' },
  { id: 'amman_540_3',       zone: 'old_amman',  name: 'Big Spin',          type: 'trick_count',    target: 3,     description: 'Land 3 540 spins',        trickName: 'spin_540' },
];

const save = SaveManager.load();
let totalScore = save.highScore;
const challengeManager = new ChallengeManager(CHALLENGES);
challengeManager.loadCompleted(save.completedChallenges);
const unlockManager = new UnlockManager(save.completedChallenges);

// --- HUD ---
const hud = new HUD();
hud.updateZone('Skate Park');
hud.updateScore(totalScore);

// --- Trick input window state ---
let ollieTime = 0;
let didOllie = false;
let spinRegistered = false;
let wasAirborne = false;

// --- Engine (declared early so menus can reference it) ---
let engine: Engine;

// --- Menus ---
const pauseMenu = new PauseMenu({
  onResume: () => {
    pauseMenu.hide();
    engine.resume();
    canvas.requestPointerLock();
  },
  onRestart: () => {
    pauseMenu.hide();
    engine.resume();
    canvas.requestPointerLock();
  },
  onQuitToMenu: () => {
    pauseMenu.hide();
    mainMenu.show();
    engine.pause();
  },
});

const mainMenu = new MainMenu({
  onPlay: () => {
    engine.resume();
    canvas.requestPointerLock();
  },
});

// Customize menu
const customizeMenu = new CustomizeMenu(customization, () => {
  // Apply style to skater when preset changes
  customization.applyToSkater(
    skater.mesh.children[0] as THREE.Group, // innerGroup
    (skater.mesh.children[0] as THREE.Group).children.find(
      c => c instanceof THREE.Group && c !== skater.mesh.children[0]
    ) as THREE.Group || skater.mesh.children[0].children[9] as THREE.Group // boardGroup
  );
});

engine = new Engine({
  update: (rawDelta) => {
    // Apply slow-mo time scale
    slowMo.update(rawDelta);
    const delta = rawDelta * slowMo.timeScale;
    // --- Pause toggle ---
    if (input.justPressed('Escape')) {
      if (pauseMenu.isVisible) {
        pauseMenu.hide();
        engine.resume();
        canvas.requestPointerLock();
      } else if (customizeMenu.isVisible) {
        customizeMenu.hide();
        engine.resume();
      } else {
        pauseMenu.updateStats(stats.getSession());
        pauseMenu.show();
        engine.pause();
        document.exitPointerLock();
      }
      input.update(); // consume input
      return;
    }

    // --- Zone switching (Tab, debug) ---
    if (input.justPressed('Tab')) {
      currentZoneIndex = (currentZoneIndex + 1) % zoneIds.length;
      const nextZoneId = zoneIds[currentZoneIndex];
      if (unlockManager.isZoneUnlocked(nextZoneId)) {
        zoneManager.switchTo(nextZoneId);
        grindDetector.clear(); // clear old zone grindables
        registerGrindables(); // register new zone grindables
        const zone = zoneManager.getZone(nextZoneId)!;
        hud.updateZone(zone.config.name);
        const spawn = zone.config.spawnPoint;
        skater.body.position.set(spawn.x, spawn.y, spawn.z);
        skater.body.velocity.setZero();
      }
    }

    // --- Camera & physics ---
    followCam.handleMouseInput(input.mouseDelta.x, input.mouseDelta.y);
    skater.update(delta, getSkaterInput());
    physics.step(delta);
    followCam.update(delta, skater.position, skater.speed, skater.maxSpeed, skater.yaw);

    // --- Trick detection ---
    // Each trick key is standalone — auto-ollies for you
    // J = kickflip, K = heelflip, Space = plain ollie
    // J+K = tre flip, Shift = manual, L = grab (air), A/D in air = spin

    if (skater.isGrounded && !skater.isBailing) {
      if (input.justPressed('KeyJ') && input.isDown('KeyK')) {
        skater.body.velocity.y = 6;
        trickSystem.landTrick('tre_flip');
        skater.playTrick('tre_flip');
        audio.playOlliePop(); audio.playFlipSwoosh();
      } else if (input.justPressed('KeyJ')) {
        skater.body.velocity.y = 6;
        trickSystem.landTrick('kickflip');
        skater.playTrick('kickflip');
        audio.playOlliePop(); audio.playFlipSwoosh();
      } else if (input.justPressed('KeyK')) {
        skater.body.velocity.y = 6;
        trickSystem.landTrick('heelflip');
        skater.playTrick('heelflip');
        audio.playOlliePop(); audio.playFlipSwoosh();
      } else if (input.justPressed('Space')) {
        trickSystem.landTrick('ollie');
        skater.playTrick('ollie');
        audio.playOlliePop();
      }

      // Shift = manual (ground only)
      if (input.justPressed('ShiftLeft') || input.justPressed('ShiftRight')) {
        trickSystem.landTrick('manual');
        skater.playTrick('manual');
      }
    }

    // --- Air tricks ---
    if (!skater.isGrounded) {
      // L = grab
      if (input.justPressed('KeyL')) {
        trickSystem.landTrick('grab');
        skater.playTrick('grab');
      }

      // J in air = kickflip
      if (input.justPressed('KeyJ')) {
        trickSystem.landTrick('kickflip');
        skater.playTrick('kickflip');
      }

      // K in air = heelflip
      if (input.justPressed('KeyK')) {
        trickSystem.landTrick('heelflip');
        skater.playTrick('heelflip');
      }
    }

    // Spin in air (A/D while airborne)
    if (!skater.isGrounded && !spinRegistered) {
      if (input.justPressed('KeyA')) {
        trickSystem.landTrick('spin_180');
        skater.playTrick('spin');
        spinRegistered = true;
      } else if (input.justPressed('KeyD')) {
        trickSystem.landTrick('spin_360');
        skater.playTrick('spin');
        spinRegistered = true;
      }
    }
    if (skater.isGrounded) spinRegistered = false;

    // --- Grind detection ---
    const grindResult = grindDetector.update(
      skater.position,
      input.isDown('KeyF'),
      delta
    );
    if (grindResult) {
      skater.body.position.set(grindResult.position.x, grindResult.position.y, grindResult.position.z);
      if (grindDetector.isGrinding) {
        // Sparks while grinding
        sparks.emit(grindResult.position.x, grindResult.position.y, grindResult.position.z, 3);
        // Start grind sound
        if (!grindSound) grindSound = audio.playGrindLoop();
        if (grindDetector.grindProgress < 0.05) {
          trickSystem.landTrick('fifty_fifty');
          skater.playTrick('manual');
        }
      }
    } else {
      // Stop grind sound when not grinding
      if (grindSound) { grindSound.stop(); grindSound = null; }
    }

    // Notify systems of tricks landed
    if (trickSystem.lastTrick) {
      challengeManager.onTrickLanded(trickSystem.lastTrick);
      stats.onTrickLanded(trickSystem.lastTrick);
      // Start or extend combo timer
      if (!comboTimer.active) comboTimer.start();
      else comboTimer.extend(1.5);
    }

    // --- Combo timer ---
    comboTimer.update(delta);
    if (comboTimer.expired && trickSystem.comboActive) {
      // Timer ran out — lose combo
      trickSystem.bail();
      hud.updateCombo([], 0, 0);
      hud.flashTrick('TIMEOUT', 0);
      comboTimer.stop();
    }

    // --- HUD combo display ---
    if (trickSystem.comboActive) {
      hud.updateCombo(trickSystem.comboChain, trickSystem.comboMultiplier, trickSystem.comboScore);
    }

    // --- Trick flash ---
    if (trickSystem.lastTrick) {
      const name = trickSystem.lastTrick;
      const score = trickSystem.getBaseScore(name);
      hud.flashTrick(name, score);
    }

    // --- Combo cash out (Enter) ---
    if (input.justPressed('Enter') && trickSystem.comboActive) {
      const comboScore = trickSystem.cashOut();
      totalScore += comboScore;
      hud.updateScore(totalScore);
      hud.updateCombo([], 0, 0);
      challengeManager.onComboCashed(comboScore);

      // Persist to save
      save.highScore = Math.max(save.highScore, totalScore);
      save.completedChallenges = challengeManager.completedIds;
      save.unlockedZones = unlockManager.unlockedZones;
      unlockManager.updateCompleted(challengeManager.completedIds);
      SaveManager.save(save);
    }

    // --- Landing detection ---
    if (wasAirborne && skater.isGrounded) {
      audio.playLand(0.5);
      cameraShake.trigger(0.15);
      emitDust(skater.position.x, 0.05, skater.position.z);
      emitDust(skater.position.x, 0.05, skater.position.z);

      // Bail check: high speed landing from height = bail (20% chance at high speed)
      if (skater.speed > 10 && Math.random() < 0.15) {
        skater.triggerBail();
        trickSystem.bail();
        hud.updateCombo([], 0, 0);
        hud.flashTrick('BAIL', 0);
        audio.playBail();
        cameraShake.trigger(0.4);
        stats.onBail();
      } else if (trickSystem.comboActive) {
        const comboScore = trickSystem.cashOut();
        if (comboScore > 0) {
          totalScore += comboScore;
          hud.updateScore(totalScore);
          hud.updateCombo([], 0, 0);
          comboTimer.stop();
          challengeManager.onComboCashed(comboScore);
          stats.onComboCashed(comboScore, trickSystem.comboChain.length);
          audio.playScoreDing();
          cameraShake.trigger(0.08);
          // Slow-mo on big combos
          if (comboScore >= 3000) slowMo.trigger(0.6);
          // Check for new personal best
          const zoneId = zoneIds[currentZoneIndex];
          if (stats.checkZoneBest(zoneId, totalScore, comboScore, 0)) {
            hud.flashNewBest();
          }
          save.highScore = Math.max(save.highScore, totalScore);
          save.completedChallenges = challengeManager.completedIds;
          save.unlockedZones = unlockManager.unlockedZones;
          unlockManager.updateCompleted(challengeManager.completedIds);
          SaveManager.save(save);
        }
      }
    }
    wasAirborne = !skater.isGrounded;

    // --- Speed HUD ---
    hud.updateSpeed(skater.speed / skater.maxSpeed);

    // --- Update effects ---
    sparks.update(delta);
    const shakeOffset = cameraShake.update(delta);
    followCam.camera.position.add(shakeOffset);
    speedLines.update(delta, skater.speed / skater.maxSpeed);

    // --- Rolling sound ---
    if (skater.isGrounded && skater.speed > 0.5) {
      if (!rollSound) rollSound = audio.playRollLoop();
      rollSound?.update(skater.speed);
    } else {
      if (rollSound) { rollSound.stop(); rollSound = null; }
    }

    // --- Blob shadow follows skater ---
    blobShadow.position.set(skater.position.x, 0.02, skater.position.z);
    // Scale shadow based on height (smaller when higher = further from ground)
    const shadowScale = Math.max(0.3, 1 - (skater.position.y - 0.9) * 0.15);
    blobShadow.scale.set(shadowScale, shadowScale, shadowScale);

    // --- Dust particles update ---
    if (skater.speed > 2 && skater.isGrounded && Math.random() < 0.3) {
      emitDust(skater.position.x, 0.05, skater.position.z);
    }
    for (let i = 0; i < dustCount; i++) {
      if (dustLifetimes[i] > 0) {
        const idx = i * 3;
        dustPositions[idx] += dustVelocities[idx] * delta;
        dustPositions[idx + 1] += dustVelocities[idx + 1] * delta;
        dustPositions[idx + 2] += dustVelocities[idx + 2] * delta;
        dustVelocities[idx + 1] -= 2 * delta; // gravity on particles
        dustLifetimes[i] -= delta * 2;
        if (dustLifetimes[i] <= 0) {
          dustPositions[idx + 1] = -100; // hide expired
        }
      }
    }
    dustGeo.attributes.position.needsUpdate = true;

    // --- World boundary (keep skater in play area) ---
    const boundary = 38;
    const pos = skater.body.position;
    if (pos.x > boundary) pos.x = boundary;
    if (pos.x < -boundary) pos.x = -boundary;
    if (pos.z > boundary) pos.z = boundary;
    if (pos.z < -boundary) pos.z = -boundary;

    input.update();
  },
  render: () => { renderer.render(scene, followCam.camera); },
});

// Start the engine loop, but paused on main menu
engine.start();
engine.pause();
mainMenu.show();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
});

// Debug: show position and speed on screen
const debugEl = document.createElement('div');
Object.assign(debugEl.style, {
  position: 'absolute', bottom: '50px', left: '16px',
  color: '#3fb950', fontFamily: 'monospace', fontSize: '11px',
  pointerEvents: 'none', zIndex: '999',
});
document.getElementById('hud')!.appendChild(debugEl);

// Update debug info every frame via a second rAF (runs even when engine is paused)
function debugLoop() {
  const p = skater.body.position;
  const v = skater.body.velocity;
  debugEl.textContent = `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} | vel: ${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)} | spd: ${skater.speed.toFixed(1)} | grnd: ${skater.isGrounded}`;
  requestAnimationFrame(debugLoop);
}
debugLoop();

console.log('ANAN SKATE — click to start, WASD to move, Space to ollie, Enter to cash out combo, Tab to switch zones, Escape to pause');
