/**
 * Report Generation Routes
 * Story 6.3, 6.4, 6.5 | Owner: Swarnalakshmi Perumal
 *
 * Endpoints:
 *   POST /api/reports/generate
 *   Body: { queryId: string, format: "csv" | "xlsx", params?: object }
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const { runQuery } = require("../core/runQuery");
const { buildReport } = require("../reports/buildReport");

const router = express.Router();

/**
 * POST /api/reports/generate
 * Executes a query by ID and generates a CSV or Excel report.
 */
router.post("/generate", async (req, res, next) => {
  try {
    const { queryId, format = "csv", params = {} } = req.body;

    if (!queryId) {
      return res.status(400).json({
        success: false,
        message: "queryId is required."
      });
    }

    const normalizedFormat = String(format).toLowerCase();
    if (!["csv", "xlsx"].includes(normalizedFormat)) {
      return res.status(400).json({
        success: false,
        message: "Invalid format. Supported formats are 'csv' and 'xlsx'."
      });
    }

    // Step 1: Execute the query via runQuery (Story 6.2)
    const result = await runQuery(queryId, params);

    // Step 2: Build the report file (Story 6.3 & 6.4)
    const filePath = await buildReport(result, normalizedFormat);
    const fileName = path.basename(filePath);

    // Step 3: Return file download or JSON with file details
    if (req.query.download === "true") {
      return res.download(filePath, fileName);
    }

    res.status(200).json({
      success: true,
      message: `Report generated successfully (${normalizedFormat.toUpperCase()}).`,
      data: {
        fileName,
        filePath,
        format: normalizedFormat,
        rowCount: result.meta ? result.meta.rowCount : result.rows.length,
        source: result.meta ? result.meta.source : "UNKNOWN",
        downloadUrl: `/api/reports/download/${fileName}`
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/reports/download/:fileName
 * Downloads a previously generated report file from backend/reports/output/
 */
router.get("/download/:fileName", (req, res, next) => {
  try {
    const fileName = path.basename(req.params.fileName);
    const filePath = path.resolve(__dirname, "../reports/output", fileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: `File '${fileName}' not found.`
      });
    }

    res.download(filePath, fileName);
  } catch (error) {
    next(error);
  }
});

module.exports = router;

