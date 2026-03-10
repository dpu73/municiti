import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from '../world/roads.js';

const GRID = 10;
const HALF = 50;

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
    this.curved       = false;  // curved corners toggle
    this.startNode    = null;

    this._ray    = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._mouse  = new THREE.Vector2();
    this._snap   = null;
    this._mx     = 0;
    this._my     = 0;

    this._panel  = this._buildPanel();
    this._costTag = this._buildCostTag();

    renderer.domElement.addEventListener('mousemove',   this._onMove.bind(this));
    renderer.domElement.addEventListener('click',       this._onClick.bind(this));
    renderer.domElement.addEventListener('contextmenu', this._onRight.bind(this));
    window.addEventListener('keydown',                  this._onKey.bind(this));
  }

  // ── public ───────────────────────────────────────────────────────────────

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

  // ── routing ───────────────────────────────────────────────────────────────

  // Given start and current mouse position, compute the routed end + corner
  _route(sx, sz, ex, ez) {
    const dx = Math.abs(ex - sx);
    const dz = Math.abs(ez - sz);
    const straight = dx < 2 || dz < 2; // close enough to axis-aligned

    if (straight) {
      // Pure straight — lock to dominant axis
      if (dx >= dz) return { end: { x: ex, z: sz }, corner: null };
      else          return { end: { x: sx, z: ez }, corner: null };
    }

    // L-turn: corner at (ex, sz)
    const corner = { x: ex, z: sz };
    return { end: { x: ex, z: ez }, corner };
  }

  // ── event handlers ───────────────────────────────────────────────────────

  _onMove(e) {
    this._mx = e.clientX;
    this._my = e.clientY;
    if (!this.active) return;

    const raw = this._worldPosRaw(e);
    if (!raw) return;

    if (!this.startNode) {
      this._snap = { x: clamp(snap(raw.x)), z: clamp(snap(raw.z)) };
      this.roadRenderer.showSnap(this._snap.x, this._snap.z);
      return;
    }

    const { end, corner } = this._route(
      this.startNode.x, this.startNode.z,
      clamp(snap(raw.x)), clamp(snap(raw.z))
    );
    this._snap = end;
    this.roadRenderer.showSnap(end.x, end.z);

    const cp = (corner && this.curved) ? corner : null;

    if (corner && !this.curved) {
      // Sharp L: preview two segments
      this.roadRenderer.showPreview(
        this.startNode.x, this.startNode.z,
        corner.x, corner.z,
        this.selectedType, null
      );
      // Second segment previewed as a separate call isn't possible with single preview slot
      // We'll handle this visually by drawing start→end with corner as control point at opacity
    } else {
      this.roadRenderer.showPreview(
        this.startNode.x, this.startNode.z,
        end.x, end.z,
        this.selectedType, cp
      );
    }

    const cost = corner
      ? this.graph.segmentCost(this.startNode.x, this.startNode.z, corner.x, corner.z, this.selectedType) +
        this.graph.segmentCost(corner.x, corner.z, end.x, end.z, this.selectedType)
      : this.graph.segmentCost(this.startNode.x, this.startNode.z, end.x, end.z, this.selectedType, cp);
    this._showCost(cost);
  }

  _onClick(e) {
    if (!this.active || !this._snap) return;

    if (!this.startNode) {
      this.startNode = { x: this._snap.x, z: this._snap.z };
      this._setLabel('Click to place end point · Right-click to cancel · Tab = toggle curve');
      return;
    }

    const raw = this._worldPosRaw(e);
    if (!raw) return;
    const { end, corner } = this._route(
      this.startNode.x, this.startNode.z,
      clamp(snap(raw.x)), clamp(snap(raw.z))
    );
    const cp = (corner && this.curved) ? corner : null;

    // Total cost
    let cost = 0;
    if (corner && !this.curved) {
      cost = this.graph.segmentCost(this.startNode.x, this.startNode.z, corner.x, corner.z, this.selectedType) +
             this.graph.segmentCost(corner.x, corner.z, end.x, end.z, this.selectedType);
    } else {
      cost = this.graph.segmentCost(this.startNode.x, this.startNode.z, end.x, end.z, this.selectedType, cp);
    }

    if (cost > this.gameState.funds) {
      this._flash('Insufficient funds!', '#e74c3c');
      return;
    }

    this.gameState.funds -= cost;
    this.gameState.onFundsChanged();
    this.roadRenderer.clearPreview();

    if (corner && !this.curved) {
      // Two straight segments
      const s1 = this.graph.addSegment(this.startNode.x, this.startNode.z, corner.x, corner.z, this.selectedType);
      const s2 = this.graph.addSegment(corner.x, corner.z, end.x, end.z, this.selectedType);
      if (s1) this.roadRenderer.renderSegment(s1, this.graph);
      if (s2) this.roadRenderer.renderSegment(s2, this.graph);
    } else {
      const s = this.graph.addSegment(
        this.startNode.x, this.startNode.z,
        end.x, end.z,
        this.selectedType, cp
      );
      if (s) this.roadRenderer.renderSegment(s, this.graph);
    }

    // Chain: end becomes new start
    this.startNode = { x: end.x, z: end.z };
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
    if (e.key === 'Tab') {
      e.preventDefault();
      this.curved = !this.curved;
      this._updateCurveBtn();
    }
  }

  _cancel() {
    this.startNode = null;
    this.roadRenderer.clearPreview();
    this._hideCost();
    this._setLabel('Click to place road start point.');
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  _worldPosRaw(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this._ray.setFromCamera(this._mouse, this.camera);
    const hit = new THREE.Vector3();
    if (!this._ray.ray.intersectPlane(this._ground, hit)) return null;
    return { x: hit.x, z: hit.z };
  }

  // ── UI builders ──────────────────────────────────────────────────────────

  _buildPanel() {
    const panel = document.createElement('div');
    panel.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; height:56px;
      background:rgba(10,10,10,0.85); backdrop-filter:blur(4px);
      display:flex; align-items:center; padding:0 14px; gap:6px;
      font-family:monospace; color:#fff; z-index:10;
      border-top:1px solid #333;
    `;

    // Road type buttons
    for (const [key, type] of Object.entries(ROAD_TYPES)) {
      const btn = document.createElement('button');
      btn.textContent  = type.name;
      btn.dataset.type = key;
      btn.title        = type.description;
      btn.style.cssText = `
        padding:5px 10px; border-radius:4px; cursor:pointer;
        font-family:monospace; font-size:11px; border:1px solid #555;
        background:${key === this.selectedType ? '#1a6fa8' : '#222'};
        color:#eee;
      `;
      btn.addEventListener('click', () => this._pickType(key));
      panel.appendChild(btn);
    }

    // Divider
    const div1 = document.createElement('div');
    div1.style.cssText = 'width:1px;height:32px;background:#444;margin:0 6px;flex-shrink:0';
    panel.appendChild(div1);

    // Curve toggle
    const curveBtn = document.createElement('button');
    curveBtn.id = 'mc-curve-btn';
    curveBtn.textContent = 'Straight';
    curveBtn.title = 'Tab to toggle';
    curveBtn.style.cssText = `
      padding:5px 10px; border-radius:4px; cursor:pointer;
      font-family:monospace; font-size:11px; border:1px solid #555;
      background:#222; color:#eee; flex-shrink:0;
    `;
    curveBtn.addEventListener('click', () => {
      this.curved = !this.curved;
      this._updateCurveBtn();
    });
    panel.appendChild(curveBtn);

    // Divider
    const div2 = document.createElement('div');
    div2.style.cssText = 'width:1px;height:32px;background:#444;margin:0 6px;flex-shrink:0';
    panel.appendChild(div2);

    // Build button
    const buildBtn = document.createElement('button');
    buildBtn.id = 'mc-build-btn';
    buildBtn.textContent = 'Build Road';
    buildBtn.style.cssText = `
      padding:6px 14px; border-radius:4px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:12px; font-weight:bold;
      border:none; background:#27ae60; color:#fff;
    `;
    buildBtn.addEventListener('click', () => {
      if (this.active) this.deactivate();
      else this.activate();
    });
    panel.appendChild(buildBtn);

    // Mode label
    const label = document.createElement('div');
    label.id = 'mc-mode-label';
    label.style.cssText = 'font-size:11px;color:#888;margin-left:12px;flex:1;white-space:nowrap;overflow:hidden;';
    panel.appendChild(label);

    // Funds
    const funds = document.createElement('div');
    funds.id = 'mc-funds';
    funds.style.cssText = 'font-size:14px;color:#2ecc71;font-weight:bold;margin-left:auto;flex-shrink:0;';
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
      position:fixed; background:rgba(0,0,0,0.75); color:#fff;
      padding:3px 8px; border-radius:4px; font:12px monospace;
      pointer-events:none; display:none; z-index:20;
    `;
    document.body.appendChild(el);
    return el;
  }

  _showCost(cost) {
    const ok = cost <= this.gameState.funds;
    this._costTag.textContent   = `$${cost.toLocaleString()}`;
    this._costTag.style.color   = ok ? '#2ecc71' : '#e74c3c';
    this._costTag.style.display = 'block';
    this._costTag.style.left    = (this._mx + 14) + 'px';
    this._costTag.style.top     = (this._my - 28) + 'px';
  }

  _hideCost() { this._costTag.style.display = 'none'; }

  _flash(msg, bg = '#e74c3c') {
    const el = document.createElement('div');
    el.textContent = msg;
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

  _updateCurveBtn() {
    const btn = this._panel.querySelector('#mc-curve-btn');
    btn.textContent      = this.curved ? 'Curved' : 'Straight';
    btn.style.background = this.curved ? '#7d3c98' : '#222';
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