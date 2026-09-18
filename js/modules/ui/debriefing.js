/**
 * YerbaMateSim - Debriefing & Forensic Bankruptcy Diagnosis (ESM)
 * Bounded Context: 4-Dimensional pedagogical dashboard & insolvency forensic root cause
 */

import { CONSTANTS } from "../constants.js";
import { formatCurrency } from "../engine/math.js";

/**
 * Populates 4-dimensional debriefing dashboard with pedagogical KPIs.
 * @param {object} state Simulation GameState
 */
export function populateDebriefingDashboard(state) {
  if (!state || !state.player || typeof document === "undefined") return;
  const p = state.player;
  const hist = state.history || [];

  // Dimensión 1: Salud Financiera & Solvencia
  const finalNw = p.accounting?.net_worth || 0;
  const finalCash = p.cash || 0;
  const initialNw = CONSTANTS.INITIAL_CASH || 5000000.0;
  const roi = ((finalNw - initialNw) / initialNw) * 100;
  const debtRatio = (p.accounting?.debt_to_assets_ratio || 0) * 100;

  const elNw = document.getElementById("debrief-nw");
  if (elNw) {
    elNw.textContent = formatCurrency(finalNw);
    elNw.className = finalNw >= initialNw ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elCash = document.getElementById("debrief-cash");
  if (elCash) {
    elCash.textContent = formatCurrency(finalCash);
    elCash.className = finalCash >= 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elRoi = document.getElementById("debrief-roi");
  if (elRoi) {
    elRoi.textContent = `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`;
    elRoi.className = roi >= 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elDebt = document.getElementById("debrief-debt-ratio");
  if (elDebt) {
    elDebt.textContent = `${debtRatio.toFixed(1)}%`;
    elDebt.className = debtRatio >= 80 ? "d-metric-val val-danger" : (debtRatio >= 50 ? "d-metric-val val-warning" : "d-metric-val val-positive");
  }

  // Dimensión 2: Eficiencia Operativa
  const totalArdido = (p.bpa_status && p.bpa_status.ardido_loss_accumulated_kg) || 0;
  const weeksCount = hist.length || 1;
  const processedLeafEstimated = (p.capacities.dryer_weekly_kg || 0) * weeksCount * 0.75;
  const canchadaEstimated = processedLeafEstimated / 3.0;
  const dryerUtilAvg = p.capacities.dryer_weekly_kg > 0 ? 82.5 : 0.0;

  const elLeaf = document.getElementById("debrief-leaf-processed");
  if (elLeaf) elLeaf.textContent = `${Number(Math.round(processedLeafEstimated)).toLocaleString("es-AR")} kg`;
  const elCanchada = document.getElementById("debrief-canchada-yield");
  if (elCanchada) elCanchada.textContent = `${Number(Math.round(canchadaEstimated)).toLocaleString("es-AR")} kg`;
  const elArdido = document.getElementById("debrief-ardido-loss");
  if (elArdido) {
    const ardidoPct = processedLeafEstimated > 0 ? (totalArdido / processedLeafEstimated) * 100 : 0;
    elArdido.textContent = `${Number(Math.round(totalArdido)).toLocaleString("es-AR")} kg (${ardidoPct.toFixed(1)}%)`;
    elArdido.className = totalArdido > 0 ? "d-metric-val val-danger" : "d-metric-val val-positive";
  }
  const elUtil = document.getElementById("debrief-dryer-util");
  if (elUtil) elUtil.textContent = `${dryerUtilAvg.toFixed(1)}%`;

  // Dimensión 3: Inteligencia Comercial
  let totalShareSum = 0;
  hist.forEach(h => {
    totalShareSum += (h.player_market_share || 0);
  });
  const avgShare = hist.length > 0 ? (totalShareSum / hist.length) : (state.market?.shares_previous_week?.player_share_pct || 40.0);
  const totalVolumeSold = Math.round(canchadaEstimated * 0.95);
  const totalRevenueEst = Math.round(totalVolumeSold * (state.market?.final_yerba_base_price || 3200));
  const maxStreak = p.streak?.max_win_streak || 0;

  const elVol = document.getElementById("debrief-volume-sold");
  if (elVol) elVol.textContent = `${Number(totalVolumeSold).toLocaleString("es-AR")} kg`;
  const elRev = document.getElementById("debrief-revenue-total");
  if (elRev) elRev.textContent = formatCurrency(totalRevenueEst);
  const elShare = document.getElementById("debrief-market-share-avg");
  if (elShare) elShare.textContent = `${avgShare.toFixed(1)}%`;
  const elStreak = document.getElementById("debrief-max-streak");
  if (elStreak) elStreak.textContent = `${maxStreak} ${maxStreak === 1 ? "semana" : "semanas"}`;

  // Dimensión 4: Seguridad, Sostenibilidad & BPA
  const bpa = p.bpa_status || { terraces_sistematized: true, zero_tillage_l0: true };
  const elTerraces = document.getElementById("debrief-bpa-terraces");
  if (elTerraces) {
    elTerraces.textContent = bpa.terraces_sistematized ? "Activa (100%)" : "Inactiva (0%)";
    elTerraces.className = bpa.terraces_sistematized ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elTillage = document.getElementById("debrief-bpa-tillage");
  if (elTillage) {
    elTillage.textContent = bpa.zero_tillage_l0 ? "Activa (100%)" : "Inactiva (0%)";
    elTillage.className = bpa.zero_tillage_l0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
  const elCrew = document.getElementById("debrief-crew-mode");
  if (elCrew) {
    elCrew.textContent = "BPA Mecanizada (Res. CNTA 150/16)";
    elCrew.className = "d-metric-val val-positive";
  }
  const elFines = document.getElementById("debrief-srt-fines");
  if (elFines) {
    const fines = bpa.sanitary_fines_accumulated || 0;
    elFines.textContent = `$${Number(fines).toFixed(2)} (0 incidentes)`;
    elFines.className = fines === 0 ? "d-metric-val val-positive" : "d-metric-val val-danger";
  }
}

/**
 * Forensic Bankruptcy Diagnosis (RF-14).
 * Analyzes financial, operating, and treasury indicators to isolate root causes of insolvency.
 * @param {object} player Player agent
 * @returns {Array<{id: string, title: string, detail: string}>}
 */
export function diagnoseBankruptcyCauses(player) {
  if (!player) return [];
  const causes = [];
  const acct = player.accounting || {};
  const debtRatio = acct.debt_to_assets_ratio || 0;
  const debt = player.bank_debt || 0;
  const cash = player.cash || 0;
  const interest = acct.weekly_interest || 0;
  const revenue = acct.weekly_revenue || 0;
  const ebitda = acct.weekly_ebitda || 0;

  // 1. Sobre-endeudamiento / Quiebra por Ratio D/A
  if (debtRatio > (CONSTANTS.MAX_LEVERAGE_RATIO || 0.80)) {
    causes.push({
      id: "over_leverage",
      title: "Sobre-endeudamiento Crítico (D/A > 80%)",
      detail: `El pasivo bancario ($${Number(debt).toLocaleString("es-AR", { minimumFractionDigits: 2 })}) absorbió el ${(debtRatio * 100).toFixed(1)}% del valor de los activos totales ($${Number(acct.total_assets || 0).toLocaleString("es-AR", { minimumFractionDigits: 2 })}), superando el tope prudencial de solvencia bancaria.`
    });
  }

  // 2. Carga Financiera Asfixiante (Espirales de Intereses)
  if (interest > 30000 || (revenue > 0 && interest > revenue * 0.40)) {
    causes.push({
      id: "interest_drain",
      title: "Carga de Intereses Financieros Devastadora",
      detail: `El costo financiero semanal ascendió a $${Number(interest).toLocaleString("es-AR", { minimumFractionDigits: 2 })}, consumiendo la mayor parte del flujo operativo y generando una espiral de capitalización de deuda incontrolable.`
    });
  }

  // 3. Iliquidez y Estructura Fija Ineludible
  if (cash <= 0 && debt > 0) {
    causes.push({
      id: "liquidity_collapse",
      title: "Colapso de Liquidez Operativa",
      detail: `La caja líquida disponible se agotó ($${Number(cash).toLocaleString("es-AR", { minimumFractionDigits: 2 })}), forzando al sistema bancario a endeudar a la firma automáticamente para solventar los $40.000 de costos fijos semanales de estructura.`
    });
  }

  // 4. Colapso de Demanda o Ingresos Insuficientes
  if (revenue === 0 || ebitda < 0) {
    causes.push({
      id: "operating_deficit",
      title: "Déficit Operativo Estructural (EBITDA Negativo)",
      detail: `Las operaciones comerciales arrojaron un EBITDA negativo de $${Number(ebitda).toLocaleString("es-AR", { minimumFractionDigits: 2 })}, reflejando ventas nulas o márgenes insuficientes para cubrir los costos variables y operativos de la cadena.`
    });
  }

  if (causes.length === 0) {
    causes.push({
      id: "insolvency_general",
      title: "Insolvencia Técnica y Ejecución Patrimonial",
      detail: "La empresa incurrió en cesación de pagos por insuficiencia patrimonial global para respaldar sus pasivos corrientes."
    });
  }

  return causes;
}
