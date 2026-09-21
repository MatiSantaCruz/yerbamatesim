/**
 * YerbaMateSim - <yerba-inta-alert> Web Component
 * Bounded Context: INTA / IRAM Phytosanitary & Agroclimatic Alerts
 * Specification: web-components-optimization-skill (Patrón A - Presentacional Reactivo)
 */

export class YerbaIntaAlert extends HTMLElement {
  static get observedAttributes() {
    return ['status', 'title', 'ude', 'impact', 'mitigated'];
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

    if (name === 'status') {
      const card = this.shadowRoot.querySelector('.inta-alert-card');
      if (card) {
        card.className = `inta-alert-card status-${newVal}`;
      }
    } else if (name === 'title') {
      const el = this.shadowRoot.querySelector('.alert-title');
      if (el) el.textContent = newVal || '';
    } else if (name === 'ude') {
      const el = this.shadowRoot.querySelector('.alert-ude');
      if (el) el.textContent = newVal || '';
    } else if (name === 'impact') {
      const el = this.shadowRoot.querySelector('.alert-impact');
      if (el) el.textContent = newVal ? `-${newVal}%` : '0%';
    } else if (name === 'mitigated') {
      const el = this.shadowRoot.querySelector('.alert-mitigation');
      if (el) {
        const isMitigated = newVal === 'true' || newVal === '';
        el.textContent = isMitigated 
          ? '🛡️ Atenuación por Buenas Prácticas Agrícolas (BPA) activa.' 
          : '⚠️ Sin atenuación BPA. Riesgo agronómico pleno.';
      }
    } else {
      this.render();
    }
  }

  render() {
    const status = this.getAttribute('status') || 'clean';
    const title = this.getAttribute('title') || (status === 'clean' ? 'Cuenca Yerbatera en Calma' : 'Alerta Fitosanitaria');
    const ude = this.getAttribute('ude') || '';
    const impact = this.getAttribute('impact') || '0';
    const isMitigated = this.getAttribute('mitigated') === 'true' || this.getAttribute('mitigated') === '';

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          contain: content;
          font-family: inherit;
        }
        .inta-alert-card {
          padding: 8px 12px;
          border-radius: 4px;
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        .status-clean {
          border-left: 4px solid var(--success, #22c55e);
          background: rgba(34, 197, 94, 0.08);
        }
        .status-active {
          border-left: 4px solid var(--warning, #eab308);
          background: rgba(234, 179, 8, 0.08);
        }
        .status-critical {
          border-left: 4px solid var(--danger, #ef4444);
          background: rgba(239, 68, 68, 0.12);
        }
        .header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .alert-title {
          font-size: 13px;
          font-weight: 700;
        }
        .status-clean .alert-title { color: var(--success, #22c55e); }
        .status-active .alert-title { color: var(--warning, #eab308); }
        .status-critical .alert-title { color: var(--danger, #ef4444); }

        .badge-inta {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 3px;
          background: var(--bg-badge, rgba(255, 255, 255, 0.1));
          color: var(--text-color, #e5e7eb);
          font-weight: 600;
        }
        .alert-details {
          margin: 4px 0;
          font-size: 12px;
          color: var(--text-color, #e5e7eb);
        }
        .alert-mitigation {
          font-size: 11px;
          color: var(--text-muted, #9ca3af);
        }
      </style>
      <div class="inta-alert-card status-${status}">
        <slot>
          ${status === 'clean' ? `
            <div class="alert-title">🌱 ${title}</div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted, #9ca3af);">
              Sin alertas fitosanitarias activas. Condiciones agroclimáticas y foliares estables.
            </p>
          ` : `
            <div class="header-row">
              <strong class="alert-title">🚨 ${title}</strong>
              <span class="badge-inta">INTA</span>
            </div>
            <p class="alert-details">
              UDE: <strong class="alert-ude">${ude || 'Densidad poblacional superada'}</strong> | Impacto estimado: <strong class="alert-impact">-${impact}%</strong>
            </p>
            <div class="alert-mitigation">
              ${isMitigated ? '🛡️ Atenuación por Buenas Prácticas Agrícolas (BPA) activa.' : '⚠️ Sin atenuación BPA. Riesgo agronómico pleno.'}
            </div>
          `}
        </slot>
      </div>
    `;
  }
}

if (!customElements.get('yerba-inta-alert')) {
  customElements.define('yerba-inta-alert', YerbaIntaAlert);
}
