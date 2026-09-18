/**
 * YerbaMateSim - Atomic UI Feedback & Domain Exception Handling (ESM)
 * Bounded Context: Immediate pedagogical feedback without unhandled exceptions
 */

/**
 * Shows pedagogical domain exception banner when business or physical constraints are violated.
 * @param {object} options
 * @param {string} options.errorType Domain exception class name
 * @param {string} options.message Explanatory pedagogical message in Spanish
 * @param {string} [options.fieldId] HTML ID of the control that triggered the exception
 * @param {number} [options.phase] Operative phase where exception occurred
 */
export function showDomainExceptionBanner({
  errorType = "YerbaMateDomainError",
  message = "Operación no válida según las reglas del negocio.",
  fieldId = null,
  phase = null
} = {}) {
  if (typeof document === "undefined") return;

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
    if (typeof banner.scrollIntoView === "function") {
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // Highlight specific erroneous input if provided
  if (fieldId) {
    const fieldEl = document.getElementById(fieldId);
    if (fieldEl) {
      fieldEl.classList.add("has-domain-error");
      if (typeof fieldEl.focus === "function") fieldEl.focus();

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
  if (typeof window !== "undefined" && window.stepper && typeof window.stepper.handleDomainException === "function") {
    window.stepper.handleDomainException({
      errorType,
      message,
      fieldId,
      phase: phase || (window.stepper ? window.stepper.activePhase : 1)
    });
  }
}

/**
 * Dismisses contextual domain exception banner and clears error styles.
 */
export function hideDomainExceptionBanner() {
  if (typeof document === "undefined") return;

  const banner = document.getElementById("domain-exception-banner");
  if (banner) {
    banner.style.display = "none";
  }
  document.querySelectorAll(".has-domain-error").forEach(el => el.classList.remove("has-domain-error"));

  if (typeof window !== "undefined" && window.stepper && typeof window.stepper.clearDomainException === "function") {
    window.stepper.clearDomainException();
  }
}

/**
 * Applies deterministic atomic error feedback to a specific control.
 * @param {string} fieldId HTML ID of erroneous control
 * @param {string} message Pedagogical error message
 */
export function setAtomicFieldError(fieldId, message) {
  if (typeof document === "undefined") return;

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
 * Clears atomic error feedback from a specific control.
 * @param {string} fieldId HTML ID of control
 */
export function clearAtomicFieldError(fieldId) {
  if (typeof document === "undefined") return;

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
 * @param {string} fieldId HTML ID of input
 * @param {number|string} val Input value to validate
 * @returns {{ valid: boolean, message?: string }}
 */
export function validateAtomicInput(fieldId, val) {
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
 * Binds input and blur listeners to an atomic control for autonomous validation.
 * @param {string} fieldId HTML ID of input control
 */
export function bindAtomicControlValidation(fieldId) {
  if (typeof document === "undefined") return;

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
      setAtomicFieldError(fieldId, res.message || "Valor inválido.");
    } else {
      clearAtomicFieldError(fieldId);
    }
  });
}
