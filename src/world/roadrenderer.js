import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from './roads.js';

export class RoadRenderer {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._meshes      = new Map(); // segmentId -> mesh group
    this._preview     = null;
    this._snapDot     = this._makeSnapDot();
    scene.add(this._snapDot);
  }

  _makeSnapDot() {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.5, 0.4, 8),
      new THREE.MeshLambertMaterial({ color: 0xffdd00, transparent: true, opacity: 0.85 })
    );
    mesh.visible = false;
    return mesh;
  }

  _buildMesh(ax, az, bx, bz, roadType, opacity = 1.0) {
    const type = ROAD_TYPES[roadType];
    const dx = bx - ax;
    const dz = bz - az;
    const length = Math.sqrt(dx * dx + dz * dz);
    if (length < 0.5) return null;

    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(type.width, length),
      new THREE.MeshLambertMaterial({
        color: type.color,
        transparent: opacity < 1.0,
        opacity,
      })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;

    const group = new THREE.Group();
    group.position.set((ax + bx) / 2, 0.16, (az + bz) / 2);
    group.rotation.y = Math.atan2(dx, dz);
    group.add(plane);
    return group;
  }

  renderSegment(segment, graph) {
    if (this._meshes.has(segment.id)) {
      this.group.remove(this._meshes.get(segment.id));
    }
    const a = graph.nodes.get(segment.nodeAId);
    const b = graph.nodes.get(segment.nodeBId);
    const mesh = this._buildMesh(a.x, a.z, b.x, b.z, segment.roadType);
    if (!mesh) return;
    this.group.add(mesh);
    this._meshes.set(segment.id, mesh);
  }

  showPreview(ax, az, bx, bz, roadType) {
    this.clearPreview();
    const mesh = this._buildMesh(ax, az, bx, bz, roadType, 0.45);
    if (!mesh) return;
    this._preview = mesh;
    this.group.add(mesh);
  }

  clearPreview() {
    if (this._preview) {
      this.group.remove(this._preview);
      this._preview = null;
    }
  }

  showSnap(x, z) {
    this._snapDot.position.set(x, 0.3, z);
    this._snapDot.visible = true;
  }

  hideSnap() {
    this._snapDot.visible = false;
  }
}