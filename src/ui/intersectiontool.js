import { INTERSECTION_UPGRADES } from '../world/intersections.js';
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.js';

export class IntersectionTool {
  constructor({ camera, renderer, intersectionSystem, gameState, toolbar, unlocks }) {
    this.camera             = camera;
    this.renderer           = renderer;
    this.intersectionSystem = intersectionSystem;
    this.gameState          = gameState;
    this.toolbar            = toolbar;
    this.unlocks            = unlocks;

    this.active        = false;
    this._panel        = null;
    this._selectedNode = null;
    this._dots         = [];  // visual indicators for intersection nodes
    this._dotGroup     = new THREE.Group();

    // Add dot group to scene via renderer — we'll get scene from intersectionSystem
    this.intersectionSystem.scene.add(this._dotGroup);

    this._toolBtn = toolbar.addTool(
      'intersection', '🚦 Intersections', 'Upgrade intersections',
      () => this._onToolClick()
    );
    toolbar.addSeparator();

    renderer.domElement.addEventListener('mousemove', this._onMove.bind(this));
    renderer.domElement.addEventListener('click',     this._onClick.bind(this));
    window.addEventListener('keydown',                this._onKey.bind(this));
  }

  get isActive() { return this.active; }

  activate() {
    this.active = true;
    this.toolbar.setActive('intersection');
    this._injectContext('Click a 🟡 intersection dot to upgrade it');
    this._buildPanel();
    this._showDots();
  }

  deactivate() {
    this.active = false;
    this.toolbar.clearActive();
    this._clearContext();
    this._hidePanel();
    this._hideDots();
    this._selectedNode = null;
    this.renderer.domElement.style.cursor = '';
  }

  // Called from main after road changes so dots stay current
  refresh() {
    if (this.active) this._showDots();
  }

  // ── dots ──────────────────────────────────────────────────────────────────

  _showDots() {
    this._hideDots();
    const nodes = this.intersectionSystem.getIntersectionNodes();

    for (const node of nodes) {
      const upgrade = this.intersectionSystem.getUpgrade(node.id);
      const color   = upgrade === 'none' ? 0xffdd00 : 0x5dade2;

      const dot = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 2, 0.5, 12),
        new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85 })
      );
      dot.position.set(node.x, 0.5, node.z);
      dot.userData.nodeId = node.id;
      this._dotGroup.add(dot);
      this._dots.push(dot);
    }

    if (nodes.length === 0) {
      this._injectContext('No intersections yet — build roads that cross or meet');
    } else {
      this._injectContext(`${nodes.length} intersection${nodes.length > 1 ? 's' : ''} found · Click a 🟡 dot to upgrade`);
    }
  }

  _hideDots() {
    for (const d of this._dots) this._dotGroup.remove(d);
    this._dots = [];
  }

  _refreshDots() {
    if (this.active) this._showDots();
  }

  // ── events ────────────────────────────────────────────────────────────────

  _onMove(e) {
    if (!this.active) return;
    const canvas = this.renderer.domElement;
    const node   = this.intersectionSystem.getNearestNode(e, this.camera, canvas, 15);
    canvas.style.cursor = node ? 'pointer' : '';
  }

  _onClick(e) {
    if (!this.active) return;
    const canvas = this.renderer.domElement;
    const node   = this.intersectionSystem.getNearestNode(e, this.camera, canvas, 15);
    if (!node) { this._hidePanel(); this._selectedNode = null; return; }
    this._selectedNode = node;
    this._showPanel(node);
  }

  _onKey(e) {
    if (e.key === 'Escape' && this.active) this.deactivate();
  }

  _onToolClick() {
    if (this.active) this.deactivate();
    else this.activate();
  }

  // ── panel ─────────────────────────────────────────────────────────────────

  _buildPanel() {
    if (this._panel) return;
    const panel = document.createElement('div');
    panel.id = 'mc-intersection-panel';
    panel.style.cssText = `
      position:fixed; top:84px; left:50%; transform:translateX(-50%);
      background:rgba(8,8,12,0.97); border:1px solid #222;
      font-family:monospace; color:#ccc; z-index:300;
      display:none; min-width:320px; border-radius:6px; overflow:hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(panel);
    this._panel = panel;
  }

  _showPanel(node) {
    if (!this._panel) this._buildPanel();
    const current = this.intersectionSystem.getUpgrade(node.id);
    const panel   = this._panel;
    panel.innerHTML = '';

    const hdr = document.createElement('div');
    hdr.style.cssText = `
      padding:8px 14px; background:rgba(20,20,30,0.95);
      border-bottom:1px solid #1e1e1e;
      display:flex; justify-content:space-between; align-items:center;
    `;
    hdr.innerHTML = `
      <span style="font-size:11px;font-weight:bold;color:#5dade2;letter-spacing:1px;">
        🚦 INTERSECTION UPGRADE
      </span>
      <span style="font-size:10px;color:#333;">
        ${node.segmentIds.length} roads meeting
      </span>
    `;
    panel.appendChild(hdr);

    const list = document.createElement('div');
    list.style.cssText = 'padding:8px;';

    for (const [key, info] of Object.entries(INTERSECTION_UPGRADES)) {
      const isCurrent  = key === current;
      const unlockKey  = info.unlockKey;
      const state      = unlockKey
        ? (this.unlocks.get(unlockKey)?.state ?? 'locked')
        : 'unlocked';
      const affordable = info.cost <= this.gameState.funds;

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; gap:10px; padding:7px 10px;
        border-radius:4px; margin-bottom:4px;
        border:1px solid ${isCurrent ? '#1a5276' : '#1e1e1e'};
        background:${isCurrent ? '#071929' : '#111'};
        opacity:${state === 'locked' ? '0.3' : '1'};
        cursor:${(!isCurrent && state !== 'locked' && affordable) ? 'pointer' : 'default'};
      `;

      const dot = document.createElement('div');
      dot.style.cssText = `
        width:12px; height:12px; border-radius:50%; flex-shrink:0;
        background:${info.color ? '#'+info.color.toString(16).padStart(6,'0') : '#2a2a2a'};
        border:1px solid #444;
      `;
      row.appendChild(dot);

      const inf = document.createElement('div');
      inf.style.flex = '1';
      inf.innerHTML = `
        <div style="font-size:12px;color:${isCurrent?'#5dade2':'#aaa'};
          font-weight:${isCurrent?'bold':'normal'}">
          ${info.name}${isCurrent ? ' ✓' : ''}
        </div>
        <div style="font-size:9px;color:#3a3a3a;margin-top:1px;">${info.description}</div>
      `;
      row.appendChild(inf);

      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:10px; text-align:right; flex-shrink:0; min-width:60px;';

      if (isCurrent) {
        badge.style.color = '#1a5276';
        badge.textContent = 'active';
      } else if (state === 'locked') {
        badge.style.color = '#222';
        badge.textContent = '🔒 locked';
      } else if (!affordable && info.cost > 0) {
        badge.style.color = '#5a1a1a';
        badge.textContent = `$${info.cost.toLocaleString()}`;
      } else {
        badge.style.color = info.cost === 0 ? '#2a4a2a' : '#2ecc71';
        badge.textContent = info.cost === 0 ? 'free' : `$${info.cost.toLocaleString()}`;
        row.addEventListener('click', () => {
          const result = this.intersectionSystem.applyUpgrade(key === current ? 'none' : key, node.id, this.gameState);
          if (result.ok) {
            this._flash(`${info.name} applied!`, '#27ae60');
            this._refreshDots();
            this._showPanel(node);
          } else {
            this._flash(result.reason, '#c0392b');
          }
        });
      }

      row.appendChild(badge);
      list.appendChild(row);
    }

    panel.appendChild(list);

    const close = document.createElement('div');
    close.style.cssText = `
      padding:7px; text-align:center; border-top:1px solid #1a1a1a;
      font-size:10px; color:#2a2a2a; cursor:pointer;
      hover: color: #555;
    `;
    close.textContent = '✕ close · Esc to exit tool';
    close.addEventListener('click', () => this._hidePanel());
    panel.appendChild(close);

    panel.style.display = 'block';
  }

  _hidePanel() {
    if (this._panel) this._panel.style.display = 'none';
  }

  // ── context ───────────────────────────────────────────────────────────────

  _injectContext(hint) {
    const ctx = this.toolbar.getContextArea();
    ctx.innerHTML = `
      <div style="font-size:10px;color:#555;font-family:monospace;padding:0 4px;">${hint}</div>
    `;
  }

  _clearContext() {
    this.toolbar.getContextArea().innerHTML = '';
  }

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