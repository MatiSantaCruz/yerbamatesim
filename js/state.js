/**
 * YerbaMateSim - State Management & LocalStorage Persistence (RF-16, RF-17, RF-18)
 *
 * Guarantees round-trip resilience against accidental page reloads (F5),
 * browser crashes, tab closure, and provides clean destructive resets to Greenfield state.
 */

const STORAGE_KEYS = {
  GAME_STATE: "yerbamate_game_state",
  STEPPER_STATE: "yerbamate_stepper_state",
  STUDENT: "yerbamate_student",
};

/**
 * Persist the entire active simulation state to LocalStorage (RF-16).
 * @param {object} state Active GameState object
 */
function saveGameStateToStorage(state) {
  if (!state) return;
  try {
    localStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
  } catch (e) {
    console.warn("Could not persist game state to LocalStorage:", e);
  }
}

/**
 * Load the persisted simulation state from LocalStorage (RF-16).
 * @returns {object|null} Restored GameState or null if not found
 */
function loadGameStateFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.week === "number") {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Could not parse game state from LocalStorage:", e);
  }
  return null;
}

/**
 * Persist student identification metadata to LocalStorage (RF-01, RF-17).
 * @param {object} student { name, student_id }
 */
function saveStudentToStorage(student) {
  if (!student) return;
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENT, JSON.stringify(student));
  } catch (e) {}
}

/**
 * Retrieve saved student identification metadata (RF-01, RF-17).
 * @returns {object|null}
 */
function loadStudentFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STUDENT);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

/**
 * Persist current stepper state to LocalStorage (RF-06, RF-16).
 * @param {object} stepperState Serialized stepper state
 */
function saveStepperToStorage(stepperState) {
  if (!stepperState) return;
  try {
    localStorage.setItem(STORAGE_KEYS.STEPPER_STATE, JSON.stringify(stepperState));
  } catch (e) {
    console.warn("Could not persist stepper state to LocalStorage:", e);
  }
}

/**
 * Load persisted stepper state from LocalStorage (RF-06, RF-16).
 * @returns {object|null}
 */
function loadStepperFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.STEPPER_STATE);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not parse stepper state from LocalStorage:", e);
  }
  return null;
}

/**
 * Destructively clear all simulation, stepper, and student data from LocalStorage (RF-18).
 */
function clearAllStorageSessions() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    localStorage.removeItem(STORAGE_KEYS.STEPPER_STATE);
    localStorage.removeItem(STORAGE_KEYS.STUDENT);
  } catch (e) {
    console.warn("Error clearing LocalStorage sessions:", e);
  }
}

// Export for window environment and testing
if (typeof window !== "undefined") {
  window.simStorage = {
    saveGameStateToStorage,
    loadGameStateFromStorage,
    saveStudentToStorage,
    loadStudentFromStorage,
    saveStepperToStorage,
    loadStepperFromStorage,
    clearAllStorageSessions,
    STORAGE_KEYS,
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    saveGameStateToStorage,
    loadGameStateFromStorage,
    saveStudentToStorage,
    loadStudentFromStorage,
    saveStepperToStorage,
    loadStepperFromStorage,
    clearAllStorageSessions,
    STORAGE_KEYS,
  };
}

