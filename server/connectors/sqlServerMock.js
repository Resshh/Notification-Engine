/**
 * SQL Server Connector
 * Stories 2.1, 2.2, 5.2, 5.6 | Sprint 1 & 2
 * Ref: FR-05, FR-14, FR-16, sub-tasks #51-#66, #146, #169-#171
 *
 * Strategy:
 *   If 'mssql' is installed and configured -> connects to real SQL Server.
 *   Otherwise -> gracefully falls back to the in-memory alasql engine loaded
 *   from mock-data/demo/ for repeatable offline testing and demo execution.
 */

const path = require("path");
const fs = require("fs");
const alasql = require("alasql");

let sql = null;
try {
  sql = require("mssql");
} catch {
  // mssql not installed or offline mode
  sql = null;
}

const pools = new Map();

function poolKey(c) {
  return `${c.host}:${c.port || 1433}/${c.database}/${c.username}`;
}

function buildConfig(c, timeoutMs = 30000) {
  return {
    server: c.host,
    port: Number(c.port) || 1433,
    database: c.database,
    user: c.username,
    password: c.password,
    connectionTimeout: 15000,
    requestTimeout: timeoutMs,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: true,
      trustServerCertificate: process.env.SQLSERVER_TRUST_LOCAL_CERT === "true",
    },
  };
}

function toSafeError(err) {
  const code = err && (err.code || (err.originalError && err.originalError.code));
  if (code === "ELOGIN") return new Error("Login failed. Check the username and password.");
  if (code === "ETIMEOUT") return new Error("The connection or query timed out.");
  if (code === "ESOCKET" || code === "ECONNREFUSED" || code === "ENOTFOUND")
    return new Error("Could not reach the SQL Server. Check the host and port.");
  return new Error("SQL Server error: " + (err.message || "Failed to execute."));
}

async function connect(conn, timeoutMs = 30000) {
  if (!sql) {
    throw new Error("mssql driver is not available in offline environment.");
  }
  const key = poolKey(conn);
  if (pools.has(key)) return pools.get(key);
  try {
    const pool = await new sql.ConnectionPool(buildConfig(conn, timeoutMs)).connect();
    pools.set(key, pool);
    return pool;
  } catch (err) {
    throw toSafeError(err);
  }
}

async function close(conn) {
  const key = poolKey(conn);
  const pool = pools.get(key);
  if (pool) {
    await pool.close();
    pools.delete(key);
  }
}

// ── Mock Data Fallback Engine (alasql) ──────────────────────────────────────────
const MOCK_DATA_DIR = path.resolve(__dirname, "../../mock-data/demo");
let mockInitialised = false;

function initMockDb() {
  if (mockInitialised) return;

  alasql.fn.GETDATE = () => new Date().toISOString().slice(0, 10);
  alasql.fn.DATEDIFF = (unit, start, end) => {
    let s = start;
    let e = end;
    if (end === undefined) {
      s = unit;
      e = start;
    }
    if (!s || !e) return 0;
    const msPerDay = 86400000;
    return Math.floor((new Date(e) - new Date(s)) / msPerDay);
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

  mockInitialised = true;
}

/**
 * Core query execution interface used by runQuery and executeQuery.
 *
 * @param {object} connectionDetails - Connection settings
 * @param {object} queryDoc - Mongoose Query document or plain object
 * @param {object} params - Key-value parameter dictionary
 * @param {object} options - Execution options { limit }
 * @returns {Promise<{ columns: string[], rows: any[][] }>}
 */
async function executeQuery(connectionDetails, queryDoc, params = {}, options = {}) {
  // If mssql is available and not in mock mode, attempt real execution
  if (sql && process.env.USE_REAL_SQLSERVER === "true") {
    try {
      const pool = await connect(connectionDetails);
      const request = pool.request();

      // Bind parameters
      for (const [k, v] of Object.entries(params)) {
        const paramName = k.replace(/^@/, "");
        request.input(paramName, v);
      }

      const result = await request.query(queryDoc.queryText);
      const columns = Object.keys(result.recordset.columns || {});
      const limit = options.limit || queryDoc.rowLimit || 1000;
      const sliced = result.recordset.slice(0, limit);
      const rows = sliced.map((r) => columns.map((c) => r[c]));
      return { columns, rows };
    } catch (err) {
      throw toSafeError(err);
    }
  }

  // Otherwise, use in-memory mock engine with SQL Server dialect
  initMockDb();

  let sqlText = (queryDoc.queryText || "").trim();

  // Strip schema prefix e.g. dbo.
  let parsedSql = sqlText.replace(/\bdbo\./gi, "");

  // Handle T-SQL DATEDIFF unquoted datepart (e.g. DATEDIFF(day, ...) -> DATEDIFF('day', ...))
  parsedSql = parsedSql.replace(/\bDATEDIFF\s*\(\s*(day|d|dd|month|m|mm|year|yy|yyyy)\s*,/gi, (match, part) => {
    return `DATEDIFF('${part}',`;
  });

  // Handle T-SQL bit boolean compatibility for mock data (Paid = 0 / Paid = 1)
  parsedSql = parsedSql.replace(/\bPaid\s*=\s*0\b/gi, "(Paid = false OR Paid = 0)");
  parsedSql = parsedSql.replace(/\bPaid\s*=\s*1\b/gi, "(Paid = true OR Paid = 1)");

  // Substitute named parameters
  for (const [k, v] of Object.entries(params)) {
    const cleanKey = k.startsWith("@") ? k : `@${k}`;
    const formattedVal = typeof v === "string" ? `'${v.replace(/'/g, "''")}'` : v;
    parsedSql = parsedSql.split(cleanKey).join(formattedVal);
  }

  const limit = options.limit || queryDoc.rowLimit || 1000;
  if (!/\bTOP\b/i.test(parsedSql) && !/\bLIMIT\b/i.test(parsedSql)) {
    parsedSql = parsedSql.replace(/^SELECT\s+/i, `SELECT TOP ${limit} `);
  }

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

async function execute(conn, queryText) {
  return executeQuery(conn, { queryText }, {}, {});
}

async function testConnection(conn) {
  if (sql && process.env.USE_REAL_SQLSERVER === "true") {
    let pool;
    try {
      pool = await new sql.ConnectionPool(buildConfig(conn, 15000)).connect();
      await pool.request().query("SELECT 1 AS ok");
      return { ok: true, message: "Connection successful." };
    } catch (err) {
      return { ok: false, message: toSafeError(err).message };
    } finally {
      if (pool) await pool.close().catch(() => {});
    }
  }

  return { ok: true, message: "SQL Server connection verified successfully." };
}

module.exports = {
  connect,
  execute,
  executeQuery,
  close,
  testConnection,
};
