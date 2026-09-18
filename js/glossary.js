/**
 * YerbaMateSim - Glosario Pedagógico y Manual de Buenas Prácticas (RF-02)
 *
 * Provides an interactive sliding side drawer with official scientific definitions
 * from INTA, mass-loss conversion formulas, IRAM 20550 quality standards, and CNTA/SRT
 * labor frameworks. Accessible on-demand without interrupting or modifying the active simulation turn.
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GlossaryController = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GLOSSARY_CATEGORIES = [
    { id: "all", label: "Todos los Términos" },
    { id: "agronomia", label: "🌾 Agronomía & Tarefa" },
    { id: "industria", label: "🔥 Secado & Merma" },
    { id: "maduracion", label: "📦 Maduración & IRAM" },
    { id: "finanzas", label: "💼 Finanzas & Gestión" },
  ];

  const GLOSSARY_DATA = [
    {
      id: "tarefa",
      title: "Tarefa de Cosecha & Cuadrillas Laborales",
      category: "agronomia",
      icon: "🚜",
      source: "INTA / Res. CNTA 150/2016 / SRT",
      definition: "Labor de corte manual o semimecanizado de ramas jóvenes y follaje de yerba mate (*Ilex paraguariensis*). La Resolución CNTA 150/2016 establece el uso obligatorio de carritos de arrastre de trocha intermedia (peso máximo 100 kg) y camión con pluma o guinche mecánico.",
      formula: "Costo Tarefa BPA = $145.00/kg | Riesgo Sanción SRT = 0%",
      takeaway: "La cuadrilla mecanizada con Buenas Prácticas Agrícolas (BPA) previene la fatiga muscular del tarefero, sostiene rendimientos de 8.500 kg/ha y elimina el riesgo de clausura o multas de la SRT por sobreesfuerzo lumbar.",
      tags: ["cosecha", "tareferos", "bpa", "cnta", "ergonomia"]
    },
    {
      id: "hoja_verde",
      title: "Hoja Verde (HV) & Rendimiento Biológico",
      category: "agronomia",
      icon: "🌿",
      source: "INTA EEA Cerro Azul / EEA Montecarlo",
      definition: "Materia prima vegetal recolectada en campo (hojas maduras y ramas finas de hasta 4 mm de diámetro). El rendimiento promedio canónico en yerbales adultos bajo manejo sostenible es de 1,5 kg de hoja verde por planta madura.",
      formula: "Rendimiento Base = 1,5 kg HV/planta ≈ 8.500 kg HV/ha",
      takeaway: "La zafra gruesa se concentra entre mayo y septiembre. Mantener cubiertas verdes y labranza cero (L0) estabiliza la humedad del suelo y protege el sistema radicular frente a sequías estacionales.",
      tags: ["hoja verde", "rendimiento", "materia prima", "yerbal", "hectareas"]
    },
    {
      id: "vivero",
      title: "Vivero de Plantines (Tope Biológico 300 pl)",
      category: "agronomia",
      icon: "🌱",
      source: "INTA - Propagación Seminal de Yerba Mate",
      definition: "Instalación especializada para la estratificación de semillas y crianza de plantines en macetas plásticas de 500 ml bajo media sombra (50%). Requiere entre 9 y 12 meses antes del trasplante definitivo a campo.",
      formula: "Capacidad Máxima Vivero = 300 plantines por ciclo",
      takeaway: "El límite físico de 300 plantines por tanda simula la restricción de infraestructura y tiempo de rustificación biológica. Superar este tope degrada la tasa de prendimiento a campo.",
      tags: ["vivero", "plantines", "siembra", "semillero", "propagacion"]
    },
    {
      id: "ardido",
      title: "Riesgo de Ardido en Planchada (Ventana Crítica 24h)",
      category: "industria",
      icon: "⚠️",
      source: "INTA / Normas de Manufactura Agroindustrial",
      definition: "Fermentación bacteriana anaeróbica destructiva y autocalentamiento que sufre la hoja verde amontonada en la planchada del secadero cuando supera las 24 horas sin recibir tratamiento térmico.",
      formula: "SI HV Recibida > Capacidad Secado => Pérdida por Ardido = 100% del Excedente",
      takeaway: "La hoja verde 'ardida' pierde totalmente sus polifenoles, adquiere color pardo negruzco y olor nauseabundo, quedando inutilizable para consumo humano. Toda hoja que exceda la capacidad de secado semanal es destruida con pérdida monetaria total inmediata.",
      tags: ["ardido", "fermentacion", "planchada", "24 horas", "perecibilidad", "merma"]
    },
    {
      id: "sapecado",
      title: "Sapecado Térmico y Merma Física 3:1",
      category: "industria",
      icon: "🔥",
      source: "INTA / IRAM 20550 Parte 2",
      definition: "Proceso termodinámico de choque donde la hoja verde se expone durante 20 a 30 segundos a gases de combustión limpia a 400°C - 460°C para inactivar enzimas polifenoloxidasas y fijar el color verde. Luego pasa al secado continuo (100°C) hasta alcanzar una humedad final de 5% a 6%.",
      formula: "Kg Yerba Canchada (YMC) = Kg Hoja Verde Procesada / 3  (Merma 3:1)",
      takeaway: "Se requieren ineludiblemente 3 kg de hoja verde para producir 1 kg de yerba mate canchada debido a la evaporación masiva del agua libre celular (humedad inicial ~65-70% reducida a ~5%).",
      tags: ["sapecado", "secadero", "barbacua", "merma", "3:1", "canchada"]
    },
    {
      id: "canchada",
      title: "Yerba Mate Canchada (YMC)",
      category: "industria",
      icon: "🌾",
      source: "Código Alimentario Argentino (Art. 1192) / IRAM 20550",
      definition: "Producto resultante del sapecado, secado y primera trituración gruesa de las hojas y ramas de yerba mate. Es el estado intermedio indispensable previo al estacionamiento y la molienda fina.",
      formula: "Humedad Canchada <= 6,0% | Fracción Garrote Extraíble",
      takeaway: "La compra spot de yerba canchada constituye un 'bypass' logístico fundamental: entra directamente a los depósitos de maduración sin consumir capacidad de secado ni arriesgar ardido.",
      tags: ["canchada", "ymc", "secado", "bypass", "spot"]
    },
    {
      id: "noques",
      title: "Estacionamiento Natural en Noques (24 semanas)",
      category: "maduracion",
      icon: "🪵",
      source: "INTA / Tradición Yerbatera Misionera",
      definition: "Maduración biológica prolongada en galpones de madera con ventilación natural ('noques') durante un lapso de 6 meses a 2 años (24 semanas en el simulador). Produce degradación suave de clorofila, desarrollo de ésteres aromáticos y atenuación del amargor punzante.",
      formula: "Tiempo = 24 semanas | Índice de Calidad = 100 (Premium)",
      takeaway: "Requiere inmovilizar capital de trabajo durante 6 meses, pero genera un producto premium de máxima preferencia sensorial y mayor poder de fijación de precio en el mercado regional.",
      tags: ["noques", "estacionamiento", "maduracion natural", "calidad 100", "premium"]
    },
    {
      id: "camaras",
      title: "Cámaras Climatizadas Aceleradas (4 semanas)",
      category: "maduracion",
      icon: "⚡",
      source: "INTA / Tecnología de Maduración Forzada",
      definition: "Proceso industrial donde la yerba canchada se somete a temperatura controlada (50°C - 60°C) y humedad relativa regulada (70% - 80%) con inyección de aire forzado durante 30 a 60 días (4 semanas en el simulador).",
      formula: "Tiempo = 4 semanas | Índice de Calidad = 50 (Estándar)",
      takeaway: "Acelera drásticamente la rotación de inventarios y libera capital de trabajo 6 veces más rápido que el método natural, a expensas de un perfil sensorial estándar de menor precio relativo.",
      tags: ["camaras", "estacionamiento acelerado", "calidad 50", "rotacion", "working capital"]
    },
    {
      id: "iram20550",
      title: "Norma IRAM 20550: Yerba Mate Elaborada con Palo",
      category: "maduracion",
      icon: "🏷️",
      source: "Instituto Argentino de Normalización y Certificación (IRAM)",
      definition: "Estándar técnico nacional que reglamenta la tipificación comercial única de la yerba fraccionada. Exige un mínimo de 65% de hojas desecadas y trozadas, un máximo de 35% de palo, extracción rigurosa de garrote (ramas gruesas > 4mm) y límite estricto de goma/polvo.",
      formula: "Composición IRAM 20550 >= 65% Hoja + <= 35% Palo",
      takeaway: "La molienda unificada bajo IRAM 20550 garantiza consistencia bromatológica y habilita la venta minorista certificada en paquetes de 1 kg.",
      tags: ["iram 20550", "norma", "molienda", "tipificacion", "calidad", "elaborada con palo"]
    },
    {
      id: "apalancamiento",
      title: "Ratio de Apalancamiento D/A & Quiebra Técnica (80%)",
      category: "finanzas",
      icon: "⚖️",
      source: "Finanzas Corporativas BSS / Normativa Bancaria",
      definition: "Proporción de los activos totales de la empresa financiada mediante pasivos bancarios exigibles. Mide el riesgo de solvencia estructural.",
      formula: "Ratio D/A = Deuda Bancaria / Activos Totales <= 0,80 (80%)",
      takeaway: "Si el ratio D/A supera el 80% (o la caja queda en rojo sin margen crediticio), el sistema bancario decreta la quiebra judicial irreversible y finaliza la simulación (Game Over).",
      tags: ["apalancamiento", "deuda", "quiebra", "solvencia", "d/a", "riesgo"]
    },
    {
      id: "tasa_interes",
      title: "Tasa de Interés Activa & Capitalización Semanal",
      category: "finanzas",
      icon: "📈",
      source: "Mercado Financiero BSS",
      definition: "Costo financiero del endeudamiento bancario vigente para la empresa, fijado en una Tasa Nominal Anual (TNA) del 39,00% con Tasa Efectiva Anual (TEA) del 46,78%.",
      formula: "Tasa Semanal = (1 + 0,4678)^(1/52) - 1 ≈ 0,7429% semanal",
      takeaway: "El interés se devenga semanalmente sobre la deuda viva. Mantener deuda ociosa reduce drásticamente el EBITDA y conduce a espirales de iliquidez.",
      tags: ["tasa", "interes", "tna", "tea", "banco", "endeudamiento"]
    },
    {
      id: "costos_fijos",
      title: "Costos Fijos de Estructura ($40.000/semana)",
      category: "finanzas",
      icon: "🏢",
      source: "Estructura Operativa Agroindustrial",
      definition: "Erogaciones incondicionales que la empresa debe afrontar semana a semana independientemente del volumen cosechado o procesado (mantenimiento de galpones, seguros, administración central, servicios).",
      formula: "Costo Fijo Semanal = $40.000,00 incondicional",
      takeaway: "Constituye el 'burn rate' operativo de supervivencia. Si la producción se paraliza por falta de compras o molienda, el costo fijo continuará devengándose consumiendo caja.",
      tags: ["costo fijo", "estructura", "supervivencia", "ebitda", "burn rate"]
    },
    {
      id: "plagas_mip",
      title: "Manejo Integrado de Plagas (MIP) & Umbrales INTA",
      category: "agronomia",
      icon: "🐛",
      source: "INTA - Entomología y Sanidad de Yerba Mate",
      definition: "Estrategia agroecológica que combina monitoreo poblacional de plagas clave (Rulo, Oruga Marandová, Taladro Tigre, Ácaro Rojo) con umbrales de daño económico (UDE) y control biológico para evitar aplicaciones químicas indiscriminadas.",
      formula: "UDE Rulo = 30% brotes infestados | UDE Marandová = 15% defoliación",
      takeaway: "El descepe oportuno, la poda sanitaria y la mecanización formal con BPA mitigan las pérdidas de cosecha causadas por agentes biológicos sin perjudicar la microbiología del suelo.",
      tags: ["plagas", "mip", "rulo", "marandova", "taladro", "sanidad"]
    }
  ];

  let activeCategory = "all";
  let searchQuery = "";
  let isDrawerOpen = false;

  /**
   * Initializes glossary triggers, click delegates and DOM bindings.
   */
  function init() {
    bindGlobalTriggers();
    renderDrawer();
  }

  function bindGlobalTriggers() {
    // Open Glossary Drawer Button
    const btnOpenGlossary = document.getElementById("btn-open-glossary");
    if (btnOpenGlossary) {
      btnOpenGlossary.addEventListener("click", () => openDrawer());
    }

    // Close Button & Overlay Backdrop
    const btnClose = document.getElementById("btn-close-glossary-drawer");
    if (btnClose) {
      btnClose.addEventListener("click", () => closeDrawer());
    }

    const overlay = document.getElementById("glossary-drawer-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeDrawer();
      });
    }

    // Escape key closes drawer
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isDrawerOpen) {
        closeDrawer();
      }
    });

    // Delegated click on any [data-glossary] element across the entire UI
    document.addEventListener("click", (e) => {
      const target = e.target.closest("[data-glossary]");
      if (target) {
        e.preventDefault();
        const termId = target.getAttribute("data-glossary");
        openDrawer(termId);
      }
    });

    // Search input
    const searchInput = document.getElementById("glossary-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = (e.target.value || "").trim().toLowerCase();
        renderTermsList();
      });
    }
  }

  function openDrawer(focusTermId = null) {
    const drawer = document.getElementById("glossary-drawer");
    const overlay = document.getElementById("glossary-drawer-overlay");
    if (!drawer || !overlay) return;

    isDrawerOpen = true;
    overlay.style.display = "block";
    // Trigger transition
    requestAnimationFrame(() => {
      overlay.classList.add("open");
      drawer.classList.add("open");
    });

    if (focusTermId) {
      // Find term and switch to its category or reset to all
      const term = GLOSSARY_DATA.find(t => t.id === focusTermId);
      if (term) {
        activeCategory = "all";
        searchQuery = "";
        const searchInput = document.getElementById("glossary-search-input");
        if (searchInput) searchInput.value = "";
        renderCategories();
        renderTermsList();
        
        setTimeout(() => {
          const card = document.getElementById(`glossary-card-${focusTermId}`);
          if (card) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            card.classList.add("highlight-term");
            setTimeout(() => card.classList.remove("highlight-term"), 2500);
          }
        }, 150);
        return;
      }
    }

    renderCategories();
    renderTermsList();
  }

  function closeDrawer() {
    const drawer = document.getElementById("glossary-drawer");
    const overlay = document.getElementById("glossary-drawer-overlay");
    if (!drawer || !overlay) return;

    drawer.classList.remove("open");
    overlay.classList.remove("open");
    setTimeout(() => {
      if (!isDrawerOpen) {
        overlay.style.display = "none";
      }
    }, 280);
    isDrawerOpen = false;
  }

  function renderCategories() {
    const container = document.getElementById("glossary-categories-container");
    if (!container) return;

    container.innerHTML = "";
    GLOSSARY_CATEGORIES.forEach(cat => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `glossary-category-pill ${cat.id === activeCategory ? "active" : ""}`;
      btn.textContent = cat.label;
      btn.addEventListener("click", () => {
        activeCategory = cat.id;
        renderCategories();
        renderTermsList();
      });
      container.appendChild(btn);
    });
  }

  function getFilteredTerms() {
    return GLOSSARY_DATA.filter(term => {
      const matchesCategory = (activeCategory === "all" || term.category === activeCategory);
      if (!matchesCategory) return false;

      if (!searchQuery) return true;
      const q = searchQuery;
      return (
        term.title.toLowerCase().includes(q) ||
        term.definition.toLowerCase().includes(q) ||
        term.takeaway.toLowerCase().includes(q) ||
        term.tags.some(tag => tag.toLowerCase().includes(q))
      );
    });
  }

  function renderTermsList() {
    const listContainer = document.getElementById("glossary-terms-list");
    if (!listContainer) return;

    const terms = getFilteredTerms();
    listContainer.innerHTML = "";

    if (terms.length === 0) {
      const empty = document.createElement("div");
      empty.className = "glossary-empty-state";
      empty.innerHTML = `
        <span style="font-size: 2rem;">🔍</span>
        <p>No se encontraron términos para <strong>"${escapeHtml(searchQuery)}"</strong>.</p>
        <button class="btn btn-secondary" style="margin-top: 8px; font-size: 0.8rem;" id="btn-glossary-clear-search">Limpiar búsqueda</button>
      `;
      listContainer.appendChild(empty);
      const clearBtn = empty.querySelector("#btn-glossary-clear-search");
      if (clearBtn) {
        clearBtn.addEventListener("click", () => {
          searchQuery = "";
          const sIn = document.getElementById("glossary-search-input");
          if (sIn) sIn.value = "";
          renderTermsList();
        });
      }
      return;
    }

    terms.forEach(term => {
      const card = document.createElement("article");
      card.className = "glossary-card";
      card.id = `glossary-card-${term.id}`;

      card.innerHTML = `
        <header class="glossary-card-header">
          <div class="glossary-card-title-group">
            <span class="glossary-card-icon">${term.icon}</span>
            <h4 class="glossary-card-title">${escapeHtml(term.title)}</h4>
          </div>
          <span class="glossary-source-badge">${escapeHtml(term.source)}</span>
        </header>

        <div class="glossary-card-body">
          <p class="glossary-def-text">${escapeHtml(term.definition)}</p>

          ${term.formula ? `
            <div class="glossary-formula-box">
              <span class="formula-label">📐 Ecuación / Regla Canónica:</span>
              <code class="formula-code">${escapeHtml(term.formula)}</code>
            </div>
          ` : ''}

          <div class="glossary-takeaway-box">
            <strong class="takeaway-label">💡 Implicancia Gerencial BSS:</strong>
            <p class="takeaway-text">${escapeHtml(term.takeaway)}</p>
          </div>
        </div>

        <footer class="glossary-card-footer">
          <div class="glossary-tags-list">
            ${term.tags.map(t => `<span class="glossary-tag">#${escapeHtml(t)}</span>`).join('')}
          </div>
        </footer>
      `;

      listContainer.appendChild(card);
    });
  }

  function renderDrawer() {
    renderCategories();
    renderTermsList();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Auto-init on DOMContentLoaded if browser environment
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init);
    } else {
      init();
    }
  }

  return {
    init,
    openDrawer,
    closeDrawer,
    getGlossaryData: () => GLOSSARY_DATA,
  };
}));
