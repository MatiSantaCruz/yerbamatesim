/**
 * YerbaMateSim - <yerba-decision-slider> Web Component
 * Bounded Context: Interactive Decision Controls (Pricing, Banking, CapEx)
 * Specification: web-components-optimization-skill (Patrón B - Componente Interactivo / Disparador de Acciones)
 */

export class YerbaDecisionSlider extends HTMLElement {
  static get observedAttributes() {
    return ['min', 'max', 'step', 'value', 'unit', 'prefix', 'accent-color'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._handleRangeInput = this._handleRangeInput.bind(this);
    this._handleNumberInput = this._handleNumberInput.bind(this);
  }

  connectedCallback() {
    this.render();
    this._setupListeners();
  }

  disconnectedCallback() {
    this._teardownListeners();
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal || !this.shadowRoot.innerHTML) return;

    if (name === 'value') {
      this._syncInternalValues(newVal);
    } else {
      this.render();
      this._setupListeners();
    }
  }

  _setupListeners() {
    const range = this.shadowRoot.querySelector('input[type="range"]');
    const num = this.shadowRoot.querySelector('input[type="number"]');

    if (range) range.addEventListener('input', this._handleRangeInput);
    if (num) num.addEventListener('input', this._handleNumberInput);
  }

  _teardownListeners() {
    const range = this.shadowRoot.querySelector('input[type="range"]');
    const num = this.shadowRoot.querySelector('input[type="number"]');

    if (range) range.removeEventListener('input', this._handleRangeInput);
    if (num) num.removeEventListener('input', this._handleNumberInput);
  }

  _handleRangeInput(e) {
    const val = e.target.value;
    const num = this.shadowRoot.querySelector('input[type="number"]');
    if (num) num.value = val;
    this._dispatchDecision(val);
  }

  _handleNumberInput(e) {
    const val = e.target.value;
    const range = this.shadowRoot.querySelector('input[type="range"]');
    if (range) range.value = val;
    this._dispatchDecision(val);
  }

  _syncInternalValues(val) {
    const range = this.shadowRoot.querySelector('input[type="range"]');
    const num = this.shadowRoot.querySelector('input[type="number"]');
    if (range && range.value !== String(val)) range.value = val;
    if (num && num.value !== String(val)) num.value = val;
  }

  _dispatchDecision(val) {
    this.setAttribute('value', val);
    this.dispatchEvent(new CustomEvent('decision-change', {
      bubbles: true,
      composed: true,
      detail: { value: Number(val) }
    }));
  }

  render() {
    const min = this.getAttribute('min') || '0';
    const max = this.getAttribute('max') || '100';
    const step = this.getAttribute('step') || '1';
    const val = this.getAttribute('value') || min;
    const accent = this.getAttribute('accent-color') || 'var(--accent, #10b981)';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          contain: content;
          font-family: inherit;
        }
        .slider-box {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        input[type="range"] {
          width: 100%;
          accent-color: ${accent};
          cursor: pointer;
        }
        .ticks-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.70rem;
          color: var(--text-muted, #9ca3af);
        }
        .exact-row {
          display: flex;
          gap: 6px;
          align-items: center;
          margin-top: 4px;
        }
        .exact-lbl {
          font-size: 0.78rem;
          color: var(--text-muted, #9ca3af);
          white-space: nowrap;
        }
        input[type="number"] {
          flex: 1;
          padding: 5px;
          border-radius: 4px;
          border: 1px solid var(--border-color, #333);
          background: var(--bg-card, #1e293b);
          color: #fff;
          font-family: monospace;
          font-size: 0.85rem;
        }
      </style>
      <div class="slider-box">
        <slot name="controls">
          <input type="range" min="${min}" max="${max}" step="${step}" value="${val}">
          <div class="ticks-row">
            <slot name="tick-min"><span>${min}</span></slot>
            <slot name="tick-mid"></slot>
            <slot name="tick-max"><span>${max}</span></slot>
          </div>
          <div class="exact-row">
            <slot name="exact-label">
              <label class="exact-lbl">Ajuste exacto:</label>
            </slot>
            <input type="number" min="${min}" max="${max}" step="${step}" value="${val}">
          </div>
        </slot>
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('yerba-decision-slider')) {
  customElements.define('yerba-decision-slider', YerbaDecisionSlider);
}
