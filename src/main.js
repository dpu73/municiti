import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { createTile } from './world/tile.js';

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Scene ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 100, 400);

// --- Camera ---
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

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

// --- World ---
const tile = createTile(scene);

// --- Camera controls ---
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
    target.x -= Math.cos(spherical.theta) * dx * panSpeed;
    target.z += Math.sin(spherical.theta) * dx * panSpeed;
    target.x -= Math.sin(spherical.theta) * dy * panSpeed;
    target.z -= Math.cos(spherical.theta) * dy * panSpeed;
  }

  prevMouse = { x: e.clientX, y: e.clientY };
  updateCamera();
});

renderer.domElement.addEventListener('wheel', e => {
  spherical.radius = Math.max(20, Math.min(200, spherical.radius + e.deltaY * 0.1));
  updateCamera();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Version overlay ---
const ts = new Date(document.lastModified);
const pad = n => String(n).padStart(2, '0');
const versionString = `MuniCity ${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;

const version = document.createElement('div');
version.textContent = versionString;
version.style.cssText = `
  position: fixed;
  bottom: 12px;
  right: 12px;
  color: rgba(255,255,255,0.6);
  font: 12px monospace;
  pointer-events: none;
`;
document.body.appendChild(version);

// --- Loop ---
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();