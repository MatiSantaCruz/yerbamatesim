/**
 * YerbaMateSim - Game Guide & Interactive Tutorial Controller (T15, T24 / RF-04, RF-13).
 *
 * 1. Persistent Game Guide Modal (RF-04): On-demand reference manual for business rules.
 * 2. Guided Interactive Tutorial (RF-13): 5-step walkthrough of key interface blocks:
 *    - Step 1: Survival Header KPIs (Cash, Debt, D/A ratio, Interest rate)
 *    - Step 2: Sequential Stepper (Phases 1-4 with analytical inspection)
 *    - Step 3: Central Production Stages & Reactive Dioramas
 *    - Step 4: Lateral Contextual Panel (Spot Board & Rival Radar)
 *    - Step 5: Bottom Sticky Projection Bar (Dry-run marginal cash flow & D/A)
 *    Provides explicit skip (Skip) option, persists completion, and re-triggers on Greenfield reset.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.tutorial = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY_TUTORIAL_COMPLETED = "yerbamate_tutorial_completed";

  const TUTORIAL_STEPS = [
    {
      targetId: "survival-header",
      title: "1. Cabecera de KPIs de Supervivencia",
      icon: "📊",
      text: "Monitorea en tiempo real tu liquidez disponible, deuda bancaria y el ratio crítico D/A. Mantener el ratio de apalancamiento estrictamente por debajo del 80% (D/A < 0.80) es vital para evitar la quiebra técnica irreversible.",
    },
    {
      targetId: "stepper-steps",
      title: "2. Barra de Fases Secuenciales (Stepper)",
      icon: "👣",
      text: "La toma de decisiones se estructura en 4 fases irreversibles: 1) Abastecimiento & Tarefa, 2) CapEx & Capacidad Industrial, 3) Política Comercial & Tesorería y 4) Arena Versus & Cierre de Turno. Puedes inspeccionar analíticamente cualquiera de las 4 fases en cualquier momento.",
    },
    {
      targetId: "stages-container",
      title: "3. Cadena de Valor y Dioramas Centrales",
      icon: "🏭",
      text: "Visualiza la dinámica productiva en sus 5 eslabones: Vivero de Plantines, Plantación & Yerbales, Sapecado y Secadero Barbacuá, Estacionamiento (Noques/Cámaras) y Molienda IRAM 20550. Los dioramas cambian automáticamente a estado activo cuando asignas volumen de trabajo.",
    },
    {
      targetId: "spot-board",
      title: "4. Panel Contextual Lateral & Radar Rival",
      icon: "🤖",
      text: "Consulta las cotizaciones spot vigentes de hoja verde y yerba canchada en el mercado regional, junto a la telemetría competitiva de tu rival autónomo AgroYerba del Norte.",
    },
    {
      targetId: "bottom-projection-bar",
      title: "5. Barra Inferior de Proyección e Impacto Marginal",
      icon: "⚡",
      text: "Motor de simulación dry-run (<10ms) que proyecta en tiempo real la variación de flujo de fondos, saldo proyectado de caja y nuevo ratio D/A antes de comprometer fondos o confirmar la fase activa.",
    },
  ];

  let currentStepIndex = 0;

  function getTutorialSteps() {
    return TUTORIAL_STEPS;
  }

  function isTutorialCompleted() {
    if (typeof gameState !== "undefined" && gameState && gameState.ui_state) {
      if (gameState.ui_state.tutorial_completed) return true;
    }
    try {
      return localStorage.getItem(STORAGE_KEY_TUTORIAL_COMPLETED) === "true";
    } catch (e) {
      return false;
    }
  }

  function setTutorialCompleted(completed = true) {
    if (typeof gameState !== "undefined" && gameState && gameState.ui_state) {
      gameState.ui_state.tutorial_completed = completed;
    }
    try {
      if (completed) {
        localStorage.setItem(STORAGE_KEY_TUTORIAL_COMPLETED, "true");
      } else {
        localStorage.removeItem(STORAGE_KEY_TUTORIAL_COMPLETED);
      }
    } catch (e) {}

    if (typeof simStorage !== "undefined" && simStorage.saveGameStateToStorage && typeof gameState !== "undefined" && gameState) {
      simStorage.saveGameStateToStorage(gameState);
    }
  }

  function renderStep(index) {
    if (index < 0 || index >= TUTORIAL_STEPS.length) return;
    currentStepIndex = index;
    const step = TUTORIAL_STEPS[index];

    const badgeEl = document.getElementById("tutorial-step-badge");
    if (badgeEl) badgeEl.textContent = `Paso ${index + 1} de ${TUTORIAL_STEPS.length}`;

    const titleEl = document.getElementById("tutorial-title");
    if (titleEl) titleEl.textContent = step.title;

    const iconEl = document.getElementById("tutorial-icon");
    if (iconEl) iconEl.textContent = step.icon;

    const textEl = document.getElementById("tutorial-text");
    if (textEl) textEl.textContent = step.text;

    const btnPrev = document.getElementById("btn-tutorial-prev");
    if (btnPrev) {
      btnPrev.disabled = index === 0;
      btnPrev.style.opacity = index === 0 ? "0.4" : "1";
    }

    const btnNext = document.getElementById("btn-tutorial-next");
    if (btnNext) {
      if (index === TUTORIAL_STEPS.length - 1) {
        btnNext.textContent = "Completar Tutorial 🎉";
      } else {
        btnNext.textContent = "Siguiente ▶";
      }
    }

    // Target highlight effect and dynamic non-overlapping positioning
    highlightTargetElement(step.targetId);
  }

  function positionTutorialBox(targetEl) {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const box = document.querySelector(".tutorial-content-box");
    if (!box) return;

    if (!targetEl || typeof targetEl.getBoundingClientRect !== "function") {
      box.style.top = "50%";
      box.style.left = "50%";
      box.style.transform = "translate(-50%, -50%)";
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const boxWidth = Math.min(480, vw - 28);
    box.style.maxWidth = `${boxWidth}px`;
    box.style.width = "calc(100% - 28px)";
    box.style.transform = "none";

    const boxHeight = box.offsetHeight || 210;
    const margin = 14;

    let top = 0;
    let left = 0;

    // Detect target location relative to viewport boundaries
    const isNearBottom = rect.bottom > vh - 120;
    const isNearTop = rect.top < 120;
    const isRightLateral = rect.left > vw * 0.58 && (rect.left - boxWidth - margin) > 10;

    if (isNearBottom) {
      // Step 5 (Bottom bar): Position ABOVE target element so bar remains completely visible
      top = rect.top - boxHeight - margin;
      left = rect.left + (rect.width - boxWidth) / 2;
    } else if (isRightLateral) {
      // Step 4 (Lateral panel / Spot board): Position to the LEFT of target element
      left = rect.left - boxWidth - margin;
      top = Math.max(margin, Math.min(vh - boxHeight - margin, rect.top));
    } else if (isNearTop) {
      // Step 1 (Top bar): Position BELOW target element
      top = rect.bottom + margin;
      left = rect.left + (rect.width - boxWidth) / 2;
    } else {
      // Central elements: Step 2 (Stepper) or Step 3 (Dioramas)
      const spaceBelow = vh - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow >= boxHeight + margin) {
        top = rect.bottom + margin;
      } else if (spaceAbove >= boxHeight + margin) {
        top = rect.top - boxHeight - margin;
      } else {
        top = spaceBelow >= spaceAbove ? (rect.bottom + margin) : (rect.top - boxHeight - margin);
      }
      left = rect.left + (rect.width - boxWidth) / 2;
    }

    // Strict containment within viewport boundaries
    top = Math.max(margin, Math.min(vh - boxHeight - margin, top));
    left = Math.max(margin, Math.min(vw - boxWidth - margin, left));

    box.style.top = `${Math.round(top)}px`;
    box.style.left = `${Math.round(left)}px`;
  }

  function onWindowReposition() {
    if (currentStepIndex < 0 || currentStepIndex >= TUTORIAL_STEPS.length) return;
    const step = TUTORIAL_STEPS[currentStepIndex];
    const targetEl = document.getElementById(step.targetId) || document.querySelector(`.${step.targetId}`);
    positionTutorialBox(targetEl);
  }

  function highlightTargetElement(targetId) {
    // Remove highlight class from previously highlighted elements
    removeAllHighlights();

    if (!targetId) {
      positionTutorialBox(null);
      return;
    }
    const targetEl = document.getElementById(targetId) || document.querySelector(`.${targetId}`);
    if (targetEl) {
      targetEl.classList.add("tutorial-highlight-target");
      try {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      } catch (e) {}

      positionTutorialBox(targetEl);
      if (typeof setTimeout !== "undefined") {
        setTimeout(() => positionTutorialBox(targetEl), 80);
        setTimeout(() => positionTutorialBox(targetEl), 250);
      }
    } else {
      positionTutorialBox(null);
    }
  }

  function removeAllHighlights() {
    if (typeof document === "undefined") return;
    document.querySelectorAll(".tutorial-highlight-target").forEach(el => {
      el.classList.remove("tutorial-highlight-target");
    });
  }

  function startGuidedTutorial() {
    const modal = document.getElementById("tutorial-modal");
    if (modal) {
      modal.style.display = "block";
      renderStep(0);
      if (typeof window !== "undefined" && window.addEventListener) {
        window.addEventListener("resize", onWindowReposition, { passive: true });
        window.addEventListener("scroll", onWindowReposition, { passive: true });
      }
    }
  }

  function nextStep() {
    if (currentStepIndex < TUTORIAL_STEPS.length - 1) {
      renderStep(currentStepIndex + 1);
    } else {
      completeTutorial();
    }
  }

  function prevStep() {
    if (currentStepIndex > 0) {
      renderStep(currentStepIndex - 1);
    }
  }

  function skipTutorial() {
    setTutorialCompleted(true);
    closeTutorialModal();
  }

  function completeTutorial() {
    setTutorialCompleted(true);
    closeTutorialModal();
  }

  function closeTutorialModal() {
    const modal = document.getElementById("tutorial-modal");
    if (modal) {
      modal.style.display = "none";
    }
    removeAllHighlights();
    if (typeof window !== "undefined" && window.removeEventListener) {
      window.removeEventListener("resize", onWindowReposition);
      window.removeEventListener("scroll", onWindowReposition);
    }
  }

  function checkAutoStart(state) {
    const s = state || (typeof gameState !== "undefined" ? gameState : null);
    if (!s) return;

    // Regla de flujo estricto (Corrección 2): El tutorial no debe abrirse si el modal de estudiante está visible
    // o si el estudiante aún no ha confirmado su identidad.
    const studentModal = document.getElementById("student-modal");
    if (studentModal && studentModal.style.display !== "none") {
      return;
    }
    const student = s.student;
    if (!student || !student.name || student.name === "Pendiente" || !student.student_id || student.student_id === "---") {
      return;
    }

    if (s.week === 1 && !isTutorialCompleted()) {
      startGuidedTutorial();
    }
  }

  // --- Game Guide Modal Functions (RF-04) ---
  function openGuideModal() {
    const modal = document.getElementById("guide-modal");
    if (modal) {
      modal.style.display = "flex";
      if (typeof gameState !== "undefined" && gameState && gameState.ui_state) {
        gameState.ui_state.guide_open = true;
      }
    }
  }

  function closeGuideModal() {
    const modal = document.getElementById("guide-modal");
    if (modal) {
      modal.style.display = "none";
      if (typeof gameState !== "undefined" && gameState && gameState.ui_state) {
        gameState.ui_state.guide_open = false;
      }
    }
  }

  function initListeners() {
    // Guide Modal
    const btnOpenGuide = document.getElementById("btn-open-guide");
    if (btnOpenGuide) btnOpenGuide.addEventListener("click", openGuideModal);

    const btnCloseGuide = document.getElementById("btn-close-guide");
    if (btnCloseGuide) btnCloseGuide.addEventListener("click", closeGuideModal);

    const btnUnderstood = document.getElementById("btn-guide-understood");
    if (btnUnderstood) btnUnderstood.addEventListener("click", closeGuideModal);

    const guideModal = document.getElementById("guide-modal");
    if (guideModal) {
      guideModal.addEventListener("click", (e) => {
        if (e.target === guideModal) closeGuideModal();
      });
    }

    // Tutorial Tour Modal
    const btnNext = document.getElementById("btn-tutorial-next");
    if (btnNext) btnNext.addEventListener("click", nextStep);

    const btnPrev = document.getElementById("btn-tutorial-prev");
    if (btnPrev) btnPrev.addEventListener("click", prevStep);

    const btnSkip = document.getElementById("btn-tutorial-skip");
    if (btnSkip) btnSkip.addEventListener("click", skipTutorial);

    const btnSkipTop = document.getElementById("btn-tutorial-skip-top");
    if (btnSkipTop) btnSkipTop.addEventListener("click", skipTutorial);

    // ESC key closes active modals
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (guideModal && guideModal.style.display === "flex") {
          closeGuideModal();
        }
        const tutModal = document.getElementById("tutorial-modal");
        if (tutModal && tutModal.style.display !== "none") {
          skipTutorial();
        }
      }
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initListeners);
    } else {
      initListeners();
    }
  }

  return {
    TUTORIAL_STEPS: TUTORIAL_STEPS,
    getTutorialSteps: getTutorialSteps,
    isTutorialCompleted: isTutorialCompleted,
    setTutorialCompleted: setTutorialCompleted,
    startGuidedTutorial: startGuidedTutorial,
    startTour: startGuidedTutorial,
    nextStep: nextStep,
    prevStep: prevStep,
    skipTutorial: skipTutorial,
    completeTutorial: completeTutorial,
    closeTutorialModal: closeTutorialModal,
    positionTutorialBox: positionTutorialBox,
    checkAutoStart: checkAutoStart,
    openGuideModal: openGuideModal,
    closeGuideModal: closeGuideModal,
    openGuide: openGuideModal,
    closeGuide: closeGuideModal,
    initGuideListeners: initListeners,
  };
}));
