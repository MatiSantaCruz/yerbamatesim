/**
 * YerbaMateSim - Spatial Navigation and UI Wire Initializer
 * Extracted from index.html to enforce strict Content-Security-Policy (script-src 'self')
 */

export function switchSpatialScene(targetLoc) {
  const locations = ["oficina", "produccion", "mercado", "banco"];
  if (!locations.includes(targetLoc)) return;

  locations.forEach(function(l) {
    const b = document.getElementById("nav-btn-" + l);
    if (b) {
      const isActive = (l === targetLoc);
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", isActive ? "true" : "false");
    }
    const s = document.getElementById("scene-" + l);
    if (s) {
      s.style.display = (l === targetLoc) ? "block" : "none";
      s.classList.toggle("active", l === targetLoc);
    }
  });
  if (document.body) {
    document.body.setAttribute("data-spatial-location", targetLoc);
  }

  // Sync with spatialNavigator & sceneRenderer if available
  try {
    if (window.YerbaMateSimModules) {
      if (window.YerbaMateSimModules.spatial && window.YerbaMateSimModules.spatial.spatialNavigator) {
        window.YerbaMateSimModules.spatial.spatialNavigator.activeLocation = targetLoc;
      }
      if (window.gameState) {
        if (!window.gameState.spatial_ui) window.gameState.spatial_ui = {};
        window.gameState.spatial_ui.active_location = targetLoc;
      }
      if (window.YerbaMateSimModules.renderer && window.YerbaMateSimModules.renderer.sceneRenderer && window.gameState) {
        const sr = window.YerbaMateSimModules.renderer.sceneRenderer;
        if (targetLoc === "oficina") sr.renderOficina(window.gameState);
        else if (targetLoc === "produccion") sr.renderProduccion(window.gameState);
        else if (targetLoc === "mercado") sr.renderMercado(window.gameState);
        else if (targetLoc === "banco") sr.renderBanco(window.gameState);
      }
    }
  } catch (err) {
    console.warn("[switchSpatialScene] Sincronización secundaria diferida:", err);
  }

  // Update real-time projections
  try {
    if (typeof updateBottomBarProjections === "function") {
      updateBottomBarProjections();
    }
  } catch (err) {}
}

if (typeof window !== "undefined") {
  window.switchSpatialScene = switchSpatialScene;
}

export function initSpatialUI() {
  const locations = ["oficina", "produccion", "mercado", "banco"];
  locations.forEach(function(loc) {
    const btn = document.getElementById("nav-btn-" + loc);
    if (btn) {
      btn.onclick = function(e) {
        if (e) e.preventDefault();
        switchSpatialScene(loc);
      };
    }
  });

  // Initialize sceneRenderer UI bindings if available
  try {
    if (window.YerbaMateSimModules && window.YerbaMateSimModules.renderer && window.YerbaMateSimModules.renderer.sceneRenderer) {
      window.YerbaMateSimModules.renderer.sceneRenderer.bindUI(
        function() { return window.gameState; },
        window.YerbaMateSimModules.spatial ? window.YerbaMateSimModules.spatial.spatialNavigator : null
      );
    }
  } catch (e) {
    console.warn("[initSpatialUI] Error inicializando bindings de sceneRenderer:", e);
  }

  // Initialize projections reactive listeners if available
  try {
    if (typeof Projections !== "undefined" && Projections.bindSpatialProjectionsEvents && window.gameState) {
      Projections.bindSpatialProjectionsEvents(window.gameState);
    }
  } catch (e) {}

  // Wiring Modal de Herramientas y Auditoría
  const btnOpenTools = document.getElementById("btn-open-tools");
  const btnCloseTools = document.getElementById("btn-close-tools-modal");
  const toolsModal = document.getElementById("tools-modal");

  if (btnOpenTools && toolsModal) {
    btnOpenTools.onclick = function() {
      toolsModal.style.display = "flex";
    };
  }
  if (btnCloseTools && toolsModal) {
    btnCloseTools.onclick = function() {
      toolsModal.style.display = "none";
    };
  }
  if (toolsModal) {
    toolsModal.onclick = function(e) {
      if (e.target === toolsModal) {
        toolsModal.style.display = "none";
      }
    };
  }

  // Wiring Guide Modal
  const btnOpenGuide = document.getElementById("btn-open-guide");
  const btnCloseGuide = document.getElementById("btn-close-guide");
  const btnGuideUnderstood = document.getElementById("btn-guide-understood");
  const guideModal = document.getElementById("guide-modal");

  const closeGuideFn = function() {
    if (guideModal) guideModal.style.display = "none";
  };
  if (btnOpenGuide && guideModal) {
    btnOpenGuide.onclick = function() {
      guideModal.style.display = "flex";
    };
  }
  if (btnCloseGuide) btnCloseGuide.onclick = closeGuideFn;
  if (btnGuideUnderstood) btnGuideUnderstood.onclick = closeGuideFn;
  if (guideModal) {
    guideModal.onclick = function(e) {
      if (e.target === guideModal) guideModal.style.display = "none";
    };
  }

  // Wiring Glossary Drawer
  const btnOpenGlossary = document.getElementById("btn-open-glossary");
  const btnCloseGlossary = document.getElementById("btn-close-glossary-drawer");
  const glossaryDrawer = document.getElementById("glossary-drawer");

  if (btnOpenGlossary && glossaryDrawer) {
    btnOpenGlossary.onclick = function() {
      glossaryDrawer.classList.toggle("open");
    };
  }
  if (btnCloseGlossary && glossaryDrawer) {
    btnCloseGlossary.onclick = function() {
      glossaryDrawer.classList.remove("open");
    };
  }

  // Ensure initial scene is oficina
  switchSpatialScene("oficina");
}

if (typeof window !== "undefined") {
  window.initSpatialUI = initSpatialUI;
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSpatialUI);
  } else {
    initSpatialUI();
  }
}
