// Dev-only pose viewer (not in the production build): /pose-lab.html?s=push&t=0.5&stance=goofy
import * as THREE from 'three';
import { SkaterModel, type SkaterAnimState } from '@/player/SkaterModel';
import type { TrickAnim } from '@/player/Skater';
import type { PushPhase } from '@/player/anim/PushCycle';
import type { Stance } from '@/player/anim/mirror';

const q = new URLSearchParams(location.search);
const s = q.get('s') ?? 'idle';
const t = Number(q.get('t') ?? 0.5);
const stance = (q.get('stance') ?? 'regular') as Stance;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setScissorTest(true);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2a2a);
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(3, 6, 4);
scene.add(sun);
const grid = new THREE.GridHelper(6, 24, 0x666666, 0x3a3a3a);
scene.add(grid);
const travel = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.01, 0.6), 0.6, 0x44ff88);
scene.add(travel);

const model = new SkaterModel(scene, new THREE.Group());
model.setStance(stance);

const tricks: Record<string, TrickAnim> = { ollie: 'ollie', kickflip: 'kickflip', heelflip: 'heelflip', tre: 'tre_flip', spin: 'spin', grab: 'grab', manual: 'manual' };
const pushPhases: Record<string, PushPhase> = { reach: 'reach', push: 'contact', return: 'return' };

function stateFor(): SkaterAnimState {
  const st: SkaterAnimState = {
    position: new THREE.Vector3(0, 0.9, 0), yaw: 0, speed: 0, maxSpeed: 15,
    isGrounded: true, isBailing: false, bailProgress: 0, shock: 0, trick: 'none', trickProgress: 0,
    pushState: { phase: 'none', phaseT: 0, contactTravel: 0, stride: 0.7 }, turn: 0, braking: false, grinding: false,
  };
  if (s in pushPhases) Object.assign(st, { speed: 4, pushState: { phase: pushPhases[s], phaseT: t, contactTravel: t * 0.7, stride: 0.7 } });
  if (s === 'ride') st.speed = 10;
  if (s === 'carve') Object.assign(st, { speed: 10, turn: Number(q.get('turn') ?? 1) });
  if (s === 'brake') Object.assign(st, { speed: 10, braking: true });
  if (s === 'air') Object.assign(st, { speed: 8, isGrounded: false });
  if (s === 'grind') Object.assign(st, { speed: 8, grinding: true });
  if (s === 'bail') Object.assign(st, { isBailing: true, bailProgress: t });
  if (s in tricks) Object.assign(st, { speed: 8, isGrounded: s === 'manual', trick: tricks[s], trickProgress: t });
  return st;
}

// Settle the smoothing, then hold
for (let i = 0; i < 90; i++) model.update(1 / 60, stateFor());

const views: [string, THREE.Vector3][] = [
  ['behind', new THREE.Vector3(0, 1.3, -3.2)],
  ['chest side (right of travel)', new THREE.Vector3(-3.2, 1.2, 0)],
  ['back side', new THREE.Vector3(3.2, 1.2, 0)],
  ['front', new THREE.Vector3(0, 1.3, 3.2)],
];
const cams = views.map(([, p]) => {
  const c = new THREE.PerspectiveCamera(40, (innerWidth / 2) / (innerHeight / 2), 0.05, 50);
  c.position.copy(p);
  c.lookAt(0, 0.8, 0);
  return c;
});
(document.getElementById('label') as HTMLElement).textContent = `${s} t=${t} ${stance} | ${views.map(v => v[0]).join(' / ')}`;

function frame() {
  model.update(1 / 60, stateFor());
  const w = innerWidth / 2, h = innerHeight / 2;
  cams.forEach((c, i) => {
    const x = (i % 2) * w, y = (1 - Math.floor(i / 2)) * h;
    renderer.setViewport(x, y, w, h);
    renderer.setScissor(x, y, w, h);
    renderer.render(scene, c);
  });
  requestAnimationFrame(frame);
}
frame();
(window as unknown as { labReady: boolean }).labReady = true;
