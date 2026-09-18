/**
 * YerbaMateSim - Scene Renderer & Tactical Console Orchestrator (ESM)
 * Bounded Context: 4-Quadrant Visual Displays & Turn Consolidation
 * Covered Functional Requirements: RF-02, RF-05, RF-06
 */

export class SceneRenderer {
  /**
   * Initializes the Scene Renderer.
   * @param {object} options
   * @param {Function} [options.onExecuteTurn] Callback for turn execution
   */
  constructor(options = {}) {
    this.onExecuteTurn = typeof options.onExecuteTurn === "function" ? options.onExecuteTurn : null;
    this.activeScene = "oficina";
  }

  /**
   * Formats a numeric monetary value to Argentine Pesos string.
   * @param {number} val
   * @returns {string}
   */
  formatMoney(val) {
    const num = Math.round(Number(val) || 0);
    return `$${num.toLocaleString("es-AR")}`;
  }

  /**
   * Renders the complete tactical console for Scene 1: Oficina Administrativa (RF-05).
   * @param {object} state Current GameState reference
   */
  renderOficina(state) {
    if (typeof document === "undefined" || !state) return;

    // 1. Resumen de Situación Semanal & Racha Competitiva (RF-05.1)
    const weekEl = document.getElementById("oficina-week-display");
    if (weekEl) {
      weekEl.textContent = `Semana ${state.week || 1} de ${state.max_weeks || 120}`;
    }

    const streakEl = document.getElementById("oficina-streak-display");
    if (streakEl) {
      const currentStreak = (state.player && state.player.streak && state.player.streak.current_win_streak) || 0;
      const maxStreak = (state.player && state.player.streak && state.player.streak.max_win_streak) || 0;
      streakEl.textContent = `${currentStreak} semanas invicto (Récord: ${maxStreak})`;
    }

    const solvencyEl = document.getElementById("oficina-solvency-badge");
    if (solvencyEl) {
      const ratio = (state.player && state.player.accounting && typeof state.player.accounting.debt_to_assets_ratio === "number")
        ? state.player.accounting.debt_to_assets_ratio
        : 0;
      
      if (ratio > 0.80) {
        solvencyEl.textContent = `⚠️ Quiebra Técnica (D/A: ${(ratio * 100).toFixed(1)}%)`;
        solvencyEl.className = "badge badge-danger";
      } else if (ratio > 0.50) {
        solvencyEl.textContent = `⚡ Alerta Endeudamiento (D/A: ${(ratio * 100).toFixed(1)}%)`;
        solvencyEl.className = "badge badge-warning";
      } else {
        solvencyEl.textContent = `✅ Solvente (D/A: ${(ratio * 100).toFixed(1)}%)`;
        solvencyEl.className = "badge badge-success";
      }
    }

    // 2. Balance General Sintético (RF-05.2)
    const accounting = (state.player && state.player.accounting) || {};
    const assetsEl = document.getElementById("oficina-assets-val");
    if (assetsEl) {
      assetsEl.textContent = this.formatMoney(accounting.total_assets || (state.player && state.player.cash) || 0);
    }

    const debtEl = document.getElementById("oficina-debt-val");
    if (debtEl) {
      debtEl.textContent = this.formatMoney(state.player && state.player.bank_debt);
    }

    const networthEl = document.getElementById("oficina-networth-val");
    if (networthEl) {
      networthEl.textContent = this.formatMoney(accounting.net_worth);
    }

    const ebitdaEl = document.getElementById("oficina-ebitda-val");
    if (ebitdaEl) {
      ebitdaEl.textContent = this.formatMoney(accounting.weekly_ebitda);
    }

    // 3. Buzón de Avisos Agronómicos INTA (RF-05.3)
    const intaContainer = document.getElementById("oficina-inta-alerts-container");
    if (intaContainer) {
      if (state.sanitary_event) {
        const evt = state.sanitary_event;
        intaContainer.innerHTML = `
          <div class="inta-alert-card active" style="border-left: 4px solid var(--warning, #eab308); padding: 8px 12px; background: rgba(234, 179, 8, 0.08); border-radius: 4px;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <strong style="color: var(--warning, #eab308); font-size: 13px;">🚨 ${evt.name || "Alerta Fitosanitaria"}</strong>
              <span class="badge" style="font-size: 10px;">INTA</span>
            </div>
            <p style="margin: 4px 0; font-size: 12px; color: var(--text-color, #e5e7eb);">
              UDE: <strong>${evt.ude || "Densidad poblacional superada"}</strong> | Impacto estimado: <strong>-${((evt.base_yield_impact_pct || 0) * 100).toFixed(0)}%</strong>
            </p>
            <div style="font-size: 11px; color: var(--text-muted, #9ca3af);">
              ${evt.bpa_mitigated ? "🛡️ Atenuación por Buenas Prácticas Agrícolas (BPA) activa." : "⚠️ Sin atenuación BPA. Riesgo agronómico pleno."}
            </div>
          </div>
        `;
      } else {
        intaContainer.innerHTML = `
          <div class="inta-alert-card clean" style="border-left: 4px solid var(--success, #22c55e); padding: 8px 12px; background: rgba(34, 197, 94, 0.08); border-radius: 4px;">
            <div style="color: var(--success, #22c55e); font-size: 13px; font-weight: bold;">🌱 Cuenca Yerbatera en Calma</div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-muted, #9ca3af);">
              Sin alertas fitosanitarias activas. Condiciones agroclimáticas y foliares estables.
            </p>
          </div>
        `;
      }
    }

    // 4. Consolidador de Decisiones Semanales de Otros Escenarios (RF-05.4)
    const ordersContainer = document.getElementById("oficina-orders-summary-container");
    if (ordersContainer) {
      const drafts = (state.spatial_ui && state.spatial_ui.drafts) || {};
      const confirmed = (state.spatial_ui && state.spatial_ui.confirmed_areas) || [];

      const pDraft = drafts.produccion || {};
      const mDraft = drafts.mercado || {};
      const bDraft = drafts.banco || {};

      const hasOrders = (pDraft.harvest_hectares || pDraft.sow_seedlings || pDraft.buy_dryer_capacity ||
                         mDraft.buy_green_leaf_kg || mDraft.buy_canchada_kg || mDraft.selling_price_ars ||
                         bDraft.debt_variation_ars !== undefined);

      if (!hasOrders) {
        ordersContainer.innerHTML = `
          <div style="padding: 10px; background: rgba(255, 255, 255, 0.03); border-radius: 4px; font-size: 12px; color: var(--text-muted, #9ca3af);">
            ℹ️ No hay órdenes cargadas en los departamentos. Visita Producción, Mercado o el Banco para planificar tu semana.
          </div>
        `;
      } else {
        ordersContainer.innerHTML = `
          <div class="orders-summary-grid" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px;">
            <div style="padding: 8px; background: rgba(255, 255, 255, 0.04); border-radius: 4px;">
              <strong style="color: var(--accent, #10b981);">🏭 Producción ${confirmed.includes("produccion") ? "✅" : "⏳"}</strong>
              <div style="margin-top: 4px; font-size: 11px;">
                Cosecha: ${pDraft.harvest_hectares || 0} ha<br/>
                Siembra: ${pDraft.sow_seedlings || 0} pl<br/>
                Cuadrilla: ${pDraft.crew_type || "BPA_MECANIZADA"}
              </div>
            </div>
            <div style="padding: 8px; background: rgba(255, 255, 255, 0.04); border-radius: 4px;">
              <strong style="color: var(--accent, #10b981);">🏪 Mercado ${confirmed.includes("mercado") ? "✅" : "⏳"}</strong>
              <div style="margin-top: 4px; font-size: 11px;">
                Compra Verde: ${pDraft.buy_green_leaf_kg || mDraft.buy_green_leaf_kg || 0} kg<br/>
                Compra Canchada: ${pDraft.buy_canchada_kg || mDraft.buy_canchada_kg || 0} kg<br/>
                Precio Góndola: $${mDraft.selling_price_ars || 3200}/kg
              </div>
            </div>
            <div style="padding: 8px; background: rgba(255, 255, 255, 0.04); border-radius: 4px;">
              <strong style="color: var(--accent, #10b981);">🏦 Banco ${confirmed.includes("banco") ? "✅" : "⏳"}</strong>
              <div style="margin-top: 4px; font-size: 11px;">
                Crédito/Amort.: ${this.formatMoney(bDraft.debt_variation_ars || 0)}<br/>
                Estado: ${confirmed.includes("banco") ? "Confirmado" : "Sin cambios"}
              </div>
            </div>
          </div>
        `;
      }
    }
  }

  /**
   * Consolidates departmental drafts into canonical execution orders.
   * @param {object} state
   * @returns {object}
   */
  consolidateOrders(state) {
    const drafts = (state && state.spatial_ui && state.spatial_ui.drafts) || {};
    const dProd = drafts.produccion || {};
    const dMerc = drafts.mercado || {};
    const dBanc = drafts.banco || {};

    return {
      // Production
      harvest_hectares: parseFloat(dProd.harvest_hectares) || 0,
      harvest_own_kg: parseFloat(dProd.harvest_own_kg) || 0,
      sow_seedlings: parseInt(dProd.sow_seedlings, 10) || 0,
      crew_type: dProd.crew_type || "BPA_MECANIZADA",
      labor_crew_type: dProd.crew_type || "BPA_MECANIZADA",
      aging_destination: dProd.aging_destination || "ACCELERATED",
      aging_type: (dProd.aging_destination === "NATURAL") ? "natural" : "accelerated",
      buy_dryer: parseFloat(dProd.buy_dryer_capacity || dProd.buy_dryer_cap_weekly) || 0,
      buy_aging_accel: (dProd.aging_destination !== "NATURAL") ? (parseFloat(dProd.buy_aging_capacity) || 0) : 0,
      buy_aging_natural: (dProd.aging_destination === "NATURAL") ? (parseFloat(dProd.buy_aging_capacity) || 0) : 0,
      buy_mill: parseFloat(dProd.buy_mill_capacity || dProd.buy_mill_cap_weekly) || 0,

      // Market
      buy_leaf: parseFloat(dMerc.buy_green_leaf_kg || dMerc.buy_leaf_kg) || 0,
      buy_canchada: parseFloat(dMerc.buy_canchada_kg) || 0,
      leaf_bypass_to_depot: !!(dMerc.leaf_bypass_to_depot),
      canchada_bypass_to_depot: dMerc.bypass_to_warehouse !== undefined ? !!dMerc.bypass_to_warehouse : (!!dMerc.canchada_bypass_to_depot || true),
      selling_price: parseFloat(dMerc.selling_price_ars) || 3200.0,

      // Bank
      debt_variation: parseFloat(dBanc.debt_variation_ars) || 0
    };
  }

  /**
   * Executes weekly turn strictly from Oficina Administrativa (RF-06).
   * @param {object} state
   * @returns {boolean} True if processed, false if rejected (location blocked)
   */
  executeTurnFromOficina(state) {
    if (!state || !state.spatial_ui || state.spatial_ui.active_location !== "oficina") {
      console.warn("[SceneRenderer] Operación denegada: La liquidación semanal y el cierre de turno solo pueden ejecutarse desde la Oficina Administrativa (RF-06).");
      return false;
    }

    const consolidated = this.consolidateOrders(state);

    if (typeof this.onExecuteTurn === "function") {
      this.onExecuteTurn(consolidated);
    } else if (typeof window !== "undefined" && typeof window.liquidateWeeklyTurn === "function") {
      window.liquidateWeeklyTurn(consolidated);
    }

    return true;
  }

  /**
   * Renders the complete tactical console for Scene 2: Sector Productivo & Planta Fabril (RF-07).
   * @param {object} state Current GameState reference
   */
  renderProduccion(state) {
    if (typeof document === "undefined" || !state) return;

    const player = state.player || {};
    const capacities = player.capacities || {};
    const inventories = player.inventories || {};
    const drafts = (state.spatial_ui && state.spatial_ui.drafts) || {};
    const pDraft = drafts.produccion || {};

    // 1. Vivero & Chacra (RF-07.1)
    const nurseryCapEl = document.getElementById("prod-nursery-cap-display");
    if (nurseryCapEl) {
      nurseryCapEl.textContent = `Capacidad vivero: ${capacities.nursery_seedlings_capacity || 300} plantines`;
    }

    const sowInput = document.getElementById("prod-sow-seedlings");
    if (sowInput) {
      if (pDraft.sow_seedlings !== undefined) {
        sowInput.value = String(pDraft.sow_seedlings);
      }
      sowInput.max = "300";
    }

    const hectaresEl = document.getElementById("prod-hectares-display");
    if (hectaresEl) {
      hectaresEl.textContent = `Superficie plantada: ${capacities.plantation_hectares || 10.0} ha`;
    }

    const harvestInput = document.getElementById("prod-harvest-hectares");
    if (harvestInput) {
      if (pDraft.harvest_hectares !== undefined) {
        harvestInput.value = String(pDraft.harvest_hectares);
      }
      harvestInput.max = String(capacities.plantation_hectares || 10.0);
    }

    const crewSelect = document.getElementById("prod-crew-type");
    if (crewSelect && pDraft.crew_type) {
      crewSelect.value = pDraft.crew_type;
    }

    // 2. Secadero & Nivel de Tolva (RF-07.2)
    const leafStock = inventories.green_leaf_kg || 0;
    const dryerCap = capacities.dryer_weekly_kg || 0;
    const hopperPct = dryerCap > 0 ? Math.min(100, Math.round((leafStock / dryerCap) * 100)) : 0;

    const hopperBar = document.getElementById("prod-hopper-bar");
    if (hopperBar) {
      hopperBar.style.width = `${hopperPct}%`;
      hopperBar.className = hopperPct > 95 ? "hopper-bar hopper-critical" : "hopper-bar";
    }

    const hopperPctEl = document.getElementById("prod-hopper-pct");
    if (hopperPctEl) {
      hopperPctEl.textContent = `${hopperPct}%`;
    }

    const hopperStockEl = document.getElementById("prod-hopper-stock");
    if (hopperStockEl) {
      hopperStockEl.textContent = `${Math.round(leafStock).toLocaleString("es-AR")} kg`;
    }

    const hopperCapEl = document.getElementById("prod-hopper-cap");
    if (hopperCapEl) {
      hopperCapEl.textContent = `${Math.round(dryerCap).toLocaleString("es-AR")} kg/sem`;
    }

    const ardidoAlert = document.getElementById("prod-ardido-alert");
    if (ardidoAlert) {
      ardidoAlert.style.display = hopperPct > 95 ? "block" : "none";
    }

    const dryerCapDisplay = document.getElementById("prod-dryer-cap-display");
    if (dryerCapDisplay) {
      dryerCapDisplay.textContent = `${Math.round(dryerCap).toLocaleString("es-AR")} kg/sem`;
    }

    // 3. Estacionamiento (RF-07.3)
    const agingCap = capacities.aging_accelerated_capacity_kg || capacities.aging_natural_capacity_kg || 0;
    const agingCapDisplay = document.getElementById("prod-aging-cap-display");
    if (agingCapDisplay) {
      agingCapDisplay.textContent = `${Math.round(agingCap).toLocaleString("es-AR")} kg`;
    }

    const agingSelect = document.getElementById("prod-aging-destination");
    if (agingSelect && pDraft.aging_destination) {
      agingSelect.value = pDraft.aging_destination;
    }

    // 4. Molienda (RF-07.4)
    const millCap = capacities.mill_weekly_kg || 0;
    const millCapDisplay = document.getElementById("prod-mill-cap-display");
    if (millCapDisplay) {
      millCapDisplay.textContent = `${Math.round(millCap).toLocaleString("es-AR")} kg/sem`;
    }
  }

  /**
   * Collects current input values from Producción DOM controls.
   * @returns {object} Draft object for Producción
   */
  getProduccionDraftFromDOM() {
    if (typeof document === "undefined") return {};

    const sowEl = document.getElementById("prod-sow-seedlings");
    const harvestEl = document.getElementById("prod-harvest-hectares");
    const crewEl = document.getElementById("prod-crew-type");
    const agingEl = document.getElementById("prod-aging-destination");
    const dryerCapexEl = document.getElementById("prod-capex-dryer-input");
    const agingCapexEl = document.getElementById("prod-capex-aging-input");
    const millCapexEl = document.getElementById("prod-capex-mill-input");

    const rawSow = sowEl ? parseInt(sowEl.value, 10) : 0;
    const sow = isNaN(rawSow) ? 0 : Math.min(300, Math.max(0, rawSow));

    const rawHarvest = harvestEl ? parseFloat(harvestEl.value) : 0;
    const harvest = isNaN(rawHarvest) ? 0 : Math.max(0, rawHarvest);

    const rawDryerCapex = dryerCapexEl ? parseFloat(dryerCapexEl.value) : 0;
    const dryerCapex = isNaN(rawDryerCapex) ? 0 : Math.max(0, rawDryerCapex);

    const rawAgingCapex = agingCapexEl ? parseFloat(agingCapexEl.value) : 0;
    const agingCapex = isNaN(rawAgingCapex) ? 0 : Math.max(0, rawAgingCapex);

    const rawMillCapex = millCapexEl ? parseFloat(millCapexEl.value) : 0;
    const millCapex = isNaN(rawMillCapex) ? 0 : Math.max(0, rawMillCapex);

    return {
      sow_seedlings: sow,
      harvest_hectares: harvest,
      crew_type: crewEl ? crewEl.value : "BPA_MECANIZADA",
      aging_destination: agingEl ? agingEl.value : "ACCELERATED",
      buy_dryer_capacity: dryerCapex,
      buy_aging_capacity: agingCapex,
      buy_mill_capacity: millCapex
    };
  }

  /**
   * Saves Producción draft collected from DOM via SpatialNavigator.
   * @param {object} state
   * @param {object} spatialNavigator
   * @returns {boolean} True if saved, false if blocked by liquidity
   */
  saveProduccionFromDOM(state, spatialNavigator) {
    const draft = this.getProduccionDraftFromDOM();
    if (!spatialNavigator) return false;
    return spatialNavigator.saveLocationDraft("produccion", draft);
  }

  /**
   * Renders Scene 3: Mercado Mayorista & Comercial (RF-08).
   * Displays spot quotes, regional demand board, competitor price, and elasticity feedback.
   * Restores Mercado draft from state.spatial_ui.drafts.mercado.
   * @param {object} state
   */
  renderMercado(state) {
    if (typeof document === "undefined" || !state) return;

    const market = state.market || {};
    const leafSpot = typeof market.leaf_spot_price === "number" ? market.leaf_spot_price : 250.0;
    const canchadaSpot = typeof market.canchada_spot_price === "number" ? market.canchada_spot_price : 950.0;
    const demandLimit = typeof market.weekly_demand_limit_kg === "number" ? market.weekly_demand_limit_kg : 6000.0;
    const shares = market.shares_previous_week || {};
    const botPrice = typeof shares.bot_price_previous_week === "number"
      ? shares.bot_price_previous_week
      : (typeof market.final_yerba_base_price === "number" ? market.final_yerba_base_price : 3200.0);
    const playerShare = typeof shares.player_share_pct === "number" ? shares.player_share_pct : 40.0;
    const botShare = typeof shares.bot_share_pct === "number" ? shares.bot_share_pct : 40.0;

    // 1. Pizarra regional y cotizaciones spot (RF-08.1, RF-08.4)
    const leafPriceEl = document.getElementById("merc-leaf-price");
    if (leafPriceEl) {
      leafPriceEl.textContent = `$${leafSpot.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg`;
    }

    const canchadaPriceEl = document.getElementById("merc-canchada-price");
    if (canchadaPriceEl) {
      canchadaPriceEl.textContent = `$${canchadaSpot.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg`;
    }

    const boardDemandEl = document.getElementById("merc-board-demand");
    if (boardDemandEl) {
      boardDemandEl.textContent = `${Math.round(demandLimit).toLocaleString("es-AR")} kg/sem`;
    }

    const rivalPriceEl = document.getElementById("merc-rival-price-display");
    if (rivalPriceEl) {
      rivalPriceEl.textContent = `$${Math.round(botPrice).toLocaleString("es-AR")}/kg`;
    }

    const sharePlayerEl = document.getElementById("merc-share-player-display");
    if (sharePlayerEl) {
      sharePlayerEl.textContent = `${playerShare.toFixed(1)}%`;
    }

    const shareBotEl = document.getElementById("merc-share-bot-display");
    if (shareBotEl) {
      shareBotEl.textContent = `${botShare.toFixed(1)}%`;
    }

    // 2. Restauración de borrador de Mercado
    const drafts = (state.spatial_ui && state.spatial_ui.drafts) || {};
    const mDraft = drafts.mercado || {};

    const buyLeafEl = document.getElementById("merc-buy-leaf");
    if (buyLeafEl) {
      const leafVal = mDraft.buy_leaf_kg !== undefined ? mDraft.buy_leaf_kg : (mDraft.buy_green_leaf_kg || 0);
      buyLeafEl.value = String(leafVal);
    }

    const buyCanchadaEl = document.getElementById("merc-buy-canchada");
    if (buyCanchadaEl) {
      buyCanchadaEl.value = String(mDraft.buy_canchada_kg || 0);
    }

    const bypassEl = document.getElementById("merc-bypass-warehouse");
    if (bypassEl) {
      bypassEl.checked = mDraft.bypass_to_warehouse !== undefined ? !!mDraft.bypass_to_warehouse : true;
    }

    const rawPrice = mDraft.selling_price_ars !== undefined ? mDraft.selling_price_ars : 3200;
    const price = Math.min(4200, Math.max(2800, parseFloat(rawPrice) || 3200));

    const sliderEl = document.getElementById("merc-selling-price-slider");
    if (sliderEl) {
      sliderEl.value = String(price);
    }

    const priceInputEl = document.getElementById("merc-selling-price-input");
    if (priceInputEl) {
      priceInputEl.value = String(price);
    }

    // 3. Retroalimentación síncrona de elasticidad y absorción (RF-08.3)
    this.updateMercadoElasticity(state, price);
  }

  /**
   * Updates elasticity and market absorption displays synchronously (RF-08.3).
   * @param {object} state
   * @param {number} sellingPrice
   */
  updateMercadoElasticity(state, sellingPrice) {
    if (typeof document === "undefined") return;

    const market = (state && state.market) || {};
    const demandLimit = typeof market.weekly_demand_limit_kg === "number" ? market.weekly_demand_limit_kg : 6000.0;
    const shares = market.shares_previous_week || {};
    const botPrice = typeof shares.bot_price_previous_week === "number"
      ? shares.bot_price_previous_week
      : (typeof market.final_yerba_base_price === "number" ? market.final_yerba_base_price : 3200.0);

    const price = Math.min(4200, Math.max(2800, parseFloat(sellingPrice) || 3200));

    // Elasticity calculation: priceDeltaPct = (botPrice - playerPrice) / botPrice
    const priceDeltaPct = botPrice > 0 ? (botPrice - price) / botPrice : 0;
    const absorbed = Math.max(0, Math.round(demandLimit * (1.0 + priceDeltaPct)));

    const priceDisplay = document.getElementById("merc-price-display");
    if (priceDisplay) {
      priceDisplay.textContent = `$${Math.round(price).toLocaleString("es-AR")}/kg`;
    }

    const absorbedDisplay = document.getElementById("merc-absorbed-demand-display");
    if (absorbedDisplay) {
      absorbedDisplay.textContent = `${absorbed.toLocaleString("es-AR")} kg/sem`;
    }

    const elasticityPctDisplay = document.getElementById("merc-elasticity-pct-display");
    if (elasticityPctDisplay) {
      const pctVal = priceDeltaPct * 100;
      const sign = pctVal > 0 ? "+" : "";
      const note = pctVal > 0 ? "(Más barato que rival)" : (pctVal < 0 ? "(Más caro que rival)" : "(Mismo precio)");
      elasticityPctDisplay.textContent = `${sign}${pctVal.toFixed(1)}% ${note}`;
      elasticityPctDisplay.className = pctVal >= 0 ? "val-positive" : "val-warning";
    }
  }

  /**
   * Collects current input values from Mercado DOM controls.
   * @returns {object} Draft object for Mercado
   */
  getMercadoDraftFromDOM() {
    if (typeof document === "undefined") return {};

    const leafEl = document.getElementById("merc-buy-leaf");
    const canchadaEl = document.getElementById("merc-buy-canchada");
    const bypassEl = document.getElementById("merc-bypass-warehouse");
    const sliderEl = document.getElementById("merc-selling-price-slider");
    const priceInputEl = document.getElementById("merc-selling-price-input");

    const rawLeaf = leafEl ? parseFloat(leafEl.value) : 0;
    const leaf = isNaN(rawLeaf) ? 0 : Math.max(0, rawLeaf);

    const rawCanchada = canchadaEl ? parseFloat(canchadaEl.value) : 0;
    const canchada = isNaN(rawCanchada) ? 0 : Math.max(0, rawCanchada);

    const rawPrice = priceInputEl && priceInputEl.value ? parseFloat(priceInputEl.value) : (sliderEl ? parseFloat(sliderEl.value) : 3200);
    const price = isNaN(rawPrice) ? 3200 : Math.min(4200, Math.max(2800, rawPrice));

    const bypass = bypassEl ? bypassEl.checked : true;

    return {
      buy_leaf_kg: leaf,
      buy_green_leaf_kg: leaf,
      buy_canchada_kg: canchada,
      bypass_to_warehouse: bypass,
      selling_price_ars: price
    };
  }

  /**
   * Saves Mercado draft collected from DOM via SpatialNavigator.
   * @param {object} state
   * @param {object} spatialNavigator
   * @returns {boolean} True if saved, false if blocked by liquidity
   */
  saveMercadoFromDOM(state, spatialNavigator) {
    const draft = this.getMercadoDraftFromDOM();
    if (!spatialNavigator) return false;
    return spatialNavigator.saveLocationDraft("mercado", draft);
  }

  /**
   * Renders Scene 4: Entidad Financiera / Banco (RF-09).
   * Displays debt position, weekly interest rate (0.7429%), projected interest,
   * rigid debt cap (D/A <= 0.80), bilateral credit/amortization slider, and solvency semaphore.
   * @param {object} state Current GameState reference
   */
  renderBanco(state) {
    if (typeof document === "undefined" || !state) return;

    const player = state.player || {};
    const accounting = player.accounting || {};
    const bankDebt = typeof player.bank_debt === "number" ? player.bank_debt : 0.0;
    const totalAssets = typeof accounting.total_assets === "number" ? accounting.total_assets : (player.cash || 0.0);

    // 1. Posición de Deuda & Condiciones (RF-09.1)
    const currentDebtEl = document.getElementById("banco-current-debt");
    if (currentDebtEl) {
      currentDebtEl.textContent = this.formatMoney(bankDebt);
    }

    const interestRateEl = document.getElementById("banco-interest-rate");
    if (interestRateEl) {
      interestRateEl.textContent = "0.7429% semanal";
    }

    const totalAssetsEl = document.getElementById("banco-total-assets");
    if (totalAssetsEl) {
      totalAssetsEl.textContent = this.formatMoney(totalAssets);
    }

    // 2. Rigid Debt Cap calculation: (0.80 * Assets - Debt) / 0.20 (RF-09.3)
    const maxBorrow = totalAssets > 0 ? Math.max(0.0, Math.floor((0.80 * totalAssets - bankDebt) / 0.20)) : 0.0;
    const maxCreditDisplay = document.getElementById("banco-max-credit-display");
    if (maxCreditDisplay) {
      maxCreditDisplay.textContent = this.formatMoney(maxBorrow);
    }

    // 3. Bilateral Slider Bounds: [-bankDebt, +maxBorrow]
    const minAmortize = -Math.round(bankDebt);
    const maxCredit = Math.round(maxBorrow);

    const sliderEl = document.getElementById("banco-credit-slider");
    if (sliderEl) {
      sliderEl.min = String(minAmortize);
      sliderEl.max = String(maxCredit);
    }

    const inputEl = document.getElementById("banco-debt-variation-input");
    if (inputEl) {
      inputEl.min = String(minAmortize);
      inputEl.max = String(maxCredit);
    }

    // 4. Restore draft if available
    const drafts = (state.spatial_ui && state.spatial_ui.drafts) || {};
    const bDraft = drafts.banco || {};
    const variation = typeof bDraft.debt_variation_ars === "number" ? bDraft.debt_variation_ars : (bDraft.debt_variation || 0);

    if (sliderEl) {
      sliderEl.value = String(variation);
    }
    if (inputEl) {
      inputEl.value = String(variation);
    }

    // 5. Synchronous update of interest, leverage ratio and solvency semaphore (RF-09.4)
    this.updateBancoLeverage(state, variation);
  }

  /**
   * Updates projected debt interest, leverage ratio D/A, and solvency semaphore synchronously (RF-09.4).
   * @param {object} state
   * @param {number} variation
   */
  updateBancoLeverage(state, variation) {
    if (typeof document === "undefined") return;

    const player = (state && state.player) || {};
    const accounting = player.accounting || {};
    const bankDebt = typeof player.bank_debt === "number" ? player.bank_debt : 0.0;
    const totalAssets = typeof accounting.total_assets === "number" ? accounting.total_assets : (player.cash || 0.0);

    const varNum = parseFloat(variation) || 0;

    // Projected debt and assets
    const projDebt = Math.max(0, bankDebt + varNum);
    const projAssets = Math.max(1.0, totalAssets + (varNum > 0 ? varNum : 0));
    const leverageRatio = projAssets > 0 ? (projDebt / projAssets) : 0.0;

    // Weekly interest: 0.7429%
    const weeklyInterest = projDebt * 0.007429;

    const weeklyInterestEl = document.getElementById("banco-weekly-interest");
    if (weeklyInterestEl) {
      weeklyInterestEl.textContent = this.formatMoney(weeklyInterest);
    }

    const variationDisplay = document.getElementById("banco-variation-display");
    if (variationDisplay) {
      if (varNum > 0) {
        variationDisplay.textContent = `+${this.formatMoney(varNum)} (Préstamo)`;
        if (variationDisplay.style) variationDisplay.style.color = "#60a5fa";
      } else if (varNum < 0) {
        variationDisplay.textContent = `-${this.formatMoney(Math.abs(varNum))} (Amortización)`;
        if (variationDisplay.style) variationDisplay.style.color = "#10b981";
      } else {
        variationDisplay.textContent = "$0 (Sin cambio)";
        if (variationDisplay.style) variationDisplay.style.color = "var(--text-muted, #94a3b8)";
      }
    }

    const ratioDisplay = document.getElementById("banco-leverage-ratio-display");
    if (ratioDisplay) {
      ratioDisplay.textContent = `${(leverageRatio * 100).toFixed(1)}%`;
    }

    const semaphoreEl = document.getElementById("banco-solvency-semaphore");
    if (semaphoreEl) {
      if (leverageRatio >= 0.80) {
        semaphoreEl.textContent = `⚠️ Quiebra Inminente (D/A: ${(leverageRatio * 100).toFixed(1)}% ≥ 80%)`;
        semaphoreEl.className = "badge badge-danger";
      } else if (leverageRatio > 0.70) {
        semaphoreEl.textContent = `⚠️ Riesgo Crítico / Próximo a Quiebra (D/A: ${(leverageRatio * 100).toFixed(1)}%)`;
        semaphoreEl.className = "badge badge-danger";
      } else if (leverageRatio >= 0.50) {
        semaphoreEl.textContent = `⚡ Precaución / Endeudamiento Moderado (D/A: ${(leverageRatio * 100).toFixed(1)}%)`;
        semaphoreEl.className = "badge badge-warning";
      } else {
        semaphoreEl.textContent = `✅ Solvente / Bajo Riesgo (D/A: ${(leverageRatio * 100).toFixed(1)}%)`;
        semaphoreEl.className = "badge badge-success";
      }
    }
  }

  /**
   * Collects current input values from Banco DOM controls.
   * @returns {object} Draft object for Banco
   */
  getBancoDraftFromDOM() {
    if (typeof document === "undefined") return {};

    const inputEl = document.getElementById("banco-debt-variation-input");
    const sliderEl = document.getElementById("banco-credit-slider");

    let val = 0;
    if (inputEl && inputEl.value !== "" && !isNaN(parseFloat(inputEl.value)) && parseFloat(inputEl.value) !== 0) {
      val = parseFloat(inputEl.value);
    } else if (sliderEl && sliderEl.value !== "" && !isNaN(parseFloat(sliderEl.value))) {
      val = parseFloat(sliderEl.value);
    } else if (inputEl && inputEl.value !== "" && !isNaN(parseFloat(inputEl.value))) {
      val = parseFloat(inputEl.value);
    }

    return {
      debt_variation_ars: val
    };
  }

  /**
   * Saves Banco draft collected from DOM via SpatialNavigator.
   * @param {object} state
   * @param {object} spatialNavigator
   * @returns {boolean} True if saved, false if blocked by liquidity
   */
  saveBancoFromDOM(state, spatialNavigator) {
    const draft = this.getBancoDraftFromDOM();
    if (!spatialNavigator) return false;
    return spatialNavigator.saveLocationDraft("banco", draft);
  }

  /**
   * Binds UI click listeners for scene buttons.
   * @param {object} stateProvider Function or object returning current state
   * @param {object} [spatialNavigator] Spatial navigator instance for local save actions
   */
  bindUI(stateProvider, spatialNavigator = null) {
    if (typeof document === "undefined") return;

    const getState = () => typeof stateProvider === "function" ? stateProvider() : (stateProvider || (typeof window !== "undefined" ? window.gameState : null));
    const getNav = () => spatialNavigator || (typeof window !== "undefined" ? (window.YerbaMateSimModules?.spatial?.spatialNavigator || window.spatialNavigator) : null);

    const btnExecutes = document.querySelectorAll(".btn-execute-turn, #btn-execute-turn, #btn-oficina-execute");
    btnExecutes.forEach(btn => {
      btn.addEventListener("click", () => {
        const state = getState();
        this.executeTurnFromOficina(state);
      });
    });

    const triggerProjections = () => {
      const state = getState();
      if (typeof window !== "undefined" && window.updateBottomBarProjections) {
        window.updateBottomBarProjections();
      }
      if (state && typeof this.renderOficina === "function") {
        this.renderOficina(state);
      }
    };

    // Producción Save Button
    const btnSaveProd = document.getElementById("btn-save-produccion");
    if (btnSaveProd) {
      btnSaveProd.addEventListener("click", () => {
        const state = getState();
        const nav = getNav();
        const success = this.saveProduccionFromDOM(state, nav);
        if (success) {
          const originalHtml = btnSaveProd.innerHTML;
          btnSaveProd.innerHTML = '<span class="pixel-icon icon-check"></span> ¡Órdenes de Producción Guardadas!';
          btnSaveProd.classList.add("btn-success");
          setTimeout(() => {
            btnSaveProd.innerHTML = originalHtml;
            btnSaveProd.classList.remove("btn-success");
          }, 2000);
          triggerProjections();
        }
      });
    }

    // Mercado Save Button
    const btnSaveMerc = document.getElementById("btn-save-mercado");
    if (btnSaveMerc) {
      btnSaveMerc.addEventListener("click", () => {
        const state = getState();
        const nav = getNav();
        const success = this.saveMercadoFromDOM(state, nav);
        if (success) {
          const originalHtml = btnSaveMerc.innerHTML;
          btnSaveMerc.innerHTML = '<span class="pixel-icon icon-check"></span> ¡Órdenes de Mercado Guardadas!';
          btnSaveMerc.classList.add("btn-success");
          setTimeout(() => {
            btnSaveMerc.innerHTML = originalHtml;
            btnSaveMerc.classList.remove("btn-success");
          }, 2000);
          triggerProjections();
        }
      });
    }

    // Banco Save Button
    const btnSaveBanc = document.getElementById("btn-save-banco");
    if (btnSaveBanc) {
      btnSaveBanc.addEventListener("click", () => {
        const state = getState();
        const nav = getNav();
        const success = this.saveBancoFromDOM(state, nav);
        if (success) {
          const originalHtml = btnSaveBanc.innerHTML;
          btnSaveBanc.innerHTML = '<span class="pixel-icon icon-check"></span> ¡Operación Financiera Confirmada!';
          btnSaveBanc.classList.add("btn-success");
          setTimeout(() => {
            btnSaveBanc.innerHTML = originalHtml;
            btnSaveBanc.classList.remove("btn-success");
          }, 2000);
          triggerProjections();
        }
      });
    }

    // CapEx Increment Buttons in Producción
    const capexDryerBtn = document.getElementById("prod-capex-dryer");
    if (capexDryerBtn) {
      capexDryerBtn.addEventListener("click", () => {
        const input = document.getElementById("prod-capex-dryer-input");
        if (input) {
          const cur = parseFloat(input.value) || 0;
          input.value = String(cur + 500);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    const capexAgingBtn = document.getElementById("prod-capex-aging");
    if (capexAgingBtn) {
      capexAgingBtn.addEventListener("click", () => {
        const input = document.getElementById("prod-capex-aging-input");
        if (input) {
          const cur = parseFloat(input.value) || 0;
          input.value = String(cur + 1000);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    const capexMillBtn = document.getElementById("prod-capex-mill");
    if (capexMillBtn) {
      capexMillBtn.addEventListener("click", () => {
        const input = document.getElementById("prod-capex-mill-input");
        if (input) {
          const cur = parseFloat(input.value) || 0;
          input.value = String(cur + 500);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }

    // Producción reactive listeners
    const prodInputs = [
      "prod-sow-seedlings",
      "prod-harvest-hectares",
      "prod-crew-type",
      "prod-aging-destination",
      "prod-capex-dryer-input",
      "prod-capex-aging-input",
      "prod-capex-mill-input"
    ];
    prodInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("input", () => {
          const nav = getNav();
          if (nav) nav.markDirty("produccion");
          triggerProjections();
        });
        el.addEventListener("change", () => {
          const nav = getNav();
          if (nav) nav.markDirty("produccion");
          triggerProjections();
        });
      }
    });

    // Mercado reactive listeners
    const sliderEl = document.getElementById("merc-selling-price-slider");
    const priceInputEl = document.getElementById("merc-selling-price-input");

    const onPriceChange = (newVal) => {
      const state = getState();
      const nav = getNav();
      if (nav) nav.markDirty("mercado");
      this.updateMercadoElasticity(state, newVal);
      triggerProjections();
    };

    if (sliderEl) {
      sliderEl.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value) || 3200;
        if (priceInputEl) priceInputEl.value = String(val);
        onPriceChange(val);
      });
    }

    if (priceInputEl) {
      priceInputEl.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value) || 3200;
        if (sliderEl) sliderEl.value = String(val);
        onPriceChange(val);
      });
    }

    const buyLeafInput = document.getElementById("merc-buy-leaf");
    if (buyLeafInput) {
      buyLeafInput.addEventListener("input", () => {
        const nav = getNav();
        if (nav) nav.markDirty("mercado");
        triggerProjections();
      });
    }

    const buyCanchadaInput = document.getElementById("merc-buy-canchada");
    if (buyCanchadaInput) {
      buyCanchadaInput.addEventListener("input", () => {
        const nav = getNav();
        if (nav) nav.markDirty("mercado");
        triggerProjections();
      });
    }

    const bypassInput = document.getElementById("merc-bypass-warehouse");
    if (bypassInput) {
      bypassInput.addEventListener("change", () => {
        const nav = getNav();
        if (nav) nav.markDirty("mercado");
        triggerProjections();
      });
    }

    // Banco reactive listeners
    const bSlider = document.getElementById("banco-credit-slider");
    const bInput = document.getElementById("banco-debt-variation-input");

    const onBancoChange = (newVal) => {
      const state = getState();
      const nav = getNav();
      if (nav) nav.markDirty("banco");
      this.updateBancoLeverage(state, newVal);
      triggerProjections();
    };

    if (bSlider) {
      bSlider.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value) || 0;
        if (bInput) bInput.value = String(val);
        onBancoChange(val);
      });
    }

    if (bInput) {
      bInput.addEventListener("input", (e) => {
        const val = parseFloat(e.target.value) || 0;
        if (bSlider) bSlider.value = String(val);
        onBancoChange(val);
      });
    }
  }
}

// Default singleton instance
export const sceneRenderer = new SceneRenderer();
