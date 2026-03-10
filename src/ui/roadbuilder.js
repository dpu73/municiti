import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';
import { ROAD_TYPES } from '../world/roads.js';

const GRID = 10;
const HALF = 50;
const snap  = v => Math.round(v / GRID) * GRID;
const clamp = v => Math.max(-HALF, Math.min(HALF, v));

export class RoadBuilder {
  constructor({ camera, renderer, graph, roadRenderer, gameState, unlocks, toolbar }) {
    this.camera       = camera;
    this.renderer     = renderer;
    this.graph        = graph;
    this.roadRenderer = roadRenderer;
    this.gameState    = gameState;
    this.unlocks      = unlocks;
    this.toolbar      = toolbar;

    this.active        = false;
    this.subMode       = 'build';
    this.selectedType  = 'dirt';
    this.startNode     = null;
    this._exitDir      = null; // {dx, dz} normalized exit direction of last segment

    this._ray    = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._mouse  = new THREE.Vector2();
    this._snap   = null;
    this._mx     = 0;
    this._my     = 0;

    this._toolBtn = toolbar.addTool('road', '🛣 Roads', 'Build and edit roads', () => this._onToolClick());
    toolbar.addSeparator();

    this._context = toolbar.getContextArea();
    this._costTag = this._buildCostTag();
    this._picker  = this._buildPicker();
    toolbar.attachPicker(this._picker);

    gameState.onUnlockChanged = () => this._refreshPicker();

    renderer.domElement.addEventListener('mousemove',   this._onMove.bind(this));
    renderer.domElement.addEventListener('click',       this._onClick.bind(this));
    renderer.domElement.addEventListener('contextmenu', this._onRight.bind(this));
    window.addEventListener('keydown',                  this._onKey.bind(this));
  }

  get isPlacing() { return this.active && this.subMode === 'build' && this.startNode !== null; }
  get isActive()  { return this.active; }

  // ── routing ───────────────────────────────────────────────────────────────
  // Returns array of { ax, az, bx, bz, cp? }

  _route(sx, sz, ex, ez) {
    const adx = Math.abs(ex - sx);
    const adz = Math.abs(ez - sz);
    const minR = ROAD_TYPES[this.selectedType].minTurnRadius;

    // Pure straight (nearly axis-aligned)
    if (adx < 2) return [{ ax: sx, az: sz, bx: sx, bz: ez }];
    if (adz < 2) return [{ ax: sx, az: sz, bx: ex, bz: sz }];

    // If we have an exit direction from the previous segment, use it
    // to create a smooth tangent-continuous curve
    if (this._exitDir) {
      const { dx: edx, dz: edz } = this._exitDir;
      // Control point: project along exit direction far enough
      // to reach roughly halfway to the end point
      const dist = Math.sqrt(adx*adx + adz*adz) * 0.5;
      const cp = {
        x: sx + edx * dist,
        z: sz + edz * dist,
      };
      return [{ ax: sx, az: sz, bx: ex, bz: ez, cp }];
    }

    // No exit direction — standard L-turn
    const corner = { x: ex, z: sz };
    const leg1   = adx;
    const leg2   = adz;

    if (leg1 >= minR && leg2 >= minR) {
      // Both legs long enough — smooth bezier through corner
      return [{ ax: sx, az: sz, bx: ex, bz: ez, cp: corner }];
    }

    // Too tight — two straight segments
    return [
      { ax: sx, az: sz, bx: corner.x, bz: corner.z },
      { ax: corner.x, az: corner.z, bx: ex, bz: ez },
    ];
  }

  // Compute exit direction of a segment at its B end
  _segExitDir(seg) {
    const a = this.graph.nodes.get(seg.nodeAId);
    const b = this.graph.nodes.get(seg.nodeBId);
    if (!a || !b) return null;

    if (seg.controlPoint) {
      // Bezier exit tangent at t=1: direction from control point to B
      const dx = b.x - seg.controlPoint.x;
      const dz = b.z - seg.controlPoint.z;
      const len = Math.sqrt(dx*dx + dz*dz) || 1;
      return { dx: dx/len, dz: dz/len };
    }

    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.sqrt(dx*dx + dz*dz) || 1;
    return { dx: dx/len, dz: dz/len };
  }

  // ── events ────────────────────────────────────────────────────────────────

  _onMove(e) {
    this._mx = e.clientX;
    this._my = e.clientY;
    if (!this.active) return;

    if (this.subMode === 'delete') {
      const id = this.roadRenderer.getSegmentAtMouse(e, this.camera);
      if (id !== null) this.roadRenderer.highlightSegment(id);
      else this.roadRenderer.clearHighlight();
      return;
    }

    const raw = this._rawWorldPos(e);
    if (!raw) return;
    this._snap = { x: clamp(snap(raw.x)), z: clamp(snap(raw.z)) };
    this.roadRenderer.showSnap(this._snap.x, this._snap.z);

    if (!this.startNode) return;

    const segs = this._route(
      this.startNode.x, this.startNode.z,
      this._snap.x, this._snap.z
    );

    this.roadRenderer.clearPreview();
    for (const s of segs) {
      this.roadRenderer.showPreview(s.ax, s.az, s.bx, s.bz, this.selectedType, s.cp ?? null);
    }

    let cost = 0;
    for (const s of segs) {
      cost += this.graph.segmentCost(s.ax, s.az, s.bx, s.bz, this.selectedType, s.cp ?? null);
    }
    const tooTight = segs.length > 1 && !segs[0].cp;
    this._showCost(cost, tooTight);
  }

  _onClick(e) {
    if (!this.active) return;

    if (this.subMode === 'delete') {
      const id = this.roadRenderer.getSegmentAtMouse(e, this.camera);
      if (id !== null) {
        this.roadRenderer.clearHighlight();
        this.roadRenderer.removeSegment(id);
        this.graph.removeSegment(id);
      }
      return;
    }

    if (!this._snap) return;

    if (!this.startNode) {
      this.startNode = { x: this._snap.x, z: this._snap.z };
      this._exitDir  = null;
      this._setHint('Click end point · Right-click cancel · Esc exit');
      return;
    }

    const segs = this._route(
      this.startNode.x, this.startNode.z,
      this._snap.x, this._snap.z
    );

    let cost = 0;
    for (const s of segs) {
      cost += this.graph.segmentCost(s.ax, s.az, s.bx, s.bz, this.selectedType, s.cp ?? null);
    }

    if (cost > this.gameState.funds) { this._flash('Insufficient funds!', '#c0392b'); return; }

    this.gameState.funds -= cost;
    this.gameState.onFundsChanged();
    this.gameState.stats.roadSegmentsBuilt =
      (this.gameState.stats.roadSegmentsBuilt || 0) + segs.length;

    this.roadRenderer.clearPreview();

    let lastSeg = null;
    for (const s of segs) {
      const seg = this.graph.addSegment(s.ax, s.az, s.bx, s.bz, this.selectedType, s.cp ?? null);
      if (seg) { this.roadRenderer.renderSegment(seg, this.graph); lastSeg = seg; }
    }

    // Chain: end becomes new start, carry exit direction for smooth continuation
    const lastRouted = segs[segs.length - 1];
    this.startNode = { x: lastRouted.bx, z: lastRouted.bz };
    this._exitDir  = lastSeg ? this._segExitDir(lastSeg) : null;

    this.unlocks.advanceYear(this.gameState.year);
  }

  _onRight(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.active) return;
    if (this.startNode) {
      this.startNode = null;
      this._exitDir  = null;
      this.roadRenderer.clearPreview();
      this._hideCost();
      this._setHint('Click start point · Esc exit');
    }
  }

  _onKey(e) {
    if (e.key === 'Escape') {
      if (!this.active) return;
      if (this.startNode) {
        this.startNode = null;
        this._exitDir  = null;
        this.roadRenderer.clearPreview();
        this._hideCost();
        this._setHint('Click start point · Esc exit');
      } else {
        this.deactivate();
      }
    }
  }

  // ── activate / deactivate ─────────────────────────────────────────────────

  _onToolClick() {
    if (this.active) { this.deactivate(); return; }
    this._showPicker();
  }

  activate(type) {
    if (type) this.selectedType = type;
    this.active    = true;
    this.subMode   = 'build';
    this.startNode = null;
    this._exitDir  = null;
    this.toolbar.setActive('road');
    this._hidePicker();
    this._injectContext();
    this._setHint('Click start point · Esc exit');
  }

  deactivate() {
    this.active    = false;
    this.startNode = null;
    this._exitDir  = null;
    this.roadRenderer.clearPreview();
    this.roadRenderer.hideSnap();
    this.roadRenderer.clearHighlight();
    this._hideCost();
    this._hidePicker();
    this._clearContext();
    this.toolbar.clearActive();
  }

  // ── context bar ───────────────────────────────────────────────────────────

  _injectContext() {
    this._clearContext();
    const ctx  = this._context;
    const type = ROAD_TYPES[this.selectedType];

    const swatch = document.createElement('div');
    swatch.style.cssText = `
      width:16px; height:16px; border-radius:2px; flex-shrink:0;
      background:#${type.color.toString(16).padStart(6,'0')}; border:1px solid #444;
    `;
    ctx.appendChild(swatch);

    const name = document.createElement('div');
    name.style.cssText = 'font-size:11px; color:#aaa; flex-shrink:0; font-family:monospace;';
    name.textContent = type.name;
    ctx.appendChild(name);

    const changeBtn = document.createElement('button');
    changeBtn.textContent = '▼ Change';
    changeBtn.style.cssText = `
      padding:3px 9px; border-radius:3px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:10px; border:1px solid #333;
      background:#1a1a1a; color:#888; margin-left:4px;
    `;
    changeBtn.addEventListener('click', () => {
      const visible = this._picker.style.display !== 'none';
      if (visible) this._hidePicker(); else this._showPicker();
    });
    ctx.appendChild(changeBtn);

    const sep = document.createElement('div');
    sep.style.cssText = 'width:1px; height:20px; background:#222; margin:0 8px;';
    ctx.appendChild(sep);

    for (const [mode, label, color] of [
      ['build',  '✏ Build',    '#27ae60'],
      ['delete', '🗑 Delete', '#c0392b'],
    ]) {
      const btn = document.createElement('button');
      btn.id = `road-mode-${mode}`;
      btn.textContent = label;
      btn.style.cssText = `
        padding:3px 10px; border-radius:3px; cursor:pointer; flex-shrink:0;
        font-family:monospace; font-size:10px; border:1px solid #333;
        background:${this.subMode === mode ? color : '#1a1a1a'};
        color:${this.subMode === mode ? '#fff' : '#888'};
      `;
      btn.addEventListener('click', () => {
        this.subMode   = mode;
        this.startNode = null;
        this._exitDir  = null;
        this.roadRenderer.clearPreview();
        this._refreshModeButtons();
        this._setHint(mode === 'build'
          ? 'Click start point · Esc exit'
          : 'Click a road segment to delete it · Esc exit');
      });
      ctx.appendChild(btn);
    }

    const hint = document.createElement('div');
    hint.id = 'road-hint';
    hint.style.cssText = 'font-size:10px; color:#555; margin-left:12px; font-family:monospace;';
    ctx.appendChild(hint);
  }

  _clearContext() { this._context.innerHTML = ''; }

  _refreshModeButtons() {
    for (const mode of ['build','delete']) {
      const btn = document.getElementById(`road-mode-${mode}`);
      if (!btn) continue;
      const on  = this.subMode === mode;
      btn.style.background = on ? (mode === 'build' ? '#27ae60' : '#c0392b') : '#1a1a1a';
      btn.style.color      = on ? '#fff' : '#888';
    }
  }

  _setHint(text) {
    const el = document.getElementById('road-hint');
    if (el) el.textContent = text;
  }

  // ── picker ────────────────────────────────────────────────────────────────

  _buildPicker() {
    const panel = document.createElement('div');
    panel.id = 'mc-road-picker';
    panel.style.cssText = `
      position:fixed; left:0; right:0;
      background:rgba(8,8,10,0.97); border-bottom:1px solid #222;
      padding:12px 14px; font-family:monospace; z-index:198; display:none;
      flex-wrap:wrap; gap:8px;
    `;
    document.body.appendChild(panel);
    this._refreshPicker();
    return panel;
  }

  _refreshPicker() {
    const panel = document.getElementById('mc-road-picker');
    if (!panel) return;
    panel.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.style.cssText = 'width:100%; font-size:9px; color:#3a3a3a; letter-spacing:1px; margin-bottom:4px;';
    hdr.textContent = 'SELECT ROAD TYPE';
    panel.appendChild(hdr);

    for (const [key, type] of Object.entries(ROAD_TYPES)) {
      const unlockKey  = `road_${key}`;
      const unlockData = this.unlocks.get(unlockKey);
      const state      = unlockData?.state ?? 'unlocked';
      const isSelected = key === this.selectedType;

      const card = document.createElement('div');
      card.style.cssText = `
        display:flex; align-items:center; gap:8px; padding:7px 11px;
        border-radius:5px; min-width:180px; flex:1; max-width:240px;
        border:1px solid ${isSelected ? '#1a5276' : '#1e1e1e'};
        background:${isSelected ? '#07192a' : state === 'locked' ? '#0a0a0a' : '#111'};
        opacity:${state === 'locked' ? '0.45' : '1'};
        cursor:${state === 'unlocked' ? 'pointer' : 'default'};
      `;

      const sw = document.createElement('div');
      sw.style.cssText = `
        width:24px; height:24px; border-radius:3px; flex-shrink:0;
        background:#${type.color.toString(16).padStart(6,'0')}; border:1px solid #333;
      `;
      card.appendChild(sw);

      const info = document.createElement('div');
      info.style.flex = '1';
      info.innerHTML = `
        <div style="font-size:12px;font-weight:bold;color:${state==='locked'?'#333':'#ccc'}">${type.name}</div>
        <div style="font-size:9px;color:#3a3a3a;margin-top:1px;">
          ${type.lanes} lane${type.lanes>1?'s':''} · ${type.speedLimit}mph · $${type.costPerUnit}/unit
        </div>
      `;
      card.appendChild(info);

      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:10px; text-align:right; flex-shrink:0;';

      if (state === 'unlocked') {
        badge.style.color = isSelected ? '#5dade2' : '#2a2a2a';
        badge.textContent = isSelected ? '✓' : '✓';
        card.addEventListener('click', () => this.activate(key));
      } else if (state === 'available') {
        const b = document.createElement('button');
        b.style.cssText = `
          padding:3px 7px; border-radius:3px; border:none; cursor:pointer;
          background:#784212; color:#f0b27a; font:bold 9px monospace;
        `;
        b.textContent = `Unlock $${unlockData.purchaseCost.toLocaleString()}`;
        b.addEventListener('click', ev => {
          ev.stopPropagation();
          const res = this.unlocks.purchase(unlockKey);
          if (!res.ok) this._flash(res.reason, '#c0392b');
          else this._flash(`${type.name} unlocked!`, '#27ae60');
        });
        badge.appendChild(b);
      } else {
        badge.style.color = '#2a2a2a';
        badge.innerHTML = `🔒 Yr ${unlockData?.countyYear ?? '?'}`;
        if (unlockData?.achievement) {
          badge.innerHTML += `<div style="font-size:8px;color:#222;margin-top:2px;">${unlockData.achievement.description}</div>`;
        }
      }

      card.appendChild(badge);
      panel.appendChild(card);
    }
  }

  _showPicker() {
    const p = document.getElementById('mc-road-picker');
    if (p) p.style.display = 'flex';
  }

  _hidePicker() {
    const p = document.getElementById('mc-road-picker');
    if (p) p.style.display = 'none';
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  _rawWorldPos(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this._mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this._ray.setFromCamera(this._mouse, this.camera);
    const hit = new THREE.Vector3();
    return this._ray.ray.intersectPlane(this._ground, hit) ? { x: hit.x, z: hit.z } : null;
  }

  _buildCostTag() {
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed; background:rgba(0,0,0,0.8); color:#fff;
      padding:3px 8px; border-radius:4px; font:11px monospace;
      pointer-events:none; display:none; z-index:300;
    `;
    document.body.appendChild(el);
    return el;
  }

  _showCost(cost, tooTight = false) {
    const ok = cost <= this.gameState.funds;
    this._costTag.innerHTML    = `$${cost.toLocaleString()}${tooTight ? '<br><span style="font-size:9px;color:#f39c12">sharp turn</span>' : ''}`;
    this._costTag.style.color  = ok ? '#2ecc71' : '#e74c3c';
    this._costTag.style.display = 'block';
    this._costTag.style.left   = (this._mx + 14) + 'px';
    this._costTag.style.top    = (this._my - 32) + 'px';
  }

  _hideCost() { this._costTag.style.display = 'none'; }

  _flash(msg, bg) {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:${bg}; color:#fff; padding:10px 22px; border-radius:6px;
      font:bold 14px monospace; z-index:500; pointer-events:none;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }
}