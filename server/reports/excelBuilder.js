/**
 * Excel Builder
 * Story 6.4 | Sprint 2
 * Ref: sub-tasks #196, #197, #198, #199, FR-19, NFR-05
 * Story 6.4 | Owner: Swarnalakshmi Perumal | Sprint 2
 * Ref: sub-tasks #196, #197, #198, #199
 *
 * Converts a common-format result { columns, rows } into a valid XLSX file using ExcelJS.
 * Features:
 *   - Creates workbook, worksheet, headers, and rows (sub-task #196)
 *   - Auto-calculates column widths for legible display (sub-task #196)
 *   - Protects against formula injection by neutralizing =, +, -, @ (sub-task #197)
 *   - Preserves numeric types for proper spreadsheet calculations (sub-task #196)
 *   - Writes to a unique timestamped file and returns absolute path (sub-task #198)
 */

const ExcelJS = require("exceljs");
const path = require("path");

/**
 * Writes an XLSX file from common-format data and returns its absolute path.
 *
 * @param {{ columns: string[], rows: any[][] }} result - Common-format result
 * @param {string} outputDir - Directory to write the file into
 * @returns {Promise<string>} Absolute path to the generated XLSX file
 */
async function writeExcel(result, outputDir) {
  if (!result || typeof result !== "object") {
    throw new Error("excelBuilder: invalid result — expected an object.");
  }

  const columns = Array.isArray(result.columns) ? result.columns : [];
  const rows = Array.isArray(result.rows) ? result.rows : [];

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Notification Engine";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 1 }] // Freeze header row
  });

  // ── Handle empty columns edge-case ──────────────────────────────────────────
  const effectiveColumns = columns.length > 0 ? columns : ["Message"];
  const effectiveRows = columns.length === 0 && rows.length === 0 ? [["No data available"]] : rows;

  // ── Calculate column widths dynamically ─────────────────────────────────────
  worksheet.columns = effectiveColumns.map((colName, colIdx) => {
    let maxLen = colName ? String(colName).length : 10;

    for (const row of effectiveRows) {
      if (row && row[colIdx] !== undefined && row[colIdx] !== null) {
        const cellLen = String(row[colIdx]).length;
        if (cellLen > maxLen) {
          maxLen = cellLen;
        }
      }
    }

    return {
      header: String(colName),
      key: `col_${colIdx}`,
      width: Math.min(50, Math.max(12, maxLen + 3))
    };
  });

  // ── Style Header Row (sub-task #196) ────────────────────────────────────────
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" } // Royal blue header fill
  };
  headerRow.alignment = { vertical: "middle", horizontal: "left" };
  headerRow.height = 24;
  headerRow.commit();

  // ── Data Rows — Safe Formatting & Formula Neutralization (sub-task #197) ────
  for (const row of effectiveRows) {
    if (!Array.isArray(row)) continue;

    const safeRow = row.map((cell) => {
      if (cell === null || cell === undefined) {
        return "";
      }

      // Preserve native numbers and booleans
      if (typeof cell === "number" || typeof cell === "boolean") {
        return cell;
      }

      const str = String(cell);
      // Neutralize formula injection by prefixing with a single space if it starts with =, +, -, @
      if (/^[=+\-@]/.test(str)) {
        return ` ${str}`;
      }

      return str;
    });

    const addedRow = worksheet.addRow(safeRow);
    addedRow.alignment = { vertical: "middle" };
  }

  // ── Generate Unique Timestamped File Path (sub-task #198) ───────────────────
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const randomSuffix = Math.random().toString(36).substring(2, 7);
  const filename = `report_${timestamp}_${randomSuffix}.xlsx`;
  const filePath = path.join(outputDir, filename);

  // ── Save File and Return Path ───────────────────────────────────────────────
  await workbook.xlsx.writeFile(filePath);

  return filePath;
}

module.exports = { writeExcel };
