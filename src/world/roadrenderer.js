import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from './roads.js';

const CURVE_STEPS = 64;
const ROAD_Y      = 0.16;

export class RoadRenderer {
  constructor(scene) {
    this.scene         = scene;
    this.group         = new THREE.Group();
    scene.add(this.group);
    this._meshes       = new Map(); // segmentId → mesh
    this._preview      = null;
    this._highlighted  = null;
    this._origColors   = null;
    this._snapDot      = this._makeSnapDot();
    scene.add(this._snapDot);
  }

  // ── public ───────────────────────────────────────────────────────────────

  renderSegment(segment, graph) {
    if (this._meshes.has(segment.id)) this.group.remove(this._meshes.get(segment.id));
    const a   = graph.nodes.get(segment.nodeAId);
    const b   = graph.nodes.get(segment.nodeBId);
    const mesh = segment.controlPoint
      ? this._buildCurved(a.x, a.z, segment.controlPoint.x, segment.controlPoint.z, b.x, b.z, segment.roadType)
      : this._buildStraight(a.x, a.z, b.x, b.z, segment.roadType);
    if (!mesh) return;
    mesh.userData.segmentId = segment.id;
    mesh.traverse(c => { if (c.isMesh) c.userData.segmentId = segment.id; });
    this.group.add(mesh);
    this._meshes.set(segment.id, mesh);
  }

  removeSegment(id) {
    const mesh = this._meshes.get(id);
    if (mesh) { this.group.remove(mesh); this._meshes.delete(id); }
  }

  showPreview(ax, az, bx, bz, roadType, controlPoint = null, opacity = 0.45) {
    this.clearPreview();
    const mesh = controlPoint
      ? this._buildCurved(ax, az, controlPoint.x, controlPoint.z, bx, bz, roadType, opacity)
      : this._buildStraight(ax, az, bx, bz, roadType, opacity);
    if (!mesh) return;
    this._preview = mesh;
    this.group.add(mesh);
  }

  clearPreview() {
    if (this._preview) { this.group.remove(this._preview); this._preview = null; }
  }

  // Raycast against all road meshes, return segmentId or null
  getSegmentAtMouse(e, camera) {
    const rect   = this.scene.getObjectByName?.('__canvas__') ?? null;
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const r      = canvas.getBoundingClientRect();
    const mouse  = new THREE.Vector2(
       ((e.clientX - r.left) / r.width)  * 2 - 1,
      -((e.clientY - r.top)  / r.height) * 2 + 1
    );
    const ray    = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);

    const targets = [];
    for (const [, mesh] of this._meshes) {
      mesh.traverse(c => { if (c.isMesh) targets.push(c); });
    }
    const hits = ray.intersectObjects(targets);
    if (hits.length === 0) return null;
    return hits[0].object.userData.segmentId ?? null;
  }

  highlightSegment(id) {
    this.clearHighlight();
    const mesh = this._meshes.get(id);
    if (!mesh) return;
    this._highlighted = id;
    this._origColors  = new Map();
    mesh.traverse(c => {
      if (c.isMesh) {
        this._origColors.set(c, c.material.color.getHex());
        c.material = c.material.clone();
        c.material.color.setHex(0xe74c3c);
      }
    });
  }

  clearHighlight() {
    if (this._highlighted === null) return;
    const mesh = this._meshes.get(this._highlighted);
    if (mesh && this._origColors) {
      mesh.traverse(c => {
        if (c.isMesh && this._origColors.has(c)) {
          c.material.color.setHex(this._origColors.get(c));
        }
      });
    }
    this._highlighted = null;
    this._origColors  = null;
  }

  showSnap(x, z) { this._snapDot.position.set(x, 0.3, z); this._snapDot.visible = true; }
  hideSnap()      { this._snapDot.visible = false; }

  // ── straight ─────────────────────────────────────────────────────────────

  _buildStraight(ax, az, bx, bz, roadType, opacity = 1) {
    const type = ROAD_TYPES[roadType];
    const dx   = bx - ax, dz = bz - az;
    const len  = Math.sqrt(dx*dx + dz*dz);
    if (len < 0.5) return null;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(type.width, len),
      new THREE.MeshLambertMaterial({ color: type.color, transparent: opacity < 1, opacity })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    const g = new THREE.Group();
    g.position.set((ax+bx)/2, ROAD_Y, (az+bz)/2);
    g.rotation.y = Math.atan2(dx, dz);
    g.add(mesh);
    return g;
  }

  // ── curved ───────────────────────────────────────────────────────────────

  _buildCurved(ax, az, cx, cz, bx, bz, roadType, opacity = 1) {
    const type  = ROAD_TYPES[roadType];
    const half  = type.width / 2;
    const steps = CURVE_STEPS;

    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, it = 1 - t;
      pts.push({
        x: it*it*ax + 2*it*t*cx + t*t*bx,
        z: it*it*az + 2*it*t*cz + t*t*bz,
      });
    }

    const verts = [], inds = [], uvs = [];
    let total = 0;
    const lens = [0];
    for (let i = 1; i <= steps; i++) {
      const dx = pts[i].x - pts[i-1].x, dz = pts[i].z - pts[i-1].z;
      total += Math.sqrt(dx*dx + dz*dz);
      lens.push(total);
    }

    for (let i = 0; i <= steps; i++) {
      const prev = pts[Math.max(0, i-1)], next = pts[Math.min(steps, i+1)];
      const tx = next.x - prev.x, tz = next.z - prev.z;
      const tl = Math.sqrt(tx*tx + tz*tz) || 1;
      const px =  tz/tl, pz = -tx/tl;
      verts.push(
        pts[i].x - px*half, ROAD_Y, pts[i].z - pz*half,
        pts[i].x + px*half, ROAD_Y, pts[i].z + pz*half
      );
      const u = lens[i] / total;
      uvs.push(0, u, 1, u);
    }
    for (let i = 0; i < steps; i++) {
      const a = i*2, b = a+1, c = a+2, d = a+3;
      inds.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,   2));
    geo.setIndex(inds);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({
      color: type.color, transparent: opacity < 1, opacity, side: THREE.DoubleSide,
    }));
    mesh.receiveShadow = true;
    return mesh;
  }

  _makeSnapDot() {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0xffdd00, transparent: true, opacity: 0.85 })
    );
    m.visible = false;
    return m;
  }
}