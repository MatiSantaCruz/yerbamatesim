/**
 * YerbaMateSim - Main ES Module Entry Point (Fase 1: Modularización Vanilla ESM)
 * Coordinates pure domain modules, UI controllers, and forensic export systems.
 */

import { CONSTANTS, SANITARY_EVENTS_CATALOG } from "./modules/constants.js";
import { mulberry32, computeHistoryHashSync, computeSHA256Sync, formatCurrency } from "./modules/engine/math.js";
import { generateMarket, calculateRigidDebtCap, calculateEstimatedAbsorption } from "./modules/engine/market.js";
import { isBpaAdopted, generateSanitaryEvent } from "./modules/engine/sanitary.js";
import { createAgent, initGame, calculateTotalAssets, executeAgentTurn, evaluateBotOrders } from "./modules/engine/simulation.js";
import { applyTheme, toggleTheme, initTheme } from "./modules/ui/theme.js";
import {
  showDomainExceptionBanner,
  hideDomainExceptionBanner,
  setAtomicFieldError,
  clearAtomicFieldError,
  validateAtomicInput,
  bindAtomicControlValidation
} from "./modules/ui/atoms.js";
import { populateDebriefingDashboard, diagnoseBankruptcyCauses } from "./modules/ui/debriefing.js";
import { SpatialNavigator, spatialNavigator, VALID_LOCATIONS } from "./modules/ui/spatial-navigator.js";
import { SceneRenderer, sceneRenderer } from "./modules/ui/scene-renderer.js";
import { generateAuditCSV, exportCSV, exportJSON } from "./modules/export/audit-export.js";
import "./components/index.js";

// Re-export all submodules for ESM consumers
export {
  SceneRenderer,
  sceneRenderer,
  SpatialNavigator,
  spatialNavigator,
  VALID_LOCATIONS,
  CONSTANTS,
  SANITARY_EVENTS_CATALOG,
  mulberry32,
  computeHistoryHashSync,
  computeSHA256Sync,
  formatCurrency,
  generateMarket,
  calculateRigidDebtCap,
  calculateEstimatedAbsorption,
  isBpaAdopted,
  generateSanitaryEvent,
  createAgent,
  initGame,
  calculateTotalAssets,
  executeAgentTurn,
  evaluateBotOrders,
  applyTheme,
  toggleTheme,
  initTheme,
  showDomainExceptionBanner,
  hideDomainExceptionBanner,
  setAtomicFieldError,
  clearAtomicFieldError,
  validateAtomicInput,
  bindAtomicControlValidation,
  populateDebriefingDashboard,
  diagnoseBankruptcyCauses,
  generateAuditCSV,
  exportCSV,
  exportJSON
};

// Bind to window for global runtime and testing harness compatibility
if (typeof window !== "undefined") {
  window.YerbaMateSimModules = {
    constants: CONSTANTS,
    sanitaryCatalog: SANITARY_EVENTS_CATALOG,
    math: { mulberry32, computeHistoryHashSync, computeSHA256Sync, formatCurrency },
    market: { generateMarket, calculateRigidDebtCap, calculateEstimatedAbsorption },
    sanitary: { isBpaAdopted, generateSanitaryEvent },
    simulation: { createAgent, initGame, calculateTotalAssets, executeAgentTurn, evaluateBotOrders },
    theme: { applyTheme, toggleTheme, initTheme },
    atoms: {
      showDomainExceptionBanner,
      hideDomainExceptionBanner,
      setAtomicFieldError,
      clearAtomicFieldError,
      validateAtomicInput,
      bindAtomicControlValidation
    },
    debriefing: { populateDebriefingDashboard, diagnoseBankruptcyCauses },
    export: { generateAuditCSV, exportCSV, exportJSON },
    spatial: { SpatialNavigator, spatialNavigator, VALID_LOCATIONS },
    renderer: { SceneRenderer, sceneRenderer }
  };

  if (typeof window.initSpatialUI === "function") {
    window.initSpatialUI();
  }
}

