const sql = require('mssql');

// One pool per saved connection, reused across calls (sub-task 55)
const pools = new Map();

function poolKey(c) {
  return `${c.host}:${c.port || 1433}/${c.database}/${c.username}`;
}

// Receives ALREADY-DECRYPTED details from runQuery (sub-task 54).
// This file never decrypts anything itself.
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
      // Local Docker test DB only; defaults to false so TLS validation stays on
      trustServerCertificate: process.env.SQLSERVER_TRUST_LOCAL_CERT === 'true',
    },
  };
}

// Safe messages: never include host, username or password (sub-task 56)
function toSafeError(err) {
  const code = err && (err.code || (err.originalError && err.originalError.code));
  if (code === 'ELOGIN') return new Error('Login failed. Check the username and password.');
  if (code === 'ETIMEOUT') return new Error('The connection or query timed out.');
  if (code === 'ESOCKET' || code === 'ECONNREFUSED' || code === 'ENOTFOUND')
    return new Error('Could not reach the SQL Server. Check the host and port.');
  return new Error('SQL Server error.');
}

async function connect(conn, timeoutMs) {
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

// Basic execute. Story 2.2 adds validator, parameters, row limit and timeout.
async function execute(conn, queryText) {
  const pool = await connect(conn);
  try {
    const result = await pool.request().query(queryText);
    const columns = Object.keys(result.recordset.columns);
    const rows = result.recordset.map((r) => columns.map((c) => r[c]));
    return { columns, rows };            // raw shape, no meta (formatter adds it)
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

// Sub-task 57: works for unsaved form values too, so it uses a throwaway pool
async function testConnection(conn) {
  let pool;
  try {
    pool = await new sql.ConnectionPool(buildConfig(conn, 15000)).connect();
    await pool.request().query('SELECT 1 AS ok');
    return { ok: true, message: 'Connection successful.' };
  } catch (err) {
    return { ok: false, message: toSafeError(err).message };
  } finally {
    if (pool) await pool.close().catch(() => {});
  }
}

module.exports = { connect, execute, close, testConnection };