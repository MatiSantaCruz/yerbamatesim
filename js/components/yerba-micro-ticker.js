/**
 * YerbaMateSim - <yerba-micro-ticker> Web Component
 * Bounded Context: Horizontal Market Board & Quotes Ticker
 * Specification: web-components-optimization-skill
 */

export class YerbaMicroTicker extends HTMLElement {
  static get observedAttributes() {
    return ['leaf', 'canchada', 'final', 'demand'];
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
    const targetEl = this.shadowRoot.querySelector(`.ticker-val-${name}`);
    if (targetEl) {
      targetEl.textContent = name === 'demand' ? `${Number(newVal || 0).toLocaleString()} kg` : `$${Number(newVal || 0).toFixed(2)}`;
    }
  }

  render() {
    const leaf = this.getAttribute('leaf') || '0.00';
    const canchada = this.getAttribute('canchada') || '0.00';
    const finalVal = this.getAttribute('final') || '0.00';
    const demand = this.getAttribute('demand') || '0';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          font-family: inherit;
          contain: content;
        }
        .ticker-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(15, 23, 42, 0.55);
          padding: 3px 10px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.78rem;
          color: var(--text-muted, #9ca3af);
        }
        :host(.micro-ticker) .ticker-wrapper {
          background: transparent;
          border: none;
          padding: 0;
        }
        .ticker-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .ticker-chip strong {
          color: var(--text-primary, #f8fafc);
          font-family: monospace;
          font-size: 0.82rem;
        }
        .ticker-divider {
          color: rgba(255, 255, 255, 0.2);
        }
      </style>
      <div class="ticker-wrapper">
        <slot>
          <span class="ticker-chip" title="Hoja Verde Spot">
            HV: <strong class="ticker-val-leaf">$${Number(leaf).toFixed(2)}</strong>
          </span>
          <span class="ticker-divider">|</span>
          <span class="ticker-chip" title="Yerba Canchada Spot">
            YC: <strong class="ticker-val-canchada">$${Number(canchada).toFixed(2)}</strong>
          </span>
          <span class="ticker-divider">|</span>
          <span class="ticker-chip" title="Yerba Elaborada Góndola">
            YE: <strong class="ticker-val-final">$${Number(finalVal).toFixed(2)}</strong>
          </span>
          <span class="ticker-divider">|</span>
          <span class="ticker-chip" title="Demanda Semanal Estimada">
            Dem: <strong class="ticker-val-demand">${Number(demand).toLocaleString()} kg</strong>
          </span>
        </slot>
      </div>
    `;
  }
}

if (!customElements.get('yerba-micro-ticker')) {
  customElements.define('yerba-micro-ticker', YerbaMicroTicker);
}
