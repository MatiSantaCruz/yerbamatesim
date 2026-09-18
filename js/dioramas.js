/**
 * Dioramas Controller - Dynamic Operational Visual States (T22 / RF-12)
 *
 * Synchronizes production dioramas (nursery, plantation/chacra, barbacuá dryer, mill)
 * between 'active' / 'processing' and 'idle' / 'empty' visual states based on active
 * orders, workload assignments, and inventory transitions.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DioramaController = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIORAMA_CONFIG = {
    vivero: {
      imgId: 'img-vivero',
      cardId: 'stage-card-vivero',
      activeSrc: 'assets/dioramas/diorama_vivero_active.png',
      idleSrc: 'assets/dioramas/diorama_vivero_empty.png',
      idleClass: 'empty'
    },
    plantacion: {
      imgId: 'img-plantacion',
      cardId: 'stage-card-plantacion',
      activeSrc: 'assets/dioramas/diorama_plantacion_growing.png',
      idleSrc: 'assets/dioramas/diorama_plantacion_empty.png',
      idleClass: 'empty'
    },
    secadero: {
      imgId: 'img-secadero',
      cardId: 'stage-card-secadero',
      activeSrc: 'assets/dioramas/diorama_secadero_active.png',
      idleSrc: 'assets/dioramas/diorama_secadero_idle.png',
      idleClass: 'idle'
    },
    molienda: {
      imgId: 'img-molienda',
      cardId: 'stage-card-molienda',
      activeSrc: 'assets/dioramas/diorama_molienda_active.png',
      idleSrc: 'assets/dioramas/diorama_molienda_idle.png',
      idleClass: 'idle'
    }
  };

  /**
   * Sets the visual state of a specific diorama.
   * @param {string} stageKey Key in DIORAMA_CONFIG ('vivero', 'plantacion', 'secadero', 'molienda')
   * @param {string} state 'active' or 'idle'/'empty'
   */
  function setDioramaState(stageKey, state) {
    const config = DIORAMA_CONFIG[stageKey];
    if (!config) return;

    const isActive = state === 'active';
    const targetSrc = isActive ? config.activeSrc : config.idleSrc;
    const idleClassName = config.idleClass || 'idle';

    const imgEl = document.getElementById(config.imgId);
    if (imgEl) {
      if (imgEl.src && !imgEl.src.endsWith(targetSrc)) {
        imgEl.src = targetSrc;
      }
      if (isActive) {
        imgEl.classList.add('active');
        imgEl.classList.remove('idle', 'empty');
      } else {
        imgEl.classList.remove('active');
        imgEl.classList.add(idleClassName);
      }
    }

    const cardEl = document.getElementById(config.cardId);
    if (cardEl) {
      if (isActive) {
        cardEl.classList.add('active');
        cardEl.classList.remove('idle', 'empty');
      } else {
        cardEl.classList.remove('active');
        cardEl.classList.add(idleClassName);
      }
    }
  }

  /**
   * Evaluates operational states for each diorama deterministically (RF-12).
   * @param {object} gameState Current GameState
   * @param {object} drafts Active draft inputs from stepper/UI
   * @returns {object} States for each diorama ('active' or 'idle'/'empty')
   */
  function evaluateDioramaStates(gameState, drafts = {}) {
    const player = (gameState && gameState.player) || {};
    const inv = player.inventories || {};
    const caps = player.capacities || {};

    // Vivero (Nursery): Active if sow order > 0, expansion order > 0, or current seedlings in inventory > 0
    const nurseryVolume = (Number(drafts.sow_seedlings_units) || 0) +
                          (Number(drafts.buy_nursery_cap) || 0) +
                          (Number(inv.seedlings) || 0);
    const viveroState = nurseryVolume > 0 ? 'active' : 'empty';

    // Plantación / Chacra: Active if harvesting hectares/kg > 0, preparing hectares > 0, or actively growing yerbales exist
    const plantationVolume = (Number(drafts.harvest_hectares) || 0) +
                             (Number(drafts.harvest_own_kg) || 0) +
                             (Number(drafts.prepare_hectares) || 0) +
                             ((inv.growing_yerbales && inv.growing_yerbales.length) || 0);
    const plantacionState = plantationVolume > 0 ? 'active' : 'empty';

    // Secadero Barbacuá: Active if green leaf processed/sourced (harvest or spot buy) > 0, or inventory > 0 with dryer capacity > 0
    const dryerVolume = (Number(drafts.harvest_own_kg) || 0) +
                        (Number(drafts.buy_green_leaf_kg) || 0) +
                        ((caps.dryer_weekly_kg > 0 && inv.green_leaf_kg > 0) ? inv.green_leaf_kg : 0);
    const secaderoState = dryerVolume > 0 ? 'active' : 'idle';

    // Molienda: Active if canchada purchased > 0, packaging order > 0, or ready canchada with mill capacity > 0
    const millVolume = (Number(drafts.buy_canchada_kg) || 0) +
                       (Number(drafts.mill_and_package_accel_kg) || 0) +
                       ((caps.mill_weekly_kg > 0 && inv.canchada_accelerated_ready_kg > 0) ? inv.canchada_accelerated_ready_kg : 0);
    const moliendaState = millVolume > 0 ? 'active' : 'idle';

    return {
      vivero: viveroState,
      plantacion: plantacionState,
      secadero: secaderoState,
      molienda: moliendaState,
    };
  }

  /**
   * Updates all dioramas given the current game state and active drafts (RF-12).
   * @param {object} gameState Current GameState
   * @param {object} drafts Active draft inputs
   * @returns {object} Calculated diorama states
   */
  function updateDioramaVisuals(gameState, drafts = {}) {
    const states = evaluateDioramaStates(gameState, drafts);

    setDioramaState('vivero', states.vivero);
    setDioramaState('plantacion', states.plantacion);
    setDioramaState('secadero', states.secadero);
    setDioramaState('molienda', states.molienda);

    if (gameState && gameState.ui_state) {
      if (!gameState.ui_state.dioramas) {
        gameState.ui_state.dioramas = {};
      }
      gameState.ui_state.dioramas.nursery = states.vivero === 'active' ? 'active' : 'idle';
      gameState.ui_state.dioramas.plantation = states.plantacion === 'active' ? 'active' : 'idle';
      gameState.ui_state.dioramas.dryer = states.secadero === 'active' ? 'active' : 'idle';
      gameState.ui_state.dioramas.mill = states.molienda === 'active' ? 'active' : 'idle';
    }

    return states;
  }

  return {
    DIORAMA_CONFIG: DIORAMA_CONFIG,
    setDioramaState: setDioramaState,
    evaluateDioramaStates: evaluateDioramaStates,
    updateDioramaVisuals: updateDioramaVisuals,
    updateDioramas: updateDioramaVisuals,
  };
}));
