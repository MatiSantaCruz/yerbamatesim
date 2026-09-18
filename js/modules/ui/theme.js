/**
 * YerbaMateSim - UI Theme Manager (Light / Dark) (ESM)
 * Bounded Context: WCAG AA contrast semantics across lecture-hall displays
 */

/**
 * Applies theme (light/dark) to document element and syncs state.
 * @param {string} theme "light" | "dark"
 * @param {object|null} state Simulation game state
 */
export function applyTheme(theme, state = null) {
  const targetTheme = theme === "dark" ? "dark" : "light";
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.setAttribute("data-theme", targetTheme);
  }

  const activeState = state || (typeof window !== "undefined" ? window.gameState : null);
  if (activeState) {
    if (!activeState.ui_state) {
      activeState.ui_state = { theme: targetTheme, tutorial_completed: false, guide_open: false };
    } else {
      activeState.ui_state.theme = targetTheme;
    }
  }

  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("yerbamate_theme", targetTheme);
    }
  } catch (e) {}

  if (typeof document !== "undefined") {
    const themeLabel = document.getElementById("theme-status-text");
    if (themeLabel) {
      themeLabel.textContent = targetTheme === "dark" ? "Oscuro" : "Claro";
    }

    const toggleBtn = document.getElementById("btn-theme-toggle");
    if (toggleBtn) {
      toggleBtn.setAttribute("aria-checked", targetTheme === "dark" ? "true" : "false");
    }
  }

  if (typeof window !== "undefined" && window.simStorage && window.simStorage.saveGameStateToStorage && activeState) {
    window.simStorage.saveGameStateToStorage(activeState);
  }
}

/**
 * Toggles current active theme between light and dark.
 * @param {object|null} state Simulation game state
 * @returns {string} New active theme
 */
export function toggleTheme(state = null) {
  const activeState = state || (typeof window !== "undefined" ? window.gameState : null);
  const currentTheme = (typeof document !== "undefined" && document.documentElement.getAttribute("data-theme")) || 
                       (activeState && activeState.ui_state && activeState.ui_state.theme) || 
                       "light";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(newTheme, activeState);
  return newTheme;
}

/**
 * Initializes theme on application bootstrap.
 * @param {object|null} state Simulation game state
 */
export function initTheme(state = null) {
  let savedTheme = null;
  try {
    if (typeof localStorage !== "undefined") {
      savedTheme = localStorage.getItem("yerbamate_theme");
    }
  } catch (e) {}

  const activeState = state || (typeof window !== "undefined" ? window.gameState : null);
  if (!savedTheme && activeState && activeState.ui_state && activeState.ui_state.theme) {
    savedTheme = activeState.ui_state.theme;
  }
  applyTheme(savedTheme || "light", activeState);
}
