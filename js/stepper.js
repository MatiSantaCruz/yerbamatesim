/**
 * Stepper State Machine (RF-08, RF-16)
 *
 * Enforces strictly irreversible navigation across weekly operative phases:
 * - Phase 1: Abastecimiento & Tarefa de Cosecha (Make or Buy)
 * - Phase 2: Capacidad Industrial & Decisiones CapEx
 * - Phase 3: Política Comercial & Tesorería
 * - Phase 4: Arena Versus & Cierre de Turno
 *
 * Guarantees:
 * - Confirmed phases cannot be modified or re-entered during the active turn.
 * - Confirmed decisions are stored immutably in session storage.
 * - Back-navigation is physically blocked and indicators display locked state.
 */

class StepperStateMachine {
  constructor(initialPhase = 1, completedPhases = []) {
    this.activePhase = initialPhase; // The true sequential phase waiting for confirmation
    this.viewPhase = initialPhase;   // The phase currently being inspected (RF-02)
    this.completedPhases = new Set(completedPhases);
    this.drafts = {
      1: null,
      2: null,
      3: null,
    };
    this.domainError = null; // Stores active domain exception state (RF-19, T23)
    this.subscribers = [];
  }

  /**
   * Handle domain exception emitted by business rule or validation (RF-19, T23).
   * @param {object} error { errorType, message, phase, fieldId }
   */
  handleDomainException(error) {
    this.domainError = error ? { ...error, timestamp: Date.now() } : null;
    this.notify();
    return this.domainError;
  }

  /**
   * Clear active domain exception once resolved.
   */
  clearDomainException() {
    this.domainError = null;
    this.notify();
  }

  /**
   * Subscribe to stepper state changes.
   * @param {Function} callback function(activePhase, completedPhases, drafts, viewPhase)
   */
  subscribe(callback) {
    if (typeof callback === "function") {
      this.subscribers.push(callback);
    }
  }

  notify() {
    for (const sub of this.subscribers) {
      try {
        sub(this.activePhase, Array.from(this.completedPhases), this.drafts, this.viewPhase);
      } catch (err) {
        console.error("Stepper notification error:", err);
      }
    }
  }

  /**
   * Free analytical inspection across any of the 4 phases without altering active decisions (RF-02).
   * @param {number} phase Phase number to inspect (1 to 4)
   */
  inspectPhase(phase) {
    if (phase < 1 || phase > 4) return false;
    this.viewPhase = phase;
    this.saveSession();
    this.notify();
    return true;
  }

  /**
   * Confirm the current active phase and advance irreversibly to next phase (RF-06, RF-08).
   * @param {number} phase Phase number to confirm (1, 2, or 3)
   * @param {object} phaseDraft The confirmed decisions data for this phase
   */
  confirmPhase(phase, phaseDraft) {
    if (phase !== this.activePhase) {
      console.warn(`Debe respetar el orden secuencial de decisión (Fase 01 -> Fase 02 -> Fase 03 -> Fase 04). No se puede confirmar fase ${phase} cuando la activa es ${this.activePhase}.`);
      return false;
    }

    if (this.completedPhases.has(phase)) {
      console.warn(`Fase ${phase} ya ha sido confirmada y es inmutable.`);
      return false;
    }

    // Freeze draft to guarantee immutability (RF-06, RF-08)
    this.drafts[phase] = Object.freeze(JSON.parse(JSON.stringify(phaseDraft || {})));
    this.completedPhases.add(phase);

    // Irreversible transition: advance to next phase
    if (this.activePhase < 4) {
      this.activePhase += 1;
      this.viewPhase = this.activePhase;
    }

    this.saveSession();
    this.notify();
    return true;
  }

  /**
   * Checks if a phase draft represents a blank advance (all zero orders due to illiquidity) (RF-06).
   * @param {number} phase Phase number (1 or 2)
   * @param {object} draft The phase draft object
   */
  isBlankDraft(phase, draft) {
    if (!draft) return true;
    if (phase === 1) {
      return (
        (!draft.harvest_hectares || Number(draft.harvest_hectares) === 0) &&
        (!draft.harvest_own_kg || Number(draft.harvest_own_kg) === 0) &&
        (!draft.buy_green_leaf_kg || Number(draft.buy_green_leaf_kg) === 0) &&
        (!draft.buy_canchada_kg || Number(draft.buy_canchada_kg) === 0) &&
        (!draft.sow_seedlings_units || Number(draft.sow_seedlings_units) === 0)
      );
    }
    if (phase === 2) {
      return (
        (!draft.expand_dryer_kg || Number(draft.expand_dryer_kg) === 0) &&
        (!draft.expand_aging_accel_kg || Number(draft.expand_aging_accel_kg) === 0) &&
        (!draft.expand_mill_kg || Number(draft.expand_mill_kg) === 0)
      );
    }
    return false;
  }

  /**
   * Check if a phase can be inspected (all 1..4 can be freely inspected per RF-02).
   */
  canInspect(phase) {
    return phase >= 1 && phase <= 4;
  }

  /**
   * Can edits be made in targetPhase?
   * Strictly allowed ONLY if targetPhase === activePhase and not already completed (RF-06).
   */
  isPhaseEditable(targetPhase) {
    return targetPhase === this.activePhase && !this.completedPhases.has(targetPhase);
  }

  /**
   * Reset stepper for the next simulation week.
   */
  resetForNextWeek() {
    this.activePhase = 1;
    this.viewPhase = 1;
    this.completedPhases.clear();
    this.drafts = { 1: null, 2: null, 3: null };
    this.saveSession();
    this.notify();
  }

  /**
   * Persist current stepper state to LocalStorage (RF-06, RF-16).
   */
  saveSession() {
    try {
      const data = {
        activePhase: this.activePhase,
        viewPhase: this.viewPhase,
        completedPhases: Array.from(this.completedPhases),
        drafts: this.drafts,
      };
      if (typeof window !== "undefined" && window.simStorage && window.simStorage.saveStepperToStorage) {
        window.simStorage.saveStepperToStorage(data);
      } else {
        localStorage.setItem("yerbamate_stepper_state", JSON.stringify(data));
      }
    } catch (e) {}
  }

  /**
   * Restore stepper state from LocalStorage (RF-06, RF-16).
   */
  restoreSession() {
    try {
      let data = null;
      if (typeof window !== "undefined" && window.simStorage && window.simStorage.loadStepperFromStorage) {
        data = window.simStorage.loadStepperFromStorage();
      } else {
        const raw = localStorage.getItem("yerbamate_stepper_state");
        if (raw) data = JSON.parse(raw);
      }
      if (data && typeof data.activePhase === "number") {
        this.activePhase = data.activePhase;
        this.viewPhase = (typeof data.viewPhase === "number") ? data.viewPhase : data.activePhase;
        this.completedPhases = new Set(data.completedPhases || []);
        this.drafts = data.drafts || { 1: null, 2: null, 3: null };
        this.notify();
        return true;
      }
    } catch (e) {}
    return false;
  }

  /**
   * Clear persisted stepper session upon new match or reset.
   */
  clearSession() {
    try {
      localStorage.removeItem("yerbamate_stepper_state");
    } catch (e) {}
    this.activePhase = 1;
    this.viewPhase = 1;
    this.completedPhases.clear();
    this.drafts = { 1: null, 2: null, 3: null };
    this.notify();
  }
}

// Global Stepper Instance & Exports
if (typeof window !== "undefined") {
  window.stepper = new StepperStateMachine();
  window.StepperStateMachine = StepperStateMachine;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    StepperStateMachine,
  };
}
