import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // sky blue
scene.fog = new THREE.Fog(0x87ceeb, 100, 400);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 40, 80);
camera.lookAt(0, 0, 0);

// --- Lighting ---
const ambient = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfffbe6, 1.2);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -150;
sun.shadow.camera.right = 150;
sun.shadow.camera.top = 150;
sun.shadow.camera.bottom = -150;
scene.add(sun);

// --- Terrain Tile ---
// One township tile = 100x100 units
const tileSize = 100;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(tileSize, tileSize, 10, 10),
  new THREE.MeshLambertMaterial({ color: 0x5a8a3c }) // grass green
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- Grid overlay so the tile feels like a grid ---
const grid = new THREE.GridHelper(tileSize, 10, 0x000000, 0x000000);
grid.material.opacity = 0.15;
grid.material.transparent = true;
grid.position.y = 0.1;
scene.add(grid);

// --- Simple orbit camera controls ---
let isDragging = false;
let isPanning = false;
let prevMouse = { x: 0, y: 0 };
let spherical = { theta: 0.4, phi: 0.6, radius: 100 };
let target = new THREE.Vector3(0, 0, 0);

function updateCamera() {
  camera.position.x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  camera.position.y = target.y + spherical.radius * Math.cos(spherical.phi);
  camera.position.z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
  camera.lookAt(target);
}
updateCamera();

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

renderer.domElement.addEventListener('mousedown', e => {
  if (e.button === 0) isDragging = true;
  if (e.button === 2) isPanning = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mouseup', () => {
  isDragging = false;
  isPanning = false;
});

renderer.domElement.addEventListener('mousemove', e => {
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;

  if (isDragging) {
    spherical.theta -= dx * 0.005;
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2, spherical.phi - dy * 0.005));
  }

  if (isPanning) {
    const panSpeed = spherical.radius * 0.001;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    right.crossVectors(up, new THREE.Vector3(
      Math.sin(spherical.phi) * Math.sin(spherical.theta),
      Math.cos(spherical.phi),
      Math.sin(spherical.phi) * Math.cos(spherical.theta)
    )).normalize();
    target.addScaledVector(right, dx * panSpeed);
    target.x += Math.cos(spherical.theta) * dy * panSpeed;
    target.z += Math.sin(spherical.theta) * dy * panSpeed;
  }

  prevMouse = { x: e.clientX, y: e.clientY };
  updateCamera();
});

renderer.domElement.addEventListener('wheel', e => {
  spherical.radius = Math.max(20, Math.min(200, spherical.radius + e.deltaY * 0.1));
  updateCamera();
});

// --- Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Loop ---
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();