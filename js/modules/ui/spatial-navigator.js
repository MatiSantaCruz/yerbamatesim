/**
 * YerbaMateSim - Spatial Navigator & Non-linear Scene Switcher (ESM)
 * Bounded Context: 4-Quadrant Non-linear Navigation (Oficina, Producción, Mercado, Banco)
 * Covered Functional Requirements: RF-01, RF-02, RF-03
 */

import { showDomainExceptionBanner } from "./atoms.js";

export const VALID_LOCATIONS = ["oficina", "produccion", "mercado", "banco"];

export const SPATIAL_TUTORIAL_STEPS = [
  {
    step: 1,
    location: "oficina",
    title: "🏛️ 1. Oficina Administrativa",
    badge: "Inducción Semana 1 - Paso 1 de 5: Oficina Administrativa",
    text: "Bienvenido a YerbaMateSim. La Oficina Administrativa es tu centro neurálgico: aquí monitoreas la solvencia patrimonial, revisas las alertas agronómicas del INTA y ejecutas de manera exclusiva el cierre de turno semanal."
  },
  {
    step: 2,
    location: "mercado",
    title: "🏪 2. Mercado Mayorista & Política Comercial",
    badge: "Inducción Semana 1 - Paso 2 de 5: Mercado Mayorista",
    text: "En el Mercado gestionas las compras spot de hoja verde y canchada con bypass logístico directo a almacenamiento, y fijas el precio de venta al consumidor dentro de la banda de $2.800 a $4.200/kg evaluando la absorción elástica frente al Bot rival."
  },
  {
    step: 3,
    location: "produccion",
    title: "🏭 3. Sector Productivo & Planta Fabril",
    badge: "Inducción Semana 1 - Paso 3 de 5: Sector Productivo",
    text: "Aquí supervisas la siembra en semillero (0-300 pl), la cosecha propia con cuadrillas mecanizadas BPA o tradicionales, el secadero con alerta de ardido foliar (>95%), la bifurcación tecnológica en noques/cámaras y la molienda IRAM 20550."
  },
  {
    step: 4,
    location: "banco",
    title: "🏦 4. Entidad Financiera & Tesorería",
    badge: "Inducción Semana 1 - Paso 4 de 5: Entidad Financiera",
    text: "En el Banco puedes solicitar crédito comercial o amortizar deuda anticipadamente mediante un slider bilateral, siempre restringido por el tope legal de apalancamiento D/A <= 0.80 para prevenir la quiebra técnica."
  },
  {
    step: 5,
    location: "oficina",
    title: "🏛️ 5. Cierre Centralizado en Oficina",
    badge: "Inducción Semana 1 - Paso 5 de 5: Retorno a Oficina",
    text: "¡Inducción completada! Ahora tienes plena navegación autónoma entre los 4 cuadrantes. Recuerda que al finalizar tus órdenes de cada semana, debes regresar a la Oficina Administrativa para ejecutar el turno."
  }
];

export class SpatialNavigator {
  /**
   * Initializes the Spatial Navigator with default location 'oficina' (RF-02).
   * @param {string} initialLocation Starting location ("oficina" | "produccion" | "mercado" | "banco")
   * @param {object|null} gameState Optional GameState reference
   */
  constructor(initialLocation = "oficina", gameState = null) {
    this.activeLocation = VALID_LOCATIONS.includes(initialLocation) ? initialLocation : "oficina";
    this.gameState = gameState;
    this.subscribers = [];
    this.dirtyLocations = new Set();
    this.pendingNavigation = null;
    this.onUnsavedWarning = null;
    this.onDraftSaved = null;
    this.onDiscardChanges = null;
    this.onLiquidityBlocked = null;
    this.lastLiquidityError = null;

    // Tutorial state (RF-10)
    this.tutorialStep = 1;
    this.tutorialCompleted = false;

    if (this.gameState) {
      const sp = this.gameState.spatial_ui;
      if (sp) {
        if (typeof sp.tutorial_step === "number") this.tutorialStep = sp.tutorial_step;
        if (typeof sp.tutorial_completed === "boolean") this.tutorialCompleted = sp.tutorial_completed;
        if (sp.tutorial_state) {
          if (typeof sp.tutorial_state.current_step === "number") this.tutorialStep = sp.tutorial_state.current_step;
          if (typeof sp.tutorial_state.completed === "boolean") this.tutorialCompleted = sp.tutorial_state.completed;
        }
      }
      if (typeof this.gameState.week === "number" && this.gameState.week > 1) {
        this.tutorialCompleted = true;
      }
    } else {
      this.tutorialCompleted = true;
    }
  }

  /**
   * Sets or updates current GameState reference and synchronizes tutorial state.
   * @param {object|null} gameState
   */
  setGameState(gameState) {
    this.gameState = gameState;
    if (this.gameState) {
      const sp = this.gameState.spatial_ui;
      if (sp) {
        if (typeof sp.tutorial_step === "number") this.tutorialStep = sp.tutorial_step;
        if (typeof sp.tutorial_completed === "boolean") this.tutorialCompleted = sp.tutorial_completed;
        if (sp.tutorial_state) {
          if (typeof sp.tutorial_state.current_step === "number") this.tutorialStep = sp.tutorial_state.current_step;
          if (typeof sp.tutorial_state.completed === "boolean") this.tutorialCompleted = sp.tutorial_state.completed;
        }
      }
      if (typeof this.gameState.week === "number" && this.gameState.week > 1) {
        this.tutorialCompleted = true;
      }
    }
  }

  /**
   * Returns true if tutorial is currently active (Week 1 and not yet completed) (RF-10).
   * @returns {boolean}
   */
  isTutorialActive() {
    if (this.tutorialCompleted) return false;
    if (!this.gameState) return false;
    if (this.gameState.week !== 1) return false;
    const sp = this.gameState.spatial_ui;
    if (sp && sp.tutorial_completed) return false;
    return true;
  }

  /**
   * Retrieves current step index of the spatial tutorial (1-5).
   * @returns {number}
   */
  getTutorialStep() {
    return this.tutorialStep;
  }

  /**
   * Synchronizes tutorial step and completion status with GameState.
   * @private
   */
  _syncTutorialState() {
    const state = this.gameState || (typeof window !== "undefined" ? window.gameState : null);
    if (state) {
      if (!state.spatial_ui) {
        state.spatial_ui = {};
      }
      state.spatial_ui.tutorial_step = this.tutorialStep;
      state.spatial_ui.tutorial_completed = this.tutorialCompleted;
      if (state.spatial_ui.tutorial_state) {
        state.spatial_ui.tutorial_state.current_step = this.tutorialStep;
        state.spatial_ui.tutorial_state.completed = this.tutorialCompleted;
      }
    }
  }

  /**
   * Advances to next step of the tutorial or completes it at step 5 (RF-10).
   * @returns {boolean}
   */
  nextTutorialStep() {
    if (!this.isTutorialActive()) return false;

    if (this.tutorialStep < 5) {
      this.tutorialStep += 1;
      const stepData = SPATIAL_TUTORIAL_STEPS.find(s => s.step === this.tutorialStep);
      if (stepData) {
        this.navigateTo(stepData.location, { tutorialOverride: true, force: true });
      }
      this._syncTutorialState();
      this.renderTutorialModal();
      return true;
    } else {
      return this.completeTutorial();
    }
  }

  /**
   * Completes the tutorial, hides modal and unlocks autonomous 4-quadrant navigation (RF-10).
   * @returns {boolean}
   */
  completeTutorial() {
    this.tutorialCompleted = true;
    this._syncTutorialState();
    if (typeof document !== "undefined") {
      const modal = document.getElementById("spatial-tutorial-modal");
      if (modal) {
        if (modal.style) modal.style.display = "none";
        if (typeof modal.setAttribute === "function") modal.setAttribute("aria-hidden", "true");
      }
    }
    return true;
  }

  /**
   * Skips the tutorial immediately, unlocking free navigation (RF-10).
   * @returns {boolean}
   */
  skipTutorial() {
    this.tutorialCompleted = true;
    this._syncTutorialState();
    if (typeof document !== "undefined") {
      const modal = document.getElementById("spatial-tutorial-modal");
      if (modal) {
        if (modal.style) modal.style.display = "none";
        if (typeof modal.setAttribute === "function") modal.setAttribute("aria-hidden", "true");
      }
    }
    return true;
  }

  /**
   * Renders the tutorial modal with content of current step (RF-10).
   */
  renderTutorialModal() {
    if (typeof document === "undefined") return;

    const modal = document.getElementById("spatial-tutorial-modal");
    if (!modal) return;

    if (!this.isTutorialActive()) {
      if (modal.style) modal.style.display = "none";
      if (typeof modal.setAttribute === "function") modal.setAttribute("aria-hidden", "true");
      return;
    }

    const stepData = SPATIAL_TUTORIAL_STEPS.find(s => s.step === this.tutorialStep);
    if (!stepData) return;

    const badge = document.getElementById("tutorial-step-badge");
    if (badge) badge.textContent = stepData.badge;

    const title = document.getElementById("tutorial-step-title");
    if (title) title.textContent = stepData.title;

    const text = document.getElementById("tutorial-step-text");
    if (text) text.textContent = stepData.text;

    const btnNext = document.getElementById("btn-tutorial-next");
    if (btnNext) {
      btnNext.textContent = this.tutorialStep === 5 ? "Finalizar Inducción y Comenzar 🎉" : "Siguiente Escenario ➡️";
    }

    if (modal.style) modal.style.display = "flex";
    if (typeof modal.setAttribute === "function") modal.setAttribute("aria-hidden", "false");
  }

  /**
   * Initializes tutorial UI if active for current week.
   */
  initTutorial() {
    if (this.isTutorialActive()) {
      const stepData = SPATIAL_TUTORIAL_STEPS.find(s => s.step === this.tutorialStep);
      if (stepData) {
        this.navigateTo(stepData.location, { tutorialOverride: true, force: true });
      }
      this.renderTutorialModal();
    } else {
      if (typeof document !== "undefined") {
        const modal = document.getElementById("spatial-tutorial-modal");
        if (modal) {
          if (modal.style) modal.style.display = "none";
          if (typeof modal.setAttribute === "function") modal.setAttribute("aria-hidden", "true");
        }
      }
    }
  }

  /**
   * Checks whether a specific location has unsaved modifications.
   * @param {string} location
   * @returns {boolean}
   */
  isDirty(location = this.activeLocation) {
    return this.dirtyLocations.has(location);
  }

  /**
   * Returns true if there are unsaved changes in current or specific location (RF-03).
   * @param {string|null} location
   * @returns {boolean}
   */
  hasUnsavedChanges(location = null) {
    if (location) return this.dirtyLocations.has(location);
    return this.dirtyLocations.has(this.activeLocation);
  }

  /**
   * Marks a location as modified with unsaved changes (RF-03).
   * @param {string} location
   */
  markDirty(location = this.activeLocation) {
    if (VALID_LOCATIONS.includes(location)) {
      this.dirtyLocations.add(location);
      this._updateDirtyUI(location, true);
    }
  }

  /**
   * Marks a location as clean (saved or discarded).
   * @param {string} location
   */
  markClean(location = this.activeLocation) {
    this.dirtyLocations.delete(location);
    this._updateDirtyUI(location, false);
  }

  /**
   * Retrieves pending target location if navigation was intercepted.
   * @returns {string|null}
   */
  getPendingNavigation() {
    return this.pendingNavigation;
  }

  /**
   * Sets callback for unsaved changes navigation interception warning.
   * @param {Function} callback function(currentLocation, targetLocation)
   */
  setOnUnsavedWarning(callback) {
    this.onUnsavedWarning = typeof callback === "function" ? callback : null;
  }

  /**
   * Sets callback for draft save events.
   * @param {Function} callback function(location, draftData)
   */
  setOnDraftSaved(callback) {
    this.onDraftSaved = typeof callback === "function" ? callback : null;
  }

  /**
   * Sets callback for discard events.
   * @param {Function} callback function(location)
   */
  setOnDiscardChanges(callback) {
    this.onDiscardChanges = typeof callback === "function" ? callback : null;
  }

  /**
   * Sets callback for liquidity block events (RF-04).
   * @param {Function} callback function(errorDetails)
   */
  setOnLiquidityBlocked(callback) {
    this.onLiquidityBlocked = typeof callback === "function" ? callback : null;
  }

  /**
   * Retrieves last registered liquidity exception details.
   * @returns {object|null}
   */
  getLastLiquidityError() {
    return this.lastLiquidityError;
  }

  /**
   * Computes the cash outflow requirement for a location's draft (RF-04).
   * @param {string} location
   * @param {object|null} draftData
   * @returns {number} Required cash amount in ARS
   */
  calculateDraftCost(location, draftData) {
    if (!draftData || typeof draftData !== "object") return 0.0;

    if (typeof draftData.cost === "number" && isFinite(draftData.cost)) {
      return Math.max(0.0, draftData.cost);
    }
    if (typeof draftData.requiredCash === "number" && isFinite(draftData.requiredCash)) {
      return Math.max(0.0, draftData.requiredCash);
    }

    const state = this.gameState || (typeof window !== "undefined" ? window.gameState : null);
    let totalCost = 0.0;

    if (location === "produccion") {
      const hectares = parseFloat(draftData.harvest_hectares) || 0.0;
      const ownKg = parseFloat(draftData.harvest_own_kg) || (hectares * 1200.0);
      const crewVal = String(draftData.crew_type || "BPA_MECANIZADA").toUpperCase();
      const isTrad = crewVal.includes("TRAD");
      const crewRate = isTrad ? 110.0 : 145.0;
      const harvestCost = ownKg > 0 ? ownKg * crewRate : 0.0;

      const dryerCap = parseFloat(draftData.buy_dryer_capacity || draftData.buy_dryer_cap_weekly || 0.0);
      const agingCap = parseFloat(draftData.buy_aging_capacity || draftData.buy_aging_accel_cap || draftData.buy_aging_natural_cap || 0.0);
      const millCap = parseFloat(draftData.buy_mill_capacity || draftData.buy_mill_cap_weekly || 0.0);
      const seedlings = parseFloat(draftData.sow_seedlings || draftData.buy_nursery_cap || 0.0);
      const prepHec = parseFloat(draftData.prepare_hectares || 0.0);

      const agingRate = draftData.aging_destination === "NATURAL" ? 40.0 : 95.0;
      const capexCost = (dryerCap * 150.0) + (agingCap * agingRate) + (millCap * 200.0) + (seedlings * 100.0) + (prepHec * 350000.0);

      totalCost = harvestCost + capexCost;
    } else if (location === "mercado") {
      const leafKg = parseFloat(draftData.buy_leaf_kg || draftData.buy_green_leaf_kg || draftData.leaf_kg || 0.0);
      const canchadaKg = parseFloat(draftData.buy_canchada_kg || draftData.canchada_kg || 0.0);
      const leafPrice = (state && state.market && typeof state.market.leaf_spot_price === "number") ? state.market.leaf_spot_price : 250.0;
      const canchadaPrice = (state && state.market && typeof state.market.canchada_spot_price === "number") ? state.market.canchada_spot_price : 950.0;

      totalCost = (leafKg * leafPrice) + (canchadaKg * canchadaPrice);
    } else if (location === "banco") {
      const debtVar = parseFloat(draftData.debt_variation_ars || draftData.debt_variation || 0.0);
      if (debtVar < 0) {
        totalCost = Math.abs(debtVar);
      }
    }

    return totalCost;
  }

  /**
   * Retrieves current active spatial location.
   * @returns {string} "oficina" | "produccion" | "mercado" | "banco"
   */
  getLocation() {
    return this.activeLocation;
  }

  /**
   * Returns list of authorized spatial locations.
   * @returns {string[]}
   */
  getValidLocations() {
    return [...VALID_LOCATIONS];
  }

  /**
   * Subscribes a listener to spatial navigation transitions.
   * @param {Function} callback function(newLocation, previousLocation)
   */
  subscribe(callback) {
    if (typeof callback === "function" && !this.subscribers.includes(callback)) {
      this.subscribers.push(callback);
    }
  }

  /**
   * Removes a subscription.
   * @param {Function} callback
   */
  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
  }

  /**
   * Transitions to a target spatial location non-linearly (RF-01).
   * Intercepts navigation if unsaved changes exist in active location (RF-03).
   * @param {string} targetLocation Target destination
   * @param {object} options Options object { force: boolean, bypassUnsaved: boolean }
   * @returns {boolean} True if navigation succeeded, false if rejected or intercepted
   */
  navigateTo(targetLocation, options = {}) {
    if (!VALID_LOCATIONS.includes(targetLocation)) {
      console.warn(`[SpatialNavigator] Ubicación destino inválida: "${targetLocation}"`);
      return false;
    }

    // Intercept autonomous navigation if tutorial is active (RF-10)
    if (this.isTutorialActive() && !options.tutorialOverride && !options.force) {
      return false;
    }

    if (this.activeLocation === targetLocation && !options.force) {
      return true;
    }

    // Intercept navigation if there are unsaved modifications in current scene (RF-03)
    if (this.isDirty(this.activeLocation) && !options.force && !options.bypassUnsaved) {
      this.pendingNavigation = targetLocation;
      if (typeof this.onUnsavedWarning === "function") {
        this.onUnsavedWarning(this.activeLocation, targetLocation);
      }
      this._showUnsavedChangesModal(this.activeLocation, targetLocation);
      return false;
    }

    this.pendingNavigation = null;
    const previousLocation = this.activeLocation;
    this.activeLocation = targetLocation;

    // Sync GameState reference if available
    const state = this.gameState || (typeof window !== "undefined" ? window.gameState : null);
    if (state && state.spatial_ui) {
      state.spatial_ui.active_location = targetLocation;
    }

    // Sync DOM attributes and view containers if running in a browser
    this._syncDOM(targetLocation, previousLocation);

    // Notify registered subscribers
    for (const sub of this.subscribers) {
      try {
        sub(targetLocation, previousLocation);
      } catch (err) {
        console.error("[SpatialNavigator] Error en callback de suscriptor:", err);
      }
    }

    return true;
  }

  /**
   * Cancels pending intercepted navigation and remains at current location (RF-03).
   */
  cancelNavigation() {
    this.pendingNavigation = null;
    this._hideUnsavedChangesModal();
  }

  /**
   * Discards unsaved modifications in current or specified location.
   * @param {string} location
   */
  discardChanges(location = this.activeLocation) {
    this.markClean(location);
    if (typeof this.onDiscardChanges === "function") {
      this.onDiscardChanges(location);
    }
  }

  /**
   * Discards unsaved modifications and continues to pending target location (RF-03).
   * @returns {boolean}
   */
  discardAndNavigate() {
    const target = this.pendingNavigation;
    this.discardChanges(this.activeLocation);
    this.pendingNavigation = null;
    this._hideUnsavedChangesModal();
    if (target) {
      return this.navigateTo(target, { force: true });
    }
    return true;
  }

  /**
   * Saves and persists local draft for the specified location (RF-03, RF-04).
   * Strictly blocks save if orders in Producción or Mercado exceed available liquid cash (RF-04).
   * @param {string} location
   * @param {object|null} draftData
   * @returns {boolean}
   */
  saveLocationDraft(location = this.activeLocation, draftData = null) {
    const state = this.gameState || (typeof window !== "undefined" ? window.gameState : null);
    const availableCash = (state && state.player && typeof state.player.cash === "number")
      ? state.player.cash
      : Infinity;

    // Strict Liquidity Constraint (RF-04)
    if (location === "produccion" || location === "mercado" || location === "banco") {
      const cost = this.calculateDraftCost(location, draftData);
      if (cost > availableCash) {
        const deficit = cost - availableCash;
        const locName = location === "produccion" ? "Sector Productivo" : (location === "mercado" ? "Mercado Mayorista" : "Entidad Financiera");
        const message = location === "banco"
          ? `Fondos insuficientes en caja ($${Math.round(availableCash).toLocaleString("es-AR")}) para amortizar capital en el Banco ($${Math.round(cost).toLocaleString("es-AR")}). Déficit: $${Math.round(deficit).toLocaleString("es-AR")}. Debes contar con liquidez disponible para cancelar deuda.`
          : `Fondos insuficientes en caja ($${Math.round(availableCash).toLocaleString("es-AR")}) para cubrir las órdenes de ${locName} ($${Math.round(cost).toLocaleString("es-AR")}). Déficit: $${Math.round(deficit).toLocaleString("es-AR")}. Debes visitar previamente el Banco para solicitar financiamiento.`;

        const errorDetails = {
          status: "error",
          errorType: "InsufficientLiquidityError",
          location,
          message,
          requiredCash: cost,
          availableCash,
          deficit
        };

        this.lastLiquidityError = errorDetails;
        this.markDirty(location);

        // Display pedagogical domain exception banner
        showDomainExceptionBanner({
          errorType: "InsufficientLiquidityError",
          message,
          phase: location === "produccion" ? 1 : 2
        });

        if (typeof this.onLiquidityBlocked === "function") {
          this.onLiquidityBlocked(errorDetails);
        }

        return false;
      }
    }

    this.lastLiquidityError = null;
    this.markClean(location);

    if (state && state.spatial_ui) {
      if (draftData) {
        state.spatial_ui.drafts = state.spatial_ui.drafts || {};
        state.spatial_ui.drafts[location] = {
          ...(state.spatial_ui.drafts[location] || {}),
          ...draftData
        };
      }
      if (!Array.isArray(state.spatial_ui.confirmed_areas)) {
        state.spatial_ui.confirmed_areas = [];
      }
      if (!state.spatial_ui.confirmed_areas.includes(location)) {
        state.spatial_ui.confirmed_areas.push(location);
      }
    }

    if (typeof this.onDraftSaved === "function") {
      this.onDraftSaved(location, draftData);
    }

    return true;
  }

  /**
   * Confirms/saves modifications in active location and proceeds to pending navigation (RF-03).
   * Blocks navigation if save was denied due to insufficient liquidity (RF-04).
   * @param {object|null} draftData
   * @returns {boolean}
   */
  confirmSaveAndNavigate(draftData = null) {
    const target = this.pendingNavigation;
    const saveSuccess = this.saveLocationDraft(this.activeLocation, draftData);
    if (!saveSuccess) {
      // Navigation blocked: stay at current location with unsaved changes modal dismissed
      this._hideUnsavedChangesModal();
      return false;
    }
    this.pendingNavigation = null;
    this._hideUnsavedChangesModal();
    if (target) {
      return this.navigateTo(target, { force: true });
    }
    return true;
  }

  /**
   * Synchronizes dirty indicators on navigation buttons in the DOM.
   * @private
   */
  _updateDirtyUI(location, isDirty) {
    if (typeof document === "undefined") return;
    const btn = document.getElementById(`nav-btn-${location}`);
    if (btn) {
      btn.classList.toggle("has-unsaved-changes", isDirty);
    }
  }

  /**
   * Displays the unsaved changes warning modal.
   * @private
   */
  _showUnsavedChangesModal(currentLoc, targetLoc) {
    if (typeof document === "undefined") return;

    let modal = document.getElementById("unsaved-changes-modal");
    if (!modal && typeof document.createElement === "function") {
      modal = this._createUnsavedChangesModalDOM();
    }
    if (!modal) return;

    const msgEl = document.getElementById("unsaved-modal-msg");
    if (msgEl) {
      const locNames = {
        oficina: "Oficina Administrativa",
        produccion: "Sector Productivo",
        mercado: "Mercado Mayorista",
        banco: "Entidad Financiera"
      };
      const currLabel = locNames[currentLoc] || currentLoc;
      const targetLabel = locNames[targetLoc] || targetLoc;
      msgEl.textContent = `Has modificado parámetros en "${currLabel}" sin guardar explícitamente. Si te trasladas a "${targetLabel}" sin confirmar, se perderán las decisiones no guardadas.`;
    }

    modal.style.display = "flex";
  }

  /**
   * Hides the unsaved changes warning modal.
   * @private
   */
  _hideUnsavedChangesModal() {
    if (typeof document === "undefined") return;
    const modal = document.getElementById("unsaved-changes-modal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  /**
   * Creates fallback unsaved changes modal in DOM if not already present.
   * @private
   */
  _createUnsavedChangesModalDOM() {
    if (typeof document === "undefined" || typeof document.createElement !== "function") return null;
    const modal = document.createElement("div");
    modal.id = "unsaved-changes-modal";
    modal.className = "modal-overlay";
    modal.style.display = "none";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    modal.innerHTML = `
      <div class="modal-content unsaved-modal-box">
        <div class="unsaved-modal-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color, #333); padding-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">⚠️</span>
            <h3 style="margin: 0; font-size: 16px;">Cambios sin Guardar</h3>
          </div>
          <button id="btn-unsaved-close" type="button" class="btn-close-modal" aria-label="Cerrar">&times;</button>
        </div>
        <div class="modal-body" style="padding: 14px 0;">
          <p id="unsaved-modal-msg" style="margin: 0; font-size: 14px; line-height: 1.5;">
            Has modificado parámetros sin confirmación local. ¿Deseas guardar o descartar?
          </p>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid var(--border-color, #333); padding-top: 10px;">
          <button id="btn-unsaved-cancel" class="btn btn-secondary" type="button">Cancelar</button>
          <button id="btn-unsaved-discard" class="btn btn-danger" type="button">Descartar</button>
          <button id="btn-unsaved-save" class="btn btn-primary" type="button">Guardar y Continuar</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#btn-unsaved-cancel").addEventListener("click", () => this.cancelNavigation());
    modal.querySelector("#btn-unsaved-close").addEventListener("click", () => this.cancelNavigation());
    modal.querySelector("#btn-unsaved-discard").addEventListener("click", () => this.discardAndNavigate());
    modal.querySelector("#btn-unsaved-save").addEventListener("click", () => this.confirmSaveAndNavigate());

    return modal;
  }

  /**
   * Synchronizes DOM classes, body attributes and active scene panels.
   * @private
   */
  _syncDOM(activeLoc, prevLoc) {
    if (typeof document === "undefined") return;

    // 1. Set body data-attribute for contextual CSS scoping
    if (document.body) {
      document.body.setAttribute("data-spatial-location", activeLoc);
    }

    // 2. Update navigation buttons
    VALID_LOCATIONS.forEach(loc => {
      const btn = document.getElementById(`nav-btn-${loc}`);
      if (btn) {
        const isActive = loc === activeLoc;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      }
    });

    // 3. Update scene visibility
    VALID_LOCATIONS.forEach(loc => {
      const scene = document.getElementById(`scene-${loc}`);
      if (scene) {
        const isActive = loc === activeLoc;
        scene.classList.toggle("active", isActive);
        scene.style.display = isActive ? "block" : "none";
      }
    });
  }

  /**
   * Binds click events to spatial navigation buttons in the DOM.
   */
  bindUIElements() {
    if (typeof document === "undefined") return;

    VALID_LOCATIONS.forEach(loc => {
      const btn = document.getElementById(`nav-btn-${loc}`);
      if (btn) {
        btn.addEventListener("click", () => this.navigateTo(loc));
      }
    });

    // Also bind any generic elements with data-navigate-to attribute
    const navTriggers = document.querySelectorAll("[data-navigate-to]");
    navTriggers.forEach(el => {
      el.addEventListener("click", () => {
        const target = el.getAttribute("data-navigate-to");
        if (target) this.navigateTo(target);
      });
    });

    // Modal buttons binding if already present in DOM
    const btnCancel = document.getElementById("btn-unsaved-cancel");
    if (btnCancel) btnCancel.addEventListener("click", () => this.cancelNavigation());

    const btnClose = document.getElementById("btn-unsaved-close");
    if (btnClose) btnClose.addEventListener("click", () => this.cancelNavigation());

    const btnDiscard = document.getElementById("btn-unsaved-discard");
    if (btnDiscard) btnDiscard.addEventListener("click", () => this.discardAndNavigate());

    const btnSave = document.getElementById("btn-unsaved-save");
    if (btnSave) btnSave.addEventListener("click", () => this.confirmSaveAndNavigate());

    // Tutorial buttons binding (RF-10)
    const btnTutorialNext = document.getElementById("btn-tutorial-next");
    if (btnTutorialNext) {
      btnTutorialNext.addEventListener("click", () => {
        if (this.tutorialStep >= 5) {
          this.completeTutorial();
        } else {
          this.nextTutorialStep();
        }
      });
    }

    const btnTutorialSkip = document.getElementById("btn-tutorial-skip");
    if (btnTutorialSkip) {
      btnTutorialSkip.addEventListener("click", () => this.skipTutorial());
    }

    // Initialize tutorial modal if active
    this.initTutorial();
  }
}

// Default singleton instance
export const spatialNavigator = new SpatialNavigator();
