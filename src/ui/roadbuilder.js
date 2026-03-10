import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from '../world/roads.js';

const GRID = 10;
const HALF = 50;

const snap  = v => Math.round(v / GRID) * GRID;
const clamp = v => Math.max(-HALF, Math.min(HALF, v));

export class RoadBuilder {
  constructor({ camera, renderer, graph, roadRenderer, gameState, unlocks }) {
    this.camera       = camera;
    this.renderer     = renderer;
    this.graph        = graph;
    this.roadRenderer = roadRenderer;
    this.gameState    = gameState;
    this.unlocks      = unlocks;

    this.active       = false;
    this.selectedType = 'dirt';
    this.curved       = false;
    this.startNode    = null;

    this._ray    = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._mouse  = new THREE.Vector2();
    this._snap   = null;
    this._mx     = 0;
    this._my     = 0;

    this._toolbar   = this._buildToolbar();
    this._picker    = this._buildPicker();
    this._costTag   = this._buildCostTag();

    // Refresh picker when unlocks change
    this.gameState.onUnlockChanged = () => this._refreshPicker();

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
    this._hidePicker();
  }

  // ── routing ───────────────────────────────────────────────────────────────

  _route(sx, sz, ex, ez) {
    const dx = Math.abs(ex - sx);
    const dz = Math.abs(ez - sz);
    if (dx < 2 || dz < 2) {
      if (dx >= dz) return { end: { x: ex, z: sz }, corner: null };
      else          return { end: { x: sx, z: ez }, corner: null };
    }
    return { end: { x: ex, z: ez }, corner: { x: ex, z: sz } };
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

    this.roadRenderer.showPreview(
      this.startNode.x, this.startNode.z,
      end.x, end.z,
      this.selectedType, cp
    );

    const cost = corner && !this.curved
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

    let cost = corner && !this.curved
      ? this.graph.segmentCost(this.startNode.x, this.startNode.z, corner.x, corner.z, this.selectedType) +
        this.graph.segmentCost(corner.x, corner.z, end.x, end.z, this.selectedType)
      : this.graph.segmentCost(this.startNode.x, this.startNode.z, end.x, end.z, this.selectedType, cp);

    if (cost > this.gameState.funds) {
      this._flash('Insufficient funds!', '#e74c3c');
      return;
    }

    this.gameState.funds -= cost;
    this.gameState.onFundsChanged();
    this.gameState.stats.roadSegmentsBuilt =
      (this.gameState.stats.roadSegmentsBuilt || 0) + 1;

    this.roadRenderer.clearPreview();

    if (corner && !this.curved) {
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

    this.startNode = { x: end.x, z: end.z };

    // Check achievements after every build action
    this.unlocks.advanceYear(this.gameState.year);
  }

  _onRight(e) {
    if (!this.active) return;
    e.preventDefault();
    e.stopPropagation();
    this._cancel();
  }

  _onKey(e) {
    if (e.key === 'Escape') {
      if (this.active) {
        if (this.startNode) this._cancel();
        else this.deactivate();
      }
    }
    if (e.key === 'Tab' && this.active) {
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

  // ── UI: toolbar ──────────────────────────────────────────────────────────

  _buildToolbar() {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position:fixed; bottom:0; left:0; right:0; height:52px;
      background:rgba(10,10,10,0.88); backdrop-filter:blur(4px);
      display:flex; align-items:center; padding:0 14px; gap:8px;
      font-family:monospace; color:#fff; z-index:10;
      border-top:1px solid #333;
    `;

    // Build Road button
    const buildBtn = document.createElement('button');
    buildBtn.id = 'mc-build-btn';
    buildBtn.textContent = '🏗 Build Road';
    buildBtn.style.cssText = `
      padding:6px 16px; border-radius:4px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:12px; font-weight:bold;
      border:none; background:#27ae60; color:#fff;
    `;
    buildBtn.addEventListener('click', () => {
      if (this.active) {
        this.deactivate();
      } else {
        this._showPicker();
      }
    });
    bar.appendChild(buildBtn);

    // Selected type indicator
    const typeLabel = document.createElement('div');
    typeLabel.id = 'mc-type-label';
    typeLabel.style.cssText = 'font-size:11px; color:#888; flex-shrink:0;';
    bar.appendChild(typeLabel);

    // Curve toggle (only visible when active)
    const curveBtn = document.createElement('button');
    curveBtn.id = 'mc-curve-btn';
    curveBtn.textContent = 'Straight';
    curveBtn.title = 'Tab to toggle';
    curveBtn.style.cssText = `
      padding:5px 10px; border-radius:4px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:11px; border:1px solid #555;
      background:#222; color:#eee; display:none;
    `;
    curveBtn.addEventListener('click', () => {
      this.curved = !this.curved;
      this._updateCurveBtn();
    });
    bar.appendChild(curveBtn);

    // Mode label
    const modeLabel = document.createElement('div');
    modeLabel.id = 'mc-mode-label';
    modeLabel.style.cssText = 'font-size:11px; color:#aaa; flex:1; white-space:nowrap; overflow:hidden;';
    bar.appendChild(modeLabel);

    // Funds
    const funds = document.createElement('div');
    funds.id = 'mc-funds';
    funds.style.cssText = 'font-size:14px; color:#2ecc71; font-weight:bold; margin-left:auto; flex-shrink:0;';
    bar.appendChild(funds);

    // Year
    const year = document.createElement('div');
    year.id = 'mc-year';
    year.style.cssText = 'font-size:11px; color:#888; margin-left:16px; flex-shrink:0;';
    year.textContent = 'Year 0';
    bar.appendChild(year);

    this.gameState.onFundsChanged = () => {
      funds.textContent = `$${this.gameState.funds.toLocaleString()}`;
    };
    this.gameState.onFundsChanged();

    document.body.appendChild(bar);
    return bar;
  }

  // ── UI: road picker panel ────────────────────────────────────────────────

  _buildPicker() {
    const panel = document.createElement('div');
    panel.id = 'mc-picker';
    panel.style.cssText = `
      position:fixed; bottom:52px; left:0; right:0;
      background:rgba(8,8,8,0.93); backdrop-filter:blur(6px);
      border-top:1px solid #333; padding:14px 16px;
      font-family:monospace; color:#fff; z-index:9;
      display:none; flex-wrap:wrap; gap:10px;
    `;
    document.body.appendChild(panel);
    this._refreshPicker();
    return panel;
  }

  _refreshPicker() {
    const panel = document.getElementById('mc-picker');
    if (!panel) return;
    panel.innerHTML = '';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'width:100%; font-size:11px; color:#666; margin-bottom:4px; letter-spacing:1px;';
    hdr.textContent = 'SELECT ROAD TYPE';
    panel.appendChild(hdr);

    for (const [key, type] of Object.entries(ROAD_TYPES)) {
      const unlockKey  = `road_${key}`;
      const unlockData = this.unlocks.get(unlockKey);
      const state      = unlockData?.state ?? 'unlocked';
      const isSelected = key === this.selectedType;

      const card = document.createElement('div');
      card.style.cssText = `
        display:flex; align-items:center; gap:10px;
        padding:8px 12px; border-radius:6px; cursor:pointer; min-width:200px;
        border:1px solid ${isSelected ? '#1a6fa8' : '#333'};
        background:${isSelected ? '#0d2f45' : state === 'locked' ? '#111' : '#1a1a1a'};
        opacity:${state === 'locked' ? '0.5' : '1'};
        flex:1; max-width:260px;
      `;

      // Color swatch
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width:28px; height:28px; border-radius:3px; flex-shrink:0;
        background:#${type.color.toString(16).padStart(6,'0')};
        border:1px solid #444;
      `;
      card.appendChild(swatch);

      // Info
      const info = document.createElement('div');
      info.style.cssText = 'flex:1; min-width:0;';
      info.innerHTML = `
        <div style="font-size:13px; font-weight:bold; color:${state === 'locked' ? '#555' : '#eee'}">
          ${type.name}
        </div>
        <div style="font-size:10px; color:#666; margin-top:1px;">
          ${type.lanes} lane${type.lanes > 1 ? 's' : ''} · ${type.speedLimit}mph · $${type.costPerUnit}/unit
        </div>
      `;
      card.appendChild(info);

      // State badge
      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:10px; flex-shrink:0; text-align:right;';

      if (state === 'unlocked') {
        badge.style.color = isSelected ? '#5dade2' : '#555';
        badge.textContent = isSelected ? '✓ selected' : 'unlocked';
      } else if (state === 'available') {
        badge.innerHTML = `
          <div style="color:#f39c12; margin-bottom:3px;">available</div>
          <button style="
            padding:3px 8px; border-radius:3px; border:none; cursor:pointer;
            background:#e67e22; color:#fff; font:bold 10px monospace;
          ">Unlock $${unlockData.purchaseCost.toLocaleString()}</button>
        `;
        badge.querySelector('button').addEventListener('click', e => {
          e.stopPropagation();
          const result = this.unlocks.purchase(unlockKey);
          if (!result.ok) this._flash(result.reason, '#c0392b');
          else this._flash(`${type.name} unlocked!`, '#27ae60');
        });
      } else {
        const yr = unlockData?.countyYear ?? '?';
        const ach = unlockData?.achievement?.description;
        badge.style.color = '#444';
        badge.innerHTML = `
          <div>🔒 Year ${yr}</div>
          ${ach ? `<div style="font-size:9px; color:#3a3a3a; margin-top:2px;">${ach}</div>` : ''}
        `;
      }

      card.appendChild(badge);

      if (state === 'unlocked') {
        card.addEventListener('click', () => {
          this._pickType(key);
          this._hidePicker();
          this.activate();
        });
      }

      panel.appendChild(card);
    }
  }

  _showPicker() {
    this._refreshPicker();
    const panel = document.getElementById('mc-picker');
    panel.style.display = 'flex';
  }

  _hidePicker() {
    const panel = document.getElementById('mc-picker');
    if (panel) panel.style.display = 'none';
  }

  // ── UI: helpers ──────────────────────────────────────────────────────────

  _buildCostTag() {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; background:rgba(0,0,0,0.78); color:#fff;
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
    const label = document.getElementById('mc-type-label');
    if (label) label.textContent = `· ${ROAD_TYPES[key].name}`;
  }

  _updateCurveBtn() {
    const btn = document.getElementById('mc-curve-btn');
    if (!btn) return;
    btn.textContent      = this.curved ? 'Curved' : 'Straight';
    btn.style.background = this.curved ? '#7d3c98' : '#222';
  }

  _setBuildBtn(active) {
    const btn = document.getElementById('mc-build-btn');
    if (!btn) return;
    btn.textContent      = active ? '✕ Done (Esc)' : '🏗 Build Road';
    btn.style.background = active ? '#c0392b' : '#27ae60';
    const curveBtn = document.getElementById('mc-curve-btn');
    if (curveBtn) curveBtn.style.display = active ? 'block' : 'none';
  }

  _setLabel(text) {
    const el = document.getElementById('mc-mode-label');
    if (el) el.textContent = text;
  }
}