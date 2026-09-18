/**
 * Real-time Financial Projection Engine for YerbaMateSim (T14, T18 / RF-03, RF-07, RF-09).
 * Computes deterministic dry-run estimates in <10 ms to power the bottom sticky bar.
 * Strict mathematical parity with yerbamate/projections.py.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.projections = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CONSTANTS = {
    COST_PER_DRYER_WEEKLY_KG: 150.0,
    COST_PER_AGING_NATURAL_CAP_KG: 40.0,
    COST_PER_AGING_ACCEL_CAP_KG: 95.0,
    COST_PER_MILL_WEEKLY_KG: 200.0,
    COST_PER_NURSERY_CAP_UNIT: 100.0,
    COST_PER_HECTARE_PREPARATION: 350000.0,
    BASE_FIXED_COST_PER_WEEK: 40000.0,
    MAX_LEVERAGE_RATIO: 0.80,
    MAX_NURSERY_CAPACITY: 300,
    WEEKLY_INTEREST_RATE: Math.pow(1.0 + 0.4678, 1.0 / 52.0) - 1.0, // ~0.007429
    HARVEST_YIELD_KG_PER_HECTARE: 8500.0,
    HARVEST_OP_COST_PER_KG_BPA: 145.0,
    HARVEST_OP_COST_PER_KG_TRAD: 110.0,
    HARVEST_OP_COST_PER_KG: 145.0,
  };

  /**
   * Compute instant financial and operational projections for draft decisions across all phases.
   *
   * @param {Object} state - Current GameState (player, market, week, etc.)
   * @param {Object} [phase1] - { harvest_hectares, harvest_own_kg, buy_green_leaf_kg, buy_canchada_kg, sow_seedlings_units, labor_crew_type, crew_type }
   * @param {Object} [phase2] - { expand_dryer_kg, expand_aging_accel_kg, expand_mill_kg, buy_nursery_cap, prepare_hectares, buy_dryer_cap_weekly, buy_aging_natural_cap, buy_aging_accel_cap, buy_mill_cap_weekly }
   * @param {Object} [phase3] - { selling_price_per_kg, debt_variation_request, mill_and_package_natural_kg, mill_and_package_accel_kg }
   * @returns {Object} ProjectionResult
   */
  function calculateProjections(state, phase1, phase2, phase3) {
    if (phase1 && (phase1.produccion || phase1.mercado || phase1.banco)) {
      const mapped = mapSpatialDraftsToPhases(phase1, state);
      return calculateProjections(state, mapped.phase1, mapped.phase2, mapped.phase3);
    }

    const p1 = phase1 || {};
    const p2 = phase2 || {};
    const p3 = phase3 || {};

    const harvestOwnKg = Math.max(0, parseFloat(p1.harvest_own_kg) || 0);
    const harvestHec = Math.max(0, parseFloat(p1.harvest_hectares) || 0);
    const buyLeaf = Math.max(0, parseFloat(p1.buy_green_leaf_kg) || 0);
    const buyCanchada = Math.max(0, parseFloat(p1.buy_canchada_kg) || 0);

    const crewVal = String(p1.labor_crew_type || p1.crew_type || "BPA_MECANIZADA").toUpperCase();
    const isTrad = crewVal.includes("TRAD") || crewVal.includes("INFORMAL");
    const harvestOpCostPerKg = isTrad ? CONSTANTS.HARVEST_OP_COST_PER_KG_TRAD : CONSTANTS.HARVEST_OP_COST_PER_KG_BPA;

    const expDryer = Math.max(0, parseFloat(p2.buy_dryer_cap_weekly) || parseFloat(p2.expand_dryer_kg) || 0);
    const expAgingAccel = Math.max(0, parseFloat(p2.buy_aging_accel_cap) || parseFloat(p2.expand_aging_accel_kg) || 0);
    const expAgingNat = Math.max(0, parseFloat(p2.buy_aging_natural_cap) || 0);
    const expMill = Math.max(0, parseFloat(p2.buy_mill_cap_weekly) || parseFloat(p2.expand_mill_kg) || 0);
    const buyNursery = Math.max(0, parseInt(p2.buy_nursery_cap, 10) || 0);
    const prepHectares = Math.max(0, parseFloat(p2.prepare_hectares) || 0);

    const rawSellingPrice = p3.selling_price_per_kg !== undefined && p3.selling_price_per_kg !== null
      ? parseFloat(p3.selling_price_per_kg)
      : null;
    const sellingPrice = (rawSellingPrice !== null && isFinite(rawSellingPrice) && rawSellingPrice > 0)
      ? rawSellingPrice
      : null;
    const rawDebtVar = parseFloat(p3.debt_variation_request);
    const debtVar = isFinite(rawDebtVar) ? rawDebtVar : 0.0;

    const player = state.player;
    const market = state.market;

    // 1. Phase 1 expenditures: Harvest operation + Spot purchases
    let harvestCost = 0.0;
    if (harvestOwnKg > 0) {
      harvestCost = harvestOwnKg * harvestOpCostPerKg;
    } else if (harvestHec > 0) {
      harvestCost = harvestHec * CONSTANTS.HARVEST_YIELD_KG_PER_HECTARE * harvestOpCostPerKg;
    }
    const leafPurchaseCost = buyLeaf * market.leaf_spot_price;
    const canchadaPurchaseCost = buyCanchada * market.canchada_spot_price;
    const totalSupplyCost = harvestCost + leafPurchaseCost + canchadaPurchaseCost;

    // 2. Phase 2 expenditures: CapEx investments
    const dryerCapex = expDryer * CONSTANTS.COST_PER_DRYER_WEEKLY_KG;
    const agingCapex = (expAgingAccel * CONSTANTS.COST_PER_AGING_ACCEL_CAP_KG) + (expAgingNat * CONSTANTS.COST_PER_AGING_NATURAL_CAP_KG);
    const millCapex = expMill * CONSTANTS.COST_PER_MILL_WEEKLY_KG;
    const nurseryCapex = buyNursery * CONSTANTS.COST_PER_NURSERY_CAP_UNIT;
    const hectaresCapex = prepHectares * CONSTANTS.COST_PER_HECTARE_PREPARATION;
    const totalCapex = dryerCapex + agingCapex + millCapex + nurseryCapex + hectaresCapex;

    // 3. Fixed operating costs and weekly interest on existing debt
    const currentDebt = player.bank_debt || 0.0;
    const weeklyInterest = currentDebt * CONSTANTS.WEEKLY_INTEREST_RATE;
    const totalOutflows = totalSupplyCost + totalCapex + CONSTANTS.BASE_FIXED_COST_PER_WEEK + weeklyInterest;

    // 4. Projected revenues: If price is defined and inventory exists
    let projectedRevenue = 0.0;
    if (sellingPrice !== null && sellingPrice > 0) {
      const availableStock = (player.inventories && player.inventories.packaged_yerba_kg) || 0;
      const expectedDemand = market.weekly_demand_limit_kg || 0;
      const salesKg = Math.min(availableStock, expectedDemand);
      projectedRevenue = salesKg * sellingPrice;
    }

    // 5. Cash flow variation and projected closing cash
    const cashFlowVariation = +(projectedRevenue - totalOutflows).toFixed(2);
    const rawProjectedCash = +(player.cash + cashFlowVariation + debtVar).toFixed(2);

    // 6. Balance sheet estimation (Assets and Debt)
    const currentAssets = (player.accounting && player.accounting.total_assets) || 0.0;
    const nonCashAssets = Math.max(0.0, currentAssets - Math.max(0.0, player.cash));
    const capitalizedNewAssets = totalSupplyCost + totalCapex;

    let projectedDebt;
    let cashForAssets;

    if (rawProjectedCash < 0) {
      const deficit = -rawProjectedCash;
      projectedDebt = currentDebt + Math.max(0.0, debtVar) + deficit;
      cashForAssets = 0.0;
    } else {
      projectedDebt = Math.max(0.0, currentDebt + debtVar);
      cashForAssets = rawProjectedCash;
    }

    const projectedAssets = +(nonCashAssets + capitalizedNewAssets + cashForAssets).toFixed(2);
    const projectedDebtRatio = projectedAssets > 0
      ? +(projectedDebt / projectedAssets).toFixed(4)
      : 1.0;

    // 7. Rigid debt cap formula: Delta D <= (0.80 * A - D) / 0.20
    let maxAllowedDebtBorrowing = 0.0;
    if (projectedAssets > 0) {
      const maxBorrowing = (CONSTANTS.MAX_LEVERAGE_RATIO * projectedAssets - projectedDebt) / (1.0 - CONSTANTS.MAX_LEVERAGE_RATIO);
      maxAllowedDebtBorrowing = Math.max(0.0, +maxBorrowing.toFixed(2));
    }

    // 8. Liquidity risk alert and warning levels (RF-01, RF-09)
    let liquidityRiskAlert = false;
    if (rawProjectedCash < 0) {
      if (projectedDebtRatio >= CONSTANTS.MAX_LEVERAGE_RATIO || (-rawProjectedCash > maxAllowedDebtBorrowing)) {
        liquidityRiskAlert = true;
      }
    }

    let warningLevel = "normal";
    let isViable = true;
    if (projectedDebtRatio >= CONSTANTS.MAX_LEVERAGE_RATIO || (rawProjectedCash < 0 && -rawProjectedCash > maxAllowedDebtBorrowing)) {
      warningLevel = "critical";
      isViable = false;
    } else if (projectedDebtRatio >= 0.70) {
      warningLevel = "warning";
      isViable = true;
    }

    // 8. Hopper saturation & Ardido risk calculation (RF-05, RF-06, RF-08, T15)
    const currentDryer = (player.capacities && player.capacities.dryer_weekly_kg) || 0;
    const currentMill = (player.capacities && player.capacities.mill_weekly_kg) || 0;
    const effectiveDryer = currentDryer + expDryer;
    const effectiveMill = currentMill + expMill;
    const totalGreenLeaf = (harvestOwnKg > 0 ? harvestOwnKg : (harvestHec > 0 ? harvestHec * CONSTANTS.HARVEST_YIELD_KG_PER_HECTARE : 0.0)) + buyLeaf;

    let hopperSaturationRatio = 0.0;
    if (effectiveDryer > 0) {
      hopperSaturationRatio = +(totalGreenLeaf / effectiveDryer).toFixed(4);
    } else {
      hopperSaturationRatio = totalGreenLeaf > 0 ? 1.0 : 0.0;
    }
    const hopperSaturationPct = Math.round(hopperSaturationRatio * 100);

    const ardidoRiskKg = Math.max(0.0, +(totalGreenLeaf - effectiveDryer).toFixed(2));
    const ardidoRiskWarning = (ardidoRiskKg > 0.0);
    const ardidoMessage = ardidoRiskWarning
      ? `⚠️ Riesgo de Ardido: ${Math.round(ardidoRiskKg).toLocaleString("es-AR")} kg de hoja verde serán destruidos al 100% por superar la ventana de 24h`
      : null;

    // 9. Operational bottleneck detection (RF-06, RF-10)
    let bottleneckWarning = false;
    let bottleneckMessage = null;
    const bottleneckMsgs = [];

    if (ardidoRiskWarning) {
      bottleneckWarning = true;
      bottleneckMsgs.push(ardidoMessage);
    }

    if (effectiveDryer > 0 && effectiveMill > 0) {
      if (effectiveDryer > (effectiveMill * 1.5)) {
        bottleneckWarning = true;
        bottleneckMsgs.push(`Capacidad de secado (${effectiveDryer.toLocaleString()} kg/sem) supera a molienda (${effectiveMill.toLocaleString()} kg/sem). Riesgo de desbalance operativo.`);
      }
    }

    if (bottleneckMsgs.length > 0) {
      bottleneckMessage = bottleneckMsgs.join(" | ");
    }

    // 10. Mechanical caps calculation (RF-07, RF-08, RF-10, T18)
    const currentSeedlings = (player.inventories && player.inventories.seedlings) || 0;
    const maxSowSeedlings = Math.max(0, CONSTANTS.MAX_NURSERY_CAPACITY - currentSeedlings);

    const maxHarvestKg = effectiveDryer;

    // Total liquid capital available for inventory purchases
    const mandatoryBurn = CONSTANTS.BASE_FIXED_COST_PER_WEEK + weeklyInterest;
    const availableLiquidity = Math.max(0.0, player.cash - mandatoryBurn + maxAllowedDebtBorrowing);

    const leafPhysicalSpace = Math.max(0.0, effectiveDryer - harvestOwnKg);
    const leafFinancialCap = (market.leaf_spot_price > 0)
      ? (availableLiquidity / market.leaf_spot_price)
      : 0.0;
    const maxBuyLeafKg = +(Math.min(leafPhysicalSpace, leafFinancialCap)).toFixed(2);

    const maxBuyCanchadaKg = (market.canchada_spot_price > 0)
      ? +(availableLiquidity / market.canchada_spot_price).toFixed(2)
      : 0.0;

    const maxAdditionalDebt = maxAllowedDebtBorrowing;
    const maxDebtAmortization = Math.min(currentDebt, Math.max(0.0, +(player.cash).toFixed(2)));

    const mechanicalCaps = {
      max_harvest_kg: maxHarvestKg,
      max_buy_leaf_kg: Math.max(0, maxBuyLeafKg),
      max_buy_canchada_kg: Math.max(0, maxBuyCanchadaKg),
      max_sow_seedlings: maxSowSeedlings,
      max_additional_debt: maxAdditionalDebt,
      max_debt_amortization: maxDebtAmortization,
    };

    return {
      projected_cash: rawProjectedCash,
      cash_flow_variation: cashFlowVariation,
      projected_debt_ratio: projectedDebtRatio,
      projected_debt_to_assets_ratio: projectedDebtRatio,
      warning_level: warningLevel,
      is_viable: isViable,
      liquidity_risk_alert: liquidityRiskAlert,
      bottleneck_warning: bottleneckWarning,
      bottleneck_message: bottleneckMessage,
      hopper_saturation_pct: hopperSaturationPct,
      hopper_saturation_ratio: hopperSaturationRatio,
      ardido_risk_kg: ardidoRiskKg,
      ardido_risk_warning: ardidoRiskWarning,
      ardido_message: ardidoMessage,
      max_allowed_debt_borrowing: maxAllowedDebtBorrowing,
      projected_assets: projectedAssets,
      projected_debt: projectedDebt,
      mechanical_caps: mechanicalCaps,
    };
  }

  /**
   * Translates 4-quadrant spatial drafts to legacy phase drafts.
   * @param {Object} spatialDrafts
   * @param {Object} state
   * @returns {Object} { phase1, phase2, phase3 }
   */
  function mapSpatialDraftsToPhases(spatialDrafts, state) {
    const p = (spatialDrafts && spatialDrafts.produccion) || {};
    const m = (spatialDrafts && spatialDrafts.mercado) || {};
    const b = (spatialDrafts && spatialDrafts.banco) || {};

    const crewVal = p.crew_type || "BPA_MECANIZADA";
    const p1 = {
      harvest_hectares: parseFloat(p.harvest_hectares) || 0,
      harvest_own_kg: parseFloat(p.harvest_own_kg) || 0,
      buy_green_leaf_kg: parseFloat(m.buy_leaf_kg || m.buy_green_leaf_kg) || 0,
      buy_canchada_kg: parseFloat(m.buy_canchada_kg) || 0,
      sow_seedlings_units: parseInt(p.sow_seedlings !== undefined ? p.sow_seedlings : p.sow_seedlings_units, 10) || 0,
      labor_crew_type: crewVal,
      crew_type: crewVal,
    };

    const isNat = p.aging_destination === "NATURAL";
    const agingCap = parseFloat(p.buy_aging_capacity) || 0;
    const p2 = {
      buy_dryer_cap_weekly: parseFloat(p.buy_dryer_capacity) || 0,
      buy_aging_natural_cap: isNat ? agingCap : 0,
      buy_aging_accel_cap: !isNat ? agingCap : 0,
      buy_mill_cap_weekly: parseFloat(p.buy_mill_capacity) || 0,
      aging_destination: p.aging_destination || "ACCELERATED"
    };

    const marketBase = (state && state.market && state.market.final_yerba_base_price) || 3200;
    const p3 = {
      selling_price_per_kg: m.selling_price_ars !== undefined && m.selling_price_ars !== null ? parseFloat(m.selling_price_ars) : marketBase,
      debt_variation_request: parseFloat(b.debt_variation_ars) || 0
    };

    return { phase1: p1, phase2: p2, phase3: p3 };
  }

  /**
   * Computes instant projections specifically from 4-quadrant spatial drafts (<10 ms, RF-11).
   * @param {Object} state - Current GameState
   * @param {Object} spatialDrafts - { produccion, mercado, banco }
   * @returns {Object} ProjectionResult
   */
  function calculateSpatialProjections(state, spatialDrafts) {
    const mapped = mapSpatialDraftsToPhases(spatialDrafts, state);
    return calculateProjections(state, mapped.phase1, mapped.phase2, mapped.phase3);
  }

  /**
   * Collects live unconfirmed values from the 4 spatial scenarios' DOM controls if present.
   * Falls back to state.spatial_ui.drafts for saved values.
   * @param {Object} state - Current GameState
   * @returns {Object} Combined live spatial drafts
   */
  function collectLiveSpatialDrafts(state) {
    const saved = (state && state.spatial_ui && state.spatial_ui.drafts) || {};
    const pSaved = saved.produccion || {};
    const mSaved = saved.mercado || {};
    const bSaved = saved.banco || {};

    if (typeof document === "undefined") {
      return {
        produccion: { ...pSaved },
        mercado: { ...mSaved },
        banco: { ...bSaved }
      };
    }

    // 1. Producción live controls
    const sowEl = document.getElementById("prod-sow-seedlings") || document.getElementById("prod-seedlings-slider");
    const harvestEl = document.getElementById("prod-harvest-hectares") || document.getElementById("prod-harvest-hec-slider");
    const crewEl = (typeof document.querySelector === "function") ? document.querySelector('input[name="prod_crew_type"]:checked') : null;
    const agingEl = document.getElementById("prod-aging-destination") || ((typeof document.querySelector === "function") ? document.querySelector('input[name="prod_aging_dest"]:checked') : null);
    const dryerEl = document.getElementById("prod-capex-dryer-input");
    const agingCapEl = document.getElementById("prod-capex-aging-input");
    const millEl = document.getElementById("prod-capex-mill-input");

    const liveP = {
      sow_seedlings: sowEl && sowEl.value !== "" ? parseInt(sowEl.value, 10) : (pSaved.sow_seedlings || 0),
      harvest_hectares: harvestEl && harvestEl.value !== "" ? parseFloat(harvestEl.value) : (pSaved.harvest_hectares || 0),
      crew_type: crewEl ? crewEl.value : (pSaved.crew_type || "BPA_MECANIZADA"),
      aging_destination: agingEl ? agingEl.value : (pSaved.aging_destination || "ACCELERATED"),
      buy_dryer_capacity: dryerEl && dryerEl.value !== "" ? parseFloat(dryerEl.value) : (pSaved.buy_dryer_capacity || 0),
      buy_aging_capacity: agingCapEl && agingCapEl.value !== "" ? parseFloat(agingCapEl.value) : (pSaved.buy_aging_capacity || 0),
      buy_mill_capacity: millEl && millEl.value !== "" ? parseFloat(millEl.value) : (pSaved.buy_mill_capacity || 0)
    };

    // 2. Mercado live controls
    const leafEl = document.getElementById("merc-buy-leaf") || document.getElementById("merc-leaf-slider");
    const canchadaEl = document.getElementById("merc-buy-canchada") || document.getElementById("merc-canchada-slider");
    const bypassEl = document.getElementById("merc-bypass-warehouse");
    const priceEl = document.getElementById("merc-selling-price-input") || document.getElementById("merc-selling-price-slider");

    const liveM = {
      buy_leaf_kg: leafEl && leafEl.value !== "" ? parseFloat(leafEl.value) : (mSaved.buy_leaf_kg || 0),
      buy_green_leaf_kg: leafEl && leafEl.value !== "" ? parseFloat(leafEl.value) : (mSaved.buy_leaf_kg || 0),
      buy_canchada_kg: canchadaEl && canchadaEl.value !== "" ? parseFloat(canchadaEl.value) : (mSaved.buy_canchada_kg || 0),
      bypass_to_warehouse: bypassEl ? bypassEl.checked : (mSaved.bypass_to_warehouse !== false),
      selling_price_ars: priceEl && priceEl.value !== "" ? parseFloat(priceEl.value) : (mSaved.selling_price_ars || 3200)
    };

    // 3. Banco live controls
    const debtInput = document.getElementById("banco-debt-variation-input");
    const debtSlider = document.getElementById("banco-credit-slider");
    const debtVal = debtInput && debtInput.value !== "" ? parseFloat(debtInput.value) : (debtSlider && debtSlider.value !== "" ? parseFloat(debtSlider.value) : (bSaved.debt_variation_ars || 0));

    const liveB = {
      debt_variation_ars: isNaN(debtVal) ? 0 : debtVal
    };

    return {
      produccion: liveP,
      mercado: liveM,
      banco: liveB
    };
  }

  /**
   * Formats currency in Argentine style ($1.234,56).
   * @param {number} val
   * @returns {string}
   */
  function formatMoney(val) {
    const num = Math.abs(val) || 0;
    return "$" + num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /**
   * Updates the sticky bottom marginal projection bar synchronously (<10 ms, RF-11).
   * @param {Object} state - Current GameState
   * @param {Object} [explicitSpatialDrafts] - Optional override drafts
   * @returns {Object} ProjectionResult
   */
  function updateSpatialBottomBar(state, explicitSpatialDrafts = null) {
    if (!state) return null;

    const drafts = explicitSpatialDrafts || collectLiveSpatialDrafts(state);
    const res = calculateSpatialProjections(state, drafts);

    if (typeof document === "undefined") return res;

    // 1. Flujo Neto Semanal
    const flowEl = document.getElementById("proj-cash-flow");
    if (flowEl) {
      if (res.cash_flow_variation >= 0) {
        flowEl.textContent = `+${formatMoney(res.cash_flow_variation)}`;
        flowEl.className = "bar-kpi-val val-positive";
      } else {
        flowEl.textContent = `-${formatMoney(res.cash_flow_variation)}`;
        flowEl.className = "bar-kpi-val val-danger";
      }
    }

    // 2. Caja Proyectada al Cierre
    const cashEl = document.getElementById("proj-closing-cash");
    if (cashEl) {
      if (res.projected_cash >= 0) {
        cashEl.textContent = formatMoney(res.projected_cash);
        cashEl.className = "bar-kpi-val val-positive";
      } else {
        cashEl.textContent = `-${formatMoney(res.projected_cash)}`;
        cashEl.className = "bar-kpi-val val-danger";
      }
    }

    // 3. Ratio de Apalancamiento Proyectado (D/A)
    const ratioEl = document.getElementById("proj-debt-ratio");
    if (ratioEl) {
      const ratioPct = (res.projected_debt_ratio * 100).toFixed(1) + "%";
      ratioEl.textContent = ratioPct;
      if (res.projected_debt_ratio >= 0.80) {
        ratioEl.className = "bar-kpi-val val-danger";
      } else if (res.projected_debt_ratio > 0.50) {
        ratioEl.className = "bar-kpi-val val-warning";
      } else {
        ratioEl.className = "bar-kpi-val val-positive";
      }
    }

    // 4. Semáforo / Badge de Solvencia
    const badgeEl = document.getElementById("proj-status-badge");
    if (badgeEl) {
      if (res.projected_debt_ratio >= 0.80 || !res.is_viable) {
        badgeEl.textContent = "🚨 Quiebra Técnica";
        badgeEl.className = "proj-badge badge-danger val-danger";
      } else if (res.projected_debt_ratio >= 0.70 || res.warning_level === "warning") {
        badgeEl.textContent = "⚠️ Tensión Financiera";
        badgeEl.className = "proj-badge badge-warning val-warning";
      } else {
        badgeEl.textContent = "✅ Solvente";
        badgeEl.className = "proj-badge badge-solvent val-positive";
      }
    }

    return res;
  }

  /**
   * Binds input/change event listeners to all controls across the 4 scenes to ensure
   * sub-10ms synchronous bottom bar projection updates (RF-11).
   * @param {Object} state - Current GameState
   */
  function bindSpatialProjectionsEvents(state) {
    if (typeof document === "undefined") return;

    const controlIds = [
      "prod-sow-seedlings",
      "prod-seedlings-slider",
      "prod-harvest-hectares",
      "prod-harvest-hec-slider",
      "prod-capex-dryer-input",
      "prod-capex-aging-input",
      "prod-capex-mill-input",
      "prod-aging-destination",
      "merc-buy-leaf",
      "merc-leaf-slider",
      "merc-buy-canchada",
      "merc-canchada-slider",
      "merc-bypass-warehouse",
      "merc-selling-price-slider",
      "merc-selling-price-input",
      "banco-credit-slider",
      "banco-debt-variation-input"
    ];

    const handler = () => {
      updateSpatialBottomBar(state);
    };

    controlIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && typeof el.addEventListener === "function") {
        el.addEventListener("input", handler);
        el.addEventListener("change", handler);
      }
    });

    const radioSelectors = [
      'input[name="prod_crew_type"]',
      'input[name="prod_aging_dest"]'
    ];
    radioSelectors.forEach(sel => {
      if (typeof document.querySelectorAll === "function") {
        const list = document.querySelectorAll(sel);
        if (list && typeof list.forEach === "function") {
          list.forEach(el => {
            if (el && typeof el.addEventListener === "function") {
              el.addEventListener("change", handler);
            }
          });
        }
      }
    });

    // Initial update
    updateSpatialBottomBar(state);
  }

  return {
    CONSTANTS: CONSTANTS,
    calculateProjections: calculateProjections,
    calculateSpatialProjections: calculateSpatialProjections,
    collectLiveSpatialDrafts: collectLiveSpatialDrafts,
    updateSpatialBottomBar: updateSpatialBottomBar,
    bindSpatialProjectionsEvents: bindSpatialProjectionsEvents,
    mapSpatialDraftsToPhases: mapSpatialDraftsToPhases,
  };
}));
