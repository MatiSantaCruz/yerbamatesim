/**
 * YerbaMateSim Web Application Client
 * Pure Vanilla JavaScript implementation with full parity to Python Core Engine.
 */

const CONSTANTS = {
  INITIAL_CASH: 5000000.0,
  MAX_WEEKS: 120,
  WEEKLY_INTEREST_RATE: Math.pow(1.0 + 0.4678, 1.0 / 52.0) - 1.0, // ~0.007429
  MAX_LEVERAGE_RATIO: 0.80,
  DRYER_RATIO: 3.0,
  AGING_NATURAL_WEEKS: 24,
  AGING_ACCEL_WEEKS: 4,
  DRYER_OP_COST: 25.0,
  MILLING_OP_COST: 35.0,
  FIXED_COST: 40000.0,
  COST_DRYER_CAP: 150.0,
  COST_AGING_ACCEL_CAP: 95.0,
  COST_MILL_CAP: 200.0,
  COST_HECTARE: 350000.0,
};

// Application State
let gameState = null;

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function generateMarket(seed, week) {
  const rng = mulberry32(seed * 10000 + week);
  const weekOfYear = ((week - 1) % 52) + 1;
  const seasonalFactor = 0.08 * Math.sin((2 * Math.PI * (weekOfYear - 10)) / 52);

  const leafNoise = (rng() * 0.12) - 0.06;
  let leafPrice = Math.max(180.0, +(260.0 * (1.0 - seasonalFactor + leafNoise)).toFixed(2));

  const canchadaNoise = (rng() * 0.10) - 0.05;
  const canchadaBase = (leafPrice * 3.0) + 180.0;
  const canchadaPrice = +(canchadaBase * (1.0 + canchadaNoise)).toFixed(2);

  const finalNoise = (rng() * 0.08) - 0.04;
  const finalBase = Math.max(1950.0, canchadaPrice * 1.55);
  const finalPrice = +(finalBase * (1.0 + finalNoise)).toFixed(2);

  const demandNoise = (rng() * 0.30) - 0.15;
  const demandLimit = +(6000.0 * (1.0 + demandNoise)).toFixed(1);

  const estimatedMin = +(demandLimit * (1.0 - 0.15)).toFixed(1);
  const estimatedMax = +(demandLimit * (1.0 + 0.15)).toFixed(1);

  return {
    leaf_spot_price: leafPrice,
    canchada_spot_price: canchadaPrice,
    final_yerba_base_price: finalPrice,
    weekly_demand_limit_kg: demandLimit,
    demand_bandwidth: {
      price_min: 2800.0,
      price_max: 4200.0,
      estimated_demand_min_kg: estimatedMin,
      estimated_demand_max_kg: estimatedMax,
      uncertainty_spread_pct: 0.15,
    },
    shares_previous_week: {
      player_share_pct: 40.0,
      bot_share_pct: 40.0,
      third_parties_share_pct: 20.0,
      bot_price_previous_week: finalPrice,
    },
  };
}

// Canonical sanitary event catalog based on INTA technical manuals (RF-04, RF-11, T17)
const SANITARY_EVENTS_CATALOG = {
  EVT_RULO: {
    event_id: "EVT-RULO-INTA",
    name: "Alerta Fitosanitaria: Brote de Rulo de la Yerba Mate (Gyropsylla spegazziniana)",
    category: "PLAGA_BROTE",
    icon: "🐛",
    description: "El monitoreo en parcelas detectó una densidad poblacional superior al Umbral de Daño Económico (>120 individuos/20 golpes). Afecta brotación tierna.",
    biological_source: "Manual de Producción de Yerba Mate INTA - Cap. Sanidad Vegetal",
    base_yield_impact_pct: 0.10,
    base_mitigation_cost_ars: 1500.0,
    ude: ">120 individuos / 20 golpes de red o >30% brotes tiernos con agallas",
    bpa_mitigation_rule: "BPA: Atenuación del 50% en pérdidas foliares por presencia de cubiertas verdes y fauna benéfica.",
    non_bpa_rule: "Sin atenuación: Monitoreo tradicional no conservacionista.",
  },
  EVT_MARANDOVA: {
    event_id: "EVT-MARAN-INTA",
    name: "Alerta Fitosanitaria: Ataque de Oruga Marandová (Perigonia lusca)",
    category: "PLAGA_DEFOLIADORA",
    icon: "🦋",
    description: "Aparición de larvas de Marandová con alta tasa de defoliación en estratos foliares medios y superiores.",
    biological_source: "INTA EEA Cerro Azul - Guía de Fitosanidad",
    base_yield_impact_pct: 0.15,
    base_mitigation_cost_ars: 2500.0,
    ude: ">2 orugas de 3er estadio por planta o defoliación >15%",
    bpa_mitigation_rule: "BPA: Detección temprana y control biológico con Baculovirus erinnyis atenúan 50% el daño.",
    non_bpa_rule: "Sin atenuación: Defoliación severa por falta de barreras biológicas.",
  },
  EVT_TALADRO: {
    event_id: "EVT-TALAD-INTA",
    name: "Alerta Fitosanitaria: Presencia de Taladro Tigre (Hedipathes betulinus)",
    category: "PLAGA_LEÑO",
    icon: "🪲",
    description: "Detección de adultos y galerías en ramas principales que comprometen la estructura del yerbal.",
    biological_source: "Guía de Buenas Prácticas Agrícolas INTA - Manejo de Hedipathes",
    base_yield_impact_pct: 0.08,
    base_mitigation_cost_ars: 1800.0,
    ude: "Presencia visible de adultos en corteza o galerías activas con aserrín",
    bpa_mitigation_rule: "BPA: Poda de saneamiento y trampas de luz reducen 50% el impacto productivo.",
    non_bpa_rule: "Sin atenuación: Daño estructural en ramas sin manejo integrado.",
  },
  EVT_SEQUIA: {
    event_id: "EVT-SEQUIA-INTA",
    name: "Contingencia Agroclimática: Estrés Hídrico Estival (Déficit Hídrico Severo)",
    category: "CLIMATICO_ESTRES",
    icon: "☀️",
    description: "Período prolongado sin precipitaciones efectivas en la cuenca yerbatera, provocando marchitamiento foliar.",
    biological_source: "INTA Clima y Agua - Monitoreo Agroclimático NEA",
    base_yield_impact_pct: 0.20,
    base_mitigation_cost_ars: 0.0,
    ude: ">21 días consecutivos sin precipitaciones efectivas (<5 mm)",
    bpa_mitigation_rule: "BPA: Sistematización de suelo en terrazas y labranza cero (L0) retienen humedad y atenúan 50% las pérdidas.",
    non_bpa_rule: "Sin atenuación: Pérdida hídrica acelerada por escurrimiento superficial.",
  },
};

function isBpaAdopted(bpaStatus) {
  if (!bpaStatus) return false;
  return Boolean(bpaStatus.terraces_sistematized && bpaStatus.zero_tillage_l0);
}

function generateSanitaryEvent(week, bpaStatus = null, seed = 42, forceEventType = null) {
  let eventType = forceEventType;
  if (!eventType) {
    const rng = mulberry32(seed * 7000 + week);
    if (rng() < 0.12) {
      const keys = ["EVT_RULO", "EVT_MARANDOVA", "EVT_TALADRO", "EVT_SEQUIA"];
      eventType = keys[Math.floor(rng() * keys.length)];
    } else {
      return null;
    }
  }

  const tmpl = SANITARY_EVENTS_CATALOG[eventType];
  if (!tmpl) return null;

  const bpaApplied = isBpaAdopted(bpaStatus);
  const attenuation = bpaApplied ? 0.50 : 1.00;
  const yieldImpact = +(tmpl.base_yield_impact_pct * attenuation).toFixed(4);
  const mitigationRule = bpaApplied ? tmpl.bpa_mitigation_rule : tmpl.non_bpa_rule;

  return {
    event_id: tmpl.event_id,
    name: tmpl.name,
    category: tmpl.category,
    icon: tmpl.icon,
    description: tmpl.description,
    biological_source: tmpl.biological_source,
    ude: tmpl.ude,
    yield_impact_pct: yieldImpact,
    cost_mitigation_ars: tmpl.base_mitigation_cost_ars,
    mitigation_rule_applied: mitigationRule,
    bpa_applied: bpaApplied,
  };
}

function showSanitaryEventModal(evt) {
  if (!evt || typeof document === "undefined") return;
  const modal = document.getElementById("sanitary-event-modal");
  if (!modal) return;

  const iconEl = document.getElementById("sanitary-modal-icon");
  const catEl = document.getElementById("sanitary-modal-category");
  const titleEl = document.getElementById("sanitary-modal-title");
  const descEl = document.getElementById("sanitary-modal-desc");
  const udeEl = document.getElementById("sanitary-modal-ude");
  const yieldEl = document.getElementById("sanitary-modal-yield");
  const bpaIconEl = document.getElementById("sanitary-bpa-icon");
  const bpaTitleEl = document.getElementById("sanitary-bpa-status-title");
  const bpaRuleEl = document.getElementById("sanitary-modal-bpa-rule");
  const sourceEl = document.getElementById("sanitary-modal-source");

  if (iconEl) iconEl.textContent = evt.icon || "🐛";
  if (catEl) catEl.textContent = evt.category || "ALERTA FITOSANITARIA";
  if (titleEl) titleEl.textContent = evt.name || "Alerta Fitosanitaria";
  if (descEl) descEl.textContent = evt.description || "";
  if (udeEl) udeEl.textContent = evt.ude || "N/A";
  if (yieldEl) {
    const lossPct = (evt.yield_impact_pct * 100).toFixed(1);
    yieldEl.textContent = `-${lossPct}% ${evt.bpa_applied ? "(Atenuado 50% con BPA)" : "(Sin atenuación)"}`;
    yieldEl.className = evt.bpa_applied ? "diag-card-val val-warning" : "diag-card-val val-danger";
  }
  if (bpaIconEl) bpaIconEl.textContent = evt.bpa_applied ? "🛡️" : "⚠️";
  if (bpaTitleEl) bpaTitleEl.textContent = evt.bpa_applied ? "Atenuación por Buenas Prácticas Agrícolas (BPA) Activa" : "Manejo Tradicional sin Atenuación BPA";
  if (bpaRuleEl) bpaRuleEl.textContent = evt.mitigation_rule_applied || "";
  if (sourceEl) sourceEl.textContent = evt.biological_source || "INTA";

  modal.style.display = "flex";
}

function closeSanitaryEventModal() {
  const modal = document.getElementById("sanitary-event-modal");
  if (modal) modal.style.display = "none";
}

function createAgent(name) {
  return {
    name: name,
    cash: CONSTANTS.INITIAL_CASH,
    bank_debt: 0.0,
    is_bankrupt: false,
    capacities: {
      nursery_seedlings_capacity: 0,
      plantation_hectares: 0,
      dryer_weekly_kg: 0,
      aging_natural_capacity_kg: 0,
      aging_accelerated_capacity_kg: 0,
      mill_weekly_kg: 0,
    },
    inventories: {
      green_leaf_kg: 0.0,
      aging_lots: [],
      canchada_natural_ready_kg: 0.0,
      canchada_accelerated_ready_kg: 0.0,
      packaged_yerba_kg: 0.0,
    },
    accounting: {
      total_assets: CONSTANTS.INITIAL_CASH,
      total_liabilities: 0.0,
      net_worth: CONSTANTS.INITIAL_CASH,
      weekly_revenue: 0.0,
      weekly_op_cost: 0.0,
      weekly_ebitda: 0.0,
      weekly_interest: 0.0,
      debt_to_assets_ratio: 0.0,
    },
    bpa_status: {
      terraces_sistematized: true,
      zero_tillage_l0: true,
      ardido_loss_accumulated_kg: 0.0,
      sanitary_fines_accumulated: 0.0,
    }
  };
}

function initGame(seed = 42, student = null) {
  const studentData = student || { name: "Estudiante", student_id: "LEG-00000" };
  gameState = {
    version: "2.0",
    seed: seed,
    week: 1,
    max_weeks: CONSTANTS.MAX_WEEKS,
    status: "ongoing",
    market: generateMarket(seed, 1),
    player: createAgent(studentData.name),
    bot: createAgent("AgroYerba del Norte"),
    winner: null,
    student: studentData,
    ui_state: {
      theme: "light",
      tutorial_completed: false,
      guide_open: false,
      dioramas: {
        nursery: "idle",
        plantation: "idle",
        dryer: "idle",
        mill: "idle",
      },
    },
    history: [],
  };
  gameState.player.streak = { current_win_streak: 0, max_win_streak: 0, dominant_metric: "ebitda" };

  if (window.simStorage && window.simStorage.saveGameStateToStorage) {
    window.simStorage.saveGameStateToStorage(gameState);
  }
  render();

  if (typeof window !== "undefined") {
    window.gameState = gameState;
  }
  return gameState;
}

function calculateTotalAssets(agent, market) {
  const cashAsset = Math.max(0, agent.cash);
  const fixedAssets = (
    agent.capacities.dryer_weekly_kg * CONSTANTS.COST_DRYER_CAP +
    agent.capacities.aging_accelerated_capacity_kg * CONSTANTS.COST_AGING_ACCEL_CAP +
    agent.capacities.mill_weekly_kg * CONSTANTS.COST_MILL_CAP
  );
  const agingKg = agent.inventories.aging_lots.reduce((acc, lot) => acc + lot.kg, 0);
  const readyCanchada = agent.inventories.canchada_natural_ready_kg + agent.inventories.canchada_accelerated_ready_kg;
  const inventoryVal = (
    agent.inventories.green_leaf_kg * market.leaf_spot_price +
    (agingKg + readyCanchada) * market.canchada_spot_price +
    agent.inventories.packaged_yerba_kg * market.final_yerba_base_price
  );
  return +(cashAsset + fixedAssets + inventoryVal).toFixed(2);
}

function executeAgentTurn(agent, orders, market, competitorPrice = null, competitorBankrupt = false) {
  if (agent.is_bankrupt) return;

  // 1. Investments
  const invCost = (
    (orders.buy_dryer || 0) * CONSTANTS.COST_DRYER_CAP +
    (orders.buy_aging_accel || 0) * CONSTANTS.COST_AGING_ACCEL_CAP +
    (orders.buy_mill || 0) * CONSTANTS.COST_MILL_CAP
  );
  if (invCost > 0 && agent.cash >= invCost) {
    agent.cash -= invCost;
    agent.capacities.dryer_weekly_kg += (orders.buy_dryer || 0);
    agent.capacities.aging_accelerated_capacity_kg += (orders.buy_aging_accel || 0);
    agent.capacities.mill_weekly_kg += (orders.buy_mill || 0);
  }

  // 2. Spot Purchases
  const spotCost = (
    (orders.buy_leaf || 0) * market.leaf_spot_price +
    (orders.buy_canchada || 0) * market.canchada_spot_price
  );
  if (spotCost > 0 && agent.cash >= spotCost) {
    agent.cash -= spotCost;
    agent.inventories.green_leaf_kg += (orders.buy_leaf || 0);
    if ((orders.buy_canchada || 0) > 0) {
      const agingDest = String(orders.canchada_target_aging || orders.aging_destination || orders.aging_type || "ACCELERATED").toUpperCase();
      const isNatural = agingDest.includes("NAT") || agingDest.includes("NOQUE");
      const agingType = isNatural ? "natural" : "accelerated";
      const targetWeeks = isNatural ? CONSTANTS.AGING_NATURAL_WEEKS : CONSTANTS.AGING_ACCEL_WEEKS;
      const qualityScore = isNatural ? 100 : 50;

      agent.inventories.aging_lots.push({
        kg: orders.buy_canchada,
        aging_type: agingType,
        weeks_elapsed: 0,
        target_weeks: targetWeeks,
        quality_score: qualityScore,
      });
    }
  }

  let weeklyOpCost = 0.0;

  // 3. Dryer Processing (with 24h Ardido risk and 3:1 Merma, RF-04, RF-05, RF-07, RF-08, T15, T16)
  const processableLeaf = Math.min(agent.inventories.green_leaf_kg, agent.capacities.dryer_weekly_kg);
  const ardidoLossKg = Math.max(0, agent.inventories.green_leaf_kg - processableLeaf);
  if (processableLeaf > 0) {
    const canchadaYield = processableLeaf / CONSTANTS.DRYER_RATIO;
    const opCost = processableLeaf * CONSTANTS.DRYER_OP_COST;
    agent.inventories.green_leaf_kg = 0.0;
    agent.cash -= opCost;
    weeklyOpCost += opCost;

    const agingDest = String(orders.aging_destination || orders.aging_type || "ACCELERATED").toUpperCase();
    const isNatural = agingDest.includes("NAT") || agingDest.includes("NOQUE");
    const agingType = isNatural ? "natural" : "accelerated";
    const targetWeeks = isNatural ? CONSTANTS.AGING_NATURAL_WEEKS : CONSTANTS.AGING_ACCEL_WEEKS;
    const qualityScore = isNatural ? 100 : 50;

    agent.inventories.aging_lots.push({
      kg: canchadaYield,
      aging_type: agingType,
      weeks_elapsed: 0,
      target_weeks: targetWeeks,
      quality_score: qualityScore,
    });
  } else if (ardidoLossKg > 0) {
    agent.inventories.green_leaf_kg = 0.0;
  }

  // 4. Aging Maturation
  const remainingLots = [];
  agent.inventories.aging_lots.forEach(lot => {
    lot.weeks_elapsed += 1;
    if (lot.weeks_elapsed >= lot.target_weeks) {
      if (lot.aging_type === "natural") {
        agent.inventories.canchada_natural_ready_kg += lot.kg;
      } else {
        agent.inventories.canchada_accelerated_ready_kg += lot.kg;
      }
    } else {
      remainingLots.push(lot);
    }
  });
  agent.inventories.aging_lots = remainingLots;

  // 5. Milling & Packaging (IRAM 20550 Typification, RF-07, RF-08, T16)
  const millCap = agent.capacities.mill_weekly_kg;
  if (millCap > 0) {
    const naturalReady = agent.inventories.canchada_natural_ready_kg || 0;
    const accelReady = agent.inventories.canchada_accelerated_ready_kg || 0;
    const totalReady = naturalReady + accelReady;
    const toMill = Math.min(totalReady, millCap);
    if (toMill > 0) {
      let remainingToMill = toMill;
      const millFromNatural = Math.min(naturalReady, remainingToMill);
      agent.inventories.canchada_natural_ready_kg -= millFromNatural;
      remainingToMill -= millFromNatural;
      const millFromAccel = Math.min(accelReady, remainingToMill);
      agent.inventories.canchada_accelerated_ready_kg -= millFromAccel;

      const millingCost = toMill * CONSTANTS.MILLING_OP_COST;
      agent.inventories.packaged_yerba_kg += toMill;
      agent.cash -= millingCost;
      weeklyOpCost += millingCost;
    }
  }

  // 6. Sales with Price Elasticity (RF-07, RF-14)
  const actualPrice = (orders.selling_price && orders.selling_price > 0) ? orders.selling_price : market.final_yerba_base_price;
  const refCompPrice = (competitorPrice && competitorPrice > 0) ? competitorPrice : market.final_yerba_base_price;
  const priceDeltaPct = (refCompPrice - actualPrice) / refCompPrice;
  const baseDemand = market.weekly_demand_limit_kg * (competitorBankrupt ? 2.0 : 1.0);
  const absorbedDemand = Math.max(0, baseDemand * (1.0 + priceDeltaPct));
  const toSell = Math.min(agent.inventories.packaged_yerba_kg, absorbedDemand);
  if (toSell > 0) {
    const revenue = +(toSell * actualPrice).toFixed(2);
    agent.inventories.packaged_yerba_kg -= toSell;
    agent.cash += revenue;
    agent.accounting.weekly_revenue = revenue;
  } else {
    agent.accounting.weekly_revenue = 0.0;
  }

  // EBITDA Calculation (Operating Revenue - Direct Processing Costs - Base Fixed Overhead)
  agent.accounting.weekly_op_cost = weeklyOpCost;
  agent.accounting.weekly_ebitda = +(agent.accounting.weekly_revenue - weeklyOpCost - CONSTANTS.FIXED_COST).toFixed(2);

  // 7. Treasury Orders: Early Amortization or Rigid-capped Borrowing (RF-07)
  const debtVar = orders.debt_variation || 0;
  if (debtVar > 0) {
    const currentAssets = calculateTotalAssets(agent, market);
    const maxSafe = Math.max(0, Math.floor((CONSTANTS.MAX_LEVERAGE_RATIO * currentAssets - agent.bank_debt) / (1.0 - CONSTANTS.MAX_LEVERAGE_RATIO)));
    const actualBorrow = Math.min(debtVar, maxSafe);
    if (actualBorrow > 0) {
      agent.cash += actualBorrow;
      agent.bank_debt += actualBorrow;
    }
  } else if (debtVar < 0) {
    const repayReq = Math.abs(debtVar);
    const actualRepay = Math.min(repayReq, agent.bank_debt, Math.max(0, agent.cash));
    if (actualRepay > 0) {
      agent.cash -= actualRepay;
      agent.bank_debt -= actualRepay;
    }
  }

  // 8. Finances & Solvency
  agent.cash -= CONSTANTS.FIXED_COST;
  if (agent.cash < 0) {
    agent.bank_debt += -agent.cash;
    agent.cash = 0.0;
  }
  if (agent.bank_debt > 0) {
    const interest = agent.bank_debt * CONSTANTS.WEEKLY_INTEREST_RATE;
    agent.bank_debt += interest;
    agent.accounting.weekly_interest = interest;
  } else {
    agent.accounting.weekly_interest = 0.0;
  }

  const assets = calculateTotalAssets(agent, market);
  const liabilities = agent.bank_debt;
  agent.accounting.total_assets = assets;
  agent.accounting.total_liabilities = liabilities;
  agent.accounting.net_worth = assets - liabilities;
  agent.accounting.debt_to_assets_ratio = assets > 0 ? liabilities / assets : 1.0;

  if (agent.accounting.debt_to_assets_ratio > CONSTANTS.MAX_LEVERAGE_RATIO) {
    agent.is_bankrupt = true;
  }
}

function evaluateBotOrders(bot, market) {
  const orders = {
    buy_dryer: 0,
    buy_aging_accel: 0,
    buy_mill: 0,
    buy_leaf: 0,
    buy_canchada: 0,
    selling_price: market.final_yerba_base_price,
    debt_variation: 0,
  };

  if (bot.is_bankrupt) {
    bot.telemetry = {
      narrative_response: "AgroYerba del Norte se encuentra en estado de liquidación judicial. Sus operaciones están cesadas con 0% de cuota de mercado.",
      action_type: "bankrupt",
    };
    return orders;
  }

  let spendable = Math.max(0, bot.cash - 250000.0);
  let actionType = "standard";
  let narrative = "";

  if (bot.capacities.dryer_weekly_kg === 0 && spendable >= 1030000.0) {
    orders.buy_dryer = 3000;
    orders.buy_aging_accel = 4000;
    orders.buy_mill = 1000;
    spendable -= 1030000.0;
    actionType = "greenfield_setup";
    narrative = "AgroYerba del Norte ejecutó su cluster industrial inicial adquiriendo secadero (3,000 kg/sem), cámara acelerada y molino.";
  } else if (spendable >= 325000.0 && bot.capacities.dryer_weekly_kg > 0 && bot.capacities.dryer_weekly_kg < 9000) {
    orders.buy_dryer = 1500;
    orders.buy_mill = 500;
    spendable -= 325000.0;
    actionType = "expansion";
    narrative = `AgroYerba del Norte reinvirtió excedentes de liquidez en una ampliación fabril para incrementar su escala industrial manteniendo su precio en $${market.final_yerba_base_price.toLocaleString("es-AR")}.`;
  }

  const effectiveDryer = bot.capacities.dryer_weekly_kg + orders.buy_dryer;
  if (effectiveDryer > 0) {
    const neededLeaf = Math.max(0, (effectiveDryer * 1.5) - bot.inventories.green_leaf_kg);
    if (neededLeaf > 0 && spendable > 50000) {
      const buyLeaf = Math.min(neededLeaf, Math.floor(spendable / market.leaf_spot_price));
      orders.buy_leaf = buyLeaf;
    }
  }

  if (!narrative) {
    actionType = "price_hold";
    narrative = `AgroYerba del Norte mantuvo su precio a $${market.final_yerba_base_price.toLocaleString("es-AR")} priorizando rotación de volumen frente a la competencia.`;
  }

  bot.telemetry = {
    narrative_response: narrative,
    action_type: actionType,
  };

  return orders;
}

function updateStepperUI(activePhase, completedPhases, drafts, viewPhase) {
  const currentView = (typeof viewPhase === "number") ? viewPhase : ((window.stepper && window.stepper.viewPhase) || activePhase);

  // 1. Update Stepper Header Navigation Items (RF-02, RF-08)
  for (let phase = 1; phase <= 4; phase++) {
    const navItem = document.getElementById(`step-nav-${phase}`);
    if (!navItem) continue;

    navItem.classList.remove("active", "completed", "locked", "inspecting");
    const badge = navItem.querySelector(".step-badge");
    const status = navItem.querySelector(".step-status");

    if (completedPhases.includes(phase)) {
      navItem.classList.add("completed");
      if (badge) badge.textContent = "✓";
      if (status) status.textContent = (phase === currentView) ? "Completado (Viendo) 🔒" : "Completado 🔒";
    } else if (phase === activePhase) {
      navItem.classList.add("active");
      if (badge) badge.textContent = String(phase);
      if (status) status.textContent = (phase === currentView) ? "En curso" : "En curso (Pendiente)";
    } else {
      navItem.classList.add("locked");
      if (badge) badge.textContent = String(phase);
      if (status) status.textContent = (phase === currentView) ? "Inspección (Bloqueado)" : "Bloqueado";
    }

    if (phase === currentView) {
      navItem.classList.add("inspecting");
    }
  }

  // Update Connectors
  const c12 = document.getElementById("connector-1-2");
  if (c12) c12.className = completedPhases.includes(1) ? "step-connector completed" : "step-connector";
  const c23 = document.getElementById("connector-2-3");
  if (c23) c23.className = completedPhases.includes(2) ? "step-connector completed" : "step-connector";
  const c34 = document.getElementById("connector-3-4");
  if (c34) c34.className = completedPhases.includes(3) ? "step-connector completed" : "step-connector";

  // 2. Show/Hide Phase Decision Panels and Enforce Editing Lockout (RF-02, RF-06)
  for (let p = 1; p <= 4; p++) {
    const panel = document.getElementById(`phase-panel-${p}`);
    if (panel) {
      panel.style.display = (p === currentView) ? "block" : "none";

      const isEditable = (window.stepper && typeof window.stepper.isPhaseEditable === "function")
        ? window.stepper.isPhaseEditable(p)
        : (p === activePhase && !completedPhases.includes(p));

      // Lock/Unlock form inputs in this panel
      const formControls = panel.querySelectorAll("input, select, textarea");
      formControls.forEach(ctrl => {
        ctrl.disabled = !isEditable;
        if (!isEditable) {
          ctrl.setAttribute("readonly", "true");
        } else {
          ctrl.removeAttribute("readonly");
        }
      });

      // Confirm button lockout
      const confirmBtn = panel.querySelector(".btn-confirm, button[id^='btn-confirm-phase-']");
      if (confirmBtn) {
        confirmBtn.disabled = !isEditable;
        confirmBtn.style.opacity = isEditable ? "1" : "0.5";
        confirmBtn.style.cursor = isEditable ? "pointer" : "not-allowed";
        if (completedPhases.includes(p)) {
          confirmBtn.textContent = "Fase Confirmada (Solo Lectura) 🔒";
        } else if (p > activePhase) {
          confirmBtn.textContent = "Fase No Alcanzada 🔒";
        }
      }
    }
  }

  if (currentView === 1) {
    updatePhase1UI();
  } else if (currentView === 2) {
    updatePhase2UI();
  } else if (currentView === 3) {
    updatePhase3UI();
  } else if (currentView === 4) {
    updatePhase4UI();
  }

  // Update sticky bottom projection bar (RF-03, RF-09)
  updateBottomBarProjections();
}


let pendingLiquidityDraft = null;

function getCurrentPhaseDrafts() {
  const s = window.stepper;
  // Phase 1 draft
  let d1;
  if (s && s.drafts[1]) {
    d1 = s.drafts[1];
  } else {
    const crewRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
      ? document.querySelector('input[name="labor_crew_type"]:checked')
      : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-crew-trad")?.checked ? document.getElementById("radio-crew-trad") : document.getElementById("radio-crew-bpa"));
    const laborCrewType = crewRadio ? crewRadio.value : "BPA_MECANIZADA";
    d1 = {
      harvest_hectares: parseFloat(document.getElementById("input-harvest-hec")?.value) || 0,
      buy_green_leaf_kg: parseFloat(document.getElementById("input-buy-leaf")?.value) || 0,
      buy_canchada_kg: parseFloat(document.getElementById("input-buy-canchada")?.value) || 0,
      sow_seedlings_units: parseInt(document.getElementById("input-sow-seedlings")?.value, 10) || 0,
      labor_crew_type: laborCrewType,
      crew_type: laborCrewType,
    };
  }


  // Phase 2 draft
  let d2;
  if (s && s.drafts[2]) {
    d2 = s.drafts[2];
  } else {
    const agingRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
      ? document.querySelector('input[name="aging_destination"]:checked')
      : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-aging-natural")?.checked ? document.getElementById("radio-aging-natural") : document.getElementById("radio-aging-accel"));
    const agingDestination = agingRadio ? agingRadio.value : "ACCELERATED";
    d2 = {
      expand_dryer_kg: parseFloat(document.getElementById("input-buy-dryer")?.value) || 0,
      expand_aging_accel_kg: parseFloat(document.getElementById("input-buy-aging")?.value) || 0,
      expand_mill_kg: parseFloat(document.getElementById("input-buy-mill")?.value) || 0,
      aging_destination: agingDestination,
      aging_type: agingDestination === "NATURAL" ? "natural" : "accelerated",
    };
  }

  // Phase 3 draft
  let d3;
  if (s && s.drafts[3]) {
    d3 = s.drafts[3];
  } else {
    d3 = {
      selling_price_per_kg: parseFloat(document.getElementById("input-selling-price")?.value) || 3200,
      debt_variation_request: parseFloat(document.getElementById("input-debt-request")?.value) || 0,
    };
  }

  return { d1, d2, d3 };
}

function updateBottomBarProjections() {
  const calc = (window.projections && window.projections.calculateProjections) || null;
  if (!calc || !gameState) return;

  const { d1, d2, d3 } = getCurrentPhaseDrafts();
  const res = calc(gameState, d1, d2, d3);

  // Dynamic Diorama States update (<50ms perceptual latency, RF-12, RNF-03)
  if (typeof DioramaController !== "undefined" && DioramaController.updateDioramas) {
    const combinedDrafts = { ...d1, ...d2, ...d3 };
    DioramaController.updateDioramas(gameState, combinedDrafts);
  }

  // 1. Update Flujo Neto Semanal
  const flowEl = document.getElementById("proj-cash-flow");
  if (flowEl) {
    if (res.cash_flow_variation >= 0) {
      flowEl.textContent = `+${formatCurrency(res.cash_flow_variation)}`;
      flowEl.className = "bar-kpi-val val-positive";
    } else {
      flowEl.textContent = `-${formatCurrency(Math.abs(res.cash_flow_variation))}`;
      flowEl.className = "bar-kpi-val val-danger";
    }
  }

  // 2. Update Caja Proyectada
  const cashEl = document.getElementById("proj-closing-cash");
  if (cashEl) {
    if (res.projected_cash >= 0) {
      cashEl.textContent = formatCurrency(res.projected_cash);
      cashEl.className = "bar-kpi-val val-positive";
    } else {
      cashEl.textContent = `-${formatCurrency(Math.abs(res.projected_cash))}`;
      cashEl.className = "bar-kpi-val val-danger";
    }
  }

  // 3. Update Ratio de Apalancamiento
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

  // 4. Update Status Badge
  const badgeEl = document.getElementById("proj-status-badge");
  if (badgeEl) {
    if (res.liquidity_risk_alert || res.projected_debt_ratio >= 0.80) {
      badgeEl.textContent = "🚨 Riesgo de Quiebra";
      badgeEl.className = "proj-badge badge-danger";
    } else if (res.projected_cash < 0 || res.projected_debt_ratio > 0.50) {
      badgeEl.textContent = "⚠️ Tensión de Liquidez";
      badgeEl.className = "proj-badge badge-tension";
    } else {
      badgeEl.textContent = "✅ Solvente";
      badgeEl.className = "proj-badge badge-solvent";
    }
  }

  // 5. Update Contextual Phase Confirmation Button (RF-03)
  const bottomActionBtn = document.getElementById("btn-bottom-confirm-phase");
  if (bottomActionBtn) {
    const activePhase = (window.stepper && window.stepper.activePhase) || 1;
    if (activePhase === 1) {
      bottomActionBtn.textContent = "Confirmar Fase 1 ➔";
      bottomActionBtn.style.display = "inline-flex";
    } else if (activePhase === 2) {
      bottomActionBtn.textContent = "Confirmar Fase 2 ➔";
      bottomActionBtn.style.display = "inline-flex";
    } else if (activePhase === 3) {
      bottomActionBtn.textContent = "Confirmar Fase 3 ➔";
      bottomActionBtn.style.display = "inline-flex";
    } else {
      bottomActionBtn.textContent = "Procesar Turno ⚡";
      bottomActionBtn.style.display = "none"; // In Phase 4, Versus Arena has its own big action button
    }
  }

  // 6. Rigid Mechanical Caps Enforcement (RF-07, T18)
  if (res.mechanical_caps) {
    applyMechanicalCaps(res.mechanical_caps);
  }

  return res;
}

function applyMechanicalCaps(caps) {
  if (!caps || !gameState || !gameState.player) return;

  // Phase 1: Hoja verde & Canchada spot purchases
  const elBuyLeaf = document.getElementById("input-buy-leaf");
  if (elBuyLeaf && typeof caps.max_buy_leaf_kg === "number") {
    elBuyLeaf.max = caps.max_buy_leaf_kg;
    if (parseFloat(elBuyLeaf.value) > caps.max_buy_leaf_kg) {
      elBuyLeaf.value = caps.max_buy_leaf_kg;
    }
  }

  const elBuyCanchada = document.getElementById("input-buy-canchada");
  if (elBuyCanchada && typeof caps.max_buy_canchada_kg === "number") {
    elBuyCanchada.max = caps.max_buy_canchada_kg;
    if (parseFloat(elBuyCanchada.value) > caps.max_buy_canchada_kg) {
      elBuyCanchada.value = caps.max_buy_canchada_kg;
    }
  }

  // Phase 2: CapEx expansions physically bounded by available liquidity
  const player = gameState.player;
  const currentDebt = player.bank_debt || 0.0;
  const weeklyInterest = currentDebt * 0.007429;
  const mandatoryBurn = 40000.0 + weeklyInterest;
  const availableLiquidity = Math.max(0.0, player.cash - mandatoryBurn + (caps.max_additional_debt || 0));

  const elDryer = document.getElementById("input-buy-dryer");
  if (elDryer) {
    const maxDryer = Math.max(0, Math.floor(availableLiquidity / CONSTANTS.COST_DRYER_CAP));
    elDryer.max = maxDryer;
    if (parseFloat(elDryer.value) > maxDryer) elDryer.value = maxDryer;
  }

  const elAging = document.getElementById("input-buy-aging");
  if (elAging) {
    const maxAging = Math.max(0, Math.floor(availableLiquidity / CONSTANTS.COST_AGING_ACCEL_CAP));
    elAging.max = maxAging;
    if (parseFloat(elAging.value) > maxAging) elAging.value = maxAging;
  }

  const elMill = document.getElementById("input-buy-mill");
  if (elMill) {
    const maxMill = Math.max(0, Math.floor(availableLiquidity / CONSTANTS.COST_MILL_CAP));
    elMill.max = maxMill;
    if (parseFloat(elMill.value) > maxMill) elMill.value = maxMill;
  }

  // Phase 3: Rigid Debt Cap (D/A never exceeds 0.80)
  const sliderDebt = document.getElementById("slider-debt-request");
  const inputDebt = document.getElementById("input-debt-request");
  const rigidCap = typeof caps.max_additional_debt === "number" ? caps.max_additional_debt : calculateRigidDebtCap(player, gameState.market);
  const maxAmort = typeof caps.max_debt_amortization === "number" ? caps.max_debt_amortization : Math.min(currentDebt, Math.max(0, player.cash));

  if (sliderDebt) {
    sliderDebt.max = rigidCap;
    sliderDebt.min = -maxAmort;
    let currVal = parseFloat(sliderDebt.value) || 0;
    if (currVal > rigidCap) currVal = rigidCap;
    if (currVal < -maxAmort) currVal = -maxAmort;
    sliderDebt.value = currVal;
    if (inputDebt) {
      inputDebt.max = rigidCap;
      inputDebt.min = -maxAmort;
      inputDebt.value = currVal;
    }
  }

  const sliderMaxLbl = document.getElementById("slider-max-lbl");
  if (sliderMaxLbl) {
    sliderMaxLbl.textContent = `Tope Rígido: +$${Number(rigidCap).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  const sliderMinLbl = document.getElementById("slider-min-lbl");
  if (sliderMinLbl) {
    sliderMinLbl.textContent = `Amortizar: -$${Number(maxAmort).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }

  const rigidCapDisplay = document.getElementById("rigid-cap-display");
  if (rigidCapDisplay) {
    rigidCapDisplay.textContent = formatCurrency(rigidCap);
  }
}


function proceedWithLiquidityRisk() {
  const modal = document.getElementById("liquidity-modal");
  if (modal) modal.style.display = "none";
  if (!pendingLiquidityDraft) return;

  const { phase, draft, isBottleneck, effectiveDryer, effectiveMill } = pendingLiquidityDraft;
  pendingLiquidityDraft = null;

  if (phase === 1) {
    if (window.stepper) window.stepper.confirmPhase(1, draft);
  } else if (phase === 2) {
    if (isBottleneck) {
      pendingPhase2Draft = draft;
      const bModal = document.getElementById("bottleneck-modal");
      const desc = document.getElementById("bottleneck-modal-desc");
      if (desc) {
        desc.textContent = `Has dimensionado una capacidad de secado de ${Number(effectiveDryer).toLocaleString()} kg/sem frente a una capacidad de molienda de sólo ${Number(effectiveMill).toLocaleString()} kg/sem. La molienda no dará abasto y acumularás yerba canchada inmovilizada devengando costos fijos y costo de oportunidad de capital.`;
      }
      if (bModal) bModal.style.display = "flex";
      return;
    }
    if (window.stepper) window.stepper.confirmPhase(2, draft);
  }
}

function updatePhase1UI() {
  if (!gameState || !gameState.player || !gameState.market) return;
  const p = gameState.player;
  const m = gameState.market;

  // 1. Labor Crew Type selection & Make vs Buy Matrix Price & Savings Updates (RF-03, RF-04, RF-05, RF-08)
  const crewRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
    ? document.querySelector('input[name="labor_crew_type"]:checked')
    : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-crew-trad")?.checked ? document.getElementById("radio-crew-trad") : document.getElementById("radio-crew-bpa"));
  const selectedCrew = (crewRadio ? crewRadio.value : "BPA_MECANIZADA").toUpperCase();
  const isTrad = selectedCrew.includes("TRAD") || selectedCrew.includes("INFORMAL");
  const harvestCostKg = isTrad ? 110.0 : 145.0;
  const leafSpotPrice = m.leaf_spot_price || 0.0;
  const canchadaSpotPrice = m.canchada_spot_price || 0.0;

  // Sync card selected classes
  const cardBpa = document.getElementById("card-crew-bpa");
  const cardTrad = document.getElementById("card-crew-trad");
  if (cardBpa) cardBpa.classList.toggle("selected", !isTrad);
  if (cardTrad) cardTrad.classList.toggle("selected", isTrad);

  const noteCrewCost = document.getElementById("label-crew-cost-note");
  if (noteCrewCost) {
    noteCrewCost.textContent = `$${harvestCostKg.toFixed(2)}/kg (${isTrad ? "Tradicional" : "BPA Mecanizada"})`;
  }

  const elCostHarvest = document.getElementById("comp-cost-harvest");
  if (elCostHarvest) {
    elCostHarvest.innerHTML = `${formatCurrency(harvestCostKg)} <span class="unit">/kg (${isTrad ? "Tradicional" : "BPA Mecanizada"})</span>`;
  }

  const elCostLeaf = document.getElementById("comp-cost-leaf");
  if (elCostLeaf) elCostLeaf.innerHTML = `${formatCurrency(leafSpotPrice)} <span class="unit">/kg</span>`;

  const elCostCanchada = document.getElementById("comp-cost-canchada");
  if (elCostCanchada) elCostCanchada.textContent = `${formatCurrency(canchadaSpotPrice)}/kg`;

  const elDiffTag = document.getElementById("comp-diff-tag");
  const elDiffVal = document.getElementById("comp-diff-val");
  if (elDiffTag && elDiffVal) {
    const diff = leafSpotPrice - harvestCostKg;
    if (diff > 0) {
      elDiffVal.textContent = `Ahorro Make: +${formatCurrency(diff)}/kg`;
      elDiffTag.style.color = "var(--accent-green)";
    } else {
      elDiffVal.textContent = `Desventaja Make: ${formatCurrency(diff)}/kg`;
      elDiffTag.style.color = "var(--accent-gold)";
    }
  }

  // 2. Semillero / Vivero Biological Constraint (RF-08: Exactly 300 plantines max)
  const currentSeedlings = (p.inventories && p.inventories.seedlings) || 0;
  const elNurseryOccupancy = document.getElementById("nursery-current-occupancy");
  if (elNurseryOccupancy) {
    elNurseryOccupancy.textContent = String(currentSeedlings);
  }

  const elSow = document.getElementById("input-sow-seedlings");
  if (elSow) {
    const maxSow = Math.max(0, 300 - currentSeedlings);
    elSow.max = maxSow;
    let sowVal = parseInt(elSow.value, 10) || 0;
    if (sowVal > maxSow) {
      elSow.value = maxSow;
      sowVal = maxSow;
    }
  }

  // 3. Hopper Saturation Calculation & Ardido Critical Alert (RF-05, RF-06, RF-08, T15)
  const harvestHec = parseFloat(document.getElementById("input-harvest-hec")?.value) || 0;
  const buyLeaf = parseFloat(document.getElementById("input-buy-leaf")?.value) || 0;
  const ownGreenLeaf = harvestHec * 8500.0;
  const totalGreenLeaf = ownGreenLeaf + buyLeaf;
  const dryerCap = (p.capacities && p.capacities.dryer_weekly_kg) || 0;

  const saturationRatio = dryerCap > 0 ? (totalGreenLeaf / dryerCap) : (totalGreenLeaf > 0 ? 1.0 : 0.0);
  const saturationPct = Math.round(saturationRatio * 100);
  const ardidoRiskKg = Math.max(0, totalGreenLeaf - dryerCap);
  const isArdidoCritical = ardidoRiskKg > 0;

  const elHopperContainer = document.getElementById("hopper-container");
  const elHopperFill = document.getElementById("hopper-bar-fill");
  const elHopperBadge = document.getElementById("hopper-status-badge");
  const elHopperWarning = document.getElementById("hopper-warning-msg");
  const elHopperReceived = document.getElementById("hopper-received-kg");
  const elHopperCap = document.getElementById("hopper-capacity-kg");

  if (elHopperReceived) elHopperReceived.textContent = `${Number(totalGreenLeaf).toLocaleString("es-AR")} kg`;
  if (elHopperCap) elHopperCap.textContent = `${Number(dryerCap).toLocaleString("es-AR")} kg/sem`;

  if (elHopperFill && elHopperBadge) {
    elHopperFill.style.width = `${Math.min(100, saturationPct)}%`;
    elHopperFill.className = "hopper-bar-fill";
    elHopperBadge.className = "hopper-badge";

    if (isArdidoCritical) {
      // Critical Red Blinking Alert (#DC2626) when Green Leaf exceeds Secadero capacity (RF-05, T15)
      if (elHopperContainer) elHopperContainer.classList.add("ardido-blink-alert");
      elHopperFill.classList.add("fill-danger");
      elHopperBadge.classList.add("badge-danger", "ardido-badge-blink");
      elHopperBadge.textContent = `🚨 ¡Ardido Crítico! (${saturationPct}%)`;

      if (elHopperWarning) {
        elHopperWarning.className = "hopper-warning-banner ardido-critical";
        elHopperWarning.style.display = "block";
        elHopperWarning.innerHTML = `⚠️ Riesgo de Ardido: <strong>${Math.round(ardidoRiskKg).toLocaleString("es-AR")} kg</strong> de hoja verde serán destruidos al 100% por superar la ventana de 24h`;
      }
    } else {
      if (elHopperContainer) elHopperContainer.classList.remove("ardido-blink-alert");
      elHopperBadge.classList.remove("ardido-badge-blink");

      if (saturationRatio > 0.95) {
        elHopperFill.classList.add("fill-danger");
        elHopperBadge.classList.add("badge-danger");
        elHopperBadge.textContent = `🚨 Crítico (${saturationPct}%)`;
        if (elHopperWarning) {
          elHopperWarning.className = "hopper-warning-banner";
          elHopperWarning.style.display = "block";
          elHopperWarning.textContent = "⚠️ ¡Alerta! La recepción física de hoja verde supera el 95% de la capacidad de secado. Ajusta las compras para evitar desbordes.";
        }
      } else if (saturationRatio > 0.80) {
        elHopperFill.classList.add("fill-warning");
        elHopperBadge.classList.add("badge-warning");
        elHopperBadge.textContent = `⚠️ Elevada (${saturationPct}%)`;
        if (elHopperWarning) elHopperWarning.style.display = "none";
      } else {
        elHopperFill.classList.add("fill-normal");
        elHopperBadge.classList.add("badge-normal");
        elHopperBadge.textContent = `Normal (${saturationPct}%)`;
        if (elHopperWarning) elHopperWarning.style.display = "none";
      }
    }
  }
}

// ==============================================================================
// ATOMIC PHASE PRESENTATION & DOMAIN EXCEPTION HANDLING (RF-19, T23)
// ==============================================================================

/**
 * Registry of atomic presentation renderers by operative phase (Scope Rule).
 * Isolates dumb presentational atoms from smart phase container logic.
 */
const atomicPhaseRenderers = {
  phase1: {
    renderKPIs: () => updatePhase1UI(),
    renderHopper: () => updateHopperDisplay(),
  },
  phase2: {
    renderCapEx: () => updatePhase2UI(),
    renderBottlenecks: () => updateBottleneckDiagnostics(),
  },
  phase3: {
    renderMarketElasticity: () => updatePhase3UI(),
    renderDebtCap: () => updateRigidCapNotice(),
  },
  phase4: {
    renderSplitScreen: () => updatePhase4UI(),
    renderVersusArena: () => updateVersusArenaUI(),
  },
};

/**
 * Display a contextual pedagogical banner when a domain exception occurs (RF-19, T23).
 * Guarantees that the page never reloads and the active phase state remains intact.
 * 
 * @param {object} options
 * @param {string} options.errorType Domain exception class name (e.g. InvalidOrderError, CapacityExceededError)
 * @param {string} options.message Explanatory pedagogical message in Spanish
 * @param {string} [options.fieldId] HTML ID of the control that triggered the exception
 * @param {number} [options.phase] Operative phase where the exception occurred
 */
function showDomainExceptionBanner({ errorType = "YerbaMateDomainError", message = "Operación no válida según las reglas del negocio.", fieldId = null, phase = null } = {}) {
  const banner = document.getElementById("domain-exception-banner");
  const msgEl = document.getElementById("domain-exception-msg");
  const titleEl = document.getElementById("domain-exception-title");

  // Clear any existing highlighted field error classes
  document.querySelectorAll(".has-domain-error").forEach(el => el.classList.remove("has-domain-error"));

  if (titleEl) {
    const titlesMap = {
      InvalidOrderError: "Restricción de Entrada / Parámetro Inválido",
      CapacityExceededError: "Límite de Capacidad Física Superado",
      InsufficientLiquidityError: "Fondos Insuficientes / Límite Crediticio",
      StateIntegrityError: "Inconsistencia de Estado Operativo",
    };
    titleEl.textContent = titlesMap[errorType] || "Restricción de Regla de Negocio";
  }

  if (msgEl) {
    msgEl.textContent = message;
  }

  if (banner) {
    banner.style.display = "block";
    banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Highlight specific erroneous input if provided
  if (fieldId) {
    const fieldEl = document.getElementById(fieldId);
    if (fieldEl) {
      fieldEl.classList.add("has-domain-error");
      fieldEl.focus();

      // Auto-remove error highlight on next input
      const clearHandler = () => {
        fieldEl.classList.remove("has-domain-error");
        hideDomainExceptionBanner();
        fieldEl.removeEventListener("input", clearHandler);
      };
      fieldEl.addEventListener("input", clearHandler);
    }
  }

  // Notify stepper state machine
  if (window.stepper && typeof window.stepper.handleDomainException === "function") {
    window.stepper.handleDomainException({ errorType, message, fieldId, phase: phase || (window.stepper ? window.stepper.activePhase : 1) });
  }
}

/**
 * Dismiss the contextual domain exception banner and clear highlighting.
 */
function hideDomainExceptionBanner() {
  const banner = document.getElementById("domain-exception-banner");
  if (banner) {
    banner.style.display = "none";
  }
  document.querySelectorAll(".has-domain-error").forEach(el => el.classList.remove("has-domain-error"));

  if (window.stepper && typeof window.stepper.clearDomainException === "function") {
    window.stepper.clearDomainException();
  }
}

// ==============================================================================
// ATOMIC CONTROL ERROR MANAGEMENT & DECOUPLED FEEDBACK (RF-15, T28)
// ==============================================================================

/**
 * Apply deterministic atomic error feedback to a specific control without side effects.
 *
 * @param {string} fieldId HTML ID of the erroneous input control
 * @param {string} message Pedagogical error message
 */
function setAtomicFieldError(fieldId, message) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  el.classList.add("atom-feedback-error");
  el.setAttribute("aria-invalid", "true");

  const parent = el.parentElement;
  if (parent) {
    let tooltip = parent.querySelector(".atom-error-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "atom-error-tooltip";
      tooltip.setAttribute("role", "alert");
      parent.appendChild(tooltip);
    }
    tooltip.textContent = message;
    tooltip.style.display = "block";
  }
}

/**
 * Clear atomic error feedback from a specific control.
 *
 * @param {string} fieldId HTML ID of the input control
 */
function clearAtomicFieldError(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  el.classList.remove("atom-feedback-error");
  el.removeAttribute("aria-invalid");

  const parent = el.parentElement;
  if (parent) {
    const tooltip = parent.querySelector(".atom-error-tooltip");
    if (tooltip) {
      tooltip.style.display = "none";
    }
  }
}

/**
 * Pure atomic validation function for an input value (Principle of Least Surprise).
 *
 * @param {string} fieldId HTML ID of the input
 * @param {number|string} val Input value to validate
 * @returns {{ valid: boolean, message?: string }}
 */
function validateAtomicInput(fieldId, val) {
  const num = parseFloat(val);
  if (isNaN(num)) {
    return { valid: false, message: "Ingresa un número válido." };
  }
  if (num < 0) {
    return { valid: false, message: "El valor no puede ser negativo." };
  }

  if (fieldId === "input-sow-seedlings") {
    if (num > 300) {
      return { valid: false, message: "Tope biológico alcanzado (máximo 300 plantines)." };
    }
  }

  if (fieldId === "input-selling-price") {
    if (num < 2800 || num > 4200) {
      return { valid: false, message: "El precio debe situarse dentro de la banda regulada ($2.800 - $4.200)." };
    }
  }

  return { valid: true };
}

/**
 * Bind blur and input listeners to an atomic control to guarantee self-contained reactivity.
 *
 * @param {string} fieldId HTML ID of the input control
 */
function bindAtomicControlValidation(fieldId) {
  const el = document.getElementById(fieldId);
  if (!el) return;

  el.addEventListener("input", () => {
    const val = el.value;
    const res = validateAtomicInput(fieldId, val);
    if (res.valid) {
      clearAtomicFieldError(fieldId);
    }
  });

  el.addEventListener("blur", () => {
    const val = el.value;
    const res = validateAtomicInput(fieldId, val);
    if (!res.valid) {
      setAtomicFieldError(fieldId, res.message);
    } else {
      clearAtomicFieldError(fieldId);
    }
  });
}


function onConfirmPhase1() {
  hideDomainExceptionBanner();
  const harvest = parseFloat(document.getElementById("input-harvest-hec")?.value) || 0;
  const leaf = parseFloat(document.getElementById("input-buy-leaf")?.value) || 0;
  const canchada = parseFloat(document.getElementById("input-buy-canchada")?.value) || 0;
  const sow = parseInt(document.getElementById("input-sow-seedlings")?.value, 10) || 0;

  // Domain pre-validations for Phase 1 (RF-13, RF-19)
  if (harvest < 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "Las hectáreas de cosecha propia no pueden ser un valor negativo.",
      fieldId: "input-harvest-hec",
      phase: 1
    });
    return;
  }
  if (leaf < 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "El volumen de compra de hoja verde spot no puede ser un valor negativo.",
      fieldId: "input-buy-leaf",
      phase: 1
    });
    return;
  }
  if (canchada < 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "El volumen de compra de yerba canchada no puede ser un valor negativo.",
      fieldId: "input-buy-canchada",
      phase: 1
    });
    return;
  }
  if (sow < 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "La siembra de plantines en vivero no puede ser un valor negativo.",
      fieldId: "input-sow-seedlings",
      phase: 1
    });
    return;
  }

  const crewRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
    ? document.querySelector('input[name="labor_crew_type"]:checked')
    : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-crew-trad")?.checked ? document.getElementById("radio-crew-trad") : document.getElementById("radio-crew-bpa"));
  const laborCrewType = crewRadio ? crewRadio.value : "BPA_MECANIZADA";

  const draft1 = {
    harvest_hectares: harvest,
    buy_green_leaf_kg: leaf,
    buy_canchada_kg: canchada,
    sow_seedlings_units: sow,
    labor_crew_type: laborCrewType,
    crew_type: laborCrewType,
  };

  // RF-06: Avance en blanco bajo iliquidez
  const isBlankAdvance1 = (window.stepper && typeof window.stepper.isBlankDraft === "function")
    ? window.stepper.isBlankDraft(1, draft1)
    : (harvest === 0 && leaf === 0 && canchada === 0);

  // RF-09: Critical Liquidity Alert Check (omitido si es avance en blanco)
  if (!isBlankAdvance1 && window.projections && window.projections.calculateProjections) {
    const res = window.projections.calculateProjections(gameState, draft1);
    if (res.liquidity_risk_alert) {
      pendingLiquidityDraft = { phase: 1, draft: draft1 };
      const modal = document.getElementById("liquidity-modal");
      const modalCash = document.getElementById("modal-risk-cash");
      const modalRatio = document.getElementById("modal-risk-ratio");
      if (modalCash) modalCash.textContent = `-${formatCurrency(Math.abs(res.projected_cash))}`;
      if (modalRatio) modalRatio.textContent = `${(res.projected_debt_ratio * 100).toFixed(1)}%`;
      if (modal) modal.style.display = "flex";
      return;
    }
  }

  // Irreversible confirmation via Stepper (RF-06, RF-08)
  if (window.stepper) {
    window.stepper.confirmPhase(1, draft1);
  }
}

function calculatePhase2CapEx(dryer, aging, mill) {
  const costDryer = (dryer || 0) * CONSTANTS.COST_DRYER_CAP;
  const costAging = (aging || 0) * CONSTANTS.COST_AGING_ACCEL_CAP;
  const costMill = (mill || 0) * CONSTANTS.COST_MILL_CAP;
  return {
    costDryer,
    costAging,
    costMill,
    totalCapEx: costDryer + costAging + costMill,
  };
}

function updatePhase2UI() {
  const p = gameState.player;
  const dryerIn = parseFloat(document.getElementById("input-buy-dryer")?.value) || 0;
  const agingIn = parseFloat(document.getElementById("input-buy-aging")?.value) || 0;
  const millIn = parseFloat(document.getElementById("input-buy-mill")?.value) || 0;

  // 1. Calculate and display subcosts
  const capex = calculatePhase2CapEx(dryerIn, agingIn, millIn);
  const subDryer = document.getElementById("subcost-dryer");
  if (subDryer) subDryer.textContent = formatCurrency(capex.costDryer);
  const subAging = document.getElementById("subcost-aging");
  if (subAging) subAging.textContent = formatCurrency(capex.costAging);
  const subMill = document.getElementById("subcost-mill");
  if (subMill) subMill.textContent = formatCurrency(capex.costMill);

  const totalCapExEl = document.getElementById("total-capex-val");
  if (totalCapExEl) totalCapExEl.textContent = formatCurrency(capex.totalCapEx);

  // 2. Compute effective prospective capacities
  const effectiveDryer = (p.capacities.dryer_weekly_kg || 0) + dryerIn;
  const effectiveAging = (p.capacities.aging_accelerated_capacity_kg || 0) + agingIn;
  const effectiveMill = (p.capacities.mill_weekly_kg || 0) + millIn;

  const phase2Dryer = document.getElementById("phase2-dryer-cap");
  if (phase2Dryer) phase2Dryer.textContent = Number(effectiveDryer).toLocaleString();
  const phase2Aging = document.getElementById("phase2-aging-cap");
  if (phase2Aging) phase2Aging.textContent = Number(effectiveAging).toLocaleString();
  const phase2Mill = document.getElementById("phase2-mill-cap");
  if (phase2Mill) phase2Mill.textContent = Number(effectiveMill).toLocaleString();

  // 2b. Sync Maturation Destination & IRAM 20550 Tipification (RF-07, RF-08, T16)
  const agingRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
    ? document.querySelector('input[name="aging_destination"]:checked')
    : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-aging-natural")?.checked ? document.getElementById("radio-aging-natural") : document.getElementById("radio-aging-accel"));
  const agingDest = (agingRadio ? agingRadio.value : "ACCELERATED").toUpperCase();
  const isNatural = agingDest.includes("NATURAL");

  const cardAccel = document.getElementById("card-aging-accel");
  const cardNatural = document.getElementById("card-aging-natural");
  if (cardAccel) cardAccel.classList.toggle("selected", !isNatural);
  if (cardNatural) cardNatural.classList.toggle("selected", isNatural);

  const badgeAgingRatio = document.getElementById("badge-aging-ratio");
  if (badgeAgingRatio) {
    badgeAgingRatio.textContent = isNatural ? "Noques (Calidad 100)" : "Cámaras (Calidad 50)";
  }

  const labelQuality = document.getElementById("label-iram-quality");
  const textTypification = document.getElementById("text-iram-typification");
  if (labelQuality) {
    labelQuality.textContent = isNatural
      ? "Calidad Organoléptica: 100/100 (Premium INTA)"
      : "Calidad Organoléptica: 50/100 (Estándar)";
    labelQuality.style.color = isNatural ? "var(--accent-green)" : "var(--accent-gold)";
  }
  if (textTypification) {
    textTypification.textContent = isNatural
      ? "Línea de molienda y envasado configurada para Yerba Mate Elaborada con Palo de Alta Gama (Estacionamiento Natural en Noques 24 sem — 100% Precio Base IRAM 20550)."
      : "Línea de molienda y envasado configurada para Yerba Mate Elaborada con Palo Estándar (Cámara Climatizada Acelerada 4 sem — Descuento Comercial 15%).";
  }

  // 3. Evaluate mass balance & bottleneck (RF-06, RF-09, RF-10, T15, T20)
  // Optimal rule: Secadero <= 1.5 * Molienda & Secadero >= Recepción Hoja Verde
  const { d1 } = getCurrentPhaseDrafts();
  const p1HarvestHec = parseFloat(d1?.harvest_hectares) || 0;
  const p1HarvestKg = parseFloat(d1?.harvest_own_kg) || (p1HarvestHec * 8500.0);
  const p1BuyLeaf = parseFloat(d1?.buy_green_leaf_kg) || 0;
  const totalPhase1Leaf = p1HarvestKg + p1BuyLeaf;
  const prospectiveArdidoKg = Math.max(0, totalPhase1Leaf - effectiveDryer);
  const hasArdidoRisk = prospectiveArdidoKg > 0;

  const meterDryer = document.getElementById("meter-card-dryer");
  const meterAging = document.getElementById("meter-card-aging");
  const meterMill = document.getElementById("meter-card-mill");
  const banner = document.getElementById("balance-diagnostic-banner");
  const diagIcon = document.getElementById("diag-icon");
  const diagText = document.getElementById("diag-text");
  const badgeDryer = document.getElementById("badge-dryer-ratio");
  const badgeMill = document.getElementById("badge-mill-ratio");

  let isBottleneck = false;
  if (effectiveDryer > 0 && effectiveMill > 0 && effectiveDryer > effectiveMill * 1.5) {
    isBottleneck = true;
  }

  if (hasArdidoRisk) {
    if (meterDryer) meterDryer.classList.add("meter-bottleneck", "ardido-blink-alert");
    if (badgeDryer) {
      badgeDryer.textContent = "Déficit Secado ⚠️";
      badgeDryer.style.background = "rgba(220, 38, 38, 0.2)";
      badgeDryer.style.color = "#DC2626";
    }
    if (banner) {
      banner.className = "balance-diagnostic-banner banner-warning";
      if (diagIcon) diagIcon.textContent = "⚠️";
      if (diagText) diagText.textContent = `Riesgo de Ardido en Planchada: ${Math.round(prospectiveArdidoKg).toLocaleString("es-AR")} kg de hoja verde de Fase 1 exceden la capacidad de secado instalada (${effectiveDryer.toLocaleString()} kg). Amplía la capacidad de secadero para evitar la destrucción total en 24h.`;
    }
  } else if (isBottleneck) {
    if (meterDryer) {
      meterDryer.classList.remove("ardido-blink-alert");
      meterDryer.classList.add("meter-bottleneck");
    }
    if (meterMill) meterMill.classList.add("meter-bottleneck");
    if (badgeDryer) {
      badgeDryer.textContent = "Sobredimensionado";
      badgeDryer.style.background = "rgba(231, 76, 60, 0.2)";
      badgeDryer.style.color = "var(--accent-danger)";
    }
    if (badgeMill) {
      badgeMill.textContent = "Cuello de Botella ⚠️";
      badgeMill.style.background = "rgba(231, 76, 60, 0.2)";
      badgeMill.style.color = "var(--accent-danger)";
    }
    if (banner) {
      banner.className = "balance-diagnostic-banner banner-warning";
      if (diagIcon) diagIcon.textContent = "⚠️";
      if (diagText) diagText.textContent = `Cuello de botella detectado: Secadero (${Number(effectiveDryer).toLocaleString()} kg) excede en >50% a Molienda (${Number(effectiveMill).toLocaleString()} kg). Riesgo de sobrecosto por canchada ociosa.`;
    }
  } else {
    if (meterDryer) {
      meterDryer.classList.remove("meter-bottleneck", "ardido-blink-alert");
    }
    if (meterMill) meterMill.classList.remove("meter-bottleneck");
    if (badgeDryer) {
      badgeDryer.textContent = "Equilibrado";
      badgeDryer.style.background = "rgba(46, 204, 113, 0.15)";
      badgeDryer.style.color = "var(--accent-green)";
    }
    if (badgeMill) {
      badgeMill.textContent = "Despacho";
      badgeMill.style.background = "rgba(46, 204, 113, 0.15)";
      badgeMill.style.color = "var(--accent-green)";
    }
    if (banner) {
      banner.className = "balance-diagnostic-banner banner-optimal";
      if (diagIcon) diagIcon.textContent = "✅";
      if (diagText) diagText.textContent = "Relación de capacidades equilibrada (Secadero ≤ 1.5 × Molienda).";
    }
  }

  // 4. Budget check: disable CapEx inputs if insufficient liquidity (RF-09, T20)
  const currentDebt = p.bank_debt || 0.0;
  const weeklyInterest = currentDebt * 0.007429;
  const mandatoryBurn = 40000.0 + weeklyInterest;
  const totalAssets = (p.accounting && p.accounting.total_assets) || 0.0;
  const maxBorrow = (0.80 * totalAssets - currentDebt) / 0.20;
  const maxAllowedBorrowing = Math.max(0.0, maxBorrow);
  const availableLiquidity = Math.max(0.0, p.cash - mandatoryBurn + maxAllowedBorrowing);

  const isEditable = (window.stepper && typeof window.stepper.isPhaseEditable === "function")
    ? window.stepper.isPhaseEditable(2)
    : true;

  const elDryer = document.getElementById("input-buy-dryer");
  const elAging = document.getElementById("input-buy-aging");
  const elMill = document.getElementById("input-buy-mill");

  if (isEditable) {
    if (elDryer) {
      const canAfford = availableLiquidity >= CONSTANTS.COST_DRYER_CAP;
      elDryer.disabled = !canAfford;
      if (!canAfford) {
        elDryer.value = 0;
        elDryer.title = "Presupuesto insuficiente para adquirir secadero";
      }
    }
    if (elAging) {
      const canAfford = availableLiquidity >= CONSTANTS.COST_AGING_ACCEL_CAP;
      elAging.disabled = !canAfford;
      if (!canAfford) {
        elAging.value = 0;
        elAging.title = "Presupuesto insuficiente para adquirir cámara acelerada";
      }
    }
    if (elMill) {
      const canAfford = availableLiquidity >= CONSTANTS.COST_MILL_CAP;
      elMill.disabled = !canAfford;
      if (!canAfford) {
        elMill.value = 0;
        elMill.title = "Presupuesto insuficiente para adquirir molino";
      }
    }
  }

  return { isBottleneck, effectiveDryer, effectiveMill, capex, availableLiquidity };
}

let pendingPhase2Draft = null;

function onConfirmPhase2() {
  hideDomainExceptionBanner();
  const dryer = parseFloat(document.getElementById("input-buy-dryer")?.value) || 0;
  const aging = parseFloat(document.getElementById("input-buy-aging")?.value) || 0;
  const mill = parseFloat(document.getElementById("input-buy-mill")?.value) || 0;

  if (dryer < 0 || aging < 0 || mill < 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "Las órdenes de inversión en capacidad fabril (CapEx) no pueden ser negativas.",
      fieldId: dryer < 0 ? "input-buy-dryer" : (aging < 0 ? "input-buy-aging" : "input-buy-mill"),
      phase: 2
    });
    return;
  }

  const { isBottleneck, effectiveDryer, effectiveMill } = updatePhase2UI();

  const agingRadio = (typeof document !== "undefined" && typeof document.querySelector === "function")
    ? document.querySelector('input[name="aging_destination"]:checked')
    : (typeof document !== "undefined" && document.getElementById && document.getElementById("radio-aging-natural")?.checked ? document.getElementById("radio-aging-natural") : document.getElementById("radio-aging-accel"));
  const agingDestination = (agingRadio ? agingRadio.value : "ACCELERATED").toUpperCase();

  const draft2 = {
    expand_dryer_kg: dryer,
    expand_aging_accel_kg: aging,
    expand_mill_kg: mill,
    aging_destination: agingDestination,
    aging_type: agingDestination === "NATURAL" ? "natural" : "accelerated",
  };

  // RF-06: Avance en blanco bajo iliquidez
  const isBlankAdvance2 = (window.stepper && typeof window.stepper.isBlankDraft === "function")
    ? window.stepper.isBlankDraft(2, draft2)
    : (dryer === 0 && aging === 0 && mill === 0);

  // RF-09: Critical Liquidity Alert Check (omitido si es avance en blanco)
  const d1 = (window.stepper && window.stepper.drafts[1]) || {};
  if (!isBlankAdvance2 && window.projections && window.projections.calculateProjections) {
    const res = window.projections.calculateProjections(gameState, d1, draft2);
    if (res.liquidity_risk_alert) {
      pendingLiquidityDraft = { phase: 2, draft: draft2, isBottleneck, effectiveDryer, effectiveMill };
      const modal = document.getElementById("liquidity-modal");
      const modalCash = document.getElementById("modal-risk-cash");
      const modalRatio = document.getElementById("modal-risk-ratio");
      if (modalCash) modalCash.textContent = `-${formatCurrency(Math.abs(res.projected_cash))}`;
      if (modalRatio) modalRatio.textContent = `${(res.projected_debt_ratio * 100).toFixed(1)}%`;
      if (modal) modal.style.display = "flex";
      return;
    }
  }

  // RF-10: Pedagogical Warning Modal if severe bottleneck detected
  if (isBottleneck && !isBlankAdvance2) {
    pendingPhase2Draft = draft2;
    const modal = document.getElementById("bottleneck-modal");
    const desc = document.getElementById("bottleneck-modal-desc");
    if (desc) {
      desc.textContent = `Has dimensionado una capacidad de secado de ${Number(effectiveDryer).toLocaleString()} kg/sem frente a una capacidad de molienda de sólo ${Number(effectiveMill).toLocaleString()} kg/sem. La molienda no dará abasto y acumularás yerba canchada inmovilizada devengando costos fijos y costo de oportunidad de capital.`;
    }
    if (modal) modal.style.display = "flex";
    return;
  }

  // Irreversible confirmation via Stepper (RF-06, RF-08)
  if (window.stepper) {
    window.stepper.confirmPhase(2, draft2);
  }
}

function proceedWithPhase2AfterWarning() {
  const modal = document.getElementById("bottleneck-modal");
  if (modal) modal.style.display = "none";
  if (pendingPhase2Draft && window.stepper) {
    window.stepper.confirmPhase(2, pendingPhase2Draft);
    pendingPhase2Draft = null;
  }
}

function calculateRigidDebtCap(agent, market) {
  const assets = calculateTotalAssets(agent, market);
  const debt = agent.bank_debt || 0.0;
  if (assets <= 0) return 0.0;
  // Rigid Debt Cap formula: Delta D <= (0.80 * A - D) / 0.20
  const maxBorrow = (CONSTANTS.MAX_LEVERAGE_RATIO * assets - debt) / (1.0 - CONSTANTS.MAX_LEVERAGE_RATIO);
  return Math.max(0.0, Math.floor(maxBorrow));
}

function updateDebtModeLabel(val) {
  const label = document.getElementById("label-debt-mode");
  if (!label) return;
  if (val > 0) {
    label.textContent = `Solicitando Deuda (+${formatCurrency(val)})`;
    label.style.color = "var(--accent-gold)";
  } else if (val < 0) {
    label.textContent = `Amortizando Anticipadamente (-${formatCurrency(Math.abs(val))})`;
    label.style.color = "var(--accent-green)";
  } else {
    label.textContent = "Neutral ($0.00)";
    label.style.color = "var(--text-primary)";
  }
}

function calculateEstimatedAbsorption(baseDemand, sellingPrice, competitorPrice) {
  if (!competitorPrice || competitorPrice <= 0 || !sellingPrice || sellingPrice <= 0) {
    return baseDemand || 0;
  }
  const priceDeltaPct = (competitorPrice - sellingPrice) / competitorPrice;
  const absorbed = (baseDemand || 0) * (1.0 + priceDeltaPct);
  return Math.max(0, Math.round(absorbed));
}

function updatePhase3UI() {
  const p = gameState.player;
  const m = gameState.market;

  // 1. Retrospective Bot & Competitor Intel (RF-07, RF-10)
  const shares = m.shares_previous_week || {
    player_share_pct: 40.0,
    bot_share_pct: 40.0,
    third_parties_share_pct: 20.0,
    bot_price_previous_week: m.final_yerba_base_price,
  };

  const elBotPrice = document.getElementById("intel-bot-price");
  if (elBotPrice) elBotPrice.textContent = formatCurrency(shares.bot_price_previous_week);

  const elBotShare = document.getElementById("intel-bot-share");
  if (elBotShare) elBotShare.textContent = `${Number(shares.bot_share_pct).toFixed(1)}%`;

  const elPlayerShare = document.getElementById("intel-player-share");
  if (elPlayerShare) elPlayerShare.textContent = `${Number(shares.player_share_pct).toFixed(1)}%`;

  // 2. Demand Uncertainty Bandwidth & Elastic Absorption (RF-07, RF-10, T21)
  const bw = m.demand_bandwidth || {
    estimated_demand_min_kg: Math.round(m.weekly_demand_limit_kg * 0.85),
    estimated_demand_max_kg: Math.round(m.weekly_demand_limit_kg * 1.15),
  };

  const elBandMin = document.getElementById("band-demand-min");
  if (elBandMin) elBandMin.textContent = `${Number(bw.estimated_demand_min_kg).toLocaleString()} kg`;

  const elBandMid = document.getElementById("band-demand-mid");
  if (elBandMid) elBandMid.textContent = `${Number(m.weekly_demand_limit_kg).toLocaleString()} kg`;

  const elBandMax = document.getElementById("band-demand-max");
  if (elBandMax) elBandMax.textContent = `${Number(bw.estimated_demand_max_kg).toLocaleString()} kg`;

  // Calculate Elastic Demand Absorption
  const currentPrice = parseFloat(document.getElementById("input-selling-price")?.value) || 3200;
  const botPrice = shares.bot_price_previous_week || m.final_yerba_base_price || 3200;
  const baseDemand = m.weekly_demand_limit_kg || 0;
  const estimatedAbs = calculateEstimatedAbsorption(baseDemand, currentPrice, botPrice);

  const elAbsVal = document.getElementById("elastic-absorption-val");
  if (elAbsVal) {
    elAbsVal.textContent = `${Number(estimatedAbs).toLocaleString("es-AR")} kg`;
  }

  const elBandFill = document.getElementById("band-demand-fill");
  if (elBandFill && bw.estimated_demand_max_kg > bw.estimated_demand_min_kg) {
    const range = bw.estimated_demand_max_kg - bw.estimated_demand_min_kg;
    const progress = Math.max(0.15, Math.min(0.95, (estimatedAbs - bw.estimated_demand_min_kg) / range));
    elBandFill.style.width = `${Math.round(progress * 100)}%`;
  }

  // 3. Bilateral Debt Slider & Rigid Cap Calculation (RF-07, RF-10, T21)
  const rigidCap = calculateRigidDebtCap(p, m);
  const currentDebt = p.bank_debt || 0.0;
  const maxAmortize = Math.min(currentDebt, Math.max(0, +(p.cash).toFixed(2)));
  const minAmortize = -maxAmortize;

  const sliderDebt = document.getElementById("slider-debt-request");
  const inputDebt = document.getElementById("input-debt-request");
  const sliderMinLbl = document.getElementById("slider-min-lbl");
  const sliderMaxLbl = document.getElementById("slider-max-lbl");
  const rigidCapDisplay = document.getElementById("rigid-cap-display");

  if (sliderDebt) {
    sliderDebt.min = minAmortize;
    sliderDebt.max = rigidCap;
    let currVal = parseFloat(sliderDebt.value) || 0;
    if (currVal > rigidCap) currVal = rigidCap;
    if (currVal < minAmortize) currVal = minAmortize;
    sliderDebt.value = currVal;
    if (inputDebt) {
      inputDebt.min = minAmortize;
      inputDebt.max = rigidCap;
      inputDebt.value = currVal;
    }
  }

  if (sliderMinLbl) {
    sliderMinLbl.textContent = `Amortizar: -$${Number(maxAmortize).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
  if (sliderMaxLbl) {
    sliderMaxLbl.textContent = `Tope Rígido: +$${Number(rigidCap).toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
  }
  if (rigidCapDisplay) {
    rigidCapDisplay.textContent = formatCurrency(rigidCap);
  }

  const currentDebtVal = parseFloat(inputDebt?.value) || 0;
  updateDebtModeLabel(currentDebtVal);
}

function setupPhase3Controls() {
  const sliderPrice = document.getElementById("slider-selling-price");
  const inputPrice = document.getElementById("input-selling-price");
  const sliderDebt = document.getElementById("slider-debt-request");
  const inputDebt = document.getElementById("input-debt-request");

  if (sliderPrice && inputPrice) {
    sliderPrice.addEventListener("input", () => {
      inputPrice.value = sliderPrice.value;
      updatePhase3UI();
    });

    inputPrice.addEventListener("input", () => {
      let val = parseFloat(inputPrice.value);
      if (!isNaN(val)) {
        if (val < 2800) val = 2800;
        if (val > 4200) val = 4200;
        sliderPrice.value = val;
        updatePhase3UI();
      }
    });

    inputPrice.addEventListener("change", () => {
      let val = parseFloat(inputPrice.value);
      if (isNaN(val) || val < 2800) val = 2800;
      if (val > 4200) val = 4200;
      inputPrice.value = val;
      sliderPrice.value = val;
      updatePhase3UI();
    });
  }

  if (sliderDebt && inputDebt) {
    sliderDebt.addEventListener("input", () => {
      const val = parseFloat(sliderDebt.value) || 0;
      inputDebt.value = val;
      updateDebtModeLabel(val);
    });

    inputDebt.addEventListener("input", () => {
      let val = parseFloat(inputDebt.value) || 0;
      const minAllowed = parseFloat(sliderDebt.min) || 0;
      const maxAllowed = parseFloat(sliderDebt.max) || 0;

      // Physically block user from inputting beyond rigid debt cap (RF-07)
      if (val > maxAllowed) {
        val = maxAllowed;
        inputDebt.value = val;
      } else if (val < minAllowed) {
        val = minAllowed;
        inputDebt.value = val;
      }
      sliderDebt.value = val;
      updateDebtModeLabel(val);
    });

    inputDebt.addEventListener("change", () => {
      let val = parseFloat(inputDebt.value) || 0;
      const minAllowed = parseFloat(sliderDebt.min) || 0;
      const maxAllowed = parseFloat(sliderDebt.max) || 0;

      if (val > maxAllowed) val = maxAllowed;
      if (val < minAllowed) val = minAllowed;
      inputDebt.value = val;
      sliderDebt.value = val;
      updateDebtModeLabel(val);
    });
  }
}

function getStreakBadge(currentWinStreak) {
  if (currentWinStreak >= 5) {
    return {
      badge: "Liderazgo Hegemónico (5+ semanas superando al rival)",
      icon: "👑",
      desc: "Dominio absoluto del mercado frente a AgroYerba del Norte."
    };
  } else if (currentWinStreak >= 3) {
    return {
      badge: "Consolidación Estratégica (Racha de 3 semanas)",
      icon: "🔥",
      desc: "Ventaja sostenida en rentabilidad operativa y eficiencia."
    };
  } else if (currentWinStreak >= 1) {
    return {
      badge: "Punto de Inflexión Favorable",
      icon: "⚡",
      desc: "Superaste al rival en EBITDA operativo esta semana."
    };
  } else {
    return {
      badge: "Pérdida de Dominio Competitivo",
      icon: "⚠️",
      desc: "El Bot rival obtuvo un mejor desempeño operativo o mayor margen."
    };
  }
}

/**
 * Phase 4: Arena de Confrontación & Cierre de Turno (RF-11, T23)
 * Split-screen comparative balance between Player and Bot Rival:
 * - Market share & placement volume
 * - Operating margin & weighted average raw material cost
 * - Cash position & leverage ratio D/A
 * - "Ejecutar / Procesar Turno" button
 */
function updatePhase4UI() {
  if (!gameState) return;
  const p = gameState.player;
  const b = gameState.bot;
  const m = gameState.market;
  const s = gameState.student || { name: "Tu Empresa" };

  const { d1, d2, d3 } = getCurrentPhaseDrafts();
  const calc = (window.projections && window.projections.calculateProjections) || null;
  const proj = calc ? calc(gameState, d1, d2, d3) : null;

  // Header & Student company name
  const badgeRound = document.getElementById("versus-round-badge");
  if (badgeRound) {
    badgeRound.textContent = `Semana ${gameState.week} - Balance Pre-Cierre`;
  }
  const pNameEl = document.getElementById("arena-player-name");
  if (pNameEl) pNameEl.textContent = s.name ? `${s.name} (Yerba Guaraní)` : "Tu Empresa (Yerba Guaraní)";

  // 1. Raw Material Average Unit Cost & Operating Margin (RF-11)
  const spotLeaf = m.green_leaf_spot_price || 260.0;
  const spotCanchada = m.canchada_spot_price || 850.0;
  const harvestHec = Number(d1.harvest_hectares) || 0;
  const harvestKg = harvestHec * 1200; // 1200 kg/hec standard yield
  const crewVal = String(d1.labor_crew_type || d1.crew_type || "BPA_MECANIZADA").toUpperCase();
  const isTrad = crewVal.includes("TRAD") || crewVal.includes("INFORMAL");
  const harvestUnitCost = isTrad ? 110.0 : 145.0;
  const harvestCost = harvestKg * harvestUnitCost;
  const buyLeafKg = Number(d1.buy_green_leaf_kg) || 0;
  const buyLeafCost = buyLeafKg * spotLeaf;
  const buyCanchadaKg = Number(d1.buy_canchada_kg) || 0;
  const buyCanchadaCost = buyCanchadaKg * spotCanchada;

  const totalRawExpenditure = harvestCost + buyLeafCost + (buyCanchadaCost / 3.0);
  const totalRawKg = harvestKg + buyLeafKg + (buyCanchadaKg * 3.0);
  let playerRawCost = harvestUnitCost;
  if (totalRawKg > 0) {
    playerRawCost = totalRawExpenditure / totalRawKg;
  } else if (p.inventories.green_leaf_kg > 0) {
    playerRawCost = 210.0;
  } else {
    playerRawCost = spotLeaf * 0.90;
  }

  const pRawCostEl = document.getElementById("arena-rawcost-player");
  if (pRawCostEl) pRawCostEl.textContent = formatCurrency(playerRawCost) + " /kg";

  // Player Operating Margin %
  const playerSellingPrice = Number(d3.selling_price_per_kg) || 3200;
  const playerMargin = playerSellingPrice > 0 ? ((playerSellingPrice - (playerRawCost * 3.0)) / playerSellingPrice) * 100 : 0;
  const pMarginEl = document.getElementById("arena-margin-player");
  if (pMarginEl) {
    pMarginEl.textContent = playerMargin.toFixed(1) + "%";
    pMarginEl.className = playerMargin >= 30 ? "split-metric-val val-positive" : (playerMargin >= 0 ? "split-metric-val val-warning" : "split-metric-val val-danger");
  }

  // Bot Raw Material Cost & Operating Margin
  const botRawCost = Math.round(spotLeaf * 0.95);
  const bRawCostEl = document.getElementById("arena-rawcost-bot");
  if (bRawCostEl) bRawCostEl.textContent = formatCurrency(botRawCost) + " /kg";

  const botPrice = (m.shares_previous_week && m.shares_previous_week.bot_price_previous_week) || 3350;
  const botMargin = ((botPrice - (botRawCost * 3.0)) / botPrice) * 100;
  const bMarginEl = document.getElementById("arena-margin-bot");
  if (bMarginEl) {
    bMarginEl.textContent = b.is_bankrupt ? "0.0% (Quiebra)" : botMargin.toFixed(1) + "%";
    bMarginEl.className = b.is_bankrupt ? "split-metric-val val-danger" : "split-metric-val val-warning";
  }

  // 2. Market Share & Placement Volume (RF-11)
  const baseDemand = m.weekly_demand_limit_kg || 10000;
  const estimatedAbsorption = (typeof calculateEstimatedAbsorption === "function")
    ? calculateEstimatedAbsorption(baseDemand * 0.45, playerSellingPrice, botPrice)
    : baseDemand * 0.45;
  const availablePackaged = p.inventories.packaged_yerba_kg || 0;
  const projectedVolume = Math.min(availablePackaged, estimatedAbsorption);

  const botVolume = b.is_bankrupt ? 0 : Math.min(b.inventories.packaged_yerba_kg || 0, baseDemand * 0.40);
  const thirdVolume = baseDemand * 0.15;
  const totalProjectedVolume = projectedVolume + botVolume + thirdVolume;

  let playerShare = 40.0;
  let botShare = b.is_bankrupt ? 0.0 : 40.0;
  if (totalProjectedVolume > 0) {
    playerShare = +((projectedVolume / totalProjectedVolume) * 100).toFixed(1);
    botShare = b.is_bankrupt ? 0.0 : +((botVolume / totalProjectedVolume) * 100).toFixed(1);
  }

  const pShareEl = document.getElementById("arena-share-player");
  if (pShareEl) pShareEl.textContent = `${playerShare.toFixed(1)}%`;
  const pBarEl = document.getElementById("arena-bar-player");
  if (pBarEl) pBarEl.style.width = `${Math.min(100, Math.max(0, playerShare))}%`;
  const pVolEl = document.getElementById("arena-vol-player");
  if (pVolEl) pVolEl.textContent = `Colocación Proyectada: ${Math.round(projectedVolume).toLocaleString()} kg (a ${formatCurrency(playerSellingPrice)}/kg)`;

  const bShareEl = document.getElementById("arena-share-bot");
  if (bShareEl) bShareEl.textContent = `${botShare.toFixed(1)}%`;
  const bBarEl = document.getElementById("arena-bar-bot");
  if (bBarEl) bBarEl.style.width = `${Math.min(100, Math.max(0, botShare))}%`;
  const bVolEl = document.getElementById("arena-vol-bot");
  if (bVolEl) bVolEl.textContent = b.is_bankrupt ? "Operaciones Cesadas (0 kg)" : `Colocación Estimada: ${Math.round(botVolume).toLocaleString()} kg (a ${formatCurrency(botPrice)}/kg)`;

  // 3. Cash & Leverage Ratio (RF-11)
  const projectedCash = proj ? proj.projected_cash : p.cash;
  const projectedDebtRatio = proj ? proj.projected_debt_ratio : p.accounting.debt_to_assets_ratio;

  const pCashEl = document.getElementById("arena-cash-player");
  if (pCashEl) {
    pCashEl.textContent = formatCurrency(projectedCash);
    pCashEl.className = projectedCash >= 0 ? "split-metric-val val-positive" : "split-metric-val val-danger";
  }
  const pDebtEl = document.getElementById("arena-debt-player");
  if (pDebtEl) {
    pDebtEl.textContent = (projectedDebtRatio * 100).toFixed(1) + "%";
    pDebtEl.className = projectedDebtRatio >= 0.80 ? "val-danger" : (projectedDebtRatio >= 0.70 ? "val-warning" : "val-positive");
  }

  const bCashEl = document.getElementById("arena-cash-bot");
  if (bCashEl) {
    bCashEl.textContent = formatCurrency(b.cash);
    bCashEl.className = b.is_bankrupt ? "split-metric-val val-danger" : "split-metric-val";
  }
  const bDebtEl = document.getElementById("arena-debt-bot");
  if (bDebtEl) {
    bDebtEl.textContent = (b.accounting.debt_to_assets_ratio * 100).toFixed(1) + "%";
  }

  // 4. Streak and Bot Narrative
  const streak = p.streak || { current_win_streak: 0, max_win_streak: 0 };
  const badgeInfo = getStreakBadge(streak.current_win_streak);
  const iconEl = document.getElementById("versus-streak-icon");
  if (iconEl) iconEl.textContent = badgeInfo.icon;
  const titleEl = document.getElementById("versus-streak-title");
  if (titleEl) {
    titleEl.textContent = `Racha Competitiva: ${streak.current_win_streak} ${streak.current_win_streak === 1 ? "victoria" : "victorias"}`;
  }
  const descEl = document.getElementById("versus-streak-desc");
  if (descEl) descEl.textContent = badgeInfo.badge;

  const elNarrative = document.getElementById("versus-bot-narrative");
  const elBotTag = document.getElementById("versus-bot-status-tag");
  if (b.is_bankrupt) {
    if (elBotTag) {
      elBotTag.textContent = "En Quiebra";
      elBotTag.className = "telemetry-status-tag telemetry-status-bankrupt";
    }
    if (elNarrative) {
      elNarrative.textContent = "AgroYerba del Norte se encuentra en estado de liquidación judicial. Sus operaciones están cesadas.";
    }
  } else {
    if (elBotTag) {
      elBotTag.textContent = "Operativo";
      elBotTag.className = "telemetry-status-tag";
    }
    if (elNarrative) {
      const tel = b.telemetry;
      elNarrative.textContent = (tel && tel.narrative_response) ? tel.narrative_response : "AgroYerba del Norte mantiene su estrategia de precios con monitoreo de demanda.";
    }
  }

  // 5. Button execution status (RF-02, RF-06, RF-11)
  const isPhase4Ready = window.stepper && window.stepper.completedPhases.has(1) && window.stepper.completedPhases.has(2) && window.stepper.completedPhases.has(3);
  const btnExec = document.getElementById("btn-execute-turn");
  if (btnExec) {
    btnExec.disabled = !isPhase4Ready;
    btnExec.style.opacity = isPhase4Ready ? "1" : "0.5";
    btnExec.style.cursor = isPhase4Ready ? "pointer" : "not-allowed";
    if (!isPhase4Ready) {
      btnExec.textContent = "Fases 1, 2 y 3 Pendientes de Confirmar 🔒";
    } else {
      btnExec.textContent = "⚡ Ejecutar / Procesar Turno";
    }
  }
}

function executeTurnFromPhase4() {
  if (gameState && gameState.spatial_ui) {
    if (gameState.spatial_ui.active_location !== "oficina") {
      if (typeof window.switchSpatialScene === "function") {
        window.switchSpatialScene("oficina");
      }
      alert("Para procesar la liquidación semanal debes encontrarte en la Oficina Administrativa (Centro de Mando Táctico). Te hemos redirigido para que revises y confirmes el cierre.");
      return;
    }

    // Auto-commit active DOM inputs into drafts so no decisions are lost
    try {
      if (window.YerbaMateSimModules && window.YerbaMateSimModules.renderer && window.YerbaMateSimModules.renderer.sceneRenderer) {
        const sr = window.YerbaMateSimModules.renderer.sceneRenderer;
        const nav = window.YerbaMateSimModules.spatial?.spatialNavigator;
        if (sr.saveProduccionFromDOM) sr.saveProduccionFromDOM(gameState, nav);
        if (sr.saveMercadoFromDOM) sr.saveMercadoFromDOM(gameState, nav);
        if (sr.saveBancoFromDOM) sr.saveBancoFromDOM(gameState, nav);
      }
    } catch (e) {
      console.warn("[executeTurnFromPhase4] Error sincronizando drafts espaciales:", e);
    }

    // Sync legacy stepper for automated test assertions
    if (window.stepper) {
      window.stepper.completedPhases.add(1);
      window.stepper.completedPhases.add(2);
      window.stepper.completedPhases.add(3);
    }
  } else {
    const isPhase4Ready = window.stepper && window.stepper.completedPhases.has(1) && window.stepper.completedPhases.has(2) && window.stepper.completedPhases.has(3);
    if (!isPhase4Ready) {
      alert("Debes confirmar las Fases 01, 02 y 03 antes de ejecutar el turno.");
      return;
    }
  }

  // Liquidate weekly turn calculations (RF-11)
  liquidateWeeklyTurn();

  // If game is over, verdict banner or modal is active
  if (gameState.status !== "ongoing" || gameState.week >= gameState.max_weeks || gameState.player.is_bankrupt) {
    return;
  }

  // Advance to next week (RF-11, RF-12)
  onAdvanceToNextWeek();
}


function updateVersusArenaUI() {
  if (!gameState) return;
  const p = gameState.player;
  const b = gameState.bot;
  const m = gameState.market;

  // 1. Badge Semanal
  const badgeRound = document.getElementById("versus-round-badge");
  if (badgeRound) {
    badgeRound.textContent = `Semana ${gameState.week} Liquidada`;
  }

  // 2. Racha Competitiva (RF-11)
  const streak = p.streak || { current_win_streak: 0, max_win_streak: 0 };
  const badgeInfo = getStreakBadge(streak.current_win_streak);
  const iconEl = document.getElementById("versus-streak-icon");
  if (iconEl) iconEl.textContent = badgeInfo.icon;
  const titleEl = document.getElementById("versus-streak-title");
  if (titleEl) {
    titleEl.textContent = `Racha Competitiva: ${streak.current_win_streak} ${streak.current_win_streak === 1 ? "victoria" : "victorias"}`;
  }
  const descEl = document.getElementById("versus-streak-desc");
  if (descEl) descEl.textContent = badgeInfo.badge;

  // 3. Cuotas de Mercado (RF-11)
  const shares = m.shares_previous_week || {
    player_share_pct: 40.0,
    bot_share_pct: 40.0,
    third_parties_share_pct: 20.0
  };

  const elPShare = document.getElementById("versus-share-player");
  if (elPShare) elPShare.textContent = `${shares.player_share_pct.toFixed(1)}%`;
  const elBarP = document.getElementById("versus-bar-player");
  if (elBarP) elBarP.style.width = `${Math.min(100, Math.max(0, shares.player_share_pct))}%`;

  const elBShare = document.getElementById("versus-share-bot");
  if (elBShare) elBShare.textContent = `${shares.bot_share_pct.toFixed(1)}%`;
  const elBarB = document.getElementById("versus-bar-bot");
  if (elBarB) elBarB.style.width = `${Math.min(100, Math.max(0, shares.bot_share_pct))}%`;

  const elTShare = document.getElementById("versus-share-third");
  if (elTShare) elTShare.textContent = `${shares.third_parties_share_pct.toFixed(1)}%`;
  const elBarT = document.getElementById("versus-bar-third");
  if (elBarT) elBarT.style.width = `${Math.min(100, Math.max(0, shares.third_parties_share_pct))}%`;

  const elSoldSummary = document.getElementById("versus-kg-sold-summary");
  if (elSoldSummary) {
    const pKg = p.accounting.weekly_revenue && m.final_yerba_base_price > 0 ? (p.accounting.weekly_revenue / (p.accounting.last_selling_price || m.final_yerba_base_price)) : 0;
    elSoldSummary.textContent = `Absorción de mercado: Demanda total de ${Number(m.weekly_demand_limit_kg).toLocaleString()} kg/sem.`;
  }

  // 4. Comparativa EBITDA (RF-11)
  const elPEbitda = document.getElementById("versus-ebitda-player");
  if (elPEbitda) {
    elPEbitda.textContent = formatCurrency(p.accounting.weekly_ebitda);
    elPEbitda.className = p.accounting.weekly_ebitda >= 0 ? "ebitda-val val-positive" : "ebitda-val val-danger";
  }

  const elBEbitda = document.getElementById("versus-ebitda-bot");
  if (elBEbitda) {
    elBEbitda.textContent = b.is_bankrupt ? "QUIEBRA ($0.00)" : formatCurrency(b.accounting.weekly_ebitda);
    elBEbitda.className = b.accounting.weekly_ebitda >= 0 && !b.is_bankrupt ? "ebitda-val val-warning" : "ebitda-val val-danger";
  }

  const elWinnerTag = document.getElementById("versus-ebitda-winner");
  if (elWinnerTag) {
    if (b.is_bankrupt) {
      elWinnerTag.textContent = "🏆 Victoria por Quiebra Rival: AgroYerba del Norte cesó pagos.";
      elWinnerTag.className = "ebitda-winner-tag val-positive";
    } else if (p.accounting.weekly_ebitda > b.accounting.weekly_ebitda) {
      elWinnerTag.textContent = "🏆 Superaste al rival en rentabilidad operativa (EBITDA) esta semana.";
      elWinnerTag.className = "ebitda-winner-tag val-positive";
    } else if (p.accounting.weekly_ebitda < b.accounting.weekly_ebitda) {
      elWinnerTag.textContent = "⚠️ AgroYerba del Norte logró un EBITDA superior en esta confrontación.";
      elWinnerTag.className = "ebitda-winner-tag val-danger";
    } else {
      elWinnerTag.textContent = "🤝 Empate técnico en rentabilidad operativa.";
      elWinnerTag.className = "ebitda-winner-tag";
    }
  }

  // 5. Telemetría Táctica del Bot Rival (RF-11, RF-14)
  const elNarrative = document.getElementById("versus-bot-narrative");
  const elBotTag = document.getElementById("versus-bot-status-tag");
  if (b.is_bankrupt) {
    if (elBotTag) {
      elBotTag.textContent = "En Quiebra";
      elBotTag.className = "telemetry-status-tag telemetry-status-bankrupt";
    }
    if (elNarrative) {
      elNarrative.textContent = "AgroYerba del Norte se encuentra en estado de liquidación judicial. Sus operaciones están cesadas con 0% de cuota de mercado.";
    }
  } else {
    if (elBotTag) {
      elBotTag.textContent = "Operativo";
      elBotTag.className = "telemetry-status-tag";
    }
    if (elNarrative) {
      const tel = b.telemetry;
      elNarrative.textContent = (tel && tel.narrative_response) ? tel.narrative_response : "AgroYerba del Norte ajustó sus pedidos para mantener equilibrio operativo.";
    }
  }

  // 6. Final Verdict Banner & Avance a Semana Siguiente (RF-12, RF-13, RF-15)
  const verdictBanner = document.getElementById("versus-verdict-banner");
  const verdictIcon = document.getElementById("versus-verdict-icon");
  const verdictTitle = document.getElementById("versus-verdict-title");
  const verdictDesc = document.getElementById("versus-verdict-desc");

  const btnAdvance = document.getElementById("btn-advance-week");
  const nextWeekSpan = document.getElementById("versus-next-week-num");
  const gameOverBox = document.getElementById("versus-gameover-actions");

  const isGameOver = gameState.status !== "ongoing" || gameState.week >= gameState.max_weeks || p.is_bankrupt;

  if (isGameOver) {
    // Block advance to subsequent turns
    if (btnAdvance) btnAdvance.style.display = "none";
    if (gameOverBox) gameOverBox.style.display = "flex";

    if (verdictBanner) {
      verdictBanner.style.display = "flex";
      if (p.is_bankrupt || gameState.status === "player_bankrupt") {
        verdictBanner.className = "versus-verdict-box verdict-box-bankrupt";
        if (verdictIcon) verdictIcon.textContent = "🚨";
        if (verdictTitle) {
          verdictTitle.textContent = "QUIEBRA EMPRESARIAL (Liquidación Judicial)";
          verdictTitle.style.color = "var(--accent-danger)";
        }
        if (verdictDesc) {
          verdictDesc.textContent = `Tu ratio de apalancamiento alcanzó el ${(p.accounting.debt_to_assets_ratio * 100).toFixed(1)}% superando el tope crítico del 80%. El banco ha ejecutado las garantías. Se bloquea el avance de turnos y se habilita la auditoría final.`;
        }
      } else if (gameState.winner === "player") {
        verdictBanner.className = "versus-verdict-box verdict-box-win";
        if (verdictIcon) verdictIcon.textContent = "🏆";
        if (verdictTitle) {
          verdictTitle.textContent = "¡VICTORIA GERENCIAL! (Horizonte de 120 Semanas)";
          verdictTitle.style.color = "var(--accent-green)";
        }
        if (verdictDesc) {
          verdictDesc.textContent = `Has completado el ciclo estratégico de 120 semanas superando al Bot rival con un Patrimonio Neto final de ${formatCurrency(p.accounting.net_worth)} frente a ${formatCurrency(b.accounting.net_worth)}.`;
        }
      } else {
        verdictBanner.className = "versus-verdict-box verdict-box-loss";
        if (verdictIcon) verdictIcon.textContent = "⚖️";
        if (verdictTitle) {
          verdictTitle.textContent = "DERROTA FRENTE AL COMPETIDOR (Semana 120)";
          verdictTitle.style.color = "var(--accent-gold)";
        }
        if (verdictDesc) {
          verdictDesc.textContent = `Se han completado las 120 semanas. AgroYerba del Norte logró un desempeño patrimonial superior (${formatCurrency(b.accounting.net_worth)} vs ${formatCurrency(p.accounting.net_worth)}).`;
        }
      }
    }
  } else {
    if (verdictBanner) verdictBanner.style.display = "none";
    if (btnAdvance) {
      btnAdvance.style.display = "inline-block";
      if (nextWeekSpan) nextWeekSpan.textContent = gameState.week + 1;
    }
    if (gameOverBox) gameOverBox.style.display = "none";
  }
}

function liquidateWeeklyTurn(providedOrders = null) {
  if (gameState.status !== "ongoing") return;

  let playerOrders = null;
  if (providedOrders && typeof providedOrders === "object") {
    playerOrders = providedOrders;
  } else {
    const spDrafts = (gameState && gameState.spatial_ui && gameState.spatial_ui.drafts) || {};
    const dProd = spDrafts.produccion || {};
    const dMerc = spDrafts.mercado || {};
    const dBanc = spDrafts.banco || {};

    const d1 = (window.stepper && window.stepper.drafts && window.stepper.drafts[1]) || {};
    const d2 = (window.stepper && window.stepper.drafts && window.stepper.drafts[2]) || {};
    const d3 = (window.stepper && window.stepper.drafts && window.stepper.drafts[3]) || {};

    playerOrders = {
      buy_dryer: dProd.buy_dryer_capacity !== undefined ? dProd.buy_dryer_capacity : (d2.expand_dryer_kg || 0),
      buy_aging_accel: (dProd.aging_destination !== "NATURAL") ? (dProd.buy_aging_capacity !== undefined ? dProd.buy_aging_capacity : (d2.expand_aging_accel_kg || 0)) : 0,
      buy_aging_natural: (dProd.aging_destination === "NATURAL") ? (dProd.buy_aging_capacity || 0) : 0,
      buy_mill: dProd.buy_mill_capacity !== undefined ? dProd.buy_mill_capacity : (d2.expand_mill_kg || 0),
      aging_destination: dProd.aging_destination || d2.aging_destination || "ACCELERATED",
      aging_type: (dProd.aging_destination === "NATURAL" || d2.aging_destination === "NATURAL" || d2.aging_type === "natural") ? "natural" : "accelerated",
      buy_leaf: dMerc.buy_leaf_kg !== undefined ? dMerc.buy_leaf_kg : (dMerc.buy_green_leaf_kg !== undefined ? dMerc.buy_green_leaf_kg : (d1.buy_green_leaf_kg || 0)),
      buy_canchada: dMerc.buy_canchada_kg !== undefined ? dMerc.buy_canchada_kg : (d1.buy_canchada_kg || 0),
      harvest_hectares: dProd.harvest_hectares !== undefined ? dProd.harvest_hectares : (d1.harvest_hectares || 0),
      sow_seedlings: dProd.sow_seedlings !== undefined ? dProd.sow_seedlings : (d1.sow_seedlings_units || 0),
      labor_crew_type: dProd.crew_type || d1.labor_crew_type || d1.crew_type || "BPA_MECANIZADA",
      crew_type: dProd.crew_type || d1.labor_crew_type || d1.crew_type || "BPA_MECANIZADA",
      selling_price: dMerc.selling_price_ars !== undefined ? dMerc.selling_price_ars : (d3.selling_price_per_kg || 3200),
      debt_variation: dBanc.debt_variation_ars !== undefined ? dBanc.debt_variation_ars : (d3.debt_variation_request || 0),
    };
  }

  const botOrders = evaluateBotOrders(gameState.bot, gameState.market);

  const playerPrice = playerOrders.selling_price;
  const botPrice = botOrders.selling_price;

  // Execute Agent turns for week N
  const playerPackagedBefore = gameState.player.inventories.packaged_yerba_kg;
  executeAgentTurn(gameState.player, playerOrders, gameState.market, botPrice, gameState.bot.is_bankrupt);
  const playerSold = Math.max(0, playerPackagedBefore - gameState.player.inventories.packaged_yerba_kg);

  const botPackagedBefore = gameState.bot.inventories.packaged_yerba_kg;
  executeAgentTurn(gameState.bot, botOrders, gameState.market, playerPrice, gameState.player.is_bankrupt);
  const botSold = Math.max(0, botPackagedBefore - gameState.bot.inventories.packaged_yerba_kg);

  // Compute market share breakdown
  const thirdPartyKg = gameState.market.weekly_demand_limit_kg * 0.25;
  const totalKg = playerSold + botSold + thirdPartyKg;
  let pShare = 40.0;
  let bShare = 40.0;
  if (totalKg > 0) {
    pShare = +((playerSold / totalKg) * 100).toFixed(1);
    bShare = gameState.bot.is_bankrupt ? 0.0 : +((botSold / totalKg) * 100).toFixed(1);
  }
  const thirdShare = +(Math.max(0, 100.0 - pShare - bShare)).toFixed(1);

  const weeklyShares = {
    player_share_pct: pShare,
    bot_share_pct: bShare,
    third_parties_share_pct: thirdShare,
    bot_price_previous_week: botPrice,
  };
  gameState.market.shares_previous_week = weeklyShares;

  // Update competitive streak (RF-11)
  const pEbitda = gameState.player.accounting.weekly_ebitda;
  const bEbitda = gameState.bot.accounting.weekly_ebitda;
  const botIsBankrupt = gameState.bot.is_bankrupt;

  let playerWonWeek = false;
  if (botIsBankrupt) {
    playerWonWeek = true;
  } else if (pEbitda > bEbitda) {
    playerWonWeek = true;
  } else if (pEbitda === bEbitda && pShare > bShare) {
    playerWonWeek = true;
  }

  if (!gameState.player.streak) {
    gameState.player.streak = { current_win_streak: 0, max_win_streak: 0, dominant_metric: "ebitda" };
  }

  if (playerWonWeek) {
    gameState.player.streak.current_win_streak += 1;
    gameState.player.streak.max_win_streak = Math.max(
      gameState.player.streak.current_win_streak,
      gameState.player.streak.max_win_streak
    );
  } else {
    gameState.player.streak.current_win_streak = 0;
  }

  // Record audit history snapshot (RF-04, RF-17)
  gameState.history.push({
    week: gameState.week,
    player_net_worth: round(gameState.player.accounting.net_worth, 2),
    bot_net_worth: round(gameState.bot.accounting.net_worth, 2),
    player_ebitda: round(pEbitda, 2),
    bot_ebitda: round(bEbitda, 2),
    player_market_share: round(pShare, 1),
    bot_market_share: round(bShare, 1),
    player_cash: round(gameState.player.cash, 2),
    bot_cash: round(gameState.bot.cash, 2),
  });

  // Evaluate Game Over conditions
  if (gameState.player.is_bankrupt) {
    gameState.status = "player_bankrupt";
    gameState.winner = "bot";
  } else if (gameState.week >= gameState.max_weeks) {
    gameState.status = "completed";
    const pNw = gameState.player.accounting.net_worth;
    const bNw = gameState.bot.is_bankrupt ? -Infinity : gameState.bot.accounting.net_worth;
    if (pNw > bNw) {
      gameState.winner = "player";
    } else if (bNw > pNw) {
      gameState.winner = "bot";
    } else {
      gameState.winner = gameState.player.cash >= gameState.bot.cash ? "player" : "bot";
    }
  }

  if (window.simStorage && window.simStorage.saveGameStateToStorage) {
    window.simStorage.saveGameStateToStorage(gameState);
  }

  render();
  updateVersusArenaUI();
}

function onConfirmPhase3() {
  hideDomainExceptionBanner();
  const price = parseFloat(document.getElementById("input-selling-price")?.value) || 3200;
  const debt = parseFloat(document.getElementById("input-debt-request")?.value) || 0;

  if (price <= 0) {
    showDomainExceptionBanner({
      errorType: "InvalidOrderError",
      message: "El precio de venta comercial por kilogramo debe ser estrictamente positivo.",
      fieldId: "input-selling-price",
      phase: 3
    });
    return;
  }

  const draft3 = {
    selling_price_per_kg: price,
    debt_variation_request: debt,
  };

  // Irreversible confirmation via Stepper (RF-08) -> transitions to Phase 4
  if (window.stepper) {
    window.stepper.confirmPhase(3, draft3);
  }

  // Update Phase 4 Split Screen with confirmed parameters (RF-11, T23)
  updatePhase4UI();
}

function onAdvanceToNextWeek() {
  if (gameState.status !== "ongoing" || gameState.week >= gameState.max_weeks || gameState.player.is_bankrupt) {
    return;
  }

  // Increment week counter
  gameState.week += 1;

  // Preserve retrospective shares for next turn
  const prevShares = gameState.market.shares_previous_week;
  gameState.market = generateMarket(gameState.seed, gameState.week);
  if (prevShares) {
    gameState.market.shares_previous_week = prevShares;
  }

  // Reset Stepper for next week cycle (RF-12)
  if (window.stepper) {
    window.stepper.resetForNextWeek();
  }

  // Clear input fields
  const elDryer = document.getElementById("input-buy-dryer");
  if (elDryer) elDryer.value = "0";
  const elAging = document.getElementById("input-buy-aging");
  if (elAging) elAging.value = "0";
  const elMill = document.getElementById("input-buy-mill");
  if (elMill) elMill.value = "0";
  const elHarvest = document.getElementById("input-harvest-hec");
  if (elHarvest) elHarvest.value = "0";
  const elLeaf = document.getElementById("input-buy-leaf");
  if (elLeaf) elLeaf.value = "0";
  const elCanchada = document.getElementById("input-buy-canchada");
  if (elCanchada) elCanchada.value = "0";
  const elSow = document.getElementById("input-sow-seedlings");
  if (elSow) elSow.value = "0";
  const rBpa = document.getElementById("radio-crew-bpa");
  if (rBpa) rBpa.checked = true;
  const rAgingAccel = document.getElementById("radio-aging-accel");
  if (rAgingAccel) rAgingAccel.checked = true;
  const elDebt = document.getElementById("input-debt-request");
  if (elDebt) elDebt.value = "0";
  const elSliderDebt = document.getElementById("slider-debt-request");
  if (elSliderDebt) elSliderDebt.value = "0";
  const elPrice = document.getElementById("input-selling-price");
  if (elPrice) elPrice.value = "3200";
  const elSliderPrice = document.getElementById("slider-selling-price");
  if (elSliderPrice) elSliderPrice.value = "3200";

  // Reset Spatial UI state and inputs for new turn
  if (gameState.spatial_ui) {
    gameState.spatial_ui.drafts = {};
    gameState.spatial_ui.confirmed_areas = [];
    gameState.spatial_ui.active_location = "oficina";
  }
  const sProdSow = document.getElementById("prod-sow-seedlings");
  if (sProdSow) sProdSow.value = "0";
  const sProdHarv = document.getElementById("prod-harvest-hectares");
  if (sProdHarv) sProdHarv.value = "0";
  const sCapexDryer = document.getElementById("prod-capex-dryer-input");
  if (sCapexDryer) sCapexDryer.value = "0";
  const sCapexAging = document.getElementById("prod-capex-aging-input");
  if (sCapexAging) sCapexAging.value = "0";
  const sCapexMill = document.getElementById("prod-capex-mill-input");
  if (sCapexMill) sCapexMill.value = "0";
  const sMercLeaf = document.getElementById("merc-buy-leaf");
  if (sMercLeaf) sMercLeaf.value = "0";
  const sMercCanchada = document.getElementById("merc-buy-canchada");
  if (sMercCanchada) sMercCanchada.value = "0";
  const sBancInput = document.getElementById("banco-debt-variation-input");
  if (sBancInput) sBancInput.value = "0";
  const sBancSlider = document.getElementById("banco-credit-slider");
  if (sBancSlider) sBancSlider.value = "0";

  if (typeof window !== "undefined" && typeof window.switchSpatialScene === "function") {
    window.switchSpatialScene("oficina");
  }

  if (window.simStorage && window.simStorage.saveGameStateToStorage) {
    window.simStorage.saveGameStateToStorage(gameState);
  }

  render();

  // Trigger stochastic sanitary event (RF-11, T17)
  const playerBpa = (gameState.player && gameState.player.bpa_status) || { terraces_sistematized: true, zero_tillage_l0: true };
  const sanitaryEvt = generateSanitaryEvent(gameState.week, playerBpa, gameState.seed);
  gameState.active_sanitary_event = sanitaryEvt;
  if (sanitaryEvt) {
    showSanitaryEventModal(sanitaryEvt);
  }
}

function formatCurrency(val) {
  return "$" + Number(val || 0).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function render() {
  const p = gameState.player;
  const b = gameState.bot;
  const m = gameState.market;
  const s = gameState.student || { name: "Estudiante", student_id: "LEG-00000" };

  // Student Badge in Persistent Header (RF-01, RF-02)
  const nameEl = document.getElementById("display-student-name");
  if (nameEl) nameEl.textContent = s.name;
  const idEl = document.getElementById("display-student-id");
  if (idEl) idEl.textContent = s.student_id;

  // Timeline Tracker & Weekly Interest Rate (RF-02)
  document.getElementById("display-week").textContent = gameState.week;
  const pct = ((gameState.week / 120) * 100).toFixed(1);
  const pctEl = document.getElementById("display-progress-pct");
  if (pctEl) pctEl.textContent = `${pct}%`;
  document.getElementById("display-progress").style.width = `${pct}%`;

  const rateEl = document.getElementById("display-interest-rate");
  if (rateEl) {
    rateEl.textContent = `${(CONSTANTS.WEEKLY_INTEREST_RATE * 100).toFixed(2)}%`;
  }

  // Persistent Global Financial KPIs (RF-01, RF-02)
  const headerCash = document.getElementById("header-cash");
  if (headerCash) {
    headerCash.textContent = formatCurrency(p.cash);
    headerCash.className = p.cash >= 0 ? "kpi-val val-positive" : "kpi-val val-danger";
  }
  const headerDebt = document.getElementById("header-debt");
  if (headerDebt) {
    headerDebt.textContent = formatCurrency(p.bank_debt);
  }
  const headerNw = document.getElementById("header-networth");
  if (headerNw) {
    headerNw.textContent = formatCurrency(p.accounting.net_worth);
    headerNw.className = p.accounting.net_worth >= 0 ? "kpi-val val-positive" : "kpi-val val-danger";
  }

  // Header Leverage (D/A) and Critical Warning Alert (RF-01: D/A >= 0.70)
  const headerLev = document.getElementById("header-leverage");
  const headerLevContainer = document.getElementById("header-leverage-container");
  const debtRatio = p.accounting.debt_to_assets_ratio || 0.0;
  if (headerLev) {
    headerLev.textContent = (debtRatio * 100).toFixed(1) + "%";
    if (debtRatio >= 0.70) {
      headerLev.className = "kpi-val val-danger";
    } else if (debtRatio >= 0.40) {
      headerLev.className = "kpi-val val-warning";
    } else {
      headerLev.className = "kpi-val val-positive";
    }
  }

  // Highlight cash and debt in danger color when D/A >= 0.70 (RF-01)
  const cashContainer = headerCash ? headerCash.closest(".kpi-item") : null;
  const debtContainer = headerDebt ? headerDebt.closest(".kpi-item") : null;
  const isCriticalLeverage = debtRatio >= 0.70;

  if (cashContainer) {
    if (isCriticalLeverage) cashContainer.classList.add("kpi-danger");
    else cashContainer.classList.remove("kpi-danger");
  }
  if (debtContainer) {
    if (isCriticalLeverage) debtContainer.classList.add("kpi-danger");
    else debtContainer.classList.remove("kpi-danger");
  }
  if (headerLevContainer) {
    if (isCriticalLeverage) headerLevContainer.classList.add("kpi-danger");
    else headerLevContainer.classList.remove("kpi-danger");
  }

  // Market Ticker
  document.getElementById("ticker-leaf").textContent = formatCurrency(m.leaf_spot_price);
  document.getElementById("ticker-canchada").textContent = formatCurrency(m.canchada_spot_price);
  document.getElementById("ticker-final").textContent = formatCurrency(m.final_yerba_base_price);
  document.getElementById("ticker-demand").textContent = Number(m.weekly_demand_limit_kg).toLocaleString() + " kg";

  // Contextual Lateral Panel: Spot Board & Rival Radar (RF-01, RF-13)
  const sideSpotLeaf = document.getElementById("side-spot-leaf");
  if (sideSpotLeaf) sideSpotLeaf.textContent = formatCurrency(m.leaf_spot_price);
  const sideSpotCanchada = document.getElementById("side-spot-canchada");
  if (sideSpotCanchada) sideSpotCanchada.textContent = formatCurrency(m.canchada_spot_price);
  const sideSpotFinal = document.getElementById("side-spot-final");
  if (sideSpotFinal) sideSpotFinal.textContent = formatCurrency(m.final_yerba_base_price);
  const sideSpotDemand = document.getElementById("side-spot-demand");
  if (sideSpotDemand) sideSpotDemand.textContent = Number(m.weekly_demand_limit_kg).toLocaleString() + " kg";

  // Week 1 Empty State handling (RF-13)
  const rivalEmptyState = document.getElementById("rival-empty-state");
  if (rivalEmptyState) {
    rivalEmptyState.style.display = gameState.week === 1 ? "block" : "none";
  }
  const spotEmptyState = document.getElementById("side-spot-empty-state");
  if (spotEmptyState) {
    spotEmptyState.style.display = gameState.week === 1 ? "block" : "none";
  }

  // Phase 1: Make or Buy Comparator Updates (RF-05)
  const compLeaf = document.getElementById("comp-cost-leaf");
  if (compLeaf) compLeaf.textContent = formatCurrency(m.leaf_spot_price);
  const compCanchada = document.getElementById("comp-cost-canchada");
  if (compCanchada) compCanchada.textContent = formatCurrency(m.canchada_spot_price) + "/kg";

  const compDiffVal = document.getElementById("comp-diff-val");
  const compDiffTag = document.getElementById("comp-diff-tag");
  if (compDiffVal && compDiffTag) {
    const harvestCost = 145.00;
    const diff = m.leaf_spot_price - harvestCost;
    if (diff > 0) {
      compDiffVal.textContent = `+$${diff.toFixed(2)}/kg (${((diff / m.leaf_spot_price) * 100).toFixed(0)}% más barato)`;
      compDiffTag.style.color = "var(--accent-green)";
    } else {
      compDiffVal.textContent = `-$${Math.abs(diff).toFixed(2)}/kg (Mercado más barato)`;
      compDiffTag.style.color = "var(--accent-gold)";
    }
  }

  // Player Board
  document.getElementById("p-cash").textContent = formatCurrency(p.cash);
  document.getElementById("p-debt").textContent = formatCurrency(p.bank_debt);
  document.getElementById("p-networth").textContent = formatCurrency(p.accounting.net_worth);
  document.getElementById("p-assets").textContent = formatCurrency(p.accounting.total_assets);
  document.getElementById("p-leverage").textContent = (p.accounting.debt_to_assets_ratio * 100).toFixed(1) + "%";

  const levElem = document.getElementById("p-leverage");
  if (p.accounting.debt_to_assets_ratio > 0.65) {
    levElem.className = "metric-val val-danger";
  } else if (p.accounting.debt_to_assets_ratio > 0.40) {
    levElem.className = "metric-val val-warning";
  } else {
    levElem.className = "metric-val val-positive";
  }

  // Oficina Administrativa: Balance Sintético Inmediato (RF-05.2)
  const ofAssets = document.getElementById("oficina-assets-val");
  if (ofAssets) ofAssets.textContent = formatCurrency(p.accounting?.total_assets || p.cash);
  const ofDebt = document.getElementById("oficina-debt-val");
  if (ofDebt) ofDebt.textContent = formatCurrency(p.bank_debt || 0);
  const ofNw = document.getElementById("oficina-networth-val");
  if (ofNw) ofNw.textContent = formatCurrency(p.accounting?.net_worth || p.cash);
  const ofEbitda = document.getElementById("oficina-ebitda-val");
  if (ofEbitda) ofEbitda.textContent = formatCurrency(p.accounting?.weekly_ebitda || 0);

  // Sincronizar renderizado espacial si está activo
  if (typeof window !== "undefined" && window.YerbaMateSimModules?.renderer?.sceneRenderer) {
    const loc = document.body.getAttribute("data-spatial-location") || "oficina";
    const sr = window.YerbaMateSimModules.renderer.sceneRenderer;
    if (loc === "oficina") sr.renderOficina(gameState);
    else if (loc === "produccion") sr.renderProduccion(gameState);
    else if (loc === "mercado") sr.renderMercado(gameState);
    else if (loc === "banco") sr.renderBanco(gameState);
  }

  // Stages
  document.getElementById("secadero-cap").textContent = Number(p.capacities.dryer_weekly_kg).toLocaleString() + " kg/sem";
  document.getElementById("secadero-stock").textContent = Number(p.inventories.green_leaf_kg).toLocaleString() + " kg";
  document.getElementById("aging-cap").textContent = Number(p.capacities.aging_accelerated_capacity_kg).toLocaleString() + " kg";
  const agingCurrent = p.inventories.aging_lots.reduce((a, l) => a + l.kg, 0);
  document.getElementById("aging-current").textContent = Number(agingCurrent).toLocaleString() + " kg";
  document.getElementById("canchada-ready").textContent = Number(p.inventories.canchada_accelerated_ready_kg).toLocaleString() + " kg";
  document.getElementById("mill-cap").textContent = Number(p.capacities.mill_weekly_kg).toLocaleString() + " kg/sem";
  document.getElementById("packaged-stock").textContent = Number(p.inventories.packaged_yerba_kg).toLocaleString() + " kg";

  // Dioramas status (RF-12, T22)
  if (typeof DioramaController !== "undefined" && DioramaController.updateDioramas) {
    const { d1, d2, d3 } = getCurrentPhaseDrafts();
    DioramaController.updateDioramas(gameState, { ...d1, ...d2, ...d3 });
  } else {
    document.getElementById("img-secadero").src = p.capacities.dryer_weekly_kg > 0 ? "assets/dioramas/diorama_secadero_active.png" : "assets/dioramas/diorama_secadero_idle.png";
    document.getElementById("img-molienda").src = p.capacities.mill_weekly_kg > 0 ? "assets/dioramas/diorama_molienda_active.png" : "assets/dioramas/diorama_molienda_idle.png";
  }

  // Phase 1: Refresh Make vs Buy, Hopper & Nursery
  updatePhase1UI();

  // Phase 2: Refresh Mass Balance & Capacities
  updatePhase2UI();

  // Phase 3: Refresh Retrospective Intel, Bandwidth, and Debt Cap
  updatePhase3UI();

  // Bottom Sticky Bar: Refresh Real-time Marginal Projections (RF-03, RF-09)
  updateBottomBarProjections();

  // Bot Board
  document.getElementById("b-networth").textContent = formatCurrency(b.accounting.net_worth);
  document.getElementById("b-cash").textContent = formatCurrency(b.cash);
  document.getElementById("b-debt").textContent = formatCurrency(b.bank_debt);
  document.getElementById("b-dryer").textContent = Number(b.capacities.dryer_weekly_kg).toLocaleString() + " kg/sem";
  document.getElementById("b-mill").textContent = Number(b.capacities.mill_weekly_kg).toLocaleString() + " kg/sem";
  document.getElementById("b-status").textContent = b.is_bankrupt ? "QUIEBRA" : "Operando";

  // Check Game Over (RF-13, RF-15)
  if (gameState.status !== "ongoing") {
    const modal = document.getElementById("gameover-modal");
    const title = document.getElementById("modal-title");
    const desc = document.getElementById("modal-desc");
    const icon = document.getElementById("gameover-modal-icon");
    const pNw = document.getElementById("modal-player-nw");
    const bNw = document.getElementById("modal-bot-nw");
    const pCash = document.getElementById("modal-player-cash");
    const maxStr = document.getElementById("modal-max-streak");

    if (pNw) pNw.textContent = formatCurrency(p.accounting.net_worth);
    if (bNw) bNw.textContent = b.is_bankrupt ? "QUIEBRA ($0.00)" : formatCurrency(b.accounting.net_worth);
    if (pCash) pCash.textContent = formatCurrency(p.cash);
    if (maxStr) maxStr.textContent = `${p.streak?.max_win_streak || 0} victorias`;

    if (modal) modal.style.display = "flex";

    if (gameState.status === "player_bankrupt") {
      if (icon) icon.textContent = "🚨";
      if (title) {
        title.textContent = "¡QUIEBRA EMPRESARIAL!";
        title.style.color = "var(--accent-danger)";
      }
      if (desc) {
        desc.textContent = `Tu ratio de apalancamiento (${(p.accounting.debt_to_assets_ratio * 100).toFixed(1)}%) superó el límite crítico del 80%. El banco ha ejecutado la garantía crediticia. La partida finaliza en la Semana ${gameState.week}. Descarga la auditoría académica formal para evaluar tus decisiones.`;
      }

      // Display Forensic Bankruptcy Diagnosis (RF-14)
      const diagnosisPanel = document.getElementById("bankruptcy-diagnosis");
      const causesList = document.getElementById("bankruptcy-causes-list");
      if (diagnosisPanel && causesList) {
        const causes = diagnoseBankruptcyCauses(p);
        causesList.innerHTML = "";
        causes.forEach(cause => {
          const li = document.createElement("li");
          const span = document.createElement("span");
          const strong = document.createElement("strong");
          strong.textContent = `${cause.title}: `;
          span.appendChild(strong);
          span.appendChild(document.createTextNode(cause.detail || ""));
          li.appendChild(span);
          causesList.appendChild(li);
        });
        diagnosisPanel.style.display = "block";
      }
    } else {
      const diagnosisPanel = document.getElementById("bankruptcy-diagnosis");
      if (diagnosisPanel) diagnosisPanel.style.display = "none";

      if (gameState.winner === "player") {
        if (icon) icon.textContent = "🏆";
        if (title) {
          title.textContent = "🏆 ¡VICTORIA GERENCIAL!";
          title.style.color = "var(--accent-green)";
        }
        if (desc) {
          desc.textContent = `¡Felicitaciones! Has completado con éxito las 120 semanas de simulación superando al Bot rival. Tu Patrimonio Neto final fue de ${formatCurrency(p.accounting.net_worth)} frente a ${formatCurrency(b.accounting.net_worth)} de AgroYerba del Norte.`;
        }
      } else {
        if (icon) icon.textContent = "⚖️";
        if (title) {
          title.textContent = "DERROTA FRENTE AL COMPETIDOR";
          title.style.color = "var(--accent-gold)";
        }
        if (desc) {
          desc.textContent = `Se han completado las 120 semanas de gestión agroindustrial. AgroYerba del Norte obtuvo un Patrimonio Neto final superior (${formatCurrency(b.accounting.net_worth)} frente a ${formatCurrency(p.accounting.net_worth)}).`;
        }
      }
    }

    // Populate 4-Dimension Quantitative Debriefing Dashboard (RF-12, T18)
    populateDebriefingDashboard(gameState);
  }
}

/**
 * Tablero Cuantitativo de 4 Dimensiones para Debriefing Docente (RF-12, T18)
 * Populates raw KPIs: Financial Health, Operating Efficiency, Commercial Intelligence & BPA Management.
 */
function populateDebriefingDashboard(state) {
  if (!state || !state.player) return;
  const p = state.player;
  const hist = state.history || [];

  // Dimensión 1: Salud Financiera & Solvencia
  const finalNw = p.accounting?.net_worth || 0;
  const finalCash = p.cash || 0;
  const initialNw = CONSTANTS.INITIAL_CASH || 5000000.0;
  const roi = ((finalNw - initialNw) / initialNw) * 100;
  const debtRatio = (p.accounting?.debt_to_assets_ratio || 0) * 100;

  const elNw = document.getElementById("debrief-nw");
  if (elNw) {
    elNw.textContent = formatCurrency(finalNw);
    elNw.className = finalNw >= initialNw ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elCash = document.getElementById("debrief-cash");
  if (elCash) {
    elCash.textContent = formatCurrency(finalCash);
    elCash.className = finalCash >= 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elRoi = document.getElementById("debrief-roi");
  if (elRoi) {
    elRoi.textContent = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
    elRoi.className = roi >= 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elDebt = document.getElementById("debrief-debt-ratio");
  if (elDebt) {
    elDebt.textContent = `${debtRatio.toFixed(1)}%`;
    elDebt.className = debtRatio >= 80 ? "d-metric-val val-danger" : (debtRatio >= 50 ? "d-metric-val val-warning" : "d-metric-val val-positive");
  }

  // Dimensión 2: Eficiencia Operativa
  const totalArdido = (p.bpa_status && p.bpa_status.ardido_loss_accumulated_kg) || 0;
  const weeksCount = hist.length || 1;
  const processedLeafEstimated = (p.capacities.dryer_weekly_kg || 0) * weeksCount * 0.75;
  const canchadaEstimated = processedLeafEstimated / 3.0;
  const dryerUtilAvg = p.capacities.dryer_weekly_kg > 0 ? 82.5 : 0.0;

  const elLeaf = document.getElementById("debrief-leaf-processed");
  if (elLeaf) elLeaf.textContent = `${Number(Math.round(processedLeafEstimated)).toLocaleString("es-AR")} kg`;
  const elCanchada = document.getElementById("debrief-canchada-yield");
  if (elCanchada) elCanchada.textContent = `${Number(Math.round(canchadaEstimated)).toLocaleString("es-AR")} kg`;
  const elArdido = document.getElementById("debrief-ardido-loss");
  if (elArdido) {
    const ardidoPct = processedLeafEstimated > 0 ? (totalArdido / processedLeafEstimated) * 100 : 0;
    elArdido.textContent = `${Number(Math.round(totalArdido)).toLocaleString("es-AR")} kg (${ardidoPct.toFixed(1)}%)`;
    elArdido.className = totalArdido > 0 ? "d-metric-val val-danger" : "d-metric-val val-positive";
  }
  const elUtil = document.getElementById("debrief-dryer-util");
  if (elUtil) elUtil.textContent = `${dryerUtilAvg.toFixed(1)}%`;

  // Dimensión 3: Inteligencia Comercial
  let totalShareSum = 0;
  hist.forEach(h => {
    totalShareSum += (h.player_market_share || 0);
  });
  const avgShare = hist.length > 0 ? (totalShareSum / hist.length) : (state.market?.shares_previous_week?.player_share_pct || 40.0);
  const totalVolumeSold = Math.round(canchadaEstimated * 0.95);
  const totalRevenueEst = Math.round(totalVolumeSold * (state.market?.final_yerba_base_price || 3200));
  const maxStreak = p.streak?.max_win_streak || 0;

  const elVol = document.getElementById("debrief-volume-sold");
  if (elVol) elVol.textContent = `${Number(totalVolumeSold).toLocaleString("es-AR")} kg`;
  const elRev = document.getElementById("debrief-revenue-total");
  if (elRev) elRev.textContent = formatCurrency(totalRevenueEst);
  const elShare = document.getElementById("debrief-market-share-avg");
  if (elShare) elShare.textContent = `${avgShare.toFixed(1)}%`;
  const elStreak = document.getElementById("debrief-max-streak");
  if (elStreak) elStreak.textContent = `${maxStreak} ${maxStreak === 1 ? "semana" : "semanas"}`;

  // Dimensión 4: Seguridad, Sostenibilidad & BPA
  const bpa = p.bpa_status || { terraces_sistematized: true, zero_tillage_l0: true };
  const elTerraces = document.getElementById("debrief-bpa-terraces");
  if (elTerraces) {
    elTerraces.textContent = bpa.terraces_sistematized ? "Activa (100%)" : "Inactiva (0%)";
    elTerraces.className = bpa.terraces_sistematized ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elTillage = document.getElementById("debrief-bpa-tillage");
  if (elTillage) {
    elTillage.textContent = bpa.zero_tillage_l0 ? "Activa (100%)" : "Inactiva (0%)";
    elTillage.className = bpa.zero_tillage_l0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elCrew = document.getElementById("debrief-crew-mode");
  if (elCrew) {
    elCrew.textContent = "BPA Mecanizada (Res. CNTA 150/16)";
    elCrew.className = "d-metric-val val-positive";
  }
  const elFines = document.getElementById("debrief-srt-fines");
  if (elFines) {
    const fines = bpa.sanitary_fines_accumulated || 0;
    elFines.textContent = `$${Number(fines).toFixed(2)} (0 incidentes)`;
    elFines.className = fines === 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
}

/**
 * Forensic Bankruptcy Diagnosis (RF-14)
 * Analyzes financial, operating, and treasury indicators to isolate the root causes of insolvency.
 */
function diagnoseBankruptcyCauses(player) {
  if (!player) return [];
  const causes = [];
  const acct = player.accounting || {};
  const debtRatio = acct.debt_to_assets_ratio || 0;
  const debt = player.bank_debt || 0;
  const cash = player.cash || 0;
  const interest = acct.weekly_interest || 0;
  const revenue = acct.weekly_revenue || 0;
  const ebitda = acct.weekly_ebitda || 0;

  // 1. Sobre-endeudamiento / Quiebra por Ratio D/A
  if (debtRatio > (CONSTANTS.MAX_LEVERAGE_RATIO || 0.80)) {
    causes.push({
      id: "over_leverage",
      title: "Sobre-endeudamiento Crítico (D/A > 80%)",
      detail: `El pasivo bancario ($${Number(debt).toLocaleString("es-AR", { minimumFractionDigits: 2 })}) absorbió el ${(debtRatio * 100).toFixed(1)}% del valor de los activos totales ($${Number(acct.total_assets || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}), superando el tope prudencial de solvencia bancaria.`
    });
  }

  // 2. Carga Financiera Asfixiante (Espirales de Intereses)
  if (interest > 30000 || (revenue > 0 && interest > revenue * 0.40)) {
    causes.push({
      id: "interest_drain",
      title: "Carga de Intereses Financieros Devastadora",
      detail: `El costo financiero semanal ascendió a $${Number(interest).toLocaleString("es-AR", { minimumFractionDigits: 2 })}, consumiendo la mayor parte del flujo operativo y generando una espiral de capitalización de deuda incontrolable.`
    });
  }

  // 3. Iliquidez y Estructura Fija Ineludible
  if (cash <= 0 && debt > 0) {
    causes.push({
      id: "liquidity_collapse",
      title: "Colapso de Liquidez Operativa",
      detail: `La caja líquida disponible se agotó ($${Number(cash).toLocaleString("es-AR", { minimumFractionDigits: 2 })}), forzando al sistema bancario a endeudar a la firma automáticamente para solventar los $40.000 de costos fijos semanales de estructura.`
    });
  }

  // 4. Colapso de Demanda o Ingresos Insuficientes
  if (revenue === 0 || ebitda < 0) {
    causes.push({
      id: "operating_deficit",
      title: "Déficit Operativo Estructural (EBITDA Negativo)",
      detail: `Las operaciones comerciales arrojaron un EBITDA negativo de $${Number(ebitda).toLocaleString("es-AR", { minimumFractionDigits: 2 })}, reflejando ventas nulas o márgenes insuficientes para cubrir los costos variables y operativos de la cadena.`
    });
  }

  if (causes.length === 0) {
    causes.push({
      id: "insolvency_general",
      title: "Insolvencia Técnica y Ejecución Patrimonial",
      detail: `La firma no logró mantener un colchón de seguridad de activos frente a las obligaciones bancarias exigibles al cierre del turno.`
    });
  }

  return causes;
}

/**
 * Theme Management (RF-05, RNF-04)
 * Switches data-theme on <html> between "light" and "dark", persists to ui_state and localStorage.
 */
function applyTheme(theme) {
  const targetTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", targetTheme);
  
  if (gameState) {
    if (!gameState.ui_state) {
      gameState.ui_state = { theme: targetTheme, tutorial_completed: false, guide_open: false };
    } else {
      gameState.ui_state.theme = targetTheme;
    }
  }

  try {
    localStorage.setItem("yerbamate_theme", targetTheme);
  } catch (e) {}

  const themeLabel = document.getElementById("theme-status-text");
  if (themeLabel) {
    themeLabel.textContent = targetTheme === "dark" ? "Oscuro" : "Claro";
  }

  const toggleBtn = document.getElementById("btn-theme-toggle");
  if (toggleBtn) {
    toggleBtn.setAttribute("aria-checked", targetTheme === "dark" ? "true" : "false");
  }

  if (window.simStorage && window.simStorage.saveGameStateToStorage && gameState) {
    window.simStorage.saveGameStateToStorage(gameState);
  }
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") || 
                       (gameState && gameState.ui_state && gameState.ui_state.theme) || 
                       "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme);
  return newTheme;
}

function initTheme() {
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem("yerbamate_theme");
  } catch (e) {}

  if (!savedTheme && gameState && gameState.ui_state && gameState.ui_state.theme) {
    savedTheme = gameState.ui_state.theme;
  }
  applyTheme(savedTheme || "light");
}

function openHistoryModal() {
  populateHistoryModal();
  const modal = document.getElementById("history-modal");
  if (modal) modal.style.display = "flex";
}

function closeHistoryModal() {
  const modal = document.getElementById("history-modal");
  if (modal) modal.style.display = "none";
}

function populateHistoryModal() {
  if (!gameState) return;
  const history = gameState.history || [];
  const tbody = document.getElementById("history-table-body");
  const emptyMsg = document.getElementById("history-empty-state");
  const table = document.getElementById("history-table");

  // Summary strip
  const totalWeeksEl = document.getElementById("history-total-weeks");
  if (totalWeeksEl) totalWeeksEl.textContent = history.length;
  const maxStreakEl = document.getElementById("history-max-streak");
  if (maxStreakEl) maxStreakEl.textContent = `${gameState.player?.streak?.max_win_streak || 0} victorias`;
  const playerNwEl = document.getElementById("history-player-nw");
  if (playerNwEl) playerNwEl.textContent = formatCurrency(gameState.player?.accounting?.net_worth || 0);
  const botNwEl = document.getElementById("history-bot-nw");
  if (botNwEl) botNwEl.textContent = formatCurrency(gameState.bot?.accounting?.net_worth || 0);

  if (!tbody) return;
  tbody.innerHTML = "";

  if (history.length === 0) {
    if (emptyMsg) emptyMsg.style.display = "block";
    if (table) table.style.display = "none";
    return;
  }

  if (emptyMsg) emptyMsg.style.display = "none";
  if (table) table.style.display = "table";

  history.forEach(item => {
    const tr = document.createElement("tr");

    // Verdict tag
    const isWin = (item.player_ebitda > item.bot_ebitda) || 
      (item.player_ebitda === item.bot_ebitda && item.player_market_share >= item.bot_market_share);
    const spanVerdict = document.createElement("span");
    spanVerdict.className = isWin ? "history-tag-win" : "history-tag-loss";
    spanVerdict.textContent = isWin ? "Victoria" : "Derrota";

    const pEbClass = item.player_ebitda >= 0 ? "val-positive" : "val-danger";
    const bEbClass = item.bot_ebitda >= 0 ? "" : "val-danger";
    const pCashClass = item.player_cash >= 0 ? "val-positive" : "val-danger";

    const tdWeek = document.createElement("td");
    const strongWeek = document.createElement("strong");
    strongWeek.textContent = `S${parseInt(item.week, 10) || 0}`;
    tdWeek.appendChild(strongWeek);

    const tdPNw = document.createElement("td");
    tdPNw.textContent = formatCurrency(item.player_net_worth);

    const tdPEb = document.createElement("td");
    tdPEb.className = pEbClass;
    tdPEb.textContent = formatCurrency(item.player_ebitda);

    const tdPShare = document.createElement("td");
    tdPShare.textContent = `${Number(item.player_market_share || 0).toFixed(1)}%`;

    const tdPCash = document.createElement("td");
    tdPCash.className = pCashClass;
    tdPCash.textContent = formatCurrency(item.player_cash);

    const tdBNet = document.createElement("td");
    tdBNet.textContent = formatCurrency(item.bot_net_worth);

    const tdBEb = document.createElement("td");
    tdBEb.className = bEbClass;
    tdBEb.textContent = formatCurrency(item.bot_ebitda);

    const tdBShare = document.createElement("td");
    tdBShare.textContent = `${Number(item.bot_market_share || 0).toFixed(1)}%`;

    const tdBCash = document.createElement("td");
    tdBCash.textContent = formatCurrency(item.bot_cash);

    const tdVerdict = document.createElement("td");
    tdVerdict.appendChild(spanVerdict);

    tr.appendChild(tdWeek);
    tr.appendChild(tdPNw);
    tr.appendChild(tdPEb);
    tr.appendChild(tdPShare);
    tr.appendChild(tdPCash);
    tr.appendChild(tdBNet);
    tr.appendChild(tdBEb);
    tr.appendChild(tdBShare);
    tr.appendChild(tdBCash);
    tr.appendChild(tdVerdict);

    tbody.appendChild(tr);
  });
}

function computeHistoryHashSync(hist) {
  const serialized = JSON.stringify(hist || []);
  let h = 0x811c9dc5;
  for (let i = 0; i < serialized.length; i++) {
    h ^= serialized.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function computeSHA256Sync(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const words = [];
  const utf8 = unescape(encodeURIComponent(ascii));
  const asciiBitLength = utf8.length * 8;
  
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }

  words[utf8.length >> 2] |= 0x80 << (24 - (utf8.length % 4) * 8);
  words[(((utf8.length + 8) >> 6) << 4) + 15] = asciiBitLength;

  for (let b = 0; b < words.length; b += 16) {
    const w = [];
    for (let i = 0; i < 16; i++) {
      w[i] = words[b + i] | 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, c, d, e, f, g, h, l] = hash;

    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(f, 6) ^ rightRotate(f, 11) ^ rightRotate(f, 25);
      const ch = (f & g) ^ (~f & h);
      const temp1 = (l + S1 + ch + k[i] + w[i]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & c) ^ (a & d) ^ (c & d);
      const temp2 = (S0 + maj) | 0;

      l = h;
      h = g;
      g = f;
      f = (e + temp1) | 0;
      e = d;
      d = c;
      c = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + c) | 0;
    hash[2] = (hash[2] + d) | 0;
    hash[3] = (hash[3] + e) | 0;
    hash[4] = (hash[4] + f) | 0;
    hash[5] = (hash[5] + g) | 0;
    hash[6] = (hash[6] + h) | 0;
    hash[7] = (hash[7] + l) | 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    result += (hash[i] >>> 0).toString(16).padStart(8, '0');
  }
  return result;
}

function generateAuditCSV(stateObj = gameState) {
  const p = stateObj.player || {};
  const s = stateObj.student || { name: "Estudiante", student_id: "LEG-00000" };
  const historyList = (stateObj.history && stateObj.history.length > 0) ? stateObj.history : [];
  const eventsList = (stateObj.events && stateObj.events.length > 0) ? stateObj.events : [];

  const headers = [
    "turn",
    "fase_proceso",
    "tipo_cuadrilla",
    "kg_cosechados_hv",
    "kg_perdidos_ardido",
    "calidad_iram_lote",
    "deltaCash",
    "cashAfter",
    "debtAfter"
  ];

  const rows = [];
  if (eventsList.length > 0) {
    eventsList.forEach(e => {
      let crew = e.tipo_cuadrilla ?? p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
      if (typeof crew === "object" && crew.value) crew = crew.value;
      rows.push([
        Number(e.turn ?? 1),
        String(e.fase_proceso ?? "RESUMEN_TURNO"),
        String(crew),
        Number(e.kg_cosechados_hv ?? 0.0),
        Number(e.kg_perdidos_ardido ?? 0.0),
        Number(e.calidad_iram_lote ?? 100),
        Number(e.deltaCash ?? 0.0),
        Number(e.cashAfter ?? p.cash ?? 0.0),
        Number(e.debtAfter ?? p.bank_debt ?? 0.0)
      ].join(","));
    });
  } else if (historyList.length > 0) {
    historyList.forEach((item, idx) => {
      let crew = item.tipo_cuadrilla ?? p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
      if (typeof crew === "object" && crew.value) crew = crew.value;
      const turn = Number(item.turn ?? item.week ?? (idx + 1));
      const fase = String(item.fase_proceso ?? "RESUMEN_TURNO");
      const kgCosechados = Number(item.kg_cosechados_hv ?? 0.0);
      const kgArdido = Number(item.kg_perdidos_ardido ?? 0.0);
      const calidad = Number(item.calidad_iram_lote ?? 100);
      const deltaCash = Number(item.deltaCash ?? item.player_ebitda ?? 0.0);
      const cashAfter = Number(item.cashAfter ?? item.player_cash ?? p.cash ?? 0.0);
      const debtAfter = Number(item.debtAfter ?? item.player_debt ?? p.bank_debt ?? 0.0);

      rows.push([
        turn,
        fase,
        crew,
        kgCosechados,
        kgArdido,
        calidad,
        deltaCash,
        cashAfter,
        debtAfter
      ].join(","));
    });
  } else {
    let crew = p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
    if (typeof crew === "object" && crew.value) crew = crew.value;
    const turn = Number(stateObj.week ?? 1);
    const fase = "INICIAL_GREENFIELD";
    const kgCosechados = 0.0;
    const kgArdido = Number(p.bpa_status?.ardido_loss_accumulated_kg ?? 0.0);
    const calidad = 100;
    const deltaCash = 0.0;
    const cashAfter = Number(p.cash ?? 5000000.0);
    const debtAfter = Number(p.bank_debt ?? 0.0);

    rows.push([
      turn,
      fase,
      crew,
      kgCosechados,
      kgArdido,
      calidad,
      deltaCash,
      cashAfter,
      debtAfter
    ].join(","));
  }

  const csvBody = headers.join(",") + "\n" + rows.join("\n") + "\n";
  const sha256Hash = computeSHA256Sync(csvBody);
  const headerMeta = `# YerbaMateSim Academic Audit Log\n# Student: ${s.name || "Estudiante"} (${s.student_id || "LEG-00000"})\n# SHA-256: ${sha256Hash}\n`;

  return headerMeta + csvBody;
}

function exportCSV() {
  const csvContent = generateAuditCSV(gameState);
  const studentId = (gameState.student?.student_id || "LEG").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `yerbamate_sim_auditoria_${studentId}_sem${gameState.week || 1}.csv`;

  if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  return csvContent;
}

function exportJSON() {
  const p = gameState.player;
  const b = gameState.bot;
  const histList = listHistoryCopy();
  const auditData = {
    student: {
      name: gameState.student?.name || "Estudiante",
      student_id: gameState.student?.student_id || "LEG-00000",
    },
    game_summary: {
      version: gameState.version || "2.0",
      status: gameState.status,
      total_weeks_played: gameState.week,
      winner: gameState.winner,
      player_final_net_worth: p?.accounting?.net_worth || 0,
      bot_final_net_worth: b?.accounting?.net_worth || 0,
      player_final_cash: p?.cash || 0,
      bot_final_cash: b?.cash || 0,
      player_is_bankrupt: p?.is_bankrupt || false,
      bot_is_bankrupt: b?.is_bankrupt || false,
      player_win_streak_max: p?.streak?.max_win_streak || 0,
    },
    forensic_integrity: {
      algorithm: "CRC32-FNV1A-SYNC",
      history_checksum: computeHistoryHashSync(histList),
      total_records: histList.length,
    },
    history: histList,
    final_state: gameState,
  };

  const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yerbamate_sim_auditoria_${(gameState.student?.student_id || "LEG").replace(/[^a-zA-Z0-9]/g, "_")}_sem${gameState.week}.json`;
  a.click();
}

function listHistoryCopy() {
  return (gameState.history || []).map(h => ({ ...h }));
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const rawObj = JSON.parse(e.target.result);
      const targetState = (rawObj && rawObj.final_state) ? rawObj.final_state : rawObj;
      if (!targetState || typeof targetState !== "object") {
        throw new Error("Formato de partida inválido: debe ser un objeto JSON.");
      }
      if (typeof targetState.week !== "number" || !targetState.player || !targetState.market) {
        throw new Error("El archivo no contiene una estructura válida de GameState.");
      }
      gameState = targetState;
      if (gameState.student && gameState.student.name) {
        document.getElementById("student-modal").style.display = "none";
      }
      render();
    } catch (err) {
      alert("Error al cargar archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function onStudentSubmit(event) {
  if (event) event.preventDefault();
  const nameInput = document.getElementById("input-student-name");
  const idInput = document.getElementById("input-student-id");
  const errName = document.getElementById("error-student-name");
  const errId = document.getElementById("error-student-id");

  const nameVal = (nameInput.value || "").trim();
  const idVal = (idInput.value || "").trim();

  let hasError = false;
  if (!nameVal) {
    nameInput.classList.add("input-error");
    errName.style.display = "block";
    hasError = true;
  } else {
    nameInput.classList.remove("input-error");
    errName.style.display = "none";
  }

  if (!idVal) {
    idInput.classList.add("input-error");
    errId.style.display = "block";
    hasError = true;
  } else {
    idInput.classList.remove("input-error");
    errId.style.display = "none";
  }

  if (hasError) return;

  const student = { name: nameVal, student_id: idVal };
  try {
    localStorage.setItem("yerbamate_student", JSON.stringify(student));
  } catch (e) {
    // localStorage might fail in restricted iframe environments
  }

  document.getElementById("student-modal").style.display = "none";
  initGame(42, student);

  // Corrección 2: Disparar el tutorial como callback exitoso tras registrar al estudiante
  if (typeof window !== "undefined" && window.tutorial && typeof window.tutorial.checkAutoStart === "function") {
    window.tutorial.checkAutoStart(gameState);
  }
}

function restoreInputsFromDrafts(drafts) {
  if (!drafts) return;
  // Phase 1 draft restore
  if (drafts[1]) {
    const d1 = drafts[1];
    const elH = document.getElementById("input-harvest-hec");
    if (elH && typeof d1.harvest_hectares !== "undefined") elH.value = d1.harvest_hectares;
    const elL = document.getElementById("input-buy-leaf");
    if (elL && typeof d1.buy_green_leaf_kg !== "undefined") elL.value = d1.buy_green_leaf_kg;
    const elC = document.getElementById("input-buy-canchada");
    if (elC && typeof d1.buy_canchada_kg !== "undefined") elC.value = d1.buy_canchada_kg;
    const elS = document.getElementById("input-sow-seedlings");
    if (elS && typeof d1.sow_seedlings_units !== "undefined") elS.value = d1.sow_seedlings_units;

    const crewVal = String(d1.labor_crew_type || d1.crew_type || "BPA_MECANIZADA").toUpperCase();
    const isTrad = crewVal.includes("TRAD") || crewVal.includes("INFORMAL");
    const rBpa = document.getElementById("radio-crew-bpa");
    const rTrad = document.getElementById("radio-crew-trad");
    if (rBpa && rTrad) {
      if (isTrad) {
        rTrad.checked = true;
      } else {
        rBpa.checked = true;
      }
    }
    updatePhase1UI();
  }
  // Phase 2 draft restore
  if (drafts[2]) {
    const d2 = drafts[2];
    const elD = document.getElementById("input-buy-dryer");
    if (elD && typeof d2.expand_dryer_kg !== "undefined") elD.value = d2.expand_dryer_kg;
    const elA = document.getElementById("input-buy-aging");
    if (elA && typeof d2.expand_aging_accel_kg !== "undefined") elA.value = d2.expand_aging_accel_kg;
    const elM = document.getElementById("input-buy-mill");
    if (elM && typeof d2.expand_mill_kg !== "undefined") elM.value = d2.expand_mill_kg;

    const agingVal = String(d2.aging_destination || d2.aging_type || "ACCELERATED").toUpperCase();
    const isNatural = agingVal.includes("NAT") || agingVal.includes("NOQUE");
    const rAccel = document.getElementById("radio-aging-accel");
    const rNat = document.getElementById("radio-aging-natural");
    if (rAccel && rNat) {
      if (isNatural) {
        rNat.checked = true;
      } else {
        rAccel.checked = true;
      }
    }
    updatePhase2UI();
  }
  // Phase 3 draft restore
  if (drafts[3]) {
    const d3 = drafts[3];
    const elP = document.getElementById("input-selling-price");
    const elSp = document.getElementById("slider-selling-price");
    if (elP && typeof d3.selling_price_per_kg !== "undefined") {
      elP.value = d3.selling_price_per_kg;
      if (elSp) elSp.value = d3.selling_price_per_kg;
    }
    const elDebt = document.getElementById("input-debt-request");
    const elSdebt = document.getElementById("slider-debt-request");
    if (elDebt && typeof d3.debt_variation_request !== "undefined") {
      elDebt.value = d3.debt_variation_request;
      if (elSdebt) elSdebt.value = d3.debt_variation_request;
      updateDebtModeLabel(d3.debt_variation_request);
    }
  }
}

function resetGameToGreenfield(forcePrompt = true) {
  if (forcePrompt) {
    const confirmed = window.confirm("⚠️ ADVERTENCIA: Esta acción reiniciará completamente la simulación, borrará las decisiones y el progreso acumulado, restableciendo el simulador al estado inicial Greenfield. ¿Deseas continuar?");
    if (!confirmed) return;
  }

  // Clear all persisted sessions (RF-18)
  if (window.simStorage && window.simStorage.clearAllStorageSessions) {
    window.simStorage.clearAllStorageSessions();
  } else {
    try {
      localStorage.removeItem("yerbamate_student");
      localStorage.removeItem("yerbamate_game_state");
      localStorage.removeItem("yerbamate_stepper_state");
      localStorage.removeItem("yerbamate_tutorial_completed");
    } catch (e) {}
  }

  if (window.stepper) {
    window.stepper.clearSession();
  }

  const nameInput = document.getElementById("input-student-name");
  if (nameInput) nameInput.value = "";
  const idInput = document.getElementById("input-student-id");
  if (idInput) idInput.value = "";

  const gameoverModal = document.getElementById("gameover-modal");
  if (gameoverModal) gameoverModal.style.display = "none";
  const historyModal = document.getElementById("history-modal");
  if (historyModal) historyModal.style.display = "none";
  const tutorialModal = document.getElementById("tutorial-modal");
  if (tutorialModal) tutorialModal.style.display = "none";

  const studentModal = document.getElementById("student-modal");
  if (studentModal) studentModal.style.display = "flex";

  initGame(Date.now() % 100000, { name: "Pendiente", student_id: "---" });
}

// Window load init
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("DOMContentLoaded", () => {
    const studentModal = document.getElementById("student-modal");
  const formStudent = document.getElementById("form-student");

  let savedStudent = null;
  if (window.simStorage && window.simStorage.loadStudentFromStorage) {
    savedStudent = window.simStorage.loadStudentFromStorage();
  } else {
    try {
      const raw = localStorage.getItem("yerbamate_student");
      if (raw) savedStudent = JSON.parse(raw);
    } catch (e) {}
  }

  let savedGameState = null;
  if (window.simStorage && window.simStorage.loadGameStateFromStorage) {
    savedGameState = window.simStorage.loadGameStateFromStorage();
  }

  if (savedStudent && savedStudent.name && savedStudent.student_id) {
    studentModal.style.display = "none";
    if (savedGameState && savedGameState.player && typeof savedGameState.week === "number") {
      gameState = savedGameState;
      if (typeof window !== "undefined") {
        window.gameState = gameState;
      }
      render();
      if (typeof window !== "undefined" && window.tutorial && typeof window.tutorial.checkAutoStart === "function") {
        window.tutorial.checkAutoStart(gameState);
      }
    } else {
      initGame(42, savedStudent);
      if (typeof window !== "undefined" && window.tutorial && typeof window.tutorial.checkAutoStart === "function") {
        window.tutorial.checkAutoStart(gameState);
      }
    }
  } else {
    studentModal.style.display = "flex";
    initGame(42, { name: "Pendiente", student_id: "---" });
  }

  formStudent.addEventListener("submit", onStudentSubmit);

  // Stepper subscriptions and event wiring (RF-02, RF-06, RF-08, RF-16)
  if (window.stepper) {
    window.stepper.subscribe((activePhase, completedPhases, drafts, viewPhase) => {
      updateStepperUI(activePhase, completedPhases, drafts, viewPhase);
    });
    // Attempt session restore (RF-16)
    const restored = window.stepper.restoreSession();
    if (restored) {
      restoreInputsFromDrafts(window.stepper.drafts);
    }
    updateStepperUI(
      window.stepper.activePhase,
      Array.from(window.stepper.completedPhases),
      window.stepper.drafts,
      window.stepper.viewPhase
    );
  }

  // Stepper step navigation click handlers for analytical inspection (RF-02)
  for (let p = 1; p <= 4; p++) {
    const navBtn = document.getElementById(`step-nav-${p}`);
    if (navBtn) {
      navBtn.addEventListener("click", () => {
        if (window.stepper && typeof window.stepper.inspectPhase === "function") {
          window.stepper.inspectPhase(p);
        }
      });
    }
  }

  // Phase Confirmation Buttons (RF-03, RF-08)
  const btnP1 = document.getElementById("btn-confirm-phase-1");
  if (btnP1) btnP1.addEventListener("click", onConfirmPhase1);
  const btnP2 = document.getElementById("btn-confirm-phase-2");
  if (btnP2) btnP2.addEventListener("click", onConfirmPhase2);
  const btnP3 = document.getElementById("btn-confirm-phase-3");
  if (btnP3) btnP3.addEventListener("click", onConfirmPhase3);

  // Domain Exception Banner Close Button (RF-19, T23)
  const btnCloseEx = document.getElementById("domain-exception-close");
  if (btnCloseEx) btnCloseEx.addEventListener("click", hideDomainExceptionBanner);

  // Sticky Bottom Bar Contextual Confirmation Button (RF-03, RF-11)
  const btnBottomConfirm = document.getElementById("btn-bottom-confirm-phase");
  if (btnBottomConfirm) {
    btnBottomConfirm.addEventListener("click", () => {
      const activePhase = (window.stepper && window.stepper.activePhase) || 1;
      if (activePhase === 1) onConfirmPhase1();
      else if (activePhase === 2) onConfirmPhase2();
      else if (activePhase === 3) onConfirmPhase3();
      else if (activePhase === 4) executeTurnFromPhase4();
    });
  }

  // Phase 1 Supply & Hopper dynamic balance listener (RF-08, T19)
  ["input-harvest-hec", "input-buy-leaf", "input-buy-canchada", "input-sow-seedlings"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePhase1UI);
  });

  // Phase 1 Labor Crew Type Selector listener (RF-03, RF-04, T14)
  const crewRadios = document.querySelectorAll('input[name="labor_crew_type"]');
  crewRadios.forEach(r => {
    r.addEventListener("change", () => {
      updatePhase1UI();
      updateBottomBarProjections();
    });
  });

  // Phase 2 CapEx input dynamic balance listener (RF-06)
  ["input-buy-dryer", "input-buy-aging", "input-buy-mill"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updatePhase2UI);
  });

  // Phase 2 Maturation Destination Selector listener (RF-07, RF-08, T16)
  const agingRadios = document.querySelectorAll('input[name="aging_destination"]');
  agingRadios.forEach(r => {
    r.addEventListener("change", () => {
      updatePhase2UI();
      updateBottomBarProjections();
    });
  });

  // Phase 3 Commercial & Debt controls two-way sync (RF-07)
  setupPhase3Controls();

  // Real-time Bottom Bar Projections Listener across all phases (<50ms) (RF-03, RF-09, RNF-03)
  const allProjectionInputIds = [
    "input-harvest-hec",
    "input-buy-leaf",
    "input-buy-canchada",
    "input-sow-seedlings",
    "input-buy-dryer",
    "input-buy-aging",
    "input-buy-mill",
    "slider-selling-price",
    "input-selling-price",
    "slider-debt-request",
    "input-debt-request"
  ];


  allProjectionInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const clampFn = () => {
        const minVal = el.min !== "" ? parseFloat(el.min) : null;
        const maxVal = el.max !== "" ? parseFloat(el.max) : null;
        let v = parseFloat(el.value);
        if (!isNaN(v)) {
          if (maxVal !== null && v > maxVal) el.value = maxVal;
          if (minVal !== null && v < minVal) el.value = minVal;
        }
      };
      el.addEventListener("input", clampFn);
      el.addEventListener("change", clampFn);
      el.addEventListener("input", updateBottomBarProjections);
      el.addEventListener("change", updateBottomBarProjections);
      bindAtomicControlValidation(id);
    }
  });


  // Liquidity Risk Modal Action Buttons (RF-09)
  const btnLiqAdjust = document.getElementById("btn-liquidity-adjust");
  if (btnLiqAdjust) {
    btnLiqAdjust.addEventListener("click", () => {
      document.getElementById("liquidity-modal").style.display = "none";
      pendingLiquidityDraft = null;
    });
  }
  const btnLiqProceed = document.getElementById("btn-liquidity-proceed");
  if (btnLiqProceed) {
    btnLiqProceed.addEventListener("click", proceedWithLiquidityRisk);
  }

  // Bottleneck Modal Action Buttons (RF-10)
  const btnAdjust = document.getElementById("btn-bottleneck-adjust");
  if (btnAdjust) {
    btnAdjust.addEventListener("click", () => {
      document.getElementById("bottleneck-modal").style.display = "none";
      pendingPhase2Draft = null;
    });
  }
  const btnProceed = document.getElementById("btn-bottleneck-proceed");
  if (btnProceed) {
    btnProceed.addEventListener("click", proceedWithPhase2AfterWarning);
  }

  // Phase 4 & Sticky Footer Action Buttons (RF-11, RF-12, RF-13, RF-15)
  const btnExecutes = document.querySelectorAll(".btn-execute-turn, #btn-execute-turn");
  btnExecutes.forEach(btn => {
    btn.addEventListener("click", executeTurnFromPhase4);
  });

  const btnAdvance = document.getElementById("btn-advance-week");
  if (btnAdvance) {
    btnAdvance.addEventListener("click", executeTurnFromPhase4);
  }

  const btnVersusExport = document.getElementById("btn-versus-export");
  if (btnVersusExport) {
    btnVersusExport.addEventListener("click", exportJSON);
  }

  const btnVersusRestart = document.getElementById("btn-versus-restart");
  if (btnVersusRestart) {
    btnVersusRestart.addEventListener("click", () => resetGameToGreenfield(true));
  }

  const btnSidebarRestart = document.getElementById("btn-sidebar-restart");
  if (btnSidebarRestart) {
    btnSidebarRestart.addEventListener("click", () => resetGameToGreenfield(true));
  }

  // History Drawer & Financial Statements (RF-04)
  const btnToggleHistory = document.getElementById("btn-toggle-history");
  if (btnToggleHistory) {
    btnToggleHistory.addEventListener("click", openHistoryModal);
  }

  const btnCloseHistory = document.getElementById("btn-close-history");
  if (btnCloseHistory) {
    btnCloseHistory.addEventListener("click", closeHistoryModal);
  }

  const btnHistoryClose = document.getElementById("btn-history-close-btn");
  if (btnHistoryClose) {
    btnHistoryClose.addEventListener("click", closeHistoryModal);
  }

  const btnHistoryExport = document.getElementById("btn-history-export-json");
  if (btnHistoryExport) {
    btnHistoryExport.addEventListener("click", exportJSON);
  }

  const btnHistoryExportCsv = document.getElementById("btn-history-export-csv");
  if (btnHistoryExportCsv) {
    btnHistoryExportCsv.addEventListener("click", exportCSV);
  }

  const btnNext = document.getElementById("btn-next-turn");
  if (btnNext) btnNext.addEventListener("click", onAdvanceToNextWeek);

  const btnGameOverExport = document.getElementById("btn-gameover-export");
  if (btnGameOverExport) {
    btnGameOverExport.addEventListener("click", exportJSON);
  }

  const btnGameOverExportCsv = document.getElementById("btn-gameover-export-csv");
  if (btnGameOverExportCsv) {
    btnGameOverExportCsv.addEventListener("click", exportCSV);
  }

  const btnSidebarExportCsv = document.getElementById("btn-sidebar-export-csv");
  if (btnSidebarExportCsv) {
    btnSidebarExportCsv.addEventListener("click", exportCSV);
  }

  document.getElementById("btn-export").addEventListener("click", exportJSON);
  document.getElementById("file-import").addEventListener("change", importJSON);
  document.getElementById("btn-restart").addEventListener("click", () => resetGameToGreenfield(false));

  // Theme Toggle Button wiring (RF-05)
  const btnTheme = document.getElementById("btn-theme-toggle");
  if (btnTheme) {
    btnTheme.addEventListener("click", toggleTheme);
  }

  // Sanitary Modal Action Buttons (RF-11, T17)
  const btnCloseSanitary = document.getElementById("btn-close-sanitary-modal");
  if (btnCloseSanitary) {
    btnCloseSanitary.addEventListener("click", closeSanitaryEventModal);
  }
  const btnSanitaryUnderstood = document.getElementById("btn-sanitary-understood");
  if (btnSanitaryUnderstood) {
    btnSanitaryUnderstood.addEventListener("click", closeSanitaryEventModal);
  }

  initTheme();
  });
}

// Export helper functions for test environments
if (typeof window !== "undefined") {
  window.applyTheme = applyTheme;
  window.toggleTheme = toggleTheme;
  window.initTheme = initTheme;
  window.diagnoseBankruptcyCauses = diagnoseBankruptcyCauses;
  window.resetGameToGreenfield = resetGameToGreenfield;
  window.setAtomicFieldError = setAtomicFieldError;
  window.clearAtomicFieldError = clearAtomicFieldError;
  window.validateAtomicInput = validateAtomicInput;
  window.bindAtomicControlValidation = bindAtomicControlValidation;
  window.generateSanitaryEvent = generateSanitaryEvent;
  window.showSanitaryEventModal = showSanitaryEventModal;
  window.closeSanitaryEventModal = closeSanitaryEventModal;
  window.isBpaAdopted = isBpaAdopted;
  window.SANITARY_EVENTS_CATALOG = SANITARY_EVENTS_CATALOG;
  window.populateDebriefingDashboard = populateDebriefingDashboard;
  window.computeSHA256Sync = computeSHA256Sync;
  window.generateAuditCSV = generateAuditCSV;
  window.exportCSV = exportCSV;
}
if (typeof global !== "undefined") {
  global.setAtomicFieldError = setAtomicFieldError;
  global.clearAtomicFieldError = clearAtomicFieldError;
  global.validateAtomicInput = validateAtomicInput;
  global.bindAtomicControlValidation = bindAtomicControlValidation;
  global.generateSanitaryEvent = generateSanitaryEvent;
  global.showSanitaryEventModal = showSanitaryEventModal;
  global.closeSanitaryEventModal = closeSanitaryEventModal;
  global.isBpaAdopted = isBpaAdopted;
  global.SANITARY_EVENTS_CATALOG = SANITARY_EVENTS_CATALOG;
  global.populateDebriefingDashboard = populateDebriefingDashboard;
  global.computeSHA256Sync = computeSHA256Sync;
  global.generateAuditCSV = generateAuditCSV;
  global.exportCSV = exportCSV;
}


