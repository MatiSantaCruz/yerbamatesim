/**
 * YerbaMateSim - Market Dynamics and Spot Microeconomics (ESM)
 */

import { CONSTANTS } from "../constants.js";
import { mulberry32 } from "./math.js";

/**
 * Generates market spot prices, demand bandwidth, and historical competitor quotes.
 * Deterministic PRNG seeded per simulation week.
 * @param {number} seed Base game seed
 * @param {number} week Current week number (1-120)
 * @returns {object} Market state object
 */
export function generateMarket(seed, week) {
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

/**
 * Calculates rigid debt cap respecting maximum leverage ratio D/A <= 0.80.
 * @param {object} agent Agent state
 * @param {object} market Current market state
 * @param {Function} calculateAssetsFn Function to evaluate total assets
 * @returns {number} Maximum allowed borrowing in ARS
 */
export function calculateRigidDebtCap(agent, market, calculateAssetsFn) {
  const assets = calculateAssetsFn ? calculateAssetsFn(agent, market) : (agent.total_assets || 0.0);
  const debt = agent.bank_debt || 0.0;
  if (assets <= 0) return 0.0;
  // Rigid Debt Cap formula: Delta D <= (0.80 * A - D) / 0.20
  const maxBorrow = (CONSTANTS.MAX_LEVERAGE_RATIO * assets - debt) / (1.0 - CONSTANTS.MAX_LEVERAGE_RATIO);
  return Math.max(0.0, Math.floor(maxBorrow));
}

/**
 * Calculates estimated market absorption under cross-elasticity against rival quote.
 * @param {number} baseDemand Theoretical demand in kg
 * @param {number} sellingPrice Player selling price
 * @param {number} competitorPrice Rival selling price
 * @returns {number} Estimated demand absorption in kg
 */
export function calculateEstimatedAbsorption(baseDemand, sellingPrice, competitorPrice) {
  if (!competitorPrice || competitorPrice <= 0 || !sellingPrice || sellingPrice <= 0) {
    return baseDemand || 0;
  }
  const priceDeltaPct = (competitorPrice - sellingPrice) / competitorPrice;
  const absorbed = (baseDemand || 0) * (1.0 + priceDeltaPct);
  return Math.max(0, Math.round(absorbed));
}
