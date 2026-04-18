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

// --- Renderer ---
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);
renderer.shadowMap.enabled = true;

// --- Scene & Lighting ---
const scene = new THREE.Scene();

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040, 0.6));

// --- Physics ---
const physics = new PhysicsWorld();
// NOTE: Ground plane is provided by each zone; do not create a global ground here.

// --- Zone System ---
const zoneManager = new ZoneManager(scene, physics.world);
zoneManager.register(new SkatePark());
zoneManager.register(new StreetSpot());
zoneManager.register(new OldAmman());
zoneManager.switchTo('skate_park');

const zoneIds = ['skate_park', 'street', 'old_amman'] as const;
let currentZoneIndex = 0;

// --- Skater ---
const skater = new Skater(physics.world);
scene.add(skater.mesh);

// --- Camera ---
const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

// --- Input ---
const input = new InputManager();
input.attach(document.body);

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

// --- Engine ---
const engine = new Engine({
  update: (delta) => {
    // --- Pause toggle ---
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
      input.update(); // consume input
      return;
    }

    // --- Zone switching (Tab, debug) ---
    if (input.justPressed('Tab')) {
      currentZoneIndex = (currentZoneIndex + 1) % zoneIds.length;
      const nextZoneId = zoneIds[currentZoneIndex];
      if (unlockManager.isZoneUnlocked(nextZoneId)) {
        zoneManager.switchTo(nextZoneId);
        const zone = zoneManager.getZone(nextZoneId)!;
        hud.updateZone(zone.config.name);
        // Reset skater to zone spawn
        const spawn = zone.config.spawnPoint;
        skater.body.position.set(spawn.x, spawn.y, spawn.z);
        skater.body.velocity.setZero();
      }
    }

    // --- Camera & physics ---
    followCam.handleMouseInput(input.mouseDelta.x, input.mouseDelta.y);
    skater.update(delta, getSkaterInput());
    physics.step(delta);
    followCam.update(delta, skater.position);

    // --- Trick detection ---
    if (input.justPressed('Space') && skater.isGrounded) {
      if (input.isDown('KeyJ')) {
        if (input.isDown('KeyA') || input.isDown('KeyD')) {
          trickSystem.landTrick('tre_flip');
        } else {
          trickSystem.landTrick('kickflip');
        }
      } else if (input.isDown('KeyK')) {
        trickSystem.landTrick('heelflip');
      } else {
        trickSystem.landTrick('ollie');
      }
    }

    if (input.justPressed('ShiftLeft') || input.justPressed('ShiftRight')) {
      trickSystem.landTrick('manual');
    }

    // Notify challenge manager of tricks landed
    if (trickSystem.lastTrick) {
      challengeManager.onTrickLanded(trickSystem.lastTrick);
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

    // --- Speed HUD ---
    hud.updateSpeed(skater.speed / skater.maxSpeed);

    input.update();
  },
  render: () => { renderer.render(scene, followCam.camera); },
});

// Start paused on main menu
engine.pause();
mainMenu.show();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
});

console.log('ANAN SKATE — click to start, WASD to move, Space to ollie, Enter to cash out combo, Tab to switch zones, Escape to pause');
