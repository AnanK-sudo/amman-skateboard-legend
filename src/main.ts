import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass,
  BloomEffect, DepthOfFieldEffect, VignetteEffect, ChromaticAberrationEffect,
  SMAAEffect, ToneMappingEffect, ToneMappingMode,
} from 'postprocessing';
import { HalfFloatType } from 'three';
import { Engine } from '@/core/Engine';
import { InputManager } from '@/core/InputManager';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { Skater, SkaterInput } from '@/player/Skater';
import { RiderMode } from '@/player/RiderMode';
import { Board } from '@/player/board/Board';
import { Walker } from '@/player/Walker';
import { readTricks } from '@/player/tricks/TrickInput';
import { judgeLanding, judgeWallHit, type BailReason } from '@/player/LandingJudge';
import { newlyUnlocked } from '@/progression/DeckUnlocks';
import { DECKS, deckById } from '@/world/decks';
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
// SpeedLines uses CSS overlay instead of shader
import { SlowMo } from '@/effects/SlowMo';
import { ComboTimer } from '@/ui/ComboTimer';
import { Customization } from '@/player/Customization';
import { CustomizeMenu } from '@/ui/CustomizeMenu';
import { StatsTracker } from '@/progression/StatsTracker';
import { BoardTrail } from '@/effects/BoardTrail';
import { SkaterModel } from '@/player/SkaterModel';
import { TrickListOverlay } from '@/ui/TrickListOverlay';
import { Minimap } from '@/ui/Minimap';
import { ZoneTransition } from '@/effects/ZoneTransition';

// --- Renderer ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// --- Scene ---
const scene = new THREE.Scene();

// Fog color matches sky horizon -- warm golden Amman dust haze
scene.fog = new THREE.FogExp2(0xd4a060, 0.003);

// Vertex-colored sky dome -- gradient from deep Jordan blue (zenith) to warm amber (horizon)
// MeshBasicMaterial, BackSide, no fog so the horizon line stays clean
{
  const skyGeo = new THREE.SphereGeometry(450, 32, 16);
  const skyPos = skyGeo.attributes.position;
  const skyColors: number[] = [];
  const zenith  = new THREE.Color(0x1a5fa8); // deep clear Jordanian blue
  const horizon = new THREE.Color(0xe8a850); // warm golden Amman amber
  const ground  = new THREE.Color(0x8a7060); // warm earth below horizon
  for (let i = 0; i < skyPos.count; i++) {
    const t = skyPos.getY(i) / 450; // -1 (nadir) to +1 (zenith)
    const col = t >= 0
      ? zenith.clone().lerp(horizon, 1 - t)
      : horizon.clone().lerp(ground, -t);
    skyColors.push(col.r, col.g, col.b);
  }
  skyGeo.setAttribute('color', new THREE.Float32BufferAttribute(skyColors, 3));
  scene.add(new THREE.Mesh(
    skyGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  ));
}

// --- Lighting ---
// Toon shading reads only from scene lights -- no env map contribution.
// Hemisphere + ambient are bumped to compensate for removed HDRI.
const dirLight = new THREE.DirectionalLight(0xfff5d0, 1.8);
dirLight.position.set(60, 80, 30);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 300;
dirLight.shadow.camera.left  = -60;
dirLight.shadow.camera.right  = 60;
dirLight.shadow.camera.top    = 60;
dirLight.shadow.camera.bottom = -60;
dirLight.shadow.bias = -0.0003;
scene.add(dirLight);

// Fill: cool sky bounce from opposite side
const fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.3);
fillLight.position.set(-30, 20, -20);
scene.add(fillLight);

// Sky/ground hemisphere: sky color = zenith blue, ground = warm sandy earth
scene.add(new THREE.HemisphereLight(0x5a9bcc, 0xc4a870, 0.55));
scene.add(new THREE.AmbientLight(0xfff0d0, 0.3));

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
const skater = new Skater(physics.world, zoneManager.getZone(zoneIds[0])!.config.spawnPoint);
const board = new Board();
const walker = new Walker();
const riderMode = new RiderMode(skater, board, walker);

// --- Animated skater model (FBX, loads async) ---
const skaterModel = new SkaterModel(scene);

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

// Speed lines (CSS-based overlay for simplicity)
const speedLinesEl = document.createElement('div');
speedLinesEl.style.cssText = `
  position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;
  background:radial-gradient(ellipse at center, transparent 40%, rgba(255,255,255,0.03) 100%);
  opacity:0;transition:opacity 0.3s;z-index:1;
`;
document.getElementById('hud')!.appendChild(speedLinesEl);

// --- New effects ---
const boardTrail = new BoardTrail(scene);
const trickList = new TrickListOverlay();
const minimap = new Minimap();
const zoneTransition = new ZoneTransition();

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

// --- Post-processing (pmndrs/postprocessing) ---
// HalfFloatType buffers required for HDR bloom to work correctly.
// renderer.toneMapping = NoToneMapping -- ToneMappingEffect handles it here.
const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 });
composer.addPass(new RenderPass(scene, followCam.camera));

const bloomEffect = new BloomEffect({
  luminanceThreshold: 0.82,   // only truly bright emissive (rails, sparks) bloom
  luminanceSmoothing: 0.05,
  intensity: 1.4,
  mipmapBlur: true,
  radius: 0.8,
  levels: 8,
});

const dofEffect = new DepthOfFieldEffect(followCam.camera, {
  worldFocusDistance: 8,
  worldFocusRange: 12,
  bokehScale: 2.0,
  focalLength: 0.025,
  height: 480,
});

const chromaticAberrationEffect = new ChromaticAberrationEffect();

const vignetteEffect = new VignetteEffect({ darkness: 0.55, offset: 0.3 });

const smaaEffect = new SMAAEffect();

const toneMappingEffect = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });

composer.addPass(new EffectPass(followCam.camera,
  bloomEffect, dofEffect, toneMappingEffect, chromaticAberrationEffect, vignetteEffect,
));
composer.addPass(new EffectPass(followCam.camera, smaaEffect));

// DOF auto-tracks the skater -- reads this Vector3 reference each frame
dofEffect.target = skaterModel.group.position;

// --- Input ---
const input = new InputManager();
input.attach(document);


function getSkaterInput(): SkaterInput {
  return {
    forward: input.isDown('KeyW'),
    backward: input.isDown('KeyS'),
    left: input.isDown('KeyA'),
    right: input.isDown('KeyD'),
    ollieHeld: input.isDown('Space'),
    spinLeft: input.isDown('KeyQ'),
    spinRight: input.isDown('KeyE'),
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
skaterModel.setStance(save.stance);
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
let grindDistanceAccum = 0; // meters ground during current grind, for challenge tracking

// --- Engine (declared early so menus can reference it) ---
let engine: Engine;

// --- Menus ---
const pauseMenu = new PauseMenu({
  onResume: () => {
    pauseMenu.hide();
    engine.resume();
  },
  onRestart: () => {
    pauseMenu.hide();
    engine.resume();
  },
  onQuitToMenu: () => {
    pauseMenu.hide();
    mainMenu.show();
    engine.pause();
  },
  onCustomize: () => {
    pauseMenu.hide();
    customizeMenu.show();
  },
});

const mainMenu = new MainMenu({
  onPlay: () => {
    engine.resume();
  },
});

// Customize menu — DONE returns to pause menu
const customizeMenu = new CustomizeMenu(customization, () => {
  skaterModel.setBodyColor(customization.getStyle().shirtColor);
});
customizeMenu.addDeckRow(DECKS, () => save.unlockedBoards, save.equippedBoard, (id) => {
  save.equippedBoard = id;
  SaveManager.save(save);
  skaterModel.setDeck(id);
});
skaterModel.setDeck(save.equippedBoard);
customizeMenu.addStanceToggle(save.stance, (stance) => {
  save.stance = stance;
  SaveManager.save(save);
  skaterModel.setStance(stance);
});
customizeMenu.setOnClose(() => {
  pauseMenu.show(); // return to pause menu
});

// Also listen for Escape while customize is open (engine is paused, so we use DOM listener)
document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && customizeMenu.isVisible) {
    customizeMenu.hide();
    pauseMenu.show();
  }
});

let wasManual = false;

/** Rider and board separate; the combo is lost */
function bail(reason: BailReason): void {
  riderMode.bail(reason);
  skater.setGrinding(null);
  wasManual = false;
  trickSystem.bail();
  hud.updateCombo([], 0, 0);
  hud.flashTrick('BAIL', 0);
  audio.playBail();
  cameraShake.trigger(0.4);
  stats.onBail();
  comboTimer.stop();
  if (grindSound) { grindSound.stop(); grindSound = null; }
}

/** Challenges, stats, the trick flash and the combo timer for every newly landed trick */
function reportLanded(): void {
  for (const t of trickSystem.consumeLanded()) {
    for (const id of t.ids) {
      challengeManager.onTrickLanded(id);
      stats.onTrickLanded(id);
    }
    hud.flashTrick(t.name, t.points);
    if (!comboTimer.active) comboTimer.start();
    else comboTimer.extend(1.5);
  }
}

function checkDecks(): void {
  for (const id of newlyUnlocked({
    completed: challengeManager.completedIds,
    allChallenges: CHALLENGES.map(c => c.id),
    bestCombo: save.bestCombo,
    owned: save.unlockedBoards,
  })) {
    save.unlockedBoards.push(id);
    hud.flashTag(`DECK UNLOCKED: ${deckById(id).name.toUpperCase()}`);
  }
  customizeMenu.refreshDecks();
}

function cashOut(): void {
  if (!trickSystem.comboActive) return;
  const links = trickSystem.comboChain.length;
  const comboScore = trickSystem.cashOut();
  if (comboScore <= 0) return;
  totalScore += comboScore;
  hud.updateScore(totalScore);
  hud.updateCombo([], 0, 0);
  comboTimer.stop();
  challengeManager.onComboCashed(comboScore);
  stats.onComboCashed(comboScore, links);
  audio.playScoreDing();
  cameraShake.trigger(0.08);
  if (comboScore >= 3000) slowMo.trigger(0.6);
  const zoneId = zoneIds[currentZoneIndex];
  if (stats.checkZoneBest(zoneId, totalScore, comboScore, 0)) hud.flashNewBest();
  save.highScore = Math.max(save.highScore, totalScore);
  save.bestCombo = Math.max(save.bestCombo, comboScore);
  save.completedChallenges = challengeManager.completedIds;
  save.unlockedZones = unlockManager.unlockedZones;
  unlockManager.updateCompleted(challengeManager.completedIds);
  checkDecks();
  SaveManager.save(save);
}

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
          } else if (customizeMenu.isVisible) {
        customizeMenu.hide();
        engine.resume();
      } else {
        pauseMenu.updateStats(stats.getSession());
        pauseMenu.show();
        engine.pause();
      }
      input.update(); // consume input
      return;
    }

    // --- Trick list toggle (T key) ---
    if (input.justPressed('KeyT')) {
      trickList.toggle();
      if (trickList.isVisible) { engine.pause(); } else { engine.resume(); }
      input.update();
      return;
    }

    // --- Zone switching (Tab) — all zones open ---
    if (input.justPressed('Tab')) {
      currentZoneIndex = (currentZoneIndex + 1) % zoneIds.length;
      const nextZoneId = zoneIds[currentZoneIndex];
      const zone = zoneManager.getZone(nextZoneId)!;
      engine.pause();
      zoneTransition.play(zone.config.name).then(() => {
        zoneManager.switchTo(nextZoneId);
        grindDetector.clear();
        registerGrindables();
        hud.updateZone(zone.config.name);
        const spawn = zone.config.spawnPoint;
        riderMode.resetToSpawn({ x: spawn.x, y: spawn.y - 0.9, z: spawn.z }, Math.PI);
        skater.setGrinding(null);
        engine.resume();
      });
    }

    // --- Rider, board and walker ---
    followCam.freeLook(input.isMouseDown(2), input.mouseDelta.x, input.mouseDelta.y);
    const riding = riderMode.mode === 'riding';
    if (riding) {
      const presses = readTricks(input);
      if (presses.flip && skater.startFlip(presses.flip)) { audio.playOlliePop(); audio.playFlipSwoosh(); }
      if (presses.grab) skater.startGrab(presses.grab);
      if (presses.grabReleased) skater.releaseGrab();
      if (presses.manual && skater.startManual(presses.manual)) {
        trickSystem.landTrick(presses.manual);
        wasManual = true;
      }
      const wasGrounded = skater.isGrounded;
      skater.update(delta, getSkaterInput());
      if (wasGrounded && skater.isAirborne && input.justReleased('Space')) audio.playOlliePop();

      // --- Grinds: the direction held when locking on picks the grind ---
      const wasGrinding = grindDetector.isGrinding;
      const grindResult = grindDetector.update(skater.position, input.isDown('KeyF'), delta);
      if (grindResult) {
        skater.body.position.set(grindResult.position.x, grindResult.position.y, grindResult.position.z);
        if (grindDetector.isGrinding) {
          grindDistanceAccum += grindDetector.grindSpeed * delta;
          sparks.emit(grindResult.position.x, grindResult.position.y, grindResult.position.z, 12);
          if (!grindSound) grindSound = audio.playGrindLoop();
          if (!wasGrinding) {
            const type = presses.grind ?? 'fifty_fifty';
            trickSystem.landTrick(type);
            skater.setGrinding(type);
          }
        }
      } else {
        if (wasGrinding && grindDistanceAccum > 0) {
          challengeManager.onGrindDistance(grindDistanceAccum);
          grindDistanceAccum = 0;
        }
        if (wasGrinding) skater.setGrinding(null);
        if (grindSound) { grindSound.stop(); grindSound = null; }
      }

      // --- Bails: botched landings, hard wall hits, lost manuals ---
      const wallHit = skater.consumeWallHit();
      const wallBail = wallHit ? judgeWallHit(wallHit.before, wallHit.after) : null;
      if (wallBail) bail(wallBail);
      else if (skater.consumeManualFail()) bail('manual');
      else {
        const landing = skater.consumeLanding();
        if (landing) {
          audio.playLand(0.5);
          cameraShake.trigger(0.15);
          emitDust(skater.position.x, skater.position.y - 0.85, skater.position.z);
          const verdict = judgeLanding(landing.snapshot);
          if (!verdict.clean) bail(verdict.reason);
          else {
            const fakieBefore = skater.fakie;
            trickSystem.landAir(landing, fakieBefore);
            skater.landClean(landing.halfTurns);
            if (skater.fakie !== fakieBefore) hud.flashTag(skater.fakie ? 'FAKIE' : 'REGULAR');
            reportLanded();
            cashOut();
          }
        }
        // A manual ridden out cleanly banks its combo
        if (wasManual && skater.manualTrick === null && skater.isGrounded) {
          wasManual = false;
          reportLanded();
          cashOut();
        }
      }
    } else {
      riderMode.update(delta, {
        walk: {
          forward: input.isDown('KeyW'), back: input.isDown('KeyS'),
          left: input.isDown('KeyA'), right: input.isDown('KeyD'),
          jog: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        },
        mount: input.justPressed('KeyE'),
      }, followCam.getCameraYaw(), physics.world);
    }
    reportLanded();
    hud.setPrompt(riderMode.canMount ? 'E: HOP ON' : null);
    hud.setBalance(riderMode.mode === 'riding' ? skater.manualBalance : null);

    const pose = riderMode.pose();
    const focus = new THREE.Vector3(pose.feet.x, pose.feet.y + 0.9, pose.feet.z);
    skaterModel.update(delta, {
      mode: riderMode.mode, feet: pose.feet, yaw: pose.yaw,
      speed: skater.speed, maxSpeed: skater.maxSpeed, isGrounded: skater.isGrounded, shock: skater.shock,
      trick: skater.trick, trickProgress: skater.trickProgress, pushState: skater.pushState,
      turn: skater.turnInput, braking: skater.braking,
      grinding: riding && grindDetector.isGrinding, grindType: skater.grindType,
      crouch: skater.crouch, manualBalance: skater.manualBalance, spinAngle: skater.spinAngle, fakie: skater.fakie,
      bailReason: riderMode.bailReason, bailProgress: riderMode.bailProgress, mountProgress: riderMode.mountProgress,
      walkSpeed: walker.speed, stridePhase: walker.stridePhase,
      board: { position: board.position, yaw: board.yaw, wheelsUp: board.wheelsUp, speed: Math.hypot(board.velocity.x, board.velocity.z) },
    });
    physics.step(delta);
    const camMode = riding ? 'ride' : riderMode.mode === 'bailing' ? 'bail' : 'walk';
    followCam.update(delta, focus, riding ? skater.speed : 0, skater.maxSpeed, pose.yaw, skaterModel.cameraMoment, skaterModel.chestSide, camMode);

    // --- Combo timer ---
    comboTimer.update(delta);
    if (comboTimer.expired && trickSystem.comboActive) {
      trickSystem.bail();
      hud.updateCombo([], 0, 0);
      hud.flashTrick('TIMEOUT', 0);
      comboTimer.stop();
    }
    if (trickSystem.comboActive) {
      hud.updateCombo(trickSystem.comboChain, trickSystem.comboMultiplier, trickSystem.comboScore);
    }

    // --- Combo cash out (Enter) ---
    if (input.justPressed('Enter') && trickSystem.comboActive) cashOut();

    // --- Speed HUD + cinematic speed effects ---
    hud.updateSpeed(skater.speed / skater.maxSpeed);
    // Chromatic aberration scales with speed (kicks in above 40% max speed)
    const _caStrength = Math.max(0, (skater.speed / skater.maxSpeed - 0.4) / 0.6) * 0.003;
    chromaticAberrationEffect.offset.set(_caStrength, _caStrength * 0.4);

    // --- Update effects ---
    sparks.update(delta);
    const shakeOffset = cameraShake.update(delta);
    followCam.camera.position.add(shakeOffset);
    // Speed lines intensity based on speed
    const speedRatio = riding ? skater.speed / skater.maxSpeed : 0;
    speedLinesEl.style.opacity = speedRatio > 0.5 ? String((speedRatio - 0.5) * 2 * 0.6) : '0';

    // Board trail
    boardTrail.update(focus, riding ? skater.speed : 0);

    // Minimap
    minimap.update(focus.x, focus.z, pose.yaw);

    // --- Rolling sound ---
    if (riding && skater.isGrounded && skater.speed > 0.5) {
      if (!rollSound) rollSound = audio.playRollLoop();
      rollSound?.update(skater.speed);
    } else {
      if (rollSound) { rollSound.stop(); rollSound = null; }
    }

    // --- Blob shadow follows skater ---
    blobShadow.position.set(focus.x, 0.02, focus.z);
    // Scale shadow based on height (smaller when higher = further from ground)
    const shadowScale = Math.max(0.3, 1 - (focus.y - 0.9) * 0.15);
    blobShadow.scale.set(shadowScale, shadowScale, shadowScale);

    // --- Dust particles update ---
    if (riding && skater.speed > 2 && skater.isGrounded && Math.random() < 0.3) {
      emitDust(focus.x, pose.feet.y + 0.05, focus.z);
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
    for (const pos of [skater.body.position, walker.position]) {
      pos.x = Math.max(-boundary, Math.min(boundary, pos.x));
      pos.z = Math.max(-boundary, Math.min(boundary, pos.z));
    }

    input.update();
  },
  render: () => { composer.render(); },
});

// Start the engine loop, but paused on main menu
engine.start();
engine.pause();
mainMenu.show();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
});

// Debug readout: dev server only
if (import.meta.env.DEV) {
  const debugEl = document.createElement('div');
  Object.assign(debugEl.style, {
    position: 'absolute', bottom: '50px', left: '16px',
    color: '#3fb950', fontFamily: 'monospace', fontSize: '11px',
    pointerEvents: 'none', zIndex: '999',
  });
  document.getElementById('hud')!.appendChild(debugEl);

  // Update debug info every frame via a second rAF (runs even when engine is paused)
  const debugLoop = () => {
    const p = skater.body.position;
    const v = skater.body.velocity;
    debugEl.textContent = `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)} | vel: ${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)} | spd: ${skater.speed.toFixed(1)} | grnd: ${skater.isGrounded}`;
    requestAnimationFrame(debugLoop);
  };
  debugLoop();
}

console.log('AMMAN SKATEBOARD LEGEND: click to start, WASD to move, Space to ollie, Enter to cash out combo, Tab to switch zones, Escape to pause');
