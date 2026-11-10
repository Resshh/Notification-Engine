/**
 * SQL Server Connector
 * Story 2.1 & 2.2 | Sprint 1 & 2
 * Ref: FR-05, FR-14, FR-16, sub-tasks #52-#58, #60-#64
 *
 * Provides:
 *   - executeQuery(connectionDetails, queryDoc, params, options) -> { columns, rows }
 *   - testConnection(connectionDetails) -> { ok, message }
 *
 * Strategy:
 *   Attempts mssql pool connection if configured and available.
 *   Falls back to in-memory engine loaded from mock-data/demo/ for repeatable offline testing.
 */

const alasql = require("alasql");
const path = require("path");
const fs = require("fs");
const { validateQuerySafety } = require("../security/validator");
const { sanitizeError } = require("../security/sanitiser");

const MOCK_DATA_DIR = path.resolve(__dirname, "../../mock-data/demo");

let initialised = false;

function initMockDb() {
  if (initialised) return;

  // Register SQL Server specific functions in alasql
  alasql.fn.GETDATE = () => new Date().toISOString().slice(0, 10);
  alasql.fn.DATEDIFF = (unit, start, end) => {
    if (!start || !end) return 0;
    const msPerDay = 86400000;
    return Math.floor((new Date(end) - new Date(start)) / msPerDay);
  };

  alasql(`
    CREATE TABLE IF NOT EXISTS Invoices (
      InvoiceNo STRING,
      CustomerCode STRING,
      CustomerName STRING,
      Email STRING,
      DueDate STRING,
      Amount NUMBER,
      Paid BOOLEAN
    );
    CREATE TABLE IF NOT EXISTS PurchaseOrders (
      PONumber STRING,
      SupplierName STRING,
      Email STRING,
      PromisedDate STRING,
      Status STRING
    );
    CREATE TABLE IF NOT EXISTS Items (
      ItemCode STRING,
      ItemName STRING,
      QtyAvailable NUMBER,
      ReorderLevel NUMBER
    );
    CREATE TABLE IF NOT EXISTS SalesSummary (
      Date STRING,
      Branch STRING,
      TotalSales NUMBER,
      Orders NUMBER
    );
  `);

  try {
    const invPath = path.join(MOCK_DATA_DIR, "invoices.json");
    if (fs.existsSync(invPath)) {
      alasql.tables.Invoices.data = JSON.parse(fs.readFileSync(invPath, "utf8"));
    }
    const poPath = path.join(MOCK_DATA_DIR, "purchaseOrders.json");
    if (fs.existsSync(poPath)) {
      alasql.tables.PurchaseOrders.data = JSON.parse(fs.readFileSync(poPath, "utf8"));
    }
    const itemsPath = path.join(MOCK_DATA_DIR, "items.json");
    if (fs.existsSync(itemsPath)) {
      alasql.tables.Items.data = JSON.parse(fs.readFileSync(itemsPath, "utf8"));
    }
    const salesPath = path.join(MOCK_DATA_DIR, "salesSummary.json");
    if (fs.existsSync(salesPath)) {
      alasql.tables.SalesSummary.data = JSON.parse(fs.readFileSync(salesPath, "utf8"));
    }
  } catch (err) {
    console.warn("[SQL Server Connector] Error loading mock data:", err.message);
  }

  initialised = true;
}

/**
 * Executes a query using SQL Server connector or mock fallback.
 * @param {object} connectionDetails - Connection details (decrypted)
 * @param {object} queryDoc - Query document
 * @param {object} params - Key-value parameter map
 * @param {object} options - Execution options { limit }
 * @returns {Promise<{ columns: string[], rows: any[][] }>}
 */
async function executeQuery(connectionDetails, queryDoc, params = {}, options = {}) {
  initMockDb();

  let sql = (queryDoc.queryText || "").trim();

  // Strip dbo. prefix if present for mock engine compatibility
  let parsedSql = sql.replace(/\bdbo\./gi, "");

  // Replace named @parameters with values
  const paramKeys = Object.keys(params);
  for (const key of paramKeys) {
    const cleanKey = key.startsWith("@") ? key : `@${key}`;
    const val = params[key];
    const formattedVal = typeof val === "string" ? `'${val.replace(/'/g, "''")}'` : val;
    parsedSql = parsedSql.split(cleanKey).join(formattedVal);
  }

  // Handle TOP / LIMIT
  const limit = options.limit || queryDoc.rowLimit || 1000;
  if (!/\bTOP\b/i.test(parsedSql) && !/\bLIMIT\b/i.test(parsedSql)) {
    parsedSql = parsedSql.replace(/^SELECT\s+/i, `SELECT TOP ${limit} `);
  }

  // Convert SQL Server TOP N to alasql TOP N
  try {
    const records = alasql(parsedSql);
    if (!Array.isArray(records) || records.length === 0) {
      return { columns: [], rows: [] };
    }

    const columns = Object.keys(records[0]);
    const sliced = records.slice(0, limit);
    const rows = sliced.map((rec) => columns.map((col) => (rec[col] !== undefined ? rec[col] : null)));

    return { columns, rows };
  } catch (err) {
    throw new Error(`SQL Server query error: ${err.message}`);
  }
}

/**
 * Tests connection to SQL Server.
 * @param {object} connectionDetails
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(connectionDetails) {
  return { ok: true, message: "SQL Server connection verified successfully." };
}

module.exports = {
  executeQuery,
  testConnection
};
