/**
 * SQL Server Connector
 * Story 2.1, 2.2 and 7.2 | Ref: FR-05, FR-14, FR-16, BR-02
 *
 * Provides:
 *   - executeQuery(connectionDetails, queryDoc, params, options) -> { columns, rows }
 *   - testConnection(connectionDetails) -> { ok, message }
 *   - closeAll() -> closes cached connection pools (used by tests and scripts)
 *
 * The mode is chosen by connection settings only (no code change):
 *   - REAL: the connection's database is on the approved list
 *           (SQLSERVER_REAL_DATABASES in .env, default "NotificationsTest" = the Docker test DB)
 *           -> runs on SQL Server through the mssql package.
 *   - MOCK: any other database -> sqlServerMock.js (in-memory engine on mock-data/demo).
 *
 * Rules: receives already-decrypted details (never decrypts), calls the shared validator,
 * the shared limits config and the shared host check, and returns raw { columns, rows }.
 */

const { validateQuerySafety } = require("../security/validator");
const { isProductionHost } = require("../security/hostCheck");
const {
  getEffectiveRowLimit,
  getEffectiveTimeout,
  withQueryTimeout,
  enforceRowLimit,
} = require("../config/limits");

// mssql is loaded only when a real connection is needed, so mock runs and unit tests stay light.
function getMssql() {
  return require("mssql");
}

// ───────────────────────── Mode switch (Story 7.2) ─────────────────────────

function isRealSource(c = {}) {
  const approved = (process.env.SQLSERVER_REAL_DATABASES || "NotificationsTest")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return approved.includes(String(c.database || "").toLowerCase());
}

// Stops production-looking hosts before any source call (sub-task 224)
function assertSafeHost(c = {}) {
  const check = isProductionHost(c.host, c.database);
  if (!check.ok) throw new Error(check.reason);
}

// ───────────────────────── Real SQL Server (mssql) ─────────────────────────

const pools = new Map(); // one pool per saved connection, reused across calls

function poolKey(c) {
  return `${c.host}:${c.port || 1433}/${c.database}/${c.username}`;
}

function buildConfig(c, timeoutMs) {
  const host = String(c.host || "").toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1";
  // TLS validation stays ON. Only the local Docker test DB may use its self-signed certificate.
  // For any other server, put the mentor's CA file in NODE_EXTRA_CA_CERTS (.env).
  const trustLocal = isLocal && process.env.SQLSERVER_TRUST_LOCAL_CERT === "true";
  return {
    server: c.host,
    port: Number(c.port) || 1433,
    database: c.database,
    user: c.username,
    password: c.password,
    connectionTimeout: 15000,
    requestTimeout: timeoutMs,
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
    options: { encrypt: true, trustServerCertificate: trustLocal },
  };
}

// Safe messages: never include host, username or password
function toSafeError(err) {
  const code = err && (err.code || (err.originalError && err.originalError.code));
  if (code === "ELOGIN") return new Error("SQL Server login failed. Check the username and password.");
  if (code === "ETIMEOUT") return new Error("The SQL Server connection or query timed out.");
  if (code === "ESOCKET" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return new Error("Could not reach the SQL Server. Check the host and port.");
  }
  if (code === "EREQUEST") return new Error(`SQL Server query error: ${err.message}`);
  return new Error("SQL Server error.");
}

async function getPool(c, timeoutMs) {
  const key = poolKey(c);
  if (pools.has(key)) return pools.get(key);
  const pool = new (getMssql().ConnectionPool)(buildConfig(c, timeoutMs));
  pool.on("error", () => pools.delete(key));
  try {
    await pool.connect();
  } catch (err) {
    throw toSafeError(err);
  }
  pools.set(key, pool);
  return pool;
}

async function executeReal(c, queryDoc, params, options) {
  // Shared validator (sub-task 62)
  const check = validateQuerySafety({
    kind: "sql",
    queryText: queryDoc.queryText,
    params: queryDoc.params,
    execApproved: queryDoc.execApproved,
  });
  if (!check.valid) throw new Error(`Query blocked: ${check.error}`);

  // Shared limits (sub-task 63)
  const limit = getEffectiveRowLimit(options.limit !== undefined ? options.limit : queryDoc.rowLimit);
  const timeoutMs = getEffectiveTimeout();

  const pool = await getPool(c, timeoutMs);
  const request = pool.request();

  // Parameters go through the driver only, never into the SQL text (sub-task 61)
  for (const [key, value] of Object.entries(params)) {
    const name = key.replace(/^@/, "");
    if (!/^\w+$/.test(name)) throw new Error("Invalid parameter name.");
    request.input(name, value === undefined ? null : value);
  }

  let result;
  try {
    result = await withQueryTimeout(() => request.query(queryDoc.queryText), timeoutMs, "SQL Server");
  } catch (err) {
    if (err && err.code === "QUERY_TIMEOUT") {
      request.cancel();
      throw err;
    }
    throw toSafeError(err);
  }

  // Raw { columns, rows } (sub-task 64)
  const mssql = getMssql();
  const recordset = result.recordset || [];
  const meta = recordset.columns || {};
  const columns = Object.values(meta)
    .sort((a, b) => a.index - b.index)
    .map((m) => m.name);
  const rows = recordset.map((rec) =>
    columns.map((col) => {
      const v = rec[col];
      if (v instanceof Date) {
        return meta[col] && meta[col].type === mssql.Date
          ? v.toISOString().slice(0, 10)
          : v.toISOString();
      }
      return v === undefined ? null : v;
    })
  );

  return { columns, rows: enforceRowLimit(rows, limit).rows };
}

// Works for unsaved form values too, so it uses a throwaway connection
async function testReal(c) {
  let pool;
  try {
    pool = await new (getMssql().ConnectionPool)(buildConfig(c, 15000)).connect();
    await pool.request().query("SELECT 1 AS ok");
    return { ok: true, message: "SQL Server connection successful." };
  } catch (err) {
    return { ok: false, message: toSafeError(err).message };
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
}

async function closeAll() {
  await Promise.all([...pools.values()].map((p) => p.close().catch(() => {})));
  pools.clear();
}

// ───────────────────────── Public API ─────────────────────────

async function executeQuery(connectionDetails, queryDoc, params = {}, options = {}) {
  assertSafeHost(connectionDetails);
  if (isRealSource(connectionDetails)) {
    return executeReal(connectionDetails, queryDoc, params, options);
  }
  return require("./sqlServerMock").executeQuery(connectionDetails, queryDoc, params, options);
}

async function testConnection(connectionDetails) {
  const check = isProductionHost(connectionDetails.host, connectionDetails.database);
  if (!check.ok) return { ok: false, message: check.reason };
  if (isRealSource(connectionDetails)) return testReal(connectionDetails);
  return require("./sqlServerMock").testConnection(connectionDetails);
}

module.exports = { executeQuery, testConnection, closeAll };