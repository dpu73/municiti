import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from './roads.js';

export const INTERSECTION_UPGRADES = {
  none: {
    name:        'Uncontrolled',
    cost:        0,
    description: 'No traffic control.',
    color:       null,
  },
  stop_sign: {
    name:        'Stop Sign',
    cost:        500,
    description: 'Reduces accidents. Slight traffic improvement.',
    color:       0xcc2200,
    unlockKey:   'intersection_stop_sign',
  },
  crosswalk: {
    name:        'Crosswalk',
    cost:        1000,
    description: 'Pedestrian safety. Desirability boost.',
    color:       0xffffff,
    unlockKey:   'intersection_crosswalk',
  },
  streetlight: {
    name:        'Streetlight',
    cost:        2500,
    description: 'Night safety. Agent behavior change.',
    color:       0xffee88,
    unlockKey:   'intersection_streetlight',
  },
  signal: {
    name:        'Traffic Signal',
    cost:        8000,
    description: 'Major traffic flow improvement.',
    color:       0x22cc44,
    unlockKey:   'intersection_signal',
  },
  smart_signal: {
    name:        'Smart Signal',
    cost:        25000,
    description: 'Adaptive timing. County unlock year 5.',
    color:       0x44aaff,
    unlockKey:   'intersection_smart_signal',
  },
};

export const UPGRADE_ORDER = ['none','stop_sign','crosswalk','streetlight','signal','smart_signal'];

const ROAD_Y      = 0.15;
const MARKER_Y    = 0.22;

export class IntersectionSystem {
  constructor(scene, graph) {
    this.scene  = scene;
    this.graph  = graph;
    this._data  = new Map(); // nodeId → { upgrade, meshes[] }
    this._group = new THREE.Group();
    scene.add(this._group);
  }

  // Called after any segment add/remove — rebuild affected intersections
  update(nodeId) {
    this._rebuild(nodeId);
  }

  updateAll() {
    for (const [id] of this.graph.nodes) this._rebuild(id);
  }

  getUpgrade(nodeId) {
    return this._data.get(nodeId)?.upgrade ?? 'none';
  }

  // Returns { ok, reason }
  applyUpgrade(nodeId, upgradeName, gameState) {
    const node    = this.graph.nodes.get(nodeId);
    if (!node || node.segmentIds.length < 2) return { ok: false, reason: 'Not an intersection.' };

    const upgrade = INTERSECTION_UPGRADES[upgradeName];
    if (!upgrade) return { ok: false, reason: 'Unknown upgrade.' };

    if (upgrade.cost > gameState.funds) {
      return { ok: false, reason: `Need $${upgrade.cost.toLocaleString()}` };
    }

    gameState.funds -= upgrade.cost;
    gameState.onFundsChanged();

    const entry = this._data.get(nodeId) ?? { upgrade: 'none', meshes: [] };
    entry.upgrade = upgradeName;
    this._data.set(nodeId, entry);
    this._rebuild(nodeId);

    console.log(`[intersections] Node ${nodeId} upgraded to ${upgradeName}`);
    return { ok: true };
  }

  // Get all intersection nodes (3+ segments)
  getIntersectionNodes() {
    return [...this.graph.nodes.values()].filter(n => n.segmentIds.length >= 3);
  }

  // Raycast to find nearest intersection node within radius
  getNearestNode(e, camera, canvas, maxDist = 12) {
    const rect  = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2(
       ((e.clientX - rect.left) / rect.width)  * 2 - 1,
      -((e.clientY - rect.top)  / rect.height) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const ground = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
    const hit    = new THREE.Vector3();
    if (!ray.ray.intersectPlane(ground, hit)) return null;

    let best = null, bestDist = maxDist;
    for (const node of this.getIntersectionNodes()) {
      const d = Math.sqrt((node.x - hit.x)**2 + (node.z - hit.z)**2);
      if (d < bestDist) { bestDist = d; best = node; }
    }
    return best;
  }

  // ── private ────────────────────────────────────────────────────────────────

  _rebuild(nodeId) {
    const node = this.graph.nodes.get(nodeId);
    const entry = this._data.get(nodeId) ?? { upgrade: 'none', meshes: [] };

    // Clear old meshes
    for (const m of entry.meshes) this._group.remove(m);
    entry.meshes = [];

    if (!node || node.segmentIds.length < 2) {
      this._data.set(nodeId, entry);
      return;
    }

    // Build junction patch
    const patch = this._buildPatch(node);
    if (patch) {
      this._group.add(patch);
      entry.meshes.push(patch);
    }

    // Build upgrade marker
    const marker = this._buildMarker(node, entry.upgrade);
    if (marker) {
      this._group.add(marker);
      entry.meshes.push(marker);
    }

    this._data.set(nodeId, entry);
  }

  _buildPatch(node) {
    // Collect all road-edge corner points around this node
    const corners = [];

    for (const segId of node.segmentIds) {
      const seg   = this.graph.segments.get(segId);
      if (!seg) continue;
      const type  = ROAD_TYPES[seg.roadType];
      const half  = type.width / 2;

      // Other node
      const otherId = seg.nodeAId === node.id ? seg.nodeBId : seg.nodeAId;
      const other   = this.graph.nodes.get(otherId);
      if (!other) continue;

      // Direction from node toward other
      const dx = other.x - node.x;
      const dz = other.z - node.z;
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      const nx = dx/len, nz = dz/len;

      // Perpendicular
      const px = -nz, pz = nx;

      // Two corner points at the node end of this segment
      corners.push({ x: node.x + px*half, z: node.z + pz*half });
      corners.push({ x: node.x - px*half, z: node.z - pz*half });
    }

    if (corners.length < 3) return null;

    // Compute centroid
    const cx = corners.reduce((s,p) => s+p.x, 0) / corners.length;
    const cz = corners.reduce((s,p) => s+p.z, 0) / corners.length;

    // Sort by angle around centroid
    corners.sort((a,b) =>
      Math.atan2(a.z - cz, a.x - cx) - Math.atan2(b.z - cz, b.x - cx)
    );

    // Deduplicate nearby points
    const deduped = [corners[0]];
    for (let i = 1; i < corners.length; i++) {
      const prev = deduped[deduped.length-1];
      const d = Math.sqrt((corners[i].x-prev.x)**2 + (corners[i].z-prev.z)**2);
      if (d > 0.5) deduped.push(corners[i]);
    }

    if (deduped.length < 3) return null;

    // Pick color from widest road at this intersection
    let maxWidth = 0, patchColor = 0x555555;
    for (const segId of node.segmentIds) {
      const seg = this.graph.segments.get(segId);
      if (!seg) continue;
      const w = ROAD_TYPES[seg.roadType].width;
      if (w > maxWidth) { maxWidth = w; patchColor = ROAD_TYPES[seg.roadType].color; }
    }

    // Build fan geometry from centroid
    const verts = [];
    const inds  = [];

    // Center vertex
    verts.push(cx, ROAD_Y + 0.01, cz);

    // Edge vertices
    for (const p of deduped) verts.push(p.x, ROAD_Y + 0.01, p.z);

    // Triangles
    const n = deduped.length;
    for (let i = 0; i < n; i++) {
      inds.push(0, 1 + i, 1 + (i+1) % n);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(inds);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: patchColor, side: THREE.DoubleSide,
    }));
    mesh.receiveShadow = true;
    mesh.userData.nodeId = node.id;
    return mesh;
  }

  _buildMarker(node, upgrade) {
    if (upgrade === 'none') return null;
    const info = INTERSECTION_UPGRADES[upgrade];
    if (!info?.color) return null;

    const geo  = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 8);
    const mat  = new THREE.MeshLambertMaterial({ color: info.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(node.x, MARKER_Y, node.z);
    mesh.userData.nodeId = node.id;
    return mesh;
  }
}