import * as THREE from 'three'

console.log('ANAN SKATE — engine running')

// Renderer
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true

// Scene
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0a0a0f)

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000)
camera.position.set(0, 5, 10)
camera.lookAt(0, 0, 0)

// Ground plane (dark purple)
const groundGeometry = new THREE.PlaneGeometry(50, 50)
const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x1a0a2e })
const ground = new THREE.Mesh(groundGeometry, groundMaterial)
ground.rotation.x = -Math.PI / 2
ground.receiveShadow = true
scene.add(ground)

// Directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
dirLight.position.set(10, 20, 10)
dirLight.castShadow = true
scene.add(dirLight)

// Ambient light
const ambientLight = new THREE.AmbientLight(0x4a2080, 0.6)
scene.add(ambientLight)

// Resize handler
function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}
window.addEventListener('resize', onResize)

// Animation loop
function animate(): void {
  requestAnimationFrame(animate)
  renderer.render(scene, camera)
}

animate()
