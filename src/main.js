import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { createTile }    from './world/tile.js';
import { RoadGraph }     from './world/roads.js';
import { RoadRenderer }  from './world/roadrenderer.js';
import { RoadBuilder }   from './ui/roadbuilder.js';

// ── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 100, 400);

// ── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

// ── Lighting ─────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xfffbe6, 1.2);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.width  = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.near    = 1;
sun.shadow.camera.far     = 500;
sun.shadow.camera.left    = -150;
sun.shadow.camera.right   = 150;
sun.shadow.camera.top     = 150;
sun.shadow.camera.bottom  = -150;
scene.add(sun);

// ── World ─────────────────────────────────────────────────────────────────────
const tile = createTile(scene);

// ── Road system ───────────────────────────────────────────────────────────────
const roadGraph    = new RoadGraph();
const roadRenderer = new RoadRenderer(scene);

// ── Game state ────────────────────────────────────────────────────────────────
const gameState = {
  funds: 100000,
  onFundsChanged: () => {}, // wired by RoadBuilder
};

// ── Road builder UI ───────────────────────────────────────────────────────────
const roadBuilder = new RoadBuilder({ camera, renderer, graph: roadGraph, roadRenderer, gameState });

// ── Camera controls ───────────────────────────────────────────────────────────
let isDragging = false;
let isPanning  = false;
let prevMouse  = { x: 0, y: 0 };
let spherical  = { theta: 0.4, phi: 0.6, radius: 100 };
let target     = new THREE.Vector3(0, 0, 0);

function updateCamera() {
  camera.position.x = target.x + spherical.radius * Math.sin(spherical.phi) * Math.sin(spherical.theta);
  camera.position.y = target.y + spherical.radius * Math.cos(spherical.phi);
  camera.position.z = target.z + spherical.radius * Math.sin(spherical.phi) * Math.cos(spherical.theta);
  camera.lookAt(target);
}
updateCamera();

renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

renderer.domElement.addEventListener('mousedown', e => {
  if (roadBuilder.isActive) return; // road builder owns the mouse
  if (e.button === 0) isDragging = true;
  if (e.button === 2) isPanning  = true;
  prevMouse = { x: e.clientX, y: e.clientY };
});

renderer.domElement.addEventListener('mouseup', () => {
  isDragging = false;
  isPanning  = false;
});

renderer.domElement.addEventListener('mousemove', e => {
  if (roadBuilder.isActive) return;
  const dx = e.clientX - prevMouse.x;
  const dy = e.clientY - prevMouse.y;

  if (isDragging) {
    spherical.theta -= dx * 0.005;
    spherical.phi = Math.max(0.1, Math.min(Math.PI / 2, spherical.phi - dy * 0.005));
  }
  if (isPanning) {
    const s = spherical.radius * 0.001;
    target.x -= Math.cos(spherical.theta) * dx * s;
    target.z += Math.sin(spherical.theta) * dx * s;
    target.x -= Math.sin(spherical.theta) * dy * s;
    target.z -= Math.cos(spherical.theta) * dy * s;
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

// ── Version overlay ───────────────────────────────────────────────────────────
const ts  = new Date(document.lastModified);
const pad = n => String(n).padStart(2, '0');
const ver = document.createElement('div');
ver.textContent = `MuniCity ${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
ver.style.cssText = `
  position:fixed; bottom:66px; right:12px;
  color:rgba(255,255,255,0.5); font:12px monospace; pointer-events:none;
`;
document.body.appendChild(ver);

// ── Loop ──────────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();