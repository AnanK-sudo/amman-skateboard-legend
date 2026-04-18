import * as THREE from 'three';
import { Engine } from '@/core/Engine';
import { InputManager } from '@/core/InputManager';
import { PhysicsWorld } from '@/core/PhysicsWorld';
import { Skater, SkaterInput } from '@/player/Skater';
import { FollowCamera } from '@/player/Camera';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x1a1a2e);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();

const dirLight = new THREE.DirectionalLight(0xffffff, 1);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0x404040, 0.6));

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  new THREE.MeshStandardMaterial({ color: 0x2d2d4e })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const physics = new PhysicsWorld();
physics.createGroundPlane();

const skater = new Skater(physics.world);
scene.add(skater.mesh);

const followCam = new FollowCamera(window.innerWidth / window.innerHeight);

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

const engine = new Engine({
  update: (delta) => {
    followCam.handleMouseInput(input.mouseDelta.x, input.mouseDelta.y);
    skater.update(delta, getSkaterInput());
    physics.step(delta);
    followCam.update(delta, skater.position);
    input.update();
  },
  render: () => { renderer.render(scene, followCam.camera); },
});
engine.start();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  followCam.camera.aspect = window.innerWidth / window.innerHeight;
  followCam.camera.updateProjectionMatrix();
});

console.log('ANAN SKATE — click to start, WASD to move, Space to ollie');
