import { INTERSECTION_UPGRADES, UPGRADE_ORDER } from '../world/intersections.js';

export class IntersectionTool {
  constructor({ camera, renderer, intersectionSystem, gameState, toolbar, unlocks }) {
    this.camera              = camera;
    this.renderer            = renderer;
    this.intersectionSystem  = intersectionSystem;
    this.gameState           = gameState;
    this.toolbar             = toolbar;
    this.unlocks             = unlocks;

    this.active = false;
    this._panel = null;
    this._selectedNode = null;

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
    this._injectContext('Hover an intersection · Click to upgrade');
    this._buildPanel();
  }

  deactivate() {
    this.active = false;
    this.toolbar.clearActive();
    this._clearContext();
    this._hidePanel();
    this._selectedNode = null;
  }

  // ── events ────────────────────────────────────────────────────────────────

  _onMove(e) {
    if (!this.active) return;
    const canvas = this.renderer.domElement;
    const node   = this.intersectionSystem.getNearestNode(e, this.camera, canvas);
    if (node) {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = '';
    }
  }

  _onClick(e) {
    if (!this.active) return;
    const canvas = this.renderer.domElement;
    const node   = this.intersectionSystem.getNearestNode(e, this.camera, canvas);
    if (!node) { this._hidePanel(); this._selectedNode = null; return; }
    this._selectedNode = node;
    this._showPanel(node);
  }

  _onKey(e) {
    if (e.key === 'Escape' && this.active) this.deactivate();
  }

  // ── tool click ────────────────────────────────────────────────────────────

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
    `;
    document.body.appendChild(panel);
    this._panel = panel;
  }

  _showPanel(node) {
    if (!this._panel) this._buildPanel();
    const current = this.intersectionSystem.getUpgrade(node.id);
    const panel   = this._panel;
    panel.innerHTML = '';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = `
      padding:8px 14px; background:rgba(20,20,30,0.9);
      border-bottom:1px solid #1e1e1e;
      display:flex; justify-content:space-between; align-items:center;
    `;
    hdr.innerHTML = `
      <span style="font-size:11px;font-weight:bold;color:#5dade2;letter-spacing:1px;">
        INTERSECTION UPGRADE
      </span>
      <span style="font-size:10px;color:#333;">Node ${node.id}</span>
    `;
    panel.appendChild(hdr);

    // Upgrade options
    const list = document.createElement('div');
    list.style.cssText = 'padding:8px;';

    for (const [key, info] of Object.entries(INTERSECTION_UPGRADES)) {
      const isCurrent  = key === current;
      const unlockKey  = info.unlockKey;
      const state      = unlockKey ? (this.unlocks.get(unlockKey)?.state ?? 'locked') : 'unlocked';
      const affordable = info.cost <= this.gameState.funds;

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; gap:10px; padding:7px 10px;
        border-radius:4px; margin-bottom:4px; cursor:pointer;
        border:1px solid ${isCurrent ? '#1a5276' : '#1e1e1e'};
        background:${isCurrent ? '#071929' : '#111'};
        opacity:${state === 'locked' ? '0.35' : '1'};
      `;

      // Dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        width:12px; height:12px; border-radius:50%; flex-shrink:0;
        background:${info.color ? '#'+info.color.toString(16).padStart(6,'0') : '#333'};
        border:1px solid #444;
      `;
      row.appendChild(dot);

      // Info
      const inf = document.createElement('div');
      inf.style.flex = '1';
      inf.innerHTML = `
        <div style="font-size:12px;color:${isCurrent?'#5dade2':'#aaa'};font-weight:${isCurrent?'bold':'normal'}">
          ${info.name} ${isCurrent ? '✓' : ''}
        </div>
        <div style="font-size:9px;color:#444;margin-top:1px;">${info.description}</div>
      `;
      row.appendChild(inf);

      // Cost / state
      const badge = document.createElement('div');
      badge.style.cssText = 'font-size:10px; text-align:right; flex-shrink:0;';

      if (isCurrent) {
        badge.style.color = '#5dade2';
        badge.textContent = 'active';
      } else if (state === 'locked') {
        badge.style.color = '#2a2a2a';
        badge.textContent = '🔒 locked';
      } else if (!affordable && info.cost > 0) {
        badge.style.color = '#e74c3c';
        badge.textContent = `$${info.cost.toLocaleString()}`;
      } else {
        badge.style.color = info.cost === 0 ? '#555' : '#2ecc71';
        badge.textContent = info.cost === 0 ? 'free' : `$${info.cost.toLocaleString()}`;

        if (!isCurrent && state !== 'locked') {
          row.addEventListener('click', () => {
            const result = this.intersectionSystem.applyUpgrade(
              node.id, key, this.gameState
            );
            if (result.ok) {
              this._flash(`${info.name} applied!`, '#27ae60');
              this._showPanel(node); // refresh
            } else {
              this._flash(result.reason, '#c0392b');
            }
          });
        }
      }

      row.appendChild(badge);
      list.appendChild(row);
    }

    panel.appendChild(list);

    // Close button
    const close = document.createElement('div');
    close.style.cssText = `
      padding:6px; text-align:center; border-top:1px solid #1a1a1a;
      font-size:10px; color:#333; cursor:pointer;
    `;
    close.textContent = 'ESC to close';
    panel.appendChild(close);

    panel.style.display = 'block';
  }

  _hidePanel() {
    if (this._panel) this._panel.style.display = 'none';
  }

  // ── context bar ───────────────────────────────────────────────────────────

  _injectContext(hint) {
    const ctx = this.toolbar.getContextArea();
    ctx.innerHTML = `
      <div style="font-size:10px;color:#444;font-family:monospace;">${hint}</div>
    `;
  }

  _clearContext() {
    const ctx = this.toolbar.getContextArea();
    ctx.innerHTML = '';
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