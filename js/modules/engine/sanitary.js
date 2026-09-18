/**
 * YerbaMateSim - Sanitary Events & INTA Diagnosis Module (ESM)
 */

import { SANITARY_EVENTS_CATALOG } from "../constants.js";
import { mulberry32 } from "./math.js";

/**
 * Checks if Good Agricultural Practices (BPA) are adopted by the producer.
 * @param {object} bpaStatus BPA status object
 * @returns {boolean}
 */
export function isBpaAdopted(bpaStatus) {
  if (!bpaStatus) return false;
  return Boolean(bpaStatus.terraces_sistematized && bpaStatus.zero_tillage_l0);
}

/**
 * Generates phytosanitary alert event based on INTA technical rules.
 * @param {number} week Current week
 * @param {object} bpaStatus BPA status
 * @param {number} seed Simulation seed
 * @param {string|null} forceEventType Optional event type for testing/forensics
 * @returns {object|null} Generated sanitary event or null
 */
export function generateSanitaryEvent(week, bpaStatus = null, seed = 42, forceEventType = null) {
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
