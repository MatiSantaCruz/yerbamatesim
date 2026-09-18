/**
 * YerbaMateSim - Simulation Engine & Turn Processing (ESM)
 */

import { CONSTANTS } from "../constants.js";
import { generateMarket } from "./market.js";

/**
 * Factory creating initial agent structure for player and bots.
 * @param {string} name Agent displayName
 * @returns {object} Fresh agent structure
 */
export function createAgent(name) {
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

/**
 * Calculates valuation of total assets (Cash + Fixed Assets + Inventories at Market Spot).
 * @param {object} agent Agent state
 * @param {object} market Current market spot quotes
 * @returns {number} Asset valuation in ARS
 */
export function calculateTotalAssets(agent, market) {
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

/**
 * Initializes simulation game state.
 * @param {number} seed Integer seed
 * @param {object} student Student identification
 * @returns {object} Initialized GameState
 */
export function initGame(seed = 42, student = null) {
  const studentData = student || { name: "Estudiante", student_id: "LEG-00000" };
  const state = {
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
  state.player.streak = { current_win_streak: 0, max_win_streak: 0, dominant_metric: "ebitda" };
  return state;
}

/**
 * Executes agent turn orders through biological, industrial, sales and financial pipelines.
 * @param {object} agent Agent object
 * @param {object} orders Weekly player or bot orders
 * @param {object} market Current market state
 * @param {number|null} competitorPrice Rival price for cross-elasticity
 * @param {boolean} competitorBankrupt Whether competitor is bankrupt
 */
export function executeAgentTurn(agent, orders, market, competitorPrice = null, competitorBankrupt = false) {
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

  // 3. Dryer Processing (with 24h Ardido risk and 3:1 Merma)
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

  // 5. Milling & Packaging (IRAM 20550 Typification)
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

  // 6. Sales with Price Elasticity
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

  // EBITDA Calculation
  agent.accounting.weekly_op_cost = weeklyOpCost;
  agent.accounting.weekly_ebitda = +(agent.accounting.weekly_revenue - weeklyOpCost - CONSTANTS.FIXED_COST).toFixed(2);

  // 7. Treasury Orders
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

  // 8. Fixed Costs & Solvency
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

/**
 * Evaluates rival AI bot decisions and generates telemetry narrative.
 * @param {object} bot Bot agent
 * @param {object} market Current market state
 * @returns {object} Bot orders
 */
export function evaluateBotOrders(bot, market) {
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
