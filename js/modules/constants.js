/**
 * YerbaMateSim - Core Simulation Constants (ESM)
 * Bounded Context: Operational Agro-ERP & Microeconomic Market Limits
 */

export const CONSTANTS = {
  INITIAL_CASH: 5000000.0,
  MAX_WEEKS: 120,
  WEEKLY_INTEREST_RATE: Math.pow(1.0 + 0.4678, 1.0 / 52.0) - 1.0, // ~0.007429
  MAX_LEVERAGE_RATIO: 0.80,
  DRYER_RATIO: 3.0,
  AGING_NATURAL_WEEKS: 24,
  AGING_ACCEL_WEEKS: 4,
  DRYER_OP_COST: 25.0,
  MILLING_OP_COST: 35.0,
  FIXED_COST: 40000.0,
  COST_DRYER_CAP: 150.0,
  COST_AGING_ACCEL_CAP: 95.0,
  COST_MILL_CAP: 200.0,
  COST_HECTARE: 350000.0,
};

export const SANITARY_EVENTS_CATALOG = {
  EVT_RULO: {
    event_id: "EVT-RULO-INTA",
    name: "Alerta Fitosanitaria: Brote de Rulo de la Yerba Mate (Gyropsylla spegazziniana)",
    category: "PLAGA_BROTE",
    icon: "🐛",
    description: "El monitoreo en parcelas detectó una densidad poblacional superior al Umbral de Daño Económico (>120 individuos/20 golpes). Afecta brotación tierna.",
    biological_source: "Manual de Producción de Yerba Mate INTA - Cap. Sanidad Vegetal",
    base_yield_impact_pct: 0.10,
    base_mitigation_cost_ars: 1500.0,
    ude: ">120 individuos / 20 golpes de red o >30% brotes tiernos con agallas",
    bpa_mitigation_rule: "BPA: Atenuación del 50% en pérdidas foliares por presencia de cubiertas verdes y fauna benéfica.",
    non_bpa_rule: "Sin atenuación: Monitoreo tradicional no conservacionista.",
  },
  EVT_MARANDOVA: {
    event_id: "EVT-MARAN-INTA",
    name: "Alerta Fitosanitaria: Ataque de Oruga Marandová (Perigonia lusca)",
    category: "PLAGA_DEFOLIADORA",
    icon: "🦋",
    description: "Aparición de larvas de Marandová con alta tasa de defoliación en estratos foliares medios y superiores.",
    biological_source: "INTA EEA Cerro Azul - Guía de Fitosanidad",
    base_yield_impact_pct: 0.15,
    base_mitigation_cost_ars: 2500.0,
    ude: ">2 orugas de 3er estadio por planta o defoliación >15%",
    bpa_mitigation_rule: "BPA: Detección temprana y control biológico con Baculovirus erinnyis atenúan 50% el daño.",
    non_bpa_rule: "Sin atenuación: Defoliación severa por falta de barreras biológicas.",
  },
  EVT_TALADRO: {
    event_id: "EVT-TALAD-INTA",
    name: "Alerta Fitosanitaria: Presencia de Taladro Tigre (Hedipathes betulinus)",
    category: "PLAGA_LEÑO",
    icon: "🪲",
    description: "Detección de adultos y galerías en ramas principales que comprometen la estructura del yerbal.",
    biological_source: "Guía de Buenas Prácticas Agrícolas INTA - Manejo de Hedipathes",
    base_yield_impact_pct: 0.08,
    base_mitigation_cost_ars: 1800.0,
    ude: "Presencia visible de adultos en corteza o galerías activas con aserrín",
    bpa_mitigation_rule: "BPA: Poda de saneamiento y trampas de luz reducen 50% el impacto productivo.",
    non_bpa_rule: "Sin atenuación: Daño estructural en ramas sin manejo integrado.",
  },
  EVT_SEQUIA: {
    event_id: "EVT-SEQUIA-INTA",
    name: "Contingencia Agroclimática: Estrés Hídrico Estival (Déficit Hídrico Severo)",
    category: "CLIMATICO_ESTRES",
    icon: "☀️",
    description: "Período prolongado sin precipitaciones efectivas en la cuenca yerbatera, provocando marchitamiento foliar.",
    biological_source: "INTA Clima y Agua - Monitoreo Agroclimático NEA",
    base_yield_impact_pct: 0.20,
    base_mitigation_cost_ars: 0.0,
    ude: ">21 días consecutivos sin precipitaciones efectivas (<5 mm)",
    bpa_mitigation_rule: "BPA: Sistematización de suelo en terrazas y labranza cero (L0) retienen humedad y atenúan 50% las pérdidas.",
    non_bpa_rule: "Sin atenuación: Pérdida hídrica acelerada por escurrimiento superficial.",
  },
};
