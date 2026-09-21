/**
 * YerbaMateSim - Forensic Audit & Export Module (CSV / JSON) (ESM)
 * Bounded Context: Anti-tamper academic verification with SHA-256 integrity hash
 */

import { computeSHA256Sync, computeHistoryHashSync } from "../engine/math.js";

/**
 * Neutralizes formula injection (=, +, -, @, \t, \r) and quotes CSV cells containing special characters.
 * @param {*} val
 * @returns {string}
 */
export function sanitizeCSVCell(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "number" || typeof val === "boolean") return String(val);

  let str = String(val);
  // Neutralize formula injection / DDE execution triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  // Quote if contains commas, double-quotes, or newlines
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates forensic academic audit CSV with SHA-256 anti-tamper header.
 * @param {object} stateObj GameState object
 * @returns {string} Fully formatted CSV string
 */
export function generateAuditCSV(stateObj = null) {
  const state = stateObj || (typeof window !== "undefined" ? window.gameState : {});
  const p = state.player || {};
  const s = state.student || { name: "Estudiante", student_id: "LEG-00000" };
  const historyList = (state.history && state.history.length > 0) ? state.history : [];
  const eventsList = (state.events && state.events.length > 0) ? state.events : [];

  const headers = [
    "turn",
    "fase_proceso",
    "tipo_cuadrilla",
    "kg_cosechados_hv",
    "kg_perdidos_ardido",
    "calidad_iram_lote",
    "deltaCash",
    "cashAfter",
    "debtAfter"
  ];

  const rows = [];
  if (eventsList.length > 0) {
    eventsList.forEach(e => {
      let crew = e.tipo_cuadrilla ?? p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
      if (typeof crew === "object" && crew.value) crew = crew.value;
      rows.push([
        Number(e.turn ?? 1),
        sanitizeCSVCell(e.fase_proceso ?? "RESUMEN_TURNO"),
        sanitizeCSVCell(crew),
        Number(e.kg_cosechados_hv ?? 0.0),
        Number(e.kg_perdidos_ardido ?? 0.0),
        Number(e.calidad_iram_lote ?? 100),
        Number(e.deltaCash ?? 0.0),
        Number(e.cashAfter ?? p.cash ?? 0.0),
        Number(e.debtAfter ?? p.bank_debt ?? 0.0)
      ].join(","));
    });
  } else if (historyList.length > 0) {
    historyList.forEach((item, idx) => {
      let crew = item.tipo_cuadrilla ?? p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
      if (typeof crew === "object" && crew.value) crew = crew.value;
      const turn = Number(item.turn ?? item.week ?? (idx + 1));
      const fase = String(item.fase_proceso ?? "RESUMEN_TURNO");
      const kgCosechados = Number(item.kg_cosechados_hv ?? 0.0);
      const kgArdido = Number(item.kg_perdidos_ardido ?? 0.0);
      const calidad = Number(item.calidad_iram_lote ?? 100);
      const deltaCash = Number(item.deltaCash ?? item.player_ebitda ?? 0.0);
      const cashAfter = Number(item.cashAfter ?? item.player_cash ?? p.cash ?? 0.0);
      const debtAfter = Number(item.debtAfter ?? item.player_debt ?? p.bank_debt ?? 0.0);

      rows.push([
        turn,
        sanitizeCSVCell(fase),
        sanitizeCSVCell(crew),
        kgCosechados,
        kgArdido,
        calidad,
        deltaCash,
        cashAfter,
        debtAfter
      ].join(","));
    });
  } else {
    let crew = p.bpa_status?.predominant_crew ?? "BPA_MECANIZADA";
    if (typeof crew === "object" && crew.value) crew = crew.value;
    const turn = Number(state.week ?? 1);
    const fase = "INICIAL_GREENFIELD";
    const kgCosechados = 0.0;
    const kgArdido = Number(p.bpa_status?.ardido_loss_accumulated_kg ?? 0.0);
    const calidad = 100;
    const deltaCash = 0.0;
    const cashAfter = Number(p.cash ?? 5000000.0);
    const debtAfter = Number(p.bank_debt ?? 0.0);

    rows.push([
      turn,
      sanitizeCSVCell(fase),
      sanitizeCSVCell(crew),
      kgCosechados,
      kgArdido,
      calidad,
      deltaCash,
      cashAfter,
      debtAfter
    ].join(","));
  }

  const csvBody = headers.join(",") + "\n" + rows.join("\n") + "\n";
  const sha256Hash = computeSHA256Sync(csvBody);
  const safeName = String(s.name || "Estudiante").replace(/[\r\n]/g, " ").trim();
  const safeStudentId = String(s.student_id || "LEG-00000").replace(/[\r\n]/g, " ").trim();
  const headerMeta = `# YerbaMateSim Academic Audit Log\n# Student: ${safeName} (${safeStudentId})\n# SHA-256: ${sha256Hash}\n`;

  return headerMeta + csvBody;
}

/**
 * Triggers browser download of forensic audit CSV.
 * @param {object|null} stateObj GameState object
 * @returns {string} CSV contents
 */
export function exportCSV(stateObj = null) {
  const state = stateObj || (typeof window !== "undefined" ? window.gameState : {});
  const csvContent = generateAuditCSV(state);
  const studentId = (state.student?.student_id || "LEG").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `yerbamate_sim_auditoria_${studentId}_sem${state.week || 1}.csv`;

  if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }
  return csvContent;
}

/**
 * Exports complete state and history to forensic JSON file.
 * @param {object|null} stateObj GameState object
 */
export function exportJSON(stateObj = null) {
  const state = stateObj || (typeof window !== "undefined" ? window.gameState : {});
  const p = state.player;
  const b = state.bot;
  const histList = (state.history || []).map(h => ({ ...h }));
  const auditData = {
    student: {
      name: state.student?.name || "Estudiante",
      student_id: state.student?.student_id || "LEG-00000",
    },
    game_summary: {
      version: state.version || "2.0",
      status: state.status,
      total_weeks_played: state.week,
      winner: state.winner,
      player_final_net_worth: p?.accounting?.net_worth || 0,
      bot_final_net_worth: b?.accounting?.net_worth || 0,
      player_final_cash: p?.cash || 0,
      bot_final_cash: b?.cash || 0,
      player_is_bankrupt: p?.is_bankrupt || false,
      bot_is_bankrupt: b?.is_bankrupt || false,
      player_win_streak_max: p?.streak?.max_win_streak || 0,
    },
    forensic_integrity: {
      algorithm: "CRC32-FNV1A-SYNC",
      history_checksum: computeHistoryHashSync(histList),
      total_records: histList.length,
    },
    history: histList,
    final_state: state,
  };

  if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yerbamate_sim_auditoria_${(state.student?.student_id || "LEG").replace(/[^a-zA-Z0-9]/g, "_")}_sem${state.week}.json`;
    a.click();
  }
}
