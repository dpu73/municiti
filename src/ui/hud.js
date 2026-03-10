export class HUD {
  constructor(gameState) {
    this.gameState      = gameState;
    this._financeOpen   = false;
    this._bar           = this._build();
    this._financePanel  = this._buildFinance();
    this.update();
  }

  update() {
    const gs = this.gameState;
    const el = id => document.getElementById(id);
    const f  = el('hud-funds');
    const p  = el('hud-pop');
    const h  = el('hud-hap');
    const m  = el('hud-mode');
    const t  = el('hud-time');
    if (f) f.textContent = `💰 $${gs.funds.toLocaleString()}`;
    if (p) p.textContent = `👥 ${gs.stats.population.toLocaleString()}`;
    if (h) {
      const pct = gs.stats.happiness;
      const emoji = pct >= 80 ? '😊' : pct >= 50 ? '😐' : '😠';
      h.textContent  = `${emoji} ${pct}%`;
      h.style.color  = pct >= 80 ? '#2ecc71' : pct >= 50 ? '#f39c12' : '#e74c3c';
    }
    if (m) m.textContent = gs.mode === 'manager' ? '🏛 Manager' : '🚗 Streets';
    if (t) t.textContent = `Yr ${gs.year} · Mo ${gs.month}`;
  }

  _build() {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position:fixed; top:0; left:0; right:0; height:44px;
      background:rgba(8,8,8,0.97); backdrop-filter:blur(6px);
      display:flex; align-items:center; padding:0 10px; gap:0;
      font-family:monospace; color:#fff; z-index:200;
      border-bottom:1px solid #222; user-select:none;
    `;

    // Logo
    this._el(bar, 'div', 'MuniCity', `
      font-size:13px; font-weight:bold; color:#5dade2;
      padding:0 12px 0 2px; flex-shrink:0; letter-spacing:2px;
    `);
    bar.appendChild(this._sep());

    // Funds — clickable
    const funds = this._el(bar, 'div', '💰 $0', `
      font-size:13px; color:#2ecc71; font-weight:bold;
      padding:0 12px; cursor:pointer; border-radius:4px; flex-shrink:0;
    `);
    funds.id = 'hud-funds';
    funds.title = 'Finance';
    funds.addEventListener('mouseenter', () => funds.style.background = 'rgba(46,204,113,0.12)');
    funds.addEventListener('mouseleave', () => funds.style.background = '');
    funds.addEventListener('click', () => this._toggleFinance());

    // Population
    const pop = this._el(bar, 'div', '👥 0', `font-size:11px; color:#aaa; padding:0 10px; flex-shrink:0;`);
    pop.id = 'hud-pop';

    // Happiness
    const hap = this._el(bar, 'div', '😊 100%', `font-size:11px; color:#2ecc71; padding:0 10px; flex-shrink:0;`);
    hap.id = 'hud-hap';

    bar.appendChild(this._sep());

    // Mode toggle
    const modeBtn = this._el(bar, 'button', '🏛 Manager', `
      padding:4px 12px; border-radius:4px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:11px; font-weight:bold;
      border:1px solid #2471a3; background:#0a1e30; color:#5dade2; margin:0 6px;
    `);
    modeBtn.id = 'hud-mode';
    modeBtn.addEventListener('click', () => this.gameState.onToggleMode?.());

    bar.appendChild(this._sep());

    // Time
    const time = this._el(bar, 'div', 'Yr 0 · Mo 1', `font-size:11px; color:#555; padding:0 10px; flex-shrink:0;`);
    time.id = 'hud-time';

    // Skip buttons
    const skipMo = this._el(bar, 'button', '▶ Month', this._btnCss('#0d1a2a'));
    skipMo.addEventListener('click', () => this.gameState.onSkipMonth?.());

    const skipYr = this._el(bar, 'button', '⏭ Year', this._btnCss('#0d1a2a'));
    skipYr.addEventListener('click', () => this.gameState.onSkipYear?.());

    bar.appendChild(this._sep());

    // Camera controls
    this._el(bar, 'div', 'CAM', `font-size:9px; color:#3a3a3a; padding:0 4px; flex-shrink:0; letter-spacing:1px;`);

    for (const [lbl, title, action] of [
      ['🔍+', 'Zoom in',      'zoomIn'  ],
      ['🔍-', 'Zoom out',     'zoomOut' ],
      ['↺',   'Rotate left',  'rotLeft' ],
      ['↻',   'Rotate right', 'rotRight'],
      ['⌂',   'Reset view',   'reset'   ],
    ]) {
      const b = this._el(bar, 'button', lbl, this._btnCss('#111', '4px 6px'));
      b.title = title;
      b.addEventListener('click', () => this.gameState.onCameraAction?.(action));
    }

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    bar.appendChild(spacer);

    document.body.appendChild(bar);
    return bar;
  }

  _buildFinance() {
    const panel = document.createElement('div');
    panel.id = 'mc-finance';
    panel.style.cssText = `
      position:fixed; top:44px; left:0; width:300px;
      background:rgba(8,8,12,0.98); border:1px solid #2a2a2a; border-top:none;
      font-family:monospace; color:#ccc; z-index:190; display:none;
    `;

    const hdr = document.createElement('div');
    hdr.style.cssText = `
      padding:8px 14px; border-bottom:1px solid #1e1e1e;
      display:flex; justify-content:space-between; align-items:center;
    `;
    hdr.innerHTML = `<span style="font-size:11px; font-weight:bold; color:#5dade2; letter-spacing:1px;">FINANCE</span>`;
    const x = document.createElement('button');
    x.textContent = '✕';
    x.style.cssText = 'background:none; border:none; color:#555; cursor:pointer; font:12px monospace;';
    x.addEventListener('click', () => this._toggleFinance(false));
    hdr.appendChild(x);
    panel.appendChild(hdr);

    const body = document.createElement('div');
    body.id = 'finance-body';
    body.style.cssText = 'padding:12px 14px; font-size:11px; line-height:2;';
    panel.appendChild(body);

    document.body.appendChild(panel);
    return panel;
  }

  _toggleFinance(force) {
    this._financeOpen = force !== undefined ? force : !this._financeOpen;
    const p = document.getElementById('mc-finance');
    if (!p) return;
    p.style.display = this._financeOpen ? 'block' : 'none';
    if (this._financeOpen) this._refreshFinance();
  }

  _refreshFinance() {
    const body = document.getElementById('finance-body');
    if (!body) return;
    const gs = this.gameState;
    const row = (label, val, color = '#aaa') =>
      `<div style="display:flex;justify-content:space-between;">
        <span style="color:#666">${label}</span>
        <span style="color:${color}">${val}</span>
       </div>`;
    body.innerHTML = `
      <div style="color:#3a3a3a;font-size:9px;letter-spacing:1px;margin-bottom:6px;">OVERVIEW</div>
      ${row('Current Funds',  '$' + gs.funds.toLocaleString(), '#2ecc71')}
      ${row('Population',     gs.stats.population)}
      ${row('Happiness',      gs.stats.happiness + '%')}
      <div style="color:#3a3a3a;font-size:9px;letter-spacing:1px;margin:10px 0 6px;">REVENUE (monthly)</div>
      ${row('Property Tax',   '$0', '#2ecc71')}
      ${row('Business Fees',  '$0', '#2ecc71')}
      ${row('Fines',          '$0', '#2ecc71')}
      <div style="color:#3a3a3a;font-size:9px;letter-spacing:1px;margin:10px 0 6px;">EXPENSES (monthly)</div>
      ${row('Road Maintenance','$0', '#e74c3c')}
      ${row('Public Works',    '$0', '#e74c3c')}
      ${row('Administration',  '$0', '#e74c3c')}
      <div style="margin-top:12px; border-top:1px solid #1a1a1a; padding-top:8px;
        color:#2a2a2a; font-size:10px;">
        Full budget system in a future update.
      </div>
    `;
  }

  _el(parent, tag, text, css) {
    const el = document.createElement(tag);
    el.textContent = text;
    if (css) el.style.cssText = css;
    parent.appendChild(el);
    return el;
  }

  _sep() {
    const d = document.createElement('div');
    d.style.cssText = 'width:1px; height:26px; background:#1e1e1e; margin:0 4px; flex-shrink:0;';
    return d;
  }

  _btnCss(bg = '#1a1a1a', padding = '4px 9px') {
    return `
      padding:${padding}; border-radius:3px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:11px; border:1px solid #333;
      background:${bg}; color:#aaa; margin:0 2px;
    `;
  }
}