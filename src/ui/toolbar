export class Toolbar {
  constructor() {
    this._bar         = this._build();
    this._contextArea = this._addContextArea();
    this._picker      = null;
  }

  addTool(id, label, title, onClick) {
    const btn = document.createElement('button');
    btn.id            = `tool-btn-${id}`;
    btn.textContent   = label;
    btn.title         = title;
    btn.style.cssText = `
      padding:4px 12px; border-radius:4px; cursor:pointer; flex-shrink:0;
      font-family:monospace; font-size:11px; border:1px solid #333;
      background:#141414; color:#888;
    `;
    btn.addEventListener('click', onClick);
    this._bar.insertBefore(btn, this._contextArea);
    return btn;
  }

  addSeparator() {
    const d = document.createElement('div');
    d.style.cssText = 'width:1px; height:22px; background:#222; margin:0 6px; flex-shrink:0;';
    this._bar.insertBefore(d, this._contextArea);
  }

  setActive(id) {
    this._bar.querySelectorAll('button[id^="tool-btn-"]').forEach(btn => {
      const on = btn.id === `tool-btn-${id}`;
      btn.style.background  = on ? '#0a2035' : '#141414';
      btn.style.color       = on ? '#5dade2' : '#888';
      btn.style.borderColor = on ? '#1a5276' : '#333';
    });
  }

  clearActive() { this.setActive('__none__'); }

  getContextArea() { return this._contextArea; }

  attachPicker(panel) {
    // picker slides in below toolbar
    this._picker = panel;
    panel.style.top = '84px';
  }

  _build() {
    const bar = document.createElement('div');
    bar.style.cssText = `
      position:fixed; top:44px; left:0; right:0; height:40px;
      background:rgba(11,11,11,0.95); backdrop-filter:blur(4px);
      display:flex; align-items:center; padding:0 10px; gap:4px;
      font-family:monospace; z-index:199;
      border-bottom:1px solid #1e1e1e;
    `;
    document.body.appendChild(bar);
    return bar;
  }

  _addContextArea() {
    const area = document.createElement('div');
    area.id = 'toolbar-context';
    area.style.cssText = 'display:flex; align-items:center; gap:6px; flex:1; overflow:hidden;';
    this._bar.appendChild(area);
    return area;
  }
}