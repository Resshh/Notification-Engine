/**
 * Common Data Formatter
 *
 * Story 6.1 | Sprint 1
 * Ref: FR-17, sub-tasks #177, #178, #179, #180
 *
 * Takes raw { columns, rows } from any connector and returns
 * the agreed common format { columns, rows, meta }.
 *
 * Rules:
 * - Column mapping is applied ONCE, inside this formatter.
 * - Connectors return raw { columns, rows }.
 * - meta always includes source and rowCount.
 *
 * Supports:
 * - SQL Server
 * - SAP HANA
 * - SAP Business One Service Layer
 */

const { applyFieldMapping } = require("./fieldMapping");

// ============================================================
// APPLY COLUMN MAPPING
// ============================================================

/**
 * Applies column mapping to rename raw column names.
 *
 * Uses the shared fieldMapping utility (Story 5.5).
 *
 * Supported formats:
 *
 * 1. Array of objects:
 *    [{ source: "DocNum", common: "InvoiceNo" }]
 *
 * 2. Plain object:
 *    { DocNum: "InvoiceNo" }
 *
 * 3. Array of pairs:
 *    [["DocNum", "InvoiceNo"]]
 *
 * 4. JavaScript Map:
 *    new Map([["DocNum", "InvoiceNo"]])
 *
 * @param {string[]} columns
 * @param {Array|object|Map|null} columnMapping
 * @returns {string[]}
 */
function applyColumnMapping(columns, columnMapping) {
  return applyFieldMapping(columns, columnMapping);
}

// ============================================================
// FORMAT CONNECTOR RESULTS
// ============================================================

/**
 * Formats raw connector output into the agreed common shape.
 *
 * @param {object} raw
 * @param {string} source
 * @param {Array|object|Map|null} [columnMapping]
 *
 * @returns {{
 *   columns: string[],
 *   rows: any[][],
 *   meta: {
 *     source: string,
 *     rowCount: number
 *   }
 * }}
 *
 * @example
 *
 * const result = formatResult(
 *   {
 *     columns: ["DocNum", "CardName", "DocTotal"],
 *     rows: [["INV-001", "ABC Traders", 5000]]
 *   },
 *   "SQLServer",
 *   [
 *     { source: "DocNum", common: "InvoiceNo" },
 *     { source: "CardName", common: "CustomerName" },
 *     { source: "DocTotal", common: "Amount" }
 *   ]
 * );
 *
 * Output:
 * {
 *   columns: ["InvoiceNo", "CustomerName", "Amount"],
 *   rows: [["INV-001", "ABC Traders", 5000]],
 *   meta: {
 *     source: "SQLServer",
 *     rowCount: 1
 *   }
 * }
 */
function formatResult(raw, source, columnMapping = {}) {
  // ==========================================================
  // INPUT VALIDATION
  // ==========================================================

  if (!raw || typeof raw !== "object") {
    throw new Error(
      "Formatter: raw result must be an object."
    );
  }

  if (!Array.isArray(raw.columns)) {
    throw new Error(
      "Formatter: raw.columns must be an array."
    );
  }

  if (!Array.isArray(raw.rows)) {
    throw new Error(
      "Formatter: raw.rows must be an array."
    );
  }

  if (!source || typeof source !== "string") {
    throw new Error(
      "Formatter: source name is required."
    );
  }

  // ==========================================================
  // APPLY COLUMN MAPPING ONCE
  // ==========================================================

  const mappedColumns = applyColumnMapping(
    raw.columns,
    columnMapping
  );

  // ==========================================================
  // NORMALIZE ROW STRUCTURE
  // ==========================================================

  const numCols = mappedColumns.length;

  const safeRows = raw.rows.map((row) => {
    // Replace invalid rows with null values.
    if (!Array.isArray(row)) {
      return new Array(numCols).fill(null);
    }

    // Keep rows that already match the column count.
    if (row.length === numCols) {
      return row;
    }

    // Pad or trim rows to match the column count.
    const adjusted = [...row];

    while (adjusted.length < numCols) {
      adjusted.push(null);
    }

    return adjusted.slice(0, numCols);
  });

  // ==========================================================
  // RETURN COMMON FORMAT
  // ==========================================================

  return {
    columns: mappedColumns,

    rows: safeRows,

    meta: {
      source: source,
      rowCount: safeRows.length
    }
  };
}

// ============================================================
// VALIDATE RAW CONNECTOR RESULTS
// ============================================================

/**
 * Checks whether a value is a valid raw connector result.
 *
 * Used by runQuery and buildReport.
 *
 * @param {any} raw
 * @returns {boolean}
 */
function isValidRaw(raw) {
  return (
    raw !== null &&
    typeof raw === "object" &&
    Array.isArray(raw.columns) &&
    Array.isArray(raw.rows)
  );
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  formatResult,
  applyColumnMapping,
  isValidRaw
};