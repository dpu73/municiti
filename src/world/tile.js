import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export const TILE_SIZE = 100;
export const ROAD_WIDTH = 6;

const EDGES = ['north', 'south', 'east', 'west'];

function randomEdge() {
  return EDGES[Math.floor(Math.random() * EDGES.length)];
}

function createGroundMesh() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0x5a8a3c })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

function createGridMesh() {
  const grid = new THREE.GridHelper(TILE_SIZE, 10, 0x000000, 0x000000);
  grid.material.opacity = 0.15;
  grid.material.transparent = true;
  grid.position.y = 0.1;
  return grid;
}

function createCountyRoadStub(edge) {
  // Stub runs from the tile edge inward 20 units
  const stubLength = 20;
  const stubY = 0.15;

  const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
  let mesh;

  switch (edge) {
    case 'north':
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, stubLength), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, stubY, -(TILE_SIZE / 2) + stubLength / 2);
      break;
    case 'south':
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_WIDTH, stubLength), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, stubY, (TILE_SIZE / 2) - stubLength / 2);
      break;
    case 'east':
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(stubLength, ROAD_WIDTH), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((TILE_SIZE / 2) - stubLength / 2, stubY, 0);
      break;
    case 'west':
      mesh = new THREE.Mesh(new THREE.PlaneGeometry(stubLength, ROAD_WIDTH), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(-(TILE_SIZE / 2) + stubLength / 2, stubY, 0);
      break;
  }

  mesh.receiveShadow = true;
  return mesh;
}

function createEdgeMarkers() {
  // Subtle darker border around the tile edge so boundaries are readable
  const mat = new THREE.MeshLambertMaterial({ color: 0x3d6b28 });
  const markers = new THREE.Group();
  const thickness = 1;
  const half = TILE_SIZE / 2;

  const positions = [
    { w: TILE_SIZE, h: thickness, x: 0, z: -half },
    { w: TILE_SIZE, h: thickness, x: 0, z:  half },
    { w: thickness, h: TILE_SIZE, x: -half, z: 0 },
    { w: thickness, h: TILE_SIZE, x:  half, z: 0 },
  ];

  for (const p of positions) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(p.w, p.h), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(p.x, 0.12, p.z);
    markers.add(mesh);
  }

  return markers;
}

export function createTile(scene) {
  const edge = randomEdge();

  const ground = createGroundMesh();
  const grid = createGridMesh();
  const stub = createCountyRoadStub(edge);
  const borders = createEdgeMarkers();

  scene.add(ground);
  scene.add(grid);
  scene.add(stub);
  scene.add(borders);

  // Tile state — this object grows as we add more systems
  const tile = {
    size: TILE_SIZE,
    geography: 'plains',
    countyConnection: {
      edge,
      type: 'road',
      position: 0, // 0 = centered on edge
    },
    roads: [],
    buildings: [],
    zones: [],
  };

  console.log(`[tile] County road stub placed on ${edge} edge`);
  return tile;
}