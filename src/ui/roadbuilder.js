import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from '../world/roads.js';

const GRID   = 10;
const HALF   = 50;

const snap  = v => Math.round(v / GRID) * GRID;
const clamp = v => Math.max(-HALF, Math.min(HALF, v));

export class RoadBuilder {
  constructor({ camera, renderer, graph, roadRenderer, gameState }) {
    this.camera       = camera;
    this.renderer     = renderer;
    this.graph        = graph;
    this.roadRenderer = roadRenderer;
    this.gameState    = gameState;

    this.active       = false;
    this.selectedType = 'asphalt';
    this.startNode    = null;

    this._ray         = new THREE.Raycaster();
    this._ground      = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._mouse       = new THREE.Vector2();
    this._snap        = null;
    this._mx          = 0;
    this._my          = 0;

    this._panel       = this._buildPanel();
    this._costTag     = this._buildCostTag();

    renderer.domElement.addEventListener('mousemove',   this._onMove.bind(this));
    renderer.domElement.addEventListener('click',       this._onClick.bind(this));
    renderer.domElement.addEventListener('contextmenu', this._onRight.bind(this));
    window.addEventListener('keydown',                  this._onKey.bind(this));
  }

  // ── public ──────────────────────────────────────────────────────────────

  get isActive() { return this.active; }

  activate() {
    this.active    = true;
    this.startNode = null;
    this._setBuildBtn(true);
    this._setLabel('Click to place road start point.');
  }

  deactivate() {
    this.active    = false;
    this.startNode = null;
    this.roadRenderer.clearPreview();
    this.roadRenderer.hideSnap();
    this._hideCost();
    this._setBuildBtn(false);
    this._setLabel('');
  }

  // ── private: event handlers ─────────────────────────────────────────────

  _onMove(e) {
    this._mx = e.clientX;
    this._my = e.clientY;
    if (!this.active) return;

    const pos = this._worldPos(e);
    if (!pos) return;
    this._snap = pos;
    this.roadRenderer.showSnap(pos.x, pos.z);

    if (this.startNode) {
      this.roadRenderer.showPreview(
        this.startNode.x, this.startNode.z,
        pos.x, pos.z,
        this.selectedType
      );
      const cost = this.graph.segmentCost(
        this.startNode.x, this.startNode.z,
        pos.x, pos.z,
        this.selectedType
      );
      this._showCost(cost);
    }
  }

  _onClick(e) {
    if (!this.active || !this._snap) return;
    const { x, z } = this._snap;

    if (!this.startNode) {
      this.startNode = { x, z };
      this._setLabel('Click to place end point. Right-click to cancel.');
      return;
    }

    const cost = this.graph.segmentCost(
      this.startNode.x, this.startNode.z,
      x, z,
      this.selectedType
    );

    if (cost > this.gameState.funds) {
      this._flash('Insufficient funds!', '#e74c3c');
      return;
    }

    const segment = this.graph.addSegment(
      this.startNode.x, this.startNode.z,
      x, z,
      this.selectedType
    );

    if (segment) {
      this.gameState.funds -= cost;
      this.gameState.onFundsChanged();
      this.roadRenderer.renderSegment(segment, this.graph);
      this.roadRenderer.clearPreview();
      // chain: end becomes new start
      this.startNode = { x, z };
      this._setLabel('Click to continue. Right-click to finish segment.');
    }
  }

  _onRight(e) {
    if (!this.active) return;
    e.preventDefault();
    e.stopPropagation();
    this._cancel();
  }

  _onKey(e) {
    if (!this.active) return;
    if (e.key === 'Escape') {
      if (this.startNode) this._cancel();
      else this.deactivate();
    }
  }

  _cancel() {
    this.startNode = null;
    this.roadRenderer.clearPreview();
    this._hideCost();
    this._setLabel('Click to place road start point.');
  }

  // ── private: helpers ────────────────────────────────────────────────────

  _worldPos(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this._ray.setFromCamera(this._mouse, this.camera);
    const hit = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._ground, hit)) return null;
    return { x: clamp(snap(hit.x)), z: clamp(snap(hit.z)) };
  }

  // ── private: UI builders ─────────────────────────────────────────────────

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; height: 56px;
      background: rgba(10,10,10,0.82); backdrop-filter: blur(4px);
      display: flex; align-items: center; padding: 0 14px; gap: 6px;
      font-family: monospace; color: #fff; z-index: 10;
      border-top: 1px solid #333;
    `;

    // Road type buttons
    for (const [key, type] of Object.entries(ROAD_TYPES)) {
      const btn = document.createElement('button');
      btn.textContent  = type.name;
      btn.dataset.type = key;
      btn.title        = type.description;
      btn.style.cssText = `
        padding: 5px 10px; border-radius: 4px; cursor: pointer;
        font-family: monospace; font-size: 11px; border: 1px solid #555;
        background: ${key === this.selectedType ? '#1a6fa8' : '#222'};
        color: #eee; transition: background 0.15s;
      `;
      btn.addEventListener('click', () => this._pickType(key));
      panel.appendChild(btn);
    }

    // Divider
    const div = document.createElement('div');
    div.style.cssText = 'width:1px; height:32px; background:#444; margin:0 8px; flex-shrink:0';
    panel.appendChild(div);

    // Build button
    const buildBtn = document.createElement('button');
    buildBtn.id = 'mc-build-btn';
    buildBtn.textContent = 'Build Road';
    buildBtn.style.cssText = `
      padding: 6px 14px; border-radius: 4px; cursor: pointer; flex-shrink: 0;
      font-family: monospace; font-size: 12px; font-weight: bold;
      border: none; background: #27ae60; color: #fff;
    `;
    buildBtn.addEventListener('click', () => {
      if (this.active) this.deactivate();
      else this.activate();
    });
    panel.appendChild(buildBtn);

    // Mode label
    const label = document.createElement('div');
    label.id = 'mc-mode-label';
    label.style.cssText = 'font-size:11px; color:#888; margin-left:12px; flex:1; white-space:nowrap; overflow:hidden;';
    panel.appendChild(label);

    // Funds
    const funds = document.createElement('div');
    funds.id = 'mc-funds';
    funds.style.cssText = 'font-size:14px; color:#2ecc71; font-weight:bold; margin-left:auto; flex-shrink:0;';
    panel.appendChild(funds);

    this.gameState.onFundsChanged = () => {
      funds.textContent = `$${this.gameState.funds.toLocaleString()}`;
    };
    this.gameState.onFundsChanged();

    document.body.appendChild(panel);
    return panel;
  }

  _buildCostTag() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: fixed; background: rgba(0,0,0,0.75); color: #fff;
      padding: 3px 8px; border-radius: 4px; font: 12px monospace;
      pointer-events: none; display: none; z-index: 20;
    `;
    document.body.appendChild(el);
    return el;
  }

  _showCost(cost) {
    const ok = cost <= this.gameState.funds;
    this._costTag.textContent     = `$${cost.toLocaleString()}`;
    this._costTag.style.color     = ok ? '#2ecc71' : '#e74c3c';
    this._costTag.style.display   = 'block';
    this._costTag.style.left      = (this._mx + 14) + 'px';
    this._costTag.style.top       = (this._my - 28) + 'px';
  }

  _hideCost() { this._costTag.style.display = 'none'; }

  _flash(msg, bg = '#e74c3c') {
    const el = document.createElement('div');
    el.textContent   = msg;
    el.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:${bg}; color:#fff; padding:10px 22px; border-radius:6px;
      font:bold 15px monospace; z-index:100; pointer-events:none;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  _pickType(key) {
    this.selectedType = key;
    this._panel.querySelectorAll('button[data-type]').forEach(b => {
      b.style.background = b.dataset.type === key ? '#1a6fa8' : '#222';
    });
  }

  _setBuildBtn(active) {
    const btn = this._panel.querySelector('#mc-build-btn');
    btn.textContent      = active ? 'Done (Esc)' : 'Build Road';
    btn.style.background = active ? '#c0392b'    : '#27ae60';
  }

  _setLabel(text) {
    const el = this._panel.querySelector('#mc-mode-label');
    if (el) el.textContent = text;
  }
}