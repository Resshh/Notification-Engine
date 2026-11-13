/**
 * SQL Server Connector
 * Story 2.1, 2.2 and 7.2 | Ref: FR-05, FR-14, FR-16, BR-02
 *
 * Provides:
 *   - executeQuery(connectionDetails, queryDoc, params, options)
 *   - testConnection(connectionDetails)
 *   - closeAll()
 *
 * Modes:
 *   REAL:
 *     Uses the mssql package for approved test databases.
 *
 *   MOCK:
 *     Uses sqlServerMock.js for other databases.
 *
 * Security:
 *   - Receives already-decrypted connection details.
 *   - Validates SQL queries.
 *   - Enforces row limits and timeouts.
 *   - Blocks production-looking hosts.
 */

const { validateQuerySafety } = require("../security/validator");

const { isProductionHost } = require("../security/hostCheck");

const {
  getEffectiveRowLimit,
  getEffectiveTimeout,
  withQueryTimeout,
  enforceRowLimit,
} = require("../config/limits");

// Load MSSQL only when required.
function getMssql() {
  return require("mssql");
}

// ============================================================
// MODE SELECTION
// ============================================================

function isRealSource(c = {}) {
  const approved = (
    process.env.SQLSERVER_REAL_DATABASES || "NotificationsTest"
  )
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  return approved.includes(
    String(c.database || "").toLowerCase()
  );
}

// Block connections that appear to target production systems.
function assertSafeHost(c = {}) {
  const check = isProductionHost(c.host, c.database);

  if (!check.ok) {
    throw new Error(check.reason);
  }
}

// ============================================================
// REAL SQL SERVER CONNECTION
// ============================================================

// Cache connection pools.
const pools = new Map();

function poolKey(c) {
  return `${c.host}:${c.port || 1433}/${c.database}/${c.username}`;
}

// Build SQL Server connection configuration.
function buildConfig(c, timeoutMs) {
  const host = String(c.host || "").toLowerCase();

  const isLocal =
    host === "localhost" ||
    host === "127.0.0.1";

  // Allow self-signed certificates only for local testing.
  const trustLocal =
    isLocal &&
    process.env.SQLSERVER_TRUST_LOCAL_CERT === "true";

  return {
    server: c.host,
    port: Number(c.port) || 1433,
    database: c.database,
    user: c.username,
    password: c.password,

    connectionTimeout: 15000,
    requestTimeout: timeoutMs,

    pool: {
      max: 5,
      min: 0,
      idleTimeoutMillis: 30000,
    },

    options: {
      encrypt: true,
      trustServerCertificate: trustLocal,
    },
  };
}

// ============================================================
// ERROR HANDLING
// ============================================================

function toSafeError(err) {
  const code =
    err &&
    (
      err.code ||
      (err.originalError && err.originalError.code)
    );

  if (code === "ELOGIN") {
    return new Error(
      "SQL Server login failed. Check the username and password."
    );
  }

  if (code === "ETIMEOUT") {
    return new Error(
      "The SQL Server connection or query timed out."
    );
  }

  if (
    code === "ESOCKET" ||
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND"
  ) {
    return new Error(
      "Could not reach the SQL Server. Check the host and port."
    );
  }

  if (code === "EREQUEST") {
    return new Error(
      "SQL Server query execution failed."
    );
  }

  return new Error("SQL Server error.");
}

// ============================================================
// CONNECTION POOL MANAGEMENT
// ============================================================

async function getPool(c, timeoutMs) {
  const key = poolKey(c);

  // Reuse an existing connection pool.
  if (pools.has(key)) {
    return pools.get(key);
  }

  const pool = new (getMssql().ConnectionPool)(
    buildConfig(c, timeoutMs)
  );

  pool.on("error", () => {
    pools.delete(key);
  });

  try {
    await pool.connect();
  } catch (err) {
    throw toSafeError(err);
  }

  pools.set(key, pool);

  return pool;
}

// ============================================================
// EXECUTE REAL SQL QUERY
// ============================================================

async function executeReal(
  c,
  queryDoc,
  params,
  options
) {
  // Validate SQL query safety.
  const check = validateQuerySafety({
    kind: "sql",
    queryText: queryDoc.queryText,
    params: queryDoc.params,
    execApproved: queryDoc.execApproved,
  });

  if (!check.valid) {
    throw new Error(
      `Query blocked: ${check.error}`
    );
  }

  // Determine row limit and timeout.
  const limit = getEffectiveRowLimit(
    options.limit !== undefined
      ? options.limit
      : queryDoc.rowLimit
  );

  const timeoutMs = getEffectiveTimeout();

  // Obtain an existing or new connection pool.
  const pool = await getPool(c, timeoutMs);

  const request = pool.request();

  // Bind parameters safely through the SQL driver.
  for (const [key, value] of Object.entries(params)) {
    const name = key.replace(/^@/, "");

    if (!/^\w+$/.test(name)) {
      throw new Error(
        "Invalid parameter name."
      );
    }

    request.input(
      name,
      value === undefined ? null : value
    );
  }

  let result;

  try {
    result = await withQueryTimeout(
      () => request.query(queryDoc.queryText),
      timeoutMs,
      "SQL Server"
    );
  } catch (err) {
    if (err && err.code === "QUERY_TIMEOUT") {
      request.cancel();
      throw err;
    }

    throw toSafeError(err);
  }

  // ==========================================================
  // FORMAT RAW RESULT
  // ==========================================================

  const mssql = getMssql();

  const recordset = result.recordset || [];

  const meta = recordset.columns || {};

  const columns = Object.values(meta)
    .sort((a, b) => a.index - b.index)
    .map((m) => m.name);

  const rows = recordset.map((rec) =>
    columns.map((col) => {
      const value = rec[col];

      if (value instanceof Date) {
        return meta[col] &&
          meta[col].type === mssql.Date
          ? value.toISOString().slice(0, 10)
          : value.toISOString();
      }

      return value === undefined
        ? null
        : value;
    })
  );

  // Enforce maximum row limit.
  return {
    columns,
    rows: enforceRowLimit(rows, limit).rows,
  };
}

// ============================================================
// TEST REAL SQL SERVER CONNECTION
// ============================================================

async function testReal(c) {
  let pool;

  try {
    // Create a temporary connection.
    pool = await new (getMssql().ConnectionPool)(
      buildConfig(c, 15000)
    ).connect();

    // Execute a simple read-only query.
    await pool.request().query(
      "SELECT 1 AS ok"
    );

    return {
      ok: true,
      message: "SQL Server connection successful.",
    };
  } catch (err) {
    return {
      ok: false,
      message: toSafeError(err).message,
    };
  } finally {
    // Always close temporary connections.
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

// ============================================================
// CLOSE ALL CONNECTION POOLS
// ============================================================

async function closeAll() {
  await Promise.all(
    [...pools.values()].map((pool) =>
      pool.close().catch(() => {})
    )
  );

  pools.clear();
}

// ============================================================
// PUBLIC API: EXECUTE QUERY
// ============================================================

async function executeQuery(
  connectionDetails,
  queryDoc,
  params = {},
  options = {}
) {
  // Block production-looking connections.
  assertSafeHost(connectionDetails);

  // Execute against a real approved SQL Server database.
  if (isRealSource(connectionDetails)) {
    return executeReal(
      connectionDetails,
      queryDoc,
      params,
      options
    );
  }

  // Otherwise use the SQL Server mock connector.
  return require("./sqlServerMock").executeQuery(
    connectionDetails,
    queryDoc,
    params,
    options
  );
}

// ============================================================
// PUBLIC API: TEST CONNECTION
// ============================================================

async function testConnection(connectionDetails) {
  const check = isProductionHost(
    connectionDetails.host,
    connectionDetails.database
  );

  if (!check.ok) {
    return {
      ok: false,
      message: check.reason,
    };
  }

  // Test real SQL Server connectivity.
  if (isRealSource(connectionDetails)) {
    return testReal(connectionDetails);
  }

  // Test mock SQL Server connection.
  return require("./sqlServerMock").testConnection(
    connectionDetails
  );
}

module.exports = { executeQuery, testConnection, closeAll };
// ============================================================
// MODULE EXPORTS
// ============================================================

module.exports = {
  executeQuery,
  testConnection,
  closeAll,
};
