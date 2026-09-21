/**
 * YerbaMateSim - <yerba-kpi-chip> Web Component
 * Bounded Context: Atomic HUD Metrics & Tactical Displays
 * Specification: web-components-optimization-skill (Patrón A)
 */

export class YerbaKpiChip extends HTMLElement {
  static get observedAttributes() {
    return ['label', 'value', 'status', 'format', 'danger-alert'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal || !this.shadowRoot.innerHTML) return;

    if (name === 'value') {
      const valEl = this.shadowRoot.querySelector('.default-val');
      if (valEl) valEl.textContent = this.formatValue(newVal);
    } else if (name === 'status') {
      const valEl = this.shadowRoot.querySelector('.default-val');
      if (valEl) {
        valEl.className = `kpi-val default-val val-${newVal}`;
      }
    } else if (name === 'danger-alert') {
      const wrapper = this.shadowRoot.querySelector('.chip-wrapper');
      if (wrapper) {
        wrapper.classList.toggle('kpi-danger-pulse', newVal === 'true' || newVal === '');
      }
    } else {
      this.render();
    }
  }

  formatValue(raw) {
    const fmt = this.getAttribute('format') || 'raw';
    const num = Number(raw) || 0;
    if (fmt === 'currency') return `$${Math.round(num).toLocaleString('es-AR')}`;
    if (fmt === 'percent') return `${num.toFixed(1)}%`;
    return raw;
  }

  render() {
    const label = this.getAttribute('label') || '';
    const val = this.getAttribute('value') || '';
    const status = this.getAttribute('status') || 'positive';
    const isDanger = this.hasAttribute('danger-alert') && this.getAttribute('danger-alert') !== 'false';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          font-family: inherit;
          contain: content;
        }
        .chip-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          border-radius: 4px;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }
        :host(.core-kpi-item) .chip-wrapper,
        :host(.bar-kpi) .chip-wrapper {
          padding: 0;
          background: transparent;
          border: none;
        }
        .chip-wrapper.kpi-danger-pulse {
          background-color: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
          animation: pulse-danger 2s infinite;
        }
        @keyframes pulse-danger {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          50% { box-shadow: 0 0 8px 2px rgba(239, 68, 68, 0.6); }
        }
        .kpi-lbl {
          font-size: 0.76rem;
          color: var(--text-muted, #9ca3af);
          white-space: nowrap;
        }
        .kpi-val {
          font-family: monospace;
          font-weight: 700;
          font-size: 0.90rem;
          white-space: nowrap;
        }
        .val-positive { color: var(--accent-green, #10b981); }
        .val-warning  { color: var(--accent-gold, #f59e0b); }
        .val-danger   { color: var(--accent-danger, #ef4444); }
        
        /* Slotted styling overrides to preserve external IDs */
        ::slotted(.kpi-val) {
          font-family: monospace;
          font-weight: 700;
          font-size: 0.90rem;
        }
      </style>
      <div class="chip-wrapper ${isDanger ? 'kpi-danger-pulse' : ''}">
        <slot name="label">
          ${label ? `<span class="kpi-lbl">${label}</span>` : ''}
        </slot>
        <slot name="value">
          <strong class="kpi-val default-val val-${status}">${this.formatValue(val)}</strong>
        </slot>
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('yerba-kpi-chip')) {
  customElements.define('yerba-kpi-chip', YerbaKpiChip);
}
