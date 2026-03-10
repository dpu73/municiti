import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from './roads.js';

const CURVE_STEPS = 32;
const ROAD_Y      = 0.16;

export class RoadRenderer {
  constructor(scene) {
    this.scene  = scene;
    this.group  = new THREE.Group();
    scene.add(this.group);
    this._meshes  = new Map();
    this._preview = null;
    this._snapDot = this._makeSnapDot();
    scene.add(this._snapDot);
  }

  // ── public ───────────────────────────────────────────────────────────────

  renderSegment(segment, graph) {
    if (this._meshes.has(segment.id)) {
      this.group.remove(this._meshes.get(segment.id));
    }
    const a = graph.nodes.get(segment.nodeAId);
    const b = graph.nodes.get(segment.nodeBId);
    const mesh = segment.controlPoint
      ? this._buildCurved(a.x, a.z, segment.controlPoint.x, segment.controlPoint.z, b.x, b.z, segment.roadType)
      : this._buildStraight(a.x, a.z, b.x, b.z, segment.roadType);
    if (!mesh) return;
    this.group.add(mesh);
    this._meshes.set(segment.id, mesh);
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

  showSnap(x, z) {
    this._snapDot.position.set(x, 0.3, z);
    this._snapDot.visible = true;
  }

  hideSnap() { this._snapDot.visible = false; }

  // ── straight segment ─────────────────────────────────────────────────────

  _buildStraight(ax, az, bx, bz, roadType, opacity = 1.0) {
    const type = ROAD_TYPES[roadType];
    const dx   = bx - ax;
    const dz   = bz - az;
    const len  = Math.sqrt(dx * dx + dz * dz);
    if (len < 0.5) return null;

    const mat  = new THREE.MeshLambertMaterial({
      color: type.color, transparent: opacity < 1, opacity,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(type.width, len), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    const group = new THREE.Group();
    group.position.set((ax + bx) / 2, ROAD_Y, (az + bz) / 2);
    group.rotation.y = Math.atan2(dx, dz);
    group.add(mesh);
    return group;
  }

  // ── curved segment ────────────────────────────────────────────────────────

  _buildCurved(ax, az, cx, cz, bx, bz, roadType, opacity = 1.0) {
    const type   = ROAD_TYPES[roadType];
    const half   = type.width / 2;
    const steps  = CURVE_STEPS;

    // Sample bezier into points
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t  = i / steps;
      const it = 1 - t;
      pts.push({
        x: it * it * ax + 2 * it * t * cx + t * t * bx,
        z: it * it * az + 2 * it * t * cz + t * t * bz,
      });
    }

    // Build ribbon geometry from points
    const verts  = [];
    const inds   = [];
    const uvs    = [];
    let totalLen = 0;
    const segLens = [0];
    for (let i = 1; i <= steps; i++) {
      const dx = pts[i].x - pts[i-1].x;
      const dz = pts[i].z - pts[i-1].z;
      totalLen += Math.sqrt(dx*dx + dz*dz);
      segLens.push(totalLen);
    }

    for (let i = 0; i <= steps; i++) {
      // tangent
      const prev = pts[Math.max(0, i - 1)];
      const next = pts[Math.min(steps, i + 1)];
      const tx   = next.x - prev.x;
      const tz   = next.z - prev.z;
      const tlen = Math.sqrt(tx*tx + tz*tz) || 1;
      // perpendicular on XZ plane
      const px   =  tz / tlen;
      const pz   = -tx / tlen;

      verts.push(
        pts[i].x - px * half, ROAD_Y, pts[i].z - pz * half,
        pts[i].x + px * half, ROAD_Y, pts[i].z + pz * half,
      );
      const u = segLens[i] / totalLen;
      uvs.push(0, u, 1, u);
    }

    for (let i = 0; i < steps; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      inds.push(a, b, c, b, d, c);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs,   2));
    geo.setIndex(inds);
    geo.computeVertexNormals();

    const mat  = new THREE.MeshLambertMaterial({
      color: type.color, transparent: opacity < 1, opacity, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  // ── snap dot ──────────────────────────────────────────────────────────────

  _makeSnapDot() {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0xffdd00, transparent: true, opacity: 0.85 })
    );
    mesh.visible = false;
    return mesh;
  }
}