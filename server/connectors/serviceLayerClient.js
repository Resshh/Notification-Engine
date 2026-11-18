/**
 * SAP Business One Service Layer Client
 * Story 4.2 & 4.3 | Ref: FR-07, FR-08, FR-09 | Batch 2 guide sections 3, 7, 8, 9
 *
 * Provides:
 *   - executeQuery(connectionDetails, queryDoc, params, options) -> { columns, rows }
 *   - testConnection(connectionDetails) -> { ok, message }
 *
 * Talks to a real Service Layer, or to the mock in mock-service-layer/ (same API):
 *   1. POST /b1s/v1/Login with the connection's company database, username and password -> B1SESSION cookie
 *   2. GET  /b1s/v1/<Entity>?$filter=&$select=&$top=<row limit>
 *   3. Follows "odata.nextLink" page by page until the row limit is reached
 *   4. Session expired (401): logs in again and retries once
 *
 * Switching mock -> real SAP needs only the connection settings (host, port, company, user, password).
 * HTTPS is used for every host except localhost. Certificate checks are never switched off: for a
 * self-signed test certificate, point NODE_EXTRA_CA_CERTS at the certificate the mentor provides.
 * The entity, GET-only and filter checks run earlier, in security/validator.js.
 */

const { getEffectiveTimeout } = require("../config/limits");

// One session cookie per connection, reused until the Service Layer says it expired.
const sessions = new Map();

const isLocalHost = (host) => /^(localhost|127\.0\.0\.1|::1)$/i.test(String(host || "").trim());
const baseUrl = (c) => `${isLocalHost(c.host) ? "http" : "https"}://${String(c.host).trim()}:${c.port || 50000}/b1s/v1/`;
const sessionKey = (c) => [c.host, c.port, c.database, c.username].join("|");

async function send(url, init = {}) {
  const timeoutMs = getEffectiveTimeout();
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error(`Service Layer did not answer within ${Math.round(timeoutMs / 1000)} seconds.`, { cause: err });
    }
    throw new Error("Cannot reach the Service Layer. Check the host and port (for the mock: npm run mock:sl, port 50000).", { cause: err });
  }
}

async function errorText(res) {
  try {
    const body = await res.json();
    return body?.error?.message?.value || res.statusText;
  } catch {
    return res.statusText;
  }
}

async function login(c) {
  const res = await send(`${baseUrl(c)}Login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ CompanyDB: c.database, UserName: c.username, Password: c.password }),
  });
  if (!res.ok) {
    sessions.delete(sessionKey(c));
    throw new Error(res.status === 401
      ? "Service Layer login failed. Check the company database, username and password."
      : `Service Layer login failed: ${await errorText(res)}`);
  }
  // Keep B1SESSION (and ROUTEID on load-balanced servers) for the next requests.
  const cookie = res.headers.getSetCookie().map((setCookie) => setCookie.split(";")[0]).join("; ");
  sessions.set(sessionKey(c), cookie);
  return cookie;
}

async function getJson(c, url) {
  let cookie = sessions.get(sessionKey(c)) || await login(c);
  let res = await send(url, { headers: { Cookie: cookie } });
  if (res.status === 401) {
    // Session expired: log in again and retry once.
    cookie = await login(c);
    res = await send(url, { headers: { Cookie: cookie } });
  }
  if (!res.ok) throw new Error(`Service Layer error: ${await errorText(res)}`);
  return res.json();
}

/**
 * Runs a saved Service Layer query and returns { columns, rows }.
 * @param {object} connectionDetails - decrypted connection (host, port, database, username, password)
 * @param {object} queryDoc          - saved query (entity, filter, select, rowLimit)
 * @param {object} _params           - not used: Service Layer queries have no runtime parameters yet
 * @param {object} options           - { limit } (Test Query passes 10)
 */
async function executeQuery(connectionDetails, queryDoc, _params = {}, options = {}) {
  const entity = String(queryDoc.entity || "").trim();
  if (!entity) throw new Error("A Service Layer query needs an entity, for example Invoices.");
  const limit = options.limit || queryDoc.rowLimit || 1000;
  const select = String(queryDoc.select || "").split(",").map((s) => s.trim()).filter(Boolean);

  const query = [`$top=${limit}`];
  if (queryDoc.filter && queryDoc.filter.trim()) query.push(`$filter=${encodeURIComponent(queryDoc.filter.trim())}`);
  if (select.length) query.push(`$select=${encodeURIComponent(select.join(","))}`);

  // Collect pages until there is no next page or the row limit is reached.
  const records = [];
  let url = `${baseUrl(connectionDetails)}${encodeURIComponent(entity)}?${query.join("&")}`;
  while (url && records.length < limit) {
    const page = await getJson(connectionDetails, url);
    records.push(...(page.value || []));
    const next = page["odata.nextLink"] || page["@odata.nextLink"];
    url = next ? new URL(next, baseUrl(connectionDetails)).toString() : null;
  }

  const kept = records.slice(0, limit);
  const columns = select.length ? select : Object.keys(kept[0] || {});
  const rows = kept.map((rec) => columns.map((col) => (rec[col] !== undefined ? rec[col] : null)));
  return { columns, rows };
}

/**
 * Tests a Service Layer connection by logging in with its details.
 * @returns {Promise<{ ok: boolean, message: string }>}
 */
async function testConnection(connectionDetails) {
  try {
    await login(connectionDetails);
    return { ok: true, message: "SAP Business One Service Layer login successful." };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

module.exports = {
  executeQuery,
  testConnection
};
